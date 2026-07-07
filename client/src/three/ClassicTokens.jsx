// Token logam Monopoli klasik: Topi Tinggi, Mobil Balap, Bidal, Sepatu.
// Semua dari primitif dengan material perak terpoles (metalness moderat —
// tanpa envMap, logam penuh justru tampak hitam).

const METAL = { color: '#d7dde5', metalness: 0.55, roughness: 0.22 };
const METAL_DARK = { color: '#aab4c0', metalness: 0.55, roughness: 0.3 };

export function TopHatMesh() {
  return (
    <group>
      {/* pinggiran topi */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.18, 0.035, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* mahkota */}
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.105, 0.115, 0.24, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* pita */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.118, 0.122, 0.045, 24]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>
      {/* tutup atas */}
      <mesh position={[0, 0.29, 0]}>
        <cylinderGeometry args={[0.105, 0.105, 0.012, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

export function CarMesh() {
  return (
    <group position={[0, 0.07, 0]}>
      {/* bodi utama memanjang */}
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.09, 0.15]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* moncong meruncing */}
      <mesh position={[0.22, -0.005, 0]}>
        <boxGeometry args={[0.08, 0.07, 0.11]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* kokpit + pengemudi */}
      <mesh position={[-0.05, 0.07, 0]}>
        <boxGeometry args={[0.14, 0.06, 0.11]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>
      <mesh position={[-0.05, 0.13, 0]} castShadow>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* buntut */}
      <mesh position={[-0.21, 0.03, 0]}>
        <boxGeometry args={[0.06, 0.1, 0.1]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* roda x4 */}
      {[[-0.13, -0.055], [0.14, -0.055]].map(([x], i) =>
        [-0.085, 0.085].map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, -0.045, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.035, 16]} />
            <meshStandardMaterial {...METAL_DARK} />
          </mesh>
        ))
      )}
    </group>
  );
}

export function ThimbleMesh() {
  return (
    <group>
      {/* badan kerucut terpancung */}
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.095, 0.13, 0.24, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* bibir bawah */}
      <mesh position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.04, 24]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>
      {/* puncak membulat (berlesung khas bidal) */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <sphereGeometry args={[0.095, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c3ccd6" metalness={0.55} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function ShoeMesh() {
  return (
    <group position={[0, 0.05, 0]}>
      {/* sol */}
      <mesh castShadow>
        <boxGeometry args={[0.34, 0.035, 0.13]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>
      {/* ujung kaki membulat */}
      <mesh position={[0.12, 0.05, 0]} scale={[1.5, 0.9, 1]} castShadow>
        <sphereGeometry args={[0.065, 14, 10]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* badan tengah */}
      <mesh position={[-0.02, 0.05, 0]}>
        <boxGeometry args={[0.16, 0.08, 0.115]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* leher sepatu */}
      <mesh position={[-0.11, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.07, 0.12, 14]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* hak */}
      <mesh position={[-0.13, -0.04, 0]}>
        <boxGeometry args={[0.09, 0.05, 0.11]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>
    </group>
  );
}

export const CLASSIC_MESHES = {
  tophat: TopHatMesh,
  car: CarMesh,
  thimble: ThimbleMesh,
  shoe: ShoeMesh,
};
