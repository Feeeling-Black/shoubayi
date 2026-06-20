import type { Card, GameContext } from '../rules/Card.ts';
import { PlayValidator } from '../rules/PlayValidator.ts';
import type { GameActionResult, GameState, PlayerState, RoundResult } from './GameState.ts';
import { nextSeatMatching, seatsForTeam, teamOf, teammateOf, type Seat, type TeamId } from './Seats.ts';

export type CreateGameStateInput = {
  roomId: string;
  playerIds: Record<Seat, string>;
  hands: Record<Seat, Card[]>;
  context: GameContext;
  currentSeat: Seat;
  starterCardId?: string;
};

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: {
      A: { ...state.players.A, hand: [...state.players.A.hand] },
      B: { ...state.players.B, hand: [...state.players.B.hand] },
      C: { ...state.players.C, hand: [...state.players.C.hand] },
      D: { ...state.players.D, hand: [...state.players.D.hand] }
    },
    passedSeats: [...state.passedSeats],
    finishedOrder: [...state.finishedOrder],
    lastPlay: state.lastPlay ? { ...state.lastPlay, cardIds: [...state.lastPlay.cardIds] } : undefined,
    result: state.result ? { ...state.result, finishedOrder: [...state.result.finishedOrder] } : undefined
  };
}

function removeCards(hand: Card[], cardIds: string[]): Card[] {
  const selected = new Set(cardIds);
  return hand.filter((card) => !selected.has(card.id));
}

export class GameStateMachine {
  private readonly validator: PlayValidator;

  constructor(validator = new PlayValidator()) {
    this.validator = validator;
  }

  createState(input: CreateGameStateInput): GameState {
    const players = {} as Record<Seat, PlayerState>;
    for (const seat of ['A', 'B', 'C', 'D'] satisfies Seat[]) {
      players[seat] = {
        playerId: input.playerIds[seat],
        seat,
        teamId: teamOf(seat),
        hand: [...input.hands[seat]]
      };
    }

    return {
      roomId: input.roomId,
      phase: 'PLAYING',
      context: input.context,
      players,
      currentSeat: input.currentSeat,
      passedSeats: [],
      finishedOrder: [],
      starterCardId: input.starterCardId
    };
  }

  playCards(state: GameState, seat: Seat, cardIds: string[]): GameActionResult {
    if (state.phase !== 'PLAYING') {
      return { ok: false, reason: 'ROUND_NOT_PLAYING', state };
    }

    const nextState = cloneState(state);
    const player = nextState.players[seat];
    const validation = this.validator.validate({
      playerId: seat,
      currentPlayerId: nextState.currentSeat,
      playerHand: player.hand,
      cardIds,
      context: nextState.context,
      lastPlay: nextState.lastPlay
    });

    if (!validation.ok) {
      return { ok: false, reason: validation.reason, state, validation };
    }

    player.hand = removeCards(player.hand, cardIds);
    nextState.lastPlay = {
      playerId: seat,
      cardIds: [...cardIds],
      analysis: validation.analysis
    };
    nextState.passedSeats = [];

    if (player.hand.length === 0 && !nextState.finishedOrder.includes(seat)) {
      nextState.finishedOrder.push(seat);
    }

    const result = this.getRoundResult(nextState);
    if (result) {
      nextState.phase = 'FINISHED';
      nextState.result = result;
      return { ok: true, state: nextState, validation };
    }

    const next = this.nextActionSeatAfterPlay(nextState, seat);
    if (!next) {
      return this.closeTrick(nextState, validation);
    }
    nextState.currentSeat = next;

    return { ok: true, state: nextState, validation };
  }

  pass(state: GameState, seat: Seat): GameActionResult {
    if (state.phase !== 'PLAYING') {
      return { ok: false, reason: 'ROUND_NOT_PLAYING', state };
    }
    if (state.currentSeat !== seat) {
      return { ok: false, reason: 'NOT_CURRENT_PLAYER', state };
    }
    if (!state.lastPlay) {
      return { ok: false, reason: 'CANNOT_PASS_ON_LEAD', state };
    }
    if (state.lastPlay.playerId === seat) {
      return { ok: false, reason: 'LAST_PLAY_OWNER_CANNOT_PASS', state };
    }

    const nextState = cloneState(state);
    if (!nextState.passedSeats.includes(seat)) {
      nextState.passedSeats.push(seat);
    }

    const remaining = this.remainingResponders(nextState);
    if (remaining.length === 0) {
      return this.closeTrick(nextState);
    }

    const next = nextSeatMatching(seat, (candidate) => remaining.includes(candidate));
    if (!next) {
      return this.closeTrick(nextState);
    }

    nextState.currentSeat = next;
    return { ok: true, state: nextState };
  }

  private closeTrick(state: GameState, validation?: GameActionResult['validation']): GameActionResult {
    const nextState = cloneState(state);
    const lastSeat = nextState.lastPlay?.playerId as Seat | undefined;
    nextState.lastPlay = undefined;
    nextState.passedSeats = [];

    if (!lastSeat) {
      const fallback = nextSeatMatching(nextState.currentSeat, (seat) => this.isActive(nextState, seat));
      if (!fallback) return { ok: false, reason: 'NO_ACTIVE_PLAYER', state };
      nextState.currentSeat = fallback;
      return { ok: true, state: nextState, validation };
    }

    const teammate = teammateOf(lastSeat);
    const firstFinisher = nextState.finishedOrder[0];
    if (firstFinisher === lastSeat && this.isActive(nextState, teammate)) {
      nextState.currentSeat = teammate;
      return { ok: true, state: nextState, validation };
    }

    if (this.isActive(nextState, lastSeat)) {
      nextState.currentSeat = lastSeat;
      return { ok: true, state: nextState, validation };
    }

    const next = nextSeatMatching(lastSeat, (seat) => this.isActive(nextState, seat));
    if (!next) return { ok: false, reason: 'NO_ACTIVE_PLAYER', state };
    nextState.currentSeat = next;
    return { ok: true, state: nextState, validation };
  }

  private nextActionSeatAfterPlay(state: GameState, from: Seat): Seat | undefined {
    return nextSeatMatching(from, (seat) => this.isActive(state, seat));
  }

  private remainingResponders(state: GameState): Seat[] {
    if (!state.lastPlay) return [];
    const lastSeat = state.lastPlay.playerId as Seat;
    return (['A', 'B', 'C', 'D'] satisfies Seat[]).filter((seat) => (
      this.isActive(state, seat)
      && seat !== lastSeat
      && !state.passedSeats.includes(seat)
    ));
  }

  private isActive(state: GameState, seat: Seat): boolean {
    return state.players[seat].hand.length > 0 && !state.finishedOrder.includes(seat);
  }

  private getRoundResult(state: GameState): RoundResult | undefined {
    const firstFinishedSeat = state.finishedOrder[0];
    if (!firstFinishedSeat) return undefined;

    const winnerTeam = teamOf(firstFinishedSeat);
    const winnerTeamDone = seatsForTeam(winnerTeam).every((seat) => state.finishedOrder.includes(seat));
    if (!winnerTeamDone) return undefined;

    const loserTeam = winnerTeam === 'AC' ? 'BD' : 'AC';
    const tributeLoserSeats = seatsForTeam(loserTeam).filter((seat) => !state.finishedOrder.includes(seat));
    const loserRemaining = tributeLoserSeats.length;
    return {
      winnerTeam,
      loserTeam,
      loserRemaining,
      tributeLoserSeats,
      levelUp: loserRemaining === 2 ? 2 : loserRemaining === 1 ? 1 : 0,
      finishedOrder: [...state.finishedOrder]
    };
  }
}
