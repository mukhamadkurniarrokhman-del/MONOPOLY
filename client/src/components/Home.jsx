import { useState } from 'react';
import { motion } from 'framer-motion';
import { createRoom, joinRoom, resumeSaved } from '../network/socket.js';
import { useGameStore } from '../store/useGameStore.js';

// Kode room dari URL undangan (?room=XXXX) — diisi oleh scan QR.
const invitedCode = new URLSearchParams(window.location.search).get('room')?.toUpperCase().slice(0, 4) ?? '';

export default function Home() {
  const [name, setName] = useState('');
  const [code, setCode] = useState(invitedCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const savedRoom = useGameStore((s) => s.savedRoom);

  async function handle(action) {
    setError('');
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (res?.error) setError(res.error);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-2xl border border-white/10 bg-space-900/70 p-8 shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur"
    >
      <h1 className="text-center text-4xl font-black tracking-wide">
        <span className="bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent">
          MONOPOLI
        </span>
        <span className="block text-lg font-semibold tracking-[0.4em] text-slate-400">
          ANTARIKSA
        </span>
      </h1>

      <div className="mt-8 space-y-4">
        {savedRoom && (
          <div data-testid="saved-banner" className="flex items-center gap-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5">
            <p className="flex-1 text-sm text-emerald-200">
              💾 Permainan tersimpan di room <b className="font-mono tracking-widest">{savedRoom}</b>
            </p>
            <button
              data-testid="btn-resume-saved"
              onClick={resumeSaved}
              className="rounded-lg bg-emerald-500/80 px-4 py-1.5 text-sm font-bold text-space-950 hover:brightness-110"
            >
              LANJUTKAN
            </button>
          </div>
        )}
        {invitedCode && (
          <p data-testid="invite-banner" className="rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-center text-sm text-neon-cyan">
            🛰️ Kamu diundang ke room <b className="font-mono tracking-widest">{invitedCode}</b> — masukkan nama lalu GABUNG.
          </p>
        )}
        <input
          data-testid="input-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama Pemain"
          maxLength={20}
          className="w-full rounded-lg border border-white/10 bg-space-800 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-neon-cyan/60"
        />

        <button
          data-testid="btn-create"
          disabled={busy || !name.trim()}
          onClick={() => handle(() => createRoom(name))}
          className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 py-3 font-bold tracking-wide transition hover:brightness-110 disabled:opacity-40"
        >
          🚀 BUAT ROOM BARU
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-white/10" /> ATAU <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            data-testid="input-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="KODE"
            maxLength={4}
            className="w-28 rounded-lg border border-white/10 bg-space-800 px-4 py-3 text-center font-mono tracking-[0.3em] outline-none placeholder:text-slate-500 focus:border-neon-purple/60"
          />
          <button
            data-testid="btn-join"
            disabled={busy || !name.trim() || code.length !== 4}
            onClick={() => handle(() => joinRoom(code, name))}
            className="flex-1 rounded-lg border border-neon-purple/50 py-3 font-bold tracking-wide text-neon-purple transition hover:bg-neon-purple/10 disabled:opacity-40"
          >
            GABUNG ROOM
          </button>
        </div>

        {error && (
          <p data-testid="error-msg" className="rounded-lg bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </motion.div>
  );
}
