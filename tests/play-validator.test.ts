import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card, Rank, Suit } from '../src/rules/Card.ts';
import { HandAnalyzer } from '../src/rules/HandAnalyzer.ts';
import { PlayValidator } from '../src/rules/PlayValidator.ts';

const analyzer = new HandAnalyzer();
const validator = new PlayValidator();
const context = { levelRank: '5' as const };

let nextId = 0;

function card(rank: Rank, suit?: Suit): Card {
  nextId += 1;
  return {
    id: `${rank}-${nextId}`,
    rank,
    suit: suit ?? (rank === 'BJ' || rank === 'SJ' ? 'JOKER' : rank === 'LZ' ? 'LZ' : 'S'),
    isLaizi: rank === 'LZ'
  };
}

function hand(ranks: Rank[]): Card[] {
  return ranks.map((rank) => card(rank));
}

function ids(cards: Card[]): string[] {
  return cards.map((item) => item.id);
}

test('rejects play when it is not the player turn', () => {
  const playerHand = hand(['K', 'K']);
  const result = validator.validate({
    playerId: 'A',
    currentPlayerId: 'B',
    playerHand,
    cardIds: ids(playerHand),
    context
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NOT_CURRENT_PLAYER');
});

test('rejects card ids that are duplicated or not in the backend hand', () => {
  const playerHand = hand(['K', 'K']);
  const duplicate = validator.validate({
    playerId: 'A',
    currentPlayerId: 'A',
    playerHand,
    cardIds: [playerHand[0].id, playerHand[0].id],
    context
  });

  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'DUPLICATE_CARD_ID');

  const foreignCard = card('A');
  const foreign = validator.validate({
    playerId: 'A',
    currentPlayerId: 'A',
    playerHand,
    cardIds: [foreignCard.id],
    context
  });

  assert.equal(foreign.ok, false);
  assert.equal(foreign.reason, 'CARD_NOT_IN_PLAYER_HAND');
});

test('accepts legal lead play and returns structured hand analysis', () => {
  const playerHand = hand(['K', 'LZ', '3']);
  const result = validator.validate({
    playerId: 'A',
    currentPlayerId: 'A',
    playerHand,
    cardIds: ids(playerHand.slice(0, 2)),
    context
  });

  assert.equal(result.ok, true);
  assert.equal(result.isLead, true);
  assert.equal(result.analysis.type, 'SAME_RANK');
  assert.equal(result.analysis.mainRank, 'K');
  assert.deepEqual(result.analysis.laiziAssignments.map((item) => item.asRank), ['K']);
});

test('rejects follow play that cannot beat the last play', () => {
  const previousCards = hand(['4', '4']);
  const lastPlay = {
    playerId: 'A',
    cardIds: ids(previousCards),
    analysis: analyzer.analyze(previousCards, context)
  };
  const playerHand = hand(['3', '3']);
  const result = validator.validate({
    playerId: 'B',
    currentPlayerId: 'B',
    playerHand,
    cardIds: ids(playerHand),
    context,
    lastPlay
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'CANNOT_BEAT_LAST_PLAY');
  assert.equal(result.analysis.valid, true);
});

test('accepts follow play that beats by same structure or by bomb', () => {
  const previousCards = hand(['4', '4']);
  const lastPlay = {
    playerId: 'A',
    cardIds: ids(previousCards),
    analysis: analyzer.analyze(previousCards, context)
  };

  const pairHand = hand(['K', 'K', '3']);
  const pairResult = validator.validate({
    playerId: 'B',
    currentPlayerId: 'B',
    playerHand: pairHand,
    cardIds: ids(pairHand.slice(0, 2)),
    context,
    lastPlay
  });

  assert.equal(pairResult.ok, true);
  assert.equal(pairResult.canBeat, true);

  const bombHand = hand(['3', '3', '3', '3', '3', '3', '3', '3']);
  const bombResult = validator.validate({
    playerId: 'C',
    currentPlayerId: 'C',
    playerHand: bombHand,
    cardIds: ids(bombHand),
    context,
    lastPlay
  });

  assert.equal(bombResult.ok, true);
  assert.equal(bombResult.analysis.type, 'BOMB');
});

test('enforces final level A last-hand win rule only when the play empties the hand', () => {
  const invalidFinalHand = hand(['9', '10', 'J', 'Q', 'K', 'A']);
  const invalid = validator.validate({
    playerId: 'A',
    currentPlayerId: 'A',
    playerHand: invalidFinalHand,
    cardIds: ids(invalidFinalHand),
    context: { levelRank: 'A', isFinalLevelA: true }
  });

  assert.equal(invalid.ok, false);

  const validFinalHand = hand(['A', 'LZ']);
  const valid = validator.validate({
    playerId: 'A',
    currentPlayerId: 'A',
    playerHand: validFinalHand,
    cardIds: ids(validFinalHand),
    context: { levelRank: 'A', isFinalLevelA: true }
  });

  assert.equal(valid.ok, true);
  assert.equal(valid.willEmptyHand, true);
  assert.equal(valid.analysis.mainRank, 'A');

  const notLastHand = hand(['3', '4', '5', '6', '7', '8', 'K']);
  const normalStraight = validator.validate({
    playerId: 'A',
    currentPlayerId: 'A',
    playerHand: notLastHand,
    cardIds: ids(notLastHand.slice(0, 6)),
    context: { levelRank: 'A', isFinalLevelA: true }
  });

  assert.equal(normalStraight.ok, true);
  assert.equal(normalStraight.willEmptyHand, false);
});
