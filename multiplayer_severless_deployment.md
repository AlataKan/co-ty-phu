# TÀI LIỆU TRIỂN KHAI MULTIPLAYER 100% SERVERLESS (PEERJS & FIREBASE)

Tài liệu này hướng dẫn chi tiết cách xây dựng hệ thống kết nối 4 người chơi thời gian thực khi toàn bộ mã nguồn được host tĩnh trên **Vercel**, hoàn toàn không cần thuê hay vận hành máy chủ Backend (No-Backend Architecture).

---

## 1. NGUYÊN LÝ CỐT LÕI: KIẾN TRÚC HOST-AUTHORITY (CHỦ PHÒNG LÀM SERVER LOGIC)

Trong môi trường không có Backend Server riêng, để tránh việc 4 máy tự tính toán dẫn đến lệch dữ liệu (Desync) hoặc gian lận, trò chơi áp dụng mô hình **Host-Authority (Trình duyệt của Chủ phòng đóng vai trò là Game Server)**:

* **Host (Người chơi 1 - Chủ phòng):**
  * Trình duyệt của Host nắm giữ bộ máy trạng thái gốc (`Authoritative GameState`) và hàm xử lý luật chơi (`GameEngine`).
  * Chỉ máy của Host mới được phép gọi hàm `Math.random()` để tung xúc xắc, xáo bài Cơ Hội/Khí Vận và kiểm tra điều kiện trừ tiền/phá sản.
* **Client (Người chơi 2, 3, 4 - Khách):**
  * Trình duyệt của Client chỉ gửi **Ý định thao tác (`Action Intent`)** về cho Host (Ví dụ: `{ type: "ROLL_DICE" }`, `{ type: "BUY_PROPERTY" }`, `{ type: "PLACE_BID", amount: 150 }`).
  * Khi Host nhận được `Action`, Host kiểm tra tính hợp lệ (Có đúng lượt của người đó không? Có đủ tiền không?), cập nhật `GameState` mới và tạo danh sách sự kiện diễn hoạt (`Event Queue`), sau đó phát (`Broadcast`) về cho cả 4 máy cùng vẽ lên màn hình.

```text
[Client P2] --- (1) Gửi Action: "ROLL_DICE" ---> [Trình duyệt HOST P1 (Chạy GameEngine)]
[Client P3] <--- (2) Broadcast: { events, newState } --- [Trình duyệt HOST P1]
[Client P4] <--- (2) Broadcast: { events, newState } ---/
```

---

## 2. SO SÁNH 2 GIẢI PHÁP SERVERLESS TRÊN VERCEL

Bạn có thể chọn 1 trong 2 công nghệ dưới đây (hoặc bọc chung vào 1 `NetworkAdapter` để chuyển đổi tùy ý):

| Tiêu chí | Giải pháp 1: PeerJS (WebRTC P2P) | Giải pháp 2: Firebase Realtime Database |
| :--- | :--- | :--- |
| **Chi phí & Cài đặt** | **0đ - Không cần đăng ký tài khoản.** Chỉ cần `npm install peerjs` là chạy ngay trên Vercel. | **0đ (Gói Spark Free).** Cần tạo Project trên Google Firebase Console và lấy `firebaseConfig`. |
| **Độ trễ (Latency)** | **Cực thấp ($15 - 40\text{ms}$)** vì 4 trình duyệt truyền dữ liệu trực tiếp cho nhau qua UDP/SCTP. | **Thấp ($60 - 150\text{ms}$)** qua kết nối WebSocket tới cụm máy chủ Singapore của Google. |
| **Xử lý khi F5 / Rớt mạng** | Nếu Client F5, có thể kết nối lại với Host. Nếu **Host đóng tab**, phòng chơi sẽ kết thúc (trừ khi lưu snapshot vào `localStorage`). | **Rất mạnh.** Toàn bộ `GameState` nằm trên đám mây Firebase nên cả 4 người (kể cả Host) lỡ bấm F5 tải lại trang vẫn khôi phục ván cờ ngay lập tức. |
| **Xuyên tường lửa (NAT)** | Đôi khi mạng 4G/Doanh nghiệp chặn P2P (khắc phục bằng cách thêm cấu hình STUN/TURN miễn phí). | **100% không bị chặn** vì hoạt động qua giao thức HTTPS/WSS cổng 443 chuẩn. |

---

## 3. TRIỂN KHAI PHƯƠNG ÁN 1: PEERJS (WEBRTC 100% P2P)

### 3.1. Cài đặt thư viện
```bash
npm install peerjs
```

### 3.2. Mã nguồn `PeerNetworkManager.js` hoàn chỉnh

```javascript
import Peer from 'peerjs';

// Cấu hình STUN server của Google giúp kết nối xuyên qua mạng Wi-Fi/4G khác nhau
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
};

export class PeerNetworkManager {
  constructor(onStateSyncCallback, onPlayerActionCallback) {
    this.peer = null;
    this.isHost = false;
    this.roomId = null;
    this.myPlayerId = null;
    this.connections = new Map(); // Chỉ dùng cho Host: lưu danh sách kết nối tới P2, P3, P4
    this.hostConnection = null;   // Chỉ dùng cho Client: kết nối tới Host
    this.onStateSync = onStateSyncCallback;       // Hàm gọi khi nhận GameState mới để vẽ UI/Phaser
    this.onPlayerAction = onPlayerActionCallback; // Hàm chỉ Host dùng để xử lý Action từ Client
  }

  // 1. DÀNH CHO CHỦ PHÒNG: Tạo phòng với mã ngắn gọn (VD: VN-8392)
  createRoom(playerName) {
    this.isHost = true;
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    this.roomId = `VN-${randomCode}`;
    this.myPlayerId = 'P1';

    this.peer = new Peer(this.roomId, PEER_CONFIG);

    this.peer.on('open', (id) => {
      console.log(`[HOST] Đã tạo phòng thành công! Mã phòng: ${id}`);
    });

    // Lắng nghe khi có người chơi 2, 3, 4 kết nối vào
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (this.connections.size >= 3) {
          conn.send({ type: 'ERROR', message: 'Phòng đã đủ 4 người!' });
          setTimeout(() => conn.close(), 500);
          return;
        }

        const assignedId = `P${this.connections.size + 2}`; // Cấp ID: P2, P3, P4
        this.connections.set(assignedId, conn);

        // Lắng nghe các Action do Client này gửi lên
        conn.on('data', (data) => {
          if (data.type === 'ACTION') {
            this.onPlayerAction(assignedId, data.action, data.payload);
          }
        });

        conn.on('close', () => {
          console.warn(`[HOST] Người chơi ${assignedId} đã mất kết nối.`);
        });
      });
    });
  }

  // 2. DÀNH CHO KHÁCH (P2, P3, P4): Nhập mã phòng để tham gia
  joinRoom(roomCode, playerName) {
    this.isHost = false;
    this.roomId = roomCode.toUpperCase();
    this.peer = new Peer(undefined, PEER_CONFIG);

    this.peer.on('open', () => {
      this.hostConnection = this.peer.connect(this.roomId, { reliable: true });

      this.hostConnection.on('open', () => {
        // Gửi yêu cầu đăng ký tên người chơi cho Host
        this.sendAction('JOIN_GAME', { name: playerName });
      });

      // Nhận gói tin đồng bộ trạng thái & hiệu ứng từ Host gửi về
      this.hostConnection.on('data', (data) => {
        if (data.type === 'SYNC_STATE') {
          if (data.assignedId) this.myPlayerId = data.assignedId;
          this.onStateSync(data.events, data.state);
        }
      });
    });
  }

  // 3. CLIENT GỬI HÀNH ĐỘNG LÊN HOST (Hoặc Host tự thực thi)
  sendAction(actionType, payload = {}) {
    if (this.isHost) {
      // Nếu chính Host bấm nút, gọi thẳng vào bộ xử lý logic
      this.onPlayerAction(this.myPlayerId, actionType, payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'ACTION',
        action: actionType,
        payload: payload
      });
    }
  }

  // 4. HOST PHÁT TRẠNG THÁI MỚI CHO CẢ 4 MÁY
  broadcastState(events, updatedGameState) {
    if (!this.isHost) return;

    // Cập nhật cho chính màn hình của Host trước
    this.onStateSync(events, updatedGameState);

    // Gửi tới tất cả các máy khách (P2, P3, P4)
    for (const [playerId, conn] of this.connections.entries()) {
      if (conn.open) {
        conn.send({
          type: 'SYNC_STATE',
          assignedId: playerId,
          events: events,
          state: updatedGameState
        });
      }
    }
  }
}
```

---

## 4. TRIỂN KHAI PHƯƠNG ÁN 2: FIREBASE REALTIME DATABASE (BỀN VỮNG, CHỐNG RỚT MẠNG)

Nếu dùng Firebase, kể cả khi người chơi vô tình tải lại trang (F5) hay rớt Wi-Fi vài giây, ván cờ vẫn được lưu trữ an toàn trên Cloud.

### 4.1. Cấu trúc cây dữ liệu JSON trên Firebase Realtime Database
```json
{
  "rooms": {
    "VN-8899": {
      "hostId": "P1",
      "lastUpdated": 1731912000000,
      "state": {
        "phase": "ROLL_DICE",
        "activePlayerIndex": 0,
        "dice": [4, 5],
        "players": [ ... ],
        "board": [ ... ]
      },
      "lastEventBatch": {
        "batchId": 104,
        "events": [
          { "type": "DICE_ROLLED", "dice": [4, 5] },
          { "type": "PLAYER_MOVED", "player": "P1", "from": 0, "to": 9 }
        ]
      },
      "actionQueue": {
        "-OBy7123abc": { "playerId": "P2", "action": "PLACE_BID", "payload": { "amount": 150 } }
      }
    }
  }
}
```

### 4.2. Mã nguồn `FirebaseNetworkManager.js`

```javascript
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, onValue, onChildAdded, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export class FirebaseNetworkManager {
  constructor(onStateSyncCallback, onPlayerActionCallback) {
    const app = initializeApp(firebaseConfig);
    this.db = getDatabase(app);
    this.isHost = false;
    this.roomId = null;
    this.myPlayerId = null;
    this.lastProcessedBatchId = 0;
    this.onStateSync = onStateSyncCallback;
    this.onPlayerAction = onPlayerActionCallback;
  }

  // Khởi tạo lắng nghe phòng chơi cho cả Host và Client
  initRoomListener(roomCode, isHost, myPlayerId, initialState = null) {
    this.roomId = roomCode;
    this.isHost = isHost;
    this.myPlayerId = myPlayerId;

    const roomRef = ref(this.db, `rooms/${this.roomId}`);

    if (this.isHost && initialState) {
      set(roomRef, {
        hostId: this.myPlayerId,
        state: initialState,
        lastEventBatch: { batchId: 1, events: [] }
      });

      // Host lắng nghe hàng đợi lệnh (actionQueue) từ các máy khách gửi lên
      const actionQueueRef = ref(this.db, `rooms/${this.roomId}/actionQueue`);
      onChildAdded(actionQueueRef, (snapshot) => {
        const cmd = snapshot.val();
        if (cmd) {
          // Xử lý lệnh tại máy Host rồi xóa ngay lệnh đó khỏi hàng đợi
          this.onPlayerAction(cmd.playerId, cmd.action, cmd.payload);
          remove(snapshot.ref);
        }
      });
    }

    // Cả 4 máy cùng lắng nghe sự thay đổi của nhánh phòng chơi
    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.state) return;

      const batch = data.lastEventBatch || { batchId: 0, events: [] };
      const newEvents = batch.batchId > this.lastProcessedBatchId ? (batch.events || []) : [];
      this.lastProcessedBatchId = batch.batchId;

      this.onStateSync(newEvents, data.state);
    });
  }

  // Client đẩy thao tác vào hàng đợi trên Firebase
  sendAction(actionType, payload = {}) {
    if (this.isHost) {
      this.onPlayerAction(this.myPlayerId, actionType, payload);
    } else {
      const actionQueueRef = ref(this.db, `rooms/${this.roomId}/actionQueue`);
      push(actionQueueRef, {
        playerId: this.myPlayerId,
        action: actionType,
        payload: payload,
        timestamp: Date.now()
      });
    }
  }

  // Host cập nhật trạng thái mới lên Firebase
  broadcastState(events, updatedGameState) {
    if (!this.isHost) return;
    const nextBatchId = this.lastProcessedBatchId + 1;
    set(ref(this.db, `rooms/${this.roomId}/state`), updatedGameState);
    set(ref(this.db, `rooms/${this.roomId}/lastEventBatch`), {
      batchId: nextBatchId,
      events: events
    });
  }
}
```

---

## 5. BỘ XỬ LÝ LOGIC TRUNG TÂM & ĐỒNG BỘ DIỄN HOẠT (`GameEngine.js`)

Điểm mấu chốt để 4 người chơi nhìn thấy xúc xắc lăn và quân cờ nhảy mượt mà trước khi hiện bảng mua đất là cơ chế **Trình phát sự kiện tuần tự (`Sequential Event Player`)**:

```javascript
// Hàm chạy trên cả 4 trình duyệt mỗi khi nhận được gói tin từ NetworkManager
export async function playEventsAndRenderState(events, finalState, phaserBoardScene, uiManager) {
  // 1. Khóa tạm thời các nút bấm trong lúc đang diễn hoạt
  uiManager.setInteractiveLock(true);

  // 2. Chạy tuần tự từng hiệu ứng hình ảnh trên Phaser 3 Canvas
  for (const ev of events) {
    switch (ev.type) {
      case 'DICE_ROLLED':
        await phaserBoardScene.animateDiceRoll(ev.dice[0], ev.dice[1]);
        break;

      case 'PLAYER_MOVED':
        await phaserBoardScene.animateTokenMove(ev.playerId, ev.from, ev.to, ev.passedStart);
        break;

      case 'CASH_CHANGED':
        phaserBoardScene.showFloatingText(ev.tileIndex, ev.amount);
        await new Promise(r => setTimeout(r, 400));
        break;

      case 'CARD_DRAWN':
        await uiManager.showChanceOrCommunityCardModal(ev.deck, ev.card);
        break;
    }
  }

  // 3. Sau khi diễn hoạt xong hết, đồng bộ giao diện (HUD, Sổ đỏ, Nút bấm) theo finalState
  phaserBoardScene.syncBoardOwnersAndBuildings(finalState.board, finalState.players);
  uiManager.renderHUD(finalState);
  uiManager.setInteractiveLock(false);
}
```

---

## 6. CẤU HÌNH DEPLOY LÊN VERCEL (`package.json` & `vite.config.js`)

Dự án đóng gói bằng **Vite** cực kỳ gọn nhẹ. Khi bạn đẩy code lên GitHub và kết nối với **Vercel**, hệ thống sẽ tự động nhận diện Vite và xuất ra bản build tĩnh chỉ trong khoảng $15\text{ giây}$.

### `package.json`
```json
{
  "name": "vietnam-monopoly-2d",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.12.0",
    "peerjs": "^1.5.4",
    "phaser": "^3.80.1"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.0"
  }
}
```

### Quy trình chạy thử ở Local và Deploy Vercel:
1. **Chạy thử 4 người ngay trên máy của bạn:** Chạy `npm run dev`, mở 4 tab trình duyệt ở địa chỉ `http://localhost:5173`. Tab 1 bấm **Tạo Phòng** (nhận mã `VN-xxxx`), 3 tab còn lại nhập mã `VN-xxxx` bấm **Vào Phòng** để kiểm tra toàn bộ luồng Đổ xúc xắc, Mua đất, Đấu giá.
2. **Đẩy lên Vercel:** Push repository lên GitHub $\rightarrow$ Vào Vercel chọn **Add New Project** $\rightarrow$ Import repository (Nếu dùng Firebase thì thêm 3 biến môi trường `VITE_FIREBASE_*` vào mục Environment Variables của Vercel) $\rightarrow$ Bấm **Deploy**. Bạn sẽ có ngay đường link `.vercel.app` để gửi cho 3 người bạn cùng vào chơi!