import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card, Rank, Suit } from '../src/rules/Card.ts';
import { HandAnalyzer } from '../src/rules/HandAnalyzer.ts';
import { HandComparator } from '../src/rules/HandComparator.ts';

const analyzer = new HandAnalyzer();
const comparator = new HandComparator();
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

function cards(ranks: Rank[]): Card[] {
  return ranks.map((rank) => card(rank));
}

function repeat(rank: Rank, count: number): Card[] {
  return Array.from({ length: count }, () => card(rank));
}

test('癞子不能单独出，也不能组成纯癞子牌型', () => {
  assert.equal(analyzer.analyze(cards(['LZ']), context).valid, false);
  assert.equal(analyzer.analyze(cards(['LZ', 'LZ']), context).valid, false);
});

test('癞子可以补同张牌型，但不会补成炸弹', () => {
  const pair = analyzer.analyze(cards(['K', 'LZ']), context);
  assert.equal(pair.valid, true);
  assert.equal(pair.type, 'SAME_RANK');
  assert.equal(pair.mainRank, 'K');
  assert.equal(pair.groupSize, 2);
  assert.deepEqual(pair.laiziAssignments.map((item) => item.asRank), ['K']);

  const triple = analyzer.analyze(cards(['K', 'K', 'LZ']), context);
  assert.equal(triple.valid, true);
  assert.equal(triple.groupSize, 3);

  const sevenPlusLaizi = analyzer.analyze([...repeat('K', 7), card('LZ')], context);
  assert.equal(sevenPlusLaizi.valid, true);
  assert.equal(sevenPlusLaizi.type, 'SAME_RANK');
  assert.equal(sevenPlusLaizi.isBomb, false);

  const eightPlusLaizi = analyzer.analyze([...repeat('K', 8), card('LZ')], context);
  assert.equal(eightPlusLaizi.valid, true);
  assert.equal(eightPlusLaizi.type, 'SAME_RANK');
  assert.equal(eightPlusLaizi.isBomb, false);
});

test('天然8张及以上同点数是普通炸弹', () => {
  const bomb = analyzer.analyze(repeat('K', 8), context);
  assert.equal(bomb.valid, true);
  assert.equal(bomb.type, 'BOMB');
  assert.equal(bomb.isBomb, true);
  assert.equal(bomb.groupSize, 8);
});

test('单顺最少6张，不能带2、当前级牌、癞子或王', () => {
  assert.equal(analyzer.analyze(cards(['10', 'J', 'Q', 'K', 'A']), context).valid, false);

  const straight = analyzer.analyze(cards(['9', '10', 'J', 'Q', 'K', 'A']), context);
  assert.equal(straight.valid, true);
  assert.equal(straight.type, 'STRAIGHT');

  assert.equal(analyzer.analyze(cards(['A', '2', '3', '4', '5', '6']), context).valid, false);
  assert.equal(analyzer.analyze(cards(['3', '4', '5', '6', '5', '8']), context).valid, false);
  assert.equal(analyzer.analyze(cards(['3', '4', '5', '6', 'LZ', '8']), context).valid, false);
});

test('连对和多张连遵守最少6张及癞子只补已有点数规则', () => {
  assert.equal(analyzer.analyze(cards(['3', '3', '4', '4']), context).valid, false);

  const pairs = analyzer.analyze(cards(['3', '3', '4', '4', '5', '5']), { levelRank: '6' });
  assert.equal(pairs.valid, true);
  assert.equal(pairs.type, 'MULTI_RUN');
  assert.equal(pairs.groupSize, 2);

  const triples = analyzer.analyze(cards(['3', '3', '3', '4', '4', '4']), { levelRank: '6' });
  assert.equal(triples.valid, true);
  assert.equal(triples.type, 'MULTI_RUN');
  assert.equal(triples.groupSize, 3);

  const fourRun = analyzer.analyze(cards(['4', '4', '4', '4', '6', '6', '6', '6']), { levelRank: '5' });
  assert.equal(fourRun.valid, false);

  const legalFourRun = analyzer.analyze(cards(['4', '4', '4', '4', '5', '5', '5', '5']), { levelRank: '6' });
  assert.equal(legalFourRun.valid, true);
  assert.equal(legalFourRun.groupSize, 4);

  const noCreatedRank = analyzer.analyze(cards(['4', '4', '5', '5', 'LZ', 'LZ']), { levelRank: '7' });
  assert.equal(noCreatedRank.valid, true);
  assert.deepEqual(noCreatedRank.laiziAssignments.map((item) => item.asRank), ['4', '5']);

  const laiziFillExisting = analyzer.analyze(cards(['4', '4', '5', '5', '6', 'LZ']), { levelRank: '7' });
  assert.equal(laiziFillExisting.valid, true);
  assert.equal(laiziFillExisting.type, 'MULTI_RUN');
  assert.deepEqual(laiziFillExisting.laiziAssignments.map((item) => item.asRank), ['6']);

  const laiziFourRun = analyzer.analyze(cards(['LZ', '4', '4', '4', '5', '5', '5', '5']), { levelRank: '3' });
  assert.equal(laiziFourRun.valid, true);
  assert.equal(laiziFourRun.type, 'MULTI_RUN');
  assert.equal(laiziFourRun.groupSize, 4);
  assert.deepEqual(laiziFourRun.sequenceRanks, ['4', '5']);
  assert.deepEqual(laiziFourRun.laiziAssignments.map((item) => item.asRank), ['4']);
});

test('王炸只允许4纯大王或4纯小王，混合王不成炸', () => {
  const big = analyzer.analyze(repeat('BJ', 4), context);
  assert.equal(big.valid, true);
  assert.equal(big.type, 'JOKER_BOMB_BIG');
  assert.equal(big.isBomb, true);

  const small = analyzer.analyze(repeat('SJ', 4), context);
  assert.equal(small.valid, true);
  assert.equal(small.type, 'JOKER_BOMB_SMALL');
  assert.equal(small.isBomb, true);

  assert.equal(analyzer.analyze(cards(['BJ', 'BJ', 'SJ', 'SJ']), context).isBomb, false);
  assert.equal(analyzer.analyze(cards(['BJ', 'BJ', 'BJ', 'SJ']), context).isBomb, false);
});

test('炸弹先比张数，再比动态牌力；王炸高于普通炸弹', () => {
  const nine3 = analyzer.analyze(repeat('3', 9), context);
  const eightA = analyzer.analyze(repeat('A', 8), context);
  assert.equal(comparator.canBeat(nine3, eightA, context), true);

  const eightLevel = analyzer.analyze(repeat('5', 8), context);
  const eight2 = analyzer.analyze(repeat('2', 8), context);
  assert.equal(comparator.canBeat(eightLevel, eight2, context), true);

  const smallJokerBomb = analyzer.analyze(repeat('SJ', 4), context);
  assert.equal(comparator.canBeat(smallJokerBomb, nine3, context), true);

  const bigJokerBomb = analyzer.analyze(repeat('BJ', 4), context);
  assert.equal(comparator.canBeat(bigJokerBomb, smallJokerBomb, context), true);
});

test('最终打到A时，最后一手必须是纯A同张组合', () => {
  assert.equal(analyzer.isValidFinalAWin(cards(['9', '10', 'J', 'Q', 'K', 'A']), context).valid, false);

  const win = analyzer.isValidFinalAWin(cards(['A', 'LZ']), context);
  assert.equal(win.valid, true);
  assert.equal(win.type, 'SAME_RANK');
  assert.equal(win.mainRank, 'A');
});
