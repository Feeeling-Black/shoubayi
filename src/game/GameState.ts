import type { Card, GameContext } from '../rules/Card.ts';
import type { LastPlay, PlayValidationResult } from '../rules/PlayValidator.ts';
import type { Seat, TeamId } from './Seats.ts';

export type GamePhase = 'PLAYING' | 'FINISHED';

export type PlayerState = {
  playerId: string;
  seat: Seat;
  teamId: TeamId;
  hand: Card[];
};

export type RoundResult = {
  winnerTeam: TeamId;
  loserTeam: TeamId;
  loserRemaining: number;
  tributeLoserSeats: Seat[];
  levelUp: 0 | 1 | 2;
  finishedOrder: Seat[];
};

export type GameState = {
  roomId: string;
  phase: GamePhase;
  context: GameContext;
  players: Record<Seat, PlayerState>;
  currentSeat: Seat;
  lastPlay?: LastPlay;
  passedSeats: Seat[];
  finishedOrder: Seat[];
  result?: RoundResult;
  starterCardId?: string;
};

export type GameActionResult = {
  ok: boolean;
  reason?: string;
  state: GameState;
  validation?: PlayValidationResult;
};
