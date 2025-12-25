import "./style.css";
import Phaser from "phaser";

// uvoz scen
import UIScene from "./scenes/UIScene";
import PreloadScene from "./scenes/preloadScene";
import MenuScene from "./scenes/menuScene";
import LabScene from "./scenes/labScene";
import TestScene from "./scenes/testScene";
import ScoreboardScene from "./scenes/scoreboardScene";
import WorkspaceScene from "./scenes/workspaceScene";
import BootScene from "./scenes/BootScene";
import ExampleScene from "./scenes/examplesScene";

// ✅ React bo klical to funkcijo
export function startRups2(parentEl) {
  if (!parentEl) throw new Error("startRups2: parentEl is required");

  const config = {
    type: Phaser.AUTO,
    roundPixels: true,

    // ✅ v Reactu raje “fill container” kot window.innerWidth/Height
    width: parentEl.clientWidth || window.innerWidth,
    height: parentEl.clientHeight || window.innerHeight,

    backgroundColor: "#f4f6fa",

    // ✅ najpomembnejše: mount v element (ne id string)
    parent: parentEl,

    dom: { createContainer: true },

    scene: [
      BootScene,
      MenuScene,
      LabScene,
      WorkspaceScene,
      PreloadScene,
      UIScene,
      TestScene,
      ScoreboardScene,
      ExampleScene,
    ],

    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 0 },
        debug: false,
      },
    },

    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      resolution: window.devicePixelRatio,
    },
  };

  const game = new Phaser.Game(config);
  return game;
}

// ✅ cleanup helper (optional, ampak priporočeno)
export function stopRups2(game) {
  if (!game) return;

  // destroy canvas + events
  game.destroy(true);

  // pobriši še morebitne ostanke v parentu
  const parent = game.canvas?.parentElement;
  if (parent) parent.innerHTML = "";
}