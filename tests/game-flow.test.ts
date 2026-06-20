import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card, Rank, Suit } from '../src/rules/Card.ts';
import { HandAnalyzer } from '../src/rules/HandAnalyzer.ts';
import { AutoPlayManager } from '../src/game/AutoPlayManager.ts';
import { DealManager } from '../src/game/DealManager.ts';
import { GameStateMachine } from '../src/game/GameStateMachine.ts';
import { createSeatPlayerIds, Room } from '../src/game/Room.ts';
import { TributeManager } from '../src/game/TributeManager.ts';
import type { Seat } from '../src/game/Seats.ts';

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

function baseHands(overrides: Partial<Record<Seat, Card[]>> = {}): Record<Seat, Card[]> {
  return {
    A: overrides.A ?? hand(['3']),
    B: overrides.B ?? hand(['4']),
    C: overrides.C ?? hand(['5']),
    D: overrides.D ?? hand(['6'])
  };
}

test('deal manager creates 220 unique cards, four 55-card hands, and a concrete starter card owner', () => {
  const dealManager = new DealManager();
  const result = dealManager.deal(() => 0.42);

  assert.equal(result.deck.length, 220);
  assert.equal(new Set(result.deck.map((item) => item.id)).size, 220);
  assert.equal(result.hands.A.length, 55);
  assert.equal(result.hands.B.length, 55);
  assert.equal(result.hands.C.length, 55);
  assert.equal(result.hands.D.length, 55);
  assert.equal(result.hands[result.starterSeat].some((item) => item.id === result.starterCard.id), true);
});

test('hand analyzer allows same-color jokers and laizi cannot copy jokers', () => {
  const analyzer = new HandAnalyzer();
  const context = { levelRank: '5' as const };

  const singleBigJoker = analyzer.analyze(hand(['BJ']), context);
  assert.equal(singleBigJoker.valid, true);
  assert.equal(singleBigJoker.type, 'SAME_RANK');
  assert.equal(singleBigJoker.mainRank, 'BJ');

  const pairBigJoker = analyzer.analyze(hand(['BJ', 'BJ']), context);
  assert.equal(pairBigJoker.valid, true);
  assert.equal(pairBigJoker.type, 'SAME_RANK');
  assert.equal(pairBigJoker.isBomb, false);

  const pairSmallJoker = analyzer.analyze(hand(['SJ', 'SJ']), context);
  assert.equal(pairSmallJoker.valid, true);
  assert.equal(pairSmallJoker.type, 'SAME_RANK');
  assert.equal(pairSmallJoker.isBomb, false);

  const tripleBigJoker = analyzer.analyze(hand(['BJ', 'BJ', 'BJ']), context);
  assert.equal(tripleBigJoker.valid, true);
  assert.equal(tripleBigJoker.type, 'SAME_RANK');
  assert.equal(tripleBigJoker.isBomb, false);

  const laiziBigJoker = analyzer.analyze(hand(['BJ', 'LZ']), context);
  assert.equal(laiziBigJoker.valid, false);
});

test('state machine supports lead, pass loop, teammate catch-wind, and level-up result', () => {
  const machine = new GameStateMachine();
  const hands = baseHands({
    A: hand(['3']),
    B: hand(['4']),
    C: hand(['5']),
    D: hand(['6'])
  });
  let state = machine.createState({
    roomId: 'room-1',
    playerIds: { A: 'pa', B: 'pb', C: 'pc', D: 'pd' },
    hands,
    context: { levelRank: '7' },
    currentSeat: 'A'
  });

  const aPlay = machine.playCards(state, 'A', ids(hands.A));
  assert.equal(aPlay.ok, true);
  state = aPlay.state;
  assert.deepEqual(state.finishedOrder, ['A']);
  assert.equal(state.currentSeat, 'B');

  const bPass = machine.pass(state, 'B');
  assert.equal(bPass.ok, true);
  state = bPass.state;
  assert.equal(state.currentSeat, 'C');

  const cPass = machine.pass(state, 'C');
  assert.equal(cPass.ok, true);
  state = cPass.state;
  assert.equal(state.currentSeat, 'D');

  const dPass = machine.pass(state, 'D');
  assert.equal(dPass.ok, true);
  state = dPass.state;
  assert.equal(state.currentSeat, 'C');
  assert.equal(state.lastPlay, undefined);

  const cPlay = machine.playCards(state, 'C', ids(hands.C));
  assert.equal(cPlay.ok, true);
  assert.equal(cPlay.state.phase, 'FINISHED');
  assert.equal(cPlay.state.result?.winnerTeam, 'AC');
  assert.equal(cPlay.state.result?.loserRemaining, 2);
  assert.equal(cPlay.state.result?.levelUp, 2);
  assert.deepEqual(cPlay.state.result?.tributeLoserSeats, ['B', 'D']);
});

test('state machine marks only unfinished losing players as tribute contributors on one-level win', () => {
  const machine = new GameStateMachine();
  const hands = baseHands({
    A: hand(['3']),
    B: hand(['4']),
    C: hand(['5']),
    D: hand(['6'])
  });
  let state = machine.createState({
    roomId: 'room-1b',
    playerIds: { A: 'pa', B: 'pb', C: 'pc', D: 'pd' },
    hands,
    context: { levelRank: '7' },
    currentSeat: 'A'
  });

  const aPlay = machine.playCards(state, 'A', ids(hands.A));
  assert.equal(aPlay.ok, true);
  state = aPlay.state;

  const bPlay = machine.playCards(state, 'B', ids(hands.B));
  assert.equal(bPlay.ok, true);
  state = bPlay.state;

  const cPlay = machine.playCards(state, 'C', ids(hands.C));
  assert.equal(cPlay.ok, true);
  assert.equal(cPlay.state.phase, 'FINISHED');
  assert.equal(cPlay.state.result?.winnerTeam, 'AC');
  assert.equal(cPlay.state.result?.loserRemaining, 1);
  assert.equal(cPlay.state.result?.levelUp, 1);
  assert.deepEqual(cPlay.state.result?.tributeLoserSeats, ['D']);
});

test('state machine keeps first finisher team as winner even if teammate finishes last', () => {
  const machine = new GameStateMachine();
  const hands = baseHands({
    A: hand(['3']),
    B: hand(['4']),
    C: hand(['5']),
    D: hand(['6'])
  });
  let state = machine.createState({
    roomId: 'room-1c',
    playerIds: { A: 'pa', B: 'pb', C: 'pc', D: 'pd' },
    hands,
    context: { levelRank: '7' },
    currentSeat: 'A'
  });

  const aPlay = machine.playCards(state, 'A', ids(hands.A));
  assert.equal(aPlay.ok, true);
  state = aPlay.state;

  const bPlay = machine.playCards(state, 'B', ids(hands.B));
  assert.equal(bPlay.ok, true);
  state = bPlay.state;

  const cPass = machine.pass(state, 'C');
  assert.equal(cPass.ok, true);
  state = cPass.state;

  const dPlay = machine.playCards(state, 'D', ids(hands.D));
  assert.equal(dPlay.ok, true);
  assert.equal(dPlay.state.phase, 'PLAYING');
  state = dPlay.state;

  const cPassAgain = machine.pass(state, 'C');
  assert.equal(cPassAgain.ok, true);
  state = cPassAgain.state;
  assert.equal(state.currentSeat, 'C');
  assert.equal(state.lastPlay, undefined);

  const cPlay = machine.playCards(state, 'C', ids(hands.C));
  assert.equal(cPlay.ok, true);
  assert.equal(cPlay.state.phase, 'FINISHED');
  assert.equal(cPlay.state.result?.winnerTeam, 'AC');
  assert.equal(cPlay.state.result?.loserTeam, 'BD');
  assert.equal(cPlay.state.result?.loserRemaining, 0);
  assert.equal(cPlay.state.result?.levelUp, 0);
  assert.deepEqual(cPlay.state.result?.tributeLoserSeats, []);
});

test('state machine rejects illegal turn and non-owned card ids through PlayValidator', () => {
  const machine = new GameStateMachine();
  const hands = baseHands({ A: hand(['3']), B: hand(['4']) });
  const state = machine.createState({
    roomId: 'room-2',
    playerIds: { A: 'pa', B: 'pb', C: 'pc', D: 'pd' },
    hands,
    context: { levelRank: '7' },
    currentSeat: 'A'
  });

  assert.equal(machine.playCards(state, 'B', ids(hands.B)).reason, 'NOT_CURRENT_PLAYER');
  assert.equal(machine.playCards(state, 'A', ids(hands.B)).reason, 'CARD_NOT_IN_PLAYER_HAND');
});

test('tribute manager applies reverse, resist, and regular tribute priority', () => {
  const manager = new TributeManager();
  const context = { levelRank: '5' as const };

  const reverseHands = baseHands({
    A: hand(['3']),
    B: hand(['BJ', 'BJ', 'BJ', 'BJ']),
    C: hand(['5']),
    D: hand(['4'])
  });
  const reverse = manager.assess({
    loserSeats: ['B', 'D'],
    winnerSeats: ['A', 'C'],
    hands: reverseHands,
    context
  });
  assert.equal(reverse.mode, 'REVERSE');
  assert.equal(reverse.tributePool.length, 2);
  assert.equal(reverse.tributePool[1].card.rank, '5');

  const resistHands = baseHands({
    B: hand(['SJ', 'SJ', 'SJ']),
    D: hand(['4'])
  });
  const resist = manager.assess({
    loserSeats: ['B', 'D'],
    winnerSeats: ['A', 'C'],
    hands: resistHands,
    context
  });
  assert.equal(resist.mode, 'RESIST');
  assert.equal(resist.tributePool.length, 0);

  const normalHands = baseHands({
    B: hand(['2', 'A', '5']),
    D: hand(['K', 'LZ'])
  });
  const normal = manager.assess({
    loserSeats: ['B', 'D'],
    winnerSeats: ['A', 'C'],
    hands: normalHands,
    context
  });
  assert.equal(normal.mode, 'NORMAL');
  assert.equal(normal.tributePool[0].card.rank, '5');
  assert.equal(normal.tributePool[1].card.rank, 'K');
  assert.equal(manager.validateReturnCard(card('LZ')), false);
});

test('tribute manager only receives unfinished losing seats chosen by round result', () => {
  const manager = new TributeManager();
  const context = { levelRank: '5' as const };
  const hands = baseHands({
    B: hand(['A', '3']),
    D: hand(['2', '4'])
  });

  const oneContributor = manager.assess({
    loserSeats: ['D'],
    winnerSeats: ['A', 'C'],
    hands,
    context
  });
  assert.equal(oneContributor.mode, 'NORMAL');
  assert.deepEqual(oneContributor.tributePool.map((item) => item.fromSeat), ['D']);

  const twoContributors = manager.assess({
    loserSeats: ['B', 'D'],
    winnerSeats: ['A', 'C'],
    hands,
    context
  });
  assert.equal(twoContributors.mode, 'NORMAL');
  assert.deepEqual(twoContributors.tributePool.map((item) => item.fromSeat), ['B', 'D']);

  const noContributor = manager.assess({
    loserSeats: [],
    winnerSeats: ['A', 'C'],
    hands,
    context
  });
  assert.equal(noContributor.mode, 'NONE');
  assert.equal(noContributor.tributePool.length, 0);
});

test('normal double tribute lets winners select tribute cards, return cards, and starts from a contributor', () => {
  const manager = new TributeManager();
  const context = { levelRank: '5' as const };
  const hands = baseHands({
    A: hand(['3', '4']),
    B: hand(['BJ', '6']),
    C: hand(['7', '8']),
    D: hand(['SJ', '9'])
  });
  const assessment = manager.assess({
    loserSeats: ['B', 'D'],
    winnerSeats: ['A', 'C'],
    hands,
    context
  });

  let flow = manager.createFlow({
    assessment,
    winnerSeats: ['A', 'C'],
    firstFinishedSeat: 'A'
  });
  assert.equal(flow.phase, 'AWAITING_TRIBUTE_SELECTION');

  const bTribute = assessment.tributePool.find((item) => item.fromSeat === 'B');
  const dTribute = assessment.tributePool.find((item) => item.fromSeat === 'D');
  assert.ok(bTribute);
  assert.ok(dTribute);

  let result = manager.selectTributeCard({ state: flow, receiverSeat: 'A', tributeCardId: bTribute.card.id });
  assert.equal(result.ok, true);
  flow = result.state;
  assert.equal(flow.phase, 'AWAITING_TRIBUTE_SELECTION');

  result = manager.selectTributeCard({ state: flow, receiverSeat: 'C', tributeCardId: dTribute.card.id });
  assert.equal(result.ok, true);
  flow = result.state;
  assert.equal(flow.phase, 'AWAITING_RETURN_SELECTION');
  assert.deepEqual(flow.assignments.map((item) => `${item.receiveSeat}<-${item.tributeFromSeat}`), ['A<-B', 'C<-D']);

  const aReturn = hands.A.find((item) => item.rank === '3');
  const cReturn = hands.C.find((item) => item.rank === '7');
  assert.ok(aReturn);
  assert.ok(cReturn);

  result = manager.selectReturnCard({ state: flow, receiverSeat: 'A', returnCardId: aReturn.id, hands });
  assert.equal(result.ok, true);
  flow = result.state;
  assert.equal(flow.phase, 'AWAITING_RETURN_SELECTION');

  result = manager.selectReturnCard({ state: flow, receiverSeat: 'C', returnCardId: cReturn.id, hands, random: () => 0.75 });
  assert.equal(result.ok, true);
  flow = result.state;
  assert.equal(flow.phase, 'COMPLETE');
  assert.equal(flow.nextStarterSeat, 'D');

  result = manager.applyCompletedFlow({ state: flow, hands });
  assert.equal(result.ok, true);
  assert.equal(hands.A.some((item) => item.id === bTribute.card.id), true);
  assert.equal(hands.C.some((item) => item.id === dTribute.card.id), true);
  assert.equal(hands.B.some((item) => item.id === aReturn.id), true);
  assert.equal(hands.D.some((item) => item.id === cReturn.id), true);
});

test('normal single tribute shows tribute first, then waits for return card after acknowledgement', () => {
  const manager = new TributeManager();
  const context = { levelRank: '5' as const };
  const hands = baseHands({
    A: hand(['3', '4']),
    B: hand(['6']),
    C: hand(['7']),
    D: hand(['2', '9'])
  });
  const assessment = manager.assess({
    loserSeats: ['D'],
    winnerSeats: ['A', 'C'],
    hands,
    context
  });

  let flow = manager.createFlow({
    assessment,
    winnerSeats: ['A', 'C'],
    firstFinishedSeat: 'A'
  });

  assert.equal(flow.phase, 'AWAITING_TRIBUTE_ACK');
  assert.deepEqual(flow.assignments.map((item) => `${item.receiveSeat}<-${item.tributeFromSeat}`), ['A<-D']);

  const aReturn = hands.A.find((item) => item.rank === '3');
  assert.ok(aReturn);
  let result = manager.selectReturnCard({ state: flow, receiverSeat: 'A', returnCardId: aReturn.id, hands });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NOT_AWAITING_RETURN_SELECTION');

  result = manager.acknowledgeTribute({ state: flow, receiverSeat: 'A' });
  assert.equal(result.ok, true);
  flow = result.state;
  assert.equal(flow.phase, 'AWAITING_RETURN_SELECTION');
});

test('double tribute randomizes assignment when winners choose the same tribute card', () => {
  const manager = new TributeManager();
  const context = { levelRank: '5' as const };
  const hands = baseHands({
    B: hand(['BJ', '6']),
    D: hand(['SJ', '9'])
  });
  const assessment = manager.assess({
    loserSeats: ['B', 'D'],
    winnerSeats: ['A', 'C'],
    hands,
    context
  });
  const bTribute = assessment.tributePool.find((item) => item.fromSeat === 'B');
  assert.ok(bTribute);

  let flow = manager.createFlow({
    assessment,
    winnerSeats: ['A', 'C'],
    firstFinishedSeat: 'A'
  });
  flow = manager.selectTributeCard({ state: flow, receiverSeat: 'A', tributeCardId: bTribute.card.id }).state;
  flow = manager.selectTributeCard({ state: flow, receiverSeat: 'C', tributeCardId: bTribute.card.id, random: () => 0 }).state;

  assert.equal(flow.phase, 'AWAITING_RETURN_SELECTION');
  assert.deepEqual(flow.assignments.map((item) => item.tributeFromSeat).sort(), ['B', 'D']);
  assert.deepEqual(flow.assignments.map((item) => item.receiveSeat).sort(), ['A', 'C']);
});

test('resist, reverse, and no-tribute flows start from previous first finisher', () => {
  const manager = new TributeManager();
  const context = { levelRank: '5' as const };
  const resist = manager.assess({
    loserSeats: ['B'],
    winnerSeats: ['A', 'C'],
    hands: baseHands({ B: hand(['SJ', 'SJ', 'SJ']) }),
    context
  });
  const flow = manager.createFlow({
    assessment: resist,
    winnerSeats: ['A', 'C'],
    firstFinishedSeat: 'C'
  });

  assert.equal(flow.mode, 'RESIST');
  assert.equal(flow.phase, 'COMPLETE');
  assert.equal(flow.nextStarterSeat, 'C');
});

test('auto play chooses the smallest non-laizi non-bomb natural lead group without splitting', () => {
  const manager = new AutoPlayManager();
  const context = { levelRank: '5' as const };

  const single = manager.chooseLeadCards(hand(['5', '3', 'LZ']), context);
  assert.equal(single.length, 1);
  assert.equal(single[0].rank, '3');

  const pair = manager.chooseLeadCards(hand(['4', '4', '6', '6', '6']), context);
  assert.equal(pair.length, 2);
  assert.equal(pair[0].rank, '4');

  const noBomb = manager.chooseLeadCards(hand(['3', '3', '3', '3', '3', '3', '3', '3', 'LZ']), context);
  assert.equal(noBomb.length, 0);
});

test('room starts a dealt round, exposes per-seat snapshots, and applies play actions', () => {
  const room = new Room('room-3', createSeatPlayerIds());
  const started = room.startRound({ levelRank: '3' }, () => 0.2);
  const starterSeat = started.deal.starterSeat;
  const snapshot = room.snapshotFor(starterSeat);

  assert.equal(snapshot.roomId, 'room-3');
  assert.equal(snapshot.currentSeat, starterSeat);
  assert.equal(snapshot.hand.length, 55);
  assert.equal(snapshot.handCounts.A, 55);
  assert.equal(snapshot.starterCardId, started.deal.starterCard.id);

  const selected = [snapshot.hand.find((item) => !item.isLaizi && item.rank !== 'LZ') ?? snapshot.hand[0]];
  const play = room.playCards(starterSeat, ids(selected));

  assert.equal(play.ok, true);
  assert.equal(room.snapshotFor(starterSeat).hand.length, 54);
});
