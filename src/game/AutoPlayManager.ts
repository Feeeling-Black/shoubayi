import type { Card, GameContext, Rank } from '../rules/Card.ts';
import { HandAnalyzer } from '../rules/HandAnalyzer.ts';
import { getRankWeight } from '../rules/Rank.ts';

type RankGroup = {
  rank: Rank;
  cards: Card[];
  weight: number;
};

export class AutoPlayManager {
  private readonly analyzer: HandAnalyzer;

  constructor(analyzer = new HandAnalyzer()) {
    this.analyzer = analyzer;
  }

  chooseLeadCards(hand: Card[], context: GameContext): Card[] {
    const groups = this.groupNaturalCards(hand, context)
      .filter((group) => !this.isBombLike(group))
      .sort((a, b) => a.cards.length - b.cards.length || a.weight - b.weight);

    for (const size of [1, 2, 3]) {
      const exact = groups
        .filter((group) => group.cards.length === size)
        .sort((a, b) => a.weight - b.weight)[0];
      if (exact && this.analyzer.analyze(exact.cards, context).valid) {
        return exact.cards;
      }
    }

    for (const group of groups) {
      const analysis = this.analyzer.analyze(group.cards, context);
      if (analysis.valid && !analysis.isBomb && analysis.laiziUsed === 0) {
        return group.cards;
      }
    }

    return [];
  }

  private groupNaturalCards(hand: Card[], context: GameContext): RankGroup[] {
    const groups = new Map<Rank, Card[]>();
    for (const card of hand) {
      if (card.isLaizi || card.rank === 'LZ') continue;
      const current = groups.get(card.rank) ?? [];
      current.push(card);
      groups.set(card.rank, current);
    }

    return [...groups.entries()].map(([rank, cards]) => ({
      rank,
      cards,
      weight: getRankWeight(rank, context.levelRank)
    }));
  }

  private isBombLike(group: RankGroup): boolean {
    if ((group.rank === 'BJ' || group.rank === 'SJ') && group.cards.length === 4) return true;
    return group.cards.length >= 8;
  }
}
