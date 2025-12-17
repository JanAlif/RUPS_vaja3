import Phaser from 'phaser';

export default class ScoreboardScene extends Phaser.Scene {
    constructor() {
        super('ScoreboardScene');
    }

    init(data) {
        this.cameFromMenu = data?.cameFromMenu || false;
        this.previousScene =
            data?.previousScene ||
            localStorage.getItem('lastScene') ||
            'LabScene';
    }

    preload() {
        // avatarji
        for (let i = 1; i <= 14; i++) {
            this.load.image(`avatar${i}`, `src/avatars/avatar${i}.png`);
        }
    }

    create() {
        const { width, height } = this.scale;
        const uiScale = Phaser.Math.Clamp(
            Math.min(width / 1280, height / 720),
            0.65,
            1.1
        );
        const safeMargin = 32 * uiScale;
        const floorHeight = Math.max(90, Math.min(150 * uiScale, height * 0.25));

        // ozadje
        this.add.rectangle(0, 0, width, height - floorHeight, 0xe8e8e8).setOrigin(0);
        this.add.rectangle(0, height - floorHeight, width, floorHeight, 0xd4c4a8).setOrigin(0);

        // miza
        const tableX = width / 2;
        const tableY = height / 2 + floorHeight / 2.5;
        const tableWidth = Math.min(680 * uiScale, width - safeMargin * 2);
        const tableHeight = Math.max(
            220 * uiScale,
            Math.min(320 * uiScale, height * 0.45)
        );

        this.add.rectangle(tableX, tableY, tableWidth, 30, 0x8b4513).setOrigin(0.5);
        const surface = this.add.rectangle(
            tableX,
            tableY + 15,
            tableWidth - 30 * uiScale,
            tableHeight - 30 * uiScale,
            0xa0826d
        ).setOrigin(0.5, 0);

        // mreža
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x8b7355, 0.3);
        const gridSize = 30 * uiScale;
        const gridStartX = tableX - (tableWidth - 30 * uiScale) / 2;
        const gridStartY = tableY + 15;
        const gridEndX = tableX + (tableWidth - 30 * uiScale) / 2;
        const gridEndY = tableY + 15 + (tableHeight - 30 * uiScale);

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

        // nogice mize
        const legWidth = 20;
        const legHeight = 120 * uiScale;
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

        // okvir
        const panelWidth = Math.min(720 * uiScale, width - safeMargin * 2);
        const panelHeight = Math.min(
            480 * uiScale,
            height - floorHeight - safeMargin * 1.5
        );
        const panelX = (width - panelWidth) / 2;
        const panelY = Math.max(
            safeMargin,
            (height - floorHeight - panelHeight) / 2 - 10 * uiScale
        );

        const panel = this.add.graphics();
        panel.fillStyle(0xffffff, 0.92);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 25);
        panel.lineStyle(3, 0xcccccc, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 25);

        // naslov
        this.add.text(width / 2, panelY + 35 * uiScale, 'LESTVICA', {
            fontFamily: 'Arial',
            fontSize: `${Math.round(Math.max(26, 36 * uiScale))}px`,
            fontStyle: 'bold',
            color: '#222'
        }).setOrigin(0.5);

        // trenutno prijavljen user (za highlight)
        const loggedUsername = localStorage.getItem('username');

        // "Nalagam..." tekst
        const loadingText = this.add.text(
            panelX + panelWidth / 2,
            panelY + panelHeight / 2 - 60 * uiScale,
            'Nalagam lestvico...',
            {
                fontFamily: 'Arial',
                fontSize: `${Math.round(Math.max(16, 20 * uiScale))}px`,
                color: '#666'
            }
        ).setOrigin(0.5);

        // naloži leaderboard iz backenda
        const leaderboardLayout = {
            panelX,
            panelY,
            panelWidth,
            rowStartY: panelY + 90 * uiScale,
            rowGap: Math.max(26, 34 * uiScale),
            avatarX: panelX + 60 * uiScale,
            rankX: panelX + 100 * uiScale,
            nameX: panelX + 150 * uiScale,
            scoreX: panelX + panelWidth - 80 * uiScale,
            avatarSize: Math.max(32, 40 * uiScale),
            fontSize: Math.round(Math.max(18, 22 * uiScale))
        };
        this.loadLeaderboard(leaderboardLayout, loggedUsername, loadingText);

        // ESC tipka
        this.input.keyboard.on('keydown-ESC', () => {
            this.navigateBack();
        });

        // gumb nazaj
        const backButton = this.add.text(
            panelX + 20 * uiScale,
            panelY + 20 * uiScale,
            '↩ Nazaj',
            {
                fontFamily: 'Arial',
                fontSize: `${Math.round(Math.max(18, 22 * uiScale))}px`,
                color: '#0066ff',
                padding: { x: 16 * uiScale, y: 8 * uiScale }
            }
        )
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => backButton.setStyle({ color: '#0044cc' }))
            .on('pointerout', () => backButton.setStyle({ color: '#0066ff' }))
            .on('pointerdown', () => {
                this.navigateBack();
            });

        // re-render on resize for responsiveness
        this.scale.on('resize', this.handleResize, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.handleResize, this);
        });
    }

    navigateBack() {
        if (this.previousScene) {
            this.scene.start(this.previousScene, {
                cameFromMenu: this.previousScene === 'LabScene'
            });
            return;
        }

        this.scene.start('LabScene');
    }

    handleResize() {
    if (this._resizeTimer) {
        clearTimeout(this._resizeTimer);
    }

    this._resizeTimer = setTimeout(() => {
        this.scene.restart({
            cameFromMenu: this.cameFromMenu,
            previousScene: this.previousScene
        });
    }, 30);
}

    loadLeaderboard(layout, loggedUsername, loadingText) {
        fetch('/api/users/leaderboard')
            .then(res => {
                if (!res.ok) {
                    throw new Error('Napaka pri fetchu leaderboarda');
                }
                return res.json();
            })
            .then(users => {
                loadingText.destroy(); // odstranimo "Nalagam..."

                if (!Array.isArray(users) || users.length === 0) {
                    this.add.text(
                        layout.panelX + layout.panelWidth / 2,
                        layout.rowStartY,
                        'Ni še rezultatov.',
                        {
                            fontFamily: 'Arial',
                            fontSize: `${layout.fontSize}px`,
                            color: '#666'
                        }
                    ).setOrigin(0.5);
                    return;
                }

                users.forEach((user, index) => {
                    const y = layout.rowStartY + index * layout.rowGap;
                    const rank = index + 1;

                    const avatarKey = user.avatarPath || 'avatar1';

                    // avatar
                    this.add.image(layout.avatarX, y + layout.avatarSize / 2, avatarKey)
                        .setDisplaySize(layout.avatarSize, layout.avatarSize)
                        .setOrigin(0.5);

                    // mesto
                    this.add.text(layout.rankX, y + 3, `${rank}.`, {
                        fontSize: `${layout.fontSize}px`,
                        color: '#444'
                    });

                    // ime (highlight, če je prijavljen user)
                    const style = (user.username === loggedUsername)
                        ? {
                            fontSize: `${layout.fontSize}px`,
                            color: '#0f5cad',
                            fontStyle: 'bold'
                        }
                        : { fontSize: `${layout.fontSize}px`, color: '#222' };

                    this.add.text(layout.nameX, y + 3, user.username, style);

                    // točke (uporabimo highScore)
                    this.add.text(layout.scoreX, y + 3, `${user.highScore ?? 0}`, {
                        fontSize: `${layout.fontSize}px`,
                        color: '#0044cc'
                    }).setOrigin(1, 0);
                });
            })
            .catch(err => {
                console.error(err);
                loadingText.setText('Napaka pri nalaganju lestvice.');
            });
    }
}
