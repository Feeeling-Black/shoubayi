import type { Card, GameContext } from '../rules/Card.ts';
import { DealManager, type DealResult } from './DealManager.ts';
import type { GameActionResult, GameState } from './GameState.ts';
import { GameStateMachine } from './GameStateMachine.ts';
import { SEATS, type Seat } from './Seats.ts';

export type RoomSnapshot = {
  roomId: string;
  phase: GameState['phase'];
  context: GameContext;
  yourSeat: Seat;
  currentSeat: Seat;
  hand: Card[];
  handCounts: Record<Seat, number>;
  lastPlay?: GameState['lastPlay'];
  passedSeats: Seat[];
  finishedOrder: Seat[];
  result?: GameState['result'];
  starterCardId?: string;
};

export type StartRoundResult = {
  state: GameState;
  deal: DealResult;
};

export class Room {
  readonly roomId: string;
  private state?: GameState;
  private readonly playerIds: Record<Seat, string>;
  private readonly dealManager: DealManager;
  private readonly stateMachine: GameStateMachine;

  constructor(
    roomId: string,
    playerIds: Record<Seat, string>,
    dealManager = new DealManager(),
    stateMachine = new GameStateMachine()
  ) {
    this.roomId = roomId;
    this.playerIds = playerIds;
    this.dealManager = dealManager;
    this.stateMachine = stateMachine;
  }

  startRound(context: GameContext, random = Math.random): StartRoundResult {
    const deal = this.dealManager.deal(random);
    this.state = this.stateMachine.createState({
      roomId: this.roomId,
      playerIds: this.playerIds,
      hands: deal.hands,
      context,
      currentSeat: deal.starterSeat,
      starterCardId: deal.starterCard.id
    });

    return {
      state: this.state,
      deal
    };
  }

  playCards(seat: Seat, cardIds: string[]): GameActionResult {
    const state = this.requireState();
    const result = this.stateMachine.playCards(state, seat, cardIds);
    if (result.ok) this.state = result.state;
    return result;
  }

  pass(seat: Seat): GameActionResult {
    const state = this.requireState();
    const result = this.stateMachine.pass(state, seat);
    if (result.ok) this.state = result.state;
    return result;
  }

  snapshotFor(seat: Seat): RoomSnapshot {
    const state = this.requireState();
    return {
      roomId: state.roomId,
      phase: state.phase,
      context: state.context,
      yourSeat: seat,
      currentSeat: state.currentSeat,
      hand: [...state.players[seat].hand],
      handCounts: {
        A: state.players.A.hand.length,
        B: state.players.B.hand.length,
        C: state.players.C.hand.length,
        D: state.players.D.hand.length
      },
      lastPlay: state.lastPlay ? { ...state.lastPlay, cardIds: [...state.lastPlay.cardIds] } : undefined,
      passedSeats: [...state.passedSeats],
      finishedOrder: [...state.finishedOrder],
      result: state.result ? { ...state.result, finishedOrder: [...state.result.finishedOrder] } : undefined,
      starterCardId: state.starterCardId
    };
  }

  getState(): GameState | undefined {
    return this.state;
  }

  private requireState(): GameState {
    if (!this.state) {
      throw new Error('Round has not started.');
    }
    return this.state;
  }
}

export function createSeatPlayerIds(prefix = 'player'): Record<Seat, string> {
  return {
    A: `${prefix}-A`,
    B: `${prefix}-B`,
    C: `${prefix}-C`,
    D: `${prefix}-D`
  };
}

export function isSeat(value: string): value is Seat {
  return (SEATS as string[]).includes(value);
}
