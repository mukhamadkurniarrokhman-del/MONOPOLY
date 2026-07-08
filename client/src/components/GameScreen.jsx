import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore.js';
import { useAnimStore } from '../store/useAnimStore.js';
import { rollDice, gameAction, leaveRoom, saveExit } from '../network/socket.js';
import { TILE_TYPES, getMap, getTokenDisplay } from '@shared/mapConfigs.js';
import { formatRupiah } from '@shared/constants.js';
import { PLAYER_COLORS } from '../three/boardLayout.js';
import SpaceBoard from '../three/SpaceBoard.jsx';
import TradeSystem from './TradePanel.jsx';
import { sfx } from '../audio/audioManager.js';

// Memetakan perubahan state game -> efek suara.
function useAudioTriggers(game, selfId) {
  const prev = useRef({});
  useEffect(() => {
    if (!game) return;
    const p = prev.current;
    const me = game.players.find((pl) => pl.id === selfId);

    if (game.lastCard && p.card !== game.lastCard.text) sfx.card();
    if (game.pendingCard && p.pendingCard !== game.pendingCard.text) sfx.card();
    if (p.auction === false && game.auction) sfx.gavel(); // lelang dibuka
    if (p.auction && game.auction && p.highBid !== game.auction.highBid) sfx.bid();
    if (p.auction && !game.auction) sfx.gavel(); // lelang ditutup
    if (p.trade === false && game.trade && game.trade.to === selfId) sfx.trade();
    if (me && p.balance != null && me.balance !== p.balance) {
      me.balance > p.balance ? sfx.money() : sfx.pay();
    }
    if (!p.winner && game.winner) sfx.win();
    if (me && p.inJail === false && me.inJail) sfx.deny();

    prev.current = {
      card: game.lastCard?.text,
      pendingCard: game.pendingCard?.text,
      auction: !!game.auction,
      highBid: game.auction?.highBid,
      trade: !!game.trade,
      balance: me?.balance,
      winner: game.winner,
      inJail: me?.inJail ?? false,
    };
  }, [game, selfId]);
}

const TOKEN_ICONS = { rocket: '🚀', astronaut: '🧑‍🚀', satellite: '🛰️', ufo: '🛸' };

// ---------- Modal holografik detail petak ----------
function TileModal({ idx, game, selfId, onClose }) {
  const [error, setError] = useState('');
  const { board: BOARD, groups: GROUPS } = getMap(game.mapId);
  const tile = BOARD[idx];
  const owned = game.properties[String(idx)];
  const owner = owned && game.players.find((p) => p.id === owned.owner);
  const group = tile.group ? GROUPS[tile.group] : null;
  const isProp = tile.type === TILE_TYPES.PROPERTY;

  // hipotek: hanya properti sendiri, di giliran sendiri, di luar fase pembelian
  const isMine = owned?.owner === selfId;
  const myTurn = game.currentPlayerId === selfId && game.phase !== 'awaiting_buy' && !game.winner;
  const groupHasBuildings = group ? group.tiles.some((t) => (game.properties[String(t)]?.level ?? 0) > 0) : false;
  const canMortgage = isMine && myTurn && !owned.mortgaged && !groupHasBuildings;
  const canUnmortgage = isMine && myTurn && owned.mortgaged;
  const mortgageValue = tile.price ? tile.price / 2 : 0;
  const unmortgageCost = tile.price ? Math.round((tile.price / 2) * 1.1) : 0;

  async function doAction(type) {
    const res = await gameAction(type, { tileIndex: idx });
    setError(res?.error ?? '');
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-space-950/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.7, rotateX: 25, opacity: 0 }}
        animate={{ scale: 1, rotateX: 0, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 0 60px rgba(34,211,238,0.25), inset 0 0 40px rgba(34,211,238,0.05)' }}
        className="relative w-[340px] rounded-2xl border border-neon-cyan/50 bg-space-900/80 p-5 backdrop-blur-md"
      >
        {/* garis pemindai holografik */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <motion.div
            animate={{ y: ['-10%', '110%'] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="h-8 w-full bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent"
          />
        </div>
        <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.3em] text-neon-cyan/70">
          <span>▚ DATA HOLOGRAFIK</span>
          <button onClick={onClose} className="pointer-events-auto text-sm tracking-normal text-slate-400 hover:text-white">✕</button>
        </div>
        <h3 className="text-xl font-black text-neon-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">{tile.name}</h3>
        {group && <div style={{ background: group.color }} className="mt-1.5 h-1.5 w-20 rounded shadow-[0_0_10px_currentColor]" />}

        {tile.price != null ? (
          <dl className="mt-4 space-y-1.5 text-sm text-slate-300">
            <div className="flex justify-between"><dt className="text-slate-500">Harga Beli</dt><dd className="font-bold text-emerald-300">{formatRupiah(tile.price)}</dd></div>
            {isProp && (
              <>
                <div className="flex justify-between"><dt className="text-slate-500">Sewa Dasar</dt><dd>{formatRupiah(tile.rents[0])} <span className="text-slate-600">(2× monopoli)</span></dd></div>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex justify-between"><dt className="text-slate-500">🤖 {n} Rover Riset</dt><dd>{formatRupiah(tile.rents[n])}</dd></div>
                ))}
                <div className="flex justify-between"><dt className="text-slate-500">🏙️ Koloni Antariksa</dt><dd>{formatRupiah(tile.rents[5])}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Biaya Upgrade</dt><dd>{formatRupiah(group.houseCost)}</dd></div>
              </>
            )}
            {tile.type === TILE_TYPES.STATION && (
              <div className="flex justify-between"><dt className="text-slate-500">Sewa 1-4 stasiun</dt><dd>{tile.rents.map((r) => r / 1_000_000).join(' / ')} jt</dd></div>
            )}
            {tile.type === TILE_TYPES.UTILITY && (
              <div className="flex justify-between"><dt className="text-slate-500">Sewa</dt><dd>4× / 10× dadu × Rp 50rb</dd></div>
            )}
            <div className="mt-2 flex justify-between border-t border-cyan-400/20 pt-2">
              <dt className="text-slate-500">Pemilik</dt>
              <dd className="font-bold" style={{ color: owner ? PLAYER_COLORS[game.players.indexOf(owner)] : undefined }}>
                {owner ? owner.name : '— Bank Galaksi —'}
              </dd>
            </div>
            {owned?.level > 0 && (
              <div className="flex justify-between"><dt className="text-slate-500">Bangunan</dt><dd>{owned.level === 5 ? '🏙️ Koloni Antariksa' : `🤖 ${owned.level} Rover Riset`}</dd></div>
            )}
            {owned?.mortgaged && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd data-testid="status-hipotek" className="font-bold text-rose-400">🔐 TERHIPOTEK — bebas sewa</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            {tile.amount ? `Pajak wajib: ${formatRupiah(tile.amount)}` : 'Petak spesial — tidak dapat dimiliki.'}
          </p>
        )}

        {(canMortgage || canUnmortgage) && (
          <div className="mt-4 border-t border-cyan-400/20 pt-3">
            {canMortgage && (
              <button
                data-testid="btn-mortgage"
                onClick={() => doAction('mortgage')}
                className="w-full rounded-lg border border-rose-400/50 py-2.5 text-sm font-bold text-rose-300 transition hover:bg-rose-400/10"
              >
                🔐 Hipotek — terima {formatRupiah(mortgageValue)}
              </button>
            )}
            {canUnmortgage && (
              <button
                data-testid="btn-unmortgage"
                onClick={() => doAction('unmortgage')}
                className="w-full rounded-lg border border-emerald-400/50 py-2.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/10"
              >
                🔓 Tebus Hipotek — bayar {formatRupiah(unmortgageCost)}
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">{error}</p>}
      </motion.div>
    </motion.div>
  );
}

// ---------- Keluar di tengah permainan: simpan kursi atau menyerah ----------
function ExitMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        data-testid="btn-exit-game"
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute bottom-16 left-3 z-10 rounded-xl border border-rose-400/40 bg-space-900/80 px-4 py-2 text-sm font-bold text-rose-300 backdrop-blur transition hover:bg-rose-400/10"
      >
        ⏻ KELUAR
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-space-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[340px] rounded-2xl border border-white/15 bg-space-900/95 p-6 backdrop-blur-md"
            >
              <h3 className="text-center text-lg font-black text-slate-100">Keluar dari permainan?</h3>
              <div className="mt-5 space-y-2.5">
                <button
                  data-testid="btn-save-exit"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await saveExit();
                  }}
                  className="w-full rounded-xl border border-emerald-400/50 py-3 font-bold text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-40"
                >
                  💾 SIMPAN & KELUAR
                </button>
                <p className="px-1 text-center text-[11px] leading-snug text-slate-500">
                  Kursimu ditahan hingga 12 jam — kembali kapan pun lewat tombol Lanjutkan atau buka game lagi.
                </p>
                <button
                  data-testid="btn-quit-exit"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    leaveRoom();
                  }}
                  className="w-full rounded-xl border border-rose-400/50 py-3 font-bold text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40"
                >
                  🏳️ KELUAR PERMANEN
                </button>
                <p className="px-1 text-center text-[11px] leading-snug text-slate-500">
                  Dianggap menyerah — asetmu kembali ke Bank Galaksi dan pemain lain melanjutkan.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-slate-400 transition hover:bg-white/5"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------- Modal kartu tertarik (fase awaiting_card) ----------
function PendingCardModal({ game, selfId }) {
  const card = game.pendingCard;
  const mapCfg = getMap(game.mapId);
  const color = mapCfg.theme.deckColors[card.deck];
  const label = card.deck === 'warp' ? mapCfg.deckLabels.warp : mapCfg.deckLabels.transmission;
  const drawer = game.players.find((p) => p.id === game.currentPlayerId);
  const isMine = game.currentPlayerId === selfId;
  const [busy, setBusy] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.7, rotateY: 90 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.85 }}
      style={{ borderColor: color, boxShadow: `0 0 60px ${color}44, inset 0 0 30px ${color}11` }}
      className="pointer-events-auto absolute left-1/2 top-1/2 z-40 w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-space-900/95 p-6 backdrop-blur-md"
    >
      <p className="text-center text-[10px] tracking-[0.35em]" style={{ color }}>
        {card.deck === 'warp' ? '🌀' : '📡'} {label}
      </p>
      <div className="mx-auto mt-2 h-1 w-16 rounded" style={{ background: color }} />
      <p data-testid="pending-card-text" className="mt-4 text-center text-base font-semibold leading-relaxed text-slate-100">
        {card.text}
      </p>
      <div className="mt-6">
        {isMine ? (
          <button
            data-testid="btn-ack-card"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await gameAction('ackCard');
              setBusy(false);
            }}
            style={{ background: `linear-gradient(90deg, ${color}cc, ${color}88)` }}
            className="w-full rounded-xl py-3 font-black tracking-widest text-space-950 transition hover:brightness-110 disabled:opacity-40"
          >
            ⚡ JALANKAN
          </button>
        ) : (
          <p className="animate-pulse text-center text-xs text-slate-500">
            Menunggu {drawer?.name} menjalankan kartu…
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ---------- Modal lelang real-time ----------
function AuctionModal({ game, selfId }) {
  const a = game.auction;
  const { board: BOARD, groups: GROUPS } = getMap(game.mapId);
  const tile = BOARD[a.tileIndex];
  const group = tile.group ? GROUPS[tile.group] : null;
  const me = game.players.find((p) => p.id === selfId);
  const highBidder = a.highBidder && game.players.find((p) => p.id === a.highBidder);
  const [now, setNow] = useState(Date.now());
  const deadline = useRef(Date.now() + a.remainingMs);
  const [error, setError] = useState('');

  // sinkronkan tenggat lokal setiap server mengirim state lelang baru
  useEffect(() => {
    deadline.current = Date.now() + a.remainingMs;
  }, [a.remainingMs, a.highBid, a.highBidder]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, []);

  const remaining = Math.max(0, deadline.current - now);
  const detik = (remaining / 1000).toFixed(1);
  const nextMin = a.highBid > 0 ? a.highBid + a.minIncrement : a.minIncrement;
  const bids = [nextMin, nextMin + 1_000_000, nextMin + 4_500_000];
  const canBid = me && !me.bankrupt && a.highBidder !== selfId;

  async function bid(amount) {
    const res = await gameAction('bid', { amount });
    setError(res?.error ?? '');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="pointer-events-auto absolute left-1/2 top-1/2 z-30 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-400/50 bg-space-900/90 p-5 shadow-[0_0_60px_rgba(251,191,36,0.25)] backdrop-blur-md"
    >
      <p className="text-center text-[10px] tracking-[0.35em] text-amber-300/80">🔨 LELANG GALAKSI</p>
      <h3 className="mt-1 text-center text-2xl font-black text-amber-300">{tile.name}</h3>
      {group && <div style={{ background: group.color }} className="mx-auto mt-1.5 h-1.5 w-20 rounded" />}
      <p className="mt-1 text-center text-xs text-slate-500">Harga pasar: {formatRupiah(tile.price)}</p>

      {/* countdown */}
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${remaining < 3000 ? 'bg-rose-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(100, (remaining / 10000) * 100)}%` }}
          />
        </div>
        <p data-testid="auction-timer" className={`mt-1 text-center font-mono text-lg font-bold ${remaining < 3000 ? 'text-rose-400' : 'text-amber-300'}`}>
          ⏱ {detik} dtk
        </p>
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-space-800/60 p-3 text-center">
        {a.highBidder ? (
          <>
            <p className="text-[10px] tracking-widest text-slate-500">TAWARAN TERTINGGI</p>
            <p data-testid="high-bid" className="text-xl font-black text-emerald-300">{formatRupiah(a.highBid)}</p>
            <p className="text-xs font-semibold" style={{ color: PLAYER_COLORS[game.players.indexOf(highBidder)] }}>
              {highBidder?.name}
              {a.highBidder === selfId && ' (kamu!)'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Belum ada penawar…</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {bids.map((b) => (
          <button
            key={b}
            data-testid="btn-bid"
            disabled={!canBid || b > (me?.balance ?? 0)}
            onClick={() => bid(b)}
            className="flex-1 rounded-lg border border-amber-400/50 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-30"
          >
            {formatRupiah(b)}
          </button>
        ))}
      </div>
      {a.highBidder === selfId && <p className="mt-2 text-center text-xs text-emerald-300">Tawaranmu tertinggi — tunggu hasilnya!</p>}
      {error && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-1.5 text-center text-xs text-rose-300">{error}</p>}
    </motion.div>
  );
}

// ---------- HUD pemain ----------
function PlayerCard({ p, i, game }) {
  const isTurn = game.currentPlayerId === p.id;
  const { board: BOARD, groups: GROUPS } = getMap(game.mapId);
  const props = Object.entries(game.properties).filter(([, v]) => v.owner === p.id);
  return (
    <div
      style={{ borderColor: isTurn ? PLAYER_COLORS[i] : 'rgba(255,255,255,0.1)' }}
      className={`pointer-events-auto w-52 rounded-xl border bg-space-900/80 p-2.5 backdrop-blur ${p.bankrupt ? 'opacity-40' : ''} ${isTurn ? 'shadow-[0_0_18px_rgba(34,211,238,0.25)]' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{getTokenDisplay(getMap(game.mapId), p.token).icon}</span>
        <span className="truncate text-sm font-bold" style={{ color: PLAYER_COLORS[i] }}>{p.name}</span>
        {p.isBot && <span className="rounded bg-purple-500/20 px-1 text-[9px] font-bold text-purple-300">AI</span>}
        {p.disconnected && <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">⚡ TERPUTUS</span>}
        {isTurn && !game.winner && <span className="ml-auto animate-pulse text-[10px] text-neon-cyan">●</span>}
        {p.bankrupt && <span className="ml-auto text-[10px] text-rose-400">BANGKRUT</span>}
      </div>
      <p className="font-mono text-xs text-emerald-300">{formatRupiah(p.balance)}</p>
      <p className="truncate text-[10px] text-slate-500">
        📍 {BOARD[p.position].name}{p.inJail && ' 🔒'}{p.jailCards > 0 && ` 🎟️×${p.jailCards}`}
      </p>
      {props.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {props.map(([idx, v]) => (
            <span
              key={idx}
              style={{ background: BOARD[idx].group ? GROUPS[BOARD[idx].group].color : '#64748b' }}
              className={`h-1.5 w-1.5 rounded-full ${v.mortgaged ? 'opacity-25 ring-1 ring-rose-400' : ''}`}
              title={`${BOARD[idx].name}${v.mortgaged ? ' (hipotek)' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- bilah aksi ----------
function ActionBar({ game, selfId, setError }) {
  const isMyTurn = game.currentPlayerId === selfId;
  const { board: BOARD, groups: GROUPS, bail } = getMap(game.mapId);
  const me = game.players.find((p) => p.id === selfId);

  async function act(fn) {
    const res = await fn();
    setError(res?.error ?? '');
  }

  if (game.winner || !me) return null;
  if (!isMyTurn) {
    const turn = game.players.find((p) => p.id === game.currentPlayerId);
    return <p className="rounded-full border border-white/10 bg-space-900/80 px-5 py-2 text-sm text-slate-400 backdrop-blur">Menunggu giliran {turn?.name}…</p>;
  }

  const tile = BOARD[me.position];
  const buildable = Object.entries(game.properties).filter(([idx, v]) => {
    if (v.owner !== selfId || v.level >= 5) return false;
    const t = BOARD[idx];
    if (t.type !== TILE_TYPES.PROPERTY) return false;
    const g = GROUPS[t.group];
    if (!g.tiles.every((ti) => game.properties[String(ti)]?.owner === selfId)) return false;
    const minLv = Math.min(...g.tiles.map((ti) => game.properties[String(ti)].level));
    return v.level <= minLv && me.balance >= g.houseCost;
  });

  const btn = 'pointer-events-auto rounded-xl px-5 py-3 font-bold tracking-wide transition disabled:opacity-40 backdrop-blur';
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {game.phase === 'awaiting_roll' && (
        <>
          <button
            data-testid="btn-roll"
            onClick={() => act(rollDice)}
            className="pointer-events-auto rounded-xl border-2 border-white/50 bg-gradient-to-r from-cyan-400 to-purple-500 px-7 py-3.5 text-base font-black tracking-wide text-white shadow-[0_0_30px_rgba(34,211,238,0.7)] transition hover:brightness-110 disabled:opacity-40"
          >
            🎲 LEMPAR DADU
          </button>
          {me.inJail && (
            <>
              <button onClick={() => act(() => gameAction('payBail'))} className={`${btn} border border-amber-400/50 bg-space-900/70 text-amber-300 hover:bg-amber-400/10`}>
                Bayar Jaminan {formatRupiah(bail)}
              </button>
              {me.jailCards > 0 && (
                <button onClick={() => act(() => gameAction('useJailCard'))} className={`${btn} border border-emerald-400/50 bg-space-900/70 text-emerald-300 hover:bg-emerald-400/10`}>
                  🎟️ Kartu Bebas
                </button>
              )}
            </>
          )}
        </>
      )}
      {game.phase === 'awaiting_buy' && (
        <>
          <button data-testid="btn-buy" onClick={() => act(() => gameAction('buy'))} className={`${btn} bg-gradient-to-r from-emerald-500 to-cyan-600 shadow-[0_0_25px_rgba(52,211,153,0.4)] hover:brightness-110`}>
            💰 BELI {tile.name} · {formatRupiah(tile.price)}
          </button>
          <button data-testid="btn-skip" onClick={() => act(() => gameAction('skip'))} className={`${btn} border border-white/20 bg-space-900/70 text-slate-300 hover:bg-white/5`}>
            Lewati
          </button>
        </>
      )}
      {game.phase === 'post_roll' && (
        <button data-testid="btn-end" onClick={() => act(() => gameAction('endTurn'))} className={`${btn} bg-gradient-to-r from-purple-600 to-pink-600 shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:brightness-110`}>
          AKHIRI GILIRAN ➜
        </button>
      )}
      {buildable.length > 0 && game.phase !== 'awaiting_buy' && (
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-space-900/80 px-2 py-1.5 backdrop-blur">
          <span className="px-1 text-[10px] tracking-widest text-slate-500">BANGUN</span>
          {buildable.map(([idx]) => (
            <button key={idx} onClick={() => act(() => gameAction('build', { tileIndex: Number(idx) }))} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">
              🤖 {BOARD[idx].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GameScreen() {
  const game = useGameStore((s) => s.game);
  const selfId = useGameStore((s) => s.selfId);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  // di layar sempit (HP) log default terlipat agar tak menutupi area dadu
  const [showLog, setShowLog] = useState(() => window.innerWidth >= 640);
  const diceRolling = useAnimStore((s) => s.diceRolling);
  const tokenMoving = useAnimStore((s) => s.followingCount > 0);
  useAudioTriggers(game, selfId);

  if (!game) return <p className="text-slate-400">Memuat data permainan…</p>;
  const mapCfg = getMap(game.mapId);
  const winner = game.winner && game.players.find((p) => p.id === game.winner);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <SpaceBoard game={game} onTileClick={setSelected} />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3">
        {/* atas: pemain */}
        <div className="flex flex-wrap gap-2 pr-40">
          {game.players.map((p, i) => (
            <PlayerCard key={p.id} p={p} i={i} game={game} />
          ))}
        </div>

        {/* bawah: dadu + kartu + aksi */}
        <div className="flex flex-col items-center gap-2 pb-1">
          <AnimatePresence>
            {game.lastCard && (
              <motion.div
                key={game.lastCard.text}
                initial={{ opacity: 0, y: 20, rotateY: 90 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`pointer-events-auto max-w-md rounded-xl border px-4 py-2.5 text-center text-xs backdrop-blur ${
                  game.lastCard.deck === 'warp'
                    ? 'border-purple-400/50 bg-purple-950/70 text-purple-200 shadow-[0_0_25px_rgba(168,85,247,0.3)]'
                    : 'border-cyan-400/50 bg-cyan-950/70 text-cyan-200 shadow-[0_0_25px_rgba(34,211,238,0.3)]'
                }`}
              >
                <p className="mb-0.5 font-bold tracking-widest">
                  {game.lastCard.deck === 'warp' ? `🌀 ${mapCfg.deckLabels.warp}` : `📡 ${mapCfg.deckLabels.transmission}`}
                </p>
                {game.lastCard.text}
              </motion.div>
            )}
          </AnimatePresence>
          {game.lastDice && !diceRolling && (
            <div data-testid="dice" className="flex gap-2">
              {[game.lastDice.d1, game.lastDice.d2].map((d, i) => (
                <span key={i} className="rounded-lg bg-white/90 px-3 py-1 text-2xl font-black text-space-950 shadow-[0_0_15px_rgba(255,255,255,0.4)]">{d}</span>
              ))}
            </div>
          )}
          <ActionBar game={game} selfId={selfId} setError={setError} />
          {error && <p className="pointer-events-auto rounded-lg bg-rose-500/15 px-4 py-1.5 text-sm text-rose-300 backdrop-blur">{error}</p>}
        </div>
      </div>

      {/* log: HP = panel kecil kanan-atas (di bawah badge), desktop = kanan-bawah */}
      <div className="absolute right-2 top-14 z-10 w-48 sm:right-3 sm:top-auto sm:bottom-3 sm:w-72">
        <button onClick={() => setShowLog(!showLog)} className="mb-1 w-full rounded-lg border border-white/10 bg-space-900/80 px-3 py-1 text-left text-[10px] tracking-widest text-slate-500 backdrop-blur hover:text-slate-300">
          {showLog ? '▼' : '▲'} LOG TRANSMISI
        </button>
        {showLog && (
          <div data-testid="game-log" className="max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-space-900/80 p-2.5 text-[11px] leading-relaxed text-slate-400 backdrop-blur sm:max-h-40">
            {[...game.log].reverse().map((l, i) => (
              <p key={l.t + '-' + i} className={i === 0 ? 'text-slate-100' : ''}>{l.text}</p>
            ))}
          </div>
        )}
      </div>

      {/* modal petak */}
      <AnimatePresence>
        {selected != null && <TileModal idx={selected} game={game} selfId={selfId} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      {/* lelang */}
      <AnimatePresence>
        {game.auction && <AuctionModal key={game.auction.tileIndex} game={game} selfId={selfId} />}
      </AnimatePresence>

      {/* kartu tertarik — tampil serentak di semua klien setelah animasi token */}
      <AnimatePresence>
        {game.pendingCard && !diceRolling && !tokenMoving && (
          <PendingCardModal key={game.pendingCard.text} game={game} selfId={selfId} />
        )}
      </AnimatePresence>

      {/* pertukaran antar pemain */}
      <TradeSystem game={game} selfId={selfId} />

      {/* keluar (simpan / permanen) */}
      {!game.winner && <ExitMenu />}

      {/* overlay pemenang */}
      {winner && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-space-950/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl border border-amber-400/50 bg-space-900/90 p-8 text-center shadow-[0_0_80px_rgba(251,191,36,0.3)]">
            <p className="text-4xl">🏆</p>
            <p className="mt-2 text-3xl font-black text-amber-300">{winner.name}</p>
            <p className="text-lg tracking-widest text-amber-200/70">MENGUASAI GALAKSI!</p>
            <button onClick={leaveRoom} className="mt-5 rounded-xl border border-white/20 px-6 py-2.5 text-sm hover:bg-white/5">
              Kembali ke Menu
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
