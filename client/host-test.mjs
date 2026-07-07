// Host uji: buat room lalu tetap terhubung (untuk menguji alur undangan QR).
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');
const sessionId = `testhost-${Math.random().toString(36).slice(2, 12)}`;
socket.on('connect', () => {
  socket.emit('room:create', { name: process.argv[2] ?? 'Host Uji', sessionId }, (res) => {
    if (res?.error) { console.error('GAGAL:', res.error); process.exit(1); }
    console.log('ROOM:', res.room.code);
  });
});
socket.on('room:update', (room) => {
  console.log('UPDATE:', room.players.map((p) => p.name).join(', '));
});
setTimeout(() => process.exit(0), 180_000);
