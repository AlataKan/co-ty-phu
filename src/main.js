import './style.css';
import { GameEngine } from './core/GameEngine.js';
import { AIController } from './core/AIController.js';
import { enqueueEventsAndRender } from './core/eventPlayer.js';
import { createBoard3D } from './board/Board3DScene.js';
import { UIManager } from './ui/UIManager.js';
import { NetworkAdapter } from './network/NetworkAdapter.js';

const overlayRoot = document.getElementById('dom-ui-overlay');

let engine = null;
let network = null;
let uiManager = null;

// 1. Khởi tạo Sa bàn 3D Diorama trung tâm (Hỗ trợ cả 40 ô & 52 ô)
const { boardScene } = createBoard3D('board-3d-root', {
  onTileClick: (tileIndex) => {
    uiManager?.openTileInspect(tileIndex);
  },
  onDeckClick: (deckType) => {
    uiManager?.showDeckPreviewModal(deckType);
  }
});

// 2. Bộ điều khiển AI chạy phía Host
const aiController = new AIController((aiPlayerId, action, payload) => {
  if (network?.isHost && engine) {
    engine.handleAction(aiPlayerId, action, payload);
  }
});

// 3. Khởi tạo NetworkAdapter kết nối với Trình phát sự kiện tuần tự
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

// 4. Khởi tạo Hệ thống Compact HUD, Thẻ Sổ Đỏ & Event Popup
uiManager = new UIManager(overlayRoot, {
  isFirebaseAvailable: () => network.isFirebaseReady(),
  onSetCamera: (mode) => {
    boardScene.setCameraPreset(mode);
  },
  onSelectTile: (tileIndex) => {
    boardScene.setInspectedTile(tileIndex);
  },
  onPreviewBoardPreset: (boardPreset) => {
    boardScene.renderShowcasePreview(boardPreset);
  },
  onToggleSound: () => {
    boardScene.soundEnabled = !boardScene.soundEnabled;
    return boardScene.soundEnabled;
  },
  onSetupGame: ({ action, netType, roomCode, playerName, boardPreset }) => {
    if (action === 'CREATE') {
      engine = new GameEngine('PENDING', 'CLASSIC', { boardPreset: boardPreset || 'MEGA_52' });
      engine.onBroadcast = (events, snapshot) => {
        network.broadcastState(events, snapshot);
      };
    } else {
      engine = null;
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
  },
  onLeaveRoom: () => {
    const myId = uiManager?.getEffectivePlayerId() || network.myPlayerId;
    if (network.mode !== 'LOCAL' && myId && !network.isHost) {
      network.sendAction('LEAVE_ROOM', {}, myId);
    }
    clearTimeout(aiController.timer);
    engine?.clearAuctionTimer();
    engine = null;
    network.leaveRoom();
    uiManager?.resetToMenu();
  }
});
