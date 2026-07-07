// Shared between client and server — single source of truth for socket event names.
export const EVENTS = {
  // client -> server
  CREATE_ROOM: 'room:create',
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  SET_READY: 'room:setReady',
  START_GAME: 'room:startGame',
  ADD_BOT: 'room:addBot',
  REMOVE_BOT: 'room:removeBot',
  RESUME: 'room:resume',
  SET_MAP: 'room:setMap',
  SAVE_EXIT: 'room:saveExit',

  // server -> client
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  ROOM_UPDATE: 'room:update',
  ROOM_ERROR: 'room:error',
  GAME_STARTED: 'game:started',

  // gameplay
  ROLL_DICE: 'game:rollDice',
  GAME_ACTION: 'game:action', // { type: 'buy'|'skip'|'endTurn'|'payBail'|'useJailCard'|'build', ... }
  DICE_RESULT: 'game:diceResult',
  GAME_STATE: 'game:state',
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const TOKENS = ['rocket', 'astronaut', 'satellite', 'ufo'];

export const TOKEN_LABELS = {
  rocket: 'Roket',
  astronaut: 'Astronot',
  satellite: 'Satelit',
  ufo: 'UFO',
};

// Saldo awal: $1500 klasik x 50.000 (skala yang sama dengan harga papan)
export const STARTING_BALANCE = 75_000_000;

export function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}
