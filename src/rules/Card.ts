export type Rank =
  | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A' | '2'
  | 'SJ'
  | 'BJ'
  | 'LZ';

export type NormalRank = Exclude<Rank, 'SJ' | 'BJ' | 'LZ'>;

export type Suit = 'S' | 'H' | 'C' | 'D' | 'JOKER' | 'LZ';

export type Card = {
  id: string;
  deckIndex?: number;
  suit: Suit;
  rank: Rank;
  isLaizi: boolean;
};

export type GameContext = {
  levelRank: NormalRank;
  isFinalLevelA?: boolean;
};
