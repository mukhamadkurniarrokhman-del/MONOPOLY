// Uji: gabung TANPA menekan SIAP — status ready harus otomatis true.
import { io } from 'socket.io-client';

const [code] = process.argv.slice(2);
const socket = io('http://localhost:3001');
const sessionId = `testjoin-${Math.random().toString(36).slice(2, 12)}`;

socket.on('connect', () => {
  socket.emit('room:join', { code, name: 'Tamu Undangan', sessionId }, (res) => {
    if (res?.error) { console.error('JOIN FAILED:', res.error); process.exit(1); }
    const me = res.room.players.find((p) => p.id === res.selfId);
    console.log('JOINED — ready saya langsung:', me.ready);
  });
});
socket.on('room:update', (room) =>
  console.log('UPDATE:', room.players.map((p) => `${p.name}(${p.ready ? 'SIAP' : 'menunggu'})`).join(' | ')));
socket.on('game:started', () => console.log('GAME DIMULAI — tanpa saya menekan apa pun!'));
setTimeout(() => process.exit(0), 60_000);
