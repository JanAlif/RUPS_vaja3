import './style.css'
import Phaser from 'phaser';

// uvoz scen
import UIScene from './scenes/UIScene';
import PreloadScene from './scenes/preloadScene';
import MenuScene from './scenes/menuScene';
import LabScene from './scenes/labScene';
import TestScene from './scenes/testScene';
import LoginScene from './scenes/loginScene';
import ScoreboardScene from './scenes/scoreboardScene';
import WorkspaceScene from './scenes/workspaceScene';
import RegisterScene from './scenes/RegisterScene';
import BootScene from './scenes/BootScene';
import ProfileScene from './scenes/profileScene';
import ExampleScene from './scenes/examplesScene';

const config = {
  type: Phaser.AUTO,       
  roundPixels: true,     
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#f4f6fa',    
  parent: 'game-container',    
  dom: {
        createContainer: true
    },  
  scene: [
    // uvoz scen
    BootScene,
    MenuScene,
    LabScene,
    WorkspaceScene,
    PreloadScene,
    UIScene,
    TestScene,
    LoginScene,
    ScoreboardScene,
    RegisterScene,
    ProfileScene,
    ExampleScene
  ],
  physics: {
    default: 'arcade',           
    arcade: {
      gravity: { y: 0 },         
      debug: false               
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    resolution: window.devicePixelRatio,
  }
};

// inicializacija igre
const game = new Phaser.Game(config);

export default game;