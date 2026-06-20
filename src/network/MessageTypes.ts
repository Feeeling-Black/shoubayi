import type { Card, GameContext } from '../rules/Card.ts';
import type { HandAnalysis } from '../rules/HandType.ts';
import type { RoundResult } from '../game/GameState.ts';
import type { Seat } from '../game/Seats.ts';

export type ClientMessage =
  | {
      type: 'PLAY_CARDS';
      requestId: string;
      seat: Seat;
      cardIds: string[];
    }
  | {
      type: 'PASS';
      requestId: string;
      seat: Seat;
    }
  | {
      type: 'PING';
      requestId: string;
    };

export type ServerMessage =
  | {
      type: 'ROOM_SNAPSHOT';
      roomId: string;
      yourSeat: Seat;
      currentSeat: Seat;
      context: GameContext;
      hand: Card[];
      handCounts: Record<Seat, number>;
      passedSeats: Seat[];
      finishedOrder: Seat[];
      result?: RoundResult;
    }
  | {
      type: 'PLAY_ACCEPTED';
      requestId: string;
      seat: Seat;
      cardIds: string[];
      analysis: HandAnalysis;
      nextSeat?: Seat;
    }
  | {
      type: 'PASS_ACCEPTED';
      requestId: string;
      seat: Seat;
      nextSeat: Seat;
    }
  | {
      type: 'ERROR';
      requestId?: string;
      code: string;
      message: string;
    }
  | {
      type: 'PONG';
      requestId: string;
    };
