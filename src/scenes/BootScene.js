// src/scenes/BootScene.js
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // preberi zadnjo sceno iz localStorage
    const lastScene = localStorage.getItem('lastScene') || 'LabScene';

    // če je zadnja scena neka neznana vrednost, fallback na LabScene
    const validScenes = ['LabScene', 'WorkspaceScene'];
    const targetScene = validScenes.includes(lastScene) ? lastScene : 'LabScene';

    this.scene.start(targetScene);
  }
}