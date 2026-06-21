"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cloudbase/ShouBaYiApi.ts
var ShouBaYiApi_exports = {};
__export(ShouBaYiApi_exports, {
  main: () => main
});
module.exports = __toCommonJS(ShouBaYiApi_exports);
var import_node_http = __toESM(require("node:http"), 1);
var import_node_url = require("node:url");
var import_node_sdk = __toESM(require("@cloudbase/node-sdk"), 1);

// src/game/Seats.ts
var SEATS = ["A", "B", "C", "D"];
function teamOf(seat) {
  return seat === "A" || seat === "C" ? "AC" : "BD";
}
function teammateOf(seat) {
  switch (seat) {
    case "A":
      return "C";
    case "C":
      return "A";
    case "B":
      return "D";
    case "D":
      return "B";
  }
}
function nextSeat(seat) {
  const index = SEATS.indexOf(seat);
  return SEATS[(index + 1) % SEATS.length];
}
function seatsForTeam(teamId) {
  return teamId === "AC" ? ["A", "C"] : ["B", "D"];
}
function nextSeatMatching(from, predicate) {
  let cursor = nextSeat(from);
  for (let i = 0; i < SEATS.length; i += 1) {
    if (predicate(cursor)) return cursor;
    cursor = nextSeat(cursor);
  }
  return void 0;
}

// src/game/DealManager.ts
var NORMAL_RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
var SUITS = ["S", "H", "C", "D"];
var DealManager = class {
  createDeck() {
    const deck = [];
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
      for (const rank of ["SJ", "BJ"]) {
        deck.push({
          id: `D${deckIndex}-JOKER-${rank}`,
          deckIndex,
          suit: "JOKER",
          rank,
          isLaizi: false
        });
      }
    }
    for (let i = 0; i < 4; i += 1) {
      deck.push({
        id: `LZ-${i}`,
        suit: "LZ",
        rank: "LZ",
        isLaizi: true
      });
    }
    return deck;
  }
  shuffle(cards, random = Math.random) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  deal(random = Math.random) {
    const deck = this.shuffle(this.createDeck(), random);
    const hands = {
      A: [],
      B: [],
      C: [],
      D: []
    };
    deck.forEach((card, index) => {
      hands[SEATS[index % SEATS.length]].push(card);
    });
    const starterCard = deck[0];
    const starterSeat = SEATS.find((seat) => hands[seat].some((card) => card.id === starterCard.id));
    if (!starterSeat) {
      throw new Error("Starter card was not dealt to any player.");
    }
    return {
      deck,
      hands,
      starterCard,
      starterSeat
    };
  }
};

// src/rules/Rank.ts
var NATURAL_SEQUENCE = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A"
];
var BASE_POWER = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "2"
];
function getRankWeight(rank, levelRank) {
  if (rank === "BJ") return 1e3;
  if (rank === "SJ") return 900;
  if (rank === "LZ") return -1;
  if (rank === levelRank) return 800;
  if (rank === "2") return 700;
  return BASE_POWER.indexOf(rank) + 1;
}
function isNormalRank(rank) {
  return rank !== "BJ" && rank !== "SJ" && rank !== "LZ";
}
function isSequenceRank(rank, levelRank) {
  return isNormalRank(rank) && rank !== "2" && rank !== levelRank;
}
function getSequenceIndex(rank) {
  return NATURAL_SEQUENCE.indexOf(rank);
}
function areConsecutive(ranks) {
  if (ranks.length <= 1) return true;
  const ordered = ranks.map(getSequenceIndex).sort((a, b) => a - b);
  if (ordered.some((index) => index < 0)) return false;
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i] !== ordered[i - 1] + 1) return false;
  }
  return true;
}

// src/rules/HandAnalyzer.ts
function invalid(cards, reason) {
  return {
    valid: false,
    type: "INVALID",
    cards,
    totalCards: cards.length,
    laiziUsed: cards.filter((card) => card.isLaizi || card.rank === "LZ").length,
    laiziAssignments: [],
    isBomb: false,
    canEnterDragonPool: false,
    reason
  };
}
function valid(cards, type, context, details = {}) {
  const mainRank = details.mainRank;
  return {
    valid: true,
    type,
    cards,
    totalCards: cards.length,
    mainRank,
    mainWeight: mainRank ? getRankWeight(mainRank, context.levelRank) : void 0,
    groupSize: details.groupSize,
    sequenceRanks: details.sequenceRanks,
    laiziUsed: details.laiziUsed ?? 0,
    laiziAssignments: details.laiziAssignments ?? [],
    isBomb: details.isBomb ?? false,
    canEnterDragonPool: details.canEnterDragonPool ?? false,
    reason: details.reason
  };
}
function groupByRank(cards) {
  const groups = /* @__PURE__ */ new Map();
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
function splitLaizi(cards) {
  return {
    laizi: cards.filter((card) => card.isLaizi || card.rank === "LZ"),
    natural: cards.filter((card) => !card.isLaizi && card.rank !== "LZ")
  };
}
function assignments(laizi, asRank) {
  return laizi.map((card) => ({
    laiziCardId: card.id,
    asRank
  }));
}
function analyzeJokerBomb(cards, context) {
  if (cards.length !== 4) return void 0;
  if (cards.every((card) => card.rank === "BJ")) {
    return valid(cards, "JOKER_BOMB_BIG", context, {
      mainRank: "BJ",
      groupSize: 4,
      isBomb: true
    });
  }
  if (cards.every((card) => card.rank === "SJ")) {
    return valid(cards, "JOKER_BOMB_SMALL", context, {
      mainRank: "SJ",
      groupSize: 4,
      isBomb: true
    });
  }
  return void 0;
}
function analyzeNaturalBomb(cards, context, natural, laizi) {
  if (laizi.length > 0 || natural.length < 8) return void 0;
  const groups = groupByRank(natural);
  if (groups.length !== 1) return void 0;
  const [{ rank }] = groups;
  if (!isNormalRank(rank)) return void 0;
  return valid(cards, "BOMB", context, {
    mainRank: rank,
    groupSize: natural.length,
    isBomb: true
  });
}
function analyzeSameRank(cards, context, natural, laizi) {
  if (natural.length === 0) return void 0;
  const groups = groupByRank(natural);
  if (groups.length !== 1) return void 0;
  const [{ rank }] = groups;
  if (rank === "LZ") return void 0;
  if (rank === "BJ" || rank === "SJ") {
    if (laizi.length > 0) return void 0;
  }
  return valid(cards, "SAME_RANK", context, {
    mainRank: rank,
    groupSize: cards.length,
    laiziUsed: laizi.length,
    laiziAssignments: assignments(laizi, rank)
  });
}
function analyzeStraight(cards, context, natural, laizi) {
  if (laizi.length > 0 || cards.length < 6) return void 0;
  if (!natural.every((card) => isSequenceRank(card.rank, context.levelRank))) return void 0;
  const ranks = natural.map((card) => card.rank);
  if (new Set(ranks).size !== cards.length) return void 0;
  if (!areConsecutive(ranks)) return void 0;
  const highRank = [...ranks].sort((a, b) => getRankWeight(b, context.levelRank) - getRankWeight(a, context.levelRank))[0];
  return valid(cards, "STRAIGHT", context, {
    mainRank: highRank,
    groupSize: 1,
    sequenceRanks: ranks
  });
}
function analyzeMultiRun(cards, context, natural, laizi) {
  if (cards.length < 6 || natural.length === 0) return void 0;
  if (!natural.every((card) => isSequenceRank(card.rank, context.levelRank))) return void 0;
  const groups = groupByRank(natural);
  if (!groups.every((group) => isNormalRank(group.rank))) return void 0;
  const naturalRanks = groups.map((group) => group.rank);
  if (!areConsecutive(naturalRanks)) return void 0;
  if (groups.some((group) => group.cards.length >= 8)) return void 0;
  const maxNaturalCount = Math.max(...groups.map((group) => group.cards.length));
  for (let groupSize = 2; groupSize <= 7; groupSize += 1) {
    const needed = groups.reduce((sum, group) => {
      if (group.cards.length > groupSize) return Number.POSITIVE_INFINITY;
      return sum + (groupSize - group.cards.length);
    }, 0);
    if (needed !== laizi.length) continue;
    if (groupSize < maxNaturalCount) continue;
    if (groupSize * groups.length !== cards.length) continue;
    const assigned = [];
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
    return valid(cards, "MULTI_RUN", context, {
      mainRank: highRank,
      groupSize,
      sequenceRanks: naturalRanks,
      laiziUsed: laizi.length,
      laiziAssignments: assigned,
      canEnterDragonPool: laizi.length > 0
    });
  }
  return void 0;
}
var HandAnalyzer = class {
  analyze(cards, context) {
    if (cards.length === 0) return invalid(cards, "\u4E0D\u80FD\u7A7A\u51FA");
    const { laizi, natural } = splitLaizi(cards);
    if (natural.length === 0) return invalid(cards, "\u4E0D\u80FD\u5355\u72EC\u51FA\u765E\u5B50\u6216\u7EAF\u765E\u5B50\u7EC4\u5408");
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
    return invalid(cards, "\u4E0D\u7B26\u5408\u624B\u628A\u4E00\u724C\u578B\u89C4\u5219");
  }
  isValidFinalAWin(cards, context) {
    const analysis = this.analyze(cards, { ...context, levelRank: "A", isFinalLevelA: true });
    if (!analysis.valid) return analysis;
    if (analysis.type !== "SAME_RANK" && analysis.type !== "BOMB") {
      return invalid(cards, "\u6700\u7EC8\u6253A\u6700\u540E\u4E00\u624B\u5FC5\u987B\u662F\u7EAFA\u540C\u5F20\u7EC4\u5408");
    }
    if (analysis.mainRank !== "A") {
      return invalid(cards, "\u6700\u7EC8\u6253A\u6700\u540E\u4E00\u624B\u5FC5\u987B\u7531A\u672C\u8EAB\u7EC4\u6210");
    }
    return analysis;
  }
};

// src/rules/HandComparator.ts
var JOKER_BOMB_POWER = {
  JOKER_BOMB_BIG: 3,
  JOKER_BOMB_SMALL: 2,
  BOMB: 1
};
var HandComparator = class {
  canBeat(current, previous, context) {
    void context;
    if (!current.valid || !previous.valid) return false;
    if (current.isBomb || previous.isBomb) {
      if (!current.isBomb) return false;
      if (!previous.isBomb) return true;
      return this.compareBomb(current, previous) > 0;
    }
    if (current.type !== previous.type) return false;
    if (current.totalCards !== previous.totalCards) return false;
    if (current.groupSize !== previous.groupSize) return false;
    if ((current.sequenceRanks?.length ?? 0) !== (previous.sequenceRanks?.length ?? 0)) return false;
    return (current.mainWeight ?? -1) > (previous.mainWeight ?? -1);
  }
  compareBomb(a, b) {
    const aPower = JOKER_BOMB_POWER[a.type] ?? 0;
    const bPower = JOKER_BOMB_POWER[b.type] ?? 0;
    if (aPower !== bPower) return aPower - bPower;
    if (a.type === "BOMB" && b.type === "BOMB") {
      if (a.totalCards !== b.totalCards) return a.totalCards - b.totalCards;
      return (a.mainWeight ?? -1) - (b.mainWeight ?? -1);
    }
    return 0;
  }
};

// src/rules/PlayValidator.ts
function invalidAnalysis(cards, reason) {
  return {
    valid: false,
    type: "INVALID",
    cards,
    totalCards: cards.length,
    laiziUsed: cards.filter((card) => card.isLaizi || card.rank === "LZ").length,
    laiziAssignments: [],
    isBomb: false,
    canEnterDragonPool: false,
    reason
  };
}
function fail(cards, reason, isLead = false) {
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
var PlayValidator = class {
  analyzer;
  comparator;
  constructor(analyzer = new HandAnalyzer(), comparator = new HandComparator()) {
    this.analyzer = analyzer;
    this.comparator = comparator;
  }
  validate(input) {
    const isLead = input.lastPlay === void 0;
    if (input.playerId !== input.currentPlayerId) {
      return fail([], "NOT_CURRENT_PLAYER", isLead);
    }
    if (input.cardIds.length === 0) {
      return fail([], "NO_CARDS_SELECTED", isLead);
    }
    const uniqueCardIds = new Set(input.cardIds);
    if (uniqueCardIds.size !== input.cardIds.length) {
      return fail([], "DUPLICATE_CARD_ID", isLead);
    }
    const handById = new Map(input.playerHand.map((card) => [card.id, card]));
    const selectedCards = [];
    for (const cardId of input.cardIds) {
      const card = handById.get(cardId);
      if (!card) {
        return fail(selectedCards, "CARD_NOT_IN_PLAYER_HAND", isLead);
      }
      selectedCards.push(card);
    }
    const willEmptyHand = selectedCards.length === input.playerHand.length;
    const analysis = input.context.isFinalLevelA && willEmptyHand ? this.analyzer.isValidFinalAWin(selectedCards, input.context) : this.analyzer.analyze(selectedCards, input.context);
    if (!analysis.valid) {
      return {
        ok: false,
        reason: analysis.reason ?? "INVALID_HAND",
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
        reason: "LAST_PLAY_INVALID",
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
        reason: "CANNOT_BEAT_LAST_PLAY",
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
};

// src/game/GameStateMachine.ts
function cloneState(state) {
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
    lastPlay: state.lastPlay ? { ...state.lastPlay, cardIds: [...state.lastPlay.cardIds] } : void 0,
    result: state.result ? { ...state.result, finishedOrder: [...state.result.finishedOrder] } : void 0
  };
}
function removeCards(hand, cardIds) {
  const selected = new Set(cardIds);
  return hand.filter((card) => !selected.has(card.id));
}
var GameStateMachine = class {
  validator;
  constructor(validator = new PlayValidator()) {
    this.validator = validator;
  }
  createState(input) {
    const players = {};
    for (const seat of ["A", "B", "C", "D"]) {
      players[seat] = {
        playerId: input.playerIds[seat],
        seat,
        teamId: teamOf(seat),
        hand: [...input.hands[seat]]
      };
    }
    return {
      roomId: input.roomId,
      phase: "PLAYING",
      context: input.context,
      players,
      currentSeat: input.currentSeat,
      passedSeats: [],
      finishedOrder: [],
      starterCardId: input.starterCardId
    };
  }
  playCards(state, seat, cardIds) {
    if (state.phase !== "PLAYING") {
      return { ok: false, reason: "ROUND_NOT_PLAYING", state };
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
      nextState.phase = "FINISHED";
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
  pass(state, seat) {
    if (state.phase !== "PLAYING") {
      return { ok: false, reason: "ROUND_NOT_PLAYING", state };
    }
    if (state.currentSeat !== seat) {
      return { ok: false, reason: "NOT_CURRENT_PLAYER", state };
    }
    if (!state.lastPlay) {
      return { ok: false, reason: "CANNOT_PASS_ON_LEAD", state };
    }
    if (state.lastPlay.playerId === seat) {
      return { ok: false, reason: "LAST_PLAY_OWNER_CANNOT_PASS", state };
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
  closeTrick(state, validation) {
    const nextState = cloneState(state);
    const lastSeat = nextState.lastPlay?.playerId;
    nextState.lastPlay = void 0;
    nextState.passedSeats = [];
    if (!lastSeat) {
      const fallback = nextSeatMatching(nextState.currentSeat, (seat) => this.isActive(nextState, seat));
      if (!fallback) return { ok: false, reason: "NO_ACTIVE_PLAYER", state };
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
    if (!next) return { ok: false, reason: "NO_ACTIVE_PLAYER", state };
    nextState.currentSeat = next;
    return { ok: true, state: nextState, validation };
  }
  nextActionSeatAfterPlay(state, from) {
    return nextSeatMatching(from, (seat) => this.isActive(state, seat));
  }
  remainingResponders(state) {
    if (!state.lastPlay) return [];
    const lastSeat = state.lastPlay.playerId;
    return ["A", "B", "C", "D"].filter((seat) => this.isActive(state, seat) && seat !== lastSeat && !state.passedSeats.includes(seat));
  }
  isActive(state, seat) {
    return state.players[seat].hand.length > 0 && !state.finishedOrder.includes(seat);
  }
  getRoundResult(state) {
    const firstFinishedSeat = state.finishedOrder[0];
    if (!firstFinishedSeat) return void 0;
    const winnerTeam = teamOf(firstFinishedSeat);
    const winnerTeamDone = seatsForTeam(winnerTeam).every((seat) => state.finishedOrder.includes(seat));
    if (!winnerTeamDone) return void 0;
    const loserTeam = winnerTeam === "AC" ? "BD" : "AC";
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
};

// src/game/Room.ts
var Room = class {
  roomId;
  state;
  playerIds;
  dealManager;
  stateMachine;
  constructor(roomId, playerIds, dealManager = new DealManager(), stateMachine = new GameStateMachine()) {
    this.roomId = roomId;
    this.playerIds = playerIds;
    this.dealManager = dealManager;
    this.stateMachine = stateMachine;
  }
  startRound(context, random = Math.random) {
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
  playCards(seat, cardIds) {
    const state = this.requireState();
    const result = this.stateMachine.playCards(state, seat, cardIds);
    if (result.ok) this.state = result.state;
    return result;
  }
  pass(seat) {
    const state = this.requireState();
    const result = this.stateMachine.pass(state, seat);
    if (result.ok) this.state = result.state;
    return result;
  }
  snapshotFor(seat) {
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
      lastPlay: state.lastPlay ? { ...state.lastPlay, cardIds: [...state.lastPlay.cardIds] } : void 0,
      passedSeats: [...state.passedSeats],
      finishedOrder: [...state.finishedOrder],
      result: state.result ? { ...state.result, finishedOrder: [...state.result.finishedOrder] } : void 0,
      starterCardId: state.starterCardId
    };
  }
  getState() {
    return this.state;
  }
  requireState() {
    if (!this.state) {
      throw new Error("Round has not started.");
    }
    return this.state;
  }
};
function createSeatPlayerIds(prefix = "player") {
  return {
    A: `${prefix}-A`,
    B: `${prefix}-B`,
    C: `${prefix}-C`,
    D: `${prefix}-D`
  };
}

// src/cloudbase/ShouBaYiApi.ts
var ENV_ID = process.env.TCB_ENV ?? process.env.SCB_NAMESPACE ?? "shoubayi-d7g6w8hfc51aea10f";
var ROOM_COLLECTION = "shoubayi_rooms";
var PORT = Number(process.env.PORT ?? 9e3);
var app = import_node_sdk.default.init({ env: ENV_ID });
var db = app.database();
var rooms = db.collection(ROOM_COLLECTION);
function makeCode() {
  return String(Math.floor(1e5 + Math.random() * 9e5));
}
function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function nextSeat2(players) {
  return SEATS.find((seat) => !players[seat]);
}
function cardLabel(card) {
  if (card.rank === "LZ" || card.isLaizi) return "\u9427\u70B2\u74D9";
  if (card.rank === "BJ") return "\u6FB6\u0445\u5E07";
  if (card.rank === "SJ") return "\u704F\u5FD5\u5E07";
  return `${card.rank}${card.suit}`;
}
function cardImage(card) {
  if (card.rank === "LZ" || card.isLaizi) return "wild-card.png";
  if (card.rank === "BJ") return "big-king.png";
  if (card.rank === "SJ") return "small-king.png";
  const suits = {
    S: "Spades",
    H: "Hearts",
    C: "Clubs",
    D: "Diamonds"
  };
  return `${card.rank}-of-${suits[card.suit]}.png`;
}
function publicCard(card) {
  return {
    ...card,
    label: cardLabel(card),
    image: cardImage(card)
  };
}
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json; charset=utf-8"
    },
    body
  };
}
function docFromResult(result) {
  const data = result.data;
  if (Array.isArray(data)) return data[0];
  return data;
}
async function getRoom(code) {
  try {
    return docFromResult(await rooms.doc(code).get());
  } catch {
    return void 0;
  }
}
async function saveRoom(room) {
  const { _id: _ignored, ...data } = room;
  await rooms.doc(room.code).set({
    ...data,
    updatedAt: Date.now()
  });
}
function publicRoomState(room) {
  return {
    code: room.code,
    started: room.started,
    version: room.version,
    players: SEATS.map((seat) => ({
      seat,
      nickname: room.players[seat]?.nickname ?? "",
      occupied: !!room.players[seat]
    }))
  };
}
function buildRoom(doc) {
  const room = new Room(doc.code, createSeatPlayerIds(doc.code));
  if (doc.state) {
    room.state = doc.state;
  }
  return room;
}
function snapshotFor(doc, playerId) {
  const player = Object.values(doc.players).find((item) => item?.id === playerId);
  const lobby = publicRoomState(doc);
  if (!player || !doc.started || !doc.state) {
    return { ...lobby, yourSeat: player?.seat, logs: doc.logs };
  }
  const room = buildRoom(doc);
  const snapshot = room.snapshotFor(player.seat);
  const lastPlayCards = snapshot.lastPlay?.cardIds ?? [];
  return {
    ...lobby,
    yourSeat: player.seat,
    phase: snapshot.phase,
    context: snapshot.context,
    currentSeat: snapshot.currentSeat,
    hand: snapshot.hand.map(publicCard),
    handCounts: snapshot.handCounts,
    lastPlay: snapshot.lastPlay ? {
      ...snapshot.lastPlay,
      cards: doc.tableCards[snapshot.lastPlay.playerId]?.map(publicCard) ?? lastPlayCards
    } : void 0,
    tableCards: Object.fromEntries(
      SEATS.map((seat) => [seat, (doc.tableCards[seat] ?? []).map(publicCard)])
    ),
    passedSeats: snapshot.passedSeats,
    finishedOrder: snapshot.finishedOrder,
    result: snapshot.result,
    logs: doc.logs
  };
}
async function createOnlineRoom(nickname) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = makeCode();
    if (await getRoom(code)) continue;
    const now = Date.now();
    const player = { id: makeId(), nickname, seat: "A" };
    const room = {
      code,
      players: { A: player },
      tableCards: {},
      logs: [`${nickname} \u521B\u5EFA\u623F\u95F4`],
      version: 1,
      started: false,
      createdAt: now,
      updatedAt: now
    };
    await saveRoom(room);
    return { room, player };
  }
  throw new Error("CREATE_ROOM_FAILED");
}
function joinOnlineRoom(room, nickname, playerId) {
  const existing = Object.values(room.players).find((item) => item?.id === playerId);
  if (existing) return existing;
  const seat = nextSeat2(room.players);
  if (!seat) throw new Error("ROOM_FULL");
  const player = { id: makeId(), nickname, seat };
  room.players[seat] = player;
  room.version += 1;
  room.logs.unshift(`${nickname} \u52A0\u5165 ${seat} \u4F4D`);
  return player;
}
function startRoom(doc) {
  if (doc.started) return;
  const count = Object.values(doc.players).filter(Boolean).length;
  if (count < 4) throw new Error("NEED_FOUR_PLAYERS");
  const room = new Room(doc.code, createSeatPlayerIds(doc.code));
  const result = room.startRound({ levelRank: "3" });
  doc.state = result.state;
  doc.tableCards = {};
  doc.started = true;
  doc.version += 1;
  doc.logs.unshift("\u724C\u5C40\u5F00\u59CB");
}
function normalizePath(pathname) {
  return pathname.replace(/^\/api(?=\/|$)/, "") || "/";
}
function parseBody(event) {
  if (!event) return {};
  if (typeof event === "string") {
    try {
      return JSON.parse(event);
    } catch {
      return {};
    }
  }
  if (typeof event === "object") return event;
  return {};
}
async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
function sendResponse(response, result) {
  const bodyText = typeof result.body === "string" ? result.body : JSON.stringify(result.body);
  response.writeHead(result.statusCode, {
    ...result.headers,
    "content-length": Buffer.byteLength(bodyText)
  });
  response.end(bodyText);
}
async function main(event, context) {
  try {
    const httpContext = context.httpContext ?? {};
    const method = (httpContext.httpMethod || "GET").toUpperCase();
    if (method === "OPTIONS") {
      return json(200, { ok: true });
    }
    const url = new import_node_url.URL(httpContext.url || "/", "https://cloudbase.local");
    const pathname = normalizePath(url.pathname);
    const body = parseBody(event);
    if (method === "GET" && (pathname === "/" || pathname === "/health")) {
      return json(200, {
        ok: true,
        service: "shoubayi-cloudbase",
        env: ENV_ID
      });
    }
    if (method === "POST" && pathname === "/rooms") {
      const nickname = String(body.nickname || "\u73A9\u5BB6").slice(0, 12);
      const { room: room2, player: player2 } = await createOnlineRoom(nickname);
      return json(200, { code: room2.code, playerId: player2.id, seat: player2.seat });
    }
    const roomMatch = pathname.match(/^\/rooms\/([^/]+)(?:\/([^/]+))?$/);
    if (!roomMatch) {
      return json(404, { error: "NOT_FOUND" });
    }
    const code = roomMatch[1];
    const action = roomMatch[2] || "";
    const roomDoc = await getRoom(code);
    if (!roomDoc) {
      return json(404, { error: "ROOM_NOT_FOUND" });
    }
    if (method === "GET" && (action === "" || action === "snapshot")) {
      const playerId2 = url.searchParams.get("playerId") || "";
      return json(200, snapshotFor(roomDoc, playerId2));
    }
    if (method === "POST" && action === "join") {
      const nickname = String(body.nickname || "\u73A9\u5BB6").slice(0, 12);
      const playerId2 = typeof body.playerId === "string" ? body.playerId : void 0;
      const player2 = joinOnlineRoom(roomDoc, nickname, playerId2);
      await saveRoom(roomDoc);
      return json(200, { code, playerId: player2.id, seat: player2.seat });
    }
    if (method === "POST" && action === "start") {
      startRoom(roomDoc);
      await saveRoom(roomDoc);
      return json(200, { ok: true });
    }
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    const player = Object.values(roomDoc.players).find((item) => item?.id === playerId);
    if (!player) {
      return json(403, { error: "PLAYER_NOT_IN_ROOM" });
    }
    if (!roomDoc.started || !roomDoc.state) {
      return json(400, { error: "ROOM_NOT_STARTED" });
    }
    const room = buildRoom(roomDoc);
    if (method === "POST" && action === "play") {
      const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter((id) => typeof id === "string") : [];
      const before = room.snapshotFor(player.seat);
      const playedCards = before.hand.filter((card) => cardIds.includes(card.id));
      const result = room.playCards(player.seat, cardIds);
      roomDoc.version += result.ok ? 1 : 0;
      if (result.ok) {
        roomDoc.state = result.state;
        roomDoc.tableCards[player.seat] = playedCards;
      }
      roomDoc.logs.unshift(`${player.nickname} \u51FA\u724C\uFF1A${result.ok ? "\u6210\u529F" : result.reason}`);
      await saveRoom(roomDoc);
      return json(result.ok ? 200 : 400, { ok: result.ok, reason: result.reason });
    }
    if (method === "POST" && action === "pass") {
      const result = room.pass(player.seat);
      roomDoc.version += result.ok ? 1 : 0;
      if (result.ok) roomDoc.state = result.state;
      roomDoc.logs.unshift(`${player.nickname} \u4E0D\u51FA\uFF1A${result.ok ? "\u6210\u529F" : result.reason}`);
      await saveRoom(roomDoc);
      return json(result.ok ? 200 : 400, { ok: result.ok, reason: result.reason });
    }
    return json(404, { error: "NOT_FOUND" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return json(500, { error: message });
  }
}
var server = import_node_http.default.createServer(async (request, response) => {
  const body = await readRequestBody(request);
  const result = await main(body, {
    httpContext: {
      httpMethod: request.method,
      url: request.url
    }
  });
  sendResponse(response, result);
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`shoubayi CloudBase API listening on ${PORT}`);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  main
});
