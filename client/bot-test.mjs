// Bot uji: gabung room lalu mainkan gilirannya secara otomatis.
import { io } from 'socket.io-client';

const [code, name] = process.argv.slice(2);
const socket = io('http://localhost:3001');
const sessionId = `testbot-${Math.random().toString(36).slice(2, 12)}`;
let myId = null;
let acting = false;
let lastState = null;

socket.on('connect', () => {
  socket.emit('room:join', { code, name, sessionId }, (res) => {
    if (res?.error) { console.error('JOIN FAILED:', res.error); process.exit(1); }
    myId = res.selfId;
    console.log('JOINED', res.room.code);
    socket.emit('room:setReady', true);
  });
});

function maybeAct() {
  const game = lastState;
  if (!game || acting || game.winner) return;
  const me = game.players.find((p) => p.id === myId);
  if (!me || me.bankrupt || game.currentPlayerId !== myId) return;

  acting = true;
  setTimeout(() => {
    const done = (label) => (res) => {
      console.log(`${label}:`, res?.error ?? 'ok');
      acting = false;
      maybeAct(); // evaluasi ulang state terbaru setelah aksi selesai
    };
    if (lastState.phase === 'awaiting_roll') socket.emit('game:rollDice', {}, done('roll'));
    else if (lastState.phase === 'awaiting_buy') socket.emit('game:action', { type: 'buy' }, done('buy'));
    else if (lastState.phase === 'post_roll') socket.emit('game:action', { type: 'endTurn' }, done('endTurn'));
    else acting = false;
  }, 700);
}

function snapshot() {
  if (!lastState) return 'belum ada state';
  return lastState.players
    .map((p) => `${p.name}:pos=${p.position}:saldo=${p.balance}${p.bankrupt ? ':BANGKRUT' : ''}`)
    .join(' | ');
}

socket.on('game:state', (game) => {
  lastState = game;
  if (game.winner) {
    console.log('WINNER:', game.players.find((p) => p.id === game.winner)?.name);
    console.log('SNAPSHOT:', snapshot());
    setTimeout(() => process.exit(0), 1000);
    return;
  }
  maybeAct();
});

// cetak snapshot berkala agar sinkronisasi antar-klien bisa dibandingkan
setInterval(() => console.log('SNAPSHOT:', snapshot()), 15_000);

setTimeout(() => { console.log('bot selesai (timeout)'); process.exit(0); }, 600_000);
