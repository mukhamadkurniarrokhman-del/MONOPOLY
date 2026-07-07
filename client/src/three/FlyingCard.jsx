import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { deckPosition } from './CenterDecks.jsx';

const FLIGHT_DURATION = 0.9;

// Kartu 3D yang terbang berputar dari dek pusat ke depan kamera saat
// seorang pemain menarik kartu, lalu melayang sampai kartu dijalankan.
export default function FlyingCard({ map, deckName }) {
  const ref = useRef();
  const t0 = useRef(null);
  const color = map.theme.deckColors[deckName];
  const from = useMemo(() => new THREE.Vector3(...deckPosition(map, deckName)), [map, deckName]);
  const { camera } = useThree();
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpTarget = useMemo(() => new THREE.Vector3(), []);
  const spinQ = useMemo(() => new THREE.Quaternion(), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((state) => {
    if (!ref.current) return;
    if (t0.current == null) t0.current = state.clock.elapsedTime;
    const raw = (state.clock.elapsedTime - t0.current) / FLIGHT_DURATION;
    const t = Math.min(1, raw);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

    // tujuan: titik di depan kamera
    camera.getWorldDirection(tmpDir);
    tmpTarget.copy(camera.position).addScaledVector(tmpDir, 3.4);
    ref.current.position.lerpVectors(from, tmpTarget, ease);
    ref.current.position.y += Math.sin(t * Math.PI) * 1.2; // busur ke atas
    if (t >= 1) ref.current.position.y += Math.sin(state.clock.elapsedTime * 2.2) * 0.05; // melayang

    // menghadap kamera + berputar cepat selama terbang
    ref.current.quaternion.copy(camera.quaternion);
    spinQ.setFromAxisAngle(yAxis, (1 - ease) * Math.PI * 4);
    ref.current.quaternion.multiply(spinQ);
  });

  return (
    <group ref={ref} position={from}>
      {/* bingkai menyala */}
      <mesh>
        <planeGeometry args={[1.15, 1.7]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* inti kartu gelap */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[1.02, 1.57]} />
        <meshStandardMaterial color="#0a0e22" side={THREE.DoubleSide} />
      </mesh>
      <pointLight intensity={3} color={color} distance={4} />
    </group>
  );
}
