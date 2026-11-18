import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, push, onValue, onChildAdded, remove } from 'firebase/database';

export function isFirebaseConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_DB_URL &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID
  );
}

export class FirebaseNetworkManager {
  constructor(onStateSyncCallback, onPlayerActionCallback, onReadyCallback, onErrorCallback) {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
    };
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    this.db = getDatabase(app);
    this.isHost = false;
    this.roomId = null;
    this.myPlayerId = null;
    this.lastProcessedBatchId = 0;
    this.unsubRoom = null;
    this.unsubQueue = null;
    this.onStateSync = onStateSyncCallback;
    this.onPlayerAction = onPlayerActionCallback;
    this.onReady = onReadyCallback || (() => {});
    this.onError = onErrorCallback || ((msg) => alert(msg));
  }

  async createRoom(playerName, initialState) {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const roomCode = `VN-${randomCode}`;
    this.saveSession(roomCode, 'P1', true);
    this.initRoomListener(roomCode, true, 'P1', initialState);
    this.onReady({ roomId: roomCode, myPlayerId: 'P1', isHost: true });
    this.onPlayerAction('P1', 'JOIN_GAME', { name: playerName, isAI: false });
  }

  async joinRoom(roomCode, playerName) {
    const code = roomCode.trim().toUpperCase();
    const snap = await get(ref(this.db, `rooms/${code}`));
    if (!snap.exists()) {
      this.onError(`Phòng ${code} không tồn tại trên Firebase!`);
      return;
    }

    const roomData = snap.val();
    const existingPlayers = roomData.state?.players || [];

    // Kiểm tra xem trình duyệt này có đang F5 khôi phục lại ghế cũ không
    const saved = this.loadSession();
    let myId = saved?.roomId === code ? saved.myPlayerId : null;

    if (!myId) {
      const maxAllowed = roomData.state?.boardPreset === 'MEGA_52' ? 6 : 6;
      if (existingPlayers.length >= maxAllowed) {
        this.onError(`Phòng đã đủ ${maxAllowed} người!`);
        return;
      }
      myId = `P${existingPlayers.length + 1}`;
      this.saveSession(code, myId, false);
    }

    this.initRoomListener(code, false, myId, null);
    this.onReady({ roomId: code, myPlayerId: myId, isHost: false });
    if (!existingPlayers.some(p => p.id === myId)) {
      this.sendAction('JOIN_GAME', { name: playerName });
    }
  }

  initRoomListener(roomCode, isHost, myPlayerId, initialState = null) {
    this.roomId = roomCode;
    this.isHost = isHost;
    this.myPlayerId = myPlayerId;

    const roomRef = ref(this.db, `rooms/${this.roomId}`);

    if (this.isHost) {
      if (initialState) {
        set(roomRef, {
          hostId: this.myPlayerId,
          lastUpdated: Date.now(),
          state: initialState,
          lastEventBatch: { batchId: 1, events: [] }
        });
      }

      const actionQueueRef = ref(this.db, `rooms/${this.roomId}/actionQueue`);
      this.unsubQueue = onChildAdded(actionQueueRef, (snapshot) => {
        const cmd = snapshot.val();
        if (cmd) {
          this.onPlayerAction(cmd.playerId, cmd.action, cmd.payload);
          remove(snapshot.ref);
        }
      });
    }

    this.unsubRoom = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.state) return;

      const batch = data.lastEventBatch || { batchId: 0, events: [] };
      const newEvents = batch.batchId > this.lastProcessedBatchId ? (batch.events || []) : [];
      this.lastProcessedBatchId = batch.batchId;

      this.onStateSync(newEvents, data.state);
    });
  }

  sendAction(actionType, payload = {}, explicitPlayerId = null) {
    const pid = explicitPlayerId || this.myPlayerId;
    if (this.isHost) {
      this.onPlayerAction(pid, actionType, payload);
    } else {
      const actionQueueRef = ref(this.db, `rooms/${this.roomId}/actionQueue`);
      push(actionQueueRef, {
        playerId: pid,
        action: actionType,
        payload,
        timestamp: Date.now()
      });
    }
  }

  broadcastState(events, updatedGameState) {
    if (!this.isHost) return;
    const nextBatchId = this.lastProcessedBatchId + 1;
    set(ref(this.db, `rooms/${this.roomId}/lastUpdated`), Date.now());
    set(ref(this.db, `rooms/${this.roomId}/state`), updatedGameState);
    set(ref(this.db, `rooms/${this.roomId}/lastEventBatch`), {
      batchId: nextBatchId,
      events
    });
  }

  disconnect() {
    try {
      this.unsubRoom?.();
      this.unsubQueue?.();
    } catch {
      // Bỏ qua lỗi hủy lắng nghe
    }
    this.unsubRoom = null;
    this.unsubQueue = null;
    this.isHost = false;
    this.roomId = null;
    this.myPlayerId = null;
    this.lastProcessedBatchId = 0;
    sessionStorage.removeItem('ctp_fb_session');
  }

  saveSession(roomId, myPlayerId, isHost) {
    sessionStorage.setItem('ctp_fb_session', JSON.stringify({ roomId, myPlayerId, isHost }));
  }

  loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem('ctp_fb_session'));
    } catch {
      return null;
    }
  }
}
