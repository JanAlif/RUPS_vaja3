// src/scenes/labScene.js
import Phaser from 'phaser';
import { attachResize, getUiScale } from '../utils/uiScale';

export default class LabScene extends Phaser.Scene {
  constructor() {
    super('LabScene');
  }

  preload() {
    for (let i = 1; i <= 11; i++) {
      this.load.image(`avatar${i}`, `src/avatars/avatar${i}.png`);
    }
    this.load.image('defaultPfp', 'src/avatars/avatar1.png');
  }

  create() {
    // camera / initial sizes
    const cam = this.cameras.main;
    const { width, height } = cam;
    const ui = getUiScale(this.scale);

    // BACKGROUND 
    this.bg = this.add.rectangle(0, 0, width, height, 0xf0f0f0).setOrigin(0);
    this.wall = this.add.rectangle(0, 0, width, Math.max(0, height - 150 * ui), 0xe8e8e8).setOrigin(0);
    this.floor = this.add.rectangle(0, height - 150 * ui, width, 150 * ui, 0xd4c4a8).setOrigin(0);

    this.bg.setDepth(-3);
    this.wall.setDepth(-2);
    this.floor.setDepth(-1);

    // Table container 
    this.tableContainer = this.add.container(0, 0);

    // compute initial table values
    const tableX = width / 2;
    const tableY = height / 2 + 50 * ui;
    const tableWidth = Math.min(520 * ui, width - 100);
    const tableHeight = Math.min(260 * ui, height * 0.5);

    // Table top and surface 
    this.tableTop = this.add.rectangle(tableX, tableY, tableWidth, 30, 0x8b4513).setOrigin(0.5);
    this.tableSurface = this.add.rectangle(
      tableX,
      tableY + 15,
      tableWidth - 30,
      tableHeight - 30,
      0xa0826d
    ).setOrigin(0.5, 0);

    // Table legs
    this.tableLegLeft = this.add.rectangle(
      tableX - tableWidth / 2 + 40,
      tableY + tableHeight / 2 + 20,
      20,
      150 * ui,
      0x654321
    );
    this.tableLegRight = this.add.rectangle(
      tableX + tableWidth / 2 - 40,
      tableY + tableHeight / 2 + 20,
      20,
      150 * ui,
      0x654321
    );

    // Grid graphics 
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.lineStyle(1, 0x8b7355, 0.3);

    // Interactive zone
    this.interactiveZone = this.add.zone(
      tableX,
      tableY + tableHeight / 2,
      tableWidth,
      tableHeight
    ).setInteractive({ useHandCursor: true });

    this.tableContainer.add([
      this.tableTop,
      this.tableSurface,
      this.tableLegLeft,
      this.tableLegRight,
      this.gridGraphics,
      this.interactiveZone
    ]);


    this.tableContainer.setDepth(0);
    this.tableSurface.setDepth(1);

    // Interactive events
    this.interactiveZone.on('pointerdown', () => {
      this.cameras.main.fade(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start('WorkspaceScene'));
    });
    this.interactiveZone.on('pointerover', () => this.tableSurface.setFillStyle(0xb09070));
    this.interactiveZone.on('pointerout', () => this.tableSurface.setFillStyle(0xa0826d));


    const username = localStorage.getItem('username') || 'Uporabnik';
    const pfpKey = localStorage.getItem('profilePic') || 'defaultPfp';

    this.avatarRadius = 20 * ui; 
    this.avatarBorderThickness = 4 * ui;


    this.avatarBorder = this.add.circle(200 * ui, 55 * ui, this.avatarRadius + this.avatarBorderThickness, 0xcccccc).setOrigin(0.5);
    this.avatarInner = this.add.circle(200 * ui, 55 * ui, this.avatarRadius, 0xffffff).setOrigin(0.5);
    this.avatarImage = this.add.image(200 * ui, 55 * ui, pfpKey).setDisplaySize(this.avatarRadius * 2, this.avatarRadius * 2).setOrigin(0.5);
    this.avatarImage.setMask(this.avatarInner.createGeometryMask());

    this.greetingText = this.add.text(this.avatarBorder.x + 50 * ui, this.avatarBorder.y + 10 * ui, `Dobrodošel ${username}!`, {
      fontSize: `${Math.round(22 * ui)}px`,
      color: '#222',
      fontStyle: 'bold',
      resolution: window.devicePixelRatio
    }).setOrigin(0, 0);

    //Logout button
    this.logoutButton = this.add.text(50 * ui, 45 * ui, '↩ Odjavi se', {
      fontSize: `${Math.round(20 * ui)}px`,
      fontFamily: 'Arial',
      color: '#2563eb',
      resolution: window.devicePixelRatio,
    }).setInteractive({ useHandCursor: true });

    this.logoutButton.on('pointerover', () => this.logoutButton.setStyle({ color: '#0044cc' }));
    this.logoutButton.on('pointerout', () => this.logoutButton.setStyle({ color: '#0066ff' }));
    this.logoutButton.on('pointerdown', () => {
      localStorage.clear();
      this.scene.start('MenuScene');
    });

    //Menu buttons
    this.buttonWidth = 180 * ui;
    this.buttonHeight = 45 * ui;
    this.cornerRadius = 10 * ui;

    this.menuButtons = this.add.container(0, 0);

    const makeButton = (label, color, hover, onClick) => {
      const bg = this.add.graphics();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(0, 0, this.buttonWidth, this.buttonHeight, this.cornerRadius);

      const txt = this.add.text(this.buttonWidth / 2, this.buttonHeight / 2, label, {
        fontSize: `${Math.round(20 * ui)}px`,
        color: '#fff',
        resolution: window.devicePixelRatio
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      txt.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(hover, 1);
        bg.fillRoundedRect(0, 0, this.buttonWidth, this.buttonHeight, this.cornerRadius);
      });
      txt.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(0, 0, this.buttonWidth, this.buttonHeight, this.cornerRadius);
      });
      txt.on('pointerdown', onClick);

      return this.add.container(0, 0, [bg, txt]);
    };

    this.profileBtn = makeButton('Profil', 0x555555, 0x333333, () => this.scene.start('ProfileScene'));
    this.examplesBtn = makeButton('Primeri', 0x7c3aed, 0x5b21b6, () => this.scene.start('ExamplesScene'));
    this.scoreBtn = makeButton('Lestvica', 0x3399ff, 0x0f5cad, () => this.scene.start('ScoreboardScene', {
      cameFromMenu: true,
      previousScene: 'LabScene'
    }));

    this.menuButtons.add([this.profileBtn, this.examplesBtn, this.scoreBtn]);

    //Hamburger menu 
    this.hamburger = this.add.text(width - 50, 40, '☰', {
      fontSize: `${34 * ui}px`,
      color: '#222',
      resolution: window.devicePixelRatio
    }).setInteractive({ useHandCursor: true }).setVisible(false);

    this.hamburgerMenu = this.add.container(width - 160, 90).setVisible(false);

    const dropProfile = this.add.text(0, 0, 'Profil', { fontSize: '22px', color: '#222' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('ProfileScene'));

    const dropExamples = this.add.text(0, 40, 'Primeri', { fontSize: '22px', color: '#222' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('ExamplesScene'));

    const dropScore = this.add.text(0, 80, 'Lestvica', { fontSize: '22px', color: '#222' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('ScoreboardScene'));

    this.hamburgerMenu.add([dropProfile, dropExamples, dropScore]);

    this.hamburger.on('pointerdown', () => {
      this.hamburgerMenu.setVisible(!this.hamburgerMenu.visible);
    });


    this.instruction = this.add.text(width / 2, (height / 2) - 80 * ui, 'Klikni na mizo in začni graditi svoj električni krog!', {
      fontSize: `${Math.round(24 * ui)}px`,
      color: '#333',
      fontStyle: 'bold',
      backgroundColor: '#ffffff',
      resolution: window.devicePixelRatio,
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: this.instruction,
      alpha: 0.5,
      duration: 1000,
      yoyo: true,
      repeat: -1
    });


    const updateResponsiveLayout = () => {
      const cam2 = this.cameras.main;
      const w = cam2.width;
      const h = cam2.height;

      const uiNow = getUiScale(this.scale);


      if (this.bg) this.bg.setSize(w, h).setPosition(0, 0);
      if (this.wall) this.wall.setSize(w, Math.max(0, h - 150 * uiNow)).setPosition(0, 0);
      if (this.floor) this.floor.setSize(w, 150 * uiNow).setPosition(0, h - 150 * uiNow);

  
      if (this.instruction) {
        this.instruction.setPosition(w / 2, (h / 2) - 80 * uiNow);
        this.instruction.setStyle({ fontSize: `${Math.round(24 * uiNow)}px` });
      }

    
      const tableX = w / 2;
      const tableY = h / 2 + 50 * uiNow;
      const tableWidth = Math.min(520 * uiNow, w - 100);
      const tableHeight = Math.min(260 * uiNow, h * 0.5);


      if (this.tableTop) this.tableTop.setPosition(tableX, tableY).setSize(tableWidth, 30);
      if (this.tableSurface) this.tableSurface.setPosition(tableX, tableY + 15).setSize(Math.max(0, tableWidth - 30), Math.max(0, tableHeight - 30));
      if (this.tableLegLeft) this.tableLegLeft.setPosition(tableX - tableWidth / 2 + 40, tableY + tableHeight / 2 + 20);
      if (this.tableLegRight) this.tableLegRight.setPosition(tableX + tableWidth / 2 - 40, tableY + tableHeight / 2 + 20);


      if (this.interactiveZone) {
        this.interactiveZone.setPosition(tableX, tableY + tableHeight / 2);
        this.interactiveZone.setSize(tableWidth, tableHeight);
      }

      if (this.gridGraphics) {
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1, 0x8b7355, 0.3);

        const gridSize = 30 * uiNow;
        const gridStartX = tableX - (tableWidth - 30) / 2;
        const gridStartY = tableY + 15;
        const gridEndX = tableX + (tableWidth - 30) / 2;
        const gridEndY = tableY + 15 + (tableHeight - 30);

        if (gridEndX > gridStartX && gridEndY > gridStartY && gridSize > 0) {
          for (let x = gridStartX; x <= gridEndX; x += gridSize) {
            this.gridGraphics.lineBetween(x, gridStartX !== gridEndX ? gridStartY : gridEndY, x, gridEndY);
          }
          for (let y = gridStartY; y <= gridEndY; y += gridSize) {
            this.gridGraphics.lineBetween(gridStartX, y, gridEndX, y);
          }
        }

  
        this.gridGraphics.setDepth(0);
        if (this.tableSurface) this.tableSurface.setDepth(1);
      }

  
      this.avatarRadius = 20 * uiNow;
      this.avatarBorderThickness = 4 * uiNow;

      const avatarX = 200 * uiNow;
      const avatarY = 55 * uiNow;
      if (this.avatarBorder) this.avatarBorder.setPosition(avatarX, avatarY).setRadius(this.avatarRadius + this.avatarBorderThickness);
      if (this.avatarInner) this.avatarInner.setPosition(avatarX, avatarY).setRadius(this.avatarRadius);
      if (this.avatarImage) this.avatarImage.setPosition(avatarX, avatarY).setDisplaySize(this.avatarRadius * 2, this.avatarRadius * 2);

      if (this.greetingText) {
        this.greetingText.setPosition(avatarX + 50 * uiNow, avatarY - 10 * uiNow);
        this.greetingText.setStyle({ fontSize: `${Math.round(22 * uiNow)}px` });
      }


      if (this.logoutButton) {
        this.logoutButton.setPosition(50 * uiNow, 45 * uiNow);
        this.logoutButton.setStyle({ fontSize: `${Math.round(20 * uiNow)}px` });
      }

      const isMobile = w < 920;
      //Hambureger logic
      if (isMobile) {
        this.menuButtons.setVisible(false);
        this.hamburger.setVisible(true);
        this.hamburger.setPosition(w - 50 * uiNow, 40 * uiNow).setStyle({ fontSize: `${Math.round(34 * uiNow)}px` });
        this.hamburgerMenu.setPosition(w - 180 * uiNow, 90 * uiNow);
      } else {
  
        this.menuButtons.setVisible(true);
        this.hamburger.setVisible(false);
        this.hamburgerMenu.setVisible(false);

        const startX = w - (this.buttonWidth * 3) - (60 * uiNow);
        this.menuButtons.setPosition(startX, 40 * uiNow);

  
        this.profileBtn.setPosition(0, 0);
        this.examplesBtn.setPosition(this.buttonWidth + 20 * uiNow, 0);
        this.scoreBtn.setPosition((this.buttonWidth * 2) + (40 * uiNow), 0);

        const newFontSize = Math.round(20 * uiNow);
        [this.profileBtn, this.examplesBtn, this.scoreBtn].forEach(btnContainer => {
          const textObj = btnContainer.list && btnContainer.list[1];
          if (textObj) textObj.setStyle({ fontSize: `${newFontSize}px` });
        });
      }

      this.tableContainer.setVisible(true);
    };

    updateResponsiveLayout();

    attachResize(this, updateResponsiveLayout);
  }

  shutdown() {
    if (this.avatarImage && this.avatarImage.clearMask) {
      try { this.avatarImage.clearMask(true); } catch (e) { }
    }
  }
}
