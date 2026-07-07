import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../store/useGameStore.js';
import { setReady, startGame, leaveRoom, addBot, removeBot, setMap, SERVER_URL } from '../network/socket.js';
import { MIN_PLAYERS, MAX_PLAYERS, formatRupiah } from '@shared/constants.js';
import { MAP_LIST, DEFAULT_MAP_ID, getMap, getTokenDisplay } from '@shared/mapConfigs.js';

// Pemilih peta: host mengklik untuk mengubah; pemain lain melihat pilihan live.
function MapSelector({ room, isHost, onError }) {
  const activeId = room.mapId ?? DEFAULT_MAP_ID;
  const active = MAP_LIST.find((m) => m.id === activeId) ?? MAP_LIST[0];

  async function pick(id) {
    if (!isHost || id === activeId) return;
    const res = await setMap(id);
    if (res?.error) onError(res.error);
  }

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[10px] font-bold tracking-[0.3em] text-slate-500">🗺️ PETA GALAKSI</p>
      <div className="grid grid-cols-2 gap-2">
        {MAP_LIST.map((m) => {
          const selected = m.id === activeId;
          return (
            <button
              key={m.id}
              data-testid={`map-${m.id}`}
              onClick={() => pick(m.id)}
              disabled={!isHost}
              style={{ borderColor: selected ? m.accent : 'rgba(255,255,255,0.1)' }}
              className={`flex-1 rounded-xl border p-3 text-left transition ${
                selected ? 'bg-white/5 shadow-[0_0_18px_rgba(34,211,238,0.12)]' : 'opacity-60'
              } ${isHost ? 'hover:opacity-100' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{m.emoji}</span>
                <span className="font-bold" style={{ color: selected ? m.accent : undefined }}>{m.name}</span>
                {selected && <span className="ml-auto text-xs" style={{ color: m.accent }}>✓</span>}
              </div>
              <div className="mt-1 flex gap-1.5 text-[10px] text-slate-500">
                <span className="rounded bg-white/5 px-1.5 py-0.5">{m.size} petak</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5">gaji {formatRupiah(m.salary).replace('Rp ', 'Rp')}</span>
              </div>
            </button>
          );
        })}
      </div>
      <p data-testid="map-desc" className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
        {active.description}
        {!isHost && <span className="text-slate-600"> · Hanya host yang bisa mengganti peta.</span>}
      </p>
    </div>
  );
}

const TOKEN_ICONS = { rocket: '🚀', astronaut: '🧑‍🚀', satellite: '🛰️', ufo: '🛸' };

export default function Lobby() {
  const room = useGameStore((s) => s.room);
  const selfId = useGameStore((s) => s.selfId);
  const [error, setError] = useState('');
  const [lanBase, setLanBase] = useState(null);

  // Jika host membuka via localhost, tanyakan IP LAN ke server agar QR/tautan
  // undangan bisa dibuka HP lain (localhost tak berarti bagi perangkat lain).
  useEffect(() => {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    fetch(`${SERVER_URL}/lan-info`)
      .then((r) => r.json())
      .then((d) => {
        const ip = d.ips?.[0];
        if (ip) setLanBase(`http://${ip}:${window.location.port || 80}`);
      })
      .catch(() => {});
  }, []);

  const inviteBase = lanBase ?? window.location.origin;

  if (!room) return null;
  const self = room.players.find((p) => p.id === selfId);
  const isHost = room.hostId === selfId;
  const canStart =
    room.players.length >= MIN_PLAYERS &&
    room.players.every((p) => p.ready || p.id === room.hostId);

  async function handleStart() {
    setError('');
    const res = await startGame();
    if (res?.error) setError(res.error);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-space-900/70 p-8 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-200">Ruang Tunggu</h2>
        <div data-testid="room-code" className="rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-1.5 font-mono text-lg tracking-[0.3em] text-neon-cyan">
          {room.code}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Bagikan kode di atas — {room.players.length}/{MAX_PLAYERS} pemain
      </p>

      <MapSelector room={room} isHost={isHost} onError={setError} />

      {/* Undangan QR: scan dari HP untuk langsung gabung */}
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-space-800/50 p-3">
        <div data-testid="qr-invite" className="shrink-0 rounded-lg bg-white p-2">
          <QRCodeSVG value={`${inviteBase}/?room=${room.code}`} size={96} level="M" />
        </div>
        <div className="min-w-0 text-xs text-slate-400">
          <p className="font-semibold text-slate-300">📱 Scan untuk gabung</p>
          <p className="mt-1">Arahkan kamera HP ke kode QR — HP harus di WiFi/hotspot yang sama.</p>
          <p data-testid="invite-url" className="mt-1 truncate font-mono text-[10px] text-neon-cyan/70">
            {`${inviteBase}/?room=${room.code}`}
          </p>
        </div>
      </div>

      <ul data-testid="player-list" className="mt-6 space-y-2">
        {room.players.map((p) => (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
              p.id === selfId ? 'border-neon-cyan/40 bg-neon-cyan/5' : 'border-white/10 bg-space-800/60'
            }`}
          >
            <span className="text-2xl">{p.isBot ? '🤖' : getTokenDisplay(getMap(room.mapId), p.token).icon}</span>
            <div className="flex-1">
              <span className="font-semibold">{p.name}</span>
              <span className="ml-2 text-xs text-slate-500">{getTokenDisplay(getMap(room.mapId), p.token).label}</span>
              {p.isBot && <span className="ml-2 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-purple-300">BOT AI</span>}
              {p.disconnected && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">⚡ TERPUTUS</span>}
            </div>
            {p.isBot ? (
              isHost && (
                <button
                  data-testid={`btn-remove-bot-${p.id}`}
                  onClick={() => removeBot(p.id)}
                  className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-400/10"
                >
                  Hapus
                </button>
              )
            ) : p.isHost ? (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">HOST</span>
            ) : p.ready ? (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">SIAP</span>
            ) : (
              <span className="rounded-full bg-slate-500/15 px-3 py-1 text-xs text-slate-400">menunggu…</span>
            )}
          </motion.li>
        ))}
      </ul>

      {isHost && room.players.length < MAX_PLAYERS && (
        <button
          data-testid="btn-add-bot"
          onClick={async () => {
            const res = await addBot();
            if (res?.error) setError(res.error);
          }}
          className="mt-3 w-full rounded-xl border border-dashed border-purple-400/40 py-2.5 text-sm text-purple-300 transition hover:bg-purple-400/10"
        >
          🤖 + Tambah Bot AI ({room.players.length}/{MAX_PLAYERS})
        </button>
      )}
      {isHost && (
        <p className="mt-2 text-center text-[11px] text-slate-600">
          Main bareng teman (bagikan kode), isi slot kosong dengan Bot AI, atau lawan bot saja.
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button
          onClick={leaveRoom}
          className="rounded-lg border border-white/10 px-4 py-3 text-sm text-slate-400 transition hover:bg-white/5"
        >
          Keluar
        </button>
        {isHost ? (
          <button
            data-testid="btn-start"
            disabled={!canStart}
            onClick={handleStart}
            className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 py-3 font-bold tracking-wide transition hover:brightness-110 disabled:opacity-40"
          >
            MULAI PERMAINAN
          </button>
        ) : (
          <button
            data-testid="btn-ready"
            onClick={() => setReady(!self?.ready)}
            className={`flex-1 rounded-lg py-3 font-bold tracking-wide transition ${
              self?.ready
                ? 'border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10'
                : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:brightness-110'
            }`}
          >
            {self?.ready ? '✓ SIAP — batalkan' : 'SIAP'}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</p>
      )}
    </motion.div>
  );
}
