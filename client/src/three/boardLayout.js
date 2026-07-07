// Pemetaan indeks petak ke koordinat dunia 3D — generik terhadap ukuran papan
// (kelipatan 4). GO di pojok kanan-bawah, bergerak berlawanan arah jarum jam.
export const TILE_SIZE = 1;

export function gridPos(idx, size = 40) {
  const s = size / 4; // panjang satu sisi (petak per sisi, tanpa pojok kedua)
  if (idx <= s) return { row: s + 1, col: s + 1 - idx };
  if (idx <= 2 * s) return { row: 2 * s + 1 - idx, col: 1 };
  if (idx <= 3 * s) return { row: 1, col: idx - 2 * s + 1 };
  return { row: idx - 3 * s + 1, col: s + 1 };
}

export function tileToWorld(idx, size = 40) {
  const { row, col } = gridPos(idx, size);
  const center = (size / 4 + 2) / 2; // grid (s+1)x(s+1) berpusat di titik nol
  return [(col - center) * TILE_SIZE, 0, (row - center) * TILE_SIZE];
}

// Sisi papan (0=bawah, 1=kiri, 2=atas, 3=kanan) untuk orientasi label.
export function tileSide(idx, size = 40) {
  const s = size / 4;
  if (idx <= s) return 0;
  if (idx <= 2 * s) return 1;
  if (idx <= 3 * s) return 2;
  return 3;
}

export const SIDE_YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

// Offset kecil agar hingga 4 token tidak bertumpuk di satu petak.
export function tokenOffset(playerIndex) {
  const dx = (playerIndex % 2) * 0.4 - 0.2;
  const dz = Math.floor(playerIndex / 2) * 0.4 - 0.2;
  return [dx, dz];
}

export const PLAYER_COLORS = ['#22d3ee', '#f472b6', '#fbbf24', '#4ade80'];
