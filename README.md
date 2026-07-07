# 🚀 Monopoli Antariksa (Space Monopoly)

3D space-themed Monopoly — React Three Fiber frontend, Node.js + Socket.io realtime backend.
Currency: Indonesian Rupiah (Rp). "Chance" → **Warp Drive**, "Community Chest" → **Galactic Transmission**,
houses → **Research Rovers**, hotels → **Space Colonies**.

## Struktur Proyek

```
space-monopoly/
├── shared/               # Konstanta bersama (event socket, aturan lobby, format Rupiah)
│   └── constants.js
├── server/               # Backend otoritatif (anti-cheat: semua state game di server)
│   └── src/
│       ├── index.js      # Express + Socket.io bootstrap
│       └── roomManager.js# Lobby 2-4 pemain, room code, host migration
└── client/               # Frontend React + R3F
    └── src/
        ├── network/socket.js    # Koneksi Socket.io + helper ack-based
        ├── store/useGameStore.js# State global (zustand)
        └── components/          # Home, Lobby (TailwindCSS + Framer Motion)
```

## Menjalankan (Development)

```bash
# sekali saja: install semua dependency
npm run install:all

# jalankan server (port 3001) + client (port 5173) bersamaan
npm run dev
```

Buka `http://localhost:5173` di beberapa tab/browser untuk mencoba multiplayer.

Untuk menguji tanpa pemain kedua, jalankan bot otomatis:

```bash
node client/bot-test.mjs <KODE_ROOM> "Nama Bot"
```

## Roadmap Fase

- [x] **Phase 1** — Struktur proyek + komunikasi WebSocket (lobby 2-4 pemain)
- [x] **Phase 2** — Logika game state (giliran, properti, uang Rupiah, sewa, penjara, bangkrut)
- [x] **Phase 3** — Render papan 3D + overlay UI (R3F: papan melayang, token 3D, modal holografik)
- [x] **Phase 4** — Fisika dadu 3D dramatis (Rapier + jejak cahaya + kamera sinematik) + token melompat busur dengan partikel
- [x] **Phase 5** — Polish grafis (nebula, bloom, komet, denyut pendaratan) + uji sinkronisasi multiplayer 4 pemain
- [x] **Phase 6** — Fitur lanjutan:
  - Bot AI (host menambah/menghapus di lobby; bot melempar, membeli, menawar lelang, menghipotek saat terdesak)
  - Undangan QR code (`?room=KODE`, siap dipindai HP di LAN)
  - Persistensi Redis + rejoin sesi (masa tenggang 3 menit, resume otomatis)
  - Hipotek properti (½ harga; tebus +10%; bebas sewa; penanda merah di papan)
  - Lelang real-time (countdown anti-sniping; bot menawar s.d. 90% harga)
  - Trading antar pemain (Terima eksplisit + validasi ulang server; bot menolak)
  - Audio prosedural Web Audio API (SFX dadu/roket/uang/lelang + ambience; tombol 🔊/🔇)
- [x] **Peta Ganda** — konfigurasi di `shared/mapConfigs.js`:
  - 🪐 Tata Surya (40 petak, klasik), 👽 Galaksi Alien (44 petak, 9 grup, gaji Rp 12jt),
  - 🎩 Cloud City Klasik — re-skin Monopoli asli di atas awan (siang cerah: drei Sky + Cloud,
    matahari berbayangan lembut, hemisphere light): bar warna & logo merah klasik
    dicetak di kertas hijau bertekstur, slot kartu "?" oranye/biru, platform kristal berpilar
    awan dengan menara menyala, **token logam klasik per-peta** (topi/mobil/bidal/sepatu via
    `tokenSet` + `getTokenDisplay`), dadu putih-biru berjejak uap, baki pajangan token
  - Host memilih peta di lobby (tersinkron live); mesin, kartu, & UI sepenuhnya map-aware
  - Render 3D dinamis: ukuran papan, tema warna, nebula, cahaya, & judul per peta
  - Peta baru = tambah satu entri konfigurasi (papan divalidasi struktural otomatis)
- [x] **Sistem Kartu Lengkap** — dek 3D di pusat papan (mengambang + aura), kartu terbang
  ke kamera saat ditarik, modal holografik dengan tombol ⚡ JALANKAN (fase `awaiting_card`,
  efek dieksekusi server setelah konfirmasi; bot otomatis), kartu "No Mercy"
  (Serangan Asteroid bayar-atau-penjara, Retas Bank curi Rp 15jt/pemain, gaji ganda),
  tersinkron ke semua klien.

## Catatan Produksi

- Set `NODE_ENV=production` di server untuk menonaktifkan hook dadu debug (`debugDice`).
- Set `CLIENT_ORIGIN` (server) dan `VITE_SERVER_URL` (client) sesuai domain deploy.
- Room disimpan di memori — gunakan Redis/DB bila butuh persistensi lintas restart.
- Belum diimplementasikan (pengembangan lanjutan): trading antar pemain, hipotek, lelang properti.
