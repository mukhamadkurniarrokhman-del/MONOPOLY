import { Suspense, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Float, Sky, Clouds, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { getMap } from '@shared/mapConfigs.js';
import Tile3D from './Tile3D.jsx';
import Token3D from './Token3D.jsx';
import DiceArena from './DiceArena.jsx';
import CameraDirector from './CameraDirector.jsx';
import Nebula from './Nebula.jsx';
import Comets from './Comets.jsx';
import CenterDecks from './CenterDecks.jsx';
import FlyingCard from './FlyingCard.jsx';
import { CrystalPlatform, ClassicCenter } from './CloudCityDecor.jsx';
import { useAnimStore } from '../store/useAnimStore.js';

// Bloom/vignette hanya untuk GPU sungguhan — renderer perangkat lunak
// (SwiftShader/llvmpipe, umum di browser headless & perangkat sangat lemah)
// bisa macet total menjalankan post-processing.
function AdaptiveEffects() {
  const gl = useThree((s) => s.gl);
  const [enabled] = useState(() => {
    try {
      const ctx = gl.getContext();
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER);
      return !/swiftshader|llvmpipe|software/i.test(String(renderer));
    } catch {
      return true;
    }
  });
  if (!enabled) return null;
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      <Bloom intensity={0.75} luminanceThreshold={0.28} luminanceSmoothing={0.6} mipmapBlur />
      <Vignette eskil={false} offset={0.15} darkness={0.75} />
    </EffectComposer>
  );
}

// Lingkungan luar angkasa: latar gelap, kabut, bintang, nebula, komet.
function SpaceEnvironment({ theme, f }) {
  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, 22 * f, 42 * f]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} color="#e0f2fe" />
      <pointLight position={[-8, 5, -8]} intensity={40} color={theme.lightA} />
      <pointLight position={[8, 4, 8]} intensity={30} color={theme.lightB} />
      <Stars radius={60} depth={40} count={4000} factor={4} saturation={theme.starSaturation} fade speed={0.6} />
      <Nebula colors={theme.nebulaColors} />
      <Comets colors={[theme.lightB, theme.lightA, theme.titleSecondary]} />
    </>
  );
}

// Lingkungan siang cerah: langit drei <Sky>, matahari berbayangan lembut,
// hemisphere light pantulan awan, dan lautan awan di bawah papan.
function DaylightEnvironment({ theme, f }) {
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={theme.sunPosition}
        turbidity={2.5}
        rayleigh={0.6}
        mieCoefficient={0.004}
        mieDirectionalG={0.85}
      />
      <ambientLight intensity={0.85} color="#ffffff" />
      <hemisphereLight args={[theme.skyColor, theme.groundColor, 0.9]} />
      <directionalLight
        position={[14, 22, 10]}
        intensity={2.4}
        color="#fff8e7"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10 * f}
        shadow-camera-right={10 * f}
        shadow-camera-top={10 * f}
        shadow-camera-bottom={-10 * f}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      {/* lautan awan di bawah & sekitar papan */}
      <Clouds material={THREE.MeshLambertMaterial} limit={400}>
        <Cloud seed={1} position={[0, -7 * f, 0]} bounds={[16 * f, 2, 16 * f]} segments={45} volume={14} color="#ffffff" opacity={0.85} speed={0.08} />
        <Cloud seed={7} position={[0, -11 * f, 0]} bounds={[26 * f, 3, 26 * f]} segments={50} volume={22} color="#eff6ff" opacity={0.7} speed={0.05} />
        <Cloud seed={3} position={[-18 * f, -2, -14 * f]} bounds={[6, 2, 6]} segments={18} volume={7} color="#ffffff" opacity={0.8} speed={0.12} />
        <Cloud seed={4} position={[19 * f, -3, 12 * f]} bounds={[7, 2, 7]} segments={18} volume={8} color="#f8fafc" opacity={0.8} speed={0.1} />
        <Cloud seed={5} position={[16 * f, 1, -18 * f]} bounds={[5, 1.5, 5]} segments={14} volume={5} color="#ffffff" opacity={0.7} speed={0.14} />
        {/* pilar awan penopang di bawah sudut platform kristal */}
        {theme.platform === 'crystal' &&
          [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz], i) => (
            <Cloud
              key={`pilar-${i}`}
              seed={20 + i}
              position={[sx * 5.8 * f, -3.2, sz * 5.8 * f]}
              bounds={[2.2, 3.5, 2.2]}
              segments={16}
              volume={6}
              color="#ffffff"
              opacity={0.9}
              speed={0.06}
            />
          ))}
      </Clouds>
    </>
  );
}

// Pelat dasar mengikuti lebar papan peta (W = petak per sisi + 1).
function BoardBase({ width, theme }) {
  const half = (width + 0.75) * Math.SQRT1_2; // setengah diagonal utk ring persegi
  return (
    <group>
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[width + 0.6, 0.12, width + 0.6]} />
        {theme.glass ? (
          // kaca buram: tembus cahaya, permukaan halus, sedikit kilau logam
          <meshPhysicalMaterial
            color={theme.plate}
            transmission={0.7}
            thickness={1.6}
            roughness={0.14}
            metalness={0.08}
            ior={1.45}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
          />
        ) : (
          <meshStandardMaterial color={theme.plate} metalness={0.5} roughness={0.6} />
        )}
      </mesh>
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[half, half + 0.2, 4]} />
        <meshBasicMaterial color={theme.edgeGlow} transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 2.2, width - 2.2]} />
        {theme.glass ? (
          <meshStandardMaterial color={theme.centerPlate} metalness={0.35} roughness={0.25} />
        ) : (
          <meshStandardMaterial color={theme.centerPlate} metalness={0.3} roughness={0.7} />
        )}
      </mesh>
    </group>
  );
}

function CenterPiece({ theme, mapName }) {
  return (
    <Float speed={2} rotationIntensity={0.08} floatIntensity={0.4}>
      <group rotation={[-Math.PI / 2.6, 0, 0]} position={[0, 0.9, 0]}>
        <Text fontSize={0.85} color={theme.titlePrimary} anchorY="bottom" outlineWidth={0.02} outlineColor={theme.titleSecondary} letterSpacing={0.1}>
          MONOPOLI
        </Text>
        <Text position={[0, -0.25, 0]} fontSize={0.42} color={theme.titleSecondary} anchorY="top" letterSpacing={0.4}>
          {mapName.toUpperCase()}
        </Text>
      </group>
    </Float>
  );
}

export default function SpaceBoard({ game, onTileClick }) {
  const controlsRef = useRef();
  const map = getMap(game.mapId);
  const theme = map.theme;
  // tahan animasi kartu sampai dadu & lompatan token selesai
  const animBusy = useAnimStore((s) => s.diceRolling || s.followingCount > 0);
  const width = map.size / 4 + 1; // 11 utk 40 petak, 12 utk 44
  const f = width / 11; // faktor skala kamera relatif papan klasik

  return (
    <Canvas
      shadows="soft"
      camera={{ position: [0, 13 * f, 10.5 * f], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {theme.environment === 'daylight' ? (
        <DaylightEnvironment theme={theme} f={f} />
      ) : (
        <SpaceEnvironment theme={theme} f={f} />
      )}

      <Suspense fallback={null}>
        <BoardBase width={width} theme={theme} />
        {theme.platform === 'crystal' && <CrystalPlatform width={width} />}
        {map.centerText ? <ClassicCenter map={map} /> : <CenterPiece theme={theme} mapName={map.name} />}
        <CenterDecks map={map} />
        {map.board.map((_, idx) => {
          const owned = game.properties[String(idx)];
          const ownerIndex = owned ? game.players.findIndex((p) => p.id === owned.owner) : -1;
          return (
            <Tile3D
              key={idx}
              idx={idx}
              map={map}
              owned={owned}
              ownerIndex={ownerIndex}
              onClick={onTileClick}
              highlight={game.players.some((p) => !p.bankrupt && p.position === idx)}
            />
          );
        })}
        {game.players.map((p, i) => (
          <Token3D key={p.id} player={p} playerIndex={i} isTurn={game.currentPlayerId === p.id} map={map} />
        ))}
        <DiceArena map={map} />
        {game.pendingCard && !animBusy && (
          <FlyingCard key={game.pendingCard.text} map={map} deckName={game.pendingCard.deck} />
        )}
      </Suspense>

      <AdaptiveEffects />

      <CameraDirector controlsRef={controlsRef} scale={f} />
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        minDistance={6}
        maxDistance={22 * f}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.25}
        enablePan={false}
      />
    </Canvas>
  );
}
