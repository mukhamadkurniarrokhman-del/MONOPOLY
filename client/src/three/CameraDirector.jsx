import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAnimStore, followTarget } from '../store/useAnimStore.js';

const DICE_POS = new THREE.Vector3(0, 6.2, 5.2);
const DICE_LOOK = new THREE.Vector3(0, 0.4, 0);
const HOME_LOOK = new THREE.Vector3(0, 0, 0);
const FOLLOW_OFFSET = new THREE.Vector3(0, 3.4, 3.2);

// Menggerakkan kamera secara sinematik saat dadu bergulir / token melompat,
// lalu mengembalikannya ke kendali OrbitControls. `scale` menyesuaikan jarak
// "rumah" dengan ukuran papan peta yang aktif.
export default function CameraDirector({ controlsRef, scale = 1 }) {
  const { camera } = useThree();
  const HOME_POS = useRef(new THREE.Vector3(0, 13 * scale, 10.5 * scale)).current;
  const diceRolling = useAnimStore((s) => s.diceRolling);
  const following = useAnimStore((s) => s.followingCount) > 0;
  const mode = diceRolling ? 'dice' : following ? 'follow' : 'orbit';
  const returning = useRef(false);
  const prevMode = useRef('orbit');

  useEffect(() => {
    if (mode !== 'orbit') {
      returning.current = false;
      if (controlsRef.current) controlsRef.current.enabled = false;
    } else if (prevMode.current !== 'orbit') {
      returning.current = true; // luncur pulang dulu, baru serahkan ke orbit
    }
    prevMode.current = mode;
  }, [mode, controlsRef]);

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const k = 1 - Math.pow(0.004, dt);

    if (mode === 'dice') {
      camera.position.lerp(DICE_POS, k);
      controls.target.lerp(DICE_LOOK, k);
      controls.update();
    } else if (mode === 'follow') {
      const desired = followTarget.clone().add(FOLLOW_OFFSET);
      camera.position.lerp(desired, k);
      controls.target.lerp(followTarget, k);
      controls.update();
    } else if (returning.current) {
      camera.position.lerp(HOME_POS, k * 0.8);
      controls.target.lerp(HOME_LOOK, k * 0.8);
      controls.update();
      if (camera.position.distanceTo(HOME_POS) < 0.15) {
        returning.current = false;
        controls.enabled = true;
      }
    }
  });

  return null;
}
