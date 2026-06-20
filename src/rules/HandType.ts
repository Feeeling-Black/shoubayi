import type { Card, Rank } from './Card.ts';

export type HandType =
  | 'INVALID'
  | 'SAME_RANK'
  | 'STRAIGHT'
  | 'MULTI_RUN'
  | 'BOMB'
  | 'JOKER_BOMB_BIG'
  | 'JOKER_BOMB_SMALL';

export type LaiziAssignment = {
  laiziCardId: string;
  asRank: Rank;
};

export type HandAnalysis = {
  valid: boolean;
  type: HandType;
  cards: Card[];
  totalCards: number;
  mainRank?: Rank;
  mainWeight?: number;
  groupSize?: number;
  sequenceRanks?: Rank[];
  laiziUsed: number;
  laiziAssignments: LaiziAssignment[];
  isBomb: boolean;
  canEnterDragonPool: boolean;
  reason?: string;
};
