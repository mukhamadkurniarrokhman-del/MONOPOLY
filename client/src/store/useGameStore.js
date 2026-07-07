import { create } from 'zustand';

export const useGameStore = create((set) => ({
  connection: 'connecting', // connecting | connected | disconnected | error
  screen: 'home', // home | lobby | game
  selfId: null,
  room: null, // { code, hostId, phase, players[] }
  game: null, // publicState() dari server — satu-satunya sumber kebenaran
  savedRoom: null, // kode room yang di-"simpan & keluar" (untuk banner Lanjutkan)

  setConnection: (connection) => set({ connection }),
  setScreen: (screen) => set({ screen }),
  setSelf: (selfId) => set({ selfId }),
  setRoom: (room) => set({ room }),
  setGame: (game) => set({ game }),
  setSavedRoom: (savedRoom) => set({ savedRoom }),
  reset: () => set({ screen: 'home', room: null, game: null }),
}));
