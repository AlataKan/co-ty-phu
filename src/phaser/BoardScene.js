import Phaser from 'phaser';
import { INITIAL_BOARD_TILES, GROUP_COLORS, PLAYER_PRESETS } from '../data/boardData.js';
import { BOARD_SIZE, CORNER_SIZE, EDGE_LENGTH, getTileTransform, getTokenTargetPoint } from './boardGeometry.js';

const TOKEN_ICONS = {
  P1: '👒', // Nón Lá
  P2: '🛺', // Xe Xích Lô
  P3: '🥁', // Trống Đồng
  P4: '🪷'  // Hoa Sen
};

export class BoardScene extends Phaser.Scene {
  constructor(onTileClickCallback) {
    super({ key: 'BoardScene' });
    this.onTileClick = onTileClickCallback || (() => {});
    this.tileVisuals = new Map(); // index -> { ownerBadge, mortgageOverlay, buildingGroup }
    this.tokenContainers = new Map(); // playerId -> Phaser.GameObjects.Container
    this.diceVisuals = [];
    this.audioCtx = null;
    this.soundEnabled = true;
    this.isReady = false;
  }

  create() {
    this.drawBoardBackgroundAndCenterCourt();
    this.drawAllTiles();
    this.createCenterDice();
    this.isReady = true;
    this.events.emit('SCENE_READY');
  }

  // ==================== 1. VẼ SÂN TRUNG TÂM & BÀN CỜ 40 Ô ====================

  drawBoardBackgroundAndCenterCourt() {
    // Nền tổng bàn cờ 1040x1040
    this.add.rectangle(BOARD_SIZE / 2, BOARD_SIZE / 2, BOARD_SIZE, BOARD_SIZE, 0xf8fafc)
      .setStrokeStyle(4, 0x0f172a);

    // Khoảng sân trung tâm 760x760 (từ 140,140 đến 900,900)
    this.add.rectangle(BOARD_SIZE / 2, BOARD_SIZE / 2, EDGE_LENGTH, EDGE_LENGTH, 0xecfdf5)
      .setStrokeStyle(3, 0x334155);

    // Họa tiết trang trí trung tâm & Tên game
    this.add.circle(BOARD_SIZE / 2, BOARD_SIZE / 2, 220, 0xd1fae5, 0.45);
    this.add.text(BOARD_SIZE / 2, 340, 'CỜ TỶ PHÚ VIỆT NAM', {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '36px',
      fontStyle: '800',
      color: '#0f172a'
    }).setOrigin(0.5);

    this.add.text(BOARD_SIZE / 2, 382, 'HÀNH TRÌNH XUYÊN VIỆT', {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '14px',
      fontStyle: '600',
      color: '#047857',
      letterSpacing: 4
    }).setOrigin(0.5);

    // Ô đặt bài Khí Vận (Góc trên trái sân trung tâm)
    this.drawCardDeckSlot(310, 260, 'HÒM KHÍ VẬN', 0x0284c7, -18);

    // Ô đặt bài Cơ Hội (Góc dưới phải sân trung tâm)
    this.drawCardDeckSlot(730, 780, 'THẺ CƠ HỘI', 0xea580c, -18);
  }

  drawCardDeckSlot(x, y, label, hexColor, angle) {
    const container = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 170, 108, hexColor, 0.14)
      .setStrokeStyle(2.5, hexColor);
    const inner = this.add.rectangle(0, 0, 154, 92, hexColor, 0.85);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      color: '#ffffff'
    }).setOrigin(0.5);
    container.add([rect, inner, txt]);
    container.setAngle(angle);
  }

  drawAllTiles() {
    INITIAL_BOARD_TILES.forEach((tile) => {
      const tf = getTileTransform(tile.index);
      const container = this.add.container(tf.x, tf.y);

      if (tf.isCorner) {
        this.populateCornerTile(container, tile, tf);
      } else {
        this.populateEdgeTile(container, tile, tf);
      }

      // Cho phép bấm vào bất kỳ ô nào trên bàn cờ để xem Sổ đỏ / Thông tin ô
      const hitZone = this.add.zone(0, 0, tf.width, tf.height).setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', () => this.onTileClick(tile.index));
      container.add(hitZone);
      container.setAngle(tf.angle);
    });
  }

  populateCornerTile(container, tile, tf) {
    const bgColors = {
      START: 0xdcfce7,
      JAIL: 0xf1f5f9,
      FREE_PARKING: 0xfef9c3,
      GO_TO_JAIL: 0xfee2e2
    };
    const icons = {
      START: '🏁\n+200K',
      JAIL: '⛓️',
      FREE_PARKING: '🚶',
      GO_TO_JAIL: '🚓'
    };

    const bg = this.add.rectangle(0, 0, tf.width, tf.height, bgColors[tile.type] || 0xffffff)
      .setStrokeStyle(1.5, 0x334155);

    const iconText = this.add.text(0, -18, icons[tile.type] || '', {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '26px',
      fontStyle: '700',
      color: '#0f172a',
      align: 'center'
    }).setOrigin(0.5);

    const titleText = this.add.text(0, 34, tile.name, {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '12px',
      fontStyle: '800',
      color: '#0f172a',
      align: 'center',
      wordWrap: { width: tf.width - 14 }
    }).setOrigin(0.5);

    container.add([bg, iconText, titleText]);
  }

  populateEdgeTile(container, tile, tf) {
    const W = tf.width;
    const H = tf.height; // 140px: chia 4 vùng từ trên (-70) xuống dưới (+70): 28px | 52px | 30px | 30px

    const bg = this.add.rectangle(0, 0, W, H, 0xffffff).setStrokeStyle(1.2, 0x334155);
    container.add(bg);

    const palette = GROUP_COLORS[tile.group] || GROUP_COLORS.NONE;
    const primaryInt = Phaser.Display.Color.HexStringToColor(palette.primary).color;
    const borderInt = Phaser.Display.Color.HexStringToColor(palette.border).color;

    // 1. Vùng Color Bar (Cao 28px: y từ -70 đến -42, tâm y = -56)
    if (tile.type === 'PROPERTY' || tile.type === 'STATION' || tile.type === 'UTILITY') {
      const colorBar = this.add.rectangle(0, -56, W - 2, 28, primaryInt)
        .setStrokeStyle(1, borderInt);
      container.add(colorBar);
    } else {
      const specialIcon = tile.type === 'CHANCE' ? '❓' : tile.type === 'COMMUNITY_CHEST' ? '🎁' : '💸';
      const iconLabel = this.add.text(0, -50, specialIcon, { fontSize: '20px' }).setOrigin(0.5);
      container.add(iconLabel);
    }

    // Container chứa Nhà (tối đa 4 căn 16x16) hoặc Khách Sạn (22x22) nằm ngay trên Color Bar
    const buildingGroup = this.add.container(0, -56);
    container.add(buildingGroup);

    // 2. Vùng Tên Địa Danh (Cao 52px: y từ -42 đến +10, tâm y = -16)
    const nameText = this.add.text(0, -16, tile.name.toUpperCase(), {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '10.5px',
      fontStyle: '700',
      color: '#0f172a',
      align: 'center',
      wordWrap: { width: W - 8 }
    }).setOrigin(0.5);
    container.add(nameText);

    // 3. Vùng Cờ Sở Hữu / Owner Badge (Cao 30px: y từ +10 đến +40, tâm y = +25)
    const ownerBadge = this.add.circle(0, 25, 9, 0x94a3b8).setStrokeStyle(2, 0xffffff).setVisible(false);
    container.add(ownerBadge);

    // Lớp phủ Thế Chấp
    const mortgageOverlay = this.add.container(0, 25).setVisible(false);
    const mortBg = this.add.rectangle(0, 0, W - 6, 20, 0xdc2626, 0.92).setAngle(-8);
    const mortTxt = this.add.text(0, 0, 'THẾ CHẤP', {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '9px',
      fontStyle: '800',
      color: '#ffffff'
    }).setOrigin(0.5).setAngle(-8);
    mortgageOverlay.add([mortBg, mortTxt]);
    container.add(mortgageOverlay);

    // 4. Vùng Giá Mua / Phạt Thuế (Cao 30px: y từ +40 đến +70, tâm y = +55)
    const footerLabel = tile.price ? `${tile.price}K` : tile.taxAmount ? `-${tile.taxAmount}K` : '';
    if (footerLabel) {
      const priceTag = this.add.text(0, 55, footerLabel, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '12px',
        fontStyle: '700',
        color: tile.taxAmount ? '#dc2626' : '#1e293b'
      }).setOrigin(0.5);
      container.add(priceTag);
    }

    this.tileVisuals.set(tile.index, {
      ownerBadge,
      mortgageOverlay,
      buildingGroup
    });
  }

  // ==================== 2. XÚC XẮC TRUNG TÂM & QUÂN CỜ ====================

  createCenterDice() {
    const positions = [BOARD_SIZE / 2 - 48, BOARD_SIZE / 2 + 48];
    this.diceVisuals = positions.map((xPos) => {
      const dieContainer = this.add.container(xPos, BOARD_SIZE / 2 + 45);
      const box = this.add.rectangle(0, 0, 68, 68, 0xffffff)
        .setStrokeStyle(3, 0x0f172a);
      const pipText = this.add.text(0, 0, '1', {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '32px',
        fontStyle: '800',
        color: '#e11d48'
      }).setOrigin(0.5);
      dieContainer.add([box, pipText]);
      return { container: dieContainer, pipText };
    });
  }

  ensurePlayerTokens(players) {
    // Ẩn quân cờ của người đã phá sản và khởi tạo quân cờ mới nếu chưa có
    players.forEach((p, idx) => {
      if (!this.tokenContainers.has(p.id)) {
        const preset = PLAYER_PRESETS[idx] || PLAYER_PRESETS[0];
        const colorInt = Phaser.Display.Color.HexStringToColor(p.color || preset.color).color;
        const { x, y } = getTokenTargetPoint(p.position, idx, players.length);

        const token = this.add.container(x, y).setDepth(20 + idx);
        const shadow = this.add.circle(0, 3, 17, 0x000000, 0.28);
        const base = this.add.circle(0, 0, 16, colorInt).setStrokeStyle(2.5, 0xffffff);
        const emoji = this.add.text(0, 0, TOKEN_ICONS[p.id] || '⭐', {
          fontSize: '16px'
        }).setOrigin(0.5);

        token.add([shadow, base, emoji]);
        token.setData('tileIndex', p.position);
        this.tokenContainers.set(p.id, token);
      }

      const tokenObj = this.tokenContainers.get(p.id);
      tokenObj.setVisible(!p.isBankrupt);
    });
  }

  repositionTokensAtTile(tileIndex, players) {
    const occupants = players.filter(p => !p.isBankrupt && p.position === tileIndex);
    occupants.forEach((p, slotIdx) => {
      const token = this.tokenContainers.get(p.id);
      if (!token) return;
      const pt = getTokenTargetPoint(tileIndex, slotIdx, occupants.length);
      this.tweens.add({
        targets: token,
        x: pt.x,
        y: pt.y,
        duration: 120,
        ease: 'Quad.Out'
      });
    });
  }

  // ==================== 3. ĐỒNG BỘ SỞ HỮU ĐẤT & NHÀ/KHÁCH SẠN ====================

  syncBoardOwnersAndBuildings(board, players) {
    if (!this.isReady) return;
    this.ensurePlayerTokens(players);

    const playerColorMap = new Map(
      players.map(p => [p.id, Phaser.Display.Color.HexStringToColor(p.color).color])
    );

    board.forEach((tile) => {
      const vis = this.tileVisuals.get(tile.index);
      if (!vis) return;

      // 1. Huy hiệu chủ sở hữu & Thế chấp
      if (tile.ownerId && playerColorMap.has(tile.ownerId)) {
        vis.ownerBadge.setFillStyle(playerColorMap.get(tile.ownerId));
        vis.ownerBadge.setVisible(!tile.isMortgaged);
        vis.mortgageOverlay.setVisible(Boolean(tile.isMortgaged));
      } else {
        vis.ownerBadge.setVisible(false);
        vis.mortgageOverlay.setVisible(false);
      }

      // 2. Vẽ Nhà (1..4 căn 16x16 xanh lá) hoặc Khách Sạn (cấp 5: 22x22 đỏ)
      vis.buildingGroup.removeAll(true);
      if (tile.level >= 1 && tile.level <= 4) {
        const spacing = 18;
        const startX = -((tile.level - 1) * spacing) / 2;
        for (let i = 0; i < tile.level; i++) {
          const house = this.add.rectangle(startX + i * spacing, 0, 16, 16, 0x22c55e)
            .setStrokeStyle(1.5, 0xffffff);
          vis.buildingGroup.add(house);
        }
      } else if (tile.level === 5) {
        const hotel = this.add.rectangle(0, 0, 22, 22, 0xef4444)
          .setStrokeStyle(2, 0xfef08a);
        const star = this.add.text(0, 0, 'H', {
          fontFamily: 'Montserrat, sans-serif',
          fontSize: '11px',
          fontStyle: '800',
          color: '#ffffff'
        }).setOrigin(0.5);
        vis.buildingGroup.add([hotel, star]);
      }
    });

    // Căn chỉnh lại vị trí chống đè quân cờ trên cả 40 ô
    for (let idx = 0; idx < 40; idx++) {
      this.repositionTokensAtTile(idx, players);
    }
  }

  // ==================== 4. CÁC HÀM DIỄN HOẠT BẤT ĐỒNG BỘ (PROMISE) ====================

  /**
   * Hiệu ứng Đổ Xúc Xắc (800ms): Phóng to 1.3x + xoay đổi số mỗi 60ms trong 600ms, sau đó nảy Bounce.Out
   */
  animateDiceRoll(d1, d2) {
    if (!this.isReady) return Promise.resolve();
    const targets = [d1, d2];

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        this.diceVisuals.forEach((dv) => {
          dv.pipText.setText(String(Phaser.Math.Between(1, 6)));
          dv.container.setAngle(Phaser.Math.Between(-22, 22));
        });
      }, 60);

      this.diceVisuals.forEach((dv) => {
        this.tweens.add({
          targets: dv.container,
          scale: 1.3,
          duration: 300,
          yoyo: true
        });
      });

      this.time.delayedCall(600, () => {
        clearInterval(interval);
        this.diceVisuals.forEach((dv, idx) => {
          dv.pipText.setText(String(targets[idx]));
          dv.container.setAngle(0);
          dv.container.setScale(1.22);
          this.tweens.add({
            targets: dv.container,
            scale: 1.0,
            duration: 200,
            ease: 'Bounce.Out'
          });
        });
        this.playStepSound(520);
        this.time.delayedCall(200, resolve);
      });
    });
  }

  /**
   * Hiệu ứng Quân Cờ Nhảy Bước (180ms/ô): Dùng Phaser.Tweens.chain nhảy từng ô với scale 1.0 -> 1.25 -> 1.0
   */
  animateTokenMove(playerId, from, to, passedStart = false) {
    const token = this.tokenContainers.get(playerId);
    if (!this.isReady || !token || from === to) return Promise.resolve();

    const path = [];
    const diffBackward = (from - to + 40) % 40;

    // Xử lý lùi 3 bước (thẻ Cơ Hội CH_05) hoặc đi tiến theo chiều kim đồng hồ
    if (!passedStart && diffBackward > 0 && diffBackward <= 3) {
      for (let step = 1; step <= diffBackward; step++) {
        path.push((from - step + 40) % 40);
      }
    } else {
      let cur = from;
      while (cur !== to) {
        cur = (cur + 1) % 40;
        path.push(cur);
        if (path.length > 42) break;
      }
    }

    if (path.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      const chainTweens = path.map((tileIdx) => {
        const { x, y } = getTileTransform(tileIdx);
        return {
          x,
          y,
          duration: 180,
          ease: 'Sine.InOut',
          onStart: () => {
            this.playStepSound(340);
            this.tweens.add({
              targets: token,
              scale: 1.25,
              duration: 90,
              yoyo: true
            });
          }
        };
      });

      this.tweens.chain({
        targets: token,
        tweens: chainTweens,
        onComplete: () => {
          token.setData('tileIndex', to);
          resolve();
        }
      });
    });
  }

  /**
   * Hiệu ứng Bay Vào Tù (Dành cho sự kiện PLAYER_JAILED)
   */
  animateTokenJail(playerId, toIndex = 10) {
    const token = this.tokenContainers.get(playerId);
    if (!this.isReady || !token) return Promise.resolve();

    const { x, y } = getTileTransform(toIndex);
    return new Promise((resolve) => {
      this.playStepSound(180);
      this.tweens.add({
        targets: token,
        x,
        y,
        scale: { from: 1.4, to: 1.0 },
        duration: 450,
        ease: 'Back.Out',
        onComplete: () => {
          token.setData('tileIndex', toIndex);
          resolve();
        }
      });
    });
  }

  /**
   * Hiệu ứng Biến Động Tiền Tệ (1200ms): Bay cao 50px và mờ dần alpha 1 -> 0
   */
  showFloatingText(tileIndex, amount) {
    if (!this.isReady || !amount) return;
    const { x, y } = getTileTransform(tileIndex ?? 0);
    const isPositive = amount > 0;
    const label = `${isPositive ? '+' : ''}${amount}K`;
    const color = isPositive ? '#22C55E' : '#EF4444';

    const floatTxt = this.add.text(x, y - 14, label, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '22px',
      fontStyle: '800',
      color,
      stroke: '#0f172a',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: floatTxt,
      y: y - 64,
      alpha: { from: 1, to: 0 },
      duration: 1200,
      ease: 'Cubic.Out',
      onComplete: () => floatTxt.destroy()
    });
  }

  // Tạo âm thanh tiếng "cộc" nhẹ bằng Web Audio API không phụ thuộc file mp3 ngoài
  playStepSound(freq = 340) {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.065);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.07);
    } catch {
      // Bỏ qua nếu trình duyệt chưa cho phép phát âm thanh trước khi click
    }
  }
}
