let playbackChain = Promise.resolve();

export function enqueueEventsAndRender(events, finalState, boardScene, uiManager) {
  playbackChain = playbackChain
    .then(() => playEventsAndRenderState(events, finalState, boardScene, uiManager))
    .catch((err) => {
      console.error('[EventPlayer] Lỗi khi phát sự kiện:', err);
      uiManager.setInteractiveLock(false);
    });
  return playbackChain;
}

export async function playEventsAndRenderState(events, finalState, boardScene, uiManager) {
  let jailedPlayerId = null;
  let rolledDice = finalState?.dice || [1, 1];
  let rolledSpeedDie = finalState?.speedDie ?? null;
  let hadCardModal = false;

  if (events && events.length > 0) {
    uiManager.setInteractiveLock(true);

    for (const ev of events) {
      switch (ev.type) {
        case 'DICE_ROLLED':
          rolledDice = ev.dice;
          rolledSpeedDie = ev.speedDie ?? null;
          uiManager.updateMiniDiceHUD(ev.dice[0], ev.dice[1], rolledSpeedDie);
          await boardScene.animateDiceRoll(ev.dice[0], ev.dice[1], rolledSpeedDie);
          break;

        case 'PLAYER_MOVED':
          uiManager.setInspectedTile(ev.to, false);
          boardScene.setInspectedTile(ev.to);
          await boardScene.animateTokenMove(ev.playerId, ev.from, ev.to, ev.passedStart);
          break;

        case 'PLAYER_JAILED':
          uiManager.setInspectedTile(ev.to, false);
          boardScene.setInspectedTile(ev.to);
          await boardScene.animateTokenJail(ev.playerId, ev.to);
          jailedPlayerId = ev.playerId;
          break;

        case 'CASH_CHANGED':
          boardScene.showFloatingText(ev.tileIndex, ev.amount);
          await new Promise(r => setTimeout(r, 300));
          break;

        case 'CARD_DRAWN':
          hadCardModal = true;
          await uiManager.showChanceOrCommunityCardModal(ev.deck, ev.card, ev.playerId, finalState, rolledDice, rolledSpeedDie);
          break;
      }
    }
  }

  boardScene.syncBoardState(finalState, uiManager.getInspectedTileIndex(finalState));
  await uiManager.onEventsBatchFinished(events || [], finalState, {
    jailedPlayerId,
    rolledDice,
    rolledSpeedDie,
    hadCardModal
  });
  uiManager.renderHUD(finalState);
  uiManager.setInteractiveLock(false);
}
