import type { GameContext } from './Card.ts';
import type { HandAnalysis } from './HandType.ts';

const JOKER_BOMB_POWER: Record<string, number> = {
  JOKER_BOMB_BIG: 3,
  JOKER_BOMB_SMALL: 2,
  BOMB: 1
};

export class HandComparator {
  canBeat(current: HandAnalysis, previous: HandAnalysis, context: GameContext): boolean {
    void context;
    if (!current.valid || !previous.valid) return false;

    if (current.isBomb || previous.isBomb) {
      if (!current.isBomb) return false;
      if (!previous.isBomb) return true;
      return this.compareBomb(current, previous) > 0;
    }

    if (current.type !== previous.type) return false;
    if (current.totalCards !== previous.totalCards) return false;
    if (current.groupSize !== previous.groupSize) return false;
    if ((current.sequenceRanks?.length ?? 0) !== (previous.sequenceRanks?.length ?? 0)) return false;

    return (current.mainWeight ?? -1) > (previous.mainWeight ?? -1);
  }

  compareBomb(a: HandAnalysis, b: HandAnalysis): number {
    const aPower = JOKER_BOMB_POWER[a.type] ?? 0;
    const bPower = JOKER_BOMB_POWER[b.type] ?? 0;
    if (aPower !== bPower) return aPower - bPower;

    if (a.type === 'BOMB' && b.type === 'BOMB') {
      if (a.totalCards !== b.totalCards) return a.totalCards - b.totalCards;
      return (a.mainWeight ?? -1) - (b.mainWeight ?? -1);
    }

    return 0;
  }
}
