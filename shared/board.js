// LAPISAN KOMPATIBILITAS — data papan kini tinggal di mapConfigs.js.
// File ini me-re-export peta default (Tata Surya) dengan nama-nama lama
// agar kode yang belum dimigrasi ke peta dinamis tetap berjalan persis
// seperti sebelumnya. Langkah 3-4 fitur peta ganda akan menghapus
// ketergantungan pada file ini.

import { MAPS, TILE_TYPES } from './mapConfigs.js';

const DEFAULT = MAPS.solar;

export { TILE_TYPES };
export const BOARD = DEFAULT.board;
export const GROUPS = DEFAULT.groups;
export const BOARD_SIZE = DEFAULT.size;
export const GO_SALARY = DEFAULT.salary;
export const JAIL_BAIL = DEFAULT.bail;
export const JAIL_POSITION = DEFAULT.jailPosition;
