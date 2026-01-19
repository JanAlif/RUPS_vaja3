// src/rups2/scenes/WorkspaceScene.js
import Phaser from "phaser";
import { attachResize, getUiScale } from "../utils/uiScale";

// logika
import {
  initWorkspaceLogic,
  loadChallengesFromApi,
  createComponent,
  checkCircuit,
  simulateCircuit,
  resetWorkspaceProgress,
  finalizeSession,
  loadWorkspaceState,
  saveWorkspaceState,
  clearWorkspace,
  evaluateOutsideGrid,
  CITY_DEMAND_MW,
  toggleExampleMode,
} from "../logic/workspaceSceneLogic";
import { loadPowerplantsForRegion } from "../../lib/powerplants";

export default class WorkspaceScene extends Phaser.Scene {
  constructor() {
    super("WorkspaceScene");
  }

  init() {
    this.currentChallengeIndex = 0;
    this.dragMode = true; // true = drag-and-drop, false = click-to-place
    this.activeComponentType = null; // stores the component type in click mode
    this.mode = "outside";
    this.workspaceStorageKey = "workspaceComponentsOutside";
    this.isExampleMode = false;
    this.insideState = {
      uraniumAmount: 3,
      waterAmount: 0,
      waterAvailable: 0,
      outputMW: 0,
      stable: true,
      message: "",
    };
  }

  preload() {
    // logika (graph, placedComponents, ...)
    initWorkspaceLogic(this);

    // ✅ Vite-friendly asset paths (ni treba premikat v /public)
    const asset = (rel) => new URL(rel, import.meta.url).href;

    this.load.image("baterija", asset("../components/battery.png"));
    this.load.image("upor", asset("../components/resistor.png"));
    this.load.image("svetilka", asset("../components/lamp.png"));
    this.load.image("stikalo-on", asset("../components/switch-on.png"));
    this.load.image("stikalo-off", asset("../components/switch-off.png"));

    // ✅ pomembno: key je "zica" (brez šumnikov) – mora biti enako povsod
    this.load.image("zica", asset("../components/wire.png"));
    
    // Updated assets as requested
    this.load.image("elektrarna", asset("../components/Powerplant.png"));
    this.load.image("mesto", asset("../components/City.png"));
    this.load.image("vodna-crpalka", asset("../components/Water_pump.png"));
    this.load.image("transformator", asset("../components/transformer.png"));
    this.load.image("uranium-core", asset("../components/Uranium.png"));
    this.load.image("water-tube", asset("../components/Pipe.png"));
    this.load.image("turbine", asset("../components/Turbine.png"));
    
    // Keep placeholder keys if needed to prevent crashes, but menus will use new types
    this.load.image("ampermeter", asset("../components/ammeter.png"));
    this.load.image("voltmeter", asset("../components/voltmeter.png"));
  }

  create() {
    const { width, height } = this.cameras.main;
    const ui = getUiScale(this.scale);
    localStorage.setItem("lastScene", "WorkspaceScene");

    // ozadje + površje mize
    const background = this.add.graphics();
    background.fillGradientStyle(0xf5f7ff, 0xe8f0ff, 0xf8fbff, 0xeff3ff, 1);
    background.fillRect(0, 0, width, height);
    background.setDepth(-5);

    const surfaceMargin = Math.max(180 * ui, width * 0.14);
    const verticalMargin = Math.max(20 * ui, height * 0.03);

    const deskPanel = this.add.graphics();
    deskPanel.fillStyle(0xffffff, 0.94);
    deskPanel.fillRoundedRect(
      surfaceMargin,
      verticalMargin,
      width - surfaceMargin - 30,
      height - verticalMargin * 2,
      18 * ui
    );
    deskPanel.lineStyle(2, 0xdfe6f3, 1);
    deskPanel.strokeRoundedRect(
      surfaceMargin,
      verticalMargin,
      width - surfaceMargin - 30,
      height - verticalMargin * 2,
      18 * ui
    );
    deskPanel.setDepth(-1);

    // mreža na delovni površini
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x8ba0c6, 0.22);
    const gridSize = 40 * ui;
    const gridStartX = surfaceMargin + 10;
    const gridStartY = verticalMargin + 20;
    const gridEndX = width - 30;
    const gridEndY = height - 40;

    // share grid metrics with logic for snapping
    this.gridSize = gridSize;
    this.gridStartX = gridStartX;
    this.gridStartY = gridStartY;
    this.gridEndX = gridEndX;
    this.gridEndY = gridEndY;

    for (let x = gridStartX; x < gridEndX; x += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, height);
      gridGraphics.strokePath();
    }
    for (let y = gridStartY; y < gridEndY; y += gridSize) {
      gridGraphics.beginPath();
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(width, y);
      gridGraphics.strokePath();
    }

    // info okno
    this.infoWindow = this.add.container(0, 0);
    this.infoWindow.setDepth(1000);
    this.infoWindow.setVisible(false);

    this.infoBox = this.add.rectangle(0, 0, 320, 180, 0x0f172a, 0.92);
    this.infoBox.setStrokeStyle(2, 0x4b5563, 0.7);
    const infoText = this.add
      .text(0, 0, "", {
        fontSize: `${Math.round(14 * ui)}px`,
        color: "#ffffff",
        align: "left",
        wordWrap: { width: 280 },
      })
      .setOrigin(0.5);

    this.infoWindow.add([this.infoBox, infoText]);
    this.infoText = infoText;

    // text za izzive + feedback
    this.promptText = this.add
      .text(Math.floor(width / 1.8), Math.floor(height - 30), "Nalagam izzive...", {
        fontSize: `${Math.round(20 * ui)}px`,
        color: "#0f172a",
        fontStyle: "bold",
        backgroundColor: "#ffffffee",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5);

    this.checkText = this.add
      .text(width / 2, height - 70, "", {
        fontSize: `${Math.round(18 * ui)}px`,
        color: "#cc0000",
        fontStyle: "bold",
        resolution: window.devicePixelRatio,
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5);

    // gumbi
    const buttonWidth = 180 * ui;
    const buttonHeight = 45 * ui;
    const cornerRadius = 10 * ui;

    const makeButton = (x, y, label, onClick) => {
      const bg = this.add.graphics();
      bg.fillGradientStyle(0x2563eb, 0x1d4ed8, 0x1e40af, 0x1d4ed8, 1);
      bg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);

      const text = this.add
        .text(x, y, label, {
          fontFamily: "Arial",
          fontSize: `${Math.round(20 * ui)}px`,
          color: "#ffffffff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          bg.clear();
          bg.fillGradientStyle(0x1e40af, 0x1d4ed8, 0x1d4ed8, 0x1e3a8a, 1);
          bg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);
        })
        .on("pointerout", () => {
          bg.clear();
          bg.fillGradientStyle(0x2563eb, 0x1d4ed8, 0x1e40af, 0x1d4ed8, 1);
          bg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);
        })
        .on("pointerdown", (pointer) => {
          if (pointer.event) pointer.event.stopPropagation();
          onClick();
        });

      return { bg, text };
    };

    makeButton(width - 140, 60 + 15 * ui, "Lestvica", () =>
      this.scene.start("ScoreboardScene", {
        cameFromMenu: false,
        previousScene: "WorkspaceScene",
      })
    );
    makeButton(width - 140, 120 + 15 * ui, "Preveri krog", () => checkCircuit(this));
    makeButton(width - 140, 180 + 15 * ui, "Simulacija", () => simulateCircuit(this));
    makeButton(width - 140, 240 + 15 * ui, "Počisti mizo", () => clearWorkspace(this));
    makeButton(width - 140, 300 + 15 * ui, "Oddaj omrežje", () => {
      const result = evaluateOutsideGrid(this);
      if (this.checkText) {
        this.checkText.setStyle({ color: result.correct ? "#00aa00" : "#cc0000" });
        this.checkText.setText(result.message || "Oddaja ni uspela.");
      }
    });

    this.toggleExampleBtn = makeButton(width - 140, 360 + 15 * ui, "Prikaži primer", () => toggleExampleMode(this));

    // stranska vrstica
    const panelWidth = Math.max(160 * ui, width * 0.12);
    this.panelWidth = panelWidth;

    const sidePanel = this.add.graphics();
    sidePanel.fillStyle(0xc0c0c0, 0.96);
    sidePanel.fillRoundedRect(0, 0, panelWidth, height, 0);
    sidePanel.lineStyle(2, 0x1f2937, 1);
    sidePanel.strokeRoundedRect(0, 0, panelWidth, height, 0);

    this.add
      .text(Math.floor(panelWidth / 2), 100 * ui, "Komponente", {
        fontSize: `${Math.round(25 * ui)}px`,
        color: "#2d2d2eff",
        fontStyle: "bold",
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5);

    // komponente v stranski vrstici (kličeš logični helper)
    const listTop = 160 * ui;
    const listBottom = height - 20 * ui;
    const listViewHeight = listBottom - listTop;
    this.componentListTop = listTop;
    this.componentListHeight = listViewHeight;

    const listMaskGraphics = this.add.graphics();
    listMaskGraphics.fillStyle(0xffffff);
    listMaskGraphics.fillRect(0, listTop, panelWidth, listViewHeight);
    listMaskGraphics.setVisible(false);
    const listMask = listMaskGraphics.createGeometryMask();

    const componentList = this.add.container(0, 0);
    componentList.setMask(listMask);
    this.componentList = componentList;

    const storedPowerplant = (() => {
      try {
        return JSON.parse(localStorage.getItem("geoElePowerplant") || "null");
      } catch {
        return null;
      }
    })();

    this.buildComponentMenu([
      { type: "elektrarna", color: 0xffb74d },
      { type: "mesto", color: 0xff5252 },
      { type: "vodna-crpalka", color: 0x4fc3f7 },
      { type: "transformator", color: 0xffcc80 },
      { type: "zica", color: 0x0066cc },
    ]);

    this.input.on("wheel", (pointer, _gameObjects, _dx, dy) => {
      if (pointer.x > panelWidth) return;
      if (!this.componentList) return;
      const nextY = Phaser.Math.Clamp(this.componentList.y - dy * 0.4, this.componentScroll.minY, this.componentScroll.maxY);
      this.componentList.y = nextY;
    });

    // Toggle button for drag mode
    const toggleButtonY = 135 * ui;
    const toggleButton = this.add
      .text(panelWidth / 2, toggleButtonY, "🖱️ Drag Mode", {
        fontSize: `${Math.round(16 * ui)}px`,
        color: "#ffffff",
        backgroundColor: "#2563eb",
        padding: { x: 12, y: 8 },
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (pointer) => {
        if (pointer.event) pointer.event.stopPropagation();

        this.dragMode = !this.dragMode;
        if (this.dragMode) {
          toggleButton.setText("🖱️ Drag Mode");
          toggleButton.setStyle({ backgroundColor: "#2563eb" });
          this.activeComponentType = null;
          if (this.selectedComponentIndicator) {
            this.selectedComponentIndicator.destroy();
            this.selectedComponentIndicator = null;
          }
        } else {
          toggleButton.setText("👆 Click Mode");
          toggleButton.setStyle({ backgroundColor: "#16a34a" });
        }
      });

    // back button
    const backButton = this.add
      .text(Math.floor(panelWidth / 2), 40 * ui, "↩ Meni", {
        fontFamily: "Arial",
        fontSize: `${Math.round(20 * ui)}px`,
        color: "#2563eb",
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => backButton.setStyle({ color: "#cde3ff" }))
      .on("pointerout", () => backButton.setStyle({ color: "#8ab4ff" }))
      .on("pointerdown", async (pointer) => {
        if (pointer.event) pointer.event.stopPropagation();

        await finalizeSession(this);
        resetWorkspaceProgress();
        localStorage.setItem("lastScene", "LabScene");
        this.scene.start("LabScene", { cameFromMenu: false });
      });

    this.add
      .text(width / 2 + 50, 30, "Povleci komponente na mizo in zgradi svoj električni krog!", {
        fontSize: `${Math.round(20 * ui)}px`,
        color: "#0f172a",
        fontStyle: "bold",
        resolution: window.devicePixelRatio,
        align: "center",
        backgroundColor: "#ffffffdd",
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5);

    this.addExampleTabs();

    // powerplant info panel (uses placeholder image key)
    const powerPanelWidth = 260 * ui;
    const powerPanelHeight = 140 * ui;
    const powerPanelX = width - powerPanelWidth / 2 - 20 * ui;
    const powerPanelY = 340 * ui;

    this.powerplantPanel = this.add.container(powerPanelX, powerPanelY);
    this.powerplantPanel.setDepth(3);

    const panelBg = this.add.rectangle(0, 0, powerPanelWidth, powerPanelHeight, 0xffffff, 0.95);
    panelBg.setStrokeStyle(2, 0xd1d5db, 1);

    this.powerplantIcon = this.add.image(-powerPanelWidth / 2 + 30 * ui, -powerPanelHeight / 2 + 30 * ui, "baterija");
    this.powerplantIcon.setDisplaySize(45 * ui, 45 * ui);

    this.powerplantText = this.add.text(-powerPanelWidth / 2 + 70 * ui, -powerPanelHeight / 2 + 18 * ui, "Powerplant\nLoading...", {
      fontSize: `${Math.round(12 * ui)}px`,
      color: "#0f172a",
      wordWrap: { width: powerPanelWidth - 90 * ui },
    });

    this.powerplantPanel.add([panelBg, this.powerplantIcon, this.powerplantText]);

    const powerplantIconByType = {
      hydro: "zica",
      wind: "svetilka",
      solar: "baterija",
      gas: "stikalo-on",
      nuclear: "voltmeter",
    };

    const run = (() => {
      try {
        return JSON.parse(localStorage.getItem("geoEleRun") || "null");
      } catch {
        return null;
      }
    })();

    const region = storedPowerplant?.region || run?.continent;

    if (!region) {
      this.powerplantText.setText("Powerplant\nNo region selected yet.");
    } else if (storedPowerplant) {
      this.selectedPowerplant = storedPowerplant;
      const constraints = Array.isArray(storedPowerplant.constraints) && storedPowerplant.constraints.length
        ? storedPowerplant.constraints.join(", ")
        : "none";
      const iconKey = powerplantIconByType[storedPowerplant.type] || "baterija";
      this.powerplantIcon.setTexture(iconKey);
      this.powerplantText.setText(
        `Powerplant: ${storedPowerplant.name}\n` +
        `Type: ${storedPowerplant.type}\n` +
        `Cooling: ${storedPowerplant.coolingNeeds}\n` +
        `Capacity: ${storedPowerplant.capacityMW} MW\n` +
        `Constraints: ${constraints}`
      );
      this.logPowerplantRequirements("loaded-from-storage");
      this.buildExampleCircuits();
    } else {
      this.powerplantText.setText(`Powerplant\nLoading for ${region}...`);
      loadPowerplantsForRegion(region)
        .then((items) => {
          const list = Array.isArray(items) ? items : [];
          if (!list.length) {
            this.powerplantText.setText(`Powerplant\nNo data for ${region}.`);
            return;
          }

          const selected = list[0];
          this.selectedPowerplant = selected;
          const iconKey = powerplantIconByType[selected.type] || "baterija";
          this.powerplantIcon.setTexture(iconKey);

          const constraints = Array.isArray(selected.constraints) && selected.constraints.length
            ? selected.constraints.join(", ")
            : "none";

          this.powerplantText.setText(
            `Powerplant: ${selected.name}\n` +
            `Type: ${selected.type}\n` +
            `Cooling: ${selected.coolingNeeds}\n` +
            `Capacity: ${selected.capacityMW} MW\n` +
            `Constraints: ${constraints}`
          );
          this.logPowerplantRequirements("loaded-from-api");
          this.buildExampleCircuits();
        })
        .catch(() => {
          this.powerplantText.setText("Powerplant\nFailed to load.");
        });
    }

    this.modeLabel = this.add
      .text(width / 2 + 50, 60, "Mode: Outside Grid", {
        fontSize: `${Math.round(14 * ui)}px`,
        color: "#475569",
        backgroundColor: "#ffffffcc",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);

    // naloži izzive iz backenda
    loadChallengesFromApi(this);

    // Load saved workspace state
    loadWorkspaceState(this);

    attachResize(this, () => this.scene.restart());
  }

  addExampleTabs() {
    const ui = getUiScale(this.scale);
    const { width } = this.cameras.main;

    if (this.tabGroup) {
      this.tabGroup.destroy(true);
    }

    const tabGroup = this.add.container(width / 2, 10 * ui);
    tabGroup.setDepth(5);
    this.tabGroup = tabGroup;

    const makeTab = (label, x, onClick) => {
      const tab = this.add
        .text(x, 0, label, {
          fontSize: `${Math.round(14 * ui)}px`,
          color: "#111827",
          backgroundColor: "#e5e7eb",
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (pointer) => {
          if (pointer?.event) pointer.event.stopPropagation();
          onClick();
        });
      tabGroup.add(tab);
      return tab;
    };

    this.workspaceTab = makeTab("Workspace", -70 * ui, () => this.showExampleMode(false));
    this.exampleTab = makeTab("Example", 70 * ui, () => this.showExampleMode(true));
    this.updateExampleTabs();
  }

  updateExampleTabs() {
    if (!this.workspaceTab || !this.exampleTab) return;
    const activeBg = "#2563eb";
    const inactiveBg = "#e5e7eb";
    const activeColor = "#ffffff";
    const inactiveColor = "#111827";

    this.workspaceTab.setStyle({
      backgroundColor: this.isExampleMode ? inactiveBg : activeBg,
      color: this.isExampleMode ? inactiveColor : activeColor,
    });
    this.exampleTab.setStyle({
      backgroundColor: this.isExampleMode ? activeBg : inactiveBg,
      color: this.isExampleMode ? activeColor : inactiveColor,
    });
  }

  showExampleMode(enabled) {
    this.isExampleMode = enabled;
    this.updateExampleTabs();
    if (this.componentList) this.componentList.setVisible(!enabled);
    if (this.exampleContainer) this.exampleContainer.setVisible(enabled);
    if (this.checkText && enabled) {
      this.checkText.setStyle({ color: "#0f172a" });
      this.checkText.setText("Primer: prikaz pravilnega zunanjega + notranjega kroga.");
    }
  }

  logPowerplantRequirements(source) {
    const plant = this.selectedPowerplant;
    if (!plant) return;

    const capacityMW = Number(plant.capacityMW || 0);
    const requiredCities = capacityMW > 0 ? Math.max(1, Math.round(capacityMW / CITY_DEMAND_MW)) : 0;
    const constraints = Array.isArray(plant.constraints) ? plant.constraints : [];
    const requiresCooling = ["river", "sea", "high"].includes(plant.coolingNeeds || "none");
    const needsTransformer =
      capacityMW >= 800 ||
      constraints.includes("grid_stability_priority") ||
      constraints.includes("long_distance_grid");

    console.log("[workspace] powerplant requirements", {
      source,
      name: plant.name,
      type: plant.type,
      capacityMW,
      coolingNeeds: plant.coolingNeeds,
      constraints,
      requiredCities,
      requiresCooling,
      needsTransformer,
      cityDemandMW: CITY_DEMAND_MW,
    });
  }

  buildExampleCircuits() {
    const ui = getUiScale(this.scale);
    const { width, height } = this.cameras.main;
    if (this.exampleContainer) this.exampleContainer.destroy(true);

    const centerX = width / 2 + 60 * ui;
    const centerY = height / 2;
    const container = this.add.container(0, 0);
    container.setDepth(4);

    const makeStaticItem = (x, y, texture, label, enablePlant = false) => {
      const item = this.add.container(x, y);
      const img = this.add.image(0, 0, texture).setDisplaySize(70 * ui, 70 * ui);
      const text = this.add
        .text(0, 50 * ui, label, {
          fontSize: `${Math.round(12 * ui)}px`,
          color: "#111827",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      item.add([img, text]);
      if (enablePlant) {
        img.setInteractive({ useHandCursor: true });
        img.on("pointerdown", (pointer) => {
          if (!pointer?.rightButtonDown()) return;
          this.enterInsidePlantMode();
        });
      }
      return item;
    };

    const plantName = this.selectedPowerplant?.name || "Elektrarna";
    const outsideGroup = this.add.container(centerX - 180 * ui, centerY);
    outsideGroup.add(makeStaticItem(0, -60 * ui, "baterija", `Elektrarna: ${plantName}`, true));
    outsideGroup.add(makeStaticItem(120 * ui, -60 * ui, "zica", "Žica"));
    outsideGroup.add(makeStaticItem(220 * ui, -60 * ui, "svetilka", "Mesto (porabnik)"));
    outsideGroup.add(makeStaticItem(0, 60 * ui, "voltmeter", "Vodna črpalka"));
    outsideGroup.add(makeStaticItem(120 * ui, 60 * ui, "upor", "Transformator"));

    const insideGroup = this.add.container(centerX + 180 * ui, centerY);
    insideGroup.add(makeStaticItem(0, -80 * ui, "baterija", "Uranovo jedro"));
    insideGroup.add(makeStaticItem(120 * ui, -80 * ui, "zica", "Vodna cev"));
    insideGroup.add(makeStaticItem(240 * ui, -80 * ui, "svetilka", "Turbina"));
    insideGroup.add(makeStaticItem(0, 0, "voltmeter", "Hladilna voda"));
    insideGroup.add(makeStaticItem(120 * ui, 0, "ampermeter", "Generator"));
    insideGroup.add(makeStaticItem(240 * ui, 0, "upor", "Krmilne palice"));

    const label = this.add
      .text(centerX, centerY - 150 * ui, "Primer delujočega kroga (zunanji + notranji)", {
        fontSize: `${Math.round(14 * ui)}px`,
        color: "#0f172a",
        backgroundColor: "#ffffffcc",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5);

    container.add([outsideGroup, insideGroup, label]);
    container.setVisible(false);
    this.exampleContainer = container;
  }

  setModeLabel() {
    if (!this.modeLabel) return;
    const label = this.mode === "inside" ? "Mode: Inside Plant" : "Mode: Outside Grid";
    this.modeLabel.setText(label);
  }

  getOutsidePumpCount() {
    try {
      const raw = localStorage.getItem("workspaceComponentsOutside");
      const data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return 0;
      return data.filter((item) => item?.type === "vodna-crpalka").length;
    } catch {
      return 0;
    }
  }

  updateInsideStatsUI() {
    if (!this.insidePanelText) return;
    const info = this.insideState;
    const status = info.stable ? "Stabilno" : "Nestabilno (eksplozija)";
    this.insidePanelText.setText(
      `Uranium: ${info.uraniumAmount}\n` +
      `Water: ${info.waterAmount}/${info.waterAvailable}\n` +
      `Output: ${info.outputMW} MW\n` +
      `Status: ${status}\n` +
      `${info.message || ""}`
    );
  }

  computeInsideOutput() {
    const uranium = this.insideState.uraniumAmount;
    const water = this.insideState.waterAmount;
    const turbines = this.placedComponents.filter((c) => c.getData("type") === "turbine").length;
    const tubes = this.placedComponents.filter((c) => c.getData("type") === "water-tube").length;
    const hasCore = this.placedComponents.some((c) => c.getData("type") === "uranium-core");
    // Generator removed from requirements as per user request (turbines imply generation)
    // const hasGenerator = this.placedComponents.some((c) => c.getData("type") === "generator");

    if (!hasCore || turbines === 0 || tubes === 0) {
      this.insideState.stable = false;
      this.insideState.outputMW = 0;
      this.insideState.message = "Dodaj jedro, cevi in turbine.";
      this.updateInsideStatsUI();
      this.saveInsideResult();
      return;
    }

    const coolingRatio = water / Math.max(1, uranium * 2);
    const stable = coolingRatio >= 1 && water > 0;
    this.insideState.stable = stable;

    if (!stable) {
      this.insideState.outputMW = 0;
      this.insideState.message = "Premalo hlajenja za moč jedra.";
      this.updateInsideStatsUI();
      this.saveInsideResult();
      return;
    }

    const base = uranium * 120;
    const turbineBoost = turbines * 40;
    const tubeBoost = tubes * 10;
    this.insideState.outputMW = Math.round((base + turbineBoost + tubeBoost) * 0.6);
    this.insideState.message = "";
    this.updateInsideStatsUI();
    this.saveInsideResult();
  }

  saveInsideResult() {
    const payload = {
      outputMW: this.insideState.outputMW,
      stable: this.insideState.stable,
      uraniumAmount: this.insideState.uraniumAmount,
      waterAmount: this.insideState.waterAmount,
      waterAvailable: this.insideState.waterAvailable,
      updatedAt: Date.now(),
    };
    localStorage.setItem("geoEleInsideResult", JSON.stringify(payload));
  }

  setupInsidePanel() {
    const ui = getUiScale(this.scale);
    const { width } = this.cameras.main;

    if (this.insidePanel) this.insidePanel.destroy(true);

    const panelWidth = 260 * ui;
    const panelHeight = 160 * ui;
    const panelX = width - panelWidth / 2 - 20 * ui;
    const panelY = 520 * ui;

    this.insidePanel = this.add.container(panelX, panelY);
    this.insidePanel.setDepth(3);

    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0xffffff, 0.95);
    bg.setStrokeStyle(2, 0xd1d5db, 1);

    this.insidePanelText = this.add.text(-panelWidth / 2 + 12 * ui, -panelHeight / 2 + 10 * ui, "", {
      fontSize: `${Math.round(12 * ui)}px`,
      color: "#0f172a",
      wordWrap: { width: panelWidth - 24 * ui },
    });

    const makeAdjustButton = (label, x, y, onClick) => {
      const btn = this.add
        .text(x, y, label, {
          fontSize: `${Math.round(14 * ui)}px`,
          color: "#1f2937",
          backgroundColor: "#e5e7eb",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", (pointer) => {
          if (pointer?.event) pointer.event.stopPropagation();
          onClick();
        });
      return btn;
    };

    const baseX = -panelWidth / 2 + 60 * ui;
    const baseY = panelHeight / 2 - 30 * ui;
    const gap = 60 * ui;

    const uraniumMinus = makeAdjustButton("-U", baseX, baseY, () => {
      this.insideState.uraniumAmount = Math.max(0, this.insideState.uraniumAmount - 1);
      this.computeInsideOutput();
    });
    const uraniumPlus = makeAdjustButton("+U", baseX + 40 * ui, baseY, () => {
      this.insideState.uraniumAmount = Math.min(10, this.insideState.uraniumAmount + 1);
      this.computeInsideOutput();
    });

    const waterMinus = makeAdjustButton("-W", baseX + gap, baseY, () => {
      this.insideState.waterAmount = Math.max(0, this.insideState.waterAmount - 1);
      this.computeInsideOutput();
    });
    const waterPlus = makeAdjustButton("+W", baseX + gap + 40 * ui, baseY, () => {
      this.insideState.waterAmount = Math.min(this.insideState.waterAvailable, this.insideState.waterAmount + 1);
      this.computeInsideOutput();
    });

    const backBtn = this.add
      .text(panelWidth / 2 - 70 * ui, -panelHeight / 2 + 12 * ui, "↩ Outside", {
        fontSize: `${Math.round(12 * ui)}px`,
        color: "#2563eb",
        backgroundColor: "#ffffff",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.exitInsidePlantMode());

    this.insidePanel.add([bg, this.insidePanelText, uraniumMinus, uraniumPlus, waterMinus, waterPlus, backBtn]);
    this.updateInsideStatsUI();
  }

  buildComponentMenu(items) {
    if (!this.componentList) return;
    this.componentList.removeAll(true);
    this.componentList.y = 0;

    const ui = getUiScale(this.scale);
    const componentGap = 80 * ui;
    const componentStartY = this.componentListTop + 20 * ui;

    items.forEach((item, index) => {
      const y = componentStartY + componentGap * index;
      createComponent(this, this.panelWidth / 2, y, item.type, item.color, ui);
    });

    const lastY = items.length
      ? componentStartY + componentGap * (items.length - 1)
      : componentStartY;
    const contentHeight = (lastY + 60 * ui) - this.componentListTop;
    const maxScroll = Math.max(0, contentHeight - this.componentListHeight);
    this.componentScroll = { minY: -maxScroll, maxY: 0 };
  }

  enterInsidePlantMode() {
    if (this.mode === "inside") return;
    if (!this.selectedPowerplant) {
      if (this.checkText) {
        this.checkText.setStyle({ color: "#cc0000" });
        this.checkText.setText("Najprej izberi elektrarno v kvizu.");
      }
      return;
    }
    const hasPlantOutside = this.placedComponents.some((comp) => comp.getData("type") === "elektrarna");
    if (!hasPlantOutside) {
      if (this.checkText) {
        this.checkText.setStyle({ color: "#cc0000" });
        this.checkText.setText("Postavi elektrarno v zunanjem omrežju.");
      }
      return;
    }

    saveWorkspaceState(this);
    this.mode = "inside";
    this.workspaceStorageKey = this.isExampleMode ? "exampleComponentsInside" : "workspaceComponentsInside";
    this.setModeLabel();

    const pumps = this.getOutsidePumpCount();
    this.insideState.waterAvailable = pumps * 3;
    this.insideState.waterAmount = Math.min(this.insideState.waterAmount, this.insideState.waterAvailable);

    this.outsidePromptText = this.promptText.text;
    this.promptText.setText("Notranjost elektrarne: zgradi delujoč notranji krog.");

    clearWorkspace(this, { preserveStorage: true });
    loadWorkspaceState(this);
    
    // If example and empty, maybe setup example inside? 
    // For now we just allow empty or let user build in example mode without persisting to their real workspace.
    
    this.computeInsideOutput();
    this.setupInsidePanel();

    this.buildComponentMenu([
      { type: "uranium-core", color: 0xffb74d },
      { type: "water-tube", color: 0x81d4fa },
      { type: "turbine", color: 0xffcc80 },
      { type: "zica", color: 0x0066cc },
    ]);
  }

  exitInsidePlantMode() {
    this.promptText.setText(this.outsidePromptText || "Nalagam izzive...");
    if (this.insidePanel) {
      this.insidePanel.destroy(true);
      this.insidePanel = null;
      this.insidePanelText = null;
    }

    clearWorkspace(this, { preserveStorage: true });
    loadWorkspaceState(this);

    this.buildComponentMenu([
      { type: "elektrarna", color: 0xffb74d },
      { type: "mesto", color: 0xff5252 },
      { type: "vodna-crpalka", color: 0x4fc3f7 },
      { type: "transformator", color: 0xffcc80 },
      { type: "zica", color: 0x0066cc },
    ]);
  }

  toggleWorkspaceMode() {
    if (this.mode === "inside") {
      this.exitInsidePlantMode();
    } else {
      this.enterInsidePlantMode();
    }
  }
}
