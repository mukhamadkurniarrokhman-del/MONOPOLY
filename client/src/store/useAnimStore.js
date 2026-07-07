import { create } from 'zustand';
import * as THREE from 'three';

// Posisi dunia token yang sedang bergerak — dibaca CameraDirector setiap frame.
export const followTarget = new THREE.Vector3();

// Status animasi sinematik (dadu & lompatan token). Terpisah dari state game
// karena murni presentasi — server tetap satu-satunya sumber kebenaran.
export const useAnimStore = create((set) => ({
  diceRolling: false,
  diceValues: null, // { d1, d2, playerId }
  rollId: 0, // bertambah tiap lemparan — key remount arena dadu
  followingCount: 0, // >0 berarti ada token yang sedang melompat

  startDice: (values) => set((s) => ({ diceRolling: true, diceValues: values, rollId: s.rollId + 1 })),
  finishDice: () => set({ diceRolling: false }),
  beginFollow: () => set((s) => ({ followingCount: s.followingCount + 1 })),
  endFollow: () => set((s) => ({ followingCount: Math.max(0, s.followingCount - 1) })),
}));
