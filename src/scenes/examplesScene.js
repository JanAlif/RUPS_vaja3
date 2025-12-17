// src/scenes/ExamplesScene.js
import Phaser from 'phaser';
import { getUiScale, attachResize } from '../utils/uiScale';

export default class ExamplesScene extends Phaser.Scene {
  constructor() {
    super('ExamplesScene');
  }

  preload() {
    // iste slike kot v WorkspaceScene
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

    // ----------------- OZADJE + MREŽA -----------------
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xf5f7ff, 0xe8f0ff, 0xf8fbff, 0xeff3ff);
    bg.fillRect(0, 0, width, height);

    const surfaceMargin = Math.max(180 * ui, width * 0.14);
    const verticalMargin = Math.max(20 * ui, height * 0.03);

    const deskPanel = this.add.graphics();
    deskPanel.fillStyle(0xffffff, 0.95);
    deskPanel.fillRoundedRect(
      surfaceMargin,
      verticalMargin,
      width - surfaceMargin - 30,
      height - verticalMargin * 2,
      18 * ui
    );
    deskPanel.lineStyle(2, 0xdfe6f3);
    deskPanel.strokeRoundedRect(
      surfaceMargin,
      verticalMargin,
      width - surfaceMargin - 30,
      height - verticalMargin * 2,
      18 * ui
    );

    // mreža
    const grid = this.add.graphics();
    const gridSize = 40 * ui;
    grid.lineStyle(1, 0x8ba0c6, 0.22);

    for (let x = surfaceMargin + 10; x < width - 30; x += gridSize) {
      grid.beginPath();
      grid.moveTo(x, verticalMargin + 20);
      grid.lineTo(x, height - 40);
      grid.strokePath();
    }
    for (let y = verticalMargin + 20; y < height - 40; y += gridSize) {
      grid.beginPath();
      grid.moveTo(surfaceMargin + 10, y);
      grid.lineTo(width - 30, y);
      grid.strokePath();
    }

    // ----------------- LEVI PANEL -----------------
    const panelWidth = Math.max(200 * ui, width * 0.15);
    const sidebar = this.add.graphics();
    sidebar.fillStyle(0x0f172a, 0.95);
    sidebar.fillRect(0, 0, panelWidth, height);

    this.add.text(panelWidth / 2, 50 * ui, 'Primeri krogov', {
      fontSize: `${Math.round(20 * ui)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // ----------------- CENTER – “WORKSPACE” -----------------
    const centerX = (width + panelWidth) / 2;
    const centerY = height / 2;

    // razmik med centri komponent – ~enako kot v Workspace (2× gridSize)
    const GRID = 80 * ui;

    // helper – koordinate v "mrežnih enotah" -> pixli
    const pos = (cx, cy) => ({
      x: centerX + cx * GRID,
      y: centerY + cy * GRID,
    });

    // ----------------- DEFINICIJE PRIMEROV -----------------
    this.examples = [
      {
        id: 'simple-series',
        title: 'Serijski krog z žarnico',
        description: 'Preprost serijski krog z eno baterijo, stikalom in žarnico.',
        components: [
          // zgornja veja
          { type: 'baterija',   ...pos(-1.5, -0.5), angle: 0 },
          { type: 'žica',       ...pos(-0.5, -0.5), angle: 0 },
          { type: 'stikalo-on', ...pos( 0.5, -0.5), angle: 0 },
    
          // desna vertikala
          { type: 'žica',       ...pos( 1.0,  0.0), angle: 90 },
    
          // spodnja veja
          { type: 'žica',       ...pos( 0.5,  0.5), angle: 0 },
          { type: 'svetilka',   ...pos(-0.5,  0.5), angle: 0 },
          { type: 'žica',       ...pos(-1.5,  0.5), angle: 0 },
    
          // leva vertikala
          { type: 'žica',       ...pos(-2.0,  0.0), angle: 90 },
        ],
      },
    
      {
        id: 'series-resistor',
        title: 'Serijski krog z uporom',
        description: 'Baterija, upor in žarnica v seriji – upor omejuje tok, žarnica sveti manj močno.',
        components: [
          // zgornja veja
          { type: 'baterija', ...pos(-1.5, -0.5), angle: 0 },
          { type: 'žica',     ...pos(-0.5, -0.5), angle: 0 },
          { type: 'upor',     ...pos( 0.5, -0.5), angle: 0 },
    
          // desna vertikala
          { type: 'žica',     ...pos( 1.0,  0.0), angle: 90 },
    
          // spodnja veja
          { type: 'žica',     ...pos( 0.5,  0.5), angle: 0 },
          { type: 'svetilka', ...pos(-0.5,  0.5), angle: 0 },
          { type: 'žica',     ...pos(-1.5,  0.5), angle: 0 },
    
          // leva vertikala
          { type: 'žica',     ...pos(-2.0,  0.0), angle: 90 },
        ],
      },
    
      {
        id: 'open-switch',
        title: 'Odprt krog (stikalo izklopljeno)',
        description: 'Stikalo v zgornji veji je odprto – električni tok je prekinjen in žarnica ne sveti.',
        components: [
          // zgornja veja
          { type: 'baterija',    ...pos(-1.5, -0.5), angle: 0 },
          { type: 'žica',        ...pos(-0.5, -0.5), angle: 0 },
          { type: 'stikalo-off', ...pos( 0.5, -0.5), angle: 0 },
    
          // desna vertikala
          { type: 'žica',        ...pos( 1.0,  0.0), angle: 90 },
    
          // spodnja veja
          { type: 'žica',        ...pos( 0.5,  0.5), angle: 0 },
          { type: 'svetilka',    ...pos(-0.5,  0.5), angle: 0 },
          { type: 'žica',        ...pos(-1.5,  0.5), angle: 0 },
    
          // leva vertikala
          { type: 'žica',        ...pos(-2.0,  0.0), angle: 90 },
        ],
      },
    
      {
        id: 'measurement',
        title: 'Merjenje toka in napetosti',
        description: 'Amper meter je v seriji v glavni veji, voltmeter pa je priključen vzporedno na žarnico.',
        components: [
          // ZGORNJA GLAVNA VEJA: baterija – žica – A – žica
          { type: 'baterija',   ...pos(-1.5, -0.5), angle: 0 },
          { type: 'žica',       ...pos(-0.5, -0.5), angle: 0 },
          { type: 'ampermeter', ...pos( 0.5, -0.5), angle: 0 },
          { type: 'žica',       ...pos( 1.5, -0.5), angle: 0 },
      
          // desna vertikala navzdol (zaključek pravokotnika)
          { type: 'žica',       ...pos( 2.0,  0.0), angle: 90 },
          { type: 'žica',       ...pos( 2.0,  1.0), angle: 90 },
      
          // SPODNJA VEJA: žica – žarnica – žica
          { type: 'žica',       ...pos( 1.5,  1.5), angle: 0 },
          { type: 'svetilka',   ...pos( 0.5,  1.5), angle: 0 },
          { type: 'žica',       ...pos(-0.5,  1.5), angle: 0 },
          { type: 'žica',       ...pos(-1.5,  1.5), angle: 0 },
      
          // leva vertikala gor
          { type: 'žica',       ...pos(-2.0,  0.0), angle: 90 },
          { type: 'žica',       ...pos(-2.0,  1.0), angle: 90 },
      
          // VEJA ZA VOLTMETER – vzporedno na žarnico
          // navpična žica skozi isti vozel kot žarnica, voltmeter v tem “mostu”
          { type: 'žica',       ...pos( 0.5,  0.0), angle: 90 },
          { type: 'voltmeter',  ...pos( 0.5,  1.0), angle: 90 },
        ],
      },
    
      {
        id: 'parallel-lamps',
        title: 'Vzporedna vezava dveh žarnic',
        description: 'Dve žarnici sta vezani vzporedno. Na vsaki žarnici je enaka napetost, tok se razdeli po vejah.',
        components: [
          // zgornja glavna veja: baterija – žica – stikalo – žica – žica
          { type: 'baterija',   ...pos(-2.0, -0.5), angle: 0 },
          { type: 'žica',       ...pos(-1.0, -0.5), angle: 0 },
          { type: 'stikalo-on', ...pos( 0.0, -0.5), angle: 0 },
          { type: 'žica',       ...pos( 1.0, -0.5), angle: 0 },
          { type: 'žica',       ...pos( 2.0, -0.5), angle: 0 },
    
          // desna vertikala dol (zaključek pravokotnika)
          { type: 'žica',       ...pos( 2.5,  0.0), angle: 90 },
    
          // spodnja glavna veja (daljša žica, sestavljena iz dveh)
          { type: 'žica',       ...pos( 1.0,  0.5), angle: 0 },
          { type: 'žica',       ...pos(-1.0,  0.5), angle: 0 },
          { type: 'žica',       ...pos(-2.0,  0.5), angle: 0 },
          { type: 'žica',       ...pos(2.0,  0.5), angle: 0 },
    
          // leva vertikala gor
          { type: 'žica',       ...pos(-2.5,  0.0), angle: 90 },
    
          // leva vzporedna veja: žarnica v “stebru”
          { type: 'žica',       ...pos(-0.5,  0.0), angle: 90 },
          { type: 'svetilka',   ...pos(-0.5,  0.0), angle: 90 },
    
          // desna vzporedna veja: druga žarnica v “stebru”
          { type: 'žica',       ...pos( 0.5,  0.0), angle: 90 },
          { type: 'svetilka',   ...pos( 0.5,  0.0), angle: 90 },
        ],
      },
    ];

    this.currentComponents = [];

    // ----------------- NASLOV + OPIS -----------------
    this.exampleTitle = this.add.text(
      surfaceMargin + 40,
      verticalMargin + 10,
      '',
      {
        fontSize: `${Math.round(24 * ui)}px`,
        fontStyle: 'bold',
        color: '#0f172a',
      }
    );

    this.exampleDescription = this.add.text(
      surfaceMargin + 40,
      verticalMargin + 55,
      '',
      {
        fontSize: `${Math.round(16 * ui)}px`,
        color: '#4b5563',
        wordWrap: { width: width - surfaceMargin - 80 },
      }
    );

    // ----------------- RENDERER (isto sprite kot v Workspace) -----------------
    const placeComponent = ({ type, x, y, angle = 0 }) => {
      const size =
        type === 'baterija' ? 130 * ui : 100 * ui; // enako kot v Workspace

      const img = this.add
        .image(x, y, type)
        .setOrigin(0.5)
        .setDisplaySize(size, size);

      img.setAngle(angle);
      return img;
    };

    this.showExample = (example) => {
      this.currentComponents.forEach((c) => c.destroy());
      this.currentComponents = [];

      this.exampleTitle.setText(example.title);
      this.exampleDescription.setText(example.description);

      example.components.forEach((cfg) => {
        const sprite = placeComponent(cfg);
        this.currentComponents.push(sprite);
      });
    };

    // ----------------- LEVI GUMBI -----------------
    const buttonYStart = 110 * ui;
    const buttonHeight = 52 * ui;
    const buttonGap = 64 * ui;

    this.examples.forEach((example, i) => {
      const by = buttonYStart + i * buttonGap;
      const bx = panelWidth / 2;

      const bgBtn = this.add.graphics();
      bgBtn.fillStyle(0x1f2937, 1);
      bgBtn.fillRoundedRect(
        bx - (panelWidth - 40) / 2,
        by - buttonHeight / 2,
        panelWidth - 40,
        buttonHeight,
        10 * ui
      );

      this.add.text(bx, by, example.title, {
        color: '#ffffff',
        fontSize: `${Math.round(15 * ui)}px`,
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      }).setOrigin(0.5);

      this.add
        .zone(bx, by, panelWidth - 40, buttonHeight)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          bgBtn.clear();
          bgBtn.fillStyle(0x374151, 1);
          bgBtn.fillRoundedRect(
            bx - (panelWidth - 40) / 2,
            by - buttonHeight / 2,
            panelWidth - 40,
            buttonHeight,
            10 * ui
          );
        })
        .on('pointerout', () => {
          bgBtn.clear();
          bgBtn.fillStyle(0x1f2937, 1);
          bgBtn.fillRoundedRect(
            bx - (panelWidth - 40) / 2,
            by - buttonHeight / 2,
            panelWidth - 40,
            buttonHeight,
            10 * ui
          );
        })
        .on('pointerdown', () => this.showExample(example));
    });

    // privzeti primer
    this.showExample(this.examples[0]);

    // nazaj
    this.add
      .text(16, 14, '↩ Nazaj v laboratorij', {
        fontSize: `${Math.round(18 * ui)}px`,
        color: '#8ab4ff',
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('LabScene'));

    attachResize(this, () => this.scene.restart());
  }
}