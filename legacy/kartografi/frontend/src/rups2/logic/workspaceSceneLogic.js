// src/logic/workspaceSceneLogic.js
import Phaser from "phaser";
import { Battery } from "../components/battery";
import { Bulb } from "../components/bulb";
import { Wire } from "../components/wire";
import { Resistor } from "../components/resistor";
import { Switch } from "../components/switch";
import { getUiScale } from "../utils/uiScale";

import { CircuitGraph } from "./circuit_graph";
import { Node } from "./node";

// ✅ rups2 API prefix
const API_BASE = "/api/rups2";

// kateri ključi v localStorage so povezani z igranjem v WorkspaceScene
const WORKSPACE_STORAGE_KEYS = ["currentChallengeIndex"];
const OUTSIDE_GRID_RESULT_KEY = "geoEleBuildResult";
const INSIDE_GRID_RESULT_KEY = "geoEleInsideResult";
export const CITY_DEMAND_MW = 500;
const DEFAULT_WORKSPACE_KEY = "workspaceComponents";

/**
 * Pobriše vse podatke o igranju za WorkspaceScene iz localStorage.
 */
export function resetWorkspaceProgress() {
  WORKSPACE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

/**
 * Inicializira logiko za WorkspaceScene.
 * Kličeš v preload() scene.
 */
export function initWorkspaceLogic(scene) {
  scene.graph = new CircuitGraph();
  scene.placedComponents = [];
  scene.insidePlacedComponents = [];
  scene.gridSize = scene.gridSize || 40;
  scene.gridStartX = scene.gridStartX || 200;
  scene.gridStartY = scene.gridStartY || 0;
  scene.gridEndX = scene.gridEndX || (scene.scale?.width || scene.sys.game.config.width);
  scene.gridEndY = scene.gridEndY || (scene.scale?.height || scene.sys.game.config.height);
  scene.panelWidth = scene.panelWidth || 200;
  scene.challenges = [];
  scene.sim = undefined;
  scene.sessionPoints = 0;

  scene.isDraggingComponent = false;
  scene.isExampleMode = scene.isExampleMode || false;
  scene.workspaceStorageKey = scene.workspaceStorageKey || DEFAULT_WORKSPACE_KEY;

  scene.input.on("pointerdown", (pointer) => {
    if (pointer.button !== 0) return;
    if (scene.isExampleMode) return;
    if (scene.contextMenu || scene.contextMenuJustOpened) return;
    if (scene.isDraggingComponent) return;
    if (pointer.x < (scene.panelWidth ?? 200)) return;

    const width = scene.scale?.width || scene.sys.game.config.width;
    if (pointer.x > width - 250 && pointer.y < 250) return;

    const placementStartX = scene.gridStartX ?? scene.panelWidth ?? 200;
    if (!scene.dragMode && scene.activeComponentType && pointer.x > placementStartX) {
      const snapped = snapToGrid(scene, pointer.x, pointer.y);
      placeComponentAtPosition(scene, snapped.x, snapped.y, scene.activeComponentType.type, scene.activeComponentType.color);
    }
  });

  if (!scene.contextMenuPrevented) {
    const canvas = scene.game.canvas;
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      return false;
    });
    scene.contextMenuPrevented = true;
  }
}

/**
 * ✅ Naloži izzive iz rups2 API-ja
 */
export function loadChallengesFromApi(scene) {
  fetch(`${API_BASE}/challenges`)
    .then((res) => {
      if (!res.ok) throw new Error("Napaka pri nalaganju izzivov");
      return res.json();
    })
    .then((challenges) => {
      if (!Array.isArray(challenges) || challenges.length === 0) {
        scene.promptText.setText("Ni definiranih izzivov.");
        return;
      }

      scene.challenges = challenges;

      if (scene.currentChallengeIndex >= scene.challenges.length) {
        scene.currentChallengeIndex = 0;
        localStorage.removeItem("currentChallengeIndex");
      }

      const current = scene.challenges[scene.currentChallengeIndex];
      scene.promptText.setText(current.prompt);
    })
    .catch((err) => {
      console.error(err);
      scene.promptText.setText("Napaka pri nalaganju izzivov.");
    });
}

function getComponentDetails(type, scene) {
  const plant = scene?.selectedPowerplant;
  const plantName = plant?.name || "Elektrarna";
  const plantType = plant?.type || "unknown";
  const plantCooling = plant?.coolingNeeds || "none";
  const plantCapacity = plant?.capacityMW != null ? `${plant.capacityMW} MW` : "unknown";
  const plantConstraints = Array.isArray(plant?.constraints) && plant.constraints.length
    ? plant.constraints.join(", ")
    : "none";

  const details = {
    baterija:
      "Baterija je vir napetosti\n\nNapetost: 3.3 V\n+ pol (rdeč) = pozitivni pol\n− pol (moder) = negativni pol\n\nPriklopi žico na + in − pol za sklenitev vezja",
    upor: "Uporabnost: omejuje tok\nMeri se v ohmih (Ω)",
    svetilka: "Pretvarja električno energijo v svetlobo",
    "stikalo-on": "Dovoljuje pretok toka",
    "stikalo-off": "Prepreči pretok toka \ndesni klik za vklop/izklop",
    zica: "Povezuje komponente\nKlikni za obračanje", // ✅
    ampermeter: "Meri električni tok\nEnota: amperi (A)",
    voltmeter: "Meri električno napetost\nEnota: volti (V)",
    elektrarna:
      `Elektrarna: ${plantName}\nTip: ${plantType}\nHladilne potrebe: ${plantCooling}\nKapaciteta: ${plantCapacity}\nOmejitve: ${plantConstraints}`,
    mesto: "Mesto porablja energijo iz elektrarne\nDodaj porabnik in poveži z žico",
    "vodna-crpalka":
      "Vodna črpalka za hlajenje elektrarne\nLahko dodaš več črpalk",
    transformator: "Transformator prilagodi napetost za prenos po omrežju",
    "uranium-core":
      "Uranovo jedro je vir energije\nNadzira se z močjo jedra",
    "cooling-water":
      "Hladilna voda odvaja toploto\nKoličina je omejena s črpalkami zunaj",
    "water-tube":
      "Vodna cev prenaša hladilno vodo skozi sistem",
    turbine: "Turbina pretvarja energijo pare v mehansko delo",
    generator: "Generator pretvarja mehansko energijo v elektriko",
    "control-rod": "Krmilne palice uravnavajo reakcijo jedra",
  };
  return details[type] || "Komponenta";
}

const DOUBLE_CLICK_DELAY = 250;

function isSwitchType(type) {
  return type === "stikalo-on" || type === "stikalo-off";
}

function toggleSwitchState(scene, component) {
  const currentType = component.getData("type");
  if (!isSwitchType(currentType)) return;

  const nextType = currentType === "stikalo-on" ? "stikalo-off" : "stikalo-on";
  const image = component.getData("componentImage");
  if (image) image.setTexture(nextType);

  const label = component.getData("label");
  if (label) label.setText(nextType);

  const logicComp = component.getData("logicComponent");
  if (logicComp) logicComp.is_on = nextType === "stikalo-on";

  component.setData("type", nextType);
  saveWorkspaceState(scene);
}

function snapToGrid(scene, x, y) {
  const gridSize = scene.gridSize || 40;
  const startX = scene.gridStartX ?? scene.panelWidth ?? 200;
  const startY = scene.gridStartY ?? 0;
  const endX = scene.gridEndX ?? startX;
  const endY = scene.gridEndY ?? startY;

  const snappedX = Math.round((x - startX) / gridSize) * gridSize + startX;
  const snappedY = Math.round((y - startY) / gridSize) * gridSize + startY;

  const clampedX = Math.min(Math.max(snappedX, startX), endX);
  const clampedY = Math.min(Math.max(snappedY, startY), endY);

  return { x: clampedX, y: clampedY };
}

// ✅ alias: če še kje pride "žica", jo pretvori v "zica"
function normalizeType(type) {
  return type === "žica" ? "zica" : type;
}

function getDisplayName(scene, type) {
  const plant = scene?.selectedPowerplant;
  if (type === "elektrarna") {
    return plant?.name ? `Elektrarna: ${plant.name}` : "Elektrarna";
  }
  if (type === "vodna-crpalka") return "Vodna črpalka";
  if (type === "mesto") return "Mesto (porabnik)";
  if (type === "uranium-core") return "Uranovo jedro";
  if (type === "cooling-water") return "Hladilna voda";
  if (type === "water-tube") return "Vodna cev";
  if (type === "control-rod") return "Krmilne palice";
  if (type === "generator") return "Generator";
  return type;
}

function placeComponentAtPosition(scene, x, y, type, color) {
  type = normalizeType(type);
  const displayName = getDisplayName(scene, type);

  const ui = getUiScale(scene.scale);
  const IMAGE_SIZE = 100 * ui;

  const newComponent = scene.add.container(x, y);

  let comp = null;
  let componentImage;
  let id;

  switch (type) {
    case "baterija":
      id = "bat_" + getRandomInt(1000, 9999);
      comp = new Battery(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 3.3);
      comp.type = "battery";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };

      const batteryContainer = scene.add.container(0, 0);
      componentImage = scene.add.image(0, 0, "baterija").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      const plusLabel = scene.add.text(-25, -15, "+", { fontSize: "24px", color: "#ff0000", fontStyle: "bold" }).setOrigin(0.5);
      const minusLabel = scene.add.text(25, -15, "−", { fontSize: "24px", color: "#0000ff", fontStyle: "bold" }).setOrigin(0.5);
      batteryContainer.add([componentImage, plusLabel, minusLabel]);
      newComponent.add(batteryContainer);
      newComponent.setData("rotatableContainer", batteryContainer);
      break;

    case "upor":
      id = "res_" + getRandomInt(1000, 9999);
      comp = new Resistor(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 1.5);
      comp.type = "resistor";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "upor").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "svetilka":
      id = "bulb_" + getRandomInt(1000, 9999);
      comp = new Bulb(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0));
      comp.type = "bulb";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "svetilka").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "stikalo-on":
      id = "switch_" + getRandomInt(1000, 9999);
      comp = new Switch(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), true);
      comp.type = "switch";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "stikalo-on").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "stikalo-off":
      id = "switch_" + getRandomInt(1000, 9999);
      comp = new Switch(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), false);
      comp.type = "switch";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "stikalo-off").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "zica":
      id = "wire_" + getRandomInt(1000, 9999);
      comp = new Wire(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0));
      comp.type = "wire";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "zica").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "ampermeter":
      id = "ammeter_" + getRandomInt(1000, 9999);
      componentImage = scene.add.image(0, 0, "ampermeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "voltmeter":
      id = "voltmeter_" + getRandomInt(1000, 9999);
      componentImage = scene.add.image(0, 0, "voltmeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "elektrarna":
      id = "plant_" + getRandomInt(1000, 9999);
      comp = new Battery(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 3.3);
      comp.type = "battery";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "elektrarna").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "mesto":
      id = "city_" + getRandomInt(1000, 9999);
      comp = new Bulb(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0));
      comp.type = "bulb";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "mesto").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "vodna-crpalka":
      id = "pump_" + getRandomInt(1000, 9999);
      comp = new Resistor(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 10);
      comp.type = "resistor";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "vodna-crpalka").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "transformator":
      id = "transformer_" + getRandomInt(1000, 9999);
      comp = new Resistor(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 5);
      comp.type = "resistor";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "transformator").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "uranium-core":
      id = "uranium_" + getRandomInt(1000, 9999);
      comp = new Battery(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 3.3);
      comp.type = "battery";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "uranium-core").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    /*
    case "cooling-water":
      id = "cooling_" + getRandomInt(1000, 9999);
      componentImage = scene.add.image(0, 0, "voltmeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;
    */

    case "water-tube":
      id = "tube_" + getRandomInt(1000, 9999);
      componentImage = scene.add.image(0, 0, "water-tube").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "turbine":
      id = "turbine_" + getRandomInt(1000, 9999);
      componentImage = scene.add.image(0, 0, "turbine").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    /*
    case "generator":
      id = "generator_" + getRandomInt(1000, 9999);
      componentImage = scene.add.image(0, 0, "ammeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;

    case "control-rod":
      id = "control_" + getRandomInt(1000, 9999);
      componentImage = scene.add.image(0, 0, "resistor").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      newComponent.add(componentImage);
      break;
    */
  }

  const label = scene.add
    .text(0, 40 * ui, displayName, {
      fontSize: `${Math.round(14 * ui)}px`,
      color: "#000",
      fontStyle: "bold",
      resolution: window.devicePixelRatio,
      padding: { x: 4 * ui, y: 3 * ui },
    })
    .setOrigin(0.5);

  newComponent.add(label);

  newComponent.setSize(70, 70);
  newComponent.setInteractive({ draggable: true, useHandCursor: true });

  newComponent.setData("type", type);
  newComponent.setData("color", color);
  newComponent.setData("isInPanel", false);
  newComponent.setData("rotation", 0);
  newComponent.setData("logicComponent", comp);
  newComponent.setData("isDragging", false);
  newComponent.setData("wasDragged", false);
  newComponent.setData("componentImage", componentImage);
  newComponent.setData("label", label);
  newComponent.setData("displayName", displayName);
  if (type === "elektrarna") newComponent.setData("powerplant", scene?.selectedPowerplant || null);
  newComponent.setData("lastClickTime", 0);
  newComponent.setData("singleClickTimer", null);

  if (comp) {
    scene.graph.addComponent(comp);
    if (comp.start) scene.graph.addNode(comp.start);
    if (comp.end) scene.graph.addNode(comp.end);
  }

  updateLogicNodePositions(scene, newComponent);
  scene.placedComponents.push(newComponent);

  saveWorkspaceState(scene);

  addContextMenu(scene, newComponent, componentImage);
  scene.input.setDraggable(newComponent);

  if (scene?.mode === "inside" && typeof scene.computeInsideOutput === "function") {
    scene.computeInsideOutput();
  }

  newComponent.on("dragstart", () => {
    newComponent.setData("isDragging", true);
    scene.isDraggingComponent = true;
  });

  newComponent.on("drag", (_pointer, dragX, dragY) => {
    newComponent.x = dragX;
    newComponent.y = dragY;
    newComponent.setData("wasDragged", true);
  });

  newComponent.on("dragend", () => {
    handleComponentMove(scene, newComponent);
    newComponent.setData("isDragging", false);
    scene.isDraggingComponent = false;
  });

  newComponent.on("pointerup", (pointer) => {
    if (newComponent.getData("wasDragged")) {
      newComponent.setData("wasDragged", false);
      return;
    }
    if (pointer.button === 2) return;
    if (scene.contextMenuJustOpened) return;
    if (pointer.button !== 0) return;

    const now = Date.now();
    const lastClickTime = newComponent.getData("lastClickTime") || 0;
    const componentImage2 = newComponent.getData("componentImage");

    if (now - lastClickTime < DOUBLE_CLICK_DELAY) {
      const timer = newComponent.getData("singleClickTimer");
      if (timer) {
        timer.remove();
        newComponent.setData("singleClickTimer", null);
      }
      rotateComponent(scene, newComponent, componentImage2);
      newComponent.setData("lastClickTime", 0);
    } else {
      newComponent.setData("lastClickTime", now);
    }
  });
}

function handleComponentMove(scene, newComponent) {
  const compLogic = newComponent.getData("logicComponent");
  if (!compLogic) return;

  scene.graph.removeAllConnectionsFromComponent(compLogic);

  const snapped = snapToGrid(scene, newComponent.x, newComponent.y);
  newComponent.x = snapped.x;
  newComponent.y = snapped.y;

  updateLogicNodePositions(scene, newComponent);

  const start = compLogic.start;
  const end = compLogic.end;

  if (start) {
    if (!start.connected) start.connected = new Set();
    scene.graph.addNode(start);
  }
  if (end) {
    if (!end.connected) end.connected = new Set();
    scene.graph.addNode(end);
  }

  scene.graph.addComponent(compLogic);
  saveWorkspaceState(scene);
}

function addContextMenu(scene, component, componentImage) {
  component.on("pointerdown", (pointer) => {
    if (pointer.rightButtonDown()) {
      if (component.getData("type") === "elektrarna" && typeof scene.enterInsidePlantMode === "function") {
        scene.enterInsidePlantMode();
        return;
      }
      if (isSwitchType(component.getData("type"))) {
        if (scene.contextMenu) {
          scene.contextMenu.destroy();
          scene.contextMenu = null;
        }
        toggleSwitchState(scene, component);
        return;
      }
      showContextMenu(scene, component, componentImage, pointer.x, pointer.y);
    }
  });
}

function showContextMenu(scene, component, componentImage, x, y) {
  if (scene.contextMenu) {
    scene.contextMenu.destroy();
    scene.contextMenu = null;
  }

  const menuWidth = 120;
  const menuHeight = 110;
  const menu = scene.add.container(x + 60, y + 50);
  menu.setDepth(2000);

  const bg = scene.add.rectangle(0, 0, menuWidth, menuHeight, 0x1e293b, 0.95);
  bg.setStrokeStyle(2, 0x475569);
  menu.add(bg);

  const options = [
    { text: "↻ Rotate", action: () => rotateComponent(scene, component, componentImage) },
    { text: "🗑️ Delete", action: () => deleteComponent(scene, component) },
    { text: "📋 Duplicate", action: () => duplicateComponent(scene, component) },
  ];

  options.forEach((option, i) => {
    const optionY = -35 + i * 35;
    const optionText = scene.add.text(0, optionY, option.text, { fontSize: "14px", padding: { x: 8, y: 6 } }).setOrigin(0.5);

    const hitArea = scene.add.rectangle(0, optionY, menuWidth, 30, 0x000000, 0.01);
    hitArea
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => optionText.setStyle({ backgroundColor: "#334155" }))
      .on("pointerout", () => optionText.setStyle({ backgroundColor: "" }))
      .on("pointerdown", (pointer) => {
        if (pointer.event) pointer.event.stopPropagation();
        scene.contextMenuJustOpened = true;
        option.action();
        if (scene.contextMenu) {
          scene.contextMenu.destroy();
          scene.contextMenu = null;
        }
        setTimeout(() => {
          scene.contextMenuJustOpened = false;
        }, 300);
      });

    menu.add([hitArea, optionText]);
  });

  scene.contextMenu = menu;
  scene.contextMenuJustOpened = true;

  setTimeout(() => {
    scene.contextMenuJustOpened = false;
  }, 300);

  const closeHandler = () => {
    setTimeout(() => {
      if (scene.contextMenu) {
        scene.contextMenu.destroy();
        scene.contextMenu = null;
      }
    }, 50);
  };

  setTimeout(() => {
    scene.input.once("pointerdown", closeHandler);
  }, 100);
}

function rotateComponent(scene, component, componentImage) {
  const currentRotation = component.getData("rotation") || 0;
  const logicalRotation = (currentRotation + 90) % 360;
  component.setData("rotation", logicalRotation);
  updateLogicNodePositions(scene, component);

  const rotatableContainer = component.getData("rotatableContainer");
  const storedImage = component.getData("componentImage");
  const targetToRotate = rotatableContainer ? rotatableContainer : storedImage || componentImage;

  if (targetToRotate) {
    const targetAngle = targetToRotate.angle + 90;
    scene.tweens.add({
      targets: targetToRotate,
      angle: targetAngle,
      duration: 150,
      ease: "Cubic.easeOut",
    });
  }

  saveWorkspaceState(scene);
}

function deleteComponent(scene, component) {
  const comp = component.getData("logicComponent");
  if (comp) {
    const compIndex = scene.graph.components.indexOf(comp);
    if (compIndex > -1) scene.graph.components.splice(compIndex, 1);
    if (comp.start?.id) scene.graph.nodes.delete(comp.start.id);
    if (comp.end?.id) scene.graph.nodes.delete(comp.end.id);
  }

  const index = scene.placedComponents.indexOf(component);
  if (index > -1) scene.placedComponents.splice(index, 1);

  component.destroy();
  saveWorkspaceState(scene);
  if (scene?.mode === "inside" && typeof scene.computeInsideOutput === "function") {
    scene.computeInsideOutput();
  }
}

function duplicateComponent(scene, component) {
  const type = component.getData("type");
  const color = component.getData("color");
  placeComponentAtPosition(scene, component.x + 80, component.y + 80, type, color);
}

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

function updateLogicNodePositions(scene, component) {
  const comp = component.getData("logicComponent");
  if (!comp) return;

  const localStart = comp.localStart || { x: -40, y: 0 };
  const localEnd = comp.localEnd || { x: 40, y: 0 };

  const theta = Phaser.Math.DegToRad(component.getData("rotation") || 0);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rotate = (p) => ({
    x: Math.round(p.x * cos - p.y * sin),
    y: Math.round(p.x * sin + p.y * cos),
  });

  const rStart = rotate(localStart);
  const rEnd = rotate(localEnd);

  const worldStart = { x: component.x + rStart.x, y: component.y + rStart.y };
  const worldEnd = { x: component.x + rEnd.x, y: component.y + rEnd.y };

  const snappedStart = snapToGrid(scene, worldStart.x, worldStart.y);
  const snappedEnd = snapToGrid(scene, worldEnd.x, worldEnd.y);

  if (comp.start) {
    comp.start.x = snappedStart.x;
    comp.start.y = snappedStart.y;
    if (!comp.start.connected) comp.start.connected = new Set();
    scene.graph.addNode(comp.start);
  }
  if (comp.end) {
    comp.end.x = snappedEnd.x;
    comp.end.y = snappedEnd.y;
    if (!comp.end.connected) comp.end.connected = new Set();
    scene.graph.addNode(comp.end);
  }

  const startDot = component.getData("startDot");
  const endDot = component.getData("endDot");
  if (startDot && comp.start) {
    startDot.x = comp.start.x;
    startDot.y = comp.start.y;
  }
  if (endDot && comp.end) {
    endDot.x = comp.end.x;
    endDot.y = comp.end.y;
  }
}

/**
 * Ustvari komponento v stranski vrstici (template).
 */
export function createComponent(scene, x, y, type, color, ui) {
  type = normalizeType(type);
  const displayName = getDisplayName(scene, type);

  const component = scene.add.container(x, y);
  const IMAGE_SIZE = 100 * ui;
  let comp = null;
  let componentImage;
  let id;

  switch (type) {
    case "baterija":
      id = "bat_" + getRandomInt(1000, 9999);
      comp = new Battery(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 3.3);
      comp.type = "battery";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };

      const batteryContainer = scene.add.container(0, 0);
      componentImage = scene.add.image(0, 0, "baterija").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      const plusLabel = scene.add.text(-25, -15, "+", { fontSize: "24px", color: "#ff0000", fontStyle: "bold" }).setOrigin(0.5);
      const minusLabel = scene.add.text(25, -15, "−", { fontSize: "24px", color: "#0000ff", fontStyle: "bold" }).setOrigin(0.5);
      batteryContainer.add([componentImage, plusLabel, minusLabel]);
      component.add(batteryContainer);
      component.setData("rotatableContainer", batteryContainer);
      component.setData("logicComponent", comp);
      break;

    case "upor":
      id = "res_" + getRandomInt(1000, 9999);
      comp = new Resistor(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 1.5);
      comp.type = "resistor";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "upor").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "svetilka":
      id = "bulb_" + getRandomInt(1000, 9999);
      comp = new Bulb(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0));
      comp.type = "bulb";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "svetilka").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "stikalo-on":
      id = "switch_" + getRandomInt(1000, 9999);
      comp = new Switch(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), true);
      comp.type = "switch";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "stikalo-on").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "stikalo-off":
      id = "switch_" + getRandomInt(1000, 9999);
      comp = new Switch(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), false);
      comp.type = "switch";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "stikalo-off").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "zica":
      id = "wire_" + getRandomInt(1000, 9999);
      comp = new Wire(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0));
      comp.type = "wire";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "zica").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "ampermeter":
      componentImage = scene.add.image(0, 0, "ampermeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", null);
      break;

    case "voltmeter":
      componentImage = scene.add.image(0, 0, "voltmeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", null);
      break;

    case "elektrarna":
      id = "plant_" + getRandomInt(1000, 9999);
      comp = new Battery(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 3.3);
      comp.type = "battery";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "elektrarna").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "mesto":
      id = "city_" + getRandomInt(1000, 9999);
      comp = new Bulb(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0));
      comp.type = "bulb"; // treating as consumer
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "mesto").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "vodna-crpalka":
      id = "pump_" + getRandomInt(1000, 9999);
      comp = new Resistor(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 10);
      comp.type = "resistor";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "vodna-crpalka").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "transformator":
      id = "transformer_" + getRandomInt(1000, 9999);
      // Transformers usually have 2 sides, but here we treat as a simple pass-through component
      comp = new Resistor(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 5);
      comp.type = "resistor";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "transformator").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "uranium-core":
      id = "uranium_" + getRandomInt(1000, 9999);
      comp = new Battery(id, new Node(id + "_start", -40, 0), new Node(id + "_end", 40, 0), 3.3);
      comp.type = "battery";
      comp.localStart = { x: -40, y: 0 };
      comp.localEnd = { x: 40, y: 0 };
      componentImage = scene.add.image(0, 0, "uranium-core").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", comp);
      break;

    case "cooling-water":
      componentImage = scene.add.image(0, 0, "voltmeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", null);
      break;

    case "water-tube":
      componentImage = scene.add.image(0, 0, "water-tube").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", null);
      break;

    case "turbine":
      componentImage = scene.add.image(0, 0, "turbine").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", null);
      break;

    case "generator":
      componentImage = scene.add.image(0, 0, "ammeter").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", null);
      break;

    case "control-rod":
      componentImage = scene.add.image(0, 0, "resistor").setOrigin(0.5).setDisplaySize(IMAGE_SIZE, IMAGE_SIZE);
      component.add(componentImage);
      component.setData("logicComponent", null);
      break;
  }

  component.on("pointerover", () => {
    if (component.getData("isInPanel")) {
      const details = getComponentDetails(type, scene);
      scene.infoText.setText(details);

      const textBounds = scene.infoText.getBounds();
      const padding = 20;
      const boxWidth = Math.max(textBounds.width + padding * 2, 200);
      const boxHeight = Math.max(textBounds.height + padding * 2, 60);

      scene.infoBox.setSize(boxWidth, boxHeight);
      scene.infoBox.setDisplaySize(boxWidth, boxHeight);

      scene.infoWindow.x = x + boxWidth / 2 + 90;
      scene.infoWindow.y = y;
      scene.infoWindow.setVisible(true);
    }
    component.setScale(1.1);
  });

  component.on("pointerout", () => {
    if (component.getData("isInPanel")) scene.infoWindow.setVisible(false);
    component.setScale(1);
  });

  const label = scene.add
    .text(0, 40 * ui, displayName, {
      fontSize: `${14 * ui}px`,
      color: "#000",
      fontStyle: "bold",
      resolution: window.devicePixelRatio,
      padding: { x: 4 * ui, y: 3 * ui },
    })
    .setOrigin(0.5);

  component.add(label);
  component.setData("label", label);

  component.setSize(70, 70);
  component.setInteractive({ draggable: true, useHandCursor: true });

  component.setData("originalX", x);
  component.setData("originalY", y);
  component.setData("type", type);
  component.setData("color", color);
  component.setData("isInPanel", true);
  component.setData("rotation", 0);
  component.setData("isDragging", false);
  component.setData("wasDragged", false);
  component.setData("componentImage", componentImage);
  component.setData("lastClickTime", 0);
  component.setData("singleClickTimer", null);
  component.setData("displayName", displayName);
  if (type === "elektrarna") component.setData("powerplant", scene?.selectedPowerplant || null);

  scene.input.setDraggable(component);

  component.on("pointerdown", (pointer) => {
    if (pointer.rightButtonDown()) return;
    if (component.getData("isInPanel") && !scene.dragMode) {
      if (pointer.event) pointer.event.stopPropagation();

      if (scene.selectedComponentIndicator) scene.selectedComponentIndicator.destroy();

      scene.activeComponentType = { type, color };

      const indicator = scene.add.text(x + 50, y, "✓", {
        fontSize: "32px",
        color: "#22c55e",
        fontStyle: "bold",
      }).setOrigin(0.5);
      indicator.setDepth(999);
      scene.selectedComponentIndicator = indicator;
    }
  });

  // drag handlers isti kot prej (pusti)
  component.on("dragstart", () => component.setData("isDragging", true));
  component.on("drag", (_pointer, dragX, dragY) => {
    component.x = dragX;
    component.y = dragY;
    component.setData("wasDragged", true);
  });

  component.on("dragend", () => {
    const panelBoundary = scene.panelWidth ?? 200;
    const isInPanel = component.x < panelBoundary;

    if (isInPanel && !component.getData("isInPanel")) {
      component.destroy();
    } else if (!isInPanel && component.getData("isInPanel")) {
      if (component.parentContainer) {
        component.parentContainer.remove(component);
        scene.add.existing(component);
      }
      const snapped = snapToGrid(scene, component.x, component.y);
      component.x = snapped.x;
      component.y = snapped.y;

      const compLogic = component.getData("logicComponent");
      if (compLogic) {
        scene.graph.addComponent(compLogic);
        if (compLogic.start) scene.graph.addNode(compLogic.start);
        if (compLogic.end) scene.graph.addNode(compLogic.end);
      }

      updateLogicNodePositions(scene, component);

      component.setData("isRotated", false);
      component.setData("isInPanel", false);
      component.setDepth(2);

      // ponovno ustvarimo template v panelu
      createComponent(scene, component.getData("originalX"), component.getData("originalY"), component.getData("type"), component.getData("color"), ui);

      scene.placedComponents.push(component);

      addContextMenu(scene, component, componentImage);
      saveWorkspaceState(scene);
      if (scene?.mode === "inside" && typeof scene.computeInsideOutput === "function") {
        scene.computeInsideOutput();
      }
    } else if (!component.getData("isInPanel")) {
      const snapped = snapToGrid(scene, component.x, component.y);
      component.x = snapped.x;
      component.y = snapped.y;
      updateLogicNodePositions(scene, component);
    } else {
      component.x = component.getData("originalX");
      component.y = component.getData("originalY");
      updateLogicNodePositions(scene, component);
    }

    component.setData("isDragging", false);
  });

  component.on("pointerup", (pointer) => {
    if (component.getData("wasDragged")) {
      component.setData("wasDragged", false);
      return;
    }
    if (pointer.button === 2) return;
    if (scene.contextMenuJustOpened) return;
    if (pointer.button !== 0) return;
    if (component.getData("isInPanel")) return;

    const now = Date.now();
    const lastClickTime = component.getData("lastClickTime") || 0;

    if (now - lastClickTime < DOUBLE_CLICK_DELAY) {
      const timer = component.getData("singleClickTimer");
      if (timer) {
        timer.remove();
        component.setData("singleClickTimer", null);
      }
      rotateComponent(scene, component, componentImage);
      component.setData("lastClickTime", 0);
    } else {
      component.setData("lastClickTime", now);
    }
  });

  if (scene.componentList && component.getData("isInPanel") && !component.parentContainer) {
    scene.componentList.add(component);
  }

  return component;
}

/**
 * Simulira krog in nastavi scene.sim + checkText.
 */
export function simulateCircuit(scene) {
  scene.connected = scene.graph.simulate();
  if (scene.connected === 1) {
    scene.checkText.setStyle({ color: "#00aa00" });
    scene.checkText.setText("Električni tok je sklenjen");
    scene.sim = true;
    return;
  }
  scene.checkText.setStyle({ color: "#cc0000" });
  if (scene.connected === -1) scene.checkText.setText("Manjka ti baterija");
  else if (scene.connected === -2) scene.checkText.setText("Stikalo je izklopljeno");
  else scene.checkText.setText("Električni tok ni sklenjen");
  scene.sim = false;
}

/**
 * Preveri krog glede na trenutni izziv.
 */
export function checkCircuit(scene) {
  if (!scene.challenges || scene.challenges.length === 0) {
    scene.checkText.setStyle({ color: "#cc0000" });
    scene.checkText.setText("Izzivi se še nalagajo...");
    return;
  }

  const currentChallenge = scene.challenges[scene.currentChallengeIndex];
  const placedTypes = scene.placedComponents.map((comp) => normalizeType(comp.getData("type")));

  scene.checkText.setStyle({ color: "#cc0000" });

  if (!currentChallenge.requiredComponents.every((req) => placedTypes.includes(normalizeType(req)))) {
    scene.checkText.setText("Manjkajo komponente za krog.");
    return;
  }

  if (scene.sim === undefined) {
    scene.checkText.setText("Zaženi simulacijo");
    return;
  }

  if (scene.sim === false) {
    scene.checkText.setText("Električni krog ni sklenjen. Preveri kako si ga sestavil");
    return;
  }

  scene.checkText.setStyle({ color: "#00aa00" });
  scene.checkText.setText("Čestitke! Krog je pravilen.");

  const basePoints = 10;
  const multiplier = currentChallenge.pointsMultiplier || 1;
  const totalPoints = basePoints * multiplier;

  scene.sessionPoints = (scene.sessionPoints || 0) + totalPoints;

  if (currentChallenge.theory && currentChallenge.theory.length > 0) {
    showTheory(scene, currentChallenge.theory);
  } else {
    scene.time.delayedCall(2000, () => nextChallenge(scene));
  }
}

export function nextChallenge(scene) {
  scene.currentChallengeIndex++;
  localStorage.setItem("currentChallengeIndex", scene.currentChallengeIndex.toString());
  scene.checkText.setText("");

  if (!scene.challenges || scene.challenges.length === 0) {
    scene.promptText.setText("Izzivi se še nalagajo...");
    return;
  }

  if (scene.currentChallengeIndex < scene.challenges.length) {
    const current = scene.challenges[scene.currentChallengeIndex];
    scene.promptText.setText(current.prompt);
  } else {
    scene.promptText.setText("Vse naloge so uspešno opravljene! Čestitke!");
    localStorage.removeItem("currentChallengeIndex");
  }
}

/**
 * ✅ Pošlje točke v bazo (rups2) in bere user iz kartografi:user
 */
export async function addPoints(_scene, sessionScore) {
  const raw = localStorage.getItem("kartografi:user");
  const user = raw ? JSON.parse(raw) : null;
  const userId = user?._id;

  if (!userId) {
    console.warn("Ni kartografi:user ali _id – uporabnik ni prijavljen?");
    return;
  }

  if (!sessionScore || sessionScore <= 0) return;

  try {
    const res = await fetch(`${API_BASE}/users/${userId}/scores`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionScore }),
      credentials: "include",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Napaka pri posodobitvi točk:", err.message || res.status);
      return;
    }

    const updatedUser = await res.json();

    console.log(
      "Session zaključen:",
      sessionScore,
      "| elektro_points:",
      updatedUser.elektro_points,
      "| elektro_highScore:",
      updatedUser.elektro_highScore,
      "| elektro_totalPoints:",
      updatedUser.elektro_totalPoints
    );
  } catch (e) {
    console.error("Napaka pri povezavi s strežnikom (točke):", e);
  }
}

export function showTheory(scene, theoryText) {
  const { width, height } = scene.cameras.main;

  const textToShow = Array.isArray(theoryText) ? theoryText.join("\n\n") : theoryText;

  scene.theoryBack = scene.add
    .rectangle(width / 2, height / 2, width - 100, 150, 0x000000, 0.8)
    .setOrigin(0.5)
    .setDepth(10);

  scene.theoryText = scene.add
    .text(width / 2, height / 2, textToShow, {
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: width - 150 },
    })
    .setOrigin(0.5)
    .setDepth(11);

  scene.continueButton = scene.add
    .text(width / 2, height / 2 + 70, "Nadaljuj", {
      fontSize: "18px",
      color: "#0066ff",
      backgroundColor: "#ffffff",
      padding: { x: 20, y: 10 },
    })
    .setOrigin(0.5)
    .setDepth(11)
    .setInteractive({ useHandCursor: true })
    .on("pointerover", () => scene.continueButton.setStyle({ color: "#0044cc" }))
    .on("pointerout", () => scene.continueButton.setStyle({ color: "#0066ff" }))
    .on("pointerdown", () => {
      hideTheory(scene);
      scene.placedComponents.forEach((comp) => comp.destroy());
      scene.placedComponents = [];
      nextChallenge(scene);
    });
}

export function hideTheory(scene) {
  if (scene.theoryBack) {
    scene.theoryBack.destroy();
    scene.theoryBack = null;
  }
  if (scene.theoryText) {
    scene.theoryText.destroy();
    scene.theoryText = null;
  }
  if (scene.continueButton) {
    scene.continueButton.destroy();
    scene.continueButton = null;
  }
}

export async function finalizeSession(scene) {
  const sessionScore = scene.sessionPoints || 0;
  await addPoints(scene, sessionScore);
  scene.sessionPoints = 0;
}

/**
 * Save the current workspace state to localStorage
 */
export function saveWorkspaceState(scene) {
  const storageKey = scene?.workspaceStorageKey || DEFAULT_WORKSPACE_KEY;
  const componentsData = scene.placedComponents.map((comp) => {
    const logicComp = comp.getData("logicComponent");
    return {
      x: comp.x,
      y: comp.y,
      type: comp.getData("type"),
      color: comp.getData("color"),
      rotation: comp.getData("rotation") || 0,
      isOn: logicComp && logicComp.is_on !== undefined ? logicComp.is_on : null,
    };
  });

  localStorage.setItem(storageKey, JSON.stringify(componentsData));
}

/**
 * Load the workspace state from localStorage
 */
export function loadWorkspaceState(scene) {
  const storageKey = scene?.workspaceStorageKey || DEFAULT_WORKSPACE_KEY;
  const savedData = localStorage.getItem(storageKey);
  if (!savedData) return;

  try {
    const componentsData = JSON.parse(savedData);

    componentsData.forEach((data) => {
      placeComponentAtPosition(scene, data.x, data.y, data.type, data.color);

      const placedComp = scene.placedComponents[scene.placedComponents.length - 1];

      if (data.rotation && data.rotation !== 0) {
        const componentImage = placedComp.getData("componentImage");
        const rotations = data.rotation / 90;
        for (let i = 0; i < rotations; i++) rotateComponent(scene, placedComp, componentImage);
      }

      if (data.isOn !== null && isSwitchType(data.type)) {
        const currentType = placedComp.getData("type");
        const shouldBeOn = data.isOn;
        const isOn = currentType === "stikalo-on";
        if (shouldBeOn !== isOn) toggleSwitchState(scene, placedComp);
      }
    });
  } catch (error) {
    console.error("Error loading workspace state:", error);
  }
}

/**
 * Clear all components from the workspace
 */
export function clearWorkspace(scene, { preserveStorage = false } = {}) {
  scene.placedComponents.forEach((comp) => comp.destroy());
  scene.placedComponents = [];

  scene.graph = new CircuitGraph();

  const storageKey = scene?.workspaceStorageKey || DEFAULT_WORKSPACE_KEY;
  if (!preserveStorage) localStorage.removeItem(storageKey);

  if (scene.checkText) scene.checkText.setText("");
}

function getSelectedPowerplant(scene) {
  if (scene?.selectedPowerplant) return scene.selectedPowerplant;
  try {
    const raw = localStorage.getItem("geoElePowerplant");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function evaluateGridRequirements(powerplant, placedTypes) {
  const missing = [];
  const hasPlant = placedTypes.includes("elektrarna");
  const hasCity = placedTypes.includes("mesto");
  const hasWire = placedTypes.includes("zica");
  const pumpCount = placedTypes.filter((t) => t === "vodna-crpalka").length;
  const hasTransformer = placedTypes.includes("transformator");

  if (!hasPlant) missing.push("elektrarna");
  if (!hasCity) missing.push("mesto");
  if (!hasWire) missing.push("zica");

  const coolingNeeds = powerplant?.coolingNeeds || "none";
  const requiresCooling = ["river", "sea", "high"].includes(coolingNeeds);
  if (requiresCooling && pumpCount < 1) missing.push("vodna-crpalka");

  const capacityMW = Number(powerplant?.capacityMW || 0);
  const constraints = Array.isArray(powerplant?.constraints) ? powerplant.constraints : [];
  const needsTransformer =
    capacityMW >= 800 ||
    constraints.includes("grid_stability_priority") ||
    constraints.includes("long_distance_grid");
  if (needsTransformer && !hasTransformer) missing.push("transformator");

  return {
    missing,
    hasPlant,
    hasCity,
    hasWire,
    pumpCount,
    hasTransformer,
    requiresCooling,
    needsTransformer,
  };
}

function getConnectedCityInfo(scene, powerplant) {
  const gridSize = scene.gridSize || 40;
  const tolerance = Math.max(6, gridSize * 0.15);
  const nodes = scene.placedComponents.map((comp, index) => ({
    index,
    type: normalizeType(comp.getData("type")),
    x: comp.x,
    y: comp.y,
  }));

  const plantIndices = nodes.filter((n) => n.type === "elektrarna").map((n) => n.index);
  if (!plantIndices.length) {
    return { connectedCities: 0, requiredCities: 0, capacityMatch: false, connectedTransformers: 0 };
  }

  const adj = new Map();
  nodes.forEach((node) => adj.set(node.index, []));

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (dist <= gridSize + tolerance) {
        adj.get(a.index).push(b.index);
        adj.get(b.index).push(a.index);
      }
    }
  }

  const conductive = new Set(["elektrarna", "zica", "transformator"]);
  const connectedCities = new Set();
  const connectedTransformers = new Set();
  const queue = [...plantIndices];
  const visited = new Set(queue);

  while (queue.length) {
    const idx = queue.shift();
    const node = nodes.find((n) => n.index === idx);
    if (!node) continue;

    for (const neighborIdx of adj.get(idx) || []) {
      if (visited.has(neighborIdx)) continue;
      const neighbor = nodes.find((n) => n.index === neighborIdx);
      if (!neighbor) continue;

      if (neighbor.type === "mesto") {
        connectedCities.add(neighborIdx);
      }
      
      if (neighbor.type === "transformator") {
        connectedTransformers.add(neighborIdx);
      }

      if (conductive.has(neighbor.type)) {
        visited.add(neighborIdx);
        queue.push(neighborIdx);
      }
    }
  }

  const capacityMW = Number(powerplant?.capacityMW || 0);
  const requiredCities = capacityMW > 0 ? Math.max(1, Math.round(capacityMW / CITY_DEMAND_MW)) : 0;
  const capacityMatch = connectedCities.size * CITY_DEMAND_MW === capacityMW;

  return {
    connectedCities: connectedCities.size,
    requiredCities,
    capacityMatch,
    connectedTransformers: connectedTransformers.size,
  };
}
export function evaluateOutsideGrid(scene) {
  const powerplant = getSelectedPowerplant(scene);
  const placedTypes = scene.placedComponents.map((comp) => normalizeType(comp.getData("type")));

  if (!powerplant) {
    return {
      correct: false,
      message: "Ni izbrane elektrarne iz kviza.",
      powerplant: null,
      requirements: null,
      score: 0
    };
  }

  const requirements = evaluateGridRequirements(powerplant, placedTypes);
  const cityInfo = getConnectedCityInfo(scene, powerplant);
  if (cityInfo.requiredCities && !cityInfo.capacityMatch) {
    requirements.missing.push(`mesto(${cityInfo.requiredCities}x)`);
  }

  let insideResult = null;
  try {
    insideResult = JSON.parse(localStorage.getItem(INSIDE_GRID_RESULT_KEY) || "null");
  } catch {
    insideResult = null;
  }

  const capacityMW = Number(powerplant?.capacityMW || 0);
  const insideOutput = Number(insideResult?.outputMW || 0);
  const insideStable = Boolean(insideResult?.stable);
  const insideMatch = insideStable && insideOutput === capacityMW;

  // --- SCORE CALCULATION ---
  let score = 0;

  // 1. Power Generation (Max 70%)
  // Logic: 90% - 110% of requirememt AND reactor must be stable
  if (insideStable && insideOutput >= 0.9 * capacityMW && insideOutput <= 1.1 * capacityMW) {
    score += 70;
  }

  // 2. City Consumption (Max 30%)
  // Logic: Connected Cities demand (0.9-1.1 of produced)
  // Each city needs ~500MW (CITY_DEMAND_MW)
  const totalDemand = cityInfo.connectedCities * CITY_DEMAND_MW;
  
  // They get points if demand matches supply (which matches capacity)
  if (totalDemand >= 0.9 * capacityMW && totalDemand <= 1.1 * capacityMW) {
    // Initial 30 points
    let consumptionPoints = 30;

    // Deduct if transformers are missing.
    // Logic: Each city needs a transformer.
    // If connectedTransformers < connectedCities, deduct proportional points.
    if (cityInfo.connectedTransformers < cityInfo.connectedCities) {
      if (cityInfo.connectedCities > 0) {
        const ratio = cityInfo.connectedTransformers / cityInfo.connectedCities;
        consumptionPoints = consumptionPoints * ratio;
      } else {
        consumptionPoints = 0;
      }
    }
    score += consumptionPoints;
  }

  const correct = requirements.missing.length === 0;

  const message = correct
    ? `✅ Omrežje je pravilno sestavljeno. Točke: ${Math.round(score)}%`
    : `❌ Manjkajo komponente: ${requirements.missing.join(", ")}`;

  const payload = {
    powerplant,
    correct,
    requirements,
    cityInfo,
    insideResult: insideResult
      ? { outputMW: insideOutput, stable: insideStable, uraniumAmount: insideResult.uraniumAmount, waterAmount: insideResult.waterAmount }
      : null,
    insideMatch,
    checkedAt: Date.now(),
    score: Math.round(score)
  };

  localStorage.setItem(OUTSIDE_GRID_RESULT_KEY, JSON.stringify(payload));

  return { ...payload, message };
}

/**
 * Toggle between user workspace and example mode.
 */
export function toggleExampleMode(scene) {
  if (scene.isExampleMode) {
    // 1. Switch back to workspace
    scene.isExampleMode = false;
    scene.workspaceStorageKey = "workspaceComponentsOutside";

    // Clear example components
    clearWorkspace(scene); // Clears current (example) components

    // Restore user session components
    if (scene.savedUserSession) {
        // Restore Mocked Data
        if (scene.savedUserSession.savedPowerplant) {
            scene.selectedPowerplant = scene.savedUserSession.savedPowerplant;
        } else {
             scene.selectedPowerplant = null;
        }
        if (scene.savedUserSession.savedInsideResult) {
            localStorage.setItem(INSIDE_GRID_RESULT_KEY, scene.savedUserSession.savedInsideResult);
        } else {
            localStorage.removeItem(INSIDE_GRID_RESULT_KEY);
        }

        scene.savedUserSession.components.forEach(data => {
            placeComponentAtPosition(scene, data.x, data.y, data.type, data.color);
            // Restore rotation and state if needed, similar to loadWorkspaceState
             const placedComp = scene.placedComponents[scene.placedComponents.length - 1];
            if (data.rotation && data.rotation !== 0) {
                 const componentImage = placedComp.getData('componentImage');
                 const rotations = data.rotation / 90;
                 for (let i = 0; i < rotations; i++) {
                   rotateComponent(scene, placedComp, componentImage);
                 }
            }
             if (data.isOn !== null && isSwitchType(data.type)) {
                const currentType = placedComp.getData('type');
                const shouldBeOn = data.isOn;
                const isOn = currentType === 'stikalo-on';
                if (shouldBeOn !== isOn) toggleSwitchState(scene, placedComp);
             }
        });
        scene.savedUserSession = null;
    }
     if (scene.toggleExampleBtn) {
        scene.toggleExampleBtn.text.setText("Prikaži primer");
    }

  } else {
    // 2. Switch to Example Mode
    scene.isExampleMode = true;
    scene.workspaceStorageKey = "exampleComponentsOutside";

    // Save current user components
    const currentComponents = scene.placedComponents.map(comp => {
        const logicComp = comp.getData('logicComponent');
        return {
          x: comp.x,
          y: comp.y,
          type: comp.getData('type'),
          color: comp.getData('color'),
          rotation: comp.getData('rotation') || 0,
          isOn: logicComp && logicComp.is_on !== undefined ? logicComp.is_on : null
        };
    });

    scene.savedUserSession = {
        components: currentComponents,
        savedPowerplant: scene.selectedPowerplant ? { ...scene.selectedPowerplant } : null,
        savedInsideResult: localStorage.getItem(INSIDE_GRID_RESULT_KEY)
    };


    // Clear workspace visually
    clearWorkspace(scene);
    
    // MOCK: Set valid reactor state for 100% points (70% part)
    // 1000MW Powerplant
    scene.selectedPowerplant = {
        name: "Mock 1000MW Plant",
        type: "PWR",
        coolingNeeds: "river",
        capacityMW: 1000,
        constraints: [],
    };
    // Simulate Inside Output to match capacity
    localStorage.setItem(INSIDE_GRID_RESULT_KEY, JSON.stringify({
        outputMW: 1000, 
        stable: true,
        uraniumAmount: 3, 
        waterAmount: 3
    }));

    // Example: Powerplant (1000MW) connected to 2 Cities via 2 Transformers
    // Layout: 
    //        /-- Wire -- Trans -- Wire -- City
    // Plant -
    //        \-- Wire -- Trans -- Wire -- City

    const ui = getUiScale(scene.scale);
    const startX = 250 * ui;
    const centerY = 300 * ui;
    const stepX = 80 * ui;
    const stepY = 80 * ui;
    
    // 1. Powerplant
    placeComponentAtPosition(scene, startX, centerY, 'elektrarna', 0xffb74d);

    // 2. Trunk Wire
    placeComponentAtPosition(scene, startX + stepX, centerY, 'zica', 0x0066cc);

    // 3. Junction Wire
    placeComponentAtPosition(scene, startX + stepX*2, centerY, 'zica', 0x0066cc);

    // --- Branch TOP ---
    // Wire UP
    placeComponentAtPosition(scene, startX + stepX*2, centerY - stepY, 'zica', 0x0066cc);
    // Transformer
    placeComponentAtPosition(scene, startX + stepX*3, centerY - stepY, 'transformator', 0xffcc80);
    // Wire
    placeComponentAtPosition(scene, startX + stepX*4, centerY - stepY, 'zica', 0x0066cc);
    // City 1
    placeComponentAtPosition(scene, startX + stepX*5, centerY - stepY, 'mesto', 0xff5252);

    // --- Branch BOTTOM ---
    // Wire DOWN
    placeComponentAtPosition(scene, startX + stepX*2, centerY + stepY, 'zica', 0x0066cc);
    // Transformer
    placeComponentAtPosition(scene, startX + stepX*3, centerY + stepY, 'transformator', 0xffcc80);
    // Wire
    placeComponentAtPosition(scene, startX + stepX*4, centerY + stepY, 'zica', 0x0066cc);
    // City 2
    placeComponentAtPosition(scene, startX + stepX*5, centerY + stepY, 'mesto', 0xff5252);
    
    // Cooling Pump (Required for river cooling)
    placeComponentAtPosition(scene, startX, centerY + stepY * 2.5, 'vodna-crpalka', 0x4fc3f7);


    if (scene.toggleExampleBtn) {
        scene.toggleExampleBtn.text.setText("Nazaj na delo");
    }
  }
}
