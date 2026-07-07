import { EVENTS, MIN_PLAYERS, MAX_PLAYERS, TOKENS } from '../../shared/constants.js';
import { MAPS, DEFAULT_MAP_ID } from '../../shared/mapConfigs.js';
import { Game } from './game.js';

const BOT_NAMES = ['AI Nova', 'AI Orion', 'AI Vega'];

// Jeda "berpikir" bot per fase — memberi ruang animasi dadu/lompatan di klien.
// awaiting_card lebih lama agar penonton sempat membaca kartunya.
const BOT_DELAYS = { awaiting_roll: 3200, awaiting_buy: 4200, awaiting_card: 5200, post_roll: 1400 };

// Masa tenggang sebelum pemain terputus dianggap benar-benar keluar.
const GRACE_LOBBY_MS = 60_000;
const GRACE_GAME_MS = 180_000;
// "Simpan & keluar": kursi ditahan jauh lebih lama (selaras TTL Redis 24 jam).
const GRACE_SAVED_MS = 12 * 60 * 60 * 1000;

// Pemain diidentifikasi dengan sessionId persisten (localStorage klien),
// bukan socket.id — socket hanyalah transport yang boleh putus-nyambung.
export class RoomManager {
  constructor(io, persistence) {
    this.io = io;
    this.persistence = persistence;
    this.rooms = new Map(); // code -> room
    this.sessions = new Map(); // sessionId -> roomCode
    this.socketSession = new Map(); // socket.id -> sessionId
  }

  // Muat kembali room dari Redis saat server baru menyala.
  async restore() {
    const saved = await this.persistence.loadRooms();
    for (const data of saved) {
      const room = {
        code: data.code,
        hostId: data.hostId,
        phase: data.phase,
        mapId: data.mapId ?? DEFAULT_MAP_ID,
        players: data.players,
        game: data.game ? Game.rehydrate(data.game) : null,
        leaveTimers: new Map(),
        botTimer: null,
      };
      this.rooms.set(room.code, room);
      for (const p of room.players) {
        if (p.isBot) continue;
        this.sessions.set(p.id, room.code);
        // manusia dianggap terputus sampai klien mereka resume
        this.setDisconnected(room, p.id, true);
        this.scheduleLeave(room, p.id);
      }
      this.driveBots(room);
      this.manageAuction(room);
      this.manageTrade(room);
      console.log(`[room ${room.code}] dipulihkan dari Redis (${room.players.length} pemain, fase ${room.phase})`);
    }
    if (saved.length) console.log(`🗄️  ${saved.length} room dipulihkan`);
  }

  sid(socket) {
    return this.socketSession.get(socket.id);
  }

  attach(socket, sessionId) {
    this.socketSession.set(socket.id, sessionId);
  }

  validSession(sessionId) {
    return typeof sessionId === 'string' && sessionId.length >= 8 && sessionId.length <= 64;
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
    let code;
    do {
      code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  publicRoom(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      mapId: room.mapId ?? DEFAULT_MAP_ID,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        token: p.token,
        ready: p.ready,
        isHost: p.id === room.hostId,
        isBot: p.isBot ?? false,
        disconnected: p.disconnected ?? false,
      })),
    };
  }

  broadcast(room) {
    this.io.to(room.code).emit(EVENTS.ROOM_UPDATE, this.publicRoom(room));
    this.persistence.saveRoom(room);
  }

  broadcastGame(room) {
    if (!room.game) return;
    this.io.to(room.code).emit(EVENTS.GAME_STATE, room.game.publicState());
    this.persistence.saveRoom(room);
    this.driveBots(room);
    this.manageAuction(room);
    this.manageTrade(room);
  }

  // ---------- pertukaran ----------

  // Timer kedaluwarsa + bot menolak sopan setelah jeda singkat.
  manageTrade(room) {
    clearTimeout(room.tradeTimer);
    clearTimeout(room.tradeBotTimer);
    const game = room.game;
    if (!game?.trade) return;

    room.tradeTimer = setTimeout(() => {
      if (room.game !== game || !game.trade) return;
      game.expireTrade();
      this.broadcastGame(room);
    }, Math.max(0, game.trade.endsAt - Date.now()) + 60);

    const target = game.players.find((p) => p.id === game.trade.to);
    if (target?.isBot) {
      room.tradeBotTimer = setTimeout(() => {
        if (room.game !== game || !game.trade) return;
        game.respondTrade(target.id, false); // bot selalu menolak (sederhana dulu)
        this.broadcastGame(room);
      }, 2000);
    }
  }

  // ---------- lelang ----------

  // Menjaga timer penyelesaian lelang + menjadwalkan tawaran bot.
  manageAuction(room) {
    clearTimeout(room.auctionTimer);
    clearTimeout(room.auctionBotTimer);
    const game = room.game;
    if (!game?.auction) return;

    const delay = Math.max(0, game.auction.endsAt - Date.now());
    room.auctionTimer = setTimeout(() => {
      if (room.game !== game || !game.auction) return;
      game.settleAuction();
      this.broadcastGame(room);
    }, delay + 60);

    const bidder = this.pickBotBidder(game);
    if (bidder) {
      room.auctionBotTimer = setTimeout(() => {
        if (room.game !== game || !game.auction) return;
        const a = game.auction;
        const bid = a.highBid > 0 ? a.highBid + a.minIncrement : a.minIncrement;
        const res = game.placeBid(bidder.id, bid);
        if (res.ok) this.broadcastGame(room);
      }, 800 + Math.random() * 900);
    }
  }

  // Bot menawar sampai ~90% harga pasar, dengan cadangan saldo Rp 2jt.
  pickBotBidder(game) {
    const a = game.auction;
    const tile = game.map.board[a.tileIndex];
    const nextBid = a.highBid > 0 ? a.highBid + a.minIncrement : a.minIncrement;
    return game.players.find(
      (p) =>
        p.isBot &&
        !p.bankrupt &&
        p.id !== a.highBidder &&
        nextBid <= tile.price * 0.9 &&
        p.balance - nextBid >= 2_000_000
    );
  }

  setDisconnected(room, sessionId, value) {
    const p = room.players.find((pl) => pl.id === sessionId);
    if (p) p.disconnected = value;
    const gp = room.game?.players.find((pl) => pl.id === sessionId);
    if (gp) gp.disconnected = value;
  }

  // ---------- lobby ----------

  createRoom(socket, { name, sessionId } = {}, ack) {
    if (!this.validSession(sessionId)) return ack?.({ error: 'Sesi tidak valid.' });
    if (this.sessions.has(sessionId)) return ack?.({ error: 'Kamu sudah berada di dalam room.' });
    const playerName = String(name || '').trim().slice(0, 20);
    if (!playerName) return ack?.({ error: 'Nama pemain wajib diisi.' });

    const code = this.generateCode();
    const room = {
      code,
      hostId: sessionId,
      phase: 'lobby',
      mapId: DEFAULT_MAP_ID,
      players: [{ id: sessionId, name: playerName, token: TOKENS[0], ready: false, disconnected: false }],
      game: null,
      leaveTimers: new Map(),
      botTimer: null,
    };
    this.rooms.set(code, room);
    this.sessions.set(sessionId, code);
    this.attach(socket, sessionId);
    socket.join(code);

    console.log(`[room ${code}] created by ${playerName}`);
    ack?.({ room: this.publicRoom(room), selfId: sessionId });
    this.broadcast(room);
  }

  joinRoom(socket, { code, name, sessionId } = {}, ack) {
    if (!this.validSession(sessionId)) return ack?.({ error: 'Sesi tidak valid.' });
    const targetCode = String(code || '').trim().toUpperCase();
    // sesi ini sudah tercatat di room yang sama? berarti rejoin → resume
    if (this.sessions.get(sessionId) === targetCode) {
      return this.resume(socket, { sessionId }, ack);
    }
    if (this.sessions.has(sessionId)) return ack?.({ error: 'Kamu sudah berada di dalam room.' });
    const playerName = String(name || '').trim().slice(0, 20);
    if (!playerName) return ack?.({ error: 'Nama pemain wajib diisi.' });

    const room = this.rooms.get(targetCode);
    if (!room) return ack?.({ error: 'Room tidak ditemukan.' });
    if (room.phase !== 'lobby') return ack?.({ error: 'Permainan sudah dimulai.' });
    if (room.players.length >= MAX_PLAYERS) return ack?.({ error: `Room penuh (maks. ${MAX_PLAYERS} pemain).` });

    const usedTokens = new Set(room.players.map((p) => p.token));
    const token = TOKENS.find((t) => !usedTokens.has(t));
    room.players.push({ id: sessionId, name: playerName, token, ready: false, disconnected: false });
    this.sessions.set(sessionId, room.code);
    this.attach(socket, sessionId);
    socket.join(room.code);

    console.log(`[room ${room.code}] ${playerName} joined (${room.players.length}/${MAX_PLAYERS})`);
    ack?.({ room: this.publicRoom(room), selfId: sessionId });
    this.broadcast(room);
  }

  // Sambung ulang: kembalikan pemain ke room & state persis sebelum terputus.
  resume(socket, { sessionId } = {}, ack) {
    if (!this.validSession(sessionId)) return ack?.({});
    const code = this.sessions.get(sessionId);
    const room = code ? this.rooms.get(code) : null;
    const player = room?.players.find((p) => p.id === sessionId);
    if (!room || !player) {
      this.sessions.delete(sessionId);
      return ack?.({}); // tidak ada yang bisa dilanjutkan
    }

    clearTimeout(room.leaveTimers.get(sessionId));
    room.leaveTimers.delete(sessionId);
    this.setDisconnected(room, sessionId, false);
    this.attach(socket, sessionId);
    socket.join(room.code);

    console.log(`[room ${room.code}] ${player.name} tersambung kembali`);
    ack?.({
      room: this.publicRoom(room),
      selfId: sessionId,
      game: room.game ? room.game.publicState() : null,
    });
    this.broadcast(room);
    if (room.game) this.broadcastGame(room);
  }

  // Host memilih peta — hanya di lobby, tersinkron ke semua pemain.
  setMap(socket, { mapId } = {}, ack) {
    const room = this.roomOf(socket);
    if (!room) return ack?.({ error: 'Room tidak ditemukan.' });
    if (room.hostId !== this.sid(socket)) return ack?.({ error: 'Hanya host yang bisa memilih peta.' });
    if (room.phase !== 'lobby') return ack?.({ error: 'Permainan sudah dimulai.' });
    if (!MAPS[mapId]) return ack?.({ error: 'Peta tidak dikenal.' });

    room.mapId = mapId;
    console.log(`[room ${room.code}] peta dipilih: ${MAPS[mapId].name}`);
    ack?.({ ok: true });
    this.broadcast(room);
  }

  addBot(socket, ack) {
    const room = this.roomOf(socket);
    const sessionId = this.sid(socket);
    if (!room) return ack?.({ error: 'Room tidak ditemukan.' });
    if (room.hostId !== sessionId) return ack?.({ error: 'Hanya host yang bisa menambah bot.' });
    if (room.phase !== 'lobby') return ack?.({ error: 'Permainan sudah dimulai.' });
    if (room.players.length >= MAX_PLAYERS) return ack?.({ error: `Room penuh (maks. ${MAX_PLAYERS} pemain).` });

    const usedTokens = new Set(room.players.map((p) => p.token));
    const usedNames = new Set(room.players.map((p) => p.name));
    room.players.push({
      id: `bot-${Math.random().toString(36).slice(2, 10)}`,
      name: BOT_NAMES.find((n) => !usedNames.has(n)) ?? `AI-${Date.now() % 1000}`,
      token: TOKENS.find((t) => !usedTokens.has(t)),
      ready: true,
      isBot: true,
      disconnected: false,
    });
    console.log(`[room ${room.code}] bot ditambahkan (${room.players.length}/${MAX_PLAYERS})`);
    ack?.({ ok: true });
    this.broadcast(room);
  }

  removeBot(socket, { botId } = {}, ack) {
    const room = this.roomOf(socket);
    if (!room) return ack?.({ error: 'Room tidak ditemukan.' });
    if (room.hostId !== this.sid(socket)) return ack?.({ error: 'Hanya host yang bisa menghapus bot.' });
    if (room.phase !== 'lobby') return ack?.({ error: 'Permainan sudah dimulai.' });
    const before = room.players.length;
    room.players = room.players.filter((p) => !(p.isBot && p.id === botId));
    if (room.players.length === before) return ack?.({ error: 'Bot tidak ditemukan.' });
    ack?.({ ok: true });
    this.broadcast(room);
  }

  setReady(socket, ready) {
    const room = this.roomOf(socket);
    if (!room || room.phase !== 'lobby') return;
    const player = room.players.find((p) => p.id === this.sid(socket));
    if (player) {
      player.ready = Boolean(ready);
      this.broadcast(room);
    }
  }

  startGame(socket, ack) {
    const room = this.roomOf(socket);
    const sessionId = this.sid(socket);
    if (!room) return ack?.({ error: 'Room tidak ditemukan.' });
    if (room.hostId !== sessionId) return ack?.({ error: 'Hanya host yang bisa memulai permainan.' });
    if (room.phase !== 'lobby') return ack?.({ error: 'Permainan sudah berjalan.' });
    if (room.players.length < MIN_PLAYERS) return ack?.({ error: `Butuh minimal ${MIN_PLAYERS} pemain.` });
    if (!room.players.every((p) => p.ready || p.id === room.hostId)) {
      return ack?.({ error: 'Semua pemain harus siap terlebih dahulu.' });
    }

    room.phase = 'playing';
    room.game = new Game(room.players, room.mapId);
    console.log(`[room ${room.code}] game started with ${room.players.length} players`);
    this.io.to(room.code).emit(EVENTS.GAME_STARTED, this.publicRoom(room));
    ack?.({ ok: true });
    this.broadcast(room);
    this.broadcastGame(room);
  }

  // ---------- gameplay ----------

  rollDice(socket, payload, ack) {
    const room = this.roomOf(socket);
    if (!room?.game) return ack?.({ error: 'Permainan belum dimulai.' });
    const res = room.game.rollDice(this.sid(socket), payload?.debugDice);
    if (res.ok) {
      this.io.to(room.code).emit(EVENTS.DICE_RESULT, { playerId: this.sid(socket), ...res.dice });
      this.broadcastGame(room);
    }
    ack?.(res);
  }

  gameAction(socket, payload = {}, ack) {
    const { type, tileIndex, amount } = payload;
    const room = this.roomOf(socket);
    if (!room?.game) return ack?.({ error: 'Permainan belum dimulai.' });
    const game = room.game;
    const sessionId = this.sid(socket);
    const actions = {
      buy: () => game.buy(sessionId),
      skip: () => game.skipBuy(sessionId),
      endTurn: () => game.endTurn(sessionId),
      payBail: () => game.payBail(sessionId),
      useJailCard: () => game.useJailCard(sessionId),
      build: () => game.build(sessionId, Number(tileIndex)),
      mortgage: () => game.mortgage(sessionId, Number(tileIndex)),
      unmortgage: () => game.unmortgage(sessionId, Number(tileIndex)),
      bid: () => game.placeBid(sessionId, Number(amount)),
      ackCard: () => game.ackCard(sessionId),
      proposeTrade: () => game.proposeTrade(sessionId, payload),
      respondTrade: () => game.respondTrade(sessionId, Boolean(payload.accept)),
      cancelTrade: () => game.cancelTrade(sessionId),
    };
    const handler = actions[type];
    if (!handler) return ack?.({ error: 'Aksi tidak dikenal.' });
    const res = handler();
    if (res.ok) this.broadcastGame(room);
    ack?.(res);
  }

  // ---------- AI bot ----------

  driveBots(room) {
    clearTimeout(room.botTimer);
    const game = room.game;
    if (!game || game.winner) return;
    const bot = game.current;
    if (!bot?.isBot) return;

    const phase = game.phase;
    if (!(phase in BOT_DELAYS)) return; // mis. fase lelang — ditangani manageAuction
    room.botTimer = setTimeout(() => {
      if (room.game !== game || game.winner) return;
      if (game.current !== bot || game.phase !== phase) return this.driveBots(room);
      this.botAct(room, game, bot);
    }, BOT_DELAYS[phase]);
  }

  botAct(room, game, bot) {
    if (game.phase === 'awaiting_roll') {
      if (bot.inJail) {
        if (bot.jailCards > 0) game.useJailCard(bot.id);
        else if (bot.balance >= game.map.bail * 4) game.payBail(bot.id);
      }
      const res = game.rollDice(bot.id);
      if (res.ok) this.io.to(room.code).emit(EVENTS.DICE_RESULT, { playerId: bot.id, ...res.dice });
    } else if (game.phase === 'awaiting_buy') {
      const tile = game.map.board[bot.position];
      if (bot.balance >= tile.price) game.buy(bot.id);
      else game.skipBuy(bot.id);
    } else if (game.phase === 'awaiting_card') {
      game.ackCard(bot.id); // bot langsung menjalankan kartunya
    } else if (game.phase === 'post_roll') {
      game.endTurn(bot.id);
    }
    this.broadcastGame(room);
  }

  // ---------- keluar / terputus ----------

  // Putus koneksi ≠ keluar: tandai & beri masa tenggang untuk resume.
  onDisconnect(socket) {
    const sessionId = this.sid(socket);
    this.socketSession.delete(socket.id);
    if (!sessionId) return;
    const room = this.rooms.get(this.sessions.get(sessionId));
    if (!room) return;
    const player = room.players.find((p) => p.id === sessionId);
    if (!player) return;

    this.setDisconnected(room, sessionId, true);
    this.scheduleLeave(room, sessionId);
    console.log(`[room ${room.code}] ${player.name} terputus — masa tenggang berjalan`);
    this.broadcast(room);
  }

  scheduleLeave(room, sessionId) {
    clearTimeout(room.leaveTimers.get(sessionId));
    const grace = room.phase === 'playing' ? GRACE_GAME_MS : GRACE_LOBBY_MS;
    room.leaveTimers.set(
      sessionId,
      setTimeout(() => this.finalLeave(room, sessionId), grace)
    );
  }

  // "Simpan & keluar": pemain pergi tapi kursinya ditahan sampai 12 jam —
  // bisa kembali kapan pun via resume (sessionId sama).
  saveExit(socket, ack) {
    const sessionId = this.sid(socket);
    const room = this.rooms.get(this.sessions.get(sessionId));
    const player = room?.players.find((p) => p.id === sessionId);
    if (!room || !player) return ack?.({ error: 'Room tidak ditemukan.' });

    this.setDisconnected(room, sessionId, true);
    clearTimeout(room.leaveTimers.get(sessionId));
    room.leaveTimers.set(
      sessionId,
      setTimeout(() => this.finalLeave(room, sessionId), GRACE_SAVED_MS)
    );
    socket.leave(room.code);
    console.log(`[room ${room.code}] ${player.name} simpan & keluar (kursi ditahan 12 jam)`);
    ack?.({ ok: true, code: room.code });
    this.broadcast(room);
    if (room.game) this.broadcastGame(room);
  }

  // Keluar eksplisit (tombol "Keluar") — tanpa masa tenggang.
  leaveRoom(socket) {
    const sessionId = this.sid(socket);
    const room = this.rooms.get(this.sessions.get(sessionId));
    if (!room) return;
    socket.leave(room.code);
    this.finalLeave(room, sessionId);
  }

  finalLeave(room, sessionId) {
    clearTimeout(room.leaveTimers.get(sessionId));
    room.leaveTimers.delete(sessionId);
    if (!this.rooms.has(room.code)) return;
    const player = room.players.find((p) => p.id === sessionId);
    if (!player) return;

    this.sessions.delete(sessionId);
    room.players = room.players.filter((p) => p.id !== sessionId);
    console.log(`[room ${room.code}] ${player.name} keluar permanen`);

    if (room.game && room.phase === 'playing') {
      room.game.removePlayer(sessionId);
      this.broadcastGame(room);
    }

    const humans = room.players.filter((p) => !p.isBot);
    if (humans.length === 0) {
      this.destroyRoom(room);
      return;
    }
    if (room.hostId === sessionId) {
      room.hostId = humans[0].id; // migrasi host — selalu ke manusia
    }
    this.broadcast(room);
  }

  destroyRoom(room) {
    clearTimeout(room.botTimer);
    clearTimeout(room.auctionTimer);
    clearTimeout(room.auctionBotTimer);
    clearTimeout(room.tradeTimer);
    clearTimeout(room.tradeBotTimer);
    for (const t of room.leaveTimers.values()) clearTimeout(t);
    this.rooms.delete(room.code);
    this.persistence.deleteRoom(room.code);
    console.log(`[room ${room.code}] tanpa pemain manusia, dihapus`);
  }

  roomOf(socket) {
    const code = this.sessions.get(this.sid(socket));
    return code ? this.rooms.get(code) : undefined;
  }
}
