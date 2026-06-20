import type { Card, GameContext } from './Card.ts';
import { HandAnalyzer } from './HandAnalyzer.ts';
import { HandComparator } from './HandComparator.ts';
import type { HandAnalysis } from './HandType.ts';

export type LastPlay = {
  playerId: string;
  cardIds: string[];
  analysis: HandAnalysis;
};

export type PlayValidationInput = {
  playerId: string;
  currentPlayerId: string;
  playerHand: Card[];
  cardIds: string[];
  context: GameContext;
  lastPlay?: LastPlay;
};

export type PlayValidationResult = {
  ok: boolean;
  reason?: string;
  isLead: boolean;
  selectedCards: Card[];
  analysis: HandAnalysis;
  canBeat: boolean;
  willEmptyHand: boolean;
};

function invalidAnalysis(cards: Card[], reason: string): HandAnalysis {
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

function fail(cards: Card[], reason: string, isLead = false): PlayValidationResult {
  return {
    ok: false,
    reason,
    isLead,
    selectedCards: cards,
    analysis: invalidAnalysis(cards, reason),
    canBeat: false,
    willEmptyHand: false
  };
}

export class PlayValidator {
  private readonly analyzer: HandAnalyzer;
  private readonly comparator: HandComparator;

  constructor(analyzer = new HandAnalyzer(), comparator = new HandComparator()) {
    this.analyzer = analyzer;
    this.comparator = comparator;
  }

  validate(input: PlayValidationInput): PlayValidationResult {
    const isLead = input.lastPlay === undefined;

    if (input.playerId !== input.currentPlayerId) {
      return fail([], 'NOT_CURRENT_PLAYER', isLead);
    }

    if (input.cardIds.length === 0) {
      return fail([], 'NO_CARDS_SELECTED', isLead);
    }

    const uniqueCardIds = new Set(input.cardIds);
    if (uniqueCardIds.size !== input.cardIds.length) {
      return fail([], 'DUPLICATE_CARD_ID', isLead);
    }

    const handById = new Map(input.playerHand.map((card) => [card.id, card]));
    const selectedCards: Card[] = [];
    for (const cardId of input.cardIds) {
      const card = handById.get(cardId);
      if (!card) {
        return fail(selectedCards, 'CARD_NOT_IN_PLAYER_HAND', isLead);
      }
      selectedCards.push(card);
    }

    const willEmptyHand = selectedCards.length === input.playerHand.length;
    const analysis = input.context.isFinalLevelA && willEmptyHand
      ? this.analyzer.isValidFinalAWin(selectedCards, input.context)
      : this.analyzer.analyze(selectedCards, input.context);

    if (!analysis.valid) {
      return {
        ok: false,
        reason: analysis.reason ?? 'INVALID_HAND',
        isLead,
        selectedCards,
        analysis,
        canBeat: false,
        willEmptyHand
      };
    }

    if (isLead) {
      return {
        ok: true,
        isLead,
        selectedCards,
        analysis,
        canBeat: true,
        willEmptyHand
      };
    }

    if (!input.lastPlay.analysis.valid) {
      return {
        ok: false,
        reason: 'LAST_PLAY_INVALID',
        isLead,
        selectedCards,
        analysis,
        canBeat: false,
        willEmptyHand
      };
    }

    const canBeat = this.comparator.canBeat(analysis, input.lastPlay.analysis, input.context);
    if (!canBeat) {
      return {
        ok: false,
        reason: 'CANNOT_BEAT_LAST_PLAY',
        isLead,
        selectedCards,
        analysis,
        canBeat,
        willEmptyHand
      };
    }

    return {
      ok: true,
      isLead,
      selectedCards,
      analysis,
      canBeat,
      willEmptyHand
    };
  }
}
