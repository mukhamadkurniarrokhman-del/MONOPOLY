// Pengamat: gabung room, cetak mapId dari tiap room:update, dan uji
// bahwa non-host DITOLAK mengganti peta.
import { io } from 'socket.io-client';

const [code] = process.argv.slice(2);
const socket = io('http://localhost:3001');
const sessionId = `testwatch-${Math.random().toString(36).slice(2, 12)}`;

socket.on('connect', () => {
  socket.emit('room:join', { code, name: 'Pengamat Peta', sessionId }, (res) => {
    if (res?.error) { console.error('JOIN FAILED:', res.error); process.exit(1); }
    console.log('JOINED, mapId awal:', res.room.mapId);
    socket.emit('room:setMap', { mapId: 'alien' }, (r) =>
      console.log('NON-HOST setMap:', r?.error ?? 'LOLOS (BUG!)'));
    socket.emit('room:setMap', { mapId: 'petaPalsu' }, (r) =>
      console.log('MAP TAK DIKENAL:', r?.error ?? 'LOLOS (BUG!)'));
  });
});

socket.on('room:update', (room) => console.log('UPDATE mapId:', room.mapId));
setTimeout(() => process.exit(0), 60_000);
