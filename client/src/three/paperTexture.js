import * as THREE from 'three';

// Tekstur kertas prosedural: warna dasar + bintik serat halus + noda lembut.
// Di-cache per warna dasar.
const cache = new Map();

export function getPaperTexture(baseColor = '#d6e8d6') {
  if (cache.has(baseColor)) return cache.get(baseColor);

  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // bintik serat kertas
  for (let i = 0; i < 2600; i++) {
    const shade = Math.random();
    ctx.fillStyle = shade > 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random(), 1);
  }
  // noda lembut acak (kesan kertas tua)
  for (let i = 0; i < 7; i++) {
    const g = ctx.createRadialGradient(
      Math.random() * size, Math.random() * size, 0,
      Math.random() * size, Math.random() * size, 30 + Math.random() * 50
    );
    g.addColorStop(0, 'rgba(90,110,80,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(baseColor, tex);
  return tex;
}
