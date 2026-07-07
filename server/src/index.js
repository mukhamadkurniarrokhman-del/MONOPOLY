import http from 'node:http';
import os from 'node:os';
import express from 'express';
import { Server } from 'socket.io';
import { EVENTS } from '../../shared/constants.js';
import { RoomManager } from './roomManager.js';
import { createPersistence } from './persistence.js';

const PORT = process.env.PORT || 3001;
// Default: pantulkan origin peminta (dev di LAN). Set CLIENT_ORIGIN di produksi.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || true;

const app = express();
// endpoint info bersifat publik-LAN — izinkan diambil dari origin mana pun
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  console.log(`[http] ${req.method} ${req.url} dari ${req.socket.remoteAddress}`);
  next();
});
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// IP LAN mesin ini — dipakai klien untuk membuat QR/tautan undangan yang
// bisa dibuka perangkat lain, walau host membuka game lewat localhost.
app.get('/lan-info', (_req, res) => {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.')) ips.push(i.address);
    }
  }
  // prioritas: hotspot Windows (192.168.137.x — klien PASTI bisa capai host)
  // > LAN biasa > VPN CGNAT (Tailscale 100.x)
  const rank = (ip) => (ip.startsWith('192.168.137.') ? 0 : ip.startsWith('100.') ? 2 : 1);
  ips.sort((a, b) => rank(a) - rank(b));
  res.json({ ips });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

const persistence = await createPersistence();
const rooms = new RoomManager(io, persistence);
await rooms.restore();

io.on('connection', (socket) => {
  console.log(`[+] connected: ${socket.id} dari ${socket.handshake.address}`);

  socket.on(EVENTS.CREATE_ROOM, (payload, ack) => rooms.createRoom(socket, payload, ack));
  socket.on(EVENTS.JOIN_ROOM, (payload, ack) => rooms.joinRoom(socket, payload, ack));
  socket.on(EVENTS.RESUME, (payload, ack) => rooms.resume(socket, payload, ack));
  socket.on(EVENTS.LEAVE_ROOM, () => rooms.leaveRoom(socket));
  socket.on(EVENTS.SAVE_EXIT, (ack) => rooms.saveExit(socket, ack));
  socket.on(EVENTS.SET_READY, (ready) => rooms.setReady(socket, ready));
  socket.on(EVENTS.SET_MAP, (payload, ack) => rooms.setMap(socket, payload, ack));
  socket.on(EVENTS.ADD_BOT, (ack) => rooms.addBot(socket, ack));
  socket.on(EVENTS.REMOVE_BOT, (payload, ack) => rooms.removeBot(socket, payload, ack));
  socket.on(EVENTS.START_GAME, (ack) => rooms.startGame(socket, ack));
  socket.on(EVENTS.ROLL_DICE, (payload, ack) => rooms.rollDice(socket, payload, ack));
  socket.on(EVENTS.GAME_ACTION, (payload, ack) => rooms.gameAction(socket, payload, ack));

  socket.on('disconnect', (reason) => {
    console.log(`[-] disconnected: ${socket.id} (${reason})`);
    rooms.onDisconnect(socket); // masa tenggang, bukan langsung keluar
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Monopoli Antariksa server listening on http://localhost:${PORT}`);
});
