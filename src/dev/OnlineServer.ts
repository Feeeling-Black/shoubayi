import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { URL } from 'node:url';
import { createSeatPlayerIds, isSeat, Room } from '../game/Room.ts';
import { SEATS, type Seat } from '../game/Seats.ts';
import type { Card } from '../rules/Card.ts';

const PORT = Number(process.env.PORT ?? 4180);
const HAND_ASSET_DIR = 'ShouBaYiCocos/assets/resources/ui/Hand';

type Player = {
  id: string;
  nickname: string;
  seat: Seat;
};

type OnlineRoom = {
  code: string;
  room: Room;
  players: Partial<Record<Seat, Player>>;
  logs: string[];
  version: number;
  started: boolean;
};

const rooms = new Map<string, OnlineRoom>();

function makeCode(): string {
  let code = '';
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));
  return code;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nextSeat(players: OnlineRoom['players']): Seat | undefined {
  return SEATS.find((seat) => !players[seat]);
}

function cardLabel(card: Card): string {
  if (card.rank === 'LZ' || card.isLaizi) return '癞子';
  if (card.rank === 'BJ') return '大王';
  if (card.rank === 'SJ') return '小王';
  return `${card.rank}${card.suit}`;
}

function cardImage(card: Card): string {
  if (card.rank === 'LZ' || card.isLaizi) return '/hand/wild-card.png';
  if (card.rank === 'BJ') return '/hand/big-king.png';
  if (card.rank === 'SJ') return '/hand/small-king.png';
  const suits: Record<string, string> = {
    S: 'Spades',
    H: 'Hearts',
    C: 'Clubs',
    D: 'Diamonds'
  };
  return `/hand/${card.rank}-of-${suits[card.suit]}.png`;
}

function publicRoomState(online: OnlineRoom) {
  return {
    code: online.code,
    started: online.started,
    version: online.version,
    players: SEATS.map((seat) => ({
      seat,
      nickname: online.players[seat]?.nickname ?? '',
      occupied: !!online.players[seat]
    }))
  };
}

function healthPayload() {
  return {
    ok: true,
    service: 'shoubayi-online',
    rooms: rooms.size,
    startedRooms: [...rooms.values()].filter((room) => room.started).length
  };
}

function snapshotFor(online: OnlineRoom, playerId: string) {
  const player = Object.values(online.players).find((item) => item?.id === playerId);
  const lobby = publicRoomState(online);
  if (!player || !online.started) {
    return { ...lobby, yourSeat: player?.seat, logs: online.logs };
  }

  const snapshot = online.room.snapshotFor(player.seat);
  const lastPlayCards = snapshot.lastPlay?.cardIds ?? [];
  return {
    ...lobby,
    yourSeat: player.seat,
    phase: snapshot.phase,
    context: snapshot.context,
    currentSeat: snapshot.currentSeat,
    hand: snapshot.hand.map((card) => ({
      ...card,
      label: cardLabel(card),
      image: cardImage(card)
    })),
    handCounts: snapshot.handCounts,
    lastPlay: snapshot.lastPlay
      ? {
          ...snapshot.lastPlay,
          cards: lastPlayCards
        }
      : undefined,
    passedSeats: snapshot.passedSeats,
    finishedOrder: snapshot.finishedOrder,
    result: snapshot.result,
    logs: online.logs
  };
}

function createOnlineRoom(nickname: string): { online: OnlineRoom; player: Player } {
  const code = makeCode();
  const online: OnlineRoom = {
    code,
    room: new Room(code, createSeatPlayerIds(code)),
    players: {},
    logs: [],
    version: 1,
    started: false
  };
  const player: Player = { id: makeId(), nickname, seat: 'A' };
  online.players.A = player;
  online.logs.unshift(`${nickname} 创建房间`);
  rooms.set(code, online);
  return { online, player };
}

function joinOnlineRoom(code: string, nickname: string, playerId?: string): { online: OnlineRoom; player: Player } {
  const online = rooms.get(code);
  if (!online) throw new Error('ROOM_NOT_FOUND');

  const existing = Object.values(online.players).find((item) => item?.id === playerId);
  if (existing) return { online, player: existing };

  const seat = nextSeat(online.players);
  if (!seat) throw new Error('ROOM_FULL');
  const player: Player = { id: makeId(), nickname, seat };
  online.players[seat] = player;
  online.version += 1;
  online.logs.unshift(`${nickname} 加入 ${seat} 位`);
  return { online, player };
}

function startRoom(online: OnlineRoom) {
  if (online.started) return;
  const count = Object.values(online.players).filter(Boolean).length;
  if (count < 4) throw new Error('NEED_FOUR_PLAYERS');
  online.room.startRound({ levelRank: '3' });
  online.started = true;
  online.version += 1;
  online.logs.unshift('牌局开始');
}

function json(response: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text)
  });
  response.end(text);
}

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function pageHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>手把一联机原型</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #0e3428; color: #f8f1da; }
    header { padding: 12px; background: #0648b7; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, button { height: 36px; border-radius: 8px; border: 0; padding: 0 12px; font-size: 15px; }
    button { background: #f1c04f; color: #1a1308; font-weight: 700; }
    main { padding: 12px; display: grid; gap: 12px; }
    .panel { background: rgba(0,0,0,.24); border: 1px solid rgba(255,255,255,.15); border-radius: 10px; padding: 12px; }
    .seats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .seat { padding: 10px; border-radius: 8px; background: rgba(255,255,255,.08); }
    .current { outline: 2px solid #f1c04f; }
    .hand { display: flex; flex-wrap: wrap; align-items: flex-start; min-height: 180px; }
    .card { width: 58px; height: 81px; margin-left: -18px; border-radius: 5px; background: #fff; border: 2px solid transparent; overflow: hidden; }
    .card:first-child { margin-left: 0; }
    .card.selected { border-color: #f1c04f; transform: translateY(-8px); }
    .card img { width: 100%; height: 100%; display: block; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .muted { color: #d8e7df; }
    .logs { max-height: 130px; overflow: auto; font-size: 13px; color: #f7db83; }
  </style>
</head>
<body>
  <header>
    <strong>手把一联机</strong>
    <input id="nickname" placeholder="昵称" />
    <input id="roomCode" placeholder="房号" />
    <button id="create">创建房间</button>
    <button id="join">加入房间</button>
    <button id="start">开始</button>
  </header>
  <main>
    <section class="panel">
      <div id="status" class="muted">先创建或加入房间</div>
      <div id="seats" class="seats"></div>
    </section>
    <section class="panel">
      <div class="toolbar">
        <button id="play">出牌</button>
        <button id="pass">不出</button>
      </div>
      <div id="hand" class="hand"></div>
    </section>
    <section class="panel logs" id="logs"></section>
  </main>
  <script>
    const state = {
      roomCode: localStorage.getItem('roomCode') || '',
      playerId: localStorage.getItem('playerId') || '',
      selected: new Set()
    };
    const $ = (id) => document.getElementById(id);
    $('roomCode').value = state.roomCode;
    $('nickname').value = localStorage.getItem('nickname') || '';

    async function api(path, body) {
      const response = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '请求失败');
      return data;
    }

    function remember(data) {
      if (data.code) {
        state.roomCode = data.code;
        $('roomCode').value = data.code;
        localStorage.setItem('roomCode', data.code);
      }
      if (data.playerId) {
        state.playerId = data.playerId;
        localStorage.setItem('playerId', data.playerId);
      }
      const nickname = $('nickname').value.trim();
      if (nickname) localStorage.setItem('nickname', nickname);
    }

    async function refresh() {
      if (!state.roomCode || !state.playerId) return;
      try {
        const data = await api('/api/rooms/' + state.roomCode + '/snapshot?playerId=' + encodeURIComponent(state.playerId));
        render(data);
      } catch (error) {
        $('status').textContent = error.message;
      }
    }

    function render(data) {
      $('status').textContent = '房号 ' + data.code + ' · 你是 ' + (data.yourSeat || '旁观') + (data.started ? ' · 轮到 ' + data.currentSeat : ' · 等待开始');
      $('seats').innerHTML = data.players.map((seat) =>
        '<div class="seat ' + (seat.seat === data.currentSeat ? 'current' : '') + '"><b>' + seat.seat + '</b><br>' + (seat.nickname || '空位') + (data.handCounts ? '<br>' + data.handCounts[seat.seat] + ' 张' : '') + '</div>'
      ).join('');
      $('hand').innerHTML = (data.hand || []).map((card) =>
        '<div class="card ' + (state.selected.has(card.id) ? 'selected' : '') + '" data-id="' + card.id + '"><img src="' + card.image + '" alt="' + card.label + '"></div>'
      ).join('');
      $('logs').innerHTML = (data.logs || []).map((line) => '<div>' + line + '</div>').join('');
    }

    $('create').onclick = async () => {
      const nickname = $('nickname').value.trim() || '玩家';
      const data = await api('/api/rooms', { nickname });
      remember(data);
      await refresh();
    };
    $('join').onclick = async () => {
      const nickname = $('nickname').value.trim() || '玩家';
      const code = $('roomCode').value.trim();
      const data = await api('/api/rooms/' + code + '/join', { nickname, playerId: state.playerId });
      remember(data);
      await refresh();
    };
    $('start').onclick = async () => {
      await api('/api/rooms/' + state.roomCode + '/start', { playerId: state.playerId });
      await refresh();
    };
    $('play').onclick = async () => {
      await api('/api/rooms/' + state.roomCode + '/play', { playerId: state.playerId, cardIds: [...state.selected] });
      state.selected.clear();
      await refresh();
    };
    $('pass').onclick = async () => {
      await api('/api/rooms/' + state.roomCode + '/pass', { playerId: state.playerId });
      state.selected.clear();
      await refresh();
    };
    $('hand').onclick = (event) => {
      const card = event.target.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      card.classList.toggle('selected');
    };
    setInterval(refresh, 1000);
    refresh();
  </script>
</body>
</html>`;
}

function serveHandImage(url: URL, response: http.ServerResponse): boolean {
  if (!url.pathname.startsWith('/hand/')) return false;
  const filename = basename(decodeURIComponent(url.pathname.slice('/hand/'.length)));
  const file = join(HAND_ASSET_DIR, filename);
  if (!filename.endsWith('.png') || !existsSync(file)) {
    json(response, 404, { error: 'NOT_FOUND' });
    return true;
  }
  const data = readFileSync(file);
  response.writeHead(200, { 'content-type': 'image/png', 'content-length': data.length });
  response.end(data);
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (serveHandImage(url, response)) return;

    if (request.method === 'GET' && url.pathname === '/') {
      const html = pageHtml();
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(html) });
      response.end(html);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, healthPayload());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const body = await readJson(request);
      const nickname = String(body.nickname || '玩家').slice(0, 12);
      const { online, player } = createOnlineRoom(nickname);
      json(response, 200, { code: online.code, playerId: player.id, seat: player.seat });
      return;
    }

    const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/([^/]+))?$/);
    if (!roomMatch) {
      json(response, 404, { error: 'NOT_FOUND' });
      return;
    }

    const code = roomMatch[1];
    const action = roomMatch[2] || '';
    const online = rooms.get(code);
    if (!online) {
      json(response, 404, { error: 'ROOM_NOT_FOUND' });
      return;
    }

    if (request.method === 'GET' && action === 'snapshot') {
      const playerId = url.searchParams.get('playerId') || '';
      json(response, 200, snapshotFor(online, playerId));
      return;
    }

    const body = await readJson(request);
    if (request.method === 'POST' && action === 'join') {
      const nickname = String(body.nickname || '玩家').slice(0, 12);
      const playerId = typeof body.playerId === 'string' ? body.playerId : undefined;
      const joined = joinOnlineRoom(code, nickname, playerId);
      json(response, 200, { code, playerId: joined.player.id, seat: joined.player.seat });
      return;
    }

    if (request.method === 'POST' && action === 'start') {
      startRoom(online);
      json(response, 200, { ok: true });
      return;
    }

    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const player = Object.values(online.players).find((item) => item?.id === playerId);
    if (!player) {
      json(response, 403, { error: 'PLAYER_NOT_IN_ROOM' });
      return;
    }

    if (request.method === 'POST' && action === 'play') {
      const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter((id): id is string => typeof id === 'string') : [];
      const result = online.room.playCards(player.seat, cardIds);
      online.version += result.ok ? 1 : 0;
      online.logs.unshift(`${player.nickname} 出牌：${result.ok ? '成功' : result.reason}`);
      json(response, result.ok ? 200 : 400, { ok: result.ok, reason: result.reason });
      return;
    }

    if (request.method === 'POST' && action === 'pass') {
      const result = online.room.pass(player.seat);
      online.version += result.ok ? 1 : 0;
      online.logs.unshift(`${player.nickname} 不出：${result.ok ? '成功' : result.reason}`);
      json(response, result.ok ? 200 : 400, { ok: result.ok, reason: result.reason });
      return;
    }

    json(response, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    json(response, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`手把一联机原型已启动: http://localhost:${PORT}`);
});
