// Registri peta permainan. Setiap peta mendefinisikan papannya sendiri:
// jumlah petak (harus kelipatan 4), grup warna, harga, gaji, jaminan,
// target kartu, dan tema visual 3D. Mesin & renderer tidak boleh
// mengasumsikan apa pun di luar kontrak ini.

export const TILE_TYPES = {
  GO: 'go',
  PROPERTY: 'property',
  STATION: 'station',
  UTILITY: 'utility',
  TAX: 'tax',
  WARP: 'warp', // Chance
  TRANSMISSION: 'transmission', // Community Chest
  JAIL: 'jail',
  GO_TO_JAIL: 'goToJail',
  FREE: 'free',
};

const M = 50_000;

// ---------------------------------------------------------------------------
// PETA 1: TATA SURYA — papan klasik 40 petak (identik dengan papan awal).
// ---------------------------------------------------------------------------

const SOLAR_GROUPS = {
  brown: { color: '#92600d', houseCost: 50 * M, tiles: [1, 3] },
  lightblue: { color: '#7dd3fc', houseCost: 50 * M, tiles: [6, 8, 9] },
  pink: { color: '#f472b6', houseCost: 100 * M, tiles: [11, 13, 14] },
  orange: { color: '#fb923c', houseCost: 100 * M, tiles: [16, 18, 19] },
  red: { color: '#ef4444', houseCost: 150 * M, tiles: [21, 23, 24] },
  yellow: { color: '#facc15', houseCost: 150 * M, tiles: [26, 27, 29] },
  green: { color: '#4ade80', houseCost: 200 * M, tiles: [31, 32, 34] },
  darkblue: { color: '#6366f1', houseCost: 200 * M, tiles: [37, 39] },
};

const prop = (name, group, price, rents) => ({
  type: TILE_TYPES.PROPERTY,
  name,
  group,
  price: price * M,
  rents: rents.map((r) => r * M),
});
const station = (name, price = 200) => ({
  type: TILE_TYPES.STATION,
  name,
  price: price * M,
  rents: [25 * M, 50 * M, 100 * M, 200 * M],
});
const utility = (name, price = 150, multipliers = [4, 10]) => ({
  type: TILE_TYPES.UTILITY,
  name,
  price: price * M,
  multipliers,
});

const SOLAR_BOARD = [
  { type: TILE_TYPES.GO, name: 'Titik Peluncuran' }, // 0
  prop('Bulan', 'brown', 60, [2, 10, 30, 90, 160, 250]),
  { type: TILE_TYPES.TRANSMISSION, name: 'Transmisi Galaksi' },
  prop('Mars', 'brown', 60, [4, 20, 60, 180, 320, 450]),
  { type: TILE_TYPES.TAX, name: 'Pajak Galaksi', amount: 200 * M },
  station('Stasiun Orbit Alpha'),
  prop('Merkurius', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  { type: TILE_TYPES.WARP, name: 'Warp Drive' },
  prop('Venus', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  prop('Ceres', 'lightblue', 120, [8, 40, 100, 300, 450, 600]),
  { type: TILE_TYPES.JAIL, name: 'Penjara Asteroid' }, // 10
  prop('Europa', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  utility('Pembangkit Surya'),
  prop('Ganymede', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  prop('Titan', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  station('Stasiun Orbit Beta'),
  prop('Io', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  { type: TILE_TYPES.TRANSMISSION, name: 'Transmisi Galaksi' },
  prop('Callisto', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  prop('Enceladus', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
  { type: TILE_TYPES.FREE, name: 'Zona Netral' }, // 20
  prop('Proxima Centauri', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  { type: TILE_TYPES.WARP, name: 'Warp Drive' },
  prop('Alpha Centauri', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  prop('Sirius', 'red', 240, [20, 100, 300, 750, 925, 1100]),
  station('Stasiun Orbit Gamma'),
  prop('Vega', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  prop('Rigel', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility('Stasiun Air Es'),
  prop('Betelgeuse', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: TILE_TYPES.GO_TO_JAIL, name: 'Tertangkap Patroli' }, // 30
  prop('Galaksi Andromeda', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  prop('Galaksi Sombrero', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: TILE_TYPES.TRANSMISSION, name: 'Transmisi Galaksi' },
  prop('Galaksi Whirlpool', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
  station('Stasiun Orbit Delta'),
  { type: TILE_TYPES.WARP, name: 'Warp Drive' },
  prop('Nebula Orion', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: TILE_TYPES.TAX, name: 'Pajak Mewah', amount: 100 * M },
  prop('Lubang Hitam Sagitarius A*', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000]), // 39
];

// ---------------------------------------------------------------------------
// PETA 2: GALAKSI ALIEN — 44 petak, 9 grup warna, ekonomi lebih mahal.
// ---------------------------------------------------------------------------

// Kurva sewa dibangkitkan dari harga (rasio meniru tabel klasik).
function genRents(priceUnits) {
  const r = Math.max(2, Math.round(priceUnits * 0.055));
  return [r, r * 5, r * 15, r * 45, r * 62, r * 80];
}
const aprop = (name, group, price) => prop(name, group, price, genRents(price));

const ALIEN_GROUPS = {
  spora: { color: '#a3e635', houseCost: 60 * M, tiles: [1, 3] },
  asam: { color: '#22c55e', houseCost: 60 * M, tiles: [6, 8, 9] },
  nebula: { color: '#2dd4bf', houseCost: 110 * M, tiles: [10, 12, 14] },
  pengintai: { color: '#38bdf8', houseCost: 110 * M, tiles: [15, 17, 19] },
  lautan: { color: '#818cf8', houseCost: 160 * M, tiles: [20, 21, 23] },
  sarang: { color: '#c084fc', houseCost: 160 * M, tiles: [24, 26, 28] },
  dimensi: { color: '#e879f9', houseCost: 210 * M, tiles: [29, 31, 32] },
  overlord: { color: '#fb7185', houseCost: 210 * M, tiles: [34, 35, 37] },
  singularitas: { color: '#f1f5f9', houseCost: 260 * M, tiles: [39, 41, 43] },
};

const ALIEN_BOARD = [
  { type: TILE_TYPES.GO, name: 'Gerbang Dimensi' }, // 0
  aprop('Koloni Spora', 'spora', 80),
  { type: TILE_TYPES.TRANSMISSION, name: 'Transmisi Hive' },
  aprop('Rawa Xenomorph', 'spora', 90),
  { type: TILE_TYPES.TAX, name: 'Pajak Xeno', amount: 240 * M },
  station('Pos Terdepan Alpha', 220),
  aprop('Kawah Asam', 'asam', 130),
  { type: TILE_TYPES.WARP, name: 'Lompatan Warp' },
  aprop('Lembah Plasma', 'asam', 130),
  aprop('Padang Kristal', 'asam', 150),
  aprop('Nebula Ular', 'nebula', 180), // 10
  { type: TILE_TYPES.JAIL, name: 'Karantina Xeno' }, // 11
  aprop('Nebula Kepiting', 'nebula', 180),
  utility('Reaktor Antimateri', 170, [5, 12]),
  aprop('Nebula Racun', 'nebula', 200),
  aprop('Pos Pengintai Zeta', 'pengintai', 230), // 15
  station('Pos Terdepan Beta', 220),
  aprop('Kota Bawah Gorn', 'pengintai', 230),
  { type: TILE_TYPES.TRANSMISSION, name: 'Transmisi Hive' },
  aprop("Kuil K'tharr", 'pengintai', 250),
  aprop('Lautan Metana', 'lautan', 280), // 20
  aprop('Gletser Hidup', 'lautan', 280),
  { type: TILE_TYPES.FREE, name: 'Sarang Hive Netral' }, // 22
  aprop('Hutan Tentakel', 'lautan', 300),
  aprop('Menara Sang Ratu', 'sarang', 330),
  { type: TILE_TYPES.WARP, name: 'Lompatan Warp' },
  aprop('Ladang Telur', 'sarang', 330),
  station('Pos Terdepan Gamma', 220), // 27
  aprop('Kubah Feromon', 'sarang', 350),
  aprop('Lubang Hitam Kembar', 'dimensi', 380),
  utility('Sumur Gravitasi', 170, [5, 12]), // 30
  aprop('Pusaran Antimateri', 'dimensi', 380),
  aprop('Celah Dimensi', 'dimensi', 400),
  { type: TILE_TYPES.GO_TO_JAIL, name: 'Terdeteksi Hive!' }, // 33
  aprop('Istana Overlord', 'overlord', 430),
  aprop('Benteng Zorg', 'overlord', 430),
  { type: TILE_TYPES.TRANSMISSION, name: 'Transmisi Hive' },
  aprop('Tahta Hive', 'overlord', 460),
  station('Pos Terdepan Delta', 220), // 38
  aprop('Inti Galaksi Xeno', 'singularitas', 500),
  { type: TILE_TYPES.WARP, name: 'Lompatan Warp' }, // 40
  aprop('Mahkota Semesta', 'singularitas', 540),
  { type: TILE_TYPES.TAX, name: 'Pajak Gerbang', amount: 120 * M },
  aprop('Singularitas Ibu', 'singularitas', 600), // 43 — Rp 30.000.000
];

// ---------------------------------------------------------------------------
// PETA CLOUD CITY KLASIK — re-skin Monopoli klasik di atas awan.
// Bar warna klasik, kertas hijau, token logam (topi/mobil/bidal/sepatu).
// ---------------------------------------------------------------------------

const CLOUDCITY_GROUPS = {
  coklat: { color: '#955436', houseCost: 50 * M, tiles: [1, 3] },
  birumuda: { color: '#aae0fa', houseCost: 50 * M, tiles: [6, 8, 9] },
  pink: { color: '#d93a96', houseCost: 100 * M, tiles: [11, 13, 14] },
  oranye: { color: '#f7941d', houseCost: 100 * M, tiles: [16, 18, 19] },
  merah: { color: '#ed1b24', houseCost: 150 * M, tiles: [21, 23, 24] },
  kuning: { color: '#fef200', houseCost: 150 * M, tiles: [26, 27, 29] },
  hijau: { color: '#1fb25a', houseCost: 200 * M, tiles: [31, 32, 34] },
  birutua: { color: '#0072bb', houseCost: 200 * M, tiles: [37, 39] },
};

const CLOUDCITY_BOARD = [
  { type: TILE_TYPES.GO, name: 'MULAI' }, // 0
  prop('Awan Pertama Ave', 'coklat', 60, [2, 10, 30, 90, 160, 250]),
  { type: TILE_TYPES.TRANSMISSION, name: 'Galaksi Komunitas' },
  prop('Awan Kedua Ave', 'coklat', 60, [4, 20, 60, 180, 320, 450]),
  { type: TILE_TYPES.TAX, name: 'Pajak Penghasilan', amount: 200 * M },
  station('Stasiun Kereta Awan Utara'),
  prop('Jalan Zephyr Timur', 'birumuda', 100, [6, 30, 90, 270, 400, 550]),
  { type: TILE_TYPES.WARP, name: 'Lompatan Zephyr' },
  prop('Gang Cumulus', 'birumuda', 100, [6, 30, 90, 270, 400, 550]),
  prop('Bulevar Cirrus', 'birumuda', 120, [8, 40, 100, 300, 450, 600]),
  { type: TILE_TYPES.JAIL, name: 'Penjara Awan' }, // 10
  prop('Taman Nimbus', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  utility('PLN Petir'),
  prop('Jalan Halilintar', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  prop('Alun-alun Embun', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  station('Stasiun Kereta Awan Timur'),
  prop('Jalan Layang-Layang', 'oranye', 180, [14, 70, 200, 550, 750, 950]),
  { type: TILE_TYPES.TRANSMISSION, name: 'Galaksi Komunitas' },
  prop('Lorong Balon Udara', 'oranye', 180, [14, 70, 200, 550, 750, 950]),
  prop('Jalan Kincir Angin', 'oranye', 200, [16, 80, 220, 600, 800, 1000]),
  { type: TILE_TYPES.FREE, name: 'Parkir Bebas Awan' }, // 20
  prop('Pelabuhan Zephyr', 'merah', 220, [18, 90, 250, 700, 875, 1050]),
  { type: TILE_TYPES.WARP, name: 'Lompatan Zephyr' },
  prop('Dermaga Zeppelin', 'merah', 220, [18, 90, 250, 700, 875, 1050]),
  prop('Bandar Udara Awan', 'merah', 240, [20, 100, 300, 750, 925, 1100]),
  station('Stasiun Kereta Awan Selatan'),
  prop('Menara Udara', 'kuning', 260, [22, 110, 330, 800, 975, 1150]),
  prop('Menara Mercusuar Langit', 'kuning', 260, [22, 110, 330, 800, 975, 1150]),
  utility('PAM Hujan'),
  prop('Kubah Surya', 'kuning', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: TILE_TYPES.GO_TO_JAIL, name: 'Masuk Penjara!' }, // 30
  prop('Kubah Stratosfer', 'hijau', 300, [26, 130, 390, 900, 1100, 1275]),
  prop('Istana Cakrawala', 'hijau', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: TILE_TYPES.TRANSMISSION, name: 'Galaksi Komunitas' },
  prop('Puri Pelangi', 'hijau', 320, [28, 150, 450, 1000, 1200, 1400]),
  station('Stasiun Kereta Awan Barat'),
  { type: TILE_TYPES.WARP, name: 'Lompatan Zephyr' },
  prop('Bukit Awan Mahkota', 'birutua', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: TILE_TYPES.TAX, name: 'Pajak Super Kaya', amount: 100 * M },
  prop('Puncak Everest Langit', 'birutua', 400, [50, 200, 600, 1400, 1700, 2000]), // 39
];

// ---------------------------------------------------------------------------
// Registri
// ---------------------------------------------------------------------------

export const MAPS = {
  solar: {
    id: 'solar',
    name: 'Tata Surya',
    emoji: '🪐',
    description: 'Papan klasik 40 petak: dari Bulan sampai Lubang Hitam Sagitarius A*. Ekonomi standar, cocok untuk semua pemain.',
    size: SOLAR_BOARD.length, // 40
    board: SOLAR_BOARD,
    groups: SOLAR_GROUPS,
    salary: 200 * M, // Rp 10jt saat melewati GO
    bail: 50 * M, // Rp 2,5jt
    jailPosition: 10,
    stations: [5, 15, 25, 35],
    utilities: [12, 28],
    // acuan posisi untuk dek kartu (teks kartu memakai nama petaknya)
    cardTargets: { premium: 39, advance: 21, station: 5 },
    // indeks standar Monopoly: Chance 7/22/36, Community Chest 2/17/33
    cardTiles: { warp: [7, 22, 36], transmission: [2, 17, 33] },
    deckLabels: { warp: 'WARP DRIVE', transmission: 'TRANSMISI GALAKSI' },
    theme: {
      environment: 'space', // space = bintang+nebula | daylight = langit siang+awan
      deckColors: { warp: '#fb923c', transmission: '#38bdf8' }, // oranye & biru neon
      background: '#05060f',
      fog: '#05060f',
      edgeGlow: '#22d3ee',
      titlePrimary: '#22d3ee',
      titleSecondary: '#a855f7',
      tileBase: '#12172e',
      plate: '#0a0d1f',
      centerPlate: '#070a18',
      starSaturation: 0.6,
      nebulaColors: ['rgba(168,85,247,1)', 'rgba(34,211,238,1)', 'rgba(236,72,153,1)', 'rgba(99,102,241,1)'],
      lightA: '#a855f7',
      lightB: '#22d3ee',
    },
  },
  alien: {
    id: 'alien',
    name: 'Galaksi Alien',
    emoji: '👽',
    description: 'Wilayah Hive 44 petak dengan 9 grup warna: koloni spora, nebula beracun, sampai Singularitas Ibu seharga Rp 30jt. Ekonomi tinggi — gaji Rp 12jt.',
    size: ALIEN_BOARD.length, // 44
    board: ALIEN_BOARD,
    groups: ALIEN_GROUPS,
    salary: 240 * M, // Rp 12jt
    bail: 60 * M, // Rp 3jt
    jailPosition: 11,
    stations: [5, 16, 27, 38],
    utilities: [13, 30],
    cardTargets: { premium: 43, advance: 20, station: 5 },
    cardTiles: { warp: [7, 25, 40], transmission: [2, 18, 36] },
    deckLabels: { warp: 'LOMPATAN WARP', transmission: 'TRANSMISI HIVE' },
    theme: {
      environment: 'space',
      deckColors: { warp: '#e879f9', transmission: '#4ade80' }, // fuchsia & hijau neon
      background: '#03080a',
      fog: '#03080a',
      edgeGlow: '#4ade80',
      titlePrimary: '#4ade80',
      titleSecondary: '#d946ef',
      tileBase: '#0d1f16',
      plate: '#071009',
      centerPlate: '#05100a',
      starSaturation: 0.95,
      nebulaColors: ['rgba(34,197,94,1)', 'rgba(132,204,22,1)', 'rgba(139,92,246,1)', 'rgba(217,70,239,1)'],
      lightA: '#22c55e',
      lightB: '#d946ef',
    },
  },
};

MAPS.cloudcity = {
  id: 'cloudcity',
  name: 'Cloud City Klasik',
  emoji: '🎩',
  description: 'Re-skin Monopoli klasik di atas awan: bar warna asli, papan kertas hijau, token logam (topi, mobil, bidal, sepatu), Stasiun Kereta Awan, PLN Petir & PAM Hujan.',
  size: CLOUDCITY_BOARD.length,
  board: CLOUDCITY_BOARD,
  groups: CLOUDCITY_GROUPS,
  salary: 200 * M,
  bail: 50 * M,
  jailPosition: 10,
  stations: [5, 15, 25, 35],
  utilities: [12, 28],
  cardTargets: { premium: 39, advance: 21, station: 5 },
  cardTiles: { warp: [7, 22, 36], transmission: [2, 17, 33] },
  deckLabels: { warp: 'LOMPATAN ZEPHYR', transmission: 'GALAKSI KOMUNITAS' },
  // Set token khusus peta: slot internal (rocket/astronaut/satellite/ufo)
  // dipetakan ke model & label token logam klasik.
  tokenSet: {
    rocket: { model: 'tophat', label: 'Topi Tinggi', icon: '🎩' },
    astronaut: { model: 'car', label: 'Mobil Balap', icon: '🚗' },
    satellite: { model: 'thimble', label: 'Bidal', icon: '🥈' },
    ufo: { model: 'shoe', label: 'Sepatu', icon: '👞' },
  },
  centerText: { title: 'MONOPOLI CLOUD CITY', subtitle: 'GALAKSI ATMOSFER' },
  theme: {
    environment: 'daylight',
    deckColors: { warp: '#f59e0b', transmission: '#3b82f6' }, // oranye Chance & biru CC klasik
    background: '#bfdbfe',
    fog: '#dbeafe',
    edgeGlow: '#93c5fd',
    titlePrimary: '#d32f2f', // merah logo MONOPOLY klasik
    titleSecondary: '#1565c0',
    tileBase: '#d6e8d6', // kertas bernuansa hijau klasik
    plate: '#dbeafe', // kristal/kaca
    centerPlate: '#cfe4cf',
    starSaturation: 0,
    nebulaColors: ['rgba(255,255,255,1)', 'rgba(186,230,253,1)', 'rgba(207,228,207,1)'],
    lightA: '#bae6fd',
    lightB: '#fde68a',
    sunPosition: [40, 60, 25],
    skyColor: '#bae6fd',
    groundColor: '#f8fafc',
    glass: true,
    tileText: '#1f2937', // hitam pekat khas cetakan Monopoli
    tileTextOutline: '#f8fafc',
    tileHighlight: '#93c5fd',
    platform: 'crystal', // platform kristal berpilar + menara sudut menyala
    paper: true, // tekstur kertas hijau klasik di petak
    diceStyle: { body: '#f4f7fb', pip: '#1d4ed8', border: 'rgba(29,78,216,0.4)' }, // dadu putih-biru
    trailColor: '#e0f2fe', // jejak dadu seperti uap awan
  },
};

// Tampilan token: peta boleh memetakan slot token ke model/label/ikon lain
// (mis. token logam klasik di Cloud City). Default = tampilan antariksa.
const DEFAULT_TOKEN_SET = {
  rocket: { model: 'rocket', label: 'Roket', icon: '🚀' },
  astronaut: { model: 'astronaut', label: 'Astronot', icon: '🧑‍🚀' },
  satellite: { model: 'satellite', label: 'Satelit', icon: '🛰️' },
  ufo: { model: 'ufo', label: 'UFO', icon: '🛸' },
};

export function getTokenDisplay(map, tokenId) {
  return map?.tokenSet?.[tokenId] ?? DEFAULT_TOKEN_SET[tokenId] ?? DEFAULT_TOKEN_SET.rocket;
}

export const DEFAULT_MAP_ID = 'solar';
export const MAP_LIST = Object.values(MAPS).map(({ id, name, emoji, description, size, salary, theme }) => ({
  id,
  name,
  emoji,
  description,
  size,
  salary,
  accent: theme.titlePrimary,
}));

export function getMap(id) {
  return MAPS[id] ?? MAPS[DEFAULT_MAP_ID];
}
