import Phaser from 'phaser';
import { attachResize, getUiScale } from '../utils/uiScale';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
        this.isSwitchOn = false;
        this.title = null;
        this.loginButton = null;
        this.fixedComponents = [];
        this.gridGraphics = null;
        this.desk = null;
    }

    preload() {
        this.load.image('battery', 'src/components/battery.png');
        this.load.image('lamp', 'src/components/lamp.png');
        this.load.image('resistor', 'src/components/resistor.png');
        this.load.image('switch-off', 'src/components/switch-off.png');
        this.load.image('switch-on', 'src/components/switch-on.png');
        this.load.image('wire', 'src/components/wire.png');
    }

    create() {
        const { width, height } = this.scale;
        const ui = getUiScale(this.scale);

        this.children.removeAll(true); // odstrani vse objekte iz prejsnje scene
        this.fixedComponents = [];
        this.isSwitchOn = false;

        // ozdaje
        this.createDeskBackground(width, height, ui);

        // zice 
        this.cameras.main.setBackgroundColor('#ffffff');
        const wireThickness = 9.5;
        const wireColor = 0x1a1a1a;
        const rectWidth = Math.min(900 * ui, width * 0.82);
        const rectHeight = Math.min(440 * ui, height * 0.55);
        const rectX = width / 2;
        const rectY = height / 2 - 30 * ui;

        const leftWireX = rectX - rectWidth / 2;
        const rightWireX = rectX + rectWidth / 2;
        const topWireY = rectY - rectHeight / 2;
        const bottomWireY = rectY + rectHeight / 2;

        this.add.rectangle(rectX, topWireY, rectWidth + wireThickness, wireThickness, wireColor);
        this.add.rectangle(leftWireX - wireThickness / 2, rectY, wireThickness, rectHeight + wireThickness, wireColor);
        this.add.rectangle(rightWireX + wireThickness / 2, rectY, wireThickness, rectHeight + wireThickness, wireColor);

        // spodanji zici
        const gapWidth = 250;
        const halfBottomWidth = (rectWidth - gapWidth) / 2;
        this.add.rectangle(rectX - gapWidth / 2 - halfBottomWidth / 2, bottomWireY, halfBottomWidth, wireThickness, wireColor);
        this.add.rectangle(rectX + gapWidth / 2 + halfBottomWidth / 2, bottomWireY, halfBottomWidth, wireThickness, wireColor);

        // stikalo
        const switchOffsetY = -18.5;
        this.switchButton = this.add.image(rectX, bottomWireY + switchOffsetY, 'switch-off')
            .setScale(0.7 * ui)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleSwitch());

        // ui elem
        this.createUI();

        const username = localStorage.getItem('username');
        if (username) {
            this.scene.start('LabScene');
            return;
        } 

        // komponente
        this.createComponents(width, height, rectX, rectY);
        this.hideComponents();

        attachResize(this, () => this.scene.restart());
    }

    createDeskBackground(width, height, ui) {
        // svetla lesena povrsina
        this.desk = this.add.rectangle(0, 0, width, height, 0xe0c9a6)
            .setOrigin(0)
            .setAlpha(0)
            .setDepth(-2);

        // mreza
        this.gridGraphics = this.add.graphics({ alpha: 0 });
        this.gridGraphics.setDepth(-1);
        this.gridGraphics.lineStyle(1, 0x8b7355, 0.35);

        const gridSize = 40 * ui;
        for (let x = 0; x < width; x += gridSize) {
            this.gridGraphics.beginPath();
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, height);
            this.gridGraphics.strokePath();
        }
        for (let y = 0; y < height; y += gridSize) {
            this.gridGraphics.beginPath();
            this.gridGraphics.moveTo(0, y);
            this.gridGraphics.lineTo(width, y);
            this.gridGraphics.strokePath();
        }
    }

    createComponents(width, height, rectX, rectY) {
        const spreadX = Math.min(550, width * 0.45);
        const spreadY = Math.min(300, height * 0.35);
        const positions = [
            { x: Math.max(100, width * 0.15), y: Math.max(110, height * 0.18), type: 'battery' },
            { x: Math.min(width - 100, width * 0.85), y: Math.max(120, height * 0.2), type: 'resistor' },
            { x: Math.max(100, width * 0.12), y: Math.min(height - 140, height * 0.75), type: 'resistor' },
            { x: Math.min(width - 110, width * 0.88), y: Math.min(height - 120, height * 0.78), type: 'battery' },
            { x: rectX - spreadX, y: rectY, type: 'lamp' },
            { x: rectX + spreadX, y: rectY - 20, type: 'lamp' },
            { x: rectX + 50, y: rectY + spreadY, type: 'battery' },
            { x: rectX + spreadX * 0.55, y: rectY - spreadY * 0.95, type: 'lamp' },
            { x: rectX - spreadX * 0.75, y: rectY - spreadY * 0.95, type: 'resistor' },
            { x: rectX, y: rectY - spreadY * 1.05, type: 'battery' },
            { x: rectX - spreadX * 0.65, y: rectY + spreadY, type: 'lamp' },
            { x: rectX + spreadX * 0.65, y: rectY + spreadY, type: 'resistor' }
        ];

        positions.forEach(pos => {
            const img = this.add.image(pos.x, pos.y, pos.type)
                .setScale(0.27)
                .setAngle(Phaser.Math.Between(-25, 25))
                .setAlpha(0)
                .setDepth(0);
            this.fixedComponents.push(img);
        });
    }

    showComponents() {
        this.tweens.add({ targets: this.desk, alpha: 1, duration: 800 });
        this.tweens.add({ targets: this.gridGraphics, alpha: 1, duration: 1200 });

        this.fixedComponents.forEach((img, i) => {
            this.tweens.add({
                targets: img,
                alpha: 0.9,
                duration: 600,
                delay: i * 50
            });
        });
    }

    hideComponents() {
        this.desk?.setAlpha(0);
        this.gridGraphics?.setAlpha(0);
        this.fixedComponents.forEach(img => img.setAlpha(0));
    }

    toggleSwitch() {
        this.isSwitchOn = !this.isSwitchOn;

        if (this.isSwitchOn) {
            this.switchButton.setTexture('switch-on');
            this.switchButton.y += 14;

            // bel napis
            this.title.setStyle({
                color: '#ffffff',
                shadow: {
                    offsetX: 0,
                    offsetY: 0,
                    color: '#ffdd55', // toplo rumen sij
                    blur: 40,
                    fill: true
                }
            });

            this.titleTween.resume();
            this.enableStartButton(true);
            this.showComponents();

        } else {
            this.switchButton.setTexture('switch-off');
            this.switchButton.y -= 14;
            this.title.setStyle({
                color: '#222222',
                shadow: { offsetX: 0, offsetY: 0, color: '#00000000', blur: 0, fill: false }
            });
            this.titleTween.pause();
            this.title.setScale(1);
            this.enableStartButton(false);
            this.hideComponents();
        }
    }

    createUI() {
       const rectX = this.scale.width / 2;
        const rectY = this.scale.height / 2 - 50;
        const ui = getUiScale(this.scale);
        
        // vogali gumba
        const cornerRadius = 15 * ui; 
        const buttonWidth = 250 * ui; 
        const buttonHeight = 60 * ui;
        
        // ozadje gumba
        this.startButtonBackground = this.add.graphics();
        this.startButtonBackground.fillStyle(0xdddddd, 1); // siva
        this.startButtonBackground.fillRoundedRect(
            rectX - buttonWidth / 2, // X zacetek
            (rectY + 100 * ui) - buttonHeight / 2, // Y zacetek
            buttonWidth, 
            buttonHeight, 
            cornerRadius // Polmer!
        );
        this.startButtonBackground.setDepth(-1); 

        // naslov
        this.title = this.add.text(rectX, rectY, 'LABORATORIJ', { 
            fontFamily: 'Arial', 
            fontSize: `${Math.round(72 * ui)}px`, 
            fontStyle: 'bold', 
            color: '#222222' 
        }).setOrigin(0.5);

        // gumb
        this.loginButton = this.add.text(rectX, rectY + 100, '▶ Začni igro', {
            fontFamily: 'Arial',
            fontSize: `${Math.round(32 * ui)}px`,
            color: '#aaaaaa', 
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            
            // hower
            .on('pointerover', () => {
                if (this.isSwitchOn)
                    this.startButtonBackground.fillStyle(0x0f5cadff, 1).fillRoundedRect(rectX - buttonWidth / 2, (rectY + 100 * ui) - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);
            })
            .on('pointerout', () => {
                if (this.isSwitchOn)
                    this.startButtonBackground.fillStyle(0x3399ff, 1).fillRoundedRect(rectX - buttonWidth / 2, (rectY + 100 * ui) - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);
            })
            .on('pointerdown', () => {
                if (this.isSwitchOn) this.scene.start('LoginScene');
            });

        console.log(`${localStorage.getItem('username')}`);

        this.titleTween = this.tweens.add({
            targets: this.title,
            scale: { from: 1, to: 1.05 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            paused: true
        });
    }

enableStartButton(isActive) {
        // zaobljen gumb
        const ui = getUiScale(this.scale);
        const cornerRadius = 15 * ui;
        const buttonWidth = 250 * ui;
        const buttonHeight = 60 * ui;
        const rectX = this.scale.width / 2;
        const rectY = this.scale.height / 2 - 50;

        if (isActive) {
            this.loginButton.setStyle({
                color: '#ffffff', // spremeni samo barvo besedila
            });
            // novo ozadje
            this.startButtonBackground.clear();
            this.startButtonBackground.fillStyle(0x3399ff, 1); 
            this.startButtonBackground.fillRoundedRect(rectX - buttonWidth / 2, (rectY + 100 * ui) - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);
        } else {
            this.loginButton.setStyle({
                color: '#aaaaaa', // spremeni samo barvo besedila
            });
            // novo ozadje
            this.startButtonBackground.clear();
            this.startButtonBackground.fillStyle(0xdddddd, 1);
            this.startButtonBackground.fillRoundedRect(rectX - buttonWidth / 2, (rectY + 100 * ui) - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);
        }
    }
}
