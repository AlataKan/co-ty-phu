import Phaser from 'phaser';
import { BOARD_SIZE } from './boardGeometry.js';
import { BoardScene } from './BoardScene.js';

export function createPhaserBoard(parentElementId, onTileClickCallback) {
  const boardScene = new BoardScene(onTileClickCallback);

  const config = {
    type: Phaser.AUTO,
    parent: parentElementId,
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    transparent: true,
    antialias: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [boardScene]
  };

  const game = new Phaser.Game(config);
  return { game, boardScene };
}
