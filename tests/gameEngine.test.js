import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/core/GameEngine.js';

function createStartedMatch() {
  const engine = new GameEngine('TEST-ROOM', 'CLASSIC');
  engine.addPlayer('P1', 'Nguyễn Văn A', false);
  engine.addPlayer('P2', 'Trần Thị B', false);
  engine.startGame('CLASSIC');
  return engine;
}

function createMega6PMatch(allianceMode = false) {
  const engine = new GameEngine('MEGA-ROOM', 'CLASSIC', { boardPreset: 'MEGA_52', allianceMode });
  for (let i = 1; i <= 6; i++) {
    engine.addPlayer(`P${i}`, `Tỷ Phú ${i}`, false);
  }
  engine.startGame('CLASSIC', { boardPreset: 'MEGA_52', allianceMode });
  return engine;
}

test('1. Khởi tạo đúng 40 ô địa danh và vốn 2000K mỗi người', () => {
  const engine = createStartedMatch();
  assert.equal(engine.state.board.length, 40);
  assert.equal(engine.state.players.length, 2);
  assert.equal(engine.state.players[0].cash, 2000);
  assert.equal(engine.state.phase, 'ROLL_DICE');
});

test('2. Qua ô Khởi Hành nhận lương +200K và dừng mua đất trống', () => {
  const engine = createStartedMatch();
  const p1 = engine.state.players[0];
  p1.position = 39; // Phố Đi Bộ Nguyễn Huệ

  const events = [];
  engine.movePlayerSteps(p1, 2, events); // Đi qua ô 0 tới ô 1 (Mộc Châu - 60K)

  assert.equal(p1.position, 1);
  assert.equal(p1.cash, 2200);
  assert.equal(engine.state.phase, 'TILE_RESOLUTION');

  engine.handleAction('P1', 'BUY_PROPERTY');
  assert.equal(engine.state.board[1].ownerId, 'P1');
  assert.equal(p1.cash, 2140);
  assert.equal(engine.state.phase, 'MANAGEMENT_PHASE');
});

test('3. Độc quyền nhóm màu nhân đôi tiền thuê đất trống & Xây nhà đồng đều', () => {
  const engine = createStartedMatch();
  engine.state.board[1].ownerId = 'P1';
  engine.state.board[3].ownerId = 'P1';

  const p2 = engine.state.players[1];
  engine.collectRent(p2, engine.state.board[1], []);
  assert.equal(p2.cash, 1996);
  assert.equal(engine.state.players[0].cash, 2004);

  engine.state.phase = 'MANAGEMENT_PHASE';
  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 1 });
  assert.equal(engine.state.board[1].level, 1);

  assert.equal(engine.canBuildHouse('P1', 1), false);
  assert.equal(engine.canBuildHouse('P1', 3), true);

  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 3 });
  assert.equal(engine.state.board[3].level, 1);
  assert.equal(engine.canBuildHouse('P1', 1), true);
});

test('4. Dừng tại ô 30 (VÀO TÙ) chuyển thẳng về Nhà Tù Côn Đảo (Ô 10), không cộng 200K', () => {
  const engine = createStartedMatch();
  const p1 = engine.state.players[0];
  p1.position = 30;

  engine.resolveTile(p1, engine.state.board[30], []);
  assert.equal(p1.position, 10);
  assert.equal(p1.inJail, true);
  assert.equal(p1.cash, 2000);
  assert.equal(engine.state.activePlayerIndex, 1);
});

test('5. Từ chối mua đất kích hoạt Đấu Giá công khai và chốt người trả cao nhất', () => {
  const engine = createStartedMatch();
  const p1 = engine.state.players[0];
  p1.position = 6; // Tam Đảo (100K)
  engine.state.phase = 'TILE_RESOLUTION';

  engine.handleAction('P1', 'SKIP_PROPERTY');
  assert.equal(engine.state.phase, 'AUCTION_PHASE');
  assert.equal(engine.state.auction.tileIndex, 6);

  engine.handleAction('P2', 'PLACE_BID', { amount: 30 });
  engine.handleAction('P1', 'FOLD_AUCTION');

  engine.clearAuctionTimer();
  assert.equal(engine.state.board[6].ownerId, 'P2');
  assert.equal(engine.state.players[1].cash, 1970);
  assert.equal(engine.state.auction, null);
});

test('6. Phá sản trước người chơi khác chuyển nhượng đất thế chấp và kết thúc game', () => {
  const engine = createStartedMatch();
  const p2 = engine.state.players[1];
  engine.state.board[5].ownerId = 'P2';
  p2.cash = -500;
  engine.state.activePlayerIndex = 1;
  engine.state.pendingDebtCreditor = 'P1';

  engine.declareBankruptcy(p2, 'P1', []);
  assert.equal(p2.isBankrupt, true);
  assert.equal(engine.state.board[5].ownerId, 'P1');
  assert.equal(engine.state.board[5].isMortgaged, true);
  assert.equal(engine.state.phase, 'GAME_OVER');
  assert.equal(engine.state.winnerId, 'P1');
});

test('7. [Mega 52 Ô - 6P] Khởi tạo 52 ô, 6 người chơi vốn 2500K và thưởng +350K khi dừng đúng Khởi Hành', () => {
  const engine = createMega6PMatch(false);
  assert.equal(engine.state.board.length, 52);
  assert.equal(engine.state.players.length, 6);
  assert.equal(engine.state.players[5].cash, 2500);
  assert.equal(engine.state.players[4].icon, '🦁');
  assert.equal(engine.state.players[5].icon, '🛥️');

  const p1 = engine.state.players[0];
  p1.position = 50;
  engine.movePlayerSteps(p1, 2, []); // Dừng chính xác tại ô 0
  assert.equal(p1.position, 0);
  assert.equal(p1.cash, 2850); // +350K
});

test('8. [Mega 52 Ô] Liên doanh Đô thị (2/3 bộ màu) xây tối đa Cấp 2; Độc quyền mở khóa Landmark Cấp 6', () => {
  const engine = createMega6PMatch(false);
  // Nhóm Nâu ở bản 52 ô gồm #1 (Mộc Châu), #3 (Điện Biên Phủ), #4 (Sa Pa)
  engine.state.board[1].ownerId = 'P1';
  engine.state.board[3].ownerId = 'P1';
  engine.state.phase = 'MANAGEMENT_PHASE';

  // Mới có 2/3 ô -> Được phép xây lên tối đa cấp 2
  assert.equal(engine.canBuildHouse('P1', 1), true);
  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 1 });
  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 3 });
  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 1 });
  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 3 });
  assert.equal(engine.state.board[1].level, 2);
  assert.equal(engine.state.board[3].level, 2);

  // Chưa có ô thứ 3 (#4) thì không được lên cấp 3
  assert.equal(engine.canBuildHouse('P1', 1), false);

  // Khi P1 sở hữu nốt ô #4 và nâng đều lên cấp 5 -> Mở khóa lên Landmark Cấp 6
  engine.state.board[4].ownerId = 'P1';
  engine.state.board[1].level = 5;
  engine.state.board[3].level = 5;
  engine.state.board[4].level = 5;
  assert.equal(engine.canBuildHouse('P1', 1), true);
  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 1 });
  assert.equal(engine.state.board[1].level, 6);
});

test('9. [Mega 52 Ô] Xúc xắc Tốc độ (BUS / MR_MONOPOLY) & Dịch chuyển Nhanh giữa 6 Trạm Giao Thông', () => {
  const engine = createMega6PMatch(false);
  const p1 = engine.state.players[0];

  // Cấp quyền sở hữu Bến Xe Mỹ Đình (#6) cho P1 và đặt P1 tại #6 ở đầu lượt
  engine.state.board[6].ownerId = 'P1';
  p1.position = 6;
  engine.handleAction('P1', 'TRANSIT_TELEPORT', { targetIndex: 37 }); // Bay tới Metro Bến Thành - Suối Tiên (#37)
  assert.equal(p1.position, 37);
  assert.equal(engine.state.phase, 'TILE_RESOLUTION');
  engine.handleAction('P1', 'BUY_PROPERTY'); // Mua luôn Metro #37

  // Sang vòng 2: thử mặt MR_MONOPOLY của Xúc xắc Tốc độ
  engine.state.roundCount = 2;
  engine.state.activePlayerIndex = 0;
  engine.state.phase = 'ROLL_DICE';
  p1.position = 0;
  engine.handleAction('P1', 'ROLL_DICE', { forceDice: [1, 1], forceSpeedDie: 'MR_MONOPOLY' });
  // Đi 2 bước vào Khí Vận (#2), rút thẻ xong tự động bay tới ô đất trống gần nhất
  assert.equal(engine.state.speedDie, 'MR_MONOPOLY');
});

test('10. [Liên Minh 2v2v2] Miễn tiền thuê đồng đội, Gộp chung bộ màu & Cứu trợ Phá sản (Bailout)', () => {
  const engine = createMega6PMatch(true);
  // Liên minh Phương Nam: P1 + P5
  // Nhóm Xanh Đậm (2 ô): #49 (Hồ Hoàn Kiếm) do P1 giữ, #51 (Phố Nguyễn Huệ) do P5 giữ
  engine.state.board[49].ownerId = 'P1';
  engine.state.board[51].ownerId = 'P5';

  // Nhờ gộp chung bộ màu Liên minh, cả P1 và P5 đều được tính là Độc quyền và xây được nhà ngay
  assert.equal(engine.ownsFullGroupUnmortgaged('P1', 'DARK_BLUE'), true);
  assert.equal(engine.canBuildHouse('P1', 49), true);

  // P5 đi vào đất #49 của đồng đội P1 -> Miễn 100% tiền thuê
  const p5 = engine.state.players[4];
  engine.collectRent(p5, engine.state.board[49], []);
  assert.equal(p5.cash, 2500);

  // P1 lâm vào nợ -200K -> Đồng đội P5 thực hiện Cứu trợ Liên minh (ALLY_BAILOUT)
  const p1 = engine.state.players[0];
  p1.cash = -200;
  engine.state.activePlayerIndex = 0;
  engine.state.phase = 'BANKRUPTCY_CHECK';
  engine.handleAction('P5', 'ALLY_BAILOUT');

  assert.equal(p1.cash, 0);
  assert.equal(p5.cash, 2300);
  assert.equal(p5.usedBailout, true);
  assert.equal(engine.state.phase, 'MANAGEMENT_PHASE');
});

test('11. Rời khỏi phòng trong phòng chờ & trong ván đấu xử lý đúng lượt và tài sản', () => {
  const lobbyEngine = new GameEngine('LEAVE-TEST', 'CLASSIC');
  lobbyEngine.addPlayer('P1', 'Chủ phòng', false);
  lobbyEngine.addPlayer('P2', 'Khách 2', true);
  lobbyEngine.handleAction('P1', 'REMOVE_PLAYER', { targetId: 'P2' });
  assert.equal(lobbyEngine.state.players.length, 1);

  const matchEngine = createMega6PMatch(false);
  matchEngine.state.board[1].ownerId = 'P3';
  matchEngine.state.activePlayerIndex = 0; // Đang là lượt P1
  matchEngine.handleAction('P3', 'LEAVE_ROOM');
  assert.equal(matchEngine.state.players[2].isBankrupt, true);
  // P3 có đất nên chuyển sang đấu giá công khai lô đất #1
  assert.equal(matchEngine.state.phase, 'AUCTION_PHASE');
  assert.equal(matchEngine.state.auction.tileIndex, 1);
  matchEngine.clearAuctionTimer();
});
