import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gameAction } from '../network/socket.js';
import { getMap } from '@shared/mapConfigs.js';
import { formatRupiah } from '@shared/constants.js';
import { PLAYER_COLORS } from '../three/boardLayout.js';

// Properti yang boleh ditukar: milik pemain ybs, tanpa bangunan.
function tradeableProps(game, playerId) {
  return Object.entries(game.properties)
    .filter(([, v]) => v.owner === playerId && v.level === 0)
    .map(([idx, v]) => ({ idx: Number(idx), mortgaged: v.mortgaged }));
}

function PropChecklist({ game, playerId, selected, onToggle }) {
  const { board: BOARD, groups: GROUPS } = getMap(game.mapId);
  const props = tradeableProps(game, playerId);
  if (props.length === 0) return <p className="text-[11px] italic text-slate-600">tidak ada properti yang bisa ditukar</p>;
  return (
    <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
      {props.map(({ idx, mortgaged }) => {
        const tile = BOARD[idx];
        const on = selected.includes(idx);
        return (
          <button
            key={idx}
            onClick={() => onToggle(idx)}
            style={{ borderColor: tile.group ? GROUPS[tile.group].color : '#64748b' }}
            className={`rounded-lg border px-2 py-1 text-[10px] transition ${on ? 'bg-white/15 font-bold text-white' : 'text-slate-400 hover:bg-white/5'}`}
          >
            {on ? '✓ ' : ''}{tile.name}{mortgaged ? ' 🔐' : ''}
          </button>
        );
      })}
    </div>
  );
}

function MoneyInput({ value, onChange, testid }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-space-800 px-2">
      <span className="text-xs text-slate-500">Rp</span>
      <input
        data-testid={testid}
        type="number"
        min="0"
        step="500000"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-slate-600"
      />
    </div>
  );
}

function TradeSummaryList({ money, props, board, emptyText }) {
  return (
    <ul className="space-y-0.5 text-xs text-slate-300">
      {money > 0 && <li className="font-bold text-emerald-300">💰 {formatRupiah(money)}</li>}
      {props.map((idx) => (
        <li key={idx}>🪐 {board[idx].name}</li>
      ))}
      {money <= 0 && props.length === 0 && <li className="italic text-slate-600">{emptyText}</li>}
    </ul>
  );
}

// Komposer: susun & kirim usulan pertukaran.
function TradeComposer({ game, selfId, onClose }) {
  const partners = game.players.filter((p) => p.id !== selfId && !p.bankrupt);
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? null);
  const [offerMoney, setOfferMoney] = useState('');
  const [requestMoney, setRequestMoney] = useState('');
  const [offerProps, setOfferProps] = useState([]);
  const [requestProps, setRequestProps] = useState([]);
  const [error, setError] = useState('');
  const partner = game.players.find((p) => p.id === partnerId);

  const toggle = (list, set) => (idx) => set(list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx]);

  async function send() {
    const res = await gameAction('proposeTrade', {
      to: partnerId,
      offerMoney: Number(offerMoney) || 0,
      requestMoney: Number(requestMoney) || 0,
      offerProps,
      requestProps,
    });
    if (res?.error) setError(res.error);
    else onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-space-950/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] rounded-2xl border border-cyan-400/40 bg-space-900/90 p-5 backdrop-blur-md"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-neon-cyan">🤝 Usulkan Pertukaran</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Kepada:</span>
          {partners.map((p) => (
            <button
              key={p.id}
              data-testid={`trade-partner-${p.name}`}
              onClick={() => setPartnerId(p.id)}
              style={{ borderColor: partnerId === p.id ? PLAYER_COLORS[game.players.indexOf(p)] : 'rgba(255,255,255,0.1)' }}
              className={`rounded-full border px-3 py-1 text-xs ${partnerId === p.id ? 'font-bold text-white' : 'text-slate-400'}`}
            >
              {p.name}{p.isBot ? ' 🤖' : ''}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-3">
            <p className="mb-2 text-[10px] font-bold tracking-widest text-emerald-300">KAMU MEMBERI</p>
            <MoneyInput value={offerMoney} onChange={setOfferMoney} testid="trade-offer-money" />
            <div className="mt-2">
              <PropChecklist game={game} playerId={selfId} selected={offerProps} onToggle={toggle(offerProps, setOfferProps)} />
            </div>
          </div>
          <div className="rounded-xl border border-purple-400/20 bg-purple-950/20 p-3">
            <p className="mb-2 text-[10px] font-bold tracking-widest text-purple-300">KAMU MEMINTA</p>
            <MoneyInput value={requestMoney} onChange={setRequestMoney} testid="trade-request-money" />
            <div className="mt-2">
              {partner && <PropChecklist game={game} playerId={partner.id} selected={requestProps} onToggle={toggle(requestProps, setRequestProps)} />}
            </div>
          </div>
        </div>

        <button
          data-testid="btn-send-trade"
          onClick={send}
          disabled={!partnerId}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 py-2.5 font-bold tracking-wide hover:brightness-110 disabled:opacity-40"
        >
          KIRIM PENAWARAN
        </button>
        {error && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">{error}</p>}
      </motion.div>
    </motion.div>
  );
}

// Modal masuk: penerima harus eksplisit menerima/menolak.
function IncomingTrade({ game, trade }) {
  const from = game.players.find((p) => p.id === trade.from);
  const { board } = getMap(game.mapId);
  const [busy, setBusy] = useState(false);

  async function respond(accept) {
    setBusy(true);
    await gameAction('respondTrade', { accept });
    setBusy(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="pointer-events-auto absolute left-1/2 top-1/2 z-40 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-400/50 bg-space-900/95 p-5 shadow-[0_0_60px_rgba(34,211,238,0.25)] backdrop-blur-md"
    >
      <p className="text-center text-[10px] tracking-[0.3em] text-neon-cyan/80">🤝 PENAWARAN PERTUKARAN</p>
      <p className="mt-1 text-center text-sm text-slate-300">
        <b style={{ color: PLAYER_COLORS[game.players.indexOf(from)] }}>{from?.name}</b> mengusulkan:
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-3">
          <p className="mb-1 text-[10px] font-bold tracking-widest text-emerald-300">KAMU MENERIMA</p>
          <TradeSummaryList money={trade.offerMoney} props={trade.offerProps} board={board} emptyText="tidak ada" />
        </div>
        <div className="rounded-xl border border-rose-400/20 bg-rose-950/20 p-3">
          <p className="mb-1 text-[10px] font-bold tracking-widest text-rose-300">KAMU MEMBERI</p>
          <TradeSummaryList money={trade.requestMoney} props={trade.requestProps} board={board} emptyText="tidak ada" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          data-testid="btn-trade-reject"
          disabled={busy}
          onClick={() => respond(false)}
          className="flex-1 rounded-xl border border-rose-400/50 py-2.5 font-bold text-rose-300 hover:bg-rose-400/10 disabled:opacity-40"
        >
          TOLAK
        </button>
        <button
          data-testid="btn-trade-accept"
          disabled={busy}
          onClick={() => respond(true)}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 py-2.5 font-bold hover:brightness-110 disabled:opacity-40"
        >
          ✓ TERIMA
        </button>
      </div>
    </motion.div>
  );
}

export default function TradeSystem({ game, selfId }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const trade = game.trade;
  const partnersExist = game.players.some((p) => p.id !== selfId && !p.bankrupt);
  const me = game.players.find((p) => p.id === selfId);

  return (
    <>
      {/* tombol pembuka — pojok kiri bawah */}
      {!game.winner && me && !me.bankrupt && partnersExist && !trade && (
        <button
          data-testid="btn-open-trade"
          onClick={() => setComposerOpen(true)}
          className="pointer-events-auto absolute bottom-3 left-3 z-10 rounded-xl border border-cyan-400/40 bg-space-900/80 px-4 py-2 text-sm font-bold text-neon-cyan backdrop-blur transition hover:bg-cyan-400/10"
        >
          🤝 TUKAR
        </button>
      )}

      {/* banner usulan keluar */}
      {trade && trade.from === selfId && (
        <div className="pointer-events-auto absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-xl border border-amber-400/40 bg-space-900/85 px-4 py-2 text-xs text-amber-200 backdrop-blur">
          <span className="animate-pulse">⏳ Menunggu respons {game.players.find((p) => p.id === trade.to)?.name}…</span>
          <button
            data-testid="btn-cancel-trade"
            onClick={() => gameAction('cancelTrade')}
            className="rounded-lg border border-white/20 px-2 py-1 text-slate-300 hover:bg-white/5"
          >
            Batalkan
          </button>
        </div>
      )}

      <AnimatePresence>
        {composerOpen && !trade && (
          <TradeComposer key="composer" game={game} selfId={selfId} onClose={() => setComposerOpen(false)} />
        )}
        {trade && trade.to === selfId && <IncomingTrade key="incoming" game={game} trade={trade} />}
      </AnimatePresence>
    </>
  );
}
