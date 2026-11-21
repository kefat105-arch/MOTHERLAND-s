import * as THREE from 'three';
import type { RobloxAvatarConfig } from '../../../../types';
import {
  animateRobloxCharacter,
  createRobloxCharacter,
  smoothRotateYaw,
  type RobloxCharacterRig,
} from '../robloxCharacter';
import {
  createCheckerTexture,
  createSandTexture,
  createSquidCourtTexture,
  createStudTexture,
  createThreePointLights,
  createWoodPlankTexture,
} from '../robloxRenderer';
import {
  buildCompositePlatform,
  createBrushedTitaniumPbrMaterial,
} from '../proceduralAssets';
import { robloxAudio } from '../robloxAudio';
import {
  SQUID_STAGES,
  type DalgonaShape,
  type PlayerInputState,
  type RobloxHudState,
  type ServerWorldContext,
  type SquidStageId,
  type WorldController,
} from '../types';

interface PlatformBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

interface NpcAgent {
  rig: RobloxCharacterRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  alive: boolean;
  speed: number;
  phaseOffset: number;
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _playerOut = new THREE.Vector3();

function buildGiantYoungHeeDoll(): { root: THREE.Group; headPivot: THREE.Group } {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf4c9a2, roughness: 0.45 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.65 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    emissive: 0xef4444,
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });

  const legMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.46, 4.0, 16), legMat);
  legL.position.set(-0.9, 2.0, 0);
  const legR = legL.clone();
  legR.position.x = 0.9;
  root.add(legL, legR);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.85, 4.4, 20),
    new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.55 })
  );
  torso.position.y = 6.0;
  torso.castShadow = true;
  root.add(torso);

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.28, 1.3, 18),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
  );
  collar.position.y = 7.7;
  root.add(collar);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 3.2, 12), skinMat);
  armL.position.set(-1.9, 6.2, 0);
  armL.rotation.z = 0.16;
  const armR = armL.clone();
  armR.position.x = 1.9;
  armR.rotation.z = -0.16;
  root.add(armL, armR);

  const headPivot = new THREE.Group();
  headPivot.position.y = 9.2;
  root.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 20), skinMat);
  head.position.y = 1.05;
  head.castShadow = true;
  headPivot.add(head);

  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hairTop.position.set(0, 1.2, -0.05);
  const pigL = new THREE.Mesh(new THREE.SphereGeometry(0.66, 14, 12), hairMat);
  pigL.position.set(-1.6, 0.78, -0.22);
  const pigR = pigL.clone();
  pigR.position.x = 1.6;
  headPivot.add(hairTop, pigL, pigR);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), eyeMat);
  eyeL.position.set(-0.54, 1.12, 1.44);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.54;
  headPivot.add(eyeL, eyeR);

  return { root, headPivot };
}

export function createSquidGameWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialStage: SquidStageId = 's1_red_light',
  initialAvatar?: RobloxAvatarConfig
): WorldController {
  let currentStageId: SquidStageId = initialStage;
  let customAvatar: RobloxAvatarConfig | undefined = initialAvatar;
  const stageGroup = new THREE.Group();
  scene.add(stageGroup);

  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0xffeacc,
    sunIntensity: 2.25,
    hemiSky: 0x9ec5ff,
    hemiGround: 0x3b2a1e,
  });

  let playerRig = createRobloxCharacter({
    skinHex: customAvatar?.skinHex ?? 0xf3c297,
    hairHex: customAvatar?.hairHex ?? 0x1e1b18,
    shirtHex: 0x0f6b63,
    pantsHex: 0x0c544e,
    jerseyNumber: '456',
    roleVariant: 'contestant',
    faceMood: customAvatar?.faceMood ?? 'focused',
    hatStyle: customAvatar?.hatStyle ?? 'hair_swept',
    accessory: customAvatar?.accessory ?? 'none',
  });
  scene.add(playerRig.root);

  let px = 0;
  let py = 0;
  let pz = 0;
  let playerYawFacing = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let actionTimer = 0;
  let phase: RobloxHudState['phase'] = 'playing';
  let lives = 3;
  const maxLives = 3;
  let score = 0;
  let timerSec = 150;
  let signalText: string | null = 'GREEN LIGHT';
  let signalTone: RobloxHudState['signalTone'] = 'green';

  let platforms: PlatformBox[] = [];
  let npcs: NpcAgent[] = [];
  let finishZ = -58;
  let spawnPos = new THREE.Vector3(0, 0, 42);

  // Red Light state
  let rlState: 'green' | 'turning' | 'red' = 'green';
  let rlTimer = 4.2;
  let dollHeadPivot: THREE.Group | null = null;
  let dollScanCone: THREE.Mesh | null = null;
  let chantTick = 0;

  // Dalgona state
  let dalgonaShape: DalgonaShape = 'star';
  let dalgonaProgress = 0;
  let dalgonaCracks = 0;

  // Tug of war state
  let tugBalance = 50;
  let tugGroup: THREE.Group | null = null;

  // Marbles state
  let marblesWon = 0;
  let marbleTargetMesh: THREE.Mesh | null = null;
  let marbleBalls: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; active: boolean }> = [];

  // Glass bridge state (18 pairs!)
  let glassPanels: Array<{
    mesh: THREE.Mesh;
    box: PlatformBox;
    tempered: boolean;
    broken: boolean;
  }> = [];

  // Squid Duel state
  let rival218: NpcAgent | null = null;

  const clearStageObjects = () => {
    while (stageGroup.children.length > 0) {
      const child = stageGroup.children[0];
      stageGroup.remove(child);
      child.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const arr = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of arr) {
            const std = mat as THREE.MeshStandardMaterial;
            std.map?.dispose();
            mat.dispose();
          }
        }
      });
    }
    platforms = [];
    npcs = [];
    dollHeadPivot = null;
    dollScanCone = null;
    tugGroup = null;
    marbleTargetMesh = null;
    marbleBalls = [];
    glassPanels = [];
    rival218 = null;
  };

  const squidTrimMat = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#334155', 2, 2);

  const addPlatform = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material
  ): THREE.Object3D => {
    const mesh = buildCompositePlatform(w, h, d, mat, squidTrimMat);
    mesh.position.set(x, y, z);
    stageGroup.add(mesh);
    platforms.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      y,
    });
    return mesh;
  };

  const groundHeightAt = (x: number, z: number): number => {
    let bestY = -45;
    for (const p of platforms) {
      if (x >= p.minX - 0.35 && x <= p.maxX + 0.35 && z >= p.minZ - 0.35 && z <= p.maxZ + 0.35) {
        if (p.y > bestY) bestY = p.y;
      }
    }
    return bestY;
  };

  const spawnPlayerAt = (pos: THREE.Vector3) => {
    px = pos.x;
    py = pos.y;
    pz = pos.z;
    vx = 0;
    vy = 0;
    vz = 0;
    grounded = true;
    playerYawFacing = Math.PI;
    playerRig.root.position.set(px, py, pz);
    playerRig.root.rotation.set(0, Math.PI, 0);
  };

  const buildStage = (stageId: SquidStageId) => {
    clearStageObjects();
    currentStageId = stageId;
    phase = 'playing';
    actionTimer = 0;
    signalTone = 'info';

    if (stageId === 's1_red_light') {
      scene.background = new THREE.Color(0x9bc5e8);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.setHex(0x9bc5e8);
        scene.fog.near = 65;
        scene.fog.far = 210;
      }
      lights.sun.intensity = 2.4;
      lights.sun.color.setHex(0xfff1d6);
      timerSec = 140;
      finishZ = -56;
      spawnPos.set(0, 0, 44);
      rlState = 'green';
      rlTimer = 4.0;
      signalText = 'GREEN LIGHT';
      signalTone = 'green';

      const sandMat = new THREE.MeshStandardMaterial({
        map: createSandTexture(maxAnisotropy, 16),
        roughness: 0.92,
      });
      addPlatform(0, 0, -8, 56, 1.8, 128, sandMat);

      const finishMat = new THREE.MeshStandardMaterial({
        map: createCheckerTexture('#ef4444', '#ffffff', maxAnisotropy, 14, 1),
        roughness: 0.5,
      });
      const finishLine = new THREE.Mesh(new THREE.BoxGeometry(56, 0.08, 2.6), finishMat);
      finishLine.position.set(0, 0.04, finishZ);
      stageGroup.add(finishLine);

      // Painted Season 1 Perimeter Walls
      const wallMat = new THREE.MeshStandardMaterial({
        map: createStudTexture('#8bb8d6', maxAnisotropy, 10, 2),
        roughness: 0.78,
      });
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(58, 18, 2), wallMat);
      backWall.position.set(0, 9, -71);
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 128), wallMat);
      leftWall.position.set(-28.5, 7, -8);
      const rightWall = leftWall.clone();
      rightWall.position.x = 28.5;
      stageGroup.add(backWall, leftWall, rightWall);

      const doll = buildGiantYoungHeeDoll();
      doll.root.position.set(0, 0, -64);
      dollHeadPivot = doll.headPivot;
      dollHeadPivot.rotation.y = Math.PI;
      stageGroup.add(doll.root);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 2.1, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 })
      );
      trunk.position.set(0, 8, -67.5);
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(7.2, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x3f7d32, roughness: 0.85 })
      );
      canopy.position.set(0, 16.5, -67.5);
      stageGroup.add(trunk, canopy);

      dollScanCone = new THREE.Mesh(
        new THREE.ConeGeometry(18, 68, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      dollScanCone.rotation.x = Math.PI / 2;
      dollScanCone.position.set(0, 8, -32);
      dollScanCone.visible = false;
      stageGroup.add(dollScanCone);

      // Flanking Masked Guards & 16 Contestants
      for (const gx of [-18, 18]) {
        const g = createRobloxCharacter({ roleVariant: 'guard_triangle' });
        g.root.position.set(gx, 0, -61);
        stageGroup.add(g.root);
      }

      const nums = ['001', '067', '199', '218', '240', '101', '212', '322', '070', '111', '017', '096'];
      for (let i = 0; i < nums.length; i++) {
        const ax = -18 + (i % 6) * 7 + (Math.random() - 0.5) * 1.4;
        const az = 38 + Math.floor(i / 6) * 5;
        const rig = createRobloxCharacter({
          jerseyNumber: nums[i],
          roleVariant: 'contestant',
          shirtHex: 0x0f766e,
          pantsHex: 0x115e59,
        });
        rig.root.position.set(ax, 0, az);
        rig.root.rotation.y = Math.PI;
        stageGroup.add(rig.root);
        npcs.push({
          rig,
          x: ax,
          y: 0,
          z: az,
          vx: 0,
          vz: 0,
          alive: true,
          speed: 5.0 + Math.random() * 2.0,
          phaseOffset: Math.random() * 6,
        });
      }
    } else if (stageId === 's1_dalgona') {
      scene.background = new THREE.Color(0xd99b66);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(0xd99b66);
      timerSec = 95;
      spawnPos.set(0, 0, 12);
      const shapes: DalgonaShape[] = ['circle', 'triangle', 'star', 'umbrella'];
      dalgonaShape = shapes[Math.floor(Math.random() * shapes.length)];
      dalgonaProgress = 0;
      dalgonaCracks = 0;
      signalText = `DALGONA · ${dalgonaShape.toUpperCase()}`;
      signalTone = 'gold';

      const floorMat = new THREE.MeshStandardMaterial({
        map: createSandTexture(maxAnisotropy, 12),
        roughness: 0.9,
      });
      addPlatform(0, 0, 0, 48, 1.2, 48, floorMat);

      // Giant Playground Structures (Slide & Steps)
      const slideMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 });
      const slideTower = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 6), slideMat);
      slideTower.position.set(-11, 4.5, -10);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(5.5, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
      );
      roof.position.set(-11, 11, -10);
      roof.rotation.y = Math.PI / 4;
      stageGroup.add(slideTower, roof);

      const tin = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 2.6, 0.45, 32),
        new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.22 })
      );
      tin.position.set(0, 1.3, 4);
      const candy = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 0.18, 32),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.38 })
      );
      candy.position.set(0, 1.58, 4);
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(7, 1.1, 4.5),
        new THREE.MeshStandardMaterial({ map: createWoodPlankTexture('#6b4423', maxAnisotropy), roughness: 0.75 })
      );
      table.position.set(0, 0.55, 4);
      stageGroup.add(table, tin, candy);

      const guard = createRobloxCharacter({ roleVariant: 'guard_triangle' });
      guard.root.position.set(5, 0, 1);
      guard.root.rotation.y = -0.5;
      stageGroup.add(guard.root);
    } else if (stageId === 's1_tug_of_war') {
      scene.background = new THREE.Color(0x0c1322);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(0x0c1322);
      timerSec = 55;
      spawnPos.set(0, 18, 12);
      tugBalance = 52;
      signalText = 'PULL ROPE!';
      signalTone = 'gold';

      const steelMat = new THREE.MeshStandardMaterial({
        map: createStudTexture('#334155', maxAnisotropy, 6, 10),
        metalness: 0.68,
        roughness: 0.38,
      });
      addPlatform(0, 18, 13, 12, 1.4, 20, steelMat);
      addPlatform(0, 18, -13, 12, 1.4, 20, steelMat);

      tugGroup = new THREE.Group();
      stageGroup.add(tugGroup);

      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 32, 12),
        new THREE.MeshStandardMaterial({ color: 0xd6b376, roughness: 0.85 })
      );
      rope.rotation.x = Math.PI / 2;
      rope.position.set(0, 19.4, 0);
      tugGroup.add(rope);

      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.8, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.6 })
      );
      flag.position.set(0, 19.1, 0);
      tugGroup.add(flag);

      for (let i = 0; i < 4; i++) {
        const mate = createRobloxCharacter({ roleVariant: 'contestant', jerseyNumber: `0${i + 2}1` });
        mate.root.position.set(i % 2 === 0 ? -1.1 : 1.1, 18, 7 + i * 2.5);
        mate.root.rotation.y = Math.PI;
        tugGroup.add(mate.root);

        const rival = createRobloxCharacter({ roleVariant: 'contestant', jerseyNumber: `1${i + 1}4`, shirtHex: 0x115e59 });
        rival.root.position.set(i % 2 === 0 ? 1.1 : -1.1, 18, -7 - i * 2.5);
        tugGroup.add(rival.root);
      }
    } else if (stageId === 's1_marbles') {
      scene.background = new THREE.Color(0x523426);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(0x523426);
      timerSec = 90;
      spawnPos.set(0, 0, 14);
      marblesWon = 0;
      signalText = 'HIT GOLD RING (0/5)';
      signalTone = 'gold';

      const alleyFloor = new THREE.MeshStandardMaterial({
        map: createSandTexture(maxAnisotropy, 12),
        roughness: 0.9,
      });
      addPlatform(0, 0, 0, 28, 1.2, 46, alleyFloor);

      const brickMat = new THREE.MeshStandardMaterial({
        map: createWoodPlankTexture('#6e4830', maxAnisotropy, 6, 3),
        roughness: 0.85,
      });
      for (const sx of [-11, 11]) {
        for (const sz of [-14, 0, 14]) {
          const house = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 11), brickMat);
          house.position.set(sx, 3.5, sz);
          stageGroup.add(house);
        }
      }

      marbleTargetMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.3, 0.14, 12, 28),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 1.4 })
      );
      marbleTargetMesh.rotation.x = Math.PI / 2;
      marbleTargetMesh.position.set(0, 0.08, -9);
      stageGroup.add(marbleTargetMesh);

      const p001 = createRobloxCharacter({ roleVariant: 'contestant', jerseyNumber: '001', hairHex: 0xd1d5db });
      p001.root.position.set(3.2, 0, -8);
      stageGroup.add(p001.root);
    } else if (stageId === 's1_glass_bridge') {
      scene.background = new THREE.Color(0x0c0716);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.setHex(0x0c0716);
        scene.fog.near = 45;
        scene.fog.far = 165;
      }
      timerSec = 180;
      spawnPos.set(0, 14, 46);
      finishZ = -56;
      signalText = '18-STEP GLASS BRIDGE';
      signalTone = 'info';

      const deckMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.45, metalness: 0.5 });
      addPlatform(0, 14, 46, 14, 1.4, 12, deckMat);
      addPlatform(0, 14, -56, 16, 1.4, 14, deckMat);

      const railMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.1,
      });
      for (const rx of [-3.8, 0, 3.8]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 92), railMat);
        beam.position.set(rx, 13.7, -5);
        stageGroup.add(beam);
      }

      // Authentic Season 1: 18 Pairs of Tempered vs Fragile Glass Panels!
      for (let step = 0; step < 18; step++) {
        const z = 37 - step * 4.9;
        const leftTempered = Math.random() > 0.5;
        for (const side of [-1, 1] as const) {
          const tempered = side === -1 ? leftTempered : !leftTempered;
          const x = side * 1.9;
          const glassMat = new THREE.MeshPhysicalMaterial({
            color: tempered ? 0xa5f3fc : 0xe2e8f0,
            roughness: tempered ? 0.08 : 0.28,
            metalness: 0.08,
            transmission: 0.72,
            transparent: true,
            opacity: tempered ? 0.72 : 0.6,
            ior: tempered ? 1.55 : 1.45,
          });
          const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 3.9), glassMat);
          panel.position.set(x, 13.88, z);
          stageGroup.add(panel);

          const pBox: PlatformBox = {
            minX: x - 1.6,
            maxX: x + 1.6,
            minZ: z - 1.95,
            maxZ: z + 1.95,
            y: 14,
          };
          platforms.push(pBox);
          glassPanels.push({ mesh: panel, box: pBox, tempered, broken: false });
        }
      }
    } else if (stageId === 's1_squid_duel') {
      scene.background = new THREE.Color(0x090d16);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(0x090d16);
      timerSec = 95;
      spawnPos.set(0, 0, 18);
      signalText = 'SQUID FINALE';
      signalTone = 'gold';

      const courtMat = new THREE.MeshStandardMaterial({
        map: createSquidCourtTexture(maxAnisotropy),
        roughness: 0.85,
      });
      addPlatform(0, 0, 0, 32, 1.2, 42, courtMat);

      const headRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.5, 0.16, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.5 })
      );
      headRing.rotation.x = Math.PI / 2;
      headRing.position.set(0, 0.08, -13);
      stageGroup.add(headRing);

      const rRig = createRobloxCharacter({
        roleVariant: 'contestant',
        jerseyNumber: '218',
        faceMood: 'focused',
      });
      rRig.root.position.set(0, 0, -6);
      stageGroup.add(rRig.root);
      rival218 = {
        rig: rRig,
        x: 0,
        y: 0,
        z: -6,
        vx: 0,
        vz: 0,
        alive: true,
        speed: 4.8,
        phaseOffset: 0,
      };
    }

    spawnPlayerAt(spawnPos);
  };

  buildStage(currentStageId);

  const getHudSnapshot = (): RobloxHudState => {
    const info = SQUID_STAGES.find((s) => s.id === currentStageId) ?? SQUID_STAGES[0];
    let actionLabel: string | null = null;
    if (currentStageId === 's1_tug_of_war') actionLabel = 'PULL ROPE';
    else if (currentStageId === 's1_marbles') actionLabel = 'TOSS';
    else if (currentStageId === 's1_squid_duel') actionLabel = 'PUSH';

    return {
      worldTitle: 'SQUID GAME · S1',
      stageLabel: `${info.episodeNum}/6 · ${info.title}`,
      timerSec: Math.max(0, Math.ceil(timerSec)),
      score,
      scoreLabel: '₩M',
      lives,
      maxLives,
      phase,
      signalText,
      signalTone,
      actionLabel,
      secondaryActionLabel: null,
      canSwitchStage: true,
      squidStageId: currentStageId,
      dalgona:
        currentStageId === 's1_dalgona'
          ? {
              active: phase === 'playing',
              shape: dalgonaShape,
              progress: dalgonaProgress,
              cracks: dalgonaCracks,
              done: dalgonaProgress >= 100,
              failed: dalgonaCracks >= 100,
            }
          : null,
      minigamePrompt:
        currentStageId === 's1_tug_of_war'
          ? {
              title: 'Rope Tension',
              meter: tugBalance,
              targetLabel: `${Math.round(tugBalance)}%`,
            }
          : null,
    };
  };

  const loseLifeOrEliminate = (reason: string) => {
    robloxAudio.playElimination();
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      phase = 'eliminated';
      signalText = reason;
      signalTone = 'red';
    } else {
      signalText = reason;
      signalTone = 'red';
      spawnPlayerAt(spawnPos);
    }
  };

  const markStageClear = (bonusScore: number, msg: string) => {
    score += bonusScore;
    phase = currentStageId === 's1_squid_duel' ? 'victory' : 'stage_clear';
    signalText = msg;
    signalTone = 'gold';
    robloxAudio.playVictory();
  };

  const update = (
    dt: number,
    elapsed: number,
    input: PlayerInputState,
    yaw: number,
    _pitch: number,
    isFirstPerson: boolean,
    serverCtx?: ServerWorldContext | null
  ): RobloxHudState => {
    playerRig.setFirstPersonHidden(isFirstPerson);

    if (phase !== 'playing') {
      animateRobloxCharacter(playerRig, 0, grounded, elapsed, 0);
      return getHudSnapshot();
    }

    timerSec -= dt;
    if (timerSec <= 0) {
      timerSec = 0;
      loseLifeOrEliminate('TIME UP');
      return getHudSnapshot();
    }

    if (actionTimer > 0) actionTimer = Math.max(0, actionTimer - dt);

    _forward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    _right.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();

    // Natural deliberate Roblox stride speed (not frantic!)
    const moveSpeed = input.sprint ? 9.4 : 6.4;
    const isMovementDisabled = currentStageId === 's1_tug_of_war' || currentStageId === 's1_dalgona';

    let targetVx = 0;
    let targetVz = 0;
    if (!isMovementDisabled) {
      targetVx = (_forward.x * -input.moveZ + _right.x * input.moveX) * moveSpeed;
      targetVz = (_forward.z * -input.moveZ + _right.z * input.moveX) * moveSpeed;
    }

    vx = THREE.MathUtils.damp(vx, targetVx, 9.5, dt);
    vz = THREE.MathUtils.damp(vz, targetVz, 9.5, dt);

    if (input.jumpPressed && grounded && !isMovementDisabled) {
      vy = 11.4;
      grounded = false;
      robloxAudio.playJump();
    }

    vy -= 26 * dt;
    px += vx * dt;
    pz += vz * dt;
    py += vy * dt;

    const floorY = groundHeightAt(px, pz);
    if (py <= floorY && floorY > -25) {
      py = floorY;
      vy = 0;
      grounded = true;
    } else if (py > floorY + 0.08) {
      grounded = false;
    }

    if (py < -12) {
      loseLifeOrEliminate('FELL!');
      return getHudSnapshot();
    }

    const horizSpeed = Math.hypot(vx, vz);
    if (grounded && horizSpeed > 1.2) {
      robloxAudio.playFootstep(performance.now());
    }

    playerRig.root.position.set(px, py, pz);
    if (horizSpeed > 0.45) {
      playerYawFacing = smoothRotateYaw(playerYawFacing, Math.atan2(vx, vz), dt, 10);
      playerRig.root.rotation.y = playerYawFacing;
    } else if (isFirstPerson) {
      playerYawFacing = yaw;
      playerRig.root.rotation.y = yaw;
    }

    animateRobloxCharacter(playerRig, horizSpeed, grounded, elapsed, actionTimer);

    if (currentStageId === 's1_red_light') {
      // Follow authoritative server phase when synced across 25 players!
      if (serverCtx && (serverCtx.phase === 'green_light' || serverCtx.phase === 'turning' || serverCtx.phase === 'red_light')) {
        const nextRl =
          serverCtx.phase === 'green_light' ? 'green' : serverCtx.phase === 'turning' ? 'turning' : 'red';
        if (nextRl !== rlState) {
          rlState = nextRl;
          if (rlState === 'red') robloxAudio.playLaserScan();
        }
      } else {
        rlTimer -= dt;
        if (rlState === 'green' && rlTimer <= 0) {
          rlState = 'turning';
          rlTimer = 0.8;
        } else if (rlState === 'turning' && rlTimer <= 0) {
          rlState = 'red';
          rlTimer = 2.8 + Math.random() * 1.2;
          robloxAudio.playLaserScan();
        } else if (rlState === 'red' && rlTimer <= 0) {
          rlState = 'green';
          rlTimer = 3.2 + Math.random() * 1.6;
        }
      }

      if (rlState === 'green') {
        if (dollHeadPivot) dollHeadPivot.rotation.y = THREE.MathUtils.damp(dollHeadPivot.rotation.y, Math.PI, 8, dt);
        if (dollScanCone) dollScanCone.visible = false;
        signalText = 'GREEN LIGHT';
        signalTone = 'green';
        chantTick += dt;
        if (chantTick > 0.65) {
          chantTick = 0;
          robloxAudio.playDollChant(Math.floor(elapsed * 2));
        }
      } else if (rlState === 'turning') {
        if (dollHeadPivot) dollHeadPivot.rotation.y = THREE.MathUtils.damp(dollHeadPivot.rotation.y, 0, 12, dt);
        signalText = 'HOLD STILL!';
        signalTone = 'gold';
      } else {
        if (dollHeadPivot) dollHeadPivot.rotation.y = 0;
        if (dollScanCone) dollScanCone.visible = true;
        signalText = 'RED LIGHT!';
        signalTone = 'red';
        if (horizSpeed > 1.35 || !grounded) {
          loseLifeOrEliminate('MOVED ON RED!');
          return getHudSnapshot();
        }
      }

      for (const npc of npcs) {
        if (!npc.alive) continue;
        if (rlState === 'green') {
          npc.z -= npc.speed * dt;
          npc.rig.root.position.set(npc.x, 0, npc.z);
          animateRobloxCharacter(npc.rig, npc.speed, true, elapsed + npc.phaseOffset, 0);
        } else if (rlState === 'red' && Math.random() < 0.006) {
          npc.alive = false;
          npc.rig.root.rotation.x = Math.PI / 2;
          npc.rig.root.position.y = 0.4;
          robloxAudio.playGunshot();
        } else {
          animateRobloxCharacter(npc.rig, 0, true, elapsed + npc.phaseOffset, 0);
        }
      }

      if (pz <= finishZ) {
        markStageClear(450, 'STAGE 1 CLEAR!');
      }
    } else if (currentStageId === 's1_tug_of_war') {
      tugBalance -= dt * 10.5;
      if (input.actionPressed || input.jumpPressed) {
        actionTimer = 0.25;
        tugBalance += 6.0;
        robloxAudio.playClick();
      }
      tugBalance = THREE.MathUtils.clamp(tugBalance, 0, 100);
      if (tugGroup) tugGroup.position.z = ((tugBalance - 50) / 50) * 4.2;
      if (tugBalance >= 98) markStageClear(500, 'TUG OF WAR WON!');
      else if (tugBalance <= 2) loseLifeOrEliminate('PULLED DOWN!');
    } else if (currentStageId === 's1_marbles') {
      if (marbleTargetMesh) {
        marbleTargetMesh.position.x = Math.sin(elapsed * 1.2) * 3.8;
      }
      if (input.actionPressed) {
        actionTimer = 0.3;
        const mMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 14, 14),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.9,
            metalness: 0.7,
            roughness: 0.15,
          })
        );
        mMesh.position.set(px, 1.2, pz - 0.8);
        stageGroup.add(mMesh);
        marbleBalls.push({
          mesh: mMesh,
          vx: Math.sin(yaw) * 14,
          vy: 4.5,
          vz: Math.cos(yaw) * 14,
          active: true,
        });
        robloxAudio.playClick();
      }
      for (const b of marbleBalls) {
        if (!b.active) continue;
        b.vy -= 18 * dt;
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.y += b.vy * dt;
        b.mesh.position.z += b.vz * dt;
        if (b.mesh.position.y <= 0.28) {
          b.mesh.position.y = 0.28;
          b.active = false;
          if (marbleTargetMesh) {
            const dist = Math.hypot(
              b.mesh.position.x - marbleTargetMesh.position.x,
              b.mesh.position.z - marbleTargetMesh.position.z
            );
            if (dist < 2.3) {
              marblesWon += 1;
              robloxAudio.playCoin();
              signalText = `MARBLES ${marblesWon}/5`;
              signalTone = 'green';
              if (marblesWon >= 5) markStageClear(550, 'MARBLES WON!');
            }
          }
        }
      }
    } else if (currentStageId === 's1_glass_bridge') {
      for (const gp of glassPanels) {
        if (gp.broken) continue;
        if (
          px >= gp.box.minX &&
          px <= gp.box.maxX &&
          pz >= gp.box.minZ &&
          pz <= gp.box.maxZ &&
          py <= 14.25
        ) {
          if (!gp.tempered) {
            gp.broken = true;
            gp.mesh.visible = false;
            gp.box.y = -50;
            robloxAudio.playGlassShatter();
            signalText = 'SHATTERED!';
            signalTone = 'red';
          }
        }
      }
      if (pz <= finishZ) markStageClear(750, '18-STEP BRIDGE CLEARED!');
    } else if (currentStageId === 's1_squid_duel' && rival218) {
      if (rival218.alive) {
        const dx = px - rival218.x;
        const dz = pz - rival218.z;
        const dist = Math.hypot(dx, dz) || 1;
        rival218.vx = THREE.MathUtils.damp(rival218.vx, (dx / dist) * 4.4, 5, dt);
        rival218.vz = THREE.MathUtils.damp(rival218.vz, (dz / dist) * 4.4, 5, dt);
        rival218.x += rival218.vx * dt;
        rival218.z += rival218.vz * dt;
        rival218.rig.root.position.set(rival218.x, 0, rival218.z);
        rival218.rig.root.rotation.y = Math.atan2(rival218.vx, rival218.vz);
        animateRobloxCharacter(rival218.rig, Math.hypot(rival218.vx, rival218.vz), true, elapsed, 0);

        if (input.actionPressed && dist < 3.6) {
          actionTimer = 0.35;
          rival218.vx = (-dx / dist) * 20;
          rival218.vz = (-dz / dist) * 20;
          robloxAudio.playSlash();
          score += 100;
        } else if (dist < 1.35) {
          vx += (dx / dist) * 8;
          vz += (dz / dist) * 8;
        }
        if (Math.abs(rival218.x) > 16 || Math.abs(rival218.z) > 21) {
          rival218.alive = false;
          rival218.rig.root.visible = false;
          markStageClear(1000, '₩45.6B WINNER!');
        }
      }
      if (Math.hypot(px - 0, pz - -13) < 2.5) markStageClear(1000, '₩45.6B WINNER!');
    }

    return getHudSnapshot();
  };

  return {
    update,
    getPlayerPosition: (out: THREE.Vector3) => out.copy(_playerOut.set(px, py, pz)),
    getPlayerYaw: () => playerYawFacing,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      customAvatar = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter({
        skinHex: cfg.skinHex,
        hairHex: cfg.hairHex,
        shirtHex: 0x0f6b63,
        pantsHex: 0x0c544e,
        jerseyNumber: '456',
        roleVariant: 'contestant',
        faceMood: cfg.faceMood,
        hatStyle: cfg.hatStyle,
        accessory: cfg.accessory,
      });
      playerRig.root.position.set(px, py, pz);
      playerRig.root.rotation.y = playerYawFacing;
      scene.add(playerRig.root);
    },
    setSquidStage: (stageId: SquidStageId) => {
      lives = maxLives;
      buildStage(stageId);
    },
    submitDalgonaProgress: (progress, cracks, failed, completed) => {
      dalgonaProgress = progress;
      dalgonaCracks = cracks;
      if (failed && phase === 'playing') loseLifeOrEliminate('CRACKED!');
      else if (completed && phase === 'playing') markStageClear(500, 'DALGONA CLEAR!');
    },
    reset: () => {
      lives = maxLives;
      buildStage(currentStageId);
    },
    dispose: () => {
      clearStageObjects();
      scene.remove(stageGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}
