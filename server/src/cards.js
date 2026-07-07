// Dek kartu dibangkitkan dari konfigurasi peta: teks memakai nama petak
// peta tersebut dan target posisi dari map.cardTargets.
import { formatRupiah } from '../../shared/constants.js';

const M = 50_000;

export function shuffle(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function buildDecks(map) {
  const B = map.board;
  const t = map.cardTargets;
  const go = B[0].name;
  const jail = B[map.jailPosition].name;

  const warp = [
    { text: `Warp langsung ke ${go}! Terima gaji ${formatRupiah(map.salary)}.`, effect: { type: 'moveTo', pos: 0 } },
    { text: `Warp ke ${B[t.premium].name}.`, effect: { type: 'moveTo', pos: t.premium } },
    { text: `Warp ke ${B[t.advance].name}. Jika melewati ${go}, terima gaji.`, effect: { type: 'moveTo', pos: t.advance } },
    { text: `Warp ke ${B[t.station].name}. Jika melewati ${go}, terima gaji.`, effect: { type: 'moveTo', pos: t.station } },
    { text: 'Anomali gravitasi! Mundur 3 petak.', effect: { type: 'moveBy', n: -3 } },
    { text: `Tertangkap patroli! Masuk ${jail} tanpa melewati ${go}.`, effect: { type: 'jail' } },
    { text: `Kartu Bebas ${jail} — simpan untuk dipakai nanti.`, effect: { type: 'jailCard' } },
    { text: 'Bayar biaya bahan bakar antimateri Rp 750.000.', effect: { type: 'money', amount: -15 * M } },
    { text: 'Bank Galaksi membayar dividen Rp 2.500.000.', effect: { type: 'money', amount: 50 * M } },
    { text: 'Perbaikan armada: bayar Rp 1.250.000 per Rover Riset dan Rp 5.000.000 per Koloni Antariksa.', effect: { type: 'repairs', perRover: 25 * M, perColony: 100 * M } },
    // --- kartu "No Mercy" ---
    { text: `🌠 SERANGAN ASTEROID! Bayar perbaikan armada ${formatRupiah(1000 * M)} atau masuk ${jail}!`, effect: { type: 'payOrJail', amount: 1000 * M } },
    { text: 'Denda ngebut di jalur hyperspace: bayar Rp 7.500.000.', effect: { type: 'money', amount: -150 * M } },
    { text: `🕳️ Distorsi ruang-waktu melontarkanmu ke ${go} — terima gaji GANDA (${formatRupiah(map.salary * 2)})!`, effect: { type: 'moveTo', pos: 0, bonus: map.salary } },
  ];

  const transmission = [
    { text: 'Kesalahan sistem Bank Galaksi menguntungkanmu. Terima Rp 10.000.000.', effect: { type: 'money', amount: 200 * M } },
    { text: 'Biaya perawatan medis luar angkasa. Bayar Rp 2.500.000.', effect: { type: 'money', amount: -50 * M } },
    { text: 'Menerima warisan dari kapten legendaris. Terima Rp 5.000.000.', effect: { type: 'money', amount: 100 * M } },
    { text: 'Premi asuransi armada jatuh tempo. Bayar Rp 2.500.000.', effect: { type: 'money', amount: -50 * M } },
    { text: `Dipanggil pulang ke ${go}. Terima gaji ${formatRupiah(map.salary)}.`, effect: { type: 'moveTo', pos: 0 } },
    { text: `Terbukti menyelundupkan mineral! Masuk ${jail}.`, effect: { type: 'jail' } },
    { text: `Kartu Bebas ${jail} — simpan untuk dipakai nanti.`, effect: { type: 'jailCard' } },
    { text: 'Memenangkan kontes desain koloni. Terima Rp 1.000.000.', effect: { type: 'money', amount: 20 * M } },
    { text: 'Dana riset antariksa cair. Terima Rp 2.000.000.', effect: { type: 'money', amount: 40 * M } },
    { text: 'Hari jadi koloni! Setiap pemain memberimu Rp 2.500.000.', effect: { type: 'collectFromAll', amount: 50 * M } },
    // --- kartu "No Mercy" ---
    { text: `💀 RETAS BANK SENTRAL GALAKSI: curi ${formatRupiah(300 * M)} dari SETIAP pemain!`, effect: { type: 'collectFromAll', amount: 300 * M } },
    { text: `🔥 Badai matahari menghanguskan kargomu: bayar ${formatRupiah(500 * M)} atau masuk ${jail}!`, effect: { type: 'payOrJail', amount: 500 * M } },
    { text: 'Audit pajak galaksi mendadak: bayar Rp 5.000.000.', effect: { type: 'money', amount: -100 * M } },
  ];

  return { warp: shuffle(warp), transmission: shuffle(transmission) };
}
