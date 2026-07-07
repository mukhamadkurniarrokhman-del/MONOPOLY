import { io } from 'socket.io-client';
import { EVENTS } from '@shared/constants.js';
import { useGameStore } from '../store/useGameStore.js';
import { useAnimStore } from '../store/useAnimStore.js';
import { sfx } from '../audio/audioManager.js';

// Default mengikuti host halaman (bukan hard-code localhost) supaya perangkat
// lain di LAN — mis. HP yang scan QR — tersambung ke server yang sama.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;

// Identitas persisten per-browser: dasar rejoin setelah reload/putus koneksi.
function getSessionId() {
  const KEY = 'antariksa_session';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(KEY, sid);
  }
  return sid;
}
export const sessionId = getSessionId();

export const socket = io(SERVER_URL, { autoConnect: true });

// --- inbound: server drives the store, UI just renders it ---
function handleResume(res) {
  if (!res?.room) return;
  const store = useGameStore.getState();
  store.setSelf(res.selfId);
  store.setRoom(res.room);
  store.setSavedRoom(null);
  if (res.game) {
    store.setGame(res.game);
    store.setScreen('game');
  } else {
    store.setScreen('lobby');
  }
}

socket.on('connect', () => {
  useGameStore.getState().setConnection('connected');
  // coba lanjutkan sesi yang terputus (reload halaman / jaringan putus)
  socket.emit(EVENTS.RESUME, { sessionId }, handleResume);
});
socket.on('disconnect', () => useGameStore.getState().setConnection('disconnected'));
socket.on('connect_error', () => useGameStore.getState().setConnection('error'));

socket.on(EVENTS.ROOM_UPDATE, (room) => useGameStore.getState().setRoom(room));
socket.on(EVENTS.GAME_STARTED, (room) => {
  useGameStore.getState().setRoom(room);
  useGameStore.getState().setScreen('game');
});
socket.on(EVENTS.GAME_STATE, (game) => useGameStore.getState().setGame(game));
socket.on(EVENTS.DICE_RESULT, ({ playerId, d1, d2 }) => {
  useAnimStore.getState().startDice({ playerId, d1, d2 });
  sfx.diceThrow();
});

// --- outbound helpers (ack-based so errors surface in the UI) ---
function emitWithAck(event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

export async function createRoom(name) {
  const res = await emitWithAck(EVENTS.CREATE_ROOM, { name, sessionId });
  if (res?.room) {
    useGameStore.getState().setSelf(res.selfId);
    useGameStore.getState().setRoom(res.room);
    useGameStore.getState().setScreen('lobby');
  }
  return res;
}

export async function joinRoom(code, name) {
  const res = await emitWithAck(EVENTS.JOIN_ROOM, { code, name, sessionId });
  if (res?.room) {
    useGameStore.getState().setSelf(res.selfId);
    useGameStore.getState().setRoom(res.room);
    useGameStore.getState().setScreen('lobby');
  }
  return res;
}

export function setReady(ready) {
  socket.emit(EVENTS.SET_READY, ready);
}

export function addBot() {
  return new Promise((resolve) => socket.emit(EVENTS.ADD_BOT, resolve));
}

export function setMap(mapId) {
  return emitWithAck(EVENTS.SET_MAP, { mapId });
}

export function removeBot(botId) {
  return emitWithAck(EVENTS.REMOVE_BOT, { botId });
}

export function startGame() {
  return new Promise((resolve) => socket.emit(EVENTS.START_GAME, resolve));
}

export function leaveRoom() {
  socket.emit(EVENTS.LEAVE_ROOM);
  const store = useGameStore.getState();
  store.reset();
  store.setSavedRoom(null);
}

// "Simpan & keluar": kursi ditahan server; kembali kapan pun via banner Lanjutkan.
export async function saveExit() {
  const res = await new Promise((resolve) => socket.emit(EVENTS.SAVE_EXIT, resolve));
  if (res?.ok) {
    const store = useGameStore.getState();
    store.reset();
    store.setSavedRoom(res.code);
  }
  return res;
}

export function resumeSaved() {
  socket.emit(EVENTS.RESUME, { sessionId }, handleResume);
}

export function rollDice() {
  return emitWithAck(EVENTS.ROLL_DICE, {});
}

export function gameAction(type, extra = {}) {
  return emitWithAck(EVENTS.GAME_ACTION, { type, ...extra });
}
