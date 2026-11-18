import { PeerNetworkManager } from './PeerNetworkManager.js';
import { FirebaseNetworkManager, isFirebaseConfigured } from './FirebaseNetworkManager.js';

export class NetworkAdapter {
  constructor(onStateSync, onPlayerAction, onContextUpdate) {
    this.mode = 'NONE'; // 'LOCAL' | 'PEERJS' | 'FIREBASE'
    this.driver = null;
    this.isHost = false;
    this.onStateSync = onStateSync;
    this.onPlayerAction = onPlayerAction;
    this.onContextUpdate = onContextUpdate;
  }

  isFirebaseReady() {
    return isFirebaseConfigured();
  }

  setup({ action, netType, roomCode, playerName, initialState }) {
    this.mode = netType;

    if (netType === 'LOCAL') {
      this.isHost = true;
      this.driver = null;
      this.onContextUpdate({ mode: 'LOCAL', roomId: 'LOCAL', myPlayerId: 'P1', isHost: true });
      this.onPlayerAction('P1', 'JOIN_GAME', { name: playerName, isAI: false });
      return;
    }

    if (netType === 'PEERJS') {
      this.driver = new PeerNetworkManager(
        this.onStateSync,
        this.onPlayerAction,
        (ctx) => {
          this.isHost = ctx.isHost;
          this.onContextUpdate({ mode: 'PEERJS', ...ctx });
        }
      );
      if (action === 'CREATE') this.driver.createRoom(playerName);
      else this.driver.joinRoom(roomCode, playerName);
      return;
    }

    if (netType === 'FIREBASE') {
      this.driver = new FirebaseNetworkManager(
        this.onStateSync,
        this.onPlayerAction,
        (ctx) => {
          this.isHost = ctx.isHost;
          this.onContextUpdate({ mode: 'FIREBASE', ...ctx });
        }
      );
      if (action === 'CREATE') this.driver.createRoom(playerName, initialState);
      else this.driver.joinRoom(roomCode, playerName);
    }
  }

  sendAction(actionType, payload = {}, explicitPlayerId = null) {
    if (this.mode === 'LOCAL') {
      this.onPlayerAction(explicitPlayerId || 'P1', actionType, payload);
    } else if (this.driver) {
      this.driver.sendAction(actionType, payload, explicitPlayerId);
    }
  }

  broadcastState(events, updatedGameState) {
    if (this.mode === 'LOCAL') {
      this.onStateSync(events, updatedGameState);
    } else if (this.driver) {
      this.driver.broadcastState(events, updatedGameState);
    }
  }

  leaveRoom() {
    if (this.driver) {
      this.driver.disconnect?.();
      this.driver = null;
    }
    this.mode = 'NONE';
    this.isHost = false;
    this.onContextUpdate({ mode: 'NONE', roomId: null, myPlayerId: null, isHost: false });
  }
}
