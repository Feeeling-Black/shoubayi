import type { Card, NormalRank, Rank, Suit } from '../rules/Card.ts';
import { SEATS, type Seat } from './Seats.ts';

export type DealResult = {
  deck: Card[];
  hands: Record<Seat, Card[]>;
  starterCard: Card;
  starterSeat: Seat;
};

const NORMAL_RANKS: NormalRank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS: Exclude<Suit, 'JOKER' | 'LZ'>[] = ['S', 'H', 'C', 'D'];

export class DealManager {
  createDeck(): Card[] {
    const deck: Card[] = [];
    for (let deckIndex = 0; deckIndex < 4; deckIndex += 1) {
      for (const suit of SUITS) {
        for (const rank of NORMAL_RANKS) {
          deck.push({
            id: `D${deckIndex}-${suit}-${rank}`,
            deckIndex,
            suit,
            rank,
            isLaizi: false
          });
        }
      }

      for (const rank of ['SJ', 'BJ'] satisfies Rank[]) {
        deck.push({
          id: `D${deckIndex}-JOKER-${rank}`,
          deckIndex,
          suit: 'JOKER',
          rank,
          isLaizi: false
        });
      }
    }

    for (let i = 0; i < 4; i += 1) {
      deck.push({
        id: `LZ-${i}`,
        suit: 'LZ',
        rank: 'LZ',
        isLaizi: true
      });
    }

    return deck;
  }

  shuffle(cards: Card[], random = Math.random): Card[] {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  deal(random = Math.random): DealResult {
    const deck = this.shuffle(this.createDeck(), random);
    const hands = {
      A: [] as Card[],
      B: [] as Card[],
      C: [] as Card[],
      D: [] as Card[]
    };

    deck.forEach((card, index) => {
      hands[SEATS[index % SEATS.length]].push(card);
    });

    const starterCard = deck[0];
    const starterSeat = SEATS.find((seat) => hands[seat].some((card) => card.id === starterCard.id));
    if (!starterSeat) {
      throw new Error('Starter card was not dealt to any player.');
    }

    return {
      deck,
      hands,
      starterCard,
      starterSeat
    };
  }
}
