// src/scenes/RegisterScene.js
import Phaser from 'phaser';
import { attachResize, getUiScale } from '../utils/uiScale';

export default class RegisterScene extends Phaser.Scene {
    constructor() {
        super('RegisterScene');
    }

    create() {
        const { width, height } = this.scale;
        const ui = getUiScale(this.scale);

        // --- Ozadje (isto kot LoginScene) ---
        const floorHeight = Math.max(120 * ui, Math.min(160, height * 0.24));
        this.add.rectangle(0, 0, width, height - floorHeight, 0xe8e8e8).setOrigin(0);
        this.add.rectangle(0, height - floorHeight, width, floorHeight, 0xd4c4a8).setOrigin(0);

        const tableX = width / 2;
        const tableY = height / 2 + 50 * ui;
        const tableWidth = Math.min(520 * ui, width - 120);
        const tableHeight = Math.min(260 * ui, height * 0.48);

        this.add.rectangle(tableX, tableY, tableWidth, 30, 0x8b4513).setOrigin(0.5);

        const surface = this.add.rectangle(
            tableX,
            tableY + 15,
            tableWidth - 30 * ui,
            tableHeight - 30 * ui,
            0xa0826d
        ).setOrigin(0.5, 0);

        const grid = this.add.graphics();
        grid.lineStyle(1, 0x8b7355, 0.3);
        const gridSize = 30 * ui;
        const gridStartX = tableX - (tableWidth - 30 * ui) / 2;
        const gridStartY = tableY + 15;
        const gridEndX = tableX + (tableWidth - 30 * ui) / 2;
        const gridEndY = tableY + 15 + (tableHeight - 30 * ui);

        for (let x = gridStartX; x <= gridEndX; x += gridSize) {
            grid.beginPath();
            grid.moveTo(x, gridStartY);
            grid.lineTo(x, gridEndY);
            grid.strokePath();
        }
        for (let y = gridStartY; y <= gridEndY; y += gridSize) {
            grid.beginPath();
            grid.moveTo(gridStartX, y);
            grid.lineTo(gridEndX, y);
            grid.strokePath();
        }

        const legWidth = 20;
        const legHeight = 150 * ui;
        this.add.rectangle(
            tableX - tableWidth / 2 + 40,
            tableY + tableHeight / 2 + 20,
            legWidth,
            legHeight,
            0x654321
        );
        this.add.rectangle(
            tableX + tableWidth / 2 - 40,
            tableY + tableHeight / 2 + 20,
            legWidth,
            legHeight,
            0x654321
        );

        const panelWidth = Math.min(520 * ui, width - 100);
        const panelHeight = Math.min(380 * ui, height - floorHeight - 70);
        const panelX = width / 2 - panelWidth / 2;
        const panelY = Math.max(40, height / 2 - panelHeight / 2 - 30 * ui);

        const panel = this.add.graphics();
        panel.fillStyle(0xffffff, 0.92);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 25);
        panel.lineStyle(3, 0xcccccc, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 25);

        // naslov
        this.add.text(width / 2, panelY + 40 * ui, 'REGISTRACIJA', {
            fontFamily: 'Arial',
            fontSize: `${Math.round(32 * ui)}px`,
            fontStyle: 'bold',
            color: '#222'
        }).setOrigin(0.5);

        const inputWidth = Math.min(360 * ui, width - 140);
        const inputHeight = 40 * ui;

        // USERNAME
        const username = document.createElement('input');
        username.type = 'text';
        username.placeholder = 'Uporabniško ime';
        Object.assign(username.style, {
            position: 'absolute',
            lineHeight: `${inputHeight}px`,
            width: `${inputWidth}px`,
            height: `${inputHeight}px`,
            left: `${width / 2 - inputWidth / 2}px`,
            top: `${panelY + 90 * ui}px`,
            borderRadius: '8px',
            padding: '5px',
            border: '1px solid #ccc',
            textAlign: 'center',
            fontSize: `${Math.round(18 * ui)}px`,
            outline: 'none',
            backgroundColor: '#f9f9f9'
        });
        document.body.appendChild(username);

        // PASSWORD
        const password = document.createElement('input');
        password.type = 'password';
        password.placeholder = 'Geslo';
        Object.assign(password.style, {
            position: 'absolute',
            lineHeight: `${inputHeight}px`,
            width: `${inputWidth}px`,
            height: `${inputHeight}px`,
            left: `${width / 2 - inputWidth / 2}px`,
            top: `${panelY + 145 * ui}px`,
            borderRadius: '8px',
            padding: '5px',
            border: '1px solid #ccc',
            textAlign: 'center',
            fontSize: `${Math.round(18 * ui)}px`,
            outline: 'none',
            backgroundColor: '#f9f9f9'
        });
        document.body.appendChild(password);

        // CONFIRM PASSWORD
        const password2 = document.createElement('input');
        password2.type = 'password';
        password2.placeholder = 'Ponovno vnesi geslo';
        Object.assign(password2.style, {
            position: 'absolute',
            lineHeight: `${inputHeight}px`,
            width: `${inputWidth}px`,
            height: `${inputHeight}px`,
            left: `${width / 2 - inputWidth / 2}px`,
            top: `${panelY + 200 * ui}px`,
            borderRadius: '8px',
            padding: '5px',
            border: '1px solid #ccc',
            textAlign: 'center',
            fontSize: `${Math.round(18 * ui)}px`,
            outline: 'none',
            backgroundColor: '#f9f9f9'
        });
        document.body.appendChild(password2);

        // random avatar key (kasneje ga lahko mapiraš na dejanske slike v /src/avatars)
        const pfps = [
            'avatar1','avatar2','avatar3','avatar4','avatar5',
            'avatar6','avatar7','avatar8','avatar9','avatar10','avatar11'
        ];

        const buttonWidth = 200 * ui;
        const buttonHeight = 45 * ui;
        const cornerRadius = 10 * ui;
        const buttonY = panelY + 280 * ui;
        const rectX = width / 2;

        const registerButtonBg = this.add.graphics();
        registerButtonBg.fillStyle(0x28a745, 1);
        registerButtonBg.fillRoundedRect(
            rectX - buttonWidth / 2,
            buttonY - buttonHeight / 2,
            buttonWidth,
            buttonHeight,
            cornerRadius
        );

        const registerButton = this.add.text(rectX, buttonY, '✅ Ustvari račun', {
            fontFamily: 'Arial',
            fontSize: `${Math.round(22 * ui)}px`,
            color: '#ffffff'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                registerButtonBg.clear();
                registerButtonBg.fillStyle(0x1e7e34, 1);
                registerButtonBg.fillRoundedRect(
                    rectX - buttonWidth / 2,
                    buttonY - buttonHeight / 2,
                    buttonWidth,
                    buttonHeight,
                    cornerRadius
                );
            })
            .on('pointerout', () => {
                registerButtonBg.clear();
                registerButtonBg.fillStyle(0x28a745, 1);
                registerButtonBg.fillRoundedRect(
                    rectX - buttonWidth / 2,
                    buttonY - buttonHeight / 2,
                    buttonWidth,
                    buttonHeight,
                    cornerRadius
                );
            })
            .on('pointerdown', async () => {
                const u = username.value.trim();
                const p1 = password.value.trim();
                const p2 = password2.value.trim();

                if (!u || !p1 || !p2) {
                    alert('Uporabniško ime in geslo sta obvezna.');
                    return;
                }

                if (p1 !== p2) {
                    alert('Gesli se ne ujemata!');
                    return;
                }

                const pfpKey = pfps[Math.floor(Math.random() * pfps.length)];
                const avatarKey = pfpKey;

                try {
                    const res = await fetch('/api/users/register', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        username: u,
                        password: p1,
                        avatarPath: avatarKey
                      })
                    });
                  
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      alert(err.message || 'Napaka pri registraciji.');
                      return;
                    }
                  
                    const user = await res.json();
                  
                    localStorage.setItem('userId', user._id);
                    localStorage.setItem('username', user.username);
                    localStorage.setItem('profilePic', avatarKey);
                  
                    username.remove();
                    password.remove();
                    password2.remove();
                  
                    this.scene.start('LabScene');
                  } catch (error) {
                    console.error(error);
                    alert('Napaka pri povezavi s strežnikom.');
                  }
            });

        // gumb nazaj na login
        const backButton = this.add.text(40, 30, '↩ Nazaj na prijavo', {
            fontFamily: 'Arial',
            fontSize: `${Math.round(20 * ui)}px`,
            color: '#0066ff',
        })
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => backButton.setStyle({ color: '#0044cc' }))
            .on('pointerout', () => backButton.setStyle({ color: '#0066ff' }))
            .on('pointerdown', () => {
                username.remove();
                password.remove();
                password2.remove();
                this.scene.start('LoginScene');
            });

        // čiščenje DOM elementov ob shutdownu
        this.events.once('shutdown', () => {
            username.remove();
            password.remove();
            password2.remove();
        });

        attachResize(this, () => {
            username.remove();
            password.remove();
            password2.remove();
            this.scene.restart();
        });
    }
}
