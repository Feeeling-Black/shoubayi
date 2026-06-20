export type Seat = 'A' | 'B' | 'C' | 'D';

export const SEATS: Seat[] = ['A', 'B', 'C', 'D'];

export type TeamId = 'AC' | 'BD';

export function teamOf(seat: Seat): TeamId {
  return seat === 'A' || seat === 'C' ? 'AC' : 'BD';
}

export function teammateOf(seat: Seat): Seat {
  switch (seat) {
    case 'A':
      return 'C';
    case 'C':
      return 'A';
    case 'B':
      return 'D';
    case 'D':
      return 'B';
  }
}

export function nextSeat(seat: Seat): Seat {
  const index = SEATS.indexOf(seat);
  return SEATS[(index + 1) % SEATS.length];
}

export function seatsForTeam(teamId: TeamId): Seat[] {
  return teamId === 'AC' ? ['A', 'C'] : ['B', 'D'];
}

export function nextSeatMatching(from: Seat, predicate: (seat: Seat) => boolean): Seat | undefined {
  let cursor = nextSeat(from);
  for (let i = 0; i < SEATS.length; i += 1) {
    if (predicate(cursor)) return cursor;
    cursor = nextSeat(cursor);
  }
  return undefined;
}
