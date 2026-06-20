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
  tableCards: Partial<Record<Seat, Card[]>>;
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

function publicCard(card: Card) {
  return {
    ...card,
    label: cardLabel(card),
    image: cardImage(card)
  };
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
      ...publicCard(card)
    })),
    handCounts: snapshot.handCounts,
    lastPlay: snapshot.lastPlay
      ? {
          ...snapshot.lastPlay,
          cards: online.tableCards[snapshot.lastPlay.playerId as Seat]?.map(publicCard) ?? lastPlayCards
        }
      : undefined,
    tableCards: Object.fromEntries(
      SEATS.map((seat) => [seat, (online.tableCards[seat] ?? []).map(publicCard)])
    ),
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
    tableCards: {},
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
  online.tableCards = {};
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
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>手把一联机</title>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      font-family: "Microsoft YaHei", Arial, sans-serif;
      color: #fff8dc;
      background: #1f1f1f;
      user-select: none;
    }
    button, input { font-family: inherit; }
    .stage {
      position: relative;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      background: #123b2a url('/ui/table-bg-v1.png') center / cover no-repeat;
    }
    .stage:after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(circle at 50% 54%, rgba(0,0,0,0) 0 46%, rgba(0,0,0,.18) 100%);
    }
    .topbar {
      position: absolute;
      z-index: 20;
      top: max(10px, env(safe-area-inset-top));
      left: 50%;
      width: min(760px, calc(100vw - 18px));
      height: 42px;
      transform: translateX(-50%);
      display: grid;
      grid-template-columns: 145px 100px 82px 126px 100px 100px;
      align-items: center;
      padding: 0 12px;
      border-radius: 19px;
      color: #eaf5ff;
      font-size: 18px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0,0,0,.45);
      background: linear-gradient(180deg, #116ee0 0%, #0751bd 48%, #073a93 100%);
      border: 1px solid rgba(125, 194, 255, .55);
      box-shadow: inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 0 rgba(0,33,92,.5), 0 2px 8px rgba(0,0,0,.22);
    }
    .topbar span { min-width: 0; white-space: nowrap; text-align: center; border-left: 1px solid rgba(182,220,255,.25); }
    .topbar span:first-child { border-left: 0; text-align: left; }
    .turn { color: #ffec3d; }
    .pill {
      width: 94px;
      justify-self: center;
      height: 28px;
      line-height: 28px;
      border-radius: 16px;
      box-shadow: inset 0 1px 1px rgba(255,255,255,.35), inset 0 -2px 3px rgba(0,0,0,.22);
    }
    .blue { background: linear-gradient(180deg, #5b9df4, #1164d9 48%, #0a42ab); }
    .red { background: linear-gradient(180deg, #d75b69, #b7364b 50%, #7f2135); }
    .join-box {
      position: absolute;
      z-index: 60;
      top: 72px;
      left: 50%;
      width: min(420px, calc(100vw - 24px));
      transform: translateX(-50%);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      align-items: center;
      justify-content: center;
      padding: 10px;
      border-radius: 10px;
      background: rgba(4, 33, 39, .72);
      border: 1px solid rgba(255, 223, 128, .38);
      box-shadow: 0 8px 22px rgba(0,0,0,.28);
    }
    .join-box input {
      width: 100%;
      height: 34px;
      border: 1px solid rgba(255,255,255,.28);
      border-radius: 7px;
      padding: 0 10px;
      color: #1f2a30;
      font-size: 15px;
      background: rgba(255,255,255,.92);
      outline: 0;
    }
    .btn {
      min-width: 86px;
      height: 36px;
      border: 0;
      border-radius: 20px;
      color: #fff;
      font-size: 17px;
      font-weight: 800;
      text-shadow: 0 1px 2px rgba(0,0,0,.55);
      box-shadow: inset 0 2px 1px rgba(255,255,255,.45), inset 0 -3px 4px rgba(70,30,8,.4), 0 3px 7px rgba(0,0,0,.22);
    }
    .btn:disabled { filter: grayscale(.35); opacity: .58; }
    #start { grid-column: 1 / -1; }
    .orange { background: linear-gradient(180deg, #ffce54, #e68d19 48%, #9d5511); }
    .brown { background: linear-gradient(180deg, #46576a, #273648 50%, #101821); }
    .seat {
      position: absolute;
      z-index: 12;
      width: 224px;
      height: 126px;
      color: #fff7da;
    }
    .seat.a { left: 28px; bottom: 40px; }
    .seat.b { right: 34px; top: 232px; }
    .seat.c { left: 50%; top: 112px; transform: translateX(-50%); }
    .seat.d { left: 34px; top: 232px; }
    .seat-panel {
      position: absolute;
      inset: 28px 0 10px 58px;
      background: rgba(2, 24, 21, .48);
    }
    .seat.b .seat-panel { inset: 28px 58px 10px 0; }
    .avatar {
      position: absolute;
      width: 106px;
      height: 106px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #4b2c12;
      font-size: 28px;
      font-weight: 900;
      background: #050505;
      background-image: url('/ui/avatar-fill-2.png');
      background-size: cover;
      text-shadow: 0 1px 1px rgba(255,211,110,.25);
    }
    .avatar:after {
      content: "";
      position: absolute;
      inset: -12px;
      background: url('/ui/Avatar-frame-2(256).png') center / contain no-repeat;
    }
    .seat.a .avatar {
      width: 126px;
      height: 126px;
      background-image: url('/ui/avatar-fill.png');
    }
    .seat.a .avatar:after { inset: -16px; background-image: url('/ui/Avatar-frame（256）.png'); }
    .seat.a .avatar, .seat.d .avatar { left: 0; top: 0; }
    .seat.b .avatar { right: 0; top: 0; }
    .seat.c .avatar { left: 4px; top: 0; }
    .seat-info {
      position: absolute;
      left: 108px;
      top: 34px;
      min-width: 100px;
      text-shadow: 0 2px 3px rgba(0,0,0,.65);
    }
    .seat.b .seat-info { left: auto; right: 108px; text-align: right; }
    .name { font-size: 20px; font-weight: 900; white-space: nowrap; }
    .team-tag {
      display: inline-block;
      margin-top: 8px;
      width: 88px;
      height: 30px;
      line-height: 30px;
      text-align: center;
      border-radius: 16px;
      font-size: 17px;
      font-weight: 900;
      box-shadow: inset 0 2px 1px rgba(255,255,255,.42), inset 0 -2px 4px rgba(0,0,0,.28);
    }
    .count {
      margin-top: 6px;
      font-size: 14px;
      color: #e7f0ed;
    }
    .seat.current .avatar { filter: drop-shadow(0 0 10px rgba(255,215,80,.95)); }
    .seat.current .seat-panel { outline: 2px solid rgba(255, 220, 88, .72); }
    .seat.passed .count { color: #ffe668; font-size: 22px; font-weight: 900; }
    .center {
      position: absolute;
      z-index: 10;
      left: 50%;
      top: 42%;
      width: min(430px, 56vw);
      min-height: 84px;
      transform: translate(-50%, -50%);
      text-align: center;
      text-shadow: 0 2px 3px rgba(0,0,0,.55);
    }
    .center-line {
      display: flex;
      align-items: center;
      gap: 14px;
      color: #ecffe7;
      font-size: 26px;
      font-weight: 900;
    }
    .center-line:before, .center-line:after {
      content: "";
      flex: 1;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(219,255,229,.7), transparent);
    }
    .center-tip { margin-top: 6px; color: rgba(230,250,236,.8); font-size: 15px; font-weight: 700; }
    .play-zone {
      position: absolute;
      z-index: 11;
      display: flex;
      align-items: flex-start;
      min-width: 170px;
      min-height: 86px;
      pointer-events: none;
    }
    .play-zone.a { left: 50%; bottom: 174px; transform: translateX(-50%); }
    .play-zone.b { right: 260px; top: 294px; justify-content: flex-end; }
    .play-zone.c { left: 50%; top: 212px; transform: translateX(-50%); }
    .play-zone.d { left: 260px; top: 294px; }
    .mini-card {
      width: 48px;
      height: 67px;
      margin-left: -13px;
      border-radius: 4px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.2);
    }
    .mini-card:first-child { margin-left: 0; }
    .mini-card img { width: 100%; height: 100%; display: block; }
    .action-bar {
      position: absolute;
      z-index: 30;
      left: 50%;
      bottom: 122px;
      transform: translateX(-50%);
      display: flex;
      gap: 44px;
      align-items: center;
    }
    .action-bar .btn { width: 132px; }
    .stage.lobby .action-bar,
    .stage.lobby .hand-status,
    .stage.lobby .hand,
    .stage.lobby .log {
      display: none;
    }
    .stage.lobby .center {
      top: min(58%, 360px);
    }
    .hand-status {
      position: absolute;
      z-index: 18;
      left: 50%;
      bottom: 84px;
      width: min(700px, calc(100vw - 190px));
      height: 30px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      border-radius: 15px;
      color: #ffe7a0;
      font-size: 15px;
      background: rgba(5, 31, 28, .58);
      border: 1px solid rgba(255, 223, 115, .22);
      text-shadow: 0 1px 2px rgba(0,0,0,.6);
    }
    .hand {
      position: absolute;
      z-index: 24;
      left: 50%;
      bottom: 8px;
      width: min(940px, calc(100vw - 12px));
      height: 108px;
      transform: translateX(-50%);
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      justify-content: center;
      overflow: visible;
    }
    .card {
      position: relative;
      width: 54px;
      height: 76px;
      margin-left: -17px;
      margin-bottom: -6px;
      border-radius: 5px;
      overflow: visible;
      background: #fff;
      border: 2px solid transparent;
      transform: translateY(0);
      transition: transform .08s ease, filter .08s ease, border-color .08s ease;
    }
    .card:first-child { margin-left: 0; }
    .card img {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,.14);
      pointer-events: none;
    }
    .card.selected {
      border-color: #efc84f;
      transform: translateY(-13px);
      filter: drop-shadow(0 4px 5px rgba(0,0,0,.28));
      z-index: 5;
    }
    .card.level-card {
      border-color: #d7aa33;
    }
    .card.level-card:after {
      content: "★";
      position: absolute;
      left: 3px;
      bottom: 2px;
      font-size: 11px;
      line-height: 1;
      color: #d7aa33;
      text-shadow: 0 1px 1px rgba(255,255,255,.55);
      pointer-events: none;
    }
    .toast {
      position: absolute;
      z-index: 90;
      left: 50%;
      top: 50%;
      min-width: 260px;
      transform: translate(-50%, -50%);
      padding: 13px 20px;
      border-radius: 18px;
      text-align: center;
      color: #fff3c4;
      font-size: 18px;
      font-weight: 800;
      background: rgba(0,0,0,.72);
      border: 1px solid rgba(255,220,120,.75);
      display: none;
    }
    .rotate-mask {
      position: fixed;
      z-index: 120;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 28px;
      text-align: center;
      color: #fff4bd;
      background: radial-gradient(circle at center, rgba(10, 72, 52, .96), rgba(3, 18, 21, .98));
      text-shadow: 0 2px 4px rgba(0,0,0,.55);
    }
    .rotate-card {
      max-width: 320px;
      padding: 22px 18px;
      border-radius: 14px;
      border: 1px solid rgba(255, 220, 120, .6);
      background: rgba(0, 0, 0, .28);
      box-shadow: 0 10px 28px rgba(0,0,0,.35);
    }
    .rotate-icon { font-size: 46px; line-height: 1; margin-bottom: 10px; }
    .rotate-title { font-size: 22px; font-weight: 900; margin-bottom: 8px; }
    .rotate-text { font-size: 15px; color: #e9f2df; line-height: 1.45; }
    .log {
      position: absolute;
      z-index: 16;
      left: 50%;
      bottom: 2px;
      transform: translateX(-50%);
      width: min(900px, calc(100vw - 24px));
      color: #ffe89a;
      font-size: 13px;
      text-align: left;
      opacity: .9;
      pointer-events: none;
    }
    @media (max-width: 760px) {
      .topbar { grid-template-columns: 1fr 72px 56px 76px; height: 38px; font-size: 14px; }
      .topbar .pill { display: none; }
      .join-box { top: 58px; }
      .join-box input { height: 32px; }
      .join-box .btn { min-width: 76px; height: 32px; font-size: 15px; }
      .seat { transform: scale(.72); transform-origin: center; }
      .seat.a { left: -34px; bottom: 56px; }
      .seat.b { right: -48px; top: 190px; }
      .seat.c { top: 96px; transform: translateX(-50%) scale(.72); }
      .seat.d { left: -48px; top: 190px; }
      .play-zone.b { right: 120px; }
      .play-zone.d { left: 120px; }
      .action-bar { bottom: 112px; gap: 12px; }
      .action-bar .btn { width: 96px; font-size: 16px; }
      .hand-status { width: calc(100vw - 24px); bottom: 78px; }
      .card { width: 48px; height: 67px; margin-left: -19px; }
    }
    @media (orientation: landscape) and (max-height: 520px) {
      .topbar { top: 8px; height: 34px; font-size: 15px; border-radius: 16px; }
      .join-box { top: 56px; width: min(410px, calc(100vw - 24px)); padding: 8px; }
      .join-box input { height: 30px; font-size: 14px; }
      .join-box .btn { height: 30px; font-size: 15px; }
      .center { top: 50%; }
      .center-line { font-size: 22px; }
      .center-tip { font-size: 13px; }
      .seat { transform: scale(.68); }
      .seat.a { left: -38px; bottom: 36px; }
      .seat.b { right: -52px; top: 176px; }
      .seat.c { top: 82px; transform: translateX(-50%) scale(.68); }
      .seat.d { left: -52px; top: 176px; }
      .action-bar { bottom: 88px; gap: 12px; }
      .action-bar .btn { width: 92px; height: 32px; font-size: 15px; }
      .hand-status { bottom: 54px; height: 24px; font-size: 12px; }
      .hand { bottom: 2px; height: 58px; }
      .card { width: 38px; height: 53px; margin-left: -15px; }
      .play-zone.a { bottom: 130px; }
      .play-zone.b { right: 132px; top: 232px; }
      .play-zone.c { top: 148px; }
      .play-zone.d { left: 132px; top: 232px; }
      .mini-card { width: 36px; height: 50px; margin-left: -11px; }
    }
    @media (orientation: portrait) and (max-width: 920px) {
      .rotate-mask { display: flex; }
    }
  </style>
</head>
<body>
  <main id="stage" class="stage lobby">
    <section class="topbar">
      <span id="roomLabel">房号 --</span>
      <span id="roundLabel">第 1 局</span>
      <span id="levelLabel">打 3</span>
      <span id="turnLabel" class="turn">等待</span>
      <span id="blueLabel" class="pill blue">BLUE 3</span>
      <span id="redLabel" class="pill red">RED 3</span>
    </section>

    <section id="joinBox" class="join-box">
      <input id="nickname" maxlength="12" placeholder="昵称" />
      <input id="roomCode" inputmode="numeric" maxlength="6" placeholder="房号" />
      <button id="create" class="btn orange">创建</button>
      <button id="join" class="btn blue">加入</button>
      <button id="start" class="btn brown">开始</button>
    </section>

    <section id="seatA" class="seat a"></section>
    <section id="seatB" class="seat b"></section>
    <section id="seatC" class="seat c"></section>
    <section id="seatD" class="seat d"></section>

    <div id="zoneA" class="play-zone a"></div>
    <div id="zoneB" class="play-zone b"></div>
    <div id="zoneC" class="play-zone c"></div>
    <div id="zoneD" class="play-zone d"></div>

    <section class="center">
      <div id="centerText" class="center-line">等待开局</div>
      <div id="centerTip" class="center-tip">4 人到齐后开始</div>
    </section>

    <section class="action-bar">
      <button id="play" class="btn orange">出牌</button>
      <button id="hint" class="btn blue">提示</button>
      <button id="pass" class="btn brown">不要</button>
    </section>

    <section class="hand-status">
      <span id="selectionLabel">未选牌</span>
      <span id="hintLabel">提示可自动选牌</span>
    </section>
    <section id="hand" class="hand"></section>
    <section id="log" class="log"></section>
    <div id="toast" class="toast"></div>
    <section id="rotateMask" class="rotate-mask">
      <div class="rotate-card">
        <div class="rotate-icon">↻</div>
        <div class="rotate-title">请横屏游玩</div>
        <div class="rotate-text">把手机横过来，画面会自动恢复。部分浏览器需要先点一下页面才允许横屏。</div>
      </div>
    </section>
  </main>

  <script>
    const state = {
      roomCode: localStorage.getItem('roomCode') || '',
      playerId: localStorage.getItem('playerId') || '',
      selected: new Set(),
      lastSnapshot: null
    };
    const seats = ['A', 'B', 'C', 'D'];
    const teams = { A: 'BLUE', C: 'BLUE', B: 'RED', D: 'RED' };
    const $ = (id) => document.getElementById(id);
    $('roomCode').value = state.roomCode;
    $('nickname').value = localStorage.getItem('nickname') || '';

    async function requestLandscape() {
      try {
        if (document.fullscreenEnabled && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
        if (screen.orientation?.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (_) {
        // Some mobile browsers only allow manual rotation. The portrait mask handles that case.
      }
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[char]);
    }

    function toast(message) {
      $('toast').textContent = message;
      $('toast').style.display = 'block';
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => $('toast').style.display = 'none', 1600);
    }

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

    function clearRoomMemory() {
      state.roomCode = '';
      state.playerId = '';
      state.selected.clear();
      localStorage.removeItem('roomCode');
      localStorage.removeItem('playerId');
      $('roomCode').value = '';
      $('roomLabel').textContent = '房号 --';
      $('turnLabel').textContent = '等待';
      $('centerText').textContent = '等待开局';
      $('centerTip').textContent = '4 人到齐后开始';
      $('stage').className = 'stage lobby';
    }

    function seatView(data, seatId) {
      return data.players.find((item) => item.seat === seatId) || { seat: seatId, nickname: '', occupied: false };
    }

    function renderSeat(data, seatId) {
      const seat = seatView(data, seatId);
      const current = data.currentSeat === seatId;
      const passed = (data.passedSeats || []).includes(seatId);
      const count = data.handCounts ? data.handCounts[seatId] : 0;
      const nickname = seat.nickname || '空位';
      const team = teams[seatId];
      const el = $('seat' + seatId);
      el.className = 'seat ' + seatId.toLowerCase() + (current ? ' current' : '') + (passed ? ' passed' : '');
      el.innerHTML =
        '<div class="seat-panel"></div>' +
        '<div class="avatar">' + seatId + '</div>' +
        '<div class="seat-info">' +
          '<div class="name">' + escapeHtml(nickname) + '</div>' +
          '<div class="team-tag ' + (team === 'BLUE' ? 'blue' : 'red') + '">' + team + '</div>' +
          '<div class="count">' + (passed ? '不要' : (data.started ? count + ' 张牌' : (seat.occupied ? '已入座' : '等待'))) + '</div>' +
        '</div>';
    }

    function renderCards(cards, className) {
      return (cards || []).map((card) =>
        '<div class="' + className + '"><img src="' + card.image + '" alt="' + escapeHtml(card.label) + '"></div>'
      ).join('');
    }

    function renderHand(data) {
      const levelRank = data.context?.levelRank || '3';
      $('hand').innerHTML = (data.hand || []).map((card) => {
        const cls = [
          'card',
          state.selected.has(card.id) ? 'selected' : '',
          card.rank === levelRank ? 'level-card' : ''
        ].filter(Boolean).join(' ');
        return '<div class="' + cls + '" data-id="' + card.id + '"><img src="' + card.image + '" alt="' + escapeHtml(card.label) + '"></div>';
      }).join('');
      $('selectionLabel').textContent = state.selected.size ? '已选 ' + state.selected.size + ' 张' : '未选牌';
    }

    function render(data) {
      state.lastSnapshot = data;
      $('stage').className = 'stage ' + (data.started ? 'playing' : 'lobby');
      const level = data.context?.levelRank || '3';
      const room = data.code || '--';
      $('roomLabel').textContent = '房号 ' + room;
      $('roundLabel').textContent = '第 1 局';
      $('levelLabel').textContent = '打 ' + level;
      $('turnLabel').textContent = data.started ? (data.currentSeat === data.yourSeat ? '轮到我*' : '轮到 ' + data.currentSeat) : '等待开局';
      $('blueLabel').textContent = 'BLUE ' + level;
      $('redLabel').textContent = 'RED ' + level;
      $('joinBox').style.opacity = data.started ? '.18' : '1';

      seats.forEach((seat) => renderSeat(data, seat));
      seats.forEach((seat) => {
        $('zone' + seat).innerHTML = renderCards((data.tableCards || {})[seat], 'mini-card');
      });

      if (!data.started) {
        const joined = data.players.filter((seat) => seat.occupied).length;
        $('centerText').textContent = joined + '/4 人';
        $('centerTip').textContent = '房号发给另外 3 台手机，全部加入后开始';
      } else if (data.result) {
        $('centerText').textContent = '本局结束';
        $('centerTip').textContent = '胜方 ' + data.result.winnerTeam;
      } else if (data.lastPlay) {
        $('centerText').textContent = seatView(data, data.lastPlay.playerId).nickname + '：' + (data.lastPlay.analysis?.type || '出牌');
        $('centerTip').textContent = data.currentSeat === data.yourSeat ? '轮到你出牌' : '等待对方出牌';
      } else {
        $('centerText').textContent = data.currentSeat === data.yourSeat ? '你先出牌' : '等待 ' + data.currentSeat;
        $('centerTip').textContent = data.currentSeat === data.yourSeat ? '请选择手牌' : '对方思考中';
      }

      renderHand(data);
      $('play').disabled = !data.started || data.currentSeat !== data.yourSeat || state.selected.size === 0;
      $('pass').disabled = !data.started || data.currentSeat !== data.yourSeat;
      $('hint').disabled = !data.started || data.currentSeat !== data.yourSeat;
      $('log').innerHTML = (data.logs || []).slice(0, 1).map(escapeHtml).join('');
    }

    async function refresh() {
      if (!state.roomCode || !state.playerId) return;
      try {
        const data = await api('/api/rooms/' + state.roomCode + '/snapshot?playerId=' + encodeURIComponent(state.playerId));
        render(data);
      } catch (error) {
        if (error.message === 'ROOM_NOT_FOUND') {
          clearRoomMemory();
          toast('房间已失效，请重新创建或加入');
          return;
        }
        toast(error.message);
      }
    }

    $('create').onclick = async () => {
      try {
        await requestLandscape();
        const nickname = $('nickname').value.trim() || '玩家';
        const data = await api('/api/rooms', { nickname });
        remember(data);
        toast('房间已创建：' + data.code);
        await refresh();
      } catch (error) {
        toast(error.message);
      }
    };
    $('join').onclick = async () => {
      try {
        await requestLandscape();
        const nickname = $('nickname').value.trim() || '玩家';
        const code = $('roomCode').value.trim();
        const data = await api('/api/rooms/' + code + '/join', { nickname, playerId: state.playerId });
        remember(data);
        toast('已加入房间');
        await refresh();
      } catch (error) {
        if (error.message === 'ROOM_NOT_FOUND') {
          clearRoomMemory();
          toast('房间不存在，请确认房号');
          return;
        }
        toast(error.message);
      }
    };
    $('start').onclick = async () => {
      try {
        await requestLandscape();
        await api('/api/rooms/' + state.roomCode + '/start', { playerId: state.playerId });
        await refresh();
      } catch (error) {
        toast(error.message);
      }
    };
    $('play').onclick = async () => {
      try {
        await requestLandscape();
        await api('/api/rooms/' + state.roomCode + '/play', { playerId: state.playerId, cardIds: Array.from(state.selected) });
        state.selected.clear();
        await refresh();
      } catch (error) {
        toast(error.message);
      }
    };
    $('pass').onclick = async () => {
      try {
        await requestLandscape();
        await api('/api/rooms/' + state.roomCode + '/pass', { playerId: state.playerId });
        state.selected.clear();
        await refresh();
      } catch (error) {
        toast(error.message);
      }
    };
    $('hint').onclick = () => {
      const cards = state.lastSnapshot?.hand || [];
      if (!cards.length) return;
      state.selected.clear();
      state.selected.add(cards[0].id);
      renderHand(state.lastSnapshot);
    };
    $('hand').onclick = (event) => {
      const card = event.target.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      card.classList.toggle('selected');
      $('selectionLabel').textContent = state.selected.size ? '已选 ' + state.selected.size + ' 张' : '未选牌';
      if (state.lastSnapshot) {
        $('play').disabled = !state.lastSnapshot.started || state.lastSnapshot.currentSeat !== state.lastSnapshot.yourSeat || state.selected.size === 0;
      }
    };
    document.addEventListener('click', requestLandscape, { once: true });

    setInterval(refresh, 900);
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

function serveUiImage(url: URL, response: http.ServerResponse): boolean {
  if (!url.pathname.startsWith('/ui/')) return false;
  const filename = basename(decodeURIComponent(url.pathname.slice('/ui/'.length)));
  const candidates = [
    join('ShouBaYiCocos/assets/resources/ui', filename),
    join('ShouBaYiCocos/assets/resources', filename),
    join('ShouBaYiCocos/assets/Texture', filename)
  ];
  const file = candidates.find((item) => filename.endsWith('.png') && existsSync(item));
  if (!file) {
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
    if (serveUiImage(url, response)) return;

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
      const before = online.room.snapshotFor(player.seat);
      const playedCards = before.hand.filter((card) => cardIds.includes(card.id));
      const result = online.room.playCards(player.seat, cardIds);
      online.version += result.ok ? 1 : 0;
      if (result.ok) online.tableCards[player.seat] = playedCards;
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
