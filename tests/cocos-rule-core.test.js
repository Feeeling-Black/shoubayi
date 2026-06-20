import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

function loadRuleCore() {
  const filename = path.resolve('ShouBaYiCocos/assets/Script/ShouBaYiRuleCore.js');
  const code = fs.readFileSync(filename, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {}
  };
  vm.runInNewContext(code, sandbox, { filename });
  return sandbox.module.exports;
}

let nextId = 0;

function card(rank, suit = 'S') {
  nextId += 1;
  return {
    id: `${rank}-${nextId}`,
    rank,
    suit: rank === 'BJ' || rank === 'SJ' ? 'JOKER' : suit,
    label: rank === 'BJ' ? '大王' : rank === 'SJ' ? '小王' : `${rank}${suit}`
  };
}

function hand(ranks) {
  return ranks.map((rank) => card(rank));
}

test('cocos shared rule core keeps normal single tribute starter on contributor', () => {
  const core = loadRuleCore();
  const result = {
    firstFinishedSeat: 'A',
    winnerTeam: 'AC',
    loserTeam: 'BD',
    tributeLoserSeats: ['D']
  };
  const hands = {
    A: hand(['3', '4']),
    B: hand(['6']),
    C: hand(['7']),
    D: hand(['2', '9'])
  };

  const tribute = core.buildTribute(result, hands, '5', () => 0);

  assert.equal(tribute.modeKey, 'NORMAL');
  assert.equal(tribute.assignments.length, 1);
  assert.equal(tribute.assignments[0].fromSeat, 'D');
  assert.equal(tribute.assignments[0].receiveSeat, 'A');
  assert.equal(tribute.nextStarterSeat, 'D');
});

test('cocos shared rule core keeps resist starter on previous first finisher', () => {
  const core = loadRuleCore();
  const result = {
    firstFinishedSeat: 'C',
    winnerTeam: 'AC',
    loserTeam: 'BD',
    tributeLoserSeats: ['B']
  };
  const hands = {
    A: hand(['3']),
    B: hand(['SJ', 'SJ', 'SJ']),
    C: hand(['7']),
    D: hand(['9'])
  };

  const tribute = core.buildTribute(result, hands, '5', () => 0);

  assert.equal(tribute.modeKey, 'RESIST');
  assert.equal(tribute.nextStarterSeat, 'C');
});

test('cocos shared rule core reports catch-wind lead to teammate', () => {
  const core = loadRuleCore();

  const nextLead = core.nextLeadAfterTrick('A', ['B', 'C', 'D']);

  assert.equal(nextLead.catchWind, true);
  assert.equal(nextLead.fromSeat, 'A');
  assert.equal(nextLead.seat, 'C');
});

test('cocos shared rule core analyzes key hand shapes', () => {
  const core = loadRuleCore();

  assert.equal(core.analyzeCards(hand(['LZ']), '5'), null);

  const jokers = core.analyzeCards(hand(['BJ', 'BJ']), '5');
  assert.equal(jokers.type, 'SAME_RANK');
  assert.equal(jokers.isBomb || false, false);

  const bomb = core.analyzeCards(hand(['8', '8', '8', '8', '8', '8', '8', '8']), '5');
  assert.equal(bomb.type, 'BOMB');
  assert.equal(bomb.isBomb, true);

  const straight = core.analyzeCards(hand(['6', '7', '8', '9', '10', 'J']), '5');
  assert.equal(straight.type, 'STRAIGHT');

  const levelStraight = core.analyzeCards(hand(['3', '4', '5', '6', '7', '8']), '5');
  assert.equal(levelStraight, null);
});

test('cocos shared rule core compares follow plays', () => {
  const core = loadRuleCore();
  const previous = core.analyzeCards(hand(['7', '7']), '5');

  assert.equal(core.canBeatCards(hand(['8', '8']), previous, '5'), true);
  assert.equal(core.canBeatCards(hand(['6', '6']), previous, '5'), false);
  assert.equal(core.canBeatCards(hand(['9']), previous, '5'), false);
  assert.equal(core.canBeatCards(hand(['9', '9', '9', '9', '9', '9', '9', '9']), previous, '5'), true);
});

test('cocos shared rule core chooses automatic lead and follow cards', () => {
  const core = loadRuleCore();

  const lead = core.chooseLeadCards(hand(['5', '3', 'LZ']), '5');
  assert.equal(lead.length, 1);
  assert.equal(lead[0].rank, '3');

  const noBombLead = core.chooseLeadCards(hand(['3', '3', '3', '3', '3', '3', '3', '3', 'LZ']), '5');
  assert.equal(noBombLead.length, 0);

  const previous = core.analyzeCards(hand(['7', '7']), '5');
  const follow = core.chooseFollowCards(hand(['6', '8', '8', '9', 'LZ']), previous, '5');
  assert.equal(follow.length, 2);
  assert.equal(follow.map((item) => item.rank).join(','), '8,8');
});
