// Pemain uji: gabung room, lalu usulkan pertukaran ke pemain manusia pertama.
import { io } from 'socket.io-client';

const [code] = process.argv.slice(2);
const socket = io('http://localhost:3001');
const sessionId = `testtrader-${Math.random().toString(36).slice(2, 12)}`;
let myId = null;
let proposed = false;

socket.on('connect', () => {
  socket.emit('room:join', { code, name: 'Saudagar Zed', sessionId }, (res) => {
    if (res?.error) { console.error('JOIN FAILED:', res.error); process.exit(1); }
    myId = res.selfId;
    console.log('JOINED', res.room.code);
    socket.emit('room:setReady', true);
  });
});

socket.on('game:state', (game) => {
  if (!proposed && !game.winner) {
    proposed = true;
    const target = game.players.find((p) => p.id !== myId && !p.isBot);
    setTimeout(() => {
      socket.emit(
        'game:action',
        { type: 'proposeTrade', to: target.id, offerMoney: 2_000_000, requestMoney: 1_000_000 },
        (res) => console.log('PROPOSE:', res?.error ?? 'ok')
      );
    }, 2500);
  }
  if (proposed && !game.trade) {
    const me = game.players.find((p) => p.id === myId);
    console.log('SALDO SAYA:', me?.balance);
  }
});

setTimeout(() => process.exit(0), 120_000);
