import http from 'node:http';
import { URL } from 'node:url';
import cloudbase from '@cloudbase/node-sdk';
import { createSeatPlayerIds, Room } from '../game/Room.ts';
import { SEATS, type Seat } from '../game/Seats.ts';
import type { Card } from '../rules/Card.ts';
import type { GameState } from '../game/GameState.ts';

const ENV_ID = process.env.TCB_ENV ?? process.env.SCB_NAMESPACE ?? 'shoubayi-d7g6w8hfc51aea10f';
const ROOM_COLLECTION = 'shoubayi_rooms';
const PORT = Number(process.env.PORT ?? 9000);

type Player = {
  id: string;
  nickname: string;
  seat: Seat;
};

type RoomDoc = {
  code: string;
  players: Partial<Record<Seat, Player>>;
  tableCards: Partial<Record<Seat, Card[]>>;
  logs: string[];
  version: number;
  started: boolean;
  state?: GameState;
  createdAt: number;
  updatedAt: number;
};

const app = cloudbase.init({ env: ENV_ID });
const db = app.database();
const rooms = db.collection(ROOM_COLLECTION);

function makeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nextSeat(players: RoomDoc['players']): Seat | undefined {
  return SEATS.find((seat) => !players[seat]);
}

function cardLabel(card: Card): string {
  if (card.rank === 'LZ' || card.isLaizi) return '鐧炲瓙';
  if (card.rank === 'BJ') return '澶х帇';
  if (card.rank === 'SJ') return '灏忕帇';
  return `${card.rank}${card.suit}`;
}

function cardImage(card: Card): string {
  if (card.rank === 'LZ' || card.isLaizi) return 'wild-card.png';
  if (card.rank === 'BJ') return 'big-king.png';
  if (card.rank === 'SJ') return 'small-king.png';
  const suits: Record<string, string> = {
    S: 'Spades',
    H: 'Hearts',
    C: 'Clubs',
    D: 'Diamonds'
  };
  return `${card.rank}-of-${suits[card.suit]}.png`;
}

function publicCard(card: Card) {
  return {
    ...card,
    label: cardLabel(card),
    image: cardImage(card)
  };
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
      'content-type': 'application/json; charset=utf-8'
    },
    body
  };
}

function docFromResult(result: { data?: unknown }): RoomDoc | undefined {
  const data = result.data;
  if (Array.isArray(data)) return data[0] as RoomDoc | undefined;
  return data as RoomDoc | undefined;
}

async function getRoom(code: string): Promise<RoomDoc | undefined> {
  try {
    return docFromResult(await rooms.doc(code).get());
  } catch {
    return undefined;
  }
}

async function saveRoom(room: RoomDoc) {
  const { _id: _ignored, ...data } = room as RoomDoc & { _id?: string };
  await rooms.doc(room.code).set({
    ...data,
    updatedAt: Date.now()
  });
}

function publicRoomState(room: RoomDoc) {
  return {
    code: room.code,
    started: room.started,
    version: room.version,
    players: SEATS.map((seat) => ({
      seat,
      nickname: room.players[seat]?.nickname ?? '',
      occupied: !!room.players[seat]
    }))
  };
}

function buildRoom(doc: RoomDoc): Room {
  const room = new Room(doc.code, createSeatPlayerIds(doc.code));
  if (doc.state) {
    (room as unknown as { state: GameState }).state = doc.state;
  }
  return room;
}

function snapshotFor(doc: RoomDoc, playerId: string) {
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
    lastPlay: snapshot.lastPlay
      ? {
          ...snapshot.lastPlay,
          cards: doc.tableCards[snapshot.lastPlay.playerId as Seat]?.map(publicCard) ?? lastPlayCards
        }
      : undefined,
    tableCards: Object.fromEntries(
      SEATS.map((seat) => [seat, (doc.tableCards[seat] ?? []).map(publicCard)])
    ),
    passedSeats: snapshot.passedSeats,
    finishedOrder: snapshot.finishedOrder,
    result: snapshot.result,
    logs: doc.logs
  };
}

async function createOnlineRoom(nickname: string): Promise<{ room: RoomDoc; player: Player }> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = makeCode();
    if (await getRoom(code)) continue;
    const now = Date.now();
    const player: Player = { id: makeId(), nickname, seat: 'A' };
    const room: RoomDoc = {
      code,
      players: { A: player },
      tableCards: {},
      logs: [`${nickname} 创建房间`],
      version: 1,
      started: false,
      createdAt: now,
      updatedAt: now
    };
    await saveRoom(room);
    return { room, player };
  }
  throw new Error('CREATE_ROOM_FAILED');
}

function joinOnlineRoom(room: RoomDoc, nickname: string, playerId?: string): Player {
  const existing = Object.values(room.players).find((item) => item?.id === playerId);
  if (existing) return existing;

  const seat = nextSeat(room.players);
  if (!seat) throw new Error('ROOM_FULL');
  const player: Player = { id: makeId(), nickname, seat };
  room.players[seat] = player;
  room.version += 1;
  room.logs.unshift(`${nickname} 加入 ${seat} 位`);
  return player;
}

function startRoom(doc: RoomDoc) {
  if (doc.started) return;
  const count = Object.values(doc.players).filter(Boolean).length;
  if (count < 4) throw new Error('NEED_FOUR_PLAYERS');
  const room = new Room(doc.code, createSeatPlayerIds(doc.code));
  const result = room.startRound({ levelRank: '3' });
  doc.state = result.state;
  doc.tableCards = {};
  doc.started = true;
  doc.version += 1;
  doc.logs.unshift('牌局开始');
}

function normalizePath(pathname: string): string {
  return pathname.replace(/^\/api(?=\/|$)/, '') || '/';
}

function parseBody(event: unknown): Record<string, unknown> {
  if (!event) return {};
  if (typeof event === 'string') {
    try {
      return JSON.parse(event);
    } catch {
      return {};
    }
  }
  if (typeof event === 'object') return event as Record<string, unknown>;
  return {};
}

async function readRequestBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function sendResponse(response: http.ServerResponse, result: ReturnType<typeof json>) {
  const bodyText = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
  response.writeHead(result.statusCode, {
    ...result.headers,
    'content-length': Buffer.byteLength(bodyText)
  });
  response.end(bodyText);
}

type HttpContext = {
  httpMethod?: string;
  url?: string;
};

type CloudBaseContext = {
  httpContext?: HttpContext;
};

export async function main(event: unknown, context: CloudBaseContext) {
  try {
    const httpContext = context.httpContext ?? {};
    const method = (httpContext.httpMethod || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      return json(200, { ok: true });
    }

    const url = new URL(httpContext.url || '/', 'https://cloudbase.local');
    const pathname = normalizePath(url.pathname);
    const body = parseBody(event);

    if (method === 'GET' && (pathname === '/' || pathname === '/health')) {
      return json(200, {
        ok: true,
        service: 'shoubayi-cloudbase',
        env: ENV_ID
      });
    }

    if (method === 'POST' && pathname === '/rooms') {
      const nickname = String(body.nickname || '玩家').slice(0, 12);
      const { room, player } = await createOnlineRoom(nickname);
      return json(200, { code: room.code, playerId: player.id, seat: player.seat });
    }

    const roomMatch = pathname.match(/^\/rooms\/([^/]+)(?:\/([^/]+))?$/);
    if (!roomMatch) {
      return json(404, { error: 'NOT_FOUND' });
    }

    const code = roomMatch[1];
    const action = roomMatch[2] || '';
    const roomDoc = await getRoom(code);
    if (!roomDoc) {
      return json(404, { error: 'ROOM_NOT_FOUND' });
    }

    if (method === 'GET' && (action === '' || action === 'snapshot')) {
      const playerId = url.searchParams.get('playerId') || '';
      return json(200, snapshotFor(roomDoc, playerId));
    }

    if (method === 'POST' && action === 'join') {
      const nickname = String(body.nickname || '玩家').slice(0, 12);
      const playerId = typeof body.playerId === 'string' ? body.playerId : undefined;
      const player = joinOnlineRoom(roomDoc, nickname, playerId);
      await saveRoom(roomDoc);
      return json(200, { code, playerId: player.id, seat: player.seat });
    }

    if (method === 'POST' && action === 'start') {
      startRoom(roomDoc);
      await saveRoom(roomDoc);
      return json(200, { ok: true });
    }

    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const player = Object.values(roomDoc.players).find((item) => item?.id === playerId);
    if (!player) {
      return json(403, { error: 'PLAYER_NOT_IN_ROOM' });
    }
    if (!roomDoc.started || !roomDoc.state) {
      return json(400, { error: 'ROOM_NOT_STARTED' });
    }

    const room = buildRoom(roomDoc);
    if (method === 'POST' && action === 'play') {
      const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter((id): id is string => typeof id === 'string') : [];
      const before = room.snapshotFor(player.seat);
      const playedCards = before.hand.filter((card) => cardIds.includes(card.id));
      const result = room.playCards(player.seat, cardIds);
      roomDoc.version += result.ok ? 1 : 0;
      if (result.ok) {
        roomDoc.state = result.state;
        roomDoc.tableCards[player.seat] = playedCards;
      }
      roomDoc.logs.unshift(`${player.nickname} 出牌：${result.ok ? '成功' : result.reason}`);
      await saveRoom(roomDoc);
      return json(result.ok ? 200 : 400, { ok: result.ok, reason: result.reason });
    }

    if (method === 'POST' && action === 'pass') {
      const result = room.pass(player.seat);
      roomDoc.version += result.ok ? 1 : 0;
      if (result.ok) roomDoc.state = result.state;
      roomDoc.logs.unshift(`${player.nickname} 不出：${result.ok ? '成功' : result.reason}`);
      await saveRoom(roomDoc);
      return json(result.ok ? 200 : 400, { ok: result.ok, reason: result.reason });
    }

    return json(404, { error: 'NOT_FOUND' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return json(500, { error: message });
  }
}

const server = http.createServer(async (request, response) => {
  const body = await readRequestBody(request);
  const result = await main(body, {
    httpContext: {
      httpMethod: request.method,
      url: request.url
    }
  });
  sendResponse(response, result);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`shoubayi CloudBase API listening on ${PORT}`);
});
