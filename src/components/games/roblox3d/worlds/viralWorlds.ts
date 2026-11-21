import * as THREE from 'three';
import type { RobloxAvatarConfig } from '../../../../types';
import {
  animateRobloxCharacter,
  createRobloxCharacter,
  DEFAULT_ROBLOX_AVATAR,
  smoothRotateYaw,
  type RobloxCharacterRig,
} from '../robloxCharacter';
import {
  createAsphaltRoadTexture,
  createCheckerTexture,
  createCloudClusters,
  createGrassTexture,
  createRobloxSkyDome,
  createSandTexture,
  createStudTexture,
  createThreePointLights,
  createWoodPlankTexture,
  updateSunShadowTarget,
} from '../robloxRenderer';
import { robloxAudio } from '../robloxAudio';
import type {
  PlayerInputState,
  RobloxHudState,
  RobloxWorldId,
  ServerWorldContext,
  WorldController,
} from '../types';

interface PlatformDef {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  mesh?: THREE.Mesh;
  movingOffset?: { baseX: number; ampX: number; speed: number };
  bounce?: boolean;
}

const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _pOut = new THREE.Vector3();

function disposeGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const c = group.children[0];
    group.remove(c);
    c.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          std.map?.dispose();
          mat.dispose();
        }
      }
    });
  }
}

function buildAvatarStyle(cfg: RobloxAvatarConfig) {
  return {
    skinHex: cfg.skinHex,
    shirtHex: cfg.shirtHex,
    pantsHex: cfg.pantsHex,
    hairHex: cfg.hairHex,
    hatStyle: cfg.hatStyle,
    faceMood: cfg.faceMood,
    accessory: cfg.accessory,
  };
}

// ==========================================
// 1. MEGA TOWER OF OBBY: 40-STAGE CLIMB
// ==========================================
function createTowerObbyWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x6bb8ff);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x88cbff);
    scene.fog.near = 65;
    scene.fog.far = 230;
  }

  const lights = createThreePointLights(scene, { isSoftwareGl, sunColor: 0xfff5db, sunIntensity: 2.3 });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const platforms: PlatformDef[] = [];
  const laserBars: Array<{ mesh: THREE.Mesh; cx: number; cy: number; cz: number; speed: number }> = [];
  const checkpoints: Array<{ x: number; y: number; z: number; stage: number; reached: boolean; pad: THREE.Mesh }> = [];
  let summitCrown: THREE.Mesh | null = null;

  const addPlat = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    extra?: Partial<PlatformDef>
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y - h / 2, z);
    m.receiveShadow = true;
    m.castShadow = true;
    worldGroup.add(m);
    platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y, mesh: m, ...extra });
    return m;
  };

  const build40StageCourse = () => {
    disposeGroup(worldGroup);
    platforms.length = 0;
    laserBars.length = 0;
    checkpoints.length = 0;

    // Cloud sea
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 });
    for (let i = 0; i < 24; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(10 + (i % 4) * 3, 12, 10), cloudMat);
      c.scale.set(1.9, 0.45, 1.5);
      const ang = (i / 24) * Math.PI * 2;
      c.position.set(Math.cos(ang) * (40 + (i % 3) * 28), -15, Math.sin(ang) * (40 + (i % 3) * 28));
      worldGroup.add(c);
    }

    const baseMat = new THREE.MeshStandardMaterial({ map: createStudTexture('#1e293b', maxAnisotropy, 4, 4), roughness: 0.45 });
    const glassMats = [
      new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, emissive: 0x0369a1, emissiveIntensity: 0.25, roughness: 0.12, transmission: 0.4, transparent: true, opacity: 0.86 }),
      new THREE.MeshPhysicalMaterial({ color: 0x10b981, emissive: 0x047857, emissiveIntensity: 0.25, roughness: 0.12, transmission: 0.4, transparent: true, opacity: 0.86 }),
      new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, emissive: 0x9f1239, emissiveIntensity: 0.25, roughness: 0.12, transmission: 0.4, transparent: true, opacity: 0.86 }),
      new THREE.MeshPhysicalMaterial({ color: 0xa855f7, emissive: 0x6b21a8, emissiveIntensity: 0.25, roughness: 0.12, transmission: 0.4, transparent: true, opacity: 0.86 }),
    ];
    const checkMat = new THREE.MeshStandardMaterial({ map: createCheckerTexture('#facc15', '#111827', maxAnisotropy, 3, 3), roughness: 0.35 });
    const laserMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 2.0 });
    const bounceMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.8 });

    // Generate massive 40-Stage Spiral Ascent!
    addPlat(0, 0, 0, 12, 1.4, 12, baseMat);
    const radius = 32;
    let prevX = 0;
    let prevY = 0;
    let prevZ = 0;

    for (let st = 1; st <= 40; st++) {
      const ang = st * 0.42;
      const sx = Math.cos(ang) * radius;
      const sz = Math.sin(ang) * radius;
      const sy = st * 2.4;

      // 2 intermediate stepping tiles between stage checkpoints
      for (let sub = 1; sub <= 2; sub++) {
        const t = sub / 3;
        const ix = THREE.MathUtils.lerp(prevX, sx, t);
        const iz = THREE.MathUtils.lerp(prevZ, sz, t);
        const iy = THREE.MathUtils.lerp(prevY, sy, t);
        const isMoving = st % 4 === 0 && sub === 2;
        const isBounce = st % 5 === 0 && sub === 1;
        addPlat(
          ix,
          iy,
          iz,
          isMoving ? 4.4 : 3.6,
          0.65,
          3.6,
          isBounce ? bounceMat : glassMats[(st + sub) % glassMats.length],
          {
            movingOffset: isMoving ? { baseX: ix, ampX: 3.4, speed: 1.4 + (st % 3) * 0.25 } : undefined,
            bounce: isBounce,
          }
        );
      }

      // Stage Checkpoint Platform
      const cpPad = addPlat(sx, sy, sz, 6.4, 1.0, 6.4, checkMat);
      checkpoints.push({ x: sx, y: sy, z: sz, stage: st, reached: false, pad: cpPad });

      // Rotating Laser Sweeper every 3rd stage
      if (st % 3 === 0) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.2, 10), laserMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(sx, sy + 0.95, sz);
        worldGroup.add(bar);
        laserBars.push({ mesh: bar, cx: sx, cy: sy + 0.95, cz: sz, speed: st % 2 === 0 ? 1.7 : -1.7 });
      }

      prevX = sx;
      prevY = sy;
      prevZ = sz;
    }

    // Space Summit Crown at Stage 40
    summitCrown = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.8, 0),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.6, metalness: 0.9, roughness: 0.1 })
    );
    summitCrown.position.set(prevX, prevY + 2.4, prevZ);
    worldGroup.add(summitCrown);
  };

  build40StageCourse();

  let px = 0;
  let py = 0;
  let pz = 0;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let currentStage = 0;
  let respawnPos = new THREE.Vector3(0, 0, 0);
  let score = 0;
  let phase: RobloxHudState['phase'] = 'playing';
  let signalText: string | null = null;
  let signalTimer = 0;

  const groundHeightAt = (x: number, z: number): number => {
    let best = -50;
    for (const p of platforms) {
      if (x >= p.minX - 0.35 && x <= p.maxX + 0.35 && z >= p.minZ - 0.35 && z <= p.maxZ + 0.35) {
        if (p.y > best && p.y <= py + 2.5) best = p.y;
      }
    }
    return best;
  };

  const respawnAtCheckpoint = (msg: string) => {
    robloxAudio.playElimination();
    px = respawnPos.x;
    py = respawnPos.y + 0.4;
    pz = respawnPos.z;
    vx = 0;
    vy = 0;
    vz = 0;
    signalText = msg;
    signalTimer = 1.6;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp) => {
      playerRig.setFirstPersonHidden(isFp);
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }

      for (const p of platforms) {
        if (p.movingOffset && p.mesh) {
          const nx = p.movingOffset.baseX + Math.sin(elapsed * p.movingOffset.speed) * p.movingOffset.ampX;
          const prevX = p.mesh.position.x;
          const dx = nx - prevX;
          p.mesh.position.x = nx;
          const halfW = (p.maxX - p.minX) / 2;
          p.minX = nx - halfW;
          p.maxX = nx + halfW;
          if (grounded && px >= p.minX && px <= p.maxX && pz >= p.minZ && pz <= p.maxZ && Math.abs(py - p.y) < 0.3) {
            px += dx;
          }
        }
      }

      for (const lb of laserBars) lb.mesh.rotation.y = elapsed * lb.speed;
      if (summitCrown) summitCrown.rotation.y = elapsed * 2.0;

      if (phase === 'playing') {
        _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
        _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
        const spd = input.sprint ? 9.6 : 6.6;
        vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
        vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);

        if (input.jumpPressed && grounded) {
          vy = 11.8;
          grounded = false;
          robloxAudio.playJump();
        }
        vy -= 26 * dt;
        px += vx * dt;
        py += vy * dt;
        pz += vz * dt;

        const fy = groundHeightAt(px, pz);
        if (py <= fy && fy > -30) {
          py = fy;
          vy = 0;
          grounded = true;
          const bouncePlat = platforms.find(
            (p) => p.bounce && px >= p.minX && px <= p.maxX && pz >= p.minZ && pz <= p.maxZ && Math.abs(py - p.y) < 0.25
          );
          if (bouncePlat) {
            vy = 17.5;
            grounded = false;
            robloxAudio.playJump();
          }
        } else {
          grounded = false;
        }

        for (const lb of laserBars) {
          const cosY = Math.cos(lb.mesh.rotation.y);
          const sinY = Math.sin(lb.mesh.rotation.y);
          const dx = px - lb.cx;
          const dz = pz - lb.cz;
          if (Math.abs(dx * cosY - dz * sinY) < 3.1 && Math.abs(dx * sinY + dz * cosY) < 0.6 && Math.abs(py + 0.8 - lb.cy) < 1.0) {
            respawnAtCheckpoint('LASER HIT!');
            break;
          }
        }

        for (const cp of checkpoints) {
          if (!cp.reached && Math.hypot(px - cp.x, pz - cp.z) < 3.2 && Math.abs(py - cp.y) < 1.6) {
            cp.reached = true;
            currentStage = Math.max(currentStage, cp.stage);
            respawnPos.set(cp.x, cp.y, cp.z);
            score += 100;
            robloxAudio.playCheckpoint();
            signalText = `STAGE ${cp.stage}/40`;
            signalTimer = 1.8;
          }
        }

        if (summitCrown && Math.hypot(px - summitCrown.position.x, pz - summitCrown.position.z) < 3.2 && py > 92) {
          phase = 'victory';
          score += 2000;
          robloxAudio.playVictory();
          signalText = 'SUMMIT CHAMPION!';
          signalTimer = 4;
        }

        if (py < respawnPos.y - 16) {
          respawnAtCheckpoint('RESPAWNED');
        }
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.45) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, 0);

      return {
        worldTitle: 'OBBY 40',
        stageLabel: `Stage ${currentStage}/40`,
        timerSec: null,
        score,
        scoreLabel: 'PTS',
        lives: 1,
        maxLives: 1,
        phase,
        signalText,
        signalTone: 'gold',
        actionLabel: null,
        secondaryActionLabel: null,
        canSwitchStage: false,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      currentStage = 0;
      score = 0;
      phase = 'playing';
      respawnPos.set(0, 0, 0);
      px = 0;
      py = 0;
      pz = 0;
      build40StageCourse();
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 2. BROOKHAVEN MEGA CITY RP (240m x 240m)
// ==========================================
function createBrookhavenWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0xfdba74);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0xfdba74);
    scene.fog.near = 75;
    scene.fog.far = 250;
  }

  const lights = createThreePointLights(scene, { isSoftwareGl, sunColor: 0xffd199, sunIntensity: 2.2 });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  // Massive 240x240 City Base + Beach Ocean
  const grass = new THREE.Mesh(
    new THREE.BoxGeometry(240, 1, 240),
    new THREE.MeshStandardMaterial({ map: createStudTexture('#4d7c0f', maxAnisotropy, 32, 32), roughness: 0.88 })
  );
  grass.position.y = -0.5;
  grass.receiveShadow = true;
  worldGroup.add(grass);

  const roadMat = new THREE.MeshStandardMaterial({ map: createAsphaltRoadTexture(maxAnisotropy, 1, 24), roughness: 0.72 });
  for (const offset of [-50, 0, 50]) {
    const rNS = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 232), roadMat);
    rNS.position.set(offset, 0.04, 0);
    rNS.receiveShadow = true;
    const rEW = new THREE.Mesh(new THREE.BoxGeometry(232, 0.08, 11), roadMat);
    rEW.rotation.y = Math.PI / 2;
    rEW.position.set(0, 0.03, offset);
    rEW.receiveShadow = true;
    worldGroup.add(rNS, rEW);
  }

  // City Landmarks: Skyscrapers, Bank Vault, Police HQ, Hospital, Luxury Villas, Airport Runway, Beach
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, roughness: 0.08, transmission: 0.55, transparent: true, opacity: 0.8 });
  const buildings: Array<[number, number, number, number, number, number]> = [
    [-25, 16, -25, 18, 32, 18], // Downtown Tower
    [25, 12, -25, 16, 24, 16],  // Bank HQ
    [-25, 9, 25, 18, 18, 16],   // Hospital
    [25, 7, 25, 16, 14, 15],    // Police HQ
    [-75, 5, -25, 18, 10, 14],  // Luxury Villa 1
    [-75, 5, 25, 18, 10, 14],   // Luxury Villa 2
    [75, 4, -25, 16, 8, 14],    // Sunset Cafe
    [75, 14, 25, 20, 28, 18],   // Grand Hotel
  ];
  const buildingColors = [0x334155, 0xfbbf24, 0xf8fafc, 0x1d4ed8, 0xfef2f2, 0xe0f2fe, 0xf97316, 0x475569];
  buildings.forEach(([bx, by, bz, bw, bh, bd], idx) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(bw, bh, bd),
      new THREE.MeshStandardMaterial({ color: buildingColors[idx % buildingColors.length], roughness: 0.45 })
    );
    mesh.position.set(bx, by, bz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const win = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.72, bh * 0.72, bd + 0.2), glassMat);
    win.position.set(bx, by + 0.5, bz);
    worldGroup.add(mesh, win);
  });

  // Collectibles across city (Bank Cash Bags)
  const cashBags: Array<{ x: number; z: number; mesh: THREE.Mesh; respawn: number }> = [];
  for (let i = 0; i < 12; i++) {
    const cx = ((i * 47) % 160) - 80;
    const cz = ((i * 67) % 160) - 80;
    const bag = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.75, 0),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 1.1 })
    );
    bag.position.set(cx, 1.2, cz);
    worldGroup.add(bag);
    cashBags.push({ x: cx, z: cz, mesh: bag, respawn: 0 });
  }

  let px = 0;
  let py = 0;
  let pz = 18;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let inCar = false;
  let cash = 500;
  let localSkyMode: 'sunset' | 'day' | 'night' = 'sunset';

  const applySky = (mode: string) => {
    if (mode === 'day') {
      scene.background = new THREE.Color(0x7dd3fc);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(0x7dd3fc);
      lights.sun.intensity = 2.5;
      lights.sun.color.setHex(0xfffbeb);
    } else if (mode === 'sunset') {
      scene.background = new THREE.Color(0xfdba74);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(0xfdba74);
      lights.sun.intensity = 2.2;
      lights.sun.color.setHex(0xffb86c);
    } else {
      scene.background = new THREE.Color(0x090f1f);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(0x090f1f);
      lights.sun.intensity = 0.7;
      lights.sun.color.setHex(0x93c5fd);
    }
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp, serverCtx) => {
      playerRig.setFirstPersonHidden(isFp);

      if (serverCtx && (serverCtx.phase === 'day' || serverCtx.phase === 'sunset' || serverCtx.phase === 'night')) {
        if (localSkyMode !== serverCtx.phase) {
          localSkyMode = serverCtx.phase;
          applySky(localSkyMode);
        }
      }

      if (input.actionPressed) {
        inCar = !inCar;
        playerRig.setCarMode(inCar);
        robloxAudio.playClick();
      }
      if (input.secondaryPressed) {
        localSkyMode = localSkyMode === 'sunset' ? 'night' : localSkyMode === 'night' ? 'day' : 'sunset';
        applySky(localSkyMode);
        robloxAudio.playClick();
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = inCar ? 18.5 : input.sprint ? 9.6 : 6.5;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 9, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 9, dt);
      if (input.jumpPressed && grounded && !inCar) {
        vy = 11.4;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -112, 112);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -112, 112);
      py = Math.max(0, py + vy * dt);
      if (py <= 0) {
        py = 0;
        vy = 0;
        grounded = true;
      }

      for (const b of cashBags) {
        if (b.respawn > 0) {
          b.respawn -= dt;
          if (b.respawn <= 0) b.mesh.visible = true;
        } else {
          b.mesh.rotation.y = elapsed * 2;
          if (Math.hypot(px - b.x, pz - b.z) < 2.6) {
            b.respawn = 20;
            b.mesh.visible = false;
            cash += 250;
            robloxAudio.playCoin();
          }
        }
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, 0);

      return {
        worldTitle: 'BROOKHAVEN CITY',
        stageLabel: inCar ? 'Sports Car' : localSkyMode.toUpperCase(),
        timerSec: null,
        score: cash,
        scoreLabel: '$',
        lives: 1,
        maxLives: 1,
        phase: 'playing',
        signalText: null,
        signalTone: 'info',
        actionLabel: inCar ? 'EXIT CAR' : 'CAR',
        secondaryActionLabel: 'SKY',
        canSwitchStage: false,
        inCar,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt: () => 0,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
      playerRig.setCarMode(inCar);
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      pz = 18;
      inCar = false;
      playerRig.setCarMode(false);
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 3. BLOX SEA: 5-ISLAND PIRATE RPG
// ==========================================
function createBloxArenaWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0xf97316);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0xfb923c);
    scene.fog.near = 70;
    scene.fog.far = 250;
  }

  const lights = createThreePointLights(scene, { isSoftwareGl, sunColor: 0xffe4b5, sunIntensity: 2.3 });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter({ ...buildAvatarStyle(avatarCfg), accessory: 'aura' });
  scene.add(playerRig.root);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshPhysicalMaterial({ color: 0x0d9488, roughness: 0.16, metalness: 0.25 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.35;
  worldGroup.add(sea);

  // 5 Distinct Islands connected by wooden sea docks!
  const islands: Array<{ name: string; x: number; z: number; r: number; color: string }> = [
    { name: 'Starter Town', x: 0, z: 0, r: 24, color: '#a3e635' },
    { name: 'Jungle Ruins', x: 0, z: -72, r: 26, color: '#15803d' },
    { name: 'Volcano Fort', x: 75, z: -72, r: 26, color: '#991b1b' },
    { name: 'Frozen Citadel', x: -75, z: -72, r: 26, color: '#7dd3fc' },
    { name: 'Sky Temple Boss', x: 0, z: -145, r: 28, color: '#facc15' },
  ];
  const platforms: PlatformDef[] = [];
  const woodMat = new THREE.MeshStandardMaterial({ map: createWoodPlankTexture('#6b4423', maxAnisotropy), roughness: 0.8 });

  for (const isl of islands) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.r, isl.r + 3, 2.2, 24),
      new THREE.MeshStandardMaterial({ map: createStudTexture(isl.color, maxAnisotropy, 10, 10), roughness: 0.82 })
    );
    m.position.set(isl.x, -1.0, isl.z);
    m.receiveShadow = true;
    worldGroup.add(m);
    platforms.push({ minX: isl.x - isl.r, maxX: isl.x + isl.r, minZ: isl.z - isl.r, maxZ: isl.z + isl.r, y: 0 });
  }

  // Connecting Wooden Sea Bridges
  const bridgeDefs: Array<[number, number, number, number]> = [
    [0, -36, 5.5, 42],
    [37, -72, 42, 5.5],
    [-37, -72, 42, 5.5],
    [0, -108, 5.5, 42],
  ];
  for (const [bx, bz, bw, bd] of bridgeDefs) {
    const bm = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.7, bd), woodMat);
    bm.position.set(bx, -0.15, bz);
    worldGroup.add(bm);
    platforms.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, y: 0 });
  }

  const blastRing = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 2.4, 28),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0 })
  );
  blastRing.rotation.x = -Math.PI / 2;
  blastRing.position.y = 0.25;
  worldGroup.add(blastRing);

  const enemies: Array<{ rig: RobloxCharacterRig; x: number; z: number; homeX: number; homeZ: number; hp: number; maxHp: number; boss: boolean; respawn: number }> = [];
  for (let i = 0; i < islands.length; i++) {
    const isl = islands[i];
    const count = i === 4 ? 1 : 3;
    for (let k = 0; k < count; k++) {
      const isBoss = i === 4;
      const rig = createRobloxCharacter({
        shirtHex: isBoss ? 0x7e22ce : 0xb91c1c,
        scale: isBoss ? 1.8 : 1.05,
        hatStyle: isBoss ? 'crown' : 'bandana',
      });
      const ex = isl.x + (k - 1) * 7;
      const ez = isl.z + (k % 2 === 0 ? -5 : 5);
      rig.root.position.set(ex, 0, ez);
      worldGroup.add(rig.root);
      enemies.push({
        rig,
        x: ex,
        z: ez,
        homeX: isl.x,
        homeZ: isl.z,
        hp: isBoss ? 15 : 3 + i,
        maxHp: isBoss ? 15 : 3 + i,
        boss: isBoss,
        respawn: 0,
      });
    }
  }

  let px = 0;
  let py = 0;
  let pz = 6;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let bounty = 0;
  let level = 1;
  let xp = 0;
  let lives = 5;
  let blastTimer = 0;
  let pendingBossDamage = 0;

  const groundHeightAt = (x: number, z: number): number => {
    for (const p of platforms) {
      if (x >= p.minX - 0.5 && x <= p.maxX + 0.5 && z >= p.minZ - 0.5 && z <= p.maxZ + 0.5) return p.y;
    }
    return -0.35;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp) => {
      playerRig.setFirstPersonHidden(isFp);

      if (blastTimer > 0) {
        blastTimer = Math.max(0, blastTimer - dt);
        const t = 1 - blastTimer / 0.35;
        blastRing.scale.setScalar(1 + t * 5.5);
        (blastRing.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
      } else {
        (blastRing.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 10.6 : 7.2;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
      if (input.jumpPressed && grounded) {
        vy = 11.8;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -140, 140);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -180, 40);
      py += vy * dt;
      const fy = groundHeightAt(px, pz);
      if (py <= fy) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      pendingBossDamage = 0;
      if (input.actionPressed && blastTimer <= 0.05) {
        blastTimer = 0.35;
        blastRing.position.set(px, py + 0.25, pz);
        robloxAudio.playSlash();
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - px, e.z - pz);
          if (d < 8.0) {
            e.hp -= 1 + Math.floor(level / 10);
            if (e.boss) pendingBossDamage += 120;
            if (e.hp <= 0) {
              e.rig.root.visible = false;
              e.respawn = e.boss ? 25 : 10;
              bounty += e.boss ? 2500 : 350;
              xp += e.boss ? 300 : 80;
              while (xp >= 150) {
                xp -= 150;
                level = Math.min(100, level + 1);
              }
              robloxAudio.playCoin();
            }
          }
        }
      }

      for (const e of enemies) {
        if (e.hp <= 0) {
          e.respawn -= dt;
          if (e.respawn <= 0) {
            e.hp = e.maxHp;
            e.x = e.homeX;
            e.z = e.homeZ;
            e.rig.root.visible = true;
          }
          continue;
        }
        const dx = px - e.x;
        const dz = pz - e.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < 22) {
          e.x += (dx / d) * 3.8 * dt;
          e.z += (dz / d) * 3.8 * dt;
          e.rig.root.rotation.y = Math.atan2(dx, dz);
          animateRobloxCharacter(e.rig, 3.8, true, elapsed, 0);
        } else {
          animateRobloxCharacter(e.rig, 0, true, elapsed, 0);
        }
        e.rig.root.position.set(e.x, 0, e.z);
        if (d < 1.8) {
          lives--;
          robloxAudio.playElimination();
          e.x -= (dx / d) * 6;
          e.z -= (dz / d) * 6;
          if (lives <= 0) {
            lives = 5;
            px = 0;
            pz = 6;
          }
        }
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, blastTimer);

      const nearestIsl = islands.reduce((best, cur) =>
        Math.hypot(px - cur.x, pz - cur.z) < Math.hypot(px - best.x, pz - best.z) ? cur : best
      );

      return {
        worldTitle: 'BLOX SEA RPG',
        stageLabel: `${nearestIsl.name} · Lv.${level}`,
        timerSec: null,
        score: bounty,
        scoreLabel: 'BOUNTY',
        lives,
        maxLives: 5,
        phase: 'playing',
        signalText: null,
        signalTone: 'gold',
        actionLabel: 'ATTACK',
        secondaryActionLabel: null,
        canSwitchStage: false,
        serverSyncEvent: pendingBossDamage > 0 ? { actionType: 'damage_boss', data: { damage: pendingBossDamage } } : null,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter({ ...buildAvatarStyle(avatarCfg), accessory: 'aura' });
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      pz = 6;
      lives = 5;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 4. SKY BEDWARS: 4-KINGDOM CLASH (25-PLAYER)
// ==========================================
function createBedwarsSkyWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x38bdf8);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x7dd3fc);
    scene.fog.near = 60;
    scene.fog.far = 230;
  }

  const lights = createThreePointLights(scene, { isSoftwareGl, sunColor: 0xfffbeb, sunIntensity: 2.3 });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter({ ...buildAvatarStyle(avatarCfg), accessory: 'back_sword' });
  scene.add(playerRig.root);

  const platforms: PlatformDef[] = [];
  const woodMat = new THREE.MeshStandardMaterial({ map: createWoodPlankTexture('#854d0e', maxAnisotropy), roughness: 0.78 });

  const teams: Array<{ id: string; x: number; z: number; hex: number; bedMesh: THREE.Mesh; broken: boolean }> = [];
  const teamDefs: Array<{ id: string; x: number; z: number; hex: number; css: string }> = [
    { id: 'blue', x: 0, z: 46, hex: 0x2563eb, css: '#2563eb' },
    { id: 'red', x: 0, z: -46, hex: 0xdc2626, css: '#dc2626' },
    { id: 'green', x: -46, z: 0, hex: 0x16a34a, css: '#16a34a' },
    { id: 'yellow', x: 46, z: 0, hex: 0xeab308, css: '#eab308' },
  ];

  // Central Emerald Citadel
  const midCastle = new THREE.Mesh(
    new THREE.BoxGeometry(22, 2, 22),
    new THREE.MeshStandardMaterial({ map: createStudTexture('#475569', maxAnisotropy, 6, 6), roughness: 0.65 })
  );
  midCastle.position.y = -1;
  worldGroup.add(midCastle);
  platforms.push({ minX: -11, maxX: 11, minZ: -11, maxZ: 11, y: 0 });

  // Bridges + 4 Kingdom Islands + Beds
  for (const t of teamDefs) {
    const isl = new THREE.Mesh(
      new THREE.BoxGeometry(20, 2, 20),
      new THREE.MeshStandardMaterial({ map: createStudTexture(t.css, maxAnisotropy, 6, 6), roughness: 0.7 })
    );
    isl.position.set(t.x, -1, t.z);
    worldGroup.add(isl);
    platforms.push({ minX: t.x - 10, maxX: t.x + 10, minZ: t.z - 10, maxZ: t.z + 10, y: 0 });

    const bx = t.x * 0.52;
    const bz = t.z * 0.52;
    const bw = t.x === 0 ? 4.4 : 26;
    const bd = t.z === 0 ? 4.4 : 26;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.6, bd), woodMat);
    bridge.position.set(bx, -0.3, bz);
    worldGroup.add(bridge);
    platforms.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, y: 0 });

    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.1, 4.2),
      new THREE.MeshStandardMaterial({ color: t.hex, emissive: t.hex, emissiveIntensity: 0.35 })
    );
    bed.position.set(t.x, 0.55, t.z);
    worldGroup.add(bed);
    teams.push({ id: t.id, x: t.x, z: t.z, hex: t.hex, bedMesh: bed, broken: false });
  }

  let px = 0;
  let py = 0;
  let pz = 42;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let score = 0;
  let actionTimer = 0;
  let syncBreakTeam: string | null = null;

  const groundHeightAt = (x: number, z: number): number => {
    for (const p of platforms) {
      if (x >= p.minX - 0.35 && x <= p.maxX + 0.35 && z >= p.minZ - 0.35 && z <= p.maxZ + 0.35) return p.y;
    }
    return -40;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp, serverCtx) => {
      playerRig.setFirstPersonHidden(isFp);
      if (actionTimer > 0) actionTimer = Math.max(0, actionTimer - dt);

      if (serverCtx?.phaseData?.bedsAlive) {
        for (const t of teams) {
          const alive = serverCtx.phaseData.bedsAlive[t.id] !== false;
          t.broken = !alive;
          t.bedMesh.visible = alive;
        }
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 9.8 : 6.8;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
      if (input.jumpPressed && grounded) {
        vy = 11.6;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px += vx * dt;
      pz += vz * dt;
      py += vy * dt;
      const fy = groundHeightAt(px, pz);
      if (py <= fy && fy > -20) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      if (py < -12) {
        px = 0;
        py = 0.5;
        pz = 42;
        vx = 0;
        vy = 0;
        vz = 0;
        robloxAudio.playElimination();
      }

      syncBreakTeam = null;
      if (input.actionPressed) {
        actionTimer = 0.3;
        robloxAudio.playSlash();
        for (const t of teams) {
          if (t.id !== 'blue' && !t.broken && Math.hypot(px - t.x, pz - t.z) < 4.5) {
            t.broken = true;
            t.bedMesh.visible = false;
            score += 500;
            syncBreakTeam = t.id;
            robloxAudio.playExplosion();
          }
        }
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, actionTimer);

      const bedsRemaining = teams.filter((t) => !t.broken).length;
      return {
        worldTitle: 'SKY BEDWARS',
        stageLabel: `Beds Left: ${bedsRemaining}/4`,
        timerSec: null,
        score,
        scoreLabel: 'SCORE',
        lives: 1,
        maxLives: 1,
        phase: 'playing',
        signalText: null,
        signalTone: 'gold',
        actionLabel: 'SWORD / BREAK',
        secondaryActionLabel: null,
        canSwitchStage: false,
        serverSyncEvent: syncBreakTeam ? { actionType: 'break_bed', data: { team: syncBreakTeam } } : null,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter({ ...buildAvatarStyle(avatarCfg), accessory: 'back_sword' });
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      py = 0;
      pz = 42;
      for (const t of teams) {
        t.broken = false;
        t.bedMesh.visible = true;
      }
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 5. BILLIONAIRE MEGA TYCOON 3D (30+ UPGRADES)
// ==========================================
function createTycoonEmpireWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x0b1120);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x0b1120);
    scene.fog.near = 60;
    scene.fog.far = 220;
  }

  const lights = createThreePointLights(scene, { isSoftwareGl, sunColor: 0xffd166, sunIntensity: 2.0 });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(160, 1, 160),
    new THREE.MeshStandardMaterial({ map: createStudTexture('#1e293b', maxAnisotropy, 24, 24), roughness: 0.7 })
  );
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  worldGroup.add(floor);

  // Cash Collector Pad + Conveyor + 30 Sequential Upgrade Structures!
  const collectorPad = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.3, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 1.2 })
  );
  collectorPad.position.set(-10, 0.15, 8);
  worldGroup.add(collectorPad);

  const upgrades: Array<{ x: number; z: number; cost: number; bought: boolean; pad: THREE.Mesh; building: THREE.Mesh; rate: number }> = [];
  for (let i = 0; i < 30; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const ux = -14 + col * 7;
    const uz = -20 + row * 7;
    const cost = Math.round(50 * Math.pow(1.22, i));
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.24, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.0 })
    );
    pad.position.set(ux, 0.12, uz);
    const bHeight = 2 + (i % 6) * 1.4;
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, bHeight, 4.5),
      new THREE.MeshStandardMaterial({
        color: i > 24 ? 0xfacc15 : i > 14 ? 0x38bdf8 : 0xe2e8f0,
        metalness: i > 20 ? 0.8 : 0.25,
        roughness: 0.3,
      })
    );
    building.position.set(ux, bHeight / 2, uz - 3);
    building.visible = false;
    worldGroup.add(pad, building);
    upgrades.push({ x: ux, z: uz, cost, bought: false, pad, building, rate: 15 + i * 18 });
  }

  let px = 0;
  let py = 0;
  let pz = 24;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let cash = 120;
  let vaultCash = 0;
  let incomePerSec = 10;
  let builtCount = 0;
  let signalText: string | null = null;
  let signalTimer = 0;

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp) => {
      playerRig.setFirstPersonHidden(isFp);
      vaultCash += incomePerSec * dt;
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 9.8 : 6.6;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
      if (input.jumpPressed && grounded) {
        vy = 11.4;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -75, 75);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -75, 75);
      py = Math.max(0, py + vy * dt);
      if (py <= 0) {
        py = 0;
        vy = 0;
        grounded = true;
      }

      // Collect Cash Vault Pad
      if (Math.hypot(px - -10, pz - 8) < 2.8 && vaultCash >= 1) {
        cash += Math.floor(vaultCash);
        vaultCash = 0;
        robloxAudio.playCoin();
      }

      // Buy Next Tycoon Upgrades by walking onto Blue Pads
      for (const up of upgrades) {
        if (!up.bought && Math.hypot(px - up.x, pz - up.z) < 2.2) {
          if (cash >= up.cost) {
            cash -= up.cost;
            up.bought = true;
            up.pad.visible = false;
            up.building.visible = true;
            incomePerSec += up.rate;
            builtCount++;
            robloxAudio.playCheckpoint();
            signalText = `UPGRADE ${builtCount}/30!`;
            signalTimer = 1.6;
          }
        }
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, 0);

      return {
        worldTitle: 'MEGA TYCOON',
        stageLabel: `${builtCount}/30 Built · Vault $${Math.floor(vaultCash)}`,
        timerSec: null,
        score: cash,
        scoreLabel: '$ CASH',
        lives: 1,
        maxLives: 1,
        phase: builtCount >= 30 ? 'victory' : 'playing',
        signalText,
        signalTone: 'gold',
        actionLabel: null,
        secondaryActionLabel: null,
        canSwitchStage: false,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt: () => 0,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      pz = 24;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 6. NATURAL DISASTER ARCHIPELAGO (SYNCED)
// ==========================================
function createNaturalDisasterWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x1f2d42);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x1f2d42);
    scene.fog.near = 65;
    scene.fog.far = 230;
  }

  const lights = createThreePointLights(scene, { isSoftwareGl, sunColor: 0xffd7a8, sunIntensity: 2.0 });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const platforms: PlatformDef[] = [];
  const addPlat = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y - h / 2, z);
    m.receiveShadow = true;
    m.castShadow = true;
    worldGroup.add(m);
    platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y });
  };

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    new THREE.MeshPhysicalMaterial({ color: 0x0369a1, roughness: 0.16, metalness: 0.25 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.3;
  worldGroup.add(ocean);

  const grassMat = new THREE.MeshStandardMaterial({ map: createStudTexture('#2e7d32', maxAnisotropy, 16, 16), roughness: 0.85 });
  const sandMat = new THREE.MeshStandardMaterial({ map: createSandTexture(maxAnisotropy, 18), roughness: 0.92 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.35 });

  // Huge 120m Island + 5-Floor Climbable Skyscraper + Lighthouse + Mountain Peak
  addPlat(0, 0.2, 0, 110, 1.4, 110, sandMat);
  addPlat(0, 1.4, 0, 82, 1.4, 82, grassMat);
  addPlat(-22, 4.0, -18, 28, 3.0, 28, grassMat); // Mountain Peak

  // 5-Floor Climbable Skyscraper Steps
  for (let f = 0; f < 5; f++) {
    addPlat(20, 3.0 + f * 2.8, 12, 12, 0.6, 12, steelMat);
    addPlat(12.5, 1.8 + f * 2.8, 12, 3.5, 0.5, 3.5, steelMat);
  }

  const tsunamiWave = new THREE.Mesh(
    new THREE.BoxGeometry(130, 11, 10),
    new THREE.MeshPhysicalMaterial({ color: 0x0284c7, roughness: 0.15, transparent: true, opacity: 0.82 })
  );
  tsunamiWave.position.set(0, -14, -70);
  worldGroup.add(tsunamiWave);

  const meteors: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; active: boolean }> = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x451a03, emissive: 0xea580c, emissiveIntensity: 1.5 })
    );
    m.visible = false;
    worldGroup.add(m);
    meteors.push({ mesh: m, vx: 0, vy: 0, vz: 0, active: false });
  }

  let px = 0;
  let py = 1.6;
  let pz = 0;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let score = 0;
  let lives = 5;
  let meteorSpawnTimer = 0;

  const groundHeightAt = (x: number, z: number): number => {
    let best = -40;
    for (const p of platforms) {
      if (x >= p.minX - 0.3 && x <= p.maxX + 0.3 && z >= p.minZ - 0.3 && z <= p.maxZ + 0.3) {
        if (p.y > best && p.y <= py + 2.5) best = p.y;
      }
    }
    return best;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp, serverCtx) => {
      playerRig.setFirstPersonHidden(isFp);
      ocean.position.y = -0.35 + Math.sin(elapsed * 1.8) * 0.14;
      score += Math.round(dt * 12);

      const disaster = String(serverCtx?.phaseData?.disaster || 'METEOR SHOWER');
      const isActiveDisaster = serverCtx ? serverCtx.phase === 'disaster' : true;

      if (isActiveDisaster && (disaster.includes('METEOR') || disaster.includes('VOLCANIC') || disaster.includes('EARTHQUAKE'))) {
        meteorSpawnTimer -= dt;
        if (meteorSpawnTimer <= 0) {
          meteorSpawnTimer = 0.9;
          const slot = meteors.find((m) => !m.active);
          if (slot) {
            slot.active = true;
            slot.mesh.visible = true;
            slot.mesh.position.set((Math.random() - 0.5) * 80, 32, (Math.random() - 0.5) * 80);
            slot.vx = (Math.random() - 0.5) * 5;
            slot.vy = -17;
            slot.vz = (Math.random() - 0.5) * 5;
          }
        }
      }

      for (const m of meteors) {
        if (!m.active) continue;
        m.mesh.position.x += m.vx * dt;
        m.mesh.position.y += m.vy * dt;
        m.mesh.position.z += m.vz * dt;
        if (Math.hypot(m.mesh.position.x - px, m.mesh.position.z - pz) < 2.2 && Math.abs(m.mesh.position.y - py) < 2.4) {
          m.active = false;
          m.mesh.visible = false;
          lives = Math.max(0, lives - 1);
          robloxAudio.playExplosion();
          if (lives <= 0) {
            lives = 5;
            px = 0;
            py = 2;
            pz = 0;
          }
        } else if (m.mesh.position.y < 0.2) {
          m.active = false;
          m.mesh.visible = false;
        }
      }

      if (isActiveDisaster && disaster.includes('TSUNAMI')) {
        tsunamiWave.position.y = 4.6;
        tsunamiWave.position.z += 9.5 * dt;
        if (tsunamiWave.position.z > 65) tsunamiWave.position.z = -68;
        if (Math.abs(pz - tsunamiWave.position.z) < 5.0 && py < 4.5) {
          lives = Math.max(0, lives - 1);
          robloxAudio.playElimination();
          py = 8;
          pz = 12;
          px = 20;
        }
      } else {
        tsunamiWave.position.y = -15;
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 9.8 : 6.6;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
      if (input.jumpPressed && grounded) {
        vy = 11.8;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -52, 52);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -52, 52);
      py += vy * dt;
      const fy = groundHeightAt(px, pz);
      if (py <= fy && fy > -25) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, 0);

      return {
        worldTitle: 'DISASTER ISLAND',
        stageLabel: isActiveDisaster ? disaster : 'CALM',
        timerSec: serverCtx ? serverCtx.phaseTimer : null,
        score,
        scoreLabel: 'SURVIVED',
        lives,
        maxLives: 5,
        phase: 'playing',
        signalText: serverCtx?.phase === 'warning' ? `WARNING: ${disaster}` : null,
        signalTone: 'red',
        actionLabel: null,
        secondaryActionLabel: null,
        canSwitchStage: false,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      py = 1.6;
      pz = 0;
      lives = 5;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 7. DOORS: 100-DOOR GRAND HOTEL CO-OP
// ==========================================
function createDoorsHotelWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x05060b);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x05060b);
    scene.fog.near = 7;
    scene.fog.far = 42;
  }

  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0xfde68a,
    sunIntensity: 0.45,
    hemiSky: 0x1e293b,
    hemiGround: 0x09090b,
    hemiIntensity: 0.35,
  });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const flashlight = new THREE.SpotLight(0xfffbeb, 4.4, 38, Math.PI / 5.0, 0.45, 1.3);
  const flashTarget = new THREE.Object3D();
  scene.add(flashlight, flashTarget);
  flashlight.target = flashTarget;

  // Massive 600-meter Corridor for Doors 001 -> 100
  const carpetMat = new THREE.MeshStandardMaterial({
    map: createCheckerTexture('#7f1d1d', '#450a0a', maxAnisotropy, 4, 80),
    roughness: 0.85,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: createWoodPlankTexture('#452719', maxAnisotropy, 6, 40),
    roughness: 0.72,
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 1, 620), carpetMat);
  floor.position.set(0, -0.5, -295);
  floor.receiveShadow = true;
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(1, 7.5, 620), woodMat);
  wallL.position.set(-5.6, 3.75, -295);
  const wallR = wallL.clone();
  wallR.position.x = 5.6;
  worldGroup.add(floor, wallL, wallR);

  const closets: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < 24; i++) {
    const cx = i % 2 === 0 ? -4.2 : 4.2;
    const cz = -16 - i * 24;
    const closet = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 3.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x2e1a10, roughness: 0.65 })
    );
    closet.position.set(cx, 1.8, cz);
    worldGroup.add(closet);
    closets.push({ x: cx, z: cz });
  }

  const coins: Array<{ x: number; z: number; taken: boolean; mesh: THREE.Mesh }> = [];
  for (let k = 0; k < 25; k++) {
    const kx = k % 2 === 0 ? 2.5 : -2.5;
    const kz = -14 - k * 23;
    const cm = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 1.5 })
    );
    cm.position.set(kx, 1.1, kz);
    worldGroup.add(cm);
    coins.push({ x: kx, z: kz, taken: false, mesh: cm });
  }

  const rushMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x6366f1, emissiveIntensity: 1.9 })
  );
  rushMesh.visible = false;
  worldGroup.add(rushMesh);

  let px = 0;
  let py = 0;
  let pz = 6;
  let facingYaw = Math.PI;
  let vx = 0;
  let vz = 0;
  let hiding = false;
  let rushCooldown = 14;
  let rushWarning = 0;
  let rushActive = false;
  let rushZ = 16;
  let gold = 0;
  let lives = 4;
  let phase: RobloxHudState['phase'] = 'playing';

  return {
    update: (dt, elapsed, input, yaw, pitch, isFp) => {
      playerRig.setFirstPersonHidden(isFp);

      if (phase === 'playing') {
        if (input.actionPressed) {
          const nearCloset = closets.some((c) => Math.hypot(px - c.x, pz - c.z) < 2.9);
          if (nearCloset || hiding) {
            hiding = !hiding;
            robloxAudio.playDoorCreak();
          }
        }

        if (!hiding) {
          _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
          _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
          const spd = input.sprint ? 9.6 : 6.5;
          vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
          vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
          px = THREE.MathUtils.clamp(px + vx * dt, -4.4, 4.4);
          pz = THREE.MathUtils.clamp(pz + vz * dt, -600, 8);
        } else {
          vx = 0;
          vz = 0;
        }

        if (!rushActive && rushWarning <= 0) {
          rushCooldown -= dt;
          if (rushCooldown <= 0) {
            rushWarning = 4.5;
            robloxAudio.playRushWarn();
          }
        } else if (rushWarning > 0) {
          rushWarning -= dt;
          flashlight.intensity = Math.sin(elapsed * 38) > 0 ? 4.4 : 0.25;
          if (rushWarning <= 0) {
            rushActive = true;
            rushZ = pz + 32;
            rushMesh.visible = true;
            flashlight.intensity = 4.4;
          }
        } else if (rushActive) {
          rushZ -= 38 * dt;
          rushMesh.position.set(0, 2.2, rushZ);
          if (Math.abs(pz - rushZ) < 2.6 && !hiding) {
            lives--;
            robloxAudio.playElimination();
            rushActive = false;
            rushMesh.visible = false;
            rushCooldown = 14;
            if (lives <= 0) phase = 'eliminated';
          }
          if (rushZ < pz - 50) {
            rushActive = false;
            rushMesh.visible = false;
            rushCooldown = 15;
          }
        }

        for (const c of coins) {
          if (!c.taken) {
            c.mesh.rotation.y = elapsed * 2.2;
            if (Math.hypot(px - c.x, pz - c.z) < 2.2) {
              c.taken = true;
              c.mesh.visible = false;
              gold += 25;
              robloxAudio.playCoin();
            }
          }
        }

        if (pz <= -595) {
          phase = 'victory';
          robloxAudio.playVictory();
        }
      }

      flashlight.position.set(px, 2.1, pz);
      flashTarget.position.set(px + Math.sin(yaw) * 14, 1.8 - Math.sin(pitch) * 6, pz + Math.cos(yaw) * 14);
      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      playerRig.root.visible = !hiding;
      if (hs > 0.35) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, true, elapsed, 0);

      const doorNum = Math.max(1, Math.min(100, Math.round((6 - pz) / 5.95)));
      const nearCloset = closets.some((c) => Math.hypot(px - c.x, pz - c.z) < 2.9);

      return {
        worldTitle: 'DOORS HOTEL 100',
        stageLabel: `Door ${String(doorNum).padStart(3, '0')}/100`,
        timerSec: null,
        score: gold,
        scoreLabel: 'GOLD',
        lives,
        maxLives: 4,
        phase,
        signalText: rushWarning > 0 ? 'HIDE!' : null,
        signalTone: 'red',
        actionLabel: hiding ? 'UNHIDE' : nearCloset ? 'HIDE' : null,
        secondaryActionLabel: null,
        canSwitchStage: false,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => true,
    groundHeightAt: () => 0,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      pz = 6;
      hiding = false;
      rushActive = false;
      rushWarning = 0;
      rushCooldown = 14;
      lives = 4;
      phase = 'playing';
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, flashlight, flashTarget, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 8. MURDER MYSTERY 2: GRAND ESTATE (2-FLOOR)
// ==========================================
function createMm2ManorWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x0b1020);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x0b1020);
    scene.fog.near = 55;
    scene.fog.far = 200;
  }

  const lights = createThreePointLights(scene, { isSoftwareGl, sunColor: 0xcbd5e1, sunIntensity: 1.8 });
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter({ ...buildAvatarStyle(avatarCfg), hatStyle: 'sheriff_hat' });
  scene.add(playerRig.root);

  const platforms: PlatformDef[] = [];
  const marble = new THREE.Mesh(
    new THREE.BoxGeometry(92, 1, 92),
    new THREE.MeshStandardMaterial({ map: createCheckerTexture('#e2e8f0', '#1e293b', maxAnisotropy, 18, 18), roughness: 0.28, metalness: 0.15 })
  );
  marble.position.y = -0.5;
  marble.receiveShadow = true;
  worldGroup.add(marble);
  platforms.push({ minX: -46, maxX: 46, minZ: -46, maxZ: 46, y: 0 });

  // Upper Balcony Deck + Ramp Stairs
  const woodMat = new THREE.MeshStandardMaterial({ map: createWoodPlankTexture('#5c3a21', maxAnisotropy), roughness: 0.7 });
  const balcony = new THREE.Mesh(new THREE.BoxGeometry(44, 0.8, 16), woodMat);
  balcony.position.set(0, 4.6, -24);
  worldGroup.add(balcony);
  platforms.push({ minX: -22, maxX: 22, minZ: -32, maxZ: -16, y: 5 });
  for (let s = 0; s < 5; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 3), woodMat);
    step.position.set(-16, 0.5 + s * 1.0, -4 - s * 2.5);
    worldGroup.add(step);
    platforms.push({ minX: -19, maxX: -13, minZ: -5.5 - s * 2.5, maxZ: -2.5 - s * 2.5, y: 1.0 + s * 1.0 });
  }

  const coins: Array<{ x: number; z: number; taken: boolean; mesh: THREE.Mesh; respawn: number }> = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const rad = 16 + (i % 3) * 8;
    const cx = Math.cos(ang) * rad;
    const cz = Math.sin(ang) * rad;
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.2, metalness: 0.85 })
    );
    c.rotation.x = Math.PI / 2;
    c.position.set(cx, 1.2, cz);
    worldGroup.add(c);
    coins.push({ x: cx, z: cz, taken: false, mesh: c, respawn: 0 });
  }

  let px = 0;
  let py = 0;
  let pz = 24;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let coinsScore = 0;

  const groundHeightAt = (x: number, z: number): number => {
    let best = -20;
    for (const p of platforms) {
      if (x >= p.minX - 0.3 && x <= p.maxX + 0.3 && z >= p.minZ - 0.3 && z <= p.maxZ + 0.3) {
        if (p.y > best && p.y <= py + 2.4) best = p.y;
      }
    }
    return best;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp, serverCtx) => {
      playerRig.setFirstPersonHidden(isFp);

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 9.6 : 6.6;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
      if (input.jumpPressed && grounded) {
        vy = 11.4;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -43, 43);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -43, 43);
      py += vy * dt;
      const fy = groundHeightAt(px, pz);
      if (py <= fy) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      for (const c of coins) {
        if (c.taken) {
          c.respawn -= dt;
          if (c.respawn <= 0) {
            c.taken = false;
            c.mesh.visible = true;
          }
        } else {
          c.mesh.rotation.z = elapsed * 2.4;
          if (Math.hypot(px - c.x, pz - c.z) < 2.2) {
            c.taken = true;
            c.mesh.visible = false;
            c.respawn = 18;
            coinsScore += 10;
            robloxAudio.playCoin();
          }
        }
      }

      if (input.actionPressed) {
        robloxAudio.playGunshot();
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, 0);

      const isMurderer = serverCtx?.selfUserId && serverCtx.phaseData?.murdererId === serverCtx.selfUserId;
      const isSheriff = serverCtx?.selfUserId && serverCtx.phaseData?.sheriffId === serverCtx.selfUserId;
      const roleLabel = isMurderer ? 'MURDERER' : isSheriff ? 'SHERIFF' : 'INNOCENT';

      return {
        worldTitle: 'MM2 MANOR',
        stageLabel: roleLabel,
        timerSec: serverCtx ? serverCtx.phaseTimer : null,
        score: coinsScore,
        scoreLabel: 'COINS',
        lives: 1,
        maxLives: 1,
        phase: 'playing',
        signalText: null,
        signalTone: 'gold',
        actionLabel: isMurderer ? 'SLASH' : 'SHOOT',
        secondaryActionLabel: null,
        canSwitchStage: false,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter({ ...buildAvatarStyle(avatarCfg), hatStyle: 'sheriff_hat' });
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      pz = 24;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 9. ADOPT & RAISE: DREAM PET ISLAND 3D
// ==========================================
function createAdoptIslandWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x7cc9ff);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x9ee0ff);
    scene.fog.near = 75;
    scene.fog.far = 260;
  }

  const skyDome = createRobloxSkyDome(scene, {
    topHex: '#1e78f0',
    horizonHex: '#a5e1ff',
    groundHex: '#7cc9ff',
    sunPos: [80, 110, -140],
  });
  const clouds = createCloudClusters(scene, 20, 44, 130);
  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0xfff5db,
    sunIntensity: 2.35,
    hemiSky: 0xdaf0ff,
    hemiGround: 0x3b6e3c,
    hemiIntensity: 0.78,
  });

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  // Cute multi-part 3D Companion Pet that follows beside the player
  const petNames = ['Neon Dragon', 'Starlight Unicorn', 'Golden Kitsune', 'Emerald Turtle'];
  let petIdx = 0;
  let petLevel = 1;
  const petGroup = new THREE.Group();
  const petBodyMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.25, metalness: 0.15 });
  const petAccentMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xfacc15,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  const petBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 1.15), petBodyMat);
  petBody.castShadow = true;
  const petHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.72, 0.78), petBodyMat);
  petHead.position.set(0, 0.42, 0.62);
  petHead.castShadow = true;
  const petWingL = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.55), petAccentMat);
  petWingL.position.set(-0.75, 0.35, -0.05);
  const petWingR = petWingL.clone();
  petWingR.position.x = 0.75;
  const petHorn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 8), petAccentMat);
  petHorn.position.set(0, 0.92, 0.65);
  petGroup.add(petBody, petHead, petWingL, petWingR, petHorn);
  scene.add(petGroup);

  const platforms: PlatformDef[] = [];
  const addPlat = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y - h / 2, z);
    m.receiveShadow = true;
    m.castShadow = true;
    worldGroup.add(m);
    platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y });
  };

  // Shimmering Ocean + Sandy Shore + Lush Green Island
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, roughness: 0.14, metalness: 0.18 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.6;
  worldGroup.add(ocean);

  const grassMat = new THREE.MeshStandardMaterial({ map: createGrassTexture(maxAnisotropy, 24), roughness: 0.85 });
  const sandMat = new THREE.MeshStandardMaterial({ map: createSandTexture(maxAnisotropy, 20), roughness: 0.9 });
  const tileMat = new THREE.MeshStandardMaterial({
    map: createCheckerTexture('#f8fafc', '#fde68a', maxAnisotropy, 12, 12),
    roughness: 0.6,
  });

  addPlat(0, 0, 0, 175, 1.5, 175, sandMat);
  addPlat(0, 0.35, 0, 152, 1.0, 152, grassMat);
  addPlat(0, 0.45, 0, 32, 0.3, 32, tileMat); // Central Town Square

  // Nursery Building (Pastel Mint & Pink Roof + Glowing Giant Pet Egg)
  const nurseryMat = new THREE.MeshStandardMaterial({ color: 0x99f6e4, roughness: 0.55 });
  const pinkRoofMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.45 });
  const nurseryBase = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 14), nurseryMat);
  nurseryBase.position.set(-28, 4.85, -18);
  nurseryBase.castShadow = true;
  const nurseryRoof = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 16), pinkRoofMat);
  nurseryRoof.position.set(-28, 10.4, -18);
  const giantEgg = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xa855f7, emissiveIntensity: 0.7, roughness: 0.2 })
  );
  giantEgg.scale.set(1, 1.35, 1);
  giantEgg.position.set(-28, 14.5, -18);
  worldGroup.add(nurseryBase, nurseryRoof, giantEgg);

  // Rainbow Bridge leading up to Floating Sky Castle
  const rainbowColors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6, 0xa855f7];
  for (let i = 0; i < 18; i++) {
    const stepY = 0.6 + i * 0.75;
    const stepZ = -26 - i * 3.1;
    const stepMat = new THREE.MeshStandardMaterial({
      color: rainbowColors[i % rainbowColors.length],
      emissive: rainbowColors[i % rainbowColors.length],
      emissiveIntensity: 0.22,
      roughness: 0.4,
    });
    addPlat(0, stepY, stepZ, 8.5, 0.5, 3.2, stepMat);
  }
  const skyCastleFloorMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });
  addPlat(0, 14.2, -92, 34, 1.5, 28, skyCastleFloorMat);
  for (const tx of [-13, 13]) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.8, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.4 })
    );
    tower.position.set(tx, 21, -100);
    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.35 })
    );
    spire.position.set(tx, 30.5, -100);
    worldGroup.add(tower, spire);
  }

  // Animated Ferris Wheel in the Park
  const wheelHub = new THREE.Group();
  wheelHub.position.set(34, 15, -14);
  const wheelRing = new THREE.Mesh(
    new THREE.TorusGeometry(11.5, 0.45, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4, roughness: 0.3 })
  );
  wheelHub.add(wheelRing);
  const standL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 16, 1.2), new THREE.MeshStandardMaterial({ color: 0x475569 }));
  standL.position.set(34, 8, -11);
  const standR = standL.clone();
  standR.position.z = -17;
  worldGroup.add(wheelHub, standL, standR);

  // Floating Hot Air Balloons
  const balloons: Array<{ group: THREE.Group; baseY: number; phase: number }> = [];
  for (let b = 0; b < 4; b++) {
    const bg = new THREE.Group();
    const ang = (b / 4) * Math.PI * 2;
    bg.position.set(Math.cos(ang) * 48, 28 + b * 3, Math.sin(ang) * 48);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 14, 12),
      new THREE.MeshStandardMaterial({ color: rainbowColors[b % rainbowColors.length], roughness: 0.45 })
    );
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x92400e }));
    basket.position.y = -6.2;
    bg.add(bulb, basket);
    worldGroup.add(bg);
    balloons.push({ group: bg, baseY: bg.position.y, phase: b * 1.4 });
  }

  // Collectible Pet Hearts & Bucks across Town + Sky Castle
  const pickups: Array<{ x: number; y: number; z: number; mesh: THREE.Mesh; cooldown: number }> = [];
  const pickupSpots: Array<[number, number, number]> = [
    [-16, 1.4, -14],
    [-28, 1.4, -6],
    [18, 1.4, 12],
    [32, 1.4, -22],
    [0, 15.2, -92],
    [-8, 15.2, -96],
    [8, 15.2, -96],
    [12, 1.4, -12],
    [-12, 1.4, 18],
    [0, 1.4, 24],
  ];
  for (const [hx, hy, hz] of pickupSpots) {
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xec4899, emissiveIntensity: 0.9 })
    );
    gem.position.set(hx, hy, hz);
    worldGroup.add(gem);
    pickups.push({ x: hx, y: hy, z: hz, mesh: gem, cooldown: 0 });
  }

  // Hatch Pad outside Nursery
  const hatchPad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.4, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.0 })
  );
  hatchPad.position.set(-20, 0.55, -14);
  worldGroup.add(hatchPad);

  let px = 0;
  let py = 0.6;
  let pz = 12;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let bucks = 150;
  let petX = 1.8;
  let petY = 1.8;
  let petZ = 12;
  let signalText: string | null = null;
  let signalTimer = 0;

  const groundHeightAt = (x: number, z: number): number => {
    let best = -20;
    for (const p of platforms) {
      if (x >= p.minX - 0.3 && x <= p.maxX + 0.3 && z >= p.minZ - 0.3 && z <= p.maxZ + 0.3) {
        if (p.y > best && p.y <= py + 2.4) best = p.y;
      }
    }
    return best;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp) => {
      playerRig.setFirstPersonHidden(isFp);
      skyDome.position.set(px, 0, pz);
      updateSunShadowTarget(lights.sun, [26, 38, 22], px, pz);
      wheelHub.rotation.z = elapsed * 0.35;
      giantEgg.rotation.y = elapsed * 0.9;
      giantEgg.position.y = 14.5 + Math.sin(elapsed * 2) * 0.45;
      for (const bl of balloons) {
        bl.group.position.y = bl.baseY + Math.sin(elapsed * 0.7 + bl.phase) * 1.6;
      }
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 10.2 : 6.8;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
      if (input.jumpPressed && grounded) {
        vy = 11.8;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -76, 76);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -110, 76);
      py += vy * dt;
      const fy = groundHeightAt(px, pz);
      if (py <= fy) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      // Hatch new Pet Egg on Hatch Pad or Action
      if (input.actionPressed || Math.hypot(px - -20, pz - -14) < 3.2) {
        if (input.actionPressed && bucks >= 100) {
          bucks -= 100;
          petIdx = (petIdx + 1) % petNames.length;
          petLevel++;
          const petColors = [0x14b8a6, 0xf472b6, 0xf59e0b, 0x22c55e];
          petBodyMat.color.setHex(petColors[petIdx]);
          robloxAudio.playCheckpoint();
          signalText = `HATCHED: ${petNames[petIdx]} Lv.${petLevel}!`;
          signalTimer = 2.4;
        }
      }

      for (const pk of pickups) {
        if (pk.cooldown > 0) {
          pk.cooldown -= dt;
          pk.mesh.visible = pk.cooldown <= 0;
          continue;
        }
        pk.mesh.rotation.y = elapsed * 2.2;
        if (Math.hypot(px - pk.x, pz - pk.z) < 2.2 && Math.abs(py - pk.y) < 3.0) {
          bucks += 45;
          pk.cooldown = 8;
          pk.mesh.visible = false;
          robloxAudio.playCoin();
        }
      }

      // Smooth Companion Pet Following beside player's shoulder
      const desiredPetX = px + Math.cos(facingYaw) * 1.9 - Math.sin(facingYaw) * 1.1;
      const desiredPetZ = pz - Math.sin(facingYaw) * 1.9 - Math.cos(facingYaw) * 1.1;
      const desiredPetY = py + 1.85 + Math.sin(elapsed * 3.4) * 0.25;
      petX = THREE.MathUtils.damp(petX, desiredPetX, 6, dt);
      petY = THREE.MathUtils.damp(petY, desiredPetY, 6, dt);
      petZ = THREE.MathUtils.damp(petZ, desiredPetZ, 6, dt);
      petGroup.position.set(petX, petY, petZ);
      petGroup.rotation.y = smoothRotateYaw(petGroup.rotation.y, facingYaw, dt, 8);
      petWingL.rotation.z = Math.sin(elapsed * 12) * 0.45;
      petWingR.rotation.z = -Math.sin(elapsed * 12) * 0.45;

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, 0);

      return {
        worldTitle: 'ADOPT ISLAND 3D',
        stageLabel: `${petNames[petIdx]} · Lv.${petLevel}`,
        timerSec: null,
        score: bucks,
        scoreLabel: '$ BUCKS',
        lives: 1,
        maxLives: 1,
        phase: 'playing',
        signalText,
        signalTone: 'gold',
        actionLabel: 'HATCH EGG (100)',
        secondaryActionLabel: null,
        canSwitchStage: false,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      py = 0.6;
      pz = 12;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, skyDome, clouds, petGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// ==========================================
// 10. PET SWARM & BEE KINGDOM 3D
// ==========================================
function createPetSwarmWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig
): WorldController {
  scene.background = new THREE.Color(0x6ec3ff);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x9be2ff);
    scene.fog.near = 75;
    scene.fog.far = 250;
  }

  const skyDome = createRobloxSkyDome(scene, {
    topHex: '#1877e8',
    horizonHex: '#aee4ff',
    groundHex: '#6ec3ff',
    sunPos: [90, 120, -130],
  });
  const clouds = createCloudClusters(scene, 18, 48, 135);
  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0xfff3c4,
    sunIntensity: 2.35,
    hemiSky: 0xdbeafe,
    hemiGround: 0x3b6e35,
    hemiIntensity: 0.78,
  });

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const grassMat = new THREE.MeshStandardMaterial({ map: createGrassTexture(maxAnisotropy, 22), roughness: 0.86 });
  const honeyMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.15,
  });

  const platforms: PlatformDef[] = [];
  const addPlat = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y - h / 2, z);
    m.receiveShadow = true;
    m.castShadow = true;
    worldGroup.add(m);
    platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y });
  };

  // Clover Meadow Base + 3-Tier Honeycomb Mountain Steps
  addPlat(0, 0, 0, 170, 1.5, 170, grassMat);
  addPlat(0, 2.2, -48, 56, 2.5, 38, honeyMat);
  addPlat(0, 4.6, -54, 38, 2.5, 26, honeyMat);
  addPlat(0, 7.2, -58, 22, 3.0, 16, honeyMat);

  // Your Honeycomb Hive Stand + Convert Pad
  const hiveWall = new THREE.Mesh(
    new THREE.BoxGeometry(10, 9, 2),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
  );
  hiveWall.position.set(0, 4.5, 28);
  const convertPad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.3, 20),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 1.0 })
  );
  convertPad.position.set(0, 0.2, 23);
  worldGroup.add(hiveWall, convertPad);

  // Flower & Crystal Collectibles Fields
  const gems: Array<{ x: number; y: number; z: number; value: number; mesh: THREE.Mesh; timer: number }> = [];
  const fieldColors = [0xf43f5e, 0x38bdf8, 0xfacc15, 0xa855f7, 0x22c55e];
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * Math.PI * 2;
    const rad = 12 + (i % 5) * 10;
    const gx = Math.cos(ang) * rad;
    const gz = Math.sin(ang) * rad - 8;
    const gy = gz < -30 ? 3.5 : 1.0;
    const col = fieldColors[i % fieldColors.length];
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95, 0),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.85, roughness: 0.2 })
    );
    mesh.position.set(gx, gy, gz);
    worldGroup.add(mesh);
    gems.push({ x: gx, y: gy, z: gz, value: 25 + (i % 4) * 15, mesh, timer: 0 });
  }

  // Orbiting 5-Bee Swarm Companions
  const swarmBees: THREE.Group[] = [];
  const beeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.78 });
  for (let i = 0; i < 5; i++) {
    const bg = new THREE.Group();
    const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.52, 0.8), beeMat);
    const bStripe = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.54, 0.22), stripeMat);
    const wL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.35), wingMat);
    wL.position.set(-0.45, 0.3, 0);
    const wR = wL.clone();
    wR.position.x = 0.45;
    bg.add(bBody, bStripe, wL, wR);
    scene.add(bg);
    swarmBees.push(bg);
  }

  let px = 0;
  let py = 0.2;
  let pz = 14;
  let facingYaw = Math.PI;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let grounded = true;
  let pollen = 0;
  let capacity = 250;
  let honeyCoins = 0;
  let swarmPower = 1;
  let signalText: string | null = null;
  let signalTimer = 0;

  const groundHeightAt = (x: number, z: number): number => {
    let best = 0;
    for (const p of platforms) {
      if (x >= p.minX - 0.3 && x <= p.maxX + 0.3 && z >= p.minZ - 0.3 && z <= p.maxZ + 0.3) {
        if (p.y > best && p.y <= py + 2.5) best = p.y;
      }
    }
    return best;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp) => {
      playerRig.setFirstPersonHidden(isFp);
      skyDome.position.set(px, 0, pz);
      updateSunShadowTarget(lights.sun, [26, 38, 22], px, pz);
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 10.4 : 6.8;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);
      if (input.jumpPressed && grounded) {
        vy = 11.8;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -76, 76);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -76, 76);
      py += vy * dt;
      const fy = groundHeightAt(px, pz);
      if (py <= fy) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      // Harvest Crystal & Pollen Gems
      for (const g of gems) {
        if (g.timer > 0) {
          g.timer -= dt;
          g.mesh.visible = g.timer <= 0;
          continue;
        }
        g.mesh.rotation.y = elapsed * 2.5;
        if (Math.hypot(px - g.x, pz - g.z) < 2.6 && pollen < capacity) {
          pollen = Math.min(capacity, pollen + g.value * swarmPower);
          g.timer = 7;
          g.mesh.visible = false;
          robloxAudio.playCoin();
        }
      }

      // Convert Pollen to Honey at Hive Stand
      if (Math.hypot(px - 0, pz - 23) < 3.6 && pollen > 0) {
        honeyCoins += pollen * 2;
        pollen = 0;
        robloxAudio.playCheckpoint();
        signalText = 'HONEY CONVERTED!';
        signalTimer = 1.6;
      }

      // Action button upgrades Bag Capacity & Swarm Power
      if (input.actionPressed) {
        const upgCost = swarmPower * 300;
        if (honeyCoins >= upgCost) {
          honeyCoins -= upgCost;
          swarmPower++;
          capacity += 250;
          robloxAudio.playCheckpoint();
          signalText = `SWARM TIER ${swarmPower}!`;
          signalTimer = 2.2;
        } else {
          signalText = `NEED ${upgCost} HONEY`;
          signalTimer = 1.5;
        }
      }

      // Animate Orbiting Swarm Bees
      for (let i = 0; i < swarmBees.length; i++) {
        const ang = elapsed * 2.4 + (i * Math.PI * 2) / swarmBees.length;
        const bx = px + Math.cos(ang) * 2.5;
        const bz = pz + Math.sin(ang) * 2.5;
        const by = py + 2.2 + Math.sin(elapsed * 5 + i) * 0.35;
        swarmBees[i].position.set(bx, by, bz);
        swarmBees[i].rotation.y = -ang;
      }

      const hs = Math.hypot(vx, vz);
      playerRig.root.position.set(px, py, pz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, 10);
        playerRig.root.rotation.y = facingYaw;
      } else if (isFp) {
        facingYaw = yaw;
        playerRig.root.rotation.y = yaw;
      }
      animateRobloxCharacter(playerRig, hs, grounded, elapsed, 0);

      return {
        worldTitle: 'PET SWARM 3D',
        stageLabel: `Bag ${pollen}/${capacity} · Swarm Lv.${swarmPower}`,
        timerSec: null,
        score: honeyCoins,
        scoreLabel: 'HONEY',
        lives: 1,
        maxLives: 1,
        phase: 'playing',
        signalText,
        signalTone: 'gold',
        actionLabel: `UPGRADE (${swarmPower * 300})`,
        secondaryActionLabel: null,
        canSwitchStage: false,
      };
    },
    getPlayerPosition: (out) => out.copy(_pOut.set(px, py, pz)),
    getPlayerYaw: () => facingYaw,
    getPlayerSpeed: () => Math.hypot(vx, vz),
    isPlayerGrounded: () => grounded,
    groundHeightAt,
    setAvatarConfig: (cfg) => {
      avatarCfg = cfg;
      scene.remove(playerRig.root);
      playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
      playerRig.root.position.set(px, py, pz);
      scene.add(playerRig.root);
    },
    reset: () => {
      px = 0;
      py = 0.2;
      pz = 14;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      for (const b of swarmBees) scene.remove(b);
      scene.remove(worldGroup, skyDome, clouds, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

export function createViralWorldById(
  worldId: Exclude<RobloxWorldId, 'squid_game'>,
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig = DEFAULT_ROBLOX_AVATAR
): WorldController {
  switch (worldId) {
    case 'adopt_island':
      return createAdoptIslandWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'pet_swarm':
      return createPetSwarmWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'tower_obby':
      return createTowerObbyWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'brookhaven_rp':
      return createBrookhavenWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'blox_arena':
      return createBloxArenaWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'bedwars_sky':
      return createBedwarsSkyWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'tycoon_empire':
      return createTycoonEmpireWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'natural_disaster':
      return createNaturalDisasterWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'doors_hotel':
      return createDoorsHotelWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
    case 'mm2_manor':
      return createMm2ManorWorld(scene, isSoftwareGl, maxAnisotropy, initialAvatar);
  }
}
