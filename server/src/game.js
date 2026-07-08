import { TILE_TYPES, getMap, DEFAULT_MAP_ID } from '../../shared/mapConfigs.js';
import { STARTING_BALANCE, formatRupiah } from '../../shared/constants.js';
import { buildDecks } from './cards.js';

// Mesin permainan otoritatif. Klien hanya mengirim niat (roll/buy/build/...)
// dan server memvalidasi semuanya — dadu selalu dilempar di server.
export class Game {
  constructor(players, mapId = DEFAULT_MAP_ID) {
    this.mapId = mapId;
    this.map = getMap(mapId); // objek peta TIDAK diserialisasi (lihat toJSON)
    this.players = players.map((p) => ({
      id: p.id,
      name: p.name,
      token: p.token,
      isBot: p.isBot ?? false,
      balance: STARTING_BALANCE,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      bankrupt: false,
    }));
    this.properties = {}; // tileIndex -> { owner, level: 0..5 (1-4 Rover, 5 Koloni) }
    this.turnIndex = 0;
    this.phase = 'awaiting_roll'; // awaiting_roll | awaiting_buy | awaiting_card | auction | post_roll | finished
    this.pendingCard = null; // kartu tertarik yang menunggu tombol JALANKAN
    // batas durasi: saat habis, pemain terkaya dinyatakan menang
    this.endsAt = Date.now() + (Number(process.env.GAME_TIME_LIMIT_MS) || 30 * 60 * 1000);
    this.auction = null; // { tileIndex, highBid, highBidder, endsAt, minIncrement }
    this.trade = null; // { from, to, offerMoney, offerProps, requestMoney, requestProps, endsAt }
    this.doubles = 0;
    this.lastDice = null; // { d1, d2, total, isDouble }
    this.lastCard = null; // { deck, text } — untuk UI
    const decks = buildDecks(this.map);
    this.warpDeck = decks.warp;
    this.transDeck = decks.transmission;
    this.log = [];
    this.winner = null;
    this.addLog(`Permainan dimulai! Setiap pemain menerima ${formatRupiah(STARTING_BALANCE)}.`);
  }

  // Hidupkan kembali instance dari JSON Redis — semua field adalah data polos;
  // objek peta di-resolve ulang dari mapId.
  static rehydrate(data) {
    const g = Object.assign(Object.create(Game.prototype), data);
    g.mapId = data.mapId ?? DEFAULT_MAP_ID;
    g.map = getMap(g.mapId);
    return g;
  }

  // Jangan serialisasi objek peta — cukup mapId-nya.
  toJSON() {
    const { map, ...rest } = this;
    return rest;
  }

  get current() {
    return this.players[this.turnIndex];
  }

  addLog(text) {
    this.log.push({ t: Date.now(), text });
    if (this.log.length > 100) this.log.shift();
  }

  // ---------- aksi pemain ----------

  rollDice(playerId, debugDice) {
    const err = this.guard(playerId, 'awaiting_roll');
    if (err) return { error: err };
    const p = this.current;

    let d1 = 1 + Math.floor(Math.random() * 6);
    let d2 = 1 + Math.floor(Math.random() * 6);
    // Hook pengujian — hanya aktif di luar produksi.
    if (debugDice && process.env.NODE_ENV !== 'production' && Array.isArray(debugDice)) {
      [d1, d2] = debugDice.map((n) => Math.min(6, Math.max(1, Number(n) || 1)));
    }
    const isDouble = d1 === d2;
    this.lastDice = { d1, d2, total: d1 + d2, isDouble };
    this.lastCard = null;

    if (p.inJail) {
      this.resolveJailRoll(p, d1, d2, isDouble);
      return { ok: true, dice: this.lastDice };
    }

    if (isDouble) {
      this.doubles += 1;
      if (this.doubles >= 3) {
        this.addLog(`${p.name} melempar dobel 3x berturut-turut — patroli galaksi menangkapnya!`);
        this.sendToJail(p);
        return { ok: true, dice: this.lastDice };
      }
    } else {
      this.doubles = 0;
    }

    this.addLog(`${p.name} melempar dadu: ${d1} + ${d2} = ${d1 + d2}${isDouble ? ' (DOBEL!)' : ''}.`);
    this.moveBy(p, d1 + d2);
    return { ok: true, dice: this.lastDice };
  }

  buy(playerId) {
    const err = this.guard(playerId, 'awaiting_buy');
    if (err) return { error: err };
    const p = this.current;
    const tile = this.map.board[p.position];
    if (p.balance < tile.price) return { error: 'Saldo tidak cukup.' };

    p.balance -= tile.price;
    this.properties[p.position] = { owner: p.id, level: 0, mortgaged: false };
    this.addLog(`${p.name} membeli ${tile.name} seharga ${formatRupiah(tile.price)}.`);
    this.afterResolution();
    return { ok: true };
  }

  skipBuy(playerId) {
    const err = this.guard(playerId, 'awaiting_buy');
    if (err) return { error: err };
    this.addLog(`${this.current.name} melewatkan pembelian ${this.map.board[this.current.position].name}.`);
    this.startAuction(this.current.position);
    return { ok: true };
  }

  // ---------- pertukaran (trading) ----------

  proposeTrade(fromId, { to, offerMoney = 0, offerProps = [], requestMoney = 0, requestProps = [] } = {}) {
    if (this.winner) return { error: 'Permainan sudah selesai.' };
    if (this.phase === 'auction') return { error: 'Tunggu lelang selesai.' };
    if (this.trade) return { error: 'Masih ada penawaran tukar yang menunggu respons.' };
    const from = this.players.find((p) => p.id === fromId);
    const target = this.players.find((p) => p.id === to);
    if (!from || from.bankrupt) return { error: 'Pemain tidak valid.' };
    if (!target || target.bankrupt || target.id === fromId) return { error: 'Pemain tujuan tidak valid.' };

    const oM = Math.floor(Number(offerMoney) || 0);
    const rM = Math.floor(Number(requestMoney) || 0);
    if (oM < 0 || rM < 0) return { error: 'Nominal tidak valid.' };
    const oP = [...new Set((offerProps ?? []).map(Number))];
    const rP = [...new Set((requestProps ?? []).map(Number))];

    const checkProps = (list, ownerId, ownerName) => {
      for (const idx of list) {
        const prop = this.properties[idx];
        if (!prop || prop.owner !== ownerId) return `${this.map.board[idx]?.name ?? 'Properti'} bukan milik ${ownerName}.`;
        if (prop.level > 0) return `Jual bangunan di ${this.map.board[idx].name} dulu sebelum ditukar.`;
      }
      return null;
    };
    const e1 = checkProps(oP, fromId, from.name);
    if (e1) return { error: e1 };
    const e2 = checkProps(rP, to, target.name);
    if (e2) return { error: e2 };
    if (oM > from.balance) return { error: 'Saldomu tidak cukup untuk tawaran itu.' };
    if (rM > target.balance) return { error: 'Saldo pemain tujuan tidak sebanyak itu.' };
    if (oM + rM + oP.length + rP.length === 0) return { error: 'Penawaran kosong.' };

    this.trade = { from: fromId, to, offerMoney: oM, offerProps: oP, requestMoney: rM, requestProps: rP, endsAt: Date.now() + 60_000 };
    this.addLog(`🤝 ${from.name} mengusulkan pertukaran kepada ${target.name}.`);
    return { ok: true };
  }

  respondTrade(playerId, accept) {
    if (!this.trade) return { error: 'Tidak ada penawaran tukar.' };
    const t = this.trade;
    if (playerId !== t.to) return { error: 'Penawaran ini bukan untukmu.' };
    const from = this.players.find((p) => p.id === t.from);
    const target = this.players.find((p) => p.id === t.to);

    if (!accept) {
      this.trade = null;
      this.addLog(`${target.name} menolak penawaran tukar dari ${from.name}.`);
      return { ok: true };
    }

    // validasi ULANG saat eksekusi — state bisa berubah sejak diusulkan
    if (!from || from.bankrupt || target.bankrupt) {
      this.trade = null;
      return { error: 'Pemain sudah tidak valid — penawaran batal.' };
    }
    for (const idx of t.offerProps) {
      if (this.properties[idx]?.owner !== t.from || this.properties[idx].level > 0) {
        this.trade = null;
        return { error: 'Kepemilikan properti berubah — penawaran batal.' };
      }
    }
    for (const idx of t.requestProps) {
      if (this.properties[idx]?.owner !== t.to || this.properties[idx].level > 0) {
        this.trade = null;
        return { error: 'Kepemilikan properti berubah — penawaran batal.' };
      }
    }
    if (from.balance < t.offerMoney || target.balance < t.requestMoney) {
      this.trade = null;
      return { error: 'Saldo berubah — penawaran batal.' };
    }

    from.balance -= t.offerMoney;
    target.balance += t.offerMoney;
    target.balance -= t.requestMoney;
    from.balance += t.requestMoney;
    for (const idx of t.offerProps) this.properties[idx].owner = t.to;
    for (const idx of t.requestProps) this.properties[idx].owner = t.from;
    this.trade = null;
    this.addLog(`🤝 Pertukaran disepakati antara ${from.name} dan ${target.name}!`);
    return { ok: true };
  }

  cancelTrade(playerId) {
    if (!this.trade) return { error: 'Tidak ada penawaran tukar.' };
    if (this.trade.from !== playerId) return { error: 'Hanya pengusul yang bisa membatalkan.' };
    const from = this.players.find((p) => p.id === playerId);
    this.trade = null;
    this.addLog(`${from.name} membatalkan penawaran tukarnya.`);
    return { ok: true };
  }

  expireTrade() {
    if (!this.trade) return;
    const from = this.players.find((p) => p.id === this.trade.from);
    this.trade = null;
    this.addLog(`Penawaran tukar dari ${from?.name ?? '?'} kedaluwarsa.`);
  }

  // ---------- lelang ----------

  startAuction(tileIndex) {
    this.phase = 'auction';
    this.auction = {
      tileIndex,
      highBid: 0,
      highBidder: null,
      endsAt: Date.now() + 10_000,
      minIncrement: 500_000,
    };
    this.addLog(`🔨 LELANG dimulai untuk ${this.map.board[tileIndex].name} — tawaran awal min. ${formatRupiah(500_000)}!`);
  }

  placeBid(playerId, amount) {
    if (this.winner) return { error: 'Permainan sudah selesai.' };
    if (this.phase !== 'auction' || !this.auction) return { error: 'Tidak ada lelang berjalan.' };
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p || p.bankrupt) return { error: 'Kamu tidak bisa ikut lelang.' };
    const a = this.auction;
    const bid = Math.floor(Number(amount));
    const minBid = a.highBid > 0 ? a.highBid + a.minIncrement : a.minIncrement;
    if (!Number.isFinite(bid) || bid < minBid) return { error: `Tawaran minimal ${formatRupiah(minBid)}.` };
    if (bid > p.balance) return { error: 'Saldo tidak cukup untuk tawaran itu.' };
    if (a.highBidder === playerId) return { error: 'Tawaranmu masih yang tertinggi.' };

    a.highBid = bid;
    a.highBidder = playerId;
    a.endsAt = Math.max(a.endsAt, Date.now() + 5_000); // anti-sniping
    this.addLog(`${p.name} menawar ${formatRupiah(bid)} untuk ${this.map.board[a.tileIndex].name}.`);
    return { ok: true };
  }

  settleAuction() {
    if (!this.auction) return;
    const a = this.auction;
    const tile = this.map.board[a.tileIndex];
    if (a.highBidder) {
      const winner = this.players.find((pl) => pl.id === a.highBidder);
      winner.balance -= a.highBid;
      this.properties[a.tileIndex] = { owner: winner.id, level: 0, mortgaged: false };
      this.addLog(`🔨 Lelang selesai: ${winner.name} memenangkan ${tile.name} seharga ${formatRupiah(a.highBid)}!`);
    } else {
      this.addLog(`🔨 Lelang ${tile.name} berakhir tanpa penawar — kembali ke Bank Galaksi.`);
    }
    this.auction = null;
    this.afterResolution(); // lanjutkan giliran si pelempar (dobel tetap dihormati)
  }

  // Guard bersama untuk aksi bebas di giliran sendiri (bangun/hipotek/tebus).
  turnGuard(playerId) {
    if (this.winner) return 'Permainan sudah selesai.';
    if (this.current.id !== playerId) return 'Bukan giliranmu.';
    if (this.phase === 'awaiting_buy') return 'Selesaikan pembelian dulu.';
    if (this.phase === 'auction') return 'Tunggu lelang selesai.';
    return null;
  }

  // Aturan rumah (disederhanakan): boleh membangun di petak mana pun yang
  // kamu miliki — tanpa syarat grup warna lengkap maupun bangun-merata.
  build(playerId, tileIndex) {
    const err = this.turnGuard(playerId);
    if (err) return { error: err };
    const p = this.players.find((pl) => pl.id === playerId);

    const tile = this.map.board[tileIndex];
    const owned = this.properties[tileIndex];
    if (!tile || tile.type !== TILE_TYPES.PROPERTY) return { error: 'Petak ini tidak bisa dibangun.' };
    if (!owned || owned.owner !== p.id) return { error: 'Kamu tidak memiliki properti ini.' };
    if (owned.mortgaged) return { error: 'Tebus hipoteknya dulu.' };
    if (owned.level >= 5) return { error: 'Sudah menjadi Koloni Antariksa (maksimal).' };

    const group = this.map.groups[tile.group];
    if (p.balance < group.houseCost) return { error: 'Saldo tidak cukup.' };

    p.balance -= group.houseCost;
    owned.level += 1;
    const label = owned.level === 5 ? 'Koloni Antariksa' : `Rover Riset ke-${owned.level}`;
    this.addLog(`${p.name} membangun ${label} di ${tile.name} (${formatRupiah(group.houseCost)}).`);
    return { ok: true };
  }

  // Hipotek: terima 1/2 harga beli; properti tidak menagih sewa sampai ditebus.
  mortgage(playerId, tileIndex) {
    const err = this.turnGuard(playerId);
    if (err) return { error: err };
    const p = this.players.find((pl) => pl.id === playerId);
    const tile = this.map.board[tileIndex];
    const owned = this.properties[tileIndex];
    if (!tile?.price || !owned || owned.owner !== p.id) return { error: 'Kamu tidak memiliki properti ini.' };
    if (owned.mortgaged) return { error: 'Properti ini sudah dihipotek.' };
    if (owned.level > 0) return { error: 'Jual bangunannya dulu.' };

    owned.mortgaged = true;
    const value = tile.price / 2;
    p.balance += value;
    this.addLog(`${p.name} menghipotek ${tile.name} ke Bank Galaksi — menerima ${formatRupiah(value)}.`);
    return { ok: true };
  }

  // Tebus hipotek: bayar nilai hipotek + bunga 10%.
  unmortgage(playerId, tileIndex) {
    const err = this.turnGuard(playerId);
    if (err) return { error: err };
    const p = this.players.find((pl) => pl.id === playerId);
    const tile = this.map.board[tileIndex];
    const owned = this.properties[tileIndex];
    if (!tile?.price || !owned || owned.owner !== p.id) return { error: 'Kamu tidak memiliki properti ini.' };
    if (!owned.mortgaged) return { error: 'Properti ini tidak sedang dihipotek.' };
    const cost = Math.round((tile.price / 2) * 1.1);
    if (p.balance < cost) return { error: `Butuh ${formatRupiah(cost)} untuk menebus.` };

    p.balance -= cost;
    owned.mortgaged = false;
    this.addLog(`${p.name} menebus hipotek ${tile.name} seharga ${formatRupiah(cost)}.`);
    return { ok: true };
  }

  payBail(playerId) {
    const err = this.guard(playerId, 'awaiting_roll');
    if (err) return { error: err };
    const p = this.current;
    if (!p.inJail) return { error: 'Kamu tidak di penjara.' };
    if (p.balance < this.map.bail) return { error: 'Saldo tidak cukup untuk jaminan.' };
    p.balance -= this.map.bail;
    p.inJail = false;
    p.jailTurns = 0;
    this.addLog(`${p.name} membayar jaminan ${formatRupiah(this.map.bail)} dan bebas dari Penjara Asteroid.`);
    return { ok: true };
  }

  useJailCard(playerId) {
    const err = this.guard(playerId, 'awaiting_roll');
    if (err) return { error: err };
    const p = this.current;
    if (!p.inJail) return { error: 'Kamu tidak di penjara.' };
    if (p.jailCards < 1) return { error: 'Tidak punya Kartu Bebas Penjara.' };
    p.jailCards -= 1;
    p.inJail = false;
    p.jailTurns = 0;
    this.addLog(`${p.name} memakai Kartu Bebas Penjara Asteroid.`);
    return { ok: true };
  }

  endTurn(playerId) {
    const err = this.guard(playerId, 'post_roll');
    if (err) return { error: err };
    this.nextTurn();
    return { ok: true };
  }

  removePlayer(playerId) {
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p || p.bankrupt || this.winner) return;
    this.addLog(`${p.name} meninggalkan permainan.`);
    this.declareBankrupt(p, null);
    if (!this.winner && this.current.id === playerId) {
      // giliran pemain yang keluar — lanjut ke pemain berikutnya
      this.phase = 'post_roll';
      this.nextTurn();
    }
  }

  // ---------- mekanika internal ----------

  guard(playerId, phase) {
    if (this.winner) return 'Permainan sudah selesai.';
    if (this.current.id !== playerId) return 'Bukan giliranmu.';
    if (this.phase !== phase) return 'Aksi tidak valid untuk fase saat ini.';
    return null;
  }

  resolveJailRoll(p, d1, d2, isDouble) {
    if (isDouble) {
      p.inJail = false;
      p.jailTurns = 0;
      this.doubles = 0; // bebas karena dobel tidak memberi lemparan ekstra
      this.addLog(`${p.name} melempar dobel (${d1}-${d2}) dan bebas dari Penjara Asteroid!`);
      this.moveBy(p, d1 + d2, { noExtraRoll: true });
      return;
    }
    p.jailTurns += 1;
    if (p.jailTurns >= 3) {
      this.addLog(`${p.name} gagal dobel 3x — wajib bayar jaminan ${formatRupiah(this.map.bail)}.`);
      const paid = this.pay(p, null, this.map.bail);
      if (!paid) return; // bangkrut saat bayar jaminan
      p.inJail = false;
      p.jailTurns = 0;
      this.moveBy(p, d1 + d2, { noExtraRoll: true });
    } else {
      this.addLog(`${p.name} gagal melempar dobel (${d1}-${d2}), tetap di Penjara Asteroid (percobaan ${p.jailTurns}/3).`);
      this.phase = 'post_roll';
    }
  }

  moveBy(p, steps, opts = {}) {
    const from = p.position;
    let to = (from + steps + this.map.size) % this.map.size;
    if (steps > 0 && to < from) {
      p.balance += this.map.salary;
      this.addLog(`${p.name} melewati Titik Peluncuran dan menerima gaji ${formatRupiah(this.map.salary)}.`);
    }
    p.position = to;
    this.resolveLanding(p, opts);
  }

  moveTo(p, pos, opts = {}) {
    if (pos !== p.position && pos <= p.position) {
      // melewati / mendarat di GO
      p.balance += this.map.salary;
      this.addLog(`${p.name} melewati Titik Peluncuran dan menerima gaji ${formatRupiah(this.map.salary)}.`);
    }
    p.position = pos;
    this.resolveLanding(p, opts);
  }

  resolveLanding(p, opts = {}) {
    const tile = this.map.board[p.position];
    this.addLog(`${p.name} mendarat di ${tile.name}.`);

    switch (tile.type) {
      case TILE_TYPES.PROPERTY:
      case TILE_TYPES.STATION:
      case TILE_TYPES.UTILITY: {
        const owned = this.properties[p.position];
        if (!owned) {
          if (p.balance >= tile.price) {
            this.phase = 'awaiting_buy';
            return;
          }
          // aturan klasik: tak mampu beli -> langsung dilelang
          this.addLog(`${p.name} tidak mampu membeli ${tile.name} (${formatRupiah(tile.price)}).`);
          this.startAuction(p.position);
          return;
        }
        if (owned.owner !== p.id) {
          if (owned.mortgaged) {
            this.addLog(`${tile.name} sedang dihipotek — bebas sewa.`);
            break;
          }
          const owner = this.players.find((pl) => pl.id === owned.owner);
          if (owner && !owner.bankrupt) {
            const rent = this.calcRent(p.position, owned, owner);
            this.addLog(`${tile.name} milik ${owner.name} — sewa ${formatRupiah(rent)}.`);
            this.pay(p, owner, rent);
          }
        }
        break;
      }
      case TILE_TYPES.TAX:
        this.addLog(`${p.name} membayar ${tile.name} sebesar ${formatRupiah(tile.amount)}.`);
        this.pay(p, null, tile.amount);
        break;
      case TILE_TYPES.WARP:
        this.drawCard(p, 'warp');
        return; // drawCard yang menentukan fase
      case TILE_TYPES.TRANSMISSION:
        this.drawCard(p, 'transmission');
        return;
      case TILE_TYPES.GO_TO_JAIL:
        this.sendToJail(p);
        return;
      default:
        break; // GO, Zona Netral, kunjungan penjara: tidak ada efek
    }
    this.afterResolution(opts);
  }

  afterResolution(opts = {}) {
    if (this.winner) return;
    if (this.current.bankrupt) {
      this.nextTurn();
      return;
    }
    if (this.lastDice?.isDouble && !opts.noExtraRoll && !this.current.inJail) {
      this.phase = 'awaiting_roll'; // lempar lagi karena dobel
      this.addLog(`${this.current.name} melempar dobel — dapat giliran lempar lagi!`);
    } else {
      this.phase = 'post_roll';
    }
  }

  calcRent(tileIndex, owned, owner) {
    const tile = this.map.board[tileIndex];
    if (tile.type === TILE_TYPES.STATION) {
      const count = this.map.stations.filter((t) => this.properties[t]?.owner === owner.id).length;
      return tile.rents[count - 1];
    }
    if (tile.type === TILE_TYPES.UTILITY) {
      const count = this.map.utilities.filter((t) => this.properties[t]?.owner === owner.id).length;
      const mult = tile.multipliers[count - 1] ?? tile.multipliers[0];
      return mult * (this.lastDice?.total ?? 7) * 50_000;
    }
    // properti biasa
    if (owned.level > 0) return tile.rents[owned.level];
    const group = this.map.groups[tile.group];
    const ownsAll = group.tiles.every((t) => this.properties[t]?.owner === owner.id);
    return ownsAll ? tile.rents[0] * 2 : tile.rents[0];
  }

  // Menarik kartu: TIDAK langsung dieksekusi — masuk fase awaiting_card
  // sampai pemain (atau bot) menekan JALANKAN. Semua klien melihat kartunya.
  drawCard(p, deckName) {
    const deck = deckName === 'warp' ? this.warpDeck : this.transDeck;
    const card = deck.shift();
    deck.push(card); // rotasi dek
    const label = this.map.deckLabels[deckName === 'warp' ? 'warp' : 'transmission'];
    this.pendingCard = { deck: deckName, text: card.text, effect: card.effect };
    this.phase = 'awaiting_card';
    this.addLog(`${p.name} menarik kartu ${label}: "${card.text}"`);
  }

  // Tombol JALANKAN — hanya penarik kartu (pemain giliran ini).
  ackCard(playerId) {
    if (this.winner) return { error: 'Permainan sudah selesai.' };
    if (this.phase !== 'awaiting_card' || !this.pendingCard) return { error: 'Tidak ada kartu yang menunggu.' };
    if (this.current.id !== playerId) return { error: 'Bukan giliranmu.' };
    const { deck, text, effect } = this.pendingCard;
    this.lastCard = { deck, text };
    this.pendingCard = null;
    this.applyCardEffect(this.current, effect);
    return { ok: true };
  }

  applyCardEffect(p, e) {
    switch (e.type) {
      case 'money':
        if (e.amount >= 0) {
          p.balance += e.amount;
        } else {
          this.pay(p, null, -e.amount);
        }
        break;
      case 'moveTo':
        if (e.bonus) {
          p.balance += e.bonus;
          this.addLog(`${p.name} menerima bonus ${formatRupiah(e.bonus)}!`);
        }
        this.moveTo(p, e.pos);
        return;
      case 'moveBy':
        p.position = (p.position + e.n + this.map.size) % this.map.size; // mundur tidak lewat GO
        this.resolveLanding(p);
        return;
      case 'jail':
        this.sendToJail(p);
        return;
      case 'jailCard':
        p.jailCards += 1;
        break;
      case 'repairs': {
        let cost = 0;
        for (const [, prop] of Object.entries(this.properties)) {
          if (prop.owner !== p.id) continue;
          if (prop.level === 5) cost += e.perColony;
          else cost += prop.level * e.perRover;
        }
        if (cost > 0) {
          this.addLog(`Biaya perbaikan armada ${p.name}: ${formatRupiah(cost)}.`);
          this.pay(p, null, cost);
        }
        break;
      }
      case 'collectFromAll':
        for (const other of this.players) {
          if (other.id === p.id || other.bankrupt) continue;
          this.pay(other, p, e.amount);
        }
        break;
      // "No Mercy": bayar (likuidasi otomatis bila perlu) atau masuk penjara.
      case 'payOrJail': {
        if (p.balance < e.amount) this.liquidate(p, e.amount);
        if (p.balance >= e.amount) {
          p.balance -= e.amount;
          this.addLog(`${p.name} sanggup membayar ${formatRupiah(e.amount)} — lolos dari penjara!`);
          break;
        }
        this.addLog(`${p.name} TIDAK sanggup membayar ${formatRupiah(e.amount)} — digelandang ke penjara!`);
        this.sendToJail(p);
        return;
      }
    }
    this.afterResolution();
  }

  sendToJail(p) {
    p.position = this.map.jailPosition;
    p.inJail = true;
    p.jailTurns = 0;
    this.doubles = 0;
    this.addLog(`${p.name} masuk Penjara Asteroid!`);
    this.phase = 'post_roll'; // dobel tidak berlaku saat masuk penjara
  }

  // Transfer uang. to = null berarti ke Bank Galaksi. Return false jika payer bangkrut.
  pay(from, to, amount) {
    if (from.balance < amount) {
      this.liquidate(from, amount);
    }
    if (from.balance < amount) {
      // tetap tidak cukup — bangkrut, serahkan semua yang tersisa
      const remaining = from.balance;
      from.balance = 0;
      if (to) to.balance += remaining;
      this.declareBankrupt(from, to);
      return false;
    }
    from.balance -= amount;
    if (to) to.balance += amount;
    return true;
  }

  // Likuidasi otomatis: jual bangunan (setengah harga), lalu hipotek properti,
  // sampai utang tertutup. Dipakai manusia & bot sebelum dinyatakan bangkrut.
  liquidate(p, needed) {
    const ownedTiles = Object.entries(this.properties)
      .filter(([, prop]) => prop.owner === p.id && prop.level > 0)
      .sort((a, b) => b[1].level - a[1].level);
    for (const [idx, prop] of ownedTiles) {
      const group = this.map.groups[this.map.board[idx].group];
      while (prop.level > 0 && p.balance < needed) {
        prop.level -= 1;
        p.balance += group.houseCost / 2;
        this.addLog(`${p.name} menjual bangunan di ${this.map.board[idx].name} (${formatRupiah(group.houseCost / 2)}).`);
      }
      if (p.balance >= needed) return;
    }
    for (const [idx, prop] of Object.entries(this.properties)) {
      if (p.balance >= needed) return;
      if (prop.owner !== p.id || prop.mortgaged || prop.level > 0) continue;
      prop.mortgaged = true;
      p.balance += this.map.board[idx].price / 2;
      this.addLog(`${p.name} terpaksa menghipotek ${this.map.board[idx].name} (${formatRupiah(this.map.board[idx].price / 2)}).`);
    }
  }

  declareBankrupt(p, creditor) {
    p.bankrupt = true;
    p.inJail = false;
    for (const [idx, prop] of Object.entries(this.properties)) {
      if (prop.owner !== p.id) continue;
      if (creditor) {
        prop.owner = creditor.id;
        prop.level = 0; // bangunan kembali ke bank
      } else {
        delete this.properties[idx];
      }
    }
    this.addLog(
      creditor
        ? `${p.name} BANGKRUT! Seluruh asetnya diserahkan ke ${creditor.name}.`
        : `${p.name} BANGKRUT! Asetnya kembali ke Bank Galaksi.`
    );
    const alive = this.players.filter((pl) => !pl.bankrupt);
    if (alive.length === 1) {
      this.winner = alive[0].id;
      this.phase = 'finished';
      this.addLog(`🏆 ${alive[0].name} MENGUASAI GALAKSI! Permainan selesai.`);
    }
  }

  // Waktu habis: hitung kekayaan bersih semua pemain hidup — terkaya menang.
  endByTime() {
    if (this.winner) return;
    const worth = (p) =>
      p.balance +
      Object.entries(this.properties).reduce((sum, [idx, v]) => {
        if (v.owner !== p.id) return sum;
        const tile = this.map.board[idx];
        const group = tile.group ? this.map.groups[tile.group] : null;
        return sum + (v.mortgaged ? tile.price / 2 : tile.price) + (group ? v.level * group.houseCost : 0);
      }, 0);

    const ranked = this.players.filter((p) => !p.bankrupt).sort((a, b) => worth(b) - worth(a));
    this.addLog('⏱ WAKTU HABIS! Kekayaan bersih dihitung:');
    for (const p of ranked) this.addLog(`• ${p.name}: ${formatRupiah(worth(p))}`);
    this.winner = ranked[0].id;
    this.phase = 'finished';
    this.auction = null;
    this.trade = null;
    this.pendingCard = null;
    this.addLog(`🏆 ${ranked[0].name} MENGUASAI GALAKSI dengan kekayaan terbanyak!`);
  }

  nextTurn() {
    if (this.winner) return;
    this.doubles = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
    } while (this.current.bankrupt);
    this.phase = 'awaiting_roll';
    this.lastDice = null;
    this.lastCard = null;
    this.pendingCard = null;
    this.addLog(`Giliran ${this.current.name}.`);
  }

  publicState() {
    return {
      mapId: this.mapId,
      players: this.players,
      properties: this.properties,
      turnIndex: this.turnIndex,
      currentPlayerId: this.current?.id ?? null,
      phase: this.phase,
      lastDice: this.lastDice,
      lastCard: this.lastCard,
      pendingCard: this.pendingCard,
      winner: this.winner,
      timeRemainingMs: Math.max(0, this.endsAt - Date.now()),
      auction: this.auction
        ? { ...this.auction, remainingMs: Math.max(0, this.auction.endsAt - Date.now()) }
        : null,
      trade: this.trade
        ? { ...this.trade, remainingMs: Math.max(0, this.trade.endsAt - Date.now()) }
        : null,
      log: this.log.slice(-30),
    };
  }
}

