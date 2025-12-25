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

  scene.input.on("pointerdown", (pointer) => {
    if (pointer.button !== 0) return;
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

function getComponentDetails(type) {
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

function placeComponentAtPosition(scene, x, y, type, color) {
  type = normalizeType(type);

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
  }

  const label = scene.add
    .text(0, 40 * ui, type, {
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
  }

  component.on("pointerover", () => {
    if (component.getData("isInPanel")) {
      const details = getComponentDetails(type);
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
    .text(0, 40 * ui, type, {
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

      // ponovno ustvarimo template v panelu
      createComponent(scene, component.getData("originalX"), component.getData("originalY"), component.getData("type"), component.getData("color"), ui);

      scene.placedComponents.push(component);

      addContextMenu(scene, component, componentImage);
      saveWorkspaceState(scene);
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

  localStorage.setItem("workspaceComponents", JSON.stringify(componentsData));
}

/**
 * Load the workspace state from localStorage
 */
export function loadWorkspaceState(scene) {
  const savedData = localStorage.getItem("workspaceComponents");
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
export function clearWorkspace(scene) {
  scene.placedComponents.forEach((comp) => comp.destroy());
  scene.placedComponents = [];

  scene.graph = new CircuitGraph();

  localStorage.removeItem("workspaceComponents");

  if (scene.checkText) scene.checkText.setText("");
}