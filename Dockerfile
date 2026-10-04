# Image produksi satu layanan: server Node menyajikan client build + Socket.io.
# Dipakai Hugging Face Spaces (sdk: docker) atau host Docker mana pun.
FROM node:20-slim

WORKDIR /app

# Server: dependensi murni JavaScript — lockfile aman dipakai lintas OS.
COPY package.json ./
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev

# Client: lockfile dibuat di Windows sehingga biner native Linux (rollup,
# esbuild, tailwind oxide) bisa hilang — instal ulang tanpa lockfile.
COPY client/package.json ./client/
RUN cd client && npm install --no-audit --no-fund

COPY shared ./shared
COPY server/src ./server/src
COPY client ./client
RUN cd client && npm run build

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860
CMD ["node", "server/src/index.js"]
