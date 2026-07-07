import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { CLASSIC_MESHES } from './ClassicTokens.jsx';

// ---------------------------------------------------------------------------
// Platform kristal Cloud City: menara sudut menyala, rok kristal keliling,
// dan cahaya internal di bawah pelat kaca.
// ---------------------------------------------------------------------------

function CrystalTower({ position }) {
  const glow = useRef();
  useFrame((state) => {
    if (glow.current) glow.current.intensity = 2.5 + Math.sin(state.clock.elapsedTime * 1.8 + position[0]) * 1.2;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <coneGeometry args={[0.38, 1.6, 6]} />
        <meshPhysicalMaterial color="#dbeafe" transmission={0.65} thickness={0.8} roughness={0.08} metalness={0.05} emissive="#7dd3fc" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0.32, -0.25, 0.1]} rotation={[0, 0.5, 0.15]}>
        <coneGeometry args={[0.2, 0.9, 6]} />
        <meshPhysicalMaterial color="#e0f2fe" transmission={0.6} roughness={0.1} emissive="#93c5fd" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-0.28, -0.3, -0.12]} rotation={[0.1, 1.1, -0.12]}>
        <coneGeometry args={[0.16, 0.7, 6]} />
        <meshPhysicalMaterial color="#e0f2fe" transmission={0.6} roughness={0.1} emissive="#93c5fd" emissiveIntensity={0.2} />
      </mesh>
      <pointLight ref={glow} position={[0, 0.3, 0]} color="#38bdf8" distance={4} intensity={3} />
    </group>
  );
}

export function CrystalPlatform({ width }) {
  const half = width / 2 + 0.35;
  // rok kristal: oktahedron berjajar di sekeliling bawah pelat
  const skirt = useMemo(() => {
    const items = [];
    const n = 7; // per sisi
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * 2 - 1;
      const d = half * 0.92;
      items.push([t * d, -0.55, half], [t * d, -0.55, -half], [half, -0.55, t * d], [-half, -0.55, t * d]);
    }
    return items;
  }, [half]);

  return (
    <group>
      {/* menara kristal di 4 sudut */}
      <CrystalTower position={[half, -0.35, half]} />
      <CrystalTower position={[-half, -0.35, half]} />
      <CrystalTower position={[half, -0.35, -half]} />
      <CrystalTower position={[-half, -0.35, -half]} />
      {/* rok kristal keliling */}
      {skirt.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, (i * Math.PI) / 5, 0]} scale={[0.28, 0.45, 0.28]}>
          <octahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial color="#e0f2fe" transmission={0.6} thickness={0.5} roughness={0.12} emissive="#bae6fd" emissiveIntensity={0.18} />
        </mesh>
      ))}
      {/* cahaya internal di bawah pelat kaca */}
      <pointLight position={[0, -1, 0]} color="#7dd3fc" intensity={14} distance={width * 1.2} />
      <pointLight position={[width / 3, -0.8, -width / 3]} color="#bae6fd" intensity={6} distance={width / 2} />
      <pointLight position={[-width / 3, -0.8, width / 3]} color="#bae6fd" intensity={6} distance={width / 2} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Grafis tengah klasik: logo merah MONOPOLI + judul peta, dicetak datar di
// papan dengan kemiringan khas, plus baki slot token logam.
// ---------------------------------------------------------------------------

export function ClassicCenter({ map }) {
  const ct = map.centerText;
  const [firstWord, ...rest] = ct.title.split(' ');
  const restTitle = rest.join(' ');

  return (
    <group>
      {/* dicetak datar di papan, miring ringan khas Monopoli */}
      <group rotation={[-Math.PI / 2, 0, 0.1]} position={[0, 0.03, -0.4]}>
        {/* kotak logo merah */}
        <mesh>
          <planeGeometry args={[4.7, 1.05]} />
          <meshStandardMaterial color="#d32f2f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[4.85, 1.2]} />
          <meshStandardMaterial color="#ffffff" roughness={0.7} />
        </mesh>
        <Text position={[0, 0, 0.01]} fontSize={0.6} color="#ffffff" letterSpacing={0.03} anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#7f1d1d">
          {firstWord}
        </Text>
        <Text position={[0, -0.95, 0.01]} fontSize={0.55} color="#1f2937" letterSpacing={0.08} anchorX="center" anchorY="middle">
          {restTitle}
        </Text>
        <Text position={[0, -1.5, 0.01]} fontSize={0.25} color="#475569" letterSpacing={0.35} anchorX="center" anchorY="middle">
          {ct.subtitle}
        </Text>
      </group>
      <TokenTray map={map} />
    </group>
  );
}

// Baki slot token: keempat token logam klasik dipajang di cakram kaca.
function TokenTray({ map }) {
  const models = Object.values(map.tokenSet).map((t) => t.model);
  return (
    <group position={[2.6, 0.02, 1.9]} rotation={[0, -0.35, 0]}>
      {models.map((m, i) => {
        const Mesh = CLASSIC_MESHES[m];
        if (!Mesh) return null;
        return (
          <group key={m} position={[(i - 1.5) * 0.62, 0, 0]}>
            <mesh position={[0, 0.015, 0]} receiveShadow>
              <cylinderGeometry args={[0.26, 0.28, 0.03, 24]} />
              <meshPhysicalMaterial color="#dbeafe" transmission={0.5} roughness={0.15} emissive="#bae6fd" emissiveIntensity={0.2} />
            </mesh>
            <group position={[0, 0.03, 0]} scale={0.8}>
              <Mesh />
            </group>
          </group>
        );
      })}
    </group>
  );
}
