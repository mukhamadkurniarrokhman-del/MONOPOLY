import Redis from 'ioredis';

const PREFIX = 'antariksa:room:';
const TTL_SECONDS = 60 * 60 * 24; // room kedaluwarsa 24 jam

// Serialisasi room ke bentuk JSON murni (Game berisi data polos + prototype).
function serializeRoom(room) {
  return JSON.stringify({
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    mapId: room.mapId ?? null,
    players: room.players,
    game: room.game ?? null,
  });
}

function makeRedisStore(redis) {
  return {
    mode: 'redis',
    async saveRoom(room) {
      try {
        await redis.set(PREFIX + room.code, serializeRoom(room), 'EX', TTL_SECONDS);
      } catch {} // kegagalan persist tidak boleh mengganggu permainan
    },
    async deleteRoom(code) {
      try {
        await redis.del(PREFIX + code);
      } catch {}
    },
    async loadRooms() {
      const rooms = [];
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', PREFIX + '*', 'COUNT', 100);
        cursor = next;
        for (const key of keys) {
          const raw = await redis.get(key);
          if (raw) {
            try {
              rooms.push(JSON.parse(raw));
            } catch {}
          }
        }
      } while (cursor !== '0');
      return rooms;
    },
  };
}

function makeMemoryStore() {
  return {
    mode: 'memory',
    async saveRoom() {},
    async deleteRoom() {},
    async loadRooms() {
      return [];
    },
  };
}

// Coba Redis (REDIS_URL atau localhost:6379); bila gagal, fallback ke memori.
export async function createPersistence() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // jangan retry selamanya saat Redis memang tak ada
    enableOfflineQueue: false,
  });
  redis.on('error', () => {}); // dicegah agar tidak crash proses
  try {
    await redis.connect();
    await redis.ping();
    console.log(`🗄️  Redis terhubung (${url}) — persistensi room aktif`);
    return makeRedisStore(redis);
  } catch {
    try {
      redis.disconnect();
    } catch {}
    console.warn('⚠️  Redis tidak tersedia — fallback ke memori (rejoin tetap bekerja, tapi room hilang saat server restart)');
    return makeMemoryStore();
  }
}
