import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { Trail } from '@react-three/drei';
import * as THREE from 'three';
import { useAnimStore } from '../store/useAnimStore.js';
import { getDiceMaterials, VALUE_NORMALS } from './diceTextures.js';
import { sfx } from '../audio/audioManager.js';

const DIE_SIZE = 0.52;
const UP = new THREE.Vector3(0, 1, 0);

// Satu dadu fisik. Setelah diam, orientasinya dikoreksi halus agar sisi atas
// sesuai nilai dari server (server tetap otoritatif, fisika hanya drama).
function PhysicsDie({ value, spawn, onSettled, diceStyle, trailColor }) {
  const rb = useRef();
  const meshRef = useRef();
  const [resting, setResting] = useState(null); // { pos, quat } saat fisika selesai
  const targetQuat = useRef(null);
  const age = useRef(0);
  const materials = useMemo(() => getDiceMaterials(diceStyle), [diceStyle]);

  useFrame((_, dt) => {
    age.current += dt;

    if (!resting && rb.current) {
      const lv = rb.current.linvel();
      const av = rb.current.angvel();
      const slow = Math.hypot(lv.x, lv.y, lv.z) < 0.12 && Math.hypot(av.x, av.y, av.z) < 0.25;
      if ((age.current > 0.7 && slow) || age.current > 3.2) {
        const t = rb.current.translation();
        const r = rb.current.rotation();
        const quat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
        // hitung rotasi delta agar sisi `value` menghadap ke atas
        const desired = new THREE.Vector3(...VALUE_NORMALS[value]).applyQuaternion(quat);
        const delta = new THREE.Quaternion().setFromUnitVectors(desired, UP);
        targetQuat.current = delta.multiply(quat.clone());
        setResting({ pos: new THREE.Vector3(t.x, Math.max(t.y, DIE_SIZE / 2), t.z), quat });
      }
    }

    if (resting && meshRef.current) {
      // koreksi cepat ~0.35 dtk lalu lapor selesai
      meshRef.current.quaternion.slerp(targetQuat.current, 1 - Math.pow(0.0001, dt));
      if (meshRef.current.quaternion.angleTo(targetQuat.current) < 0.02 && !meshRef.current.userData.done) {
        meshRef.current.userData.done = true;
        onSettled();
      }
    }
  });

  if (resting) {
    return (
      <mesh ref={meshRef} position={resting.pos} quaternion={resting.quat} material={materials}>
        <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
      </mesh>
    );
  }

  return (
    <RigidBody
      ref={rb}
      position={spawn.pos}
      linearVelocity={spawn.linvel}
      angularVelocity={spawn.angvel}
      restitution={0.55}
      friction={0.4}
      colliders="cuboid"
      onCollisionEnter={() => sfx.diceHit()}
    >
      <Trail width={1.6} length={4.5} color={trailColor} attenuation={(t) => t * t}>
        <mesh material={materials}>
          <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
        </mesh>
      </Trail>
    </RigidBody>
  );
}

function Arena({ d1, d2, onDone, diceStyle, trailColor, glowColor }) {
  const settledCount = useRef(0);
  const spawns = useMemo(() => {
    const rand = (a, b) => a + Math.random() * (b - a);
    return [
      {
        pos: [rand(-1.4, -0.6), 4.2, rand(0.4, 1.2)],
        linvel: [rand(1, 3), -3, rand(-3, -1)],
        angvel: [rand(-14, 14), rand(-14, 14), rand(-14, 14)],
      },
      {
        pos: [rand(0.6, 1.4), 4.6, rand(-1.2, -0.4)],
        linvel: [rand(-3, -1), -3, rand(1, 3)],
        angvel: [rand(-14, 14), rand(-14, 14), rand(-14, 14)],
      },
    ];
  }, []);

  function handleSettled() {
    settledCount.current += 1;
    if (settledCount.current === 2) {
      setTimeout(onDone, 750); // beri waktu pemain membaca hasil
    }
  }

  return (
    <Physics gravity={[0, -22, 0]}>
      {/* lantai arena (area tengah papan) + dinding tak terlihat */}
      <CuboidCollider args={[4.2, 0.15, 4.2]} position={[0, -0.15, 0]} />
      <CuboidCollider args={[0.2, 2, 4.2]} position={[3.9, 1.8, 0]} />
      <CuboidCollider args={[0.2, 2, 4.2]} position={[-3.9, 1.8, 0]} />
      <CuboidCollider args={[4.2, 2, 0.2]} position={[0, 1.8, 3.9]} />
      <CuboidCollider args={[4.2, 2, 0.2]} position={[0, 1.8, -3.9]} />
      <PhysicsDie value={d1} spawn={spawns[0]} onSettled={handleSettled} diceStyle={diceStyle} trailColor={trailColor} />
      <PhysicsDie value={d2} spawn={spawns[1]} onSettled={handleSettled} diceStyle={diceStyle} trailColor={trailColor} />
      {/* kilau lantai saat dadu bergulir */}
      <pointLight position={[0, 2.5, 0]} intensity={18} color={glowColor} />
    </Physics>
  );
}

export default function DiceArena({ map }) {
  const diceRolling = useAnimStore((s) => s.diceRolling);
  const diceValues = useAnimStore((s) => s.diceValues);
  const rollId = useAnimStore((s) => s.rollId);
  const finishDice = useAnimStore((s) => s.finishDice);

  if (!diceRolling || !diceValues) return null;
  const theme = map?.theme ?? {};
  return (
    <Suspense fallback={null}>
      <Arena
        key={rollId}
        d1={diceValues.d1}
        d2={diceValues.d2}
        onDone={finishDice}
        diceStyle={theme.diceStyle}
        trailColor={theme.trailColor ?? '#22d3ee'}
        glowColor={theme.trailColor ?? '#22d3ee'}
      />
    </Suspense>
  );
}
