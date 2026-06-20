import type { NormalRank, Rank } from './Card.ts';

const NATURAL_SEQUENCE: NormalRank[] = [
  '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
];

const BASE_POWER: NormalRank[] = [
  '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'
];

export function getRankWeight(rank: Rank, levelRank: NormalRank): number {
  if (rank === 'BJ') return 1000;
  if (rank === 'SJ') return 900;
  if (rank === 'LZ') return -1;
  if (rank === levelRank) return 800;
  if (rank === '2') return 700;
  return BASE_POWER.indexOf(rank) + 1;
}

export function isNormalRank(rank: Rank): rank is NormalRank {
  return rank !== 'BJ' && rank !== 'SJ' && rank !== 'LZ';
}

export function isSequenceRank(rank: Rank, levelRank: NormalRank): rank is NormalRank {
  return isNormalRank(rank) && rank !== '2' && rank !== levelRank;
}

export function getSequenceIndex(rank: NormalRank): number {
  return NATURAL_SEQUENCE.indexOf(rank);
}

export function areConsecutive(ranks: NormalRank[]): boolean {
  if (ranks.length <= 1) return true;
  const ordered = ranks.map(getSequenceIndex).sort((a, b) => a - b);
  if (ordered.some((index) => index < 0)) return false;

  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i] !== ordered[i - 1] + 1) return false;
  }

  return true;
}
