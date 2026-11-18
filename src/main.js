import './style.css';
import { GameEngine } from './core/GameEngine.js';
import { AIController } from './core/AIController.js';
import { enqueueEventsAndRender } from './core/eventPlayer.js';
import { createPhaserBoard } from './phaser/createPhaserGame.js';
import { UIManager } from './ui/UIManager.js';
import { NetworkAdapter } from './network/NetworkAdapter.js';

const overlayRoot = document.getElementById('dom-ui-overlay');

let engine = null;
let network = null;
let uiManager = null;

// 1. Khởi tạo bàn cờ Phaser 3 (1040x1040)
const { boardScene } = createPhaserBoard('phaser-board-canvas', (tileIndex) => {
  uiManager?.openTileInspect(tileIndex);
});

// 2. Bộ điều khiển AI chạy phía Host
const aiController = new AIController((aiPlayerId, action, payload) => {
  if (network?.isHost && engine) {
    engine.handleAction(aiPlayerId, action, payload);
  }
});

// 3. Khởi tạo NetworkAdapter kết nối với Event Player
network = new NetworkAdapter(
  async (events, finalState) => {
    await enqueueEventsAndRender(events, finalState, boardScene, uiManager);
    if (network.isHost) {
      aiController.evaluate(finalState);
    }
  },
  (playerId, action, payload) => {
    if (engine) {
      engine.handleAction(playerId, action, payload);
    }
  },
  (ctx) => {
    if (engine && ctx.roomId) engine.state.roomId = ctx.roomId;
    uiManager?.setNetworkContext(ctx);
  }
);

// 4. Khởi tạo Lớp phủ Giao diện HTML/Tailwind
uiManager = new UIManager(overlayRoot, {
  isFirebaseAvailable: () => network.isFirebaseReady(),
  onToggleSound: () => {
    boardScene.soundEnabled = !boardScene.soundEnabled;
    return boardScene.soundEnabled;
  },
  onSetupGame: ({ action, netType, roomCode, playerName }) => {
    if (action === 'CREATE') {
      engine = new GameEngine('PENDING', 'CLASSIC');
      engine.onBroadcast = (events, snapshot) => {
        network.broadcastState(events, snapshot);
      };
    } else {
      engine = null; // Máy khách (Client) chỉ nhận trạng thái từ Host
    }

    network.setup({
      action,
      netType,
      roomCode,
      playerName,
      initialState: engine ? engine.getSnapshot() : null
    });
  },
  onAction: (actionType, payload, explicitPlayerId) => {
    network.sendAction(actionType, payload, explicitPlayerId);
  }
});
