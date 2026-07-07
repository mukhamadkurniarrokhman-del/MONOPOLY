import * as THREE from 'three';

// Tekstur pip dadu digambar sekali di canvas: dasar gelap, pip cyan menyala.
const PIP_LAYOUT = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.3, 0.24], [0.7, 0.24], [0.3, 0.5], [0.7, 0.5], [0.3, 0.76], [0.7, 0.76]],
};

const DEFAULT_STYLE = { body: '#0d1330', pip: '#22d3ee', border: 'rgba(34,211,238,0.35)' };

function makeFaceTexture(value, style) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = style.body;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, size - 10, size - 10);

  ctx.fillStyle = style.pip;
  ctx.shadowColor = style.pip;
  ctx.shadowBlur = 12;
  for (const [px, py] of PIP_LAYOUT[value]) {
    ctx.beginPath();
    ctx.arc(px * size, py * size, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// Urutan material boxGeometry: [+X, -X, +Y, -Y, +Z, -Z]
// Nilai sisi standar (sisi berlawanan berjumlah 7): 3,4,1,6,2,5
export const FACE_VALUES = [3, 4, 1, 6, 2, 5];

// Normal lokal setiap nilai — untuk koreksi orientasi setelah dadu diam.
export const VALUE_NORMALS = {
  3: [1, 0, 0],
  4: [-1, 0, 0],
  1: [0, 1, 0],
  6: [0, -1, 0],
  2: [0, 0, 1],
  5: [0, 0, -1],
};

const cache = new Map();
export function getDiceMaterials(style = DEFAULT_STYLE) {
  const key = JSON.stringify(style);
  if (!cache.has(key)) {
    // dadu terang (mis. Cloud City) tidak perlu pip menyala terang
    const isLight = style.body !== DEFAULT_STYLE.body;
    cache.set(
      key,
      FACE_VALUES.map((v) => {
        const tex = makeFaceTexture(v, style);
        return new THREE.MeshStandardMaterial({
          map: tex,
          metalness: isLight ? 0.15 : 0.35,
          roughness: isLight ? 0.35 : 0.3,
          emissive: new THREE.Color(isLight ? '#dbeafe' : '#67e8f9'),
          emissiveMap: tex,
          emissiveIntensity: isLight ? 0.25 : 0.9,
        });
      })
    );
  }
  return cache.get(key);
}
