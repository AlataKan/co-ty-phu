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
  // Cấp nhóm Nâu (Ô 1: Mộc Châu, Ô 3: Sa Pa) cho P1
  engine.state.board[1].ownerId = 'P1';
  engine.state.board[3].ownerId = 'P1';

  // P2 đi vào Mộc Châu (giá thuê gốc 2K -> độc quyền nhân đôi thành 4K)
  const p2 = engine.state.players[1];
  engine.collectRent(p2, engine.state.board[1], []);
  assert.equal(p2.cash, 1996);
  assert.equal(engine.state.players[0].cash, 2004);

  // Kiểm tra quy tắc xây đồng đều của P1
  engine.state.phase = 'MANAGEMENT_PHASE';
  engine.handleAction('P1', 'BUILD_HOUSE', { tileIndex: 1 });
  assert.equal(engine.state.board[1].level, 1);

  // Không được lên cấp 2 ở Mộc Châu khi Sa Pa đang cấp 0
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
  assert.equal(engine.state.activePlayerIndex, 1); // Chuyển lượt ngay sang P2
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
  engine.state.board[5].ownerId = 'P2'; // Bến Xe Mỹ Đình
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
