import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';

// Komet kecil melintas di kejauhan dengan ekor cahaya.
function Comet({ radius, speed, y, phase, color }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed + phase;
    ref.current.position.set(Math.cos(t) * radius, y + Math.sin(t * 1.7) * 3, Math.sin(t) * radius * 0.7);
  });
  return (
    <Trail width={0.8} length={7} color={color} attenuation={(t) => t * t}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </Trail>
  );
}

export default function Comets({ colors = ['#22d3ee', '#a855f7', '#f472b6'] }) {
  return (
    <>
      <Comet radius={26} speed={0.14} y={9} phase={0} color={colors[0]} />
      <Comet radius={30} speed={0.09} y={-5} phase={2.4} color={colors[1 % colors.length]} />
      <Comet radius={34} speed={0.11} y={13} phase={4.4} color={colors[2 % colors.length]} />
    </>
  );
}
