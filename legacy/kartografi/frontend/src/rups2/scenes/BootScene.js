// src/scenes/BootScene.js
import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    const lastScene = localStorage.getItem("lastScene") || "LabScene";

    // dodaj sem vse scene, ki jih realno shranjuješ v lastScene
    const validScenes = ["LabScene", "WorkspaceScene", "ExamplesScene", "ScoreboardScene"];
    const targetScene = validScenes.includes(lastScene) ? lastScene : "LabScene";

    this.scene.start(targetScene);
  }
}