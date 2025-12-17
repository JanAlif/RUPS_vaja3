// src/scenes/ProfileScene.js
import Phaser from 'phaser';
import { attachResize, getUiScale } from '../utils/uiScale';

export default class ProfileScene extends Phaser.Scene {
  constructor() {
    super('ProfileScene');
  }

  preload() {
    this.load.image('avatar1', 'src/avatars/avatar1.png');
    this.load.image('avatar2', 'src/avatars/avatar2.png');
    this.load.image('avatar3', 'src/avatars/avatar3.png');
    this.load.image('avatar4', 'src/avatars/avatar4.png');
    this.load.image('avatar5', 'src/avatars/avatar5.png');
    this.load.image('avatar6', 'src/avatars/avatar6.png');
    this.load.image('avatar7', 'src/avatars/avatar7.png');
    this.load.image('avatar8', 'src/avatars/avatar8.png');
    this.load.image('avatar9', 'src/avatars/avatar9.png');
    this.load.image('avatar10', 'src/avatars/avatar10.png');
    this.load.image('avatar11', 'src/avatars/avatar11.png');
    this.load.image('avatar12', 'src/avatars/avatar12.png');
    this.load.image('avatar13', 'src/avatars/avatar13.png');
    this.load.image('avatar14', 'src/avatars/avatar14.png');
  }

  async create() {
    const { width, height } = this.cameras.main;
    const ui = getUiScale(this.scale);

    // ozadje
    this.add.rectangle(0, 0, width, height, 0xe9f0ff).setOrigin(0);

    // malo večji panel
    const panelWidth = Math.min(860 * ui, width - 40);
    const panelHeight = Math.min(560 * ui, height - 60);

    this.add.rectangle(
      width / 2 + 6,
      height / 2 + 6,
      panelWidth,
      panelHeight,
      0xd0d7e6
    ).setOrigin(0.5);

    this.add.rectangle(
      width / 2,
      height / 2,
      panelWidth,
      panelHeight,
      0xffffff
    )
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xced4e0);

    // naslov
    this.add.text(width / 2, height / 2 - panelHeight / 2 + 45 * ui, 'Moj profil', {
      fontFamily: 'Arial',
      fontSize: `${Math.round(32 * ui)}px`,
      fontStyle: 'bold',
      color: '#222222'
    }).setOrigin(0.5);

    const userId = localStorage.getItem('userId');
    if (!userId) {
      this.add.text(width / 2, height / 2, 'Napaka: ni prijavljenega uporabnika.', {
        fontFamily: 'Arial',
        fontSize: `${Math.round(20 * ui)}px`,
        color: '#cc0000',
      }).setOrigin(0.5);
      return;
    }

    // levi stolpec: ime + statistika
    const leftX = width / 2 - panelWidth / 2 + 50 * ui;
    const topY = height / 2 - panelHeight / 2 + 100 * ui;

    const usernameText = this.add.text(leftX, topY, 'Uporabnik: ...', {
      fontFamily: 'Courier New',
      fontSize: `${Math.round(20 * ui)}px`,
      color: '#333333',
    });

    const statsText = this.add.text(leftX, topY + 40, 'Nalagam statistiko...', {
      fontFamily: 'Courier New',
      fontSize: `${Math.round(18 * ui)}px`,
      color: '#555555',
      lineSpacing: 6
    });

    // desno zgoraj: velik avatar
    const avatarBigX = width / 2 + panelWidth / 2 - 120 * ui;
    const avatarBigY = height / 2 - panelHeight / 2 + 130 * ui;
    const avatarRadius = 50 * ui;

    const avatarOuter = this.add.circle(
      avatarBigX,
      avatarBigY,
      avatarRadius + 5,
      0xe3e7f5
    );
    const avatarInner = this.add.circle(
      avatarBigX,
      avatarBigY,
      avatarRadius,
      0xffffff
    );
    const avatarImage = this.add.image(avatarBigX, avatarBigY, 'avatar1')
      .setDisplaySize(avatarRadius * 2, avatarRadius * 2);
    avatarImage.setMask(avatarInner.createGeometryMask());

    // user iz backenda
    let currentUser = null;
    let currentAvatarKey = 'avatar1';

    try {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error('Neuspešno branje uporabnika');
      currentUser = await res.json();

      const username = currentUser.username || localStorage.getItem('username') || 'Neznan';
      const avatarPath = currentUser.avatarPath || localStorage.getItem('profilePic') || 'avatar1';
      currentAvatarKey = avatarPath;

      usernameText.setText(`Uporabnik: ${username}`);

      const points = currentUser.points ?? 0;
      const totalPoints = currentUser.totalPoints ?? 0;
      const highScore = currentUser.highScore ?? 0;

      statsText.setText(
        `Zadnji session (points): ${points}\n` +
        `Skupne točke (totalPoints): ${totalPoints}\n` +
        `Najboljši session (highScore): ${highScore}`
      );

      avatarImage.setTexture(avatarPath);
    } catch (e) {
      console.error(e);
      statsText.setText('Napaka pri nalaganju podatkov o profilu.');
    }

    // ---- gumbi za ime/geslo (pod statistiko) ----
    const buttonsY = topY + 150 * ui;

    const makeButton = (x, y, w, label, bgColor, hoverColor, textColor, onClick) => {
      const bg = this.add.rectangle(x, y, w, 42 * ui, bgColor)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, 0x444444);
      this.add.text(x + w / 2, y, label, {
        fontFamily: 'Arial',
        fontSize: `${Math.round(18 * ui)}px`,
        color: textColor,
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(hoverColor))
        .on('pointerout', () => bg.setFillStyle(bgColor))
        .on('pointerdown', onClick);
      return bg;
    };

    // Spremeni ime
    makeButton(
      leftX,
      buttonsY,
      190 * ui,
      'Spremeni ime',
      0x3399ff,
      0x1f6fcc,
      '#ffffff',
      async () => {
        const newName = prompt('Vnesi novo uporabniško ime:');
        if (!newName) return;

        try {
          const res = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: newName }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert('Napaka pri posodobitvi imena: ' + (err.message || res.status));
            return;
          }
          const updated = await res.json();
          usernameText.setText(`Uporabnik: ${updated.username}`);
          localStorage.setItem('username', updated.username);
          alert('Uporabniško ime je posodobljeno.');
        } catch (e) {
          console.error(e);
          alert('Napaka pri povezavi s strežnikom.');
        }
      }
    );

    // Spremeni geslo – odpre modal z password inputi
    makeButton(
      leftX,
      buttonsY + 55,
      210 * ui,
      'Spremeni geslo',
      0x666666,
      0x444444,
      '#ffffff',
      () => {
        this.openPasswordModal(userId);
      }
    );

    // Nazaj
    const backY = height / 2 + panelHeight / 2 - 40 * ui;
    const backBg = this.add.rectangle(leftX, backY, 150 * ui, 42 * ui, 0xf4f4f4)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0xcccccc);
    this.add.text(backBg.x + backBg.width / 2, backY, 'Nazaj', {
      fontFamily: 'Arial',
      fontSize: `${Math.round(18 * ui)}px`,
      color: '#333333',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBg.setFillStyle(0xe5e5e5))
      .on('pointerout', () => backBg.setFillStyle(0xf4f4f4))
      .on('pointerdown', () => {
        this.scene.start('LabScene');
      });

    // ---- izbor avatarja: spodaj, centriran ----
    this.add.text(
      width / 2,
      height / 2 + panelHeight / 2 - 150 * ui,
      'Izberi avatar:',
      {
        fontFamily: 'Arial',
        fontSize: `${Math.round(18 * ui)}px`,
        color: '#333333',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);

    const avatarKeys = [
      'avatar1','avatar2','avatar3','avatar4','avatar5',
      'avatar6','avatar7','avatar8','avatar9','avatar10',
      'avatar11','avatar12','avatar13','avatar14'
    ];

    const gridCenterY = height / 2 + panelHeight / 2 - 70 * ui;
    const spacingX = 60 * ui;
    const spacingY = 60 * ui;
    const cols = 7;

    const totalWidth = (cols - 1) * spacingX;
    const gridStartX = width / 2 - totalWidth / 2;

    const selectedBorderColor = 0x3399ff;
    const avatarCircles = {};

    avatarKeys.forEach((key, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = gridStartX + col * spacingX;
      const y = gridCenterY + (row - 0.5) * spacingY; // malo gor/dol

      const circleBg = this.add.circle(x, y, 24 * ui, 0xeeeeee)
        .setStrokeStyle(1, 0xcccccc);
      const img = this.add.image(x, y, key).setDisplaySize(40 * ui, 40 * ui);

      avatarCircles[key] = circleBg;

      if (key === currentAvatarKey) {
        circleBg.setStrokeStyle(3, selectedBorderColor);
      }

      img.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (key !== currentAvatarKey) circleBg.setFillStyle(0xe0e0e0);
        })
        .on('pointerout', () => {
          if (key !== currentAvatarKey) circleBg.setFillStyle(0xeeeeee);
        })
        .on('pointerdown', async () => {
          try {
            const res = await fetch(`/api/users/${userId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ avatarPath: key }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              alert('Napaka pri posodobitvi avatarja: ' + (err.message || res.status));
              return;
            }
            const updated = await res.json();
            currentAvatarKey = updated.avatarPath;

            avatarImage.setTexture(updated.avatarPath);
            localStorage.setItem('profilePic', updated.avatarPath);

            Object.entries(avatarCircles).forEach(([k, circle]) => {
              if (k === currentAvatarKey) {
                circle.setStrokeStyle(3, selectedBorderColor);
                circle.setFillStyle(0xeeeeee);
              } else {
                circle.setStrokeStyle(1, 0xcccccc);
                circle.setFillStyle(0xeeeeee);
              }
            });
          } catch (e) {
            console.error(e);
            alert('Napaka pri povezavi s strežnikom.');
          }
        });
    });

    attachResize(this, () => this.scene.restart());
  }

  // ---- modal za spremembo gesla z "password" inputi ----
  openPasswordModal(userId) {
    // overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const box = document.createElement('div');
    box.style.background = '#ffffff';
    box.style.borderRadius = '8px';
    box.style.padding = '20px 24px';
    box.style.minWidth = '320px';
    box.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    box.style.fontFamily = 'Arial, sans-serif';
    box.style.color = '#222';

    box.innerHTML = `
      <h3 style="margin-top:0;margin-bottom:12px;font-size:20px;">Spremeni geslo</h3>
      <label style="display:block;margin-bottom:8px;font-size:14px;">
        Staro geslo:
        <input id="oldPass" type="password" style="width:100%;padding:6px 8px;margin-top:4px;">
      </label>
      <label style="display:block;margin-bottom:12px;font-size:14px;">
        Novo geslo:
        <input id="newPass" type="password" style="width:100%;padding:6px 8px;margin-top:4px;">
      </label>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
        <button id="cancelBtn" style="padding:6px 14px;border:1px solid #ccc;background:#f4f4f4;cursor:pointer;">Prekliči</button>
        <button id="okBtn" style="padding:6px 14px;border:1px solid #1f6fcc;background:#3399ff;color:white;cursor:pointer;">Shrani</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const oldPassInput = box.querySelector('#oldPass');
    const newPassInput = box.querySelector('#newPass');
    const cancelBtn = box.querySelector('#cancelBtn');
    const okBtn = box.querySelector('#okBtn');

    const close = () => {
      document.body.removeChild(overlay);
    };

    cancelBtn.addEventListener('click', () => {
      close();
    });

    okBtn.addEventListener('click', async () => {
      const oldPassword = oldPassInput.value;
      const newPassword = newPassInput.value;

      if (!oldPassword || !newPassword) {
        alert('Vnesi staro in novo geslo.');
        return;
      }

      try {
        const res = await fetch(`/api/users/${userId}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPassword, newPassword }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          alert('Napaka pri spremembi gesla: ' + (data.message || res.status));
          return;
        }
        alert(data.message || 'Geslo uspešno posodobljeno.');
        close();
      } catch (e) {
        console.error(e);
        alert('Napaka pri povezavi s strežnikom.');
      }
    });
  }
}
