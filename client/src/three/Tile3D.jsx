import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { TILE_TYPES } from '@shared/mapConfigs.js';
import { tileToWorld, tileSide, SIDE_YAW, PLAYER_COLORS } from './boardLayout.js';
import { getPaperTexture } from './paperTexture.js';

const TYPE_ICONS = {
  [TILE_TYPES.GO]: '🚀',
  [TILE_TYPES.WARP]: '🌀',
  [TILE_TYPES.TRANSMISSION]: '📡',
  [TILE_TYPES.JAIL]: '🔒',
  [TILE_TYPES.GO_TO_JAIL]: '🚨',
  [TILE_TYPES.FREE]: '🛸',
  [TILE_TYPES.TAX]: '💸',
  [TILE_TYPES.STATION]: '🛰️',
  [TILE_TYPES.UTILITY]: '⚡',
};

function Buildings({ level, side, ownerColor }) {
  const yaw = SIDE_YAW[side];
  if (!level) return null;
  if (level === 5) {
    // Koloni Antariksa: kubah besar menyala
    return (
      <group rotation={[0, yaw, 0]} position={[0, 0.1, -0.3]}>
        <mesh position={[0, 0.12, 0]}>
          <sphereGeometry args={[0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f8fafc" emissive={ownerColor} emissiveIntensity={0.8} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.06, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    );
  }
  // Rover Riset: kotak kecil berjajar
  return (
    <group rotation={[0, yaw, 0]} position={[0, 0.1, -0.32]}>
      {Array.from({ length: level }).map((_, i) => (
        <mesh key={i} position={[(i - (level - 1) / 2) * 0.2, 0.05, 0]}>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          <meshStandardMaterial color="#e2e8f0" emissive={ownerColor} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export default function Tile3D({ idx, map, owned, ownerIndex, onClick, highlight }) {
  const tile = map.board[idx];
  const [x, , z] = useMemo(() => tileToWorld(idx, map.size), [idx, map.size]);
  const side = tileSide(idx, map.size);
  const yaw = SIDE_YAW[side];
  const group = tile.group ? map.groups[tile.group] : null;
  const ownerColor = ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex] : '#22d3ee';
  const isCorner = idx % (map.size / 4) === 0;

  return (
    <group position={[x, 0, z]}>
      {/* dasar petak */}
      <mesh
        castShadow
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          onClick(idx);
        }}
        onPointerOver={(e) => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <boxGeometry args={[0.96, isCorner ? 0.16 : 0.12, 0.96]} />
        {map.theme.glass ? (
          // perak terpoles / kertas klasik untuk papan terang (metalness
          // moderat — tanpa envMap, metal tinggi justru tampak hitam)
          <meshStandardMaterial
            map={map.theme.paper && !owned?.mortgaged && !highlight ? getPaperTexture(map.theme.tileBase) : null}
            color={
              owned?.mortgaged ? '#94a3b8'
              : highlight ? (map.theme.tileHighlight ?? '#7dd3fc')
              : map.theme.paper ? '#ffffff'
              : map.theme.tileBase
            }
            metalness={map.theme.paper ? 0.05 : 0.35}
            roughness={map.theme.paper ? 0.75 : owned?.mortgaged ? 0.6 : 0.25}
          />
        ) : (
          <meshStandardMaterial
            color={owned?.mortgaged ? '#070910' : highlight ? '#1e3a5f' : map.theme.tileBase}
            metalness={0.4}
            roughness={0.5}
            emissive={highlight ? '#22d3ee' : '#0a0d1f'}
            emissiveIntensity={highlight ? 0.25 : owned?.mortgaged ? 0.02 : 0.1}
          />
        )}
      </mesh>

      {/* garis merah diagonal: properti sedang dihipotek */}
      {owned?.mortgaged && (
        <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[1.25, 0.1]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}

      {/* cincin kepemilikan (redup bila terhipotek) */}
      {ownerIndex >= 0 && (
        <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <ringGeometry args={[0.62, 0.68, 4]} />
          <meshBasicMaterial color={ownerColor} transparent opacity={owned?.mortgaged ? 0.3 : 0.9} />
        </mesh>
      )}

      {/* strip warna grup di sisi luar petak */}
      {group && (
        <group rotation={[0, yaw, 0]}>
          <mesh position={[0, 0.075, 0.38]}>
            <boxGeometry args={[0.9, 0.03, 0.16]} />
            <meshStandardMaterial color={group.color} emissive={group.color} emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}

      {/* label nama */}
      <group rotation={[0, yaw, 0]}>
        <Text
          position={[0, isCorner ? 0.09 : 0.07, group ? -0.05 : 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={isCorner ? 0.13 : 0.105}
          maxWidth={0.85}
          textAlign="center"
          color={map.theme.tileText ?? '#cbd5e1'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor={map.theme.tileTextOutline ?? '#05060f'}
        >
          {TYPE_ICONS[tile.type] ? `${TYPE_ICONS[tile.type]}\n${tile.name}` : tile.name}
        </Text>
      </group>

      <Buildings level={owned?.level ?? 0} side={side} ownerColor={ownerColor} />
    </group>
  );
}
