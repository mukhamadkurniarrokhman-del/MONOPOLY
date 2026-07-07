import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Text } from '@react-three/drei';

// Dua tumpukan kartu fisik di pusat papan (Warp = "Chance",
// Transmisi = "Community Chest"), mengambang dengan aura berdenyut.
function Deck({ position, rotationY, color, label }) {
  const aura = useRef();
  const topGlow = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (aura.current) {
      const s = 1 + Math.sin(t * 2.2) * 0.06;
      aura.current.scale.set(s, s, 1);
      aura.current.material.opacity = 0.22 + Math.sin(t * 2.2) * 0.1;
    }
    if (topGlow.current) {
      topGlow.current.material.emissiveIntensity = 0.5 + Math.sin(t * 1.6) * 0.25;
    }
  });

  return (
    <Float speed={2.2} rotationIntensity={0.05} floatIntensity={0.35}>
      <group position={position} rotation={[0, rotationY, 0]}>
        {/* badan tumpukan kartu */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[1.35, 0.17, 1.9]} />
          <meshStandardMaterial color="#0b1026" metalness={0.4} roughness={0.5} />
        </mesh>
        {/* garis "lembar kartu" di sisi tumpukan */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[1.36, 0.02, 1.91]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.5} />
        </mesh>
        {/* muka atas: bingkai menyala + inti gelap */}
        <mesh ref={topGlow} position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.28, 1.82]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.195, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.12, 1.66]} />
          <meshStandardMaterial color="#0a0e22" metalness={0.3} roughness={0.6} />
        </mesh>
        {/* label dek */}
        <Text
          position={[0, 0.21, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.17}
          maxWidth={1.05}
          textAlign="center"
          color={color}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.08}
          outlineWidth={0.006}
          outlineColor="#05060f"
        >
          {label}
        </Text>
        {/* aura berdenyut di lantai */}
        <mesh ref={aura} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.05, 1.28, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
        </mesh>
        <pointLight position={[0, 0.9, 0]} intensity={2.2} color={color} distance={3.5} />
      </group>
    </Float>
  );
}

// Posisi dek di dunia — dipakai juga oleh FlyingCard sebagai titik awal terbang.
// Tata letak klasik (Cloud City): slot di atas & bawah pusat, seperti papan asli.
export function deckPosition(map, deckName) {
  const f = (map.size / 4 + 1) / 11;
  if (map.centerText) {
    return deckName === 'warp' ? [0, 0.2, 2.55 * f] : [0, 0.2, -2.55 * f];
  }
  return deckName === 'warp' ? [-2.35 * f, 0.2, 1.55 * f] : [2.35 * f, 0.2, -1.55 * f];
}

// Slot klasik: bidang oranye/biru dengan bingkai putus-putus & "?" besar,
// dek kartu bersandar di dalam holdernya.
function ClassicSlot({ position, rotationY, color, label }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* holder slot dicetak di papan */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.75, 2.3]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.32, 1.38, 4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* tumpukan kartu di dalam holder */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <boxGeometry args={[1.4, 0.12, 1.95]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.32, 1.86]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* tanda tanya besar yang jelas */}
      <Text position={[0, 0.16, 0.1]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.95} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor={color}>
        ?
      </Text>
      <Text position={[0, 0.155, 0.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.15} color="#ffffff" letterSpacing={0.1} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

export default function CenterDecks({ map }) {
  const f = (map.size / 4 + 1) / 11; // skala mengikuti lebar papan
  if (map.centerText) {
    // tata letak papan klasik: Chance di bawah pusat, Community Chest di atas
    return (
      <>
        <ClassicSlot
          position={[0, 0, 2.55 * f]}
          rotationY={0}
          color={map.theme.deckColors.warp}
          label={map.deckLabels.warp}
        />
        <ClassicSlot
          position={[0, 0, -2.55 * f]}
          rotationY={Math.PI}
          color={map.theme.deckColors.transmission}
          label={map.deckLabels.transmission}
        />
      </>
    );
  }
  return (
    <>
      <Deck
        position={[-2.35 * f, 0, 1.55 * f]}
        rotationY={Math.PI / 7}
        color={map.theme.deckColors.warp}
        label={map.deckLabels.warp.replace(' ', '\n')}
      />
      <Deck
        position={[2.35 * f, 0, -1.55 * f]}
        rotationY={Math.PI + Math.PI / 7}
        color={map.theme.deckColors.transmission}
        label={map.deckLabels.transmission.replace(' ', '\n')}
      />
    </>
  );
}
