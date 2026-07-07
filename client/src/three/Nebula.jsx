import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Nebula murah-meriah: sprite besar bertekstur gradien radial, additive blending,
// melayang pelan di kejauhan. Jauh lebih ringan daripada volumetrik sungguhan.
function makeNebulaTexture(color) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color.replace('1)', '0.35)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const NEBULA_SLOTS = [
  { pos: [-24, 6, -20], scale: 34 },
  { pos: [26, -4, -16], scale: 28 },
  { pos: [18, 10, 24], scale: 30 },
  { pos: [-20, -8, 22], scale: 26 },
];

// Warna nebula datang dari tema peta (map.theme.nebulaColors).
export default function Nebula({ colors }) {
  const group = useRef();
  const sprites = useMemo(
    () =>
      NEBULA_SLOTS.map((n, i) => ({
        ...n,
        texture: makeNebulaTexture(colors[i % colors.length]),
        speed: 0.01 + Math.random() * 0.02,
      })),
    [colors]
  );

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.008;
  });

  return (
    <group ref={group}>
      {sprites.map((n, i) => (
        <sprite key={i} position={n.pos} scale={[n.scale, n.scale, 1]}>
          <spriteMaterial
            map={n.texture}
            transparent
            opacity={0.32}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}
