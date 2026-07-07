import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { tileToWorld, tokenOffset, PLAYER_COLORS } from './boardLayout.js';
import { useAnimStore, followTarget } from '../store/useAnimStore.js';
import { sfx } from '../audio/audioManager.js';
import { getTokenDisplay } from '@shared/mapConfigs.js';
import { CLASSIC_MESHES } from './ClassicTokens.jsx';

const HOP_DURATION = 0.32; // detik per petak
const WARP_DURATION = 0.9; // teleport (penjara / kartu warp)
const BASE_Y = 0.08;

// ---------- bentuk token ----------
function RocketMesh({ color }) {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.3, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <coneGeometry args={[0.09, 0.18, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI * 2) / 3) * 0.11, 0.08, Math.cos((i * Math.PI * 2) / 3) * 0.11]}>
          <boxGeometry args={[0.04, 0.14, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function AstronautMesh({ color }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <capsuleGeometry args={[0.1, 0.14, 4, 12]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.2} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.14, -0.11]}>
        <boxGeometry args={[0.14, 0.18, 0.06]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
}

function SatelliteMesh({ color }) {
  return (
    <group position={[0, 0.28, 0]}>
      <mesh>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.22, 0, 0]}>
        <boxGeometry args={[0.24, 0.02, 0.14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.22, 0, 0]}>
        <boxGeometry args={[0.24, 0.02, 0.14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.14]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
    </group>
  );
}

function UfoMesh({ color }) {
  return (
    <group position={[0, 0.18, 0]}>
      <mesh scale={[1, 0.32, 1]}>
        <sphereGeometry args={[0.2, 20, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <sphereGeometry args={[0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} transparent opacity={0.75} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

const MESHES = {
  rocket: RocketMesh,
  astronaut: AstronautMesh,
  satellite: SatelliteMesh,
  ufo: UfoMesh,
  ...CLASSIC_MESHES, // tophat / car / thimble / shoe (Cloud City Klasik)
};

// ---------- partikel knalpot roket ----------
const PARTICLE_COUNT = 90;

function Exhaust({ emitRef }) {
  const points = useRef();
  const data = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({ pos: new THREE.Vector3(0, -999, 0), vel: new THREE.Vector3(), life: 0 }))
  );
  const cursor = useRef(0);

  useFrame((_, dt) => {
    const arr = data.current;
    // pancarkan partikel baru saat token bergerak
    if (emitRef.current.active) {
      for (let n = 0; n < 4; n++) {
        const p = arr[cursor.current];
        cursor.current = (cursor.current + 1) % PARTICLE_COUNT;
        p.pos.copy(emitRef.current.origin);
        p.vel.set((Math.random() - 0.5) * 0.8, -1.2 - Math.random(), (Math.random() - 0.5) * 0.8);
        p.life = 0.5 + Math.random() * 0.25;
      }
    }
    const positions = points.current.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = arr[i];
      if (p.life > 0) {
        p.life -= dt;
        p.pos.addScaledVector(p.vel, dt);
        p.vel.y += 1.5 * dt; // partikel melambat lalu melayang
        positions[i * 3] = p.pos.x;
        positions[i * 3 + 1] = p.pos.y;
        positions[i * 3 + 2] = p.pos.z;
      } else {
        positions[i * 3 + 1] = -999;
      }
    }
    points.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={new Float32Array(PARTICLE_COUNT * 3).fill(-999)} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.09} color="#fb923c" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// ---------- token dengan lompatan busur ----------
export default function Token3D({ player, playerIndex, isTurn, map }) {
  const ref = useRef();
  const boardSize = map?.size ?? 40;
  const color = PLAYER_COLORS[playerIndex];
  // peta menentukan model tampilan (mis. token logam klasik di Cloud City)
  const display = getTokenDisplay(map, player.token);
  const Mesh = MESHES[display.model] ?? RocketMesh;
  const isClassic = !!map?.tokenSet;

  const displayed = useRef(player.position); // petak yang sedang ditampilkan
  const queue = useRef([]); // antrean waypoint { tile, warp }
  const hop = useRef(null); // lompatan aktif { from: V3, to: V3, t, dur, warp }
  const following = useRef(false);
  const emitRef = useRef({ active: false, origin: new THREE.Vector3() });
  const initialized = useRef(false);
  const pulseRef = useRef(); // cincin denyut saat mendarat
  const pulseT = useRef(1); // 0..1, 1 = selesai

  const [dx, dz] = tokenOffset(playerIndex);
  const worldOf = (tile) => {
    const [x, , z] = tileToWorld(tile, boardSize);
    return new THREE.Vector3(x + dx, BASE_Y, z + dz);
  };

  // deteksi perubahan posisi dari server -> isi antrean lompatan
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      displayed.current = player.position;
      ref.current?.position.copy(worldOf(player.position));
      return;
    }
    if (player.position === displayed.current) return;
    const last = queue.current.length ? queue.current[queue.current.length - 1].tile : displayed.current;
    if (player.position === last) return; // sudah diantre (guard StrictMode)
    const steps = (player.position - last + boardSize) % boardSize;
    if (steps >= 1 && steps <= 12) {
      for (let i = 1; i <= steps; i++) queue.current.push({ tile: (last + i) % boardSize, warp: false });
    } else {
      queue.current.push({ tile: player.position, warp: true }); // teleport: penjara/kartu
    }
  }, [player.position]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, dt) => {
    if (!ref.current) return;
    const anim = useAnimStore.getState();

    // mulai lompatan berikutnya (tunggu dadu selesai bergulir dulu)
    if (!hop.current && queue.current.length > 0 && !anim.diceRolling) {
      const next = queue.current.shift();
      hop.current = {
        from: ref.current.position.clone(),
        to: worldOf(next.tile),
        t: 0,
        dur: next.warp ? WARP_DURATION : HOP_DURATION,
        warp: next.warp,
        tile: next.tile,
      };
      if (!following.current) {
        following.current = true;
        anim.beginFollow();
      }
      sfx.thrust(); // semburan roket tiap lompatan
    }

    if (hop.current) {
      const h = hop.current;
      h.t = Math.min(1, h.t + dt / h.dur);
      const ease = h.t * h.t * (3 - 2 * h.t); // smoothstep
      const height = h.warp ? 2.6 : 0.55;
      ref.current.position.lerpVectors(h.from, h.to, ease);
      ref.current.position.y = BASE_Y + Math.sin(h.t * Math.PI) * height;
      // condongkan token searah gerak
      ref.current.rotation.z = Math.sin(h.t * Math.PI) * 0.15;

      emitRef.current.active = true;
      emitRef.current.origin.copy(ref.current.position).y -= 0.02;
      followTarget.copy(ref.current.position);

      if (h.t >= 1) {
        displayed.current = h.tile;
        ref.current.position.copy(h.to);
        ref.current.rotation.z = 0;
        hop.current = null;
        if (queue.current.length === 0 && following.current) {
          following.current = false;
          emitRef.current.active = false;
          anim.endFollow();
          // denyut cahaya + bunyi mendarat di petak terakhir
          pulseT.current = 0;
          pulseRef.current?.position.set(h.to.x, 0.09, h.to.z);
          sfx.land();
        }
      }
    } else {
      emitRef.current.active = false;
      // token diam: pastikan di petaknya + efek mengambang saat giliran
      const target = worldOf(displayed.current);
      ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, target.x, 1 - Math.pow(0.001, dt));
      ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, target.z, 1 - Math.pow(0.001, dt));
      ref.current.position.y = isTurn ? BASE_Y + Math.sin(state.clock.elapsedTime * 3) * 0.04 : BASE_Y;
    }

    // animasi cincin denyut pendaratan (0,6 dtk membesar + memudar)
    if (pulseRef.current && pulseT.current < 1) {
      pulseT.current = Math.min(1, pulseT.current + dt / 0.6);
      const s = 0.3 + pulseT.current * 1.5;
      pulseRef.current.scale.set(s, s, 1);
      pulseRef.current.material.opacity = 0.9 * (1 - pulseT.current);
    }
  });

  if (player.bankrupt) return null;
  return (
    <>
      <group ref={ref} onUpdate={(g) => g.traverse((o) => (o.castShadow = true))}>
        <Mesh color={color} />
        {/* token logam klasik semuanya perak — alas cakram warna pemain sebagai pembeda */}
        {isClassic && (
          <mesh position={[0, 0.008, 0]}>
            <cylinderGeometry args={[0.21, 0.23, 0.016, 24]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
          </mesh>
        )}
        {isTurn && (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.24, 0.3, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        )}
      </group>
      <Exhaust emitRef={emitRef} />
      <mesh ref={pulseRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -999, 0]}>
        <ringGeometry args={[0.42, 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}
