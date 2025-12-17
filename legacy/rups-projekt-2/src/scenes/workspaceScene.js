// src/scenes/WorkspaceScene.js
import Phaser from 'phaser';
import LabScene from './labScene';
import { attachResize, getUiScale } from '../utils/uiScale';

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
  clearWorkspace,
} from '../logic/workspaceSceneLogic';

export default class WorkspaceScene extends Phaser.Scene {
  constructor() {
    super('WorkspaceScene');
  }

  init() {
    this.currentChallengeIndex = 0;
    this.dragMode = true; // true = drag-and-drop, false = click-to-place
    this.activeComponentType = null; // stores the component type in click mode
  }

  preload() {
    // logika (graph, placedComponents, ...)
    initWorkspaceLogic(this);

    // asseti za izgled
    this.load.image('baterija', 'src/components/battery.png');
    this.load.image('upor', 'src/components/resistor.png');
    this.load.image('svetilka', 'src/components/lamp.png');
    this.load.image('stikalo-on', 'src/components/switch-on.png');
    this.load.image('stikalo-off', 'src/components/switch-off.png');
    this.load.image('žica', 'src/components/wire.png');
    this.load.image('ampermeter', 'src/components/ammeter.png');
    this.load.image('voltmeter', 'src/components/voltmeter.png');
  }

  create() {
    const { width, height } = this.cameras.main;
    const ui = getUiScale(this.scale);
    localStorage.setItem('lastScene', 'WorkspaceScene');

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
      .text(0, 0, '', {
        fontSize: `${Math.round(14 * ui)}px`,
        color: '#ffffff',
        align: 'left',
        wordWrap: { width: 280 },
      })
      .setOrigin(0.5);

    this.infoWindow.add([this.infoBox, infoText]);
    this.infoText = infoText;

    // text za izzive + feedback
    this.promptText = this.add
      .text(Math.floor(width / 1.8), Math.floor(height - 30), 'Nalagam izzive...', {
        fontSize: `${Math.round(20 * ui)}px`,
        color: '#0f172a',
        fontStyle: 'bold',
        backgroundColor: '#ffffffee',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5);

    this.checkText = this.add
      .text(width / 2, height - 70, '', {
        fontSize: `${Math.round(18 * ui)}px`,
        color: '#cc0000',
        fontStyle: 'bold',
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
      bg.fillRoundedRect(
        x - buttonWidth / 2,
        y - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );

      const text = this.add
        .text(x, y, label, {
          fontFamily: 'Arial',
          fontSize: `${Math.round(20 * ui)}px`,
          color: '#ffffffff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          bg.clear();
          bg.fillGradientStyle(0x1e40af, 0x1d4ed8, 0x1d4ed8, 0x1e3a8a, 1);
          bg.fillRoundedRect(
            x - buttonWidth / 2,
            y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        })
        .on('pointerout', () => {
          bg.clear();
          bg.fillGradientStyle(0x2563eb, 0x1d4ed8, 0x1e40af, 0x1d4ed8, 1);
          bg.fillRoundedRect(
            x - buttonWidth / 2,
            y - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
          );
        })
        .on('pointerdown', (pointer) => {
          // Stop propagation to prevent workspace click handler
          if (pointer.event) {
            pointer.event.stopPropagation();
          }
          onClick();
        });

      return { bg, text };
    };

    makeButton(width - 140, 60 + 15 * ui, 'Lestvica', () =>
      this.scene.start('ScoreboardScene', {
        cameFromMenu: false,
        previousScene: 'WorkspaceScene',
      })
    );
    makeButton(width - 140, 120 + 15 * ui, 'Preveri krog', () => checkCircuit(this));
    makeButton(width - 140, 180 + 15 * ui, 'Simulacija', () =>
      simulateCircuit(this)
    );
    makeButton(width - 140, 240 + 15 * ui, 'Počisti mizo', () => clearWorkspace(this));

    // stranska vrstica
    const panelWidth = Math.max(160 * ui, width * 0.12);
    this.panelWidth = panelWidth;
    const sidePanel = this.add.graphics();
    sidePanel.fillStyle(0xc0c0c0, 0.96);
    sidePanel.fillRoundedRect(0, 0, panelWidth, height, 0);
    sidePanel.lineStyle(2, 0x1f2937, 1);
    sidePanel.strokeRoundedRect(0, 0, panelWidth, height, 0);

    this.add
      .text(Math.floor(panelWidth / 2), 100 * ui, 'Komponente', {
        fontSize: `${Math.round(25 * ui)}px`,
        color: '#2d2d2eff',
        fontStyle: 'bold',
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5);

    // komponente v stranski vrstici (kličeš logični helper)
    const componentStartY = 180 * ui;
    const componentGap = 80 * ui;
    createComponent(this, panelWidth / 2, componentStartY, 'baterija', 0xff6600, ui);
    createComponent(this, panelWidth / 2, componentStartY + componentGap, 'upor', 0xff6600, ui);
    createComponent(this, panelWidth / 2, componentStartY + componentGap * 2, 'svetilka', 0xff0000  , ui);
    createComponent(this, panelWidth / 2, componentStartY + componentGap * 3, 'stikalo-off', 0x666666, ui);
    createComponent(this, panelWidth / 2, componentStartY + componentGap * 4, 'žica', 0x0066cc, ui);
    createComponent(this, panelWidth / 2, componentStartY + componentGap * 5, 'ampermeter', 0x00cc66, ui);
    createComponent(this, panelWidth / 2, componentStartY + componentGap * 6, 'voltmeter', 0x00cc66, ui);

    // Toggle button for drag mode
    const toggleButtonY =  135* ui;
    const toggleButton = this.add
      .text(panelWidth / 2, toggleButtonY, '🖱️ Drag Mode', {
        fontSize: `${Math.round(16 * ui)}px`,
        color: '#ffffff',
        backgroundColor: '#2563eb',
        padding: { x: 12, y: 8 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer) => {
        // Stop propagation to prevent workspace click handler
        if (pointer.event) {
          pointer.event.stopPropagation();
        }
        this.dragMode = !this.dragMode;
        if (this.dragMode) {
          toggleButton.setText('🖱️ Drag Mode');
          toggleButton.setStyle({ backgroundColor: '#2563eb' });
          this.activeComponentType = null;
          if (this.selectedComponentIndicator) {
            this.selectedComponentIndicator.destroy();
            this.selectedComponentIndicator = null;
          }
        } else {
          toggleButton.setText('👆 Click Mode');
          toggleButton.setStyle({ backgroundColor: '#16a34a' });
        }
      });

    // back button


    const backButton = this.add
      .text(Math.floor(panelWidth / 2 ), 40 * ui, '↩ Meni', {
        fontFamily: 'Arial',
        fontSize: `${Math.round(20 * ui)}px`,
        color: '#2563eb',
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () =>
        backButton.setStyle({ color: '#cde3ff' })
      )
      .on('pointerout', () =>
        backButton.setStyle({ color: '#8ab4ff' })
      )
      .on('pointerdown', async (pointer) => {
        // Stop propagation to prevent workspace click handler
        if (pointer.event) {
          pointer.event.stopPropagation();
        }
        await finalizeSession(this);
        resetWorkspaceProgress();
        localStorage.setItem('lastScene', 'LabScene');

        this.scene.start('LabScene', { cameFromMenu: false });
        /*this.cameras.main.fade(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
          this.scene.start('ScoreboardScene', {
            cameFromMenu: false,
            previousScene: 'WorkspaceScene',
          });
        });*/
      });

    this.add
      .text(
        width / 2 + 50,
        30,
        'Povleci komponente na mizo in zgradi svoj električni krog!',
        {
          
          fontSize: `${Math.round(20 * ui)}px`,
          color: '#0f172a',
          fontStyle: 'bold',
          resolution: window.devicePixelRatio ,
          align: 'center',
          backgroundColor: '#ffffffdd',
          padding: { x: 15, y: 8 },
        }
      )
      .setOrigin(0.5);


    // naloži izzive iz backenda
    loadChallengesFromApi(this);

    // Load saved workspace state
    loadWorkspaceState(this);

    attachResize(this, () => this.scene.restart());
  }
}
