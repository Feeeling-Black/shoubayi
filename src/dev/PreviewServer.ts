import http from 'node:http';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { AutoPlayManager } from '../game/AutoPlayManager.ts';
import { createSeatPlayerIds, Room } from '../game/Room.ts';
import { SEATS, type Seat } from '../game/Seats.ts';
import type { Card } from '../rules/Card.ts';
import { HandAnalyzer } from '../rules/HandAnalyzer.ts';
import { HandComparator } from '../rules/HandComparator.ts';

const PORT = Number(process.env.PORT ?? 4173);
const autoplay = new AutoPlayManager();
const analyzer = new HandAnalyzer();
const comparator = new HandComparator();

let room = createRoom();
let logs: string[] = [];

function createRoom(): Room {
  const nextRoom = new Room('preview-room', createSeatPlayerIds('preview'));
  nextRoom.startRound({ levelRank: '3' });
  return nextRoom;
}

function isSeatValue(value: unknown): value is Seat {
  return typeof value === 'string' && (SEATS as string[]).includes(value);
}

function describeCard(card: Card): string {
  if (card.rank === 'LZ') return 'LZ';
  if (card.rank === 'BJ') return '大王';
  if (card.rank === 'SJ') return '小王';
  return `${card.rank}${card.suit}`;
}

function chooseFollowCards(seat: Seat): Card[] {
  const snapshot = room.snapshotFor(seat);
  if (!snapshot.lastPlay) return [];

  for (const card of snapshot.hand) {
    const analysis = analyzer.analyze([card], snapshot.context);
    if (analysis.valid && comparator.canBeat(analysis, snapshot.lastPlay.analysis, snapshot.context)) {
      return [card];
    }
  }

  const grouped = new Map<string, Card[]>();
  for (const card of snapshot.hand) {
    if (card.isLaizi || card.rank === 'LZ') continue;
    const current = grouped.get(card.rank) ?? [];
    current.push(card);
    grouped.set(card.rank, current);
  }

  for (const group of grouped.values()) {
    const analysis = analyzer.analyze(group, snapshot.context);
    if (analysis.valid && comparator.canBeat(analysis, snapshot.lastPlay.analysis, snapshot.context)) {
      return group;
    }
  }

  return [];
}

function chooseCards(seat: Seat): Card[] {
  const snapshot = room.snapshotFor(seat);
  return snapshot.lastPlay
    ? chooseFollowCards(seat)
    : autoplay.chooseLeadCards(snapshot.hand, snapshot.context);
}

function payloadFor(seat: Seat) {
  const snapshot = room.snapshotFor(seat);
  return {
    ...snapshot,
    hand: snapshot.hand.map((card) => ({
      ...card,
      label: describeCard(card)
    })),
    lastPlay: snapshot.lastPlay
      ? {
          ...snapshot.lastPlay,
          label: snapshot.lastPlay.cardIds.join(', ')
        }
      : undefined,
    logs
  };
}

function json(response: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text)
  });
  response.end(text);
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function handleAutoStep(seat: Seat) {
  const state = room.getState();
  if (!state || state.phase === 'FINISHED') {
    logs.unshift('本局已经结束');
    return;
  }

  const currentSeat = state.currentSeat;
  const selected = chooseCards(currentSeat);
  if (selected.length === 0 && state.lastPlay) {
    const result = room.pass(currentSeat);
    logs.unshift(`${currentSeat} 过牌：${result.ok ? '成功' : result.reason}`);
    return;
  }

  if (selected.length === 0) {
    logs.unshift(`${currentSeat} 没有可自动出的首出牌`);
    return;
  }

  const result = room.playCards(currentSeat, selected.map((card) => card.id));
  logs.unshift(`${currentSeat} 出 ${selected.map(describeCard).join(' ')}：${result.ok ? '成功' : result.reason}`);
  void seat;
}

function pageHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>手把一 本地预览</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #0f3f2f; color: #f6f4e8; }
    header { padding: 16px 20px; background: #0a2c22; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    main { padding: 18px; display: grid; grid-template-columns: 260px 1fr; gap: 18px; }
    button, select { border: 0; border-radius: 6px; padding: 9px 12px; font-size: 14px; }
    button { background: #f0c14b; color: #191919; cursor: pointer; }
    button.secondary { background: #d9e8df; }
    .panel { background: #14543f; border: 1px solid #2b765d; border-radius: 8px; padding: 14px; }
    .seats { display: grid; gap: 10px; }
    .seat { padding: 10px; border-radius: 8px; background: #0c3528; display: flex; justify-content: space-between; }
    .active { outline: 2px solid #f0c14b; }
    .hand { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; min-height: 300px; }
    .card { min-width: 54px; height: 74px; border-radius: 7px; background: #f9f6e8; color: #111; border: 2px solid transparent; display: grid; place-items: center; font-weight: 700; cursor: pointer; user-select: none; }
    .card.selected { border-color: #f0c14b; transform: translateY(-6px); }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
    .meta { color: #d9e8df; line-height: 1.7; }
    .logs { max-height: 220px; overflow: auto; font-size: 13px; line-height: 1.6; color: #f7e7a6; }
    @media (max-width: 820px) { main { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <strong>手把一 本地预览</strong>
    <div class="toolbar">
      <select id="seat">
        <option>A</option><option>B</option><option>C</option><option>D</option>
      </select>
      <button id="newGame">重新发牌</button>
      <button id="autoStep" class="secondary">自动走一步</button>
    </div>
  </header>
  <main>
    <section class="panel">
      <h3>牌局</h3>
      <div id="meta" class="meta"></div>
      <h3>座位</h3>
      <div id="seats" class="seats"></div>
      <h3>日志</h3>
      <div id="logs" class="logs"></div>
    </section>
    <section class="panel">
      <div class="toolbar">
        <button id="play">出选中的牌</button>
        <button id="pass" class="secondary">过牌</button>
        <button id="clear" class="secondary">清空选择</button>
      </div>
      <div id="hand" class="hand"></div>
    </section>
  </main>
  <script>
    const selected = new Set();
    const seatSelect = document.querySelector('#seat');
    const handEl = document.querySelector('#hand');
    const seatsEl = document.querySelector('#seats');
    const metaEl = document.querySelector('#meta');
    const logsEl = document.querySelector('#logs');

    async function api(path, body) {
      const response = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
      return response.json();
    }

    async function load() {
      const seat = seatSelect.value;
      const data = await api('/api/snapshot?seat=' + seat);
      render(data);
    }

    function render(data) {
      metaEl.innerHTML = [
        '当前座位：' + data.currentSeat,
        '你的视角：' + data.yourSeat,
        '当前级牌：' + data.context.levelRank,
        '阶段：' + data.phase,
        data.result ? '胜方：' + data.result.winnerTeam + '，升级：' + data.result.levelUp : ''
      ].filter(Boolean).join('<br>');

      seatsEl.innerHTML = ['A','B','C','D'].map((seat) =>
        '<div class="seat ' + (seat === data.currentSeat ? 'active' : '') + '"><span>' + seat + '</span><span>' + data.handCounts[seat] + ' 张</span></div>'
      ).join('');

      handEl.innerHTML = data.hand.map((card) =>
        '<div class="card ' + (selected.has(card.id) ? 'selected' : '') + '" data-id="' + card.id + '">' + card.label + '</div>'
      ).join('');

      logsEl.innerHTML = data.logs.map((line) => '<div>' + line + '</div>').join('');
    }

    handEl.addEventListener('click', (event) => {
      const card = event.target.closest('.card');
      if (!card) return;
      const id = card.getAttribute('data-id');
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      card.classList.toggle('selected');
    });

    document.querySelector('#play').addEventListener('click', async () => {
      await api('/api/play', { seat: seatSelect.value, cardIds: [...selected] });
      selected.clear();
      await load();
    });
    document.querySelector('#pass').addEventListener('click', async () => {
      await api('/api/pass', { seat: seatSelect.value });
      selected.clear();
      await load();
    });
    document.querySelector('#clear').addEventListener('click', async () => {
      selected.clear();
      await load();
    });
    document.querySelector('#newGame').addEventListener('click', async () => {
      await api('/api/new-game', {});
      selected.clear();
      await load();
    });
    document.querySelector('#autoStep').addEventListener('click', async () => {
      await api('/api/auto-step', { seat: seatSelect.value });
      selected.clear();
      await load();
    });
    seatSelect.addEventListener('change', async () => {
      selected.clear();
      await load();
    });
    load();
  </script>
</body>
</html>`;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/') {
      const html = pageHtml();
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': Buffer.byteLength(html)
      });
      response.end(html);
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/easy' || url.pathname === '/easy-preview.html')) {
      const html = readFileSync('public/easy-preview.html', 'utf8');
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': Buffer.byteLength(html)
      });
      response.end(html);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/snapshot') {
      const seat = url.searchParams.get('seat') ?? 'A';
      if (!isSeatValue(seat)) return json(response, 400, { error: 'INVALID_SEAT' });
      return json(response, 200, payloadFor(seat));
    }

    if (request.method === 'POST' && url.pathname === '/api/new-game') {
      room = createRoom();
      logs = ['重新发牌'];
      return json(response, 200, payloadFor('A'));
    }

    if (request.method === 'POST' && url.pathname === '/api/play') {
      const body = await readJson(request) as { seat?: unknown; cardIds?: unknown };
      if (!isSeatValue(body.seat) || !Array.isArray(body.cardIds)) {
        return json(response, 400, { error: 'BAD_REQUEST' });
      }
      const result = room.playCards(body.seat, body.cardIds.filter((id): id is string => typeof id === 'string'));
      logs.unshift(`${body.seat} 手动出牌：${result.ok ? '成功' : result.reason}`);
      return json(response, 200, payloadFor(body.seat));
    }

    if (request.method === 'POST' && url.pathname === '/api/pass') {
      const body = await readJson(request) as { seat?: unknown };
      if (!isSeatValue(body.seat)) return json(response, 400, { error: 'BAD_REQUEST' });
      const result = room.pass(body.seat);
      logs.unshift(`${body.seat} 手动过牌：${result.ok ? '成功' : result.reason}`);
      return json(response, 200, payloadFor(body.seat));
    }

    if (request.method === 'POST' && url.pathname === '/api/auto-step') {
      const body = await readJson(request) as { seat?: unknown };
      const seat = isSeatValue(body.seat) ? body.seat : 'A';
      handleAutoStep(seat);
      return json(response, 200, payloadFor(seat));
    }

    return json(response, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return json(response, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`手把一预览服务已启动: http://localhost:${PORT}`);
});
