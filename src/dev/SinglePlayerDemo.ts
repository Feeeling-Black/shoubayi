import { AutoPlayManager } from '../game/AutoPlayManager.ts';
import { createSeatPlayerIds, Room } from '../game/Room.ts';
import { SEATS, type Seat } from '../game/Seats.ts';
import type { Card } from '../rules/Card.ts';
import { HandAnalyzer } from '../rules/HandAnalyzer.ts';
import { HandComparator } from '../rules/HandComparator.ts';

const room = new Room('local-single-player', createSeatPlayerIds('local'));
const autoplay = new AutoPlayManager();
const analyzer = new HandAnalyzer();
const comparator = new HandComparator();

function describeCard(card: Card): string {
  if (card.rank === 'LZ') return card.id;
  return `${card.rank}${card.suit}`;
}

function describeCards(cards: Card[]): string {
  return cards.map(describeCard).join(' ');
}

function chooseFollowCards(seat: Seat): Card[] {
  const snapshot = room.snapshotFor(seat);
  if (!snapshot.lastPlay) return [];

  const hand = snapshot.hand;
  for (const card of hand) {
    const analysis = analyzer.analyze([card], snapshot.context);
    if (analysis.valid && comparator.canBeat(analysis, snapshot.lastPlay.analysis, snapshot.context)) {
      return [card];
    }
  }

  const grouped = new Map<string, Card[]>();
  for (const card of hand) {
    if (card.isLaizi || card.rank === 'LZ') continue;
    const current = grouped.get(card.rank) ?? [];
    current.push(card);
    grouped.set(card.rank, current);
  }

  for (const group of grouped.values()) {
    const analysis = analyzer.analyze(group, snapshot.context);
    if (analysis.valid && comparator.canBeat(analysis, snapshot.lastPlay.analysis, snapshot.context)) {
      return group;
    }
  }

  return [];
}

function chooseCards(seat: Seat): Card[] {
  const snapshot = room.snapshotFor(seat);
  if (!snapshot.lastPlay) {
    return autoplay.chooseLeadCards(snapshot.hand, snapshot.context);
  }
  return chooseFollowCards(seat);
}

const started = room.startRound({ levelRank: '3' });
console.log('手把一单机演示启动');
console.log(`房间: ${room.roomId}`);
console.log(`明牌: ${started.deal.starterCard.id} (${describeCard(started.deal.starterCard)})`);
console.log(`首出座位: ${started.deal.starterSeat}`);
console.log('初始手牌数:', SEATS.map((seat) => `${seat}=55`).join(', '));
console.log('');

for (let turn = 1; turn <= 80; turn += 1) {
  const state = room.getState();
  if (!state || state.phase === 'FINISHED') break;

  const seat = state.currentSeat;
  const selected = chooseCards(seat);
  if (selected.length === 0 && state.lastPlay) {
    const pass = room.pass(seat);
    console.log(`${String(turn).padStart(2, '0')}. ${seat} 过牌 -> ${pass.ok ? `下家 ${pass.state.currentSeat}` : pass.reason}`);
    continue;
  }

  if (selected.length === 0) {
    console.log(`${String(turn).padStart(2, '0')}. ${seat} 无可自动首出牌，演示停止`);
    break;
  }

  const play = room.playCards(seat, selected.map((card) => card.id));
  if (!play.ok) {
    console.log(`${String(turn).padStart(2, '0')}. ${seat} 出牌失败: ${play.reason}`);
    break;
  }

  const after = room.snapshotFor(seat);
  console.log(
    `${String(turn).padStart(2, '0')}. ${seat} 出 ${describeCards(selected)}`
    + ` [${play.validation?.analysis.type}]`
    + `，剩 ${after.hand.length} 张`
    + (play.state.phase === 'FINISHED' ? '，本局结束' : ` -> 下家 ${play.state.currentSeat}`)
  );
}

const finalState = room.getState();
if (finalState?.phase === 'FINISHED') {
  console.log('');
  console.log(`胜方: ${finalState.result?.winnerTeam}`);
  console.log(`升级: ${finalState.result?.levelUp}`);
  console.log(`完成顺序: ${finalState.finishedOrder.join(' > ')}`);
} else {
  console.log('');
  console.log('演示已跑到步数上限或遇到自动策略暂不能处理的局面。核心规则仍可继续通过 Room 手动调用。');
}
