let playbackChain = Promise.resolve();

export function enqueueEventsAndRender(events, finalState, phaserBoardScene, uiManager) {
  playbackChain = playbackChain
    .then(() => playEventsAndRenderState(events, finalState, phaserBoardScene, uiManager))
    .catch((err) => {
      console.error('[EventPlayer] Lỗi khi phát sự kiện:', err);
      uiManager.setInteractiveLock(false);
    });
  return playbackChain;
}

export async function playEventsAndRenderState(events, finalState, phaserBoardScene, uiManager) {
  if (events && events.length > 0) {
    uiManager.setInteractiveLock(true);

    for (const ev of events) {
      switch (ev.type) {
        case 'DICE_ROLLED':
          await phaserBoardScene.animateDiceRoll(ev.dice[0], ev.dice[1]);
          break;

        case 'PLAYER_MOVED':
          await phaserBoardScene.animateTokenMove(ev.playerId, ev.from, ev.to, ev.passedStart);
          break;

        case 'PLAYER_JAILED':
          await phaserBoardScene.animateTokenJail(ev.playerId, ev.to);
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
  }

  phaserBoardScene.syncBoardOwnersAndBuildings(finalState.board, finalState.players);
  uiManager.renderHUD(finalState);
  uiManager.setInteractiveLock(false);
}
