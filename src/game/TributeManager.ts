import type { Card, GameContext } from '../rules/Card.ts';
import { getRankWeight } from '../rules/Rank.ts';
import type { Seat } from './Seats.ts';

export type TributeMode = 'REVERSE' | 'RESIST' | 'NORMAL' | 'NONE';

export type TributeCard = {
  fromSeat: Seat;
  card: Card;
};

export type TributeAssessment = {
  mode: TributeMode;
  reason: string;
  tributePool: TributeCard[];
};

export type TributeFlowPhase =
  | 'COMPLETE'
  | 'AWAITING_TRIBUTE_ACK'
  | 'AWAITING_TRIBUTE_SELECTION'
  | 'AWAITING_RETURN_SELECTION';

export type TributeAssignment = {
  tributeFromSeat: Seat;
  receiveSeat: Seat;
  tributeCard: Card;
  returnCard?: Card;
};

export type TributeFlowState = {
  mode: TributeMode;
  phase: TributeFlowPhase;
  reason: string;
  tributePool: TributeCard[];
  winnerSeats: Seat[];
  contributorSeats: Seat[];
  firstFinishedSeat: Seat;
  tributeSelections: Partial<Record<Seat, string>>;
  assignments: TributeAssignment[];
  nextStarterSeat?: Seat;
};

export type TributeFlowResult = {
  ok: boolean;
  reason?: string;
  state: TributeFlowState;
};

export class TributeManager {
  assess(input: {
    loserSeats: Seat[];
    winnerSeats: Seat[];
    hands: Record<Seat, Card[]>;
    context: GameContext;
  }): TributeAssessment {
    const reverse = input.loserSeats.some((seat) => this.hasPureJokers(input.hands[seat], 4));
    if (reverse) {
      return {
        mode: 'REVERSE',
        reason: 'LOSER_HAS_FOUR_PURE_BIG_OR_SMALL_JOKERS',
        tributePool: this.highestCards(input.winnerSeats, input.hands, input.context)
      };
    }

    const resist = input.loserSeats.some((seat) => this.hasPureJokers(input.hands[seat], 3));
    if (resist) {
      return {
        mode: 'RESIST',
        reason: 'LOSER_HAS_THREE_PURE_BIG_OR_SMALL_JOKERS',
        tributePool: []
      };
    }

    const tributePool = this.highestCards(input.loserSeats, input.hands, input.context);
    return {
      mode: tributePool.length === 0 ? 'NONE' : 'NORMAL',
      reason: tributePool.length === 0 ? 'NO_NON_LAIZI_TRIBUTE_CARD' : 'REGULAR_TRIBUTE',
      tributePool
    };
  }

  highestNonLaiziCard(hand: Card[], context: GameContext): Card | undefined {
    return hand
      .filter((card) => !card.isLaizi && card.rank !== 'LZ')
      .sort((a, b) => getRankWeight(b.rank, context.levelRank) - getRankWeight(a.rank, context.levelRank))[0];
  }

  validateReturnCard(card: Card): boolean {
    return !card.isLaizi && card.rank !== 'LZ';
  }

  createFlow(input: {
    assessment: TributeAssessment;
    winnerSeats: Seat[];
    firstFinishedSeat: Seat;
  }): TributeFlowState {
    const contributorSeats = input.assessment.tributePool.map((item) => item.fromSeat);
    if (input.assessment.mode !== 'NORMAL' || input.assessment.tributePool.length === 0) {
      return {
        mode: input.assessment.mode,
        phase: 'COMPLETE',
        reason: input.assessment.reason,
        tributePool: input.assessment.tributePool,
        winnerSeats: [...input.winnerSeats],
        contributorSeats,
        firstFinishedSeat: input.firstFinishedSeat,
        tributeSelections: {},
        assignments: [],
        nextStarterSeat: input.firstFinishedSeat
      };
    }

    if (input.assessment.tributePool.length === 1) {
      const [tribute] = input.assessment.tributePool;
      if (!tribute) throw new Error('Expected one tribute card.');
      const receiverSeat = input.winnerSeats.includes(input.firstFinishedSeat)
        ? input.firstFinishedSeat
        : input.winnerSeats[0];
      if (!receiverSeat) throw new Error('Expected at least one winner seat.');
      return {
        mode: 'NORMAL',
        phase: 'AWAITING_TRIBUTE_ACK',
        reason: input.assessment.reason,
        tributePool: input.assessment.tributePool,
        winnerSeats: [...input.winnerSeats],
        contributorSeats,
        firstFinishedSeat: input.firstFinishedSeat,
        tributeSelections: { [receiverSeat]: tribute.card.id },
        assignments: [{
          tributeFromSeat: tribute.fromSeat,
          receiveSeat: receiverSeat,
          tributeCard: tribute.card
        }],
        nextStarterSeat: undefined
      };
    }

    return {
      mode: 'NORMAL',
      phase: 'AWAITING_TRIBUTE_SELECTION',
      reason: input.assessment.reason,
      tributePool: input.assessment.tributePool,
      winnerSeats: [...input.winnerSeats],
      contributorSeats,
      firstFinishedSeat: input.firstFinishedSeat,
      tributeSelections: {},
      assignments: [],
      nextStarterSeat: undefined
    };
  }

  acknowledgeTribute(input: {
    state: TributeFlowState;
    receiverSeat: Seat;
  }): TributeFlowResult {
    const state = this.cloneFlow(input.state);
    if (state.phase !== 'AWAITING_TRIBUTE_ACK') {
      return { ok: false, reason: 'NOT_AWAITING_TRIBUTE_ACK', state };
    }

    const assignment = state.assignments.find((item) => item.receiveSeat === input.receiverSeat);
    if (!assignment) return { ok: false, reason: 'NO_TRIBUTE_ASSIGNED_TO_RECEIVER', state };

    state.phase = 'AWAITING_RETURN_SELECTION';
    return { ok: true, state };
  }

  selectTributeCard(input: {
    state: TributeFlowState;
    receiverSeat: Seat;
    tributeCardId: string;
    random?: () => number;
  }): TributeFlowResult {
    const state = this.cloneFlow(input.state);
    if (state.phase !== 'AWAITING_TRIBUTE_SELECTION') {
      return { ok: false, reason: 'NOT_AWAITING_TRIBUTE_SELECTION', state };
    }
    if (!state.winnerSeats.includes(input.receiverSeat)) {
      return { ok: false, reason: 'NOT_WINNER_SEAT', state };
    }
    if (!state.tributePool.some((item) => item.card.id === input.tributeCardId)) {
      return { ok: false, reason: 'TRIBUTE_CARD_NOT_IN_POOL', state };
    }

    state.tributeSelections[input.receiverSeat] = input.tributeCardId;
    if (!state.winnerSeats.every((seat) => state.tributeSelections[seat])) {
      return { ok: true, state };
    }

    state.assignments = this.resolveTributeAssignments(state, input.random ?? Math.random);
    state.phase = 'AWAITING_RETURN_SELECTION';
    return { ok: true, state };
  }

  selectReturnCard(input: {
    state: TributeFlowState;
    receiverSeat: Seat;
    returnCardId: string;
    hands: Record<Seat, Card[]>;
    random?: () => number;
  }): TributeFlowResult {
    const state = this.cloneFlow(input.state);
    if (state.phase !== 'AWAITING_RETURN_SELECTION') {
      return { ok: false, reason: 'NOT_AWAITING_RETURN_SELECTION', state };
    }

    const assignment = state.assignments.find((item) => item.receiveSeat === input.receiverSeat);
    if (!assignment) return { ok: false, reason: 'NO_TRIBUTE_ASSIGNED_TO_RECEIVER', state };

    const returnCard = input.hands[input.receiverSeat].find((card) => card.id === input.returnCardId);
    if (!returnCard) return { ok: false, reason: 'RETURN_CARD_NOT_IN_RECEIVER_HAND', state };
    if (!this.validateReturnCard(returnCard)) return { ok: false, reason: 'INVALID_RETURN_CARD', state };

    assignment.returnCard = returnCard;
    if (state.assignments.every((item) => item.returnCard)) {
      state.phase = 'COMPLETE';
      state.nextStarterSeat = this.randomSeat(state.contributorSeats, input.random ?? Math.random);
    }
    return { ok: true, state };
  }

  applyCompletedFlow(input: {
    state: TributeFlowState;
    hands: Record<Seat, Card[]>;
  }): TributeFlowResult {
    const state = this.cloneFlow(input.state);
    if (state.phase !== 'COMPLETE') return { ok: false, reason: 'TRIBUTE_FLOW_NOT_COMPLETE', state };

    for (const assignment of state.assignments) {
      this.moveCard(input.hands, assignment.tributeFromSeat, assignment.receiveSeat, assignment.tributeCard.id);
      if (assignment.returnCard) {
        this.moveCard(input.hands, assignment.receiveSeat, assignment.tributeFromSeat, assignment.returnCard.id);
      }
    }

    return { ok: true, state };
  }

  private highestCards(seats: Seat[], hands: Record<Seat, Card[]>, context: GameContext): TributeCard[] {
    return seats.flatMap((seat) => {
      const card = this.highestNonLaiziCard(hands[seat], context);
      return card ? [{ fromSeat: seat, card }] : [];
    });
  }

  private hasPureJokers(hand: Card[], count: 3 | 4): boolean {
    const big = hand.filter((card) => card.rank === 'BJ').length;
    const small = hand.filter((card) => card.rank === 'SJ').length;
    return big >= count || small >= count;
  }

  private resolveTributeAssignments(state: TributeFlowState, random: () => number): TributeAssignment[] {
    if (state.tributePool.length === 1) {
      const [onlyTribute] = state.tributePool;
      if (!onlyTribute) throw new Error('Expected one tribute card.');
      const selectedReceiver = state.winnerSeats.find((seat) => state.tributeSelections[seat] === onlyTribute.card.id)
        ?? state.winnerSeats[0];
      if (!selectedReceiver) throw new Error('Expected at least one winner seat.');
      return [{
        tributeFromSeat: onlyTribute.fromSeat,
        receiveSeat: selectedReceiver,
        tributeCard: onlyTribute.card
      }];
    }

    const selectedIds = state.winnerSeats.map((seat) => state.tributeSelections[seat]);
    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size === state.winnerSeats.length) {
      return state.winnerSeats.map((seat) => {
        const selected = state.tributePool.find((item) => item.card.id === state.tributeSelections[seat]);
        if (!selected) throw new Error('Selected tribute card disappeared.');
        return {
          tributeFromSeat: selected.fromSeat,
          receiveSeat: seat,
          tributeCard: selected.card
        };
      });
    }

    const shuffledPool = this.shuffleTributePool(state.tributePool, random);
    return state.winnerSeats.map((seat, index) => {
      const tribute = shuffledPool[index];
      if (!tribute) throw new Error('Not enough tribute cards to assign.');
      return {
        tributeFromSeat: tribute.fromSeat,
        receiveSeat: seat,
        tributeCard: tribute.card
      };
    });
  }

  private cloneFlow(state: TributeFlowState): TributeFlowState {
    return {
      ...state,
      tributePool: state.tributePool.map((item) => ({ ...item })),
      winnerSeats: [...state.winnerSeats],
      contributorSeats: [...state.contributorSeats],
      tributeSelections: { ...state.tributeSelections },
      assignments: state.assignments.map((item) => ({ ...item }))
    };
  }

  private randomSeat(seats: Seat[], random: () => number): Seat | undefined {
    if (seats.length === 0) return undefined;
    return seats[Math.floor(random() * seats.length) % seats.length];
  }

  private shuffleTributePool(pool: TributeCard[], random: () => number): TributeCard[] {
    const copy = pool.map((item) => ({ ...item }));
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  private moveCard(hands: Record<Seat, Card[]>, fromSeat: Seat, toSeat: Seat, cardId: string): void {
    const index = hands[fromSeat].findIndex((card) => card.id === cardId);
    if (index < 0) throw new Error(`Card ${cardId} is not in ${fromSeat}'s hand.`);
    const [card] = hands[fromSeat].splice(index, 1);
    if (!card) throw new Error(`Card ${cardId} could not be moved.`);
    hands[toSeat].push(card);
  }
}
