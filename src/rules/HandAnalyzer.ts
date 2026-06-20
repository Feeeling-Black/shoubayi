import type { Card, GameContext, NormalRank, Rank } from './Card.ts';
import type { HandAnalysis, HandType, LaiziAssignment } from './HandType.ts';
import { areConsecutive, getRankWeight, isNormalRank, isSequenceRank } from './Rank.ts';

type RankGroup = {
  rank: Rank;
  cards: Card[];
};

function invalid(cards: Card[], reason: string): HandAnalysis {
  return {
    valid: false,
    type: 'INVALID',
    cards,
    totalCards: cards.length,
    laiziUsed: cards.filter((card) => card.isLaizi || card.rank === 'LZ').length,
    laiziAssignments: [],
    isBomb: false,
    canEnterDragonPool: false,
    reason
  };
}

function valid(
  cards: Card[],
  type: HandType,
  context: GameContext,
  details: Partial<HandAnalysis> = {}
): HandAnalysis {
  const mainRank = details.mainRank;
  return {
    valid: true,
    type,
    cards,
    totalCards: cards.length,
    mainRank,
    mainWeight: mainRank ? getRankWeight(mainRank, context.levelRank) : undefined,
    groupSize: details.groupSize,
    sequenceRanks: details.sequenceRanks,
    laiziUsed: details.laiziUsed ?? 0,
    laiziAssignments: details.laiziAssignments ?? [],
    isBomb: details.isBomb ?? false,
    canEnterDragonPool: details.canEnterDragonPool ?? false,
    reason: details.reason
  };
}

function groupByRank(cards: Card[]): RankGroup[] {
  const groups = new Map<Rank, Card[]>();
  for (const card of cards) {
    const current = groups.get(card.rank) ?? [];
    current.push(card);
    groups.set(card.rank, current);
  }

  return [...groups.entries()].map(([rank, groupedCards]) => ({
    rank,
    cards: groupedCards
  }));
}

function splitLaizi(cards: Card[]): { laizi: Card[]; natural: Card[] } {
  return {
    laizi: cards.filter((card) => card.isLaizi || card.rank === 'LZ'),
    natural: cards.filter((card) => !card.isLaizi && card.rank !== 'LZ')
  };
}

function assignments(laizi: Card[], asRank: Rank): LaiziAssignment[] {
  return laizi.map((card) => ({
    laiziCardId: card.id,
    asRank
  }));
}

function analyzeJokerBomb(cards: Card[], context: GameContext): HandAnalysis | undefined {
  if (cards.length !== 4) return undefined;
  if (cards.every((card) => card.rank === 'BJ')) {
    return valid(cards, 'JOKER_BOMB_BIG', context, {
      mainRank: 'BJ',
      groupSize: 4,
      isBomb: true
    });
  }

  if (cards.every((card) => card.rank === 'SJ')) {
    return valid(cards, 'JOKER_BOMB_SMALL', context, {
      mainRank: 'SJ',
      groupSize: 4,
      isBomb: true
    });
  }

  return undefined;
}

function analyzeNaturalBomb(cards: Card[], context: GameContext, natural: Card[], laizi: Card[]): HandAnalysis | undefined {
  if (laizi.length > 0 || natural.length < 8) return undefined;
  const groups = groupByRank(natural);
  if (groups.length !== 1) return undefined;
  const [{ rank }] = groups;
  if (!isNormalRank(rank)) return undefined;

  return valid(cards, 'BOMB', context, {
    mainRank: rank,
    groupSize: natural.length,
    isBomb: true
  });
}

function analyzeSameRank(cards: Card[], context: GameContext, natural: Card[], laizi: Card[]): HandAnalysis | undefined {
  if (natural.length === 0) return undefined;
  const groups = groupByRank(natural);
  if (groups.length !== 1) return undefined;
  const [{ rank }] = groups;
  if (rank === 'LZ') return undefined;
  if (rank === 'BJ' || rank === 'SJ') {
    if (laizi.length > 0) return undefined;
  }

  return valid(cards, 'SAME_RANK', context, {
    mainRank: rank,
    groupSize: cards.length,
    laiziUsed: laizi.length,
    laiziAssignments: assignments(laizi, rank)
  });
}

function analyzeStraight(cards: Card[], context: GameContext, natural: Card[], laizi: Card[]): HandAnalysis | undefined {
  if (laizi.length > 0 || cards.length < 6) return undefined;
  if (!natural.every((card) => isSequenceRank(card.rank, context.levelRank))) return undefined;
  const ranks = natural.map((card) => card.rank as NormalRank);
  if (new Set(ranks).size !== cards.length) return undefined;
  if (!areConsecutive(ranks)) return undefined;

  const highRank = [...ranks].sort((a, b) => getRankWeight(b, context.levelRank) - getRankWeight(a, context.levelRank))[0];
  return valid(cards, 'STRAIGHT', context, {
    mainRank: highRank,
    groupSize: 1,
    sequenceRanks: ranks
  });
}

function analyzeMultiRun(cards: Card[], context: GameContext, natural: Card[], laizi: Card[]): HandAnalysis | undefined {
  if (cards.length < 6 || natural.length === 0) return undefined;
  if (!natural.every((card) => isSequenceRank(card.rank, context.levelRank))) return undefined;

  const groups = groupByRank(natural);
  if (!groups.every((group) => isNormalRank(group.rank))) return undefined;

  const naturalRanks = groups.map((group) => group.rank as NormalRank);
  if (!areConsecutive(naturalRanks)) return undefined;
  if (groups.some((group) => group.cards.length >= 8)) return undefined;

  const maxNaturalCount = Math.max(...groups.map((group) => group.cards.length));
  for (let groupSize = 2; groupSize <= 7; groupSize += 1) {
    const needed = groups.reduce((sum, group) => {
      if (group.cards.length > groupSize) return Number.POSITIVE_INFINITY;
      return sum + (groupSize - group.cards.length);
    }, 0);

    if (needed !== laizi.length) continue;
    if (groupSize < maxNaturalCount) continue;
    if (groupSize * groups.length !== cards.length) continue;

    const assigned: LaiziAssignment[] = [];
    let cursor = 0;
    for (const group of groups) {
      for (let i = group.cards.length; i < groupSize; i += 1) {
        assigned.push({
          laiziCardId: laizi[cursor].id,
          asRank: group.rank
        });
        cursor += 1;
      }
    }

    const highRank = [...naturalRanks].sort((a, b) => getRankWeight(b, context.levelRank) - getRankWeight(a, context.levelRank))[0];
    return valid(cards, 'MULTI_RUN', context, {
      mainRank: highRank,
      groupSize,
      sequenceRanks: naturalRanks,
      laiziUsed: laizi.length,
      laiziAssignments: assigned,
      canEnterDragonPool: laizi.length > 0
    });
  }

  return undefined;
}

export class HandAnalyzer {
  analyze(cards: Card[], context: GameContext): HandAnalysis {
    if (cards.length === 0) return invalid(cards, '不能空出');

    const { laizi, natural } = splitLaizi(cards);
    if (natural.length === 0) return invalid(cards, '不能单独出癞子或纯癞子组合');

    const jokerBomb = analyzeJokerBomb(cards, context);
    if (jokerBomb) return jokerBomb;

    const naturalBomb = analyzeNaturalBomb(cards, context, natural, laizi);
    if (naturalBomb) return naturalBomb;

    const sameRank = analyzeSameRank(cards, context, natural, laizi);
    if (sameRank) return sameRank;

    const straight = analyzeStraight(cards, context, natural, laizi);
    if (straight) return straight;

    const multiRun = analyzeMultiRun(cards, context, natural, laizi);
    if (multiRun) return multiRun;

    return invalid(cards, '不符合手把一牌型规则');
  }

  isValidFinalAWin(cards: Card[], context: GameContext): HandAnalysis {
    const analysis = this.analyze(cards, { ...context, levelRank: 'A', isFinalLevelA: true });
    if (!analysis.valid) return analysis;
    if (analysis.type !== 'SAME_RANK' && analysis.type !== 'BOMB') {
      return invalid(cards, '最终打A最后一手必须是纯A同张组合');
    }
    if (analysis.mainRank !== 'A') {
      return invalid(cards, '最终打A最后一手必须由A本身组成');
    }
    return analysis;
  }
}
