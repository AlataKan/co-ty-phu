import Peer from 'peerjs';

const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
};

export class PeerNetworkManager {
  constructor(onStateSyncCallback, onPlayerActionCallback, onReadyCallback, onErrorCallback) {
    this.peer = null;
    this.isHost = false;
    this.roomId = null;
    this.myPlayerId = null;
    this.connections = new Map();
    this.hostConnection = null;
    this.onStateSync = onStateSyncCallback;
    this.onPlayerAction = onPlayerActionCallback;
    this.onReady = onReadyCallback || (() => {});
    this.onError = onErrorCallback || ((msg) => alert(msg));
  }

  createRoom(playerName) {
    this.isHost = true;
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    this.roomId = `VN-${randomCode}`;
    this.myPlayerId = 'P1';

    this.peer = new Peer(this.roomId, PEER_CONFIG);

    this.peer.on('open', (id) => {
      this.onReady({ roomId: id, myPlayerId: 'P1', isHost: true });
      this.onPlayerAction('P1', 'JOIN_GAME', { name: playerName, isAI: false });
    });

    this.peer.on('error', (err) => {
      this.onError(`Lỗi kết nối PeerJS: ${err.type || err.message}`);
    });

    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (this.connections.size >= 3) {
          conn.send({ type: 'ERROR', message: 'Phòng đã đủ 4 người!' });
          setTimeout(() => conn.close(), 500);
          return;
        }

        const slots = ['P2', 'P3', 'P4'];
        const assignedId = slots.find(id => !this.connections.has(id)) || `P${this.connections.size + 2}`;
        this.connections.set(assignedId, conn);

        conn.on('data', (data) => {
          if (data && data.type === 'ACTION') {
            this.onPlayerAction(assignedId, data.action, data.payload);
          }
        });

        conn.on('close', () => {
          this.connections.delete(assignedId);
        });
      });
    });
  }

  joinRoom(roomCode, playerName) {
    this.isHost = false;
    this.roomId = roomCode.trim().toUpperCase();
    this.peer = new Peer(undefined, PEER_CONFIG);

    this.peer.on('open', () => {
      this.hostConnection = this.peer.connect(this.roomId, { reliable: true });

      this.hostConnection.on('open', () => {
        this.sendAction('JOIN_GAME', { name: playerName });
      });

      this.hostConnection.on('data', (data) => {
        if (!data) return;
        if (data.type === 'ERROR') {
          this.onError(data.message);
          return;
        }
        if (data.type === 'SYNC_STATE') {
          if (data.assignedId && !this.myPlayerId) {
            this.myPlayerId = data.assignedId;
            this.onReady({ roomId: this.roomId, myPlayerId: this.myPlayerId, isHost: false });
          }
          this.onStateSync(data.events || [], data.state);
        }
      });
    });

    this.peer.on('error', () => {
      this.onError(`Không tìm thấy phòng ${this.roomId} hoặc kết nối thất bại!`);
    });
  }

  sendAction(actionType, payload = {}, explicitPlayerId = null) {
    if (this.isHost) {
      this.onPlayerAction(explicitPlayerId || this.myPlayerId, actionType, payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'ACTION',
        action: actionType,
        payload
      });
    }
  }

  broadcastState(events, updatedGameState) {
    if (!this.isHost) return;
    this.onStateSync(events, updatedGameState);

    for (const [playerId, conn] of this.connections.entries()) {
      if (conn.open) {
        conn.send({
          type: 'SYNC_STATE',
          assignedId: playerId,
          events,
          state: updatedGameState
        });
      }
    }
  }
}
