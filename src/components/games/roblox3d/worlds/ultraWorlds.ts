import * as THREE from 'three';
import type { RobloxAvatarConfig } from '../../../../types';
import {
  animateRobloxCharacter,
  createRobloxCharacter,
  DEFAULT_ROBLOX_AVATAR,
  smoothRotateYaw,
} from '../robloxCharacter';
import {
  createCloudClusters,
  createRobloxSkyDome,
  createSandTexture,
  createThreePointLights,
  updateSunShadowTarget,
} from '../robloxRenderer';
import {
  buildCollectibleGem,
  buildCompositePlatform,
  buildCrystalCluster,
  buildNeonLampPost,
  buildSculptedArchway,
  buildSculptedBoat,
  buildSculptedHoverCar,
  buildSculptedTree,
  buildVictoryPortalGate,
  createBrushedTitaniumPbrMaterial,
  createCarvedStonePbrMaterial,
  createCrystalMaterial,
  createHardwoodDeckMaterial,
  createMarblePbrMaterial,
  createVolcanicBasaltMaterial,
  createWetCyberAsphaltMaterial,
} from '../proceduralAssets';
import { robloxAudio } from '../robloxAudio';
import type {
  PlayerInputState,
  RobloxHudState,
  WorldController,
} from '../types';

const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _pOut = new THREE.Vector3();

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
          std.roughnessMap?.dispose();
          std.bumpMap?.dispose();
          std.emissiveMap?.dispose();
          mat.dispose();
        }
      }
    });
  }
}

interface PlatBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  bounce?: boolean;
  moving?: { obj: THREE.Object3D; baseX: number; baseZ: number; ampX: number; ampZ: number; speed: number; w: number; d: number };
}

// =====================================================================
// NEW GAME 1: AETHER SKY CITADEL (Marble & Gold Floating Sanctums)
// =====================================================================
export function createSkyCitadelWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig = DEFAULT_ROBLOX_AVATAR
): WorldController {
  scene.background = new THREE.Color(0xfdba74);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0xfed7aa);
    scene.fog.near = 65;
    scene.fog.far = 230;
  }

  const skyDome = createRobloxSkyDome(scene, { topHex: '#38bdf8', horizonHex: '#fdba74' });
  const clouds = createCloudClusters(scene, isSoftwareGl ? 14 : 26);
  clouds.position.y = -6;

  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0xffedd5,
    sunIntensity: 2.5,
    hemiSky: 0xe0f2fe,
    hemiGround: 0xf59e0b,
  });

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const marbleMat = createMarblePbrMaterial(maxAnisotropy, '#f8fafc', '#94a3b8', 2, 2);
  const goldMat = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#f59e0b', 1, 1);
  const stoneMat = createCarvedStonePbrMaterial(maxAnisotropy, '#cbd5e1', '#64748b', 2, 2);
  const crystalMat = createCrystalMaterial(0x2dd4bf, 0x0d9488);
  const runeBridgeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.35,
  });

  const platforms: PlatBox[] = [];
  const gems: Array<{ x: number; y: number; z: number; obj: THREE.Group; collected: boolean }> = [];
  const checkpoints: Array<{ x: number; y: number; z: number; reached: boolean; crystal: THREE.Group }> = [];
  let portalPos = new THREE.Vector3(0, 32, 0);
  let portalGroup: THREE.Group | null = null;

  const addCelestialPlat = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    isBridge = false,
    bounce = false
  ) => {
    const plat = buildCompositePlatform(
      w,
      h,
      d,
      isBridge ? runeBridgeMat : marbleMat,
      goldMat,
      bounce ? 0x22d3ee : isBridge ? 0x38bdf8 : undefined
    );
    plat.position.set(x, y, z);
    worldGroup.add(plat);
    platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y, bounce });
  };

  // Starting Grand Citadel Plaza
  addCelestialPlat(0, 0, 0, 15, 2.2, 15, false, false);
  const startArch = buildSculptedArchway(7.5, 6.5, marbleMat, goldMat, 0x2dd4bf);
  startArch.position.set(0, 0, -6.5);
  worldGroup.add(startArch);

  const tree0 = buildSculptedTree('crystal', 1.15);
  tree0.position.set(-5.5, 0, -4.5);
  worldGroup.add(tree0);
  const tree1 = buildSculptedTree('crystal', 1.15);
  tree1.position.set(5.5, 0, -4.5);
  worldGroup.add(tree1);

  // 28 Ascending Spiral Citadel Islands + Moving Rune Bridges + Wind Bounces
  let curX = 0;
  let curY = 0;
  let curZ = 0;
  for (let i = 1; i <= 28; i++) {
    const ang = i * 0.44;
    const rad = 24 + Math.sin(i * 0.5) * 6;
    curX = Math.sin(ang) * rad;
    curZ = -Math.cos(ang) * rad + 24;
    curY = i * 1.45;
    const isIsland = i % 4 === 0;
    const isMoving = !isIsland && i % 3 === 2;
    const isBounce = !isIsland && i % 5 === 0;

    if (isMoving) {
      const mPlat = buildCompositePlatform(4.6, 0.9, 4.6, runeBridgeMat, goldMat, 0x38bdf8);
      mPlat.position.set(curX, curY, curZ);
      worldGroup.add(mPlat);
      platforms.push({
        minX: curX - 2.3,
        maxX: curX + 2.3,
        minZ: curZ - 2.3,
        maxZ: curZ + 2.3,
        y: curY,
        moving: { obj: mPlat, baseX: curX, baseZ: curZ, ampX: 3.4, ampZ: 0, speed: 1.4 + (i % 3) * 0.35, w: 4.6, d: 4.6 },
      });
    } else {
      const w = isIsland ? 9.5 : 4.8;
      const d = isIsland ? 9.5 : 4.8;
      addCelestialPlat(curX, curY, curZ, w, isIsland ? 1.9 : 1.0, d, i % 2 === 1 && !isIsland, isBounce);
    }

    // Collectible Aether Shard on odd steps
    const gem = buildCollectibleGem(0x2dd4bf);
    gem.position.set(curX, curY + 1.35, curZ);
    worldGroup.add(gem);
    gems.push({ x: curX, y: curY + 1.35, z: curZ, obj: gem, collected: false });

    // Island Sanctum Landmarks & Checkpoints
    if (isIsland) {
      const shrine = buildCrystalCluster(0x2dd4bf, 0x0f766e, 0.9);
      shrine.position.set(curX + 2.8, curY, curZ + 2.6);
      worldGroup.add(shrine);
      checkpoints.push({ x: curX, y: curY, z: curZ, reached: false, crystal: shrine });

      const arch = buildSculptedArchway(5.2, 4.8, stoneMat, goldMat, 0x38bdf8);
      arch.position.set(curX - 2.4, curY, curZ - 2.4);
      arch.rotation.y = ang;
      worldGroup.add(arch);
    }
  }

  // Grand Sky Obelisk Summit
  const summitY = curY + 2.2;
  addCelestialPlat(curX, summitY, curZ - 7, 14, 2.5, 14, false, false);
  portalGroup = buildVictoryPortalGate(0x2dd4bf);
  portalGroup.position.set(curX, summitY, curZ - 8);
  worldGroup.add(portalGroup);
  portalPos.set(curX, summitY, curZ - 8);

  const summitCrown = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), crystalMat);
  summitCrown.position.set(curX, summitY + 6.5, curZ - 8);
  worldGroup.add(summitCrown);

  let px = 0;
  let py = 0.2;
  let pz = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let spawnX = 0;
  let spawnY = 0.2;
  let spawnZ = 0;
  let facingYaw = Math.PI;
  let grounded = true;
  let score = 0;
  let dashCd = 0;
  let won = false;
  let signalText: string | null = 'COLLECT AETHER SHARDS & REACH SKY SUMMIT!';
  let signalTimer = 3.5;

  const groundHeightAt = (x: number, z: number): number => {
    let best = -999;
    for (const p of platforms) {
      if (x >= p.minX - 0.35 && x <= p.maxX + 0.35 && z >= p.minZ - 0.35 && z <= p.maxZ + 0.35) {
        if (p.y > best && p.y <= py + 2.4) best = p.y;
      }
    }
    return best;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp): RobloxHudState => {
      playerRig.setFirstPersonHidden(isFp);
      skyDome.position.set(px, 0, pz);
      updateSunShadowTarget(lights.sun, [28, 46, 22], px, pz);
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }
      if (dashCd > 0) dashCd -= dt;

      for (const p of platforms) {
        if (p.moving) {
          const ox = p.moving.baseX + Math.sin(elapsed * p.moving.speed) * p.moving.ampX;
          p.moving.obj.position.x = ox;
          p.minX = ox - p.moving.w / 2;
          p.maxX = ox + p.moving.w / 2;
        }
      }

      if (portalGroup) portalGroup.children[2].rotation.z = elapsed * 2.2;
      summitCrown.rotation.y = elapsed * 1.4;

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 11.4 : 7.6;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);

      if (input.actionPressed && dashCd <= 0) {
        dashCd = 2.5;
        vy = 9.5;
        vx += _fwd.x * 13;
        vz += _fwd.z * 13;
        robloxAudio.playJump();
        signalText = 'AETHER GLIDE BOOST!';
        signalTimer = 1.4;
      }

      if (input.jumpPressed && grounded) {
        vy = 13.0;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px += vx * dt;
      pz += vz * dt;
      py += vy * dt;

      let landedPlat: PlatBox | null = null;
      let bestY = -999;
      for (const p of platforms) {
        if (px >= p.minX - 0.35 && px <= p.maxX + 0.35 && pz >= p.minZ - 0.35 && pz <= p.maxZ + 0.35) {
          if (p.y > bestY && p.y <= py + 2.1) {
            bestY = p.y;
            landedPlat = p;
          }
        }
      }
      if (py <= bestY && bestY > -900) {
        py = bestY;
        if (landedPlat?.bounce) {
          vy = 19.5;
          grounded = false;
          robloxAudio.playJump();
        } else {
          vy = 0;
          grounded = true;
        }
      } else {
        grounded = false;
      }

      if (py < -18) {
        px = spawnX;
        py = spawnY + 0.5;
        pz = spawnZ;
        vx = 0;
        vy = 0;
        vz = 0;
        signalText = 'RESPAWNED AT CITADEL SANCTUM';
        signalTimer = 1.8;
      }

      for (const g of gems) {
        if (g.collected) continue;
        g.obj.rotation.y = elapsed * 2.4;
        if (Math.hypot(px - g.x, pz - g.z) < 2.2 && Math.abs(py - g.y) < 2.4) {
          g.collected = true;
          g.obj.visible = false;
          score += 50;
          robloxAudio.playCoin();
        }
      }

      for (const cp of checkpoints) {
        if (!cp.reached && Math.hypot(px - cp.x, pz - cp.z) < 4.5 && Math.abs(py - cp.y) < 3.0) {
          cp.reached = true;
          spawnX = cp.x;
          spawnY = cp.y + 0.3;
          spawnZ = cp.z;
          score += 100;
          robloxAudio.playCheckpoint();
          signalText = 'SANCTUM CHECKPOINT UNLOCKED!';
          signalTimer = 2.0;
        }
      }

      if (!won && Math.hypot(px - portalPos.x, pz - portalPos.z) < 3.5 && Math.abs(py - portalPos.y) < 3.5) {
        won = true;
        score += 500;
        robloxAudio.playVictory();
        signalText = 'CITADEL CROWN CLAIMED!';
        signalTimer = 4.0;
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
        worldTitle: 'AETHER SKY CITADEL',
        stageLabel: won ? 'Summit Crowned' : `Height ${Math.max(0, Math.round(py))}m / 44m`,
        timerSec: null,
        score,
        scoreLabel: 'AETHER PTS',
        lives: 1,
        maxLives: 1,
        phase: won ? 'victory' : 'playing',
        signalText,
        signalTone: won ? 'gold' : 'green',
        actionLabel: dashCd > 0 ? `GLIDE (${Math.ceil(dashCd)}s)` : 'AETHER GLIDE',
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
      pz = 0;
      vx = 0;
      vy = 0;
      vz = 0;
      spawnX = 0;
      spawnY = 0.2;
      spawnZ = 0;
      won = false;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, skyDome, clouds, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// =====================================================================
// NEW GAME 2: CYBER VELOCITY (Rain-Slick Neon Highway + Drive Hovercar!)
// =====================================================================
export function createCyberVelocityWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig = DEFAULT_ROBLOX_AVATAR
): WorldController {
  scene.background = new THREE.Color(0x090d1f);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x0f172a);
    scene.fog.near = 45;
    scene.fog.far = 210;
  }

  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0x38bdf8,
    sunIntensity: 2.0,
    hemiSky: 0x0ea5e9,
    hemiGround: 0x701a75,
  });
  lights.rim.color.setHex(0xf43f5e);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const wetRoadMat = createWetCyberAsphaltMaterial(maxAnisotropy, '#22d3ee', 12, 12);
  const titaniumMat = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#1e293b', 2, 2);
  const cyberAccentMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.6 });
  const pinkNeonMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 1.8 });

  // Rain-slicked city street deck
  const roadFloor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), wetRoadMat);
  roadFloor.rotation.x = -Math.PI / 2;
  roadFloor.receiveShadow = true;
  worldGroup.add(roadFloor);

  // Elevated Neon Highway Loop + Skyscrapers
  const loopRings: Array<{ x: number; y: number; z: number; torus: THREE.Mesh; passed: boolean }> = [];
  const circuitRadius = 66;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const rx = Math.cos(ang) * circuitRadius;
    const rz = Math.sin(ang) * circuitRadius;
    const ringMat = i % 2 === 0 ? cyberAccentMat : pinkNeonMat;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 8, 24), ringMat);
    ring.position.set(rx, 4.2, rz);
    ring.rotation.y = -ang;
    worldGroup.add(ring);
    loopRings.push({ x: rx, y: 4.2, z: rz, torus: ring, passed: false });

    const lamp = buildNeonLampPost(i % 2 === 0 ? 0x22d3ee : 0xf43f5e);
    lamp.position.set(Math.cos(ang) * (circuitRadius + 10), 0, Math.sin(ang) * (circuitRadius + 10));
    lamp.rotation.y = -ang + Math.PI;
    worldGroup.add(lamp);
  }

  // Diverse Multi-Material Neon Towers & Composite Skyway Pylons
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + 0.15;
    const dist = i % 2 === 0 ? 34 : 96;
    const tx = Math.cos(ang) * dist;
    const tz = Math.sin(ang) * dist;
    const h = 16 + (i % 5) * 8;
    const tower = buildCompositePlatform(10, h, 10, titaniumMat, titaniumMat, i % 2 === 0 ? 0x22d3ee : 0xf43f5e);
    tower.position.set(tx, h, tz);
    worldGroup.add(tower);

    const crownRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.22, 6, 16),
      i % 2 === 0 ? cyberAccentMat : pinkNeonMat
    );
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.set(tx, h + 0.6, tz);
    worldGroup.add(crownRing);
  }

  // Central Plaza Arch + Parked Hover Supercar!
  const centerPlinth = buildCompositePlatform(16, 0.5, 16, titaniumMat, titaniumMat, 0x22d3ee);
  centerPlinth.position.set(0, 0.5, 0);
  worldGroup.add(centerPlinth);

  const parkedCar = buildSculptedHoverCar(0x06b6d4, 0xf43f5e);
  parkedCar.position.set(0, 0.5, 8);
  worldGroup.add(parkedCar);

  const finishGate = buildVictoryPortalGate(0x22d3ee);
  finishGate.position.set(circuitRadius, 0, 0);
  finishGate.rotation.y = Math.PI / 2;
  worldGroup.add(finishGate);

  let px = 0;
  let py = 0.5;
  let pz = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let facingYaw = 0;
  let grounded = true;
  let inCar = false;
  let nitroCd = 0;
  let score = 0;
  let signalText: string | null = 'ENTER HOVERCAR & BOOST THROUGH 12 NEON RINGS!';
  let signalTimer = 3.5;

  const groundHeightAt = (x: number, z: number): number => {
    if (Math.abs(x) <= 8 && Math.abs(z) <= 8) return 0.5;
    return 0;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp): RobloxHudState => {
      playerRig.setFirstPersonHidden(isFp);
      updateSunShadowTarget(lights.sun, [24, 38, 22], px, pz);
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }
      if (nitroCd > 0) nitroCd -= dt;

      if (input.secondaryPressed) {
        if (inCar) {
          inCar = false;
          parkedCar.position.set(px, py, pz);
          parkedCar.rotation.y = facingYaw;
          px += 2.6;
        } else if (Math.hypot(px - parkedCar.position.x, pz - parkedCar.position.z) < 6.5) {
          inCar = true;
          robloxAudio.playCheckpoint();
          signalText = 'HOVERCAR ENGAGED — HIT BOOST!';
          signalTimer = 1.8;
        } else {
          parkedCar.position.set(px + 2.5, py, pz);
          inCar = true;
        }
      }

      if (input.actionPressed && nitroCd <= 0) {
        nitroCd = 3.0;
        const fwdDir = inCar ? facingYaw : yaw + Math.PI;
        vx += Math.sin(fwdDir) * 26;
        vz += Math.cos(fwdDir) * 26;
        robloxAudio.playJump();
        signalText = 'HYPERDRIVE NITRO!';
        signalTimer = 1.2;
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const baseSpeed = inCar ? (input.sprint ? 26 : 19) : input.sprint ? 11 : 7.4;
      const tVx = (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * baseSpeed;
      const tVz = (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * baseSpeed;
      vx = THREE.MathUtils.damp(vx, tVx, inCar ? 4.5 : 10, dt);
      vz = THREE.MathUtils.damp(vz, tVz, inCar ? 4.5 : 10, dt);

      if (input.jumpPressed && grounded && !inCar) {
        vy = 12.2;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -110, 110);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -110, 110);
      py += vy * dt;

      const fy = groundHeightAt(px, pz);
      if (py <= fy) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      for (const r of loopRings) {
        r.torus.rotation.z = elapsed * 1.8;
        if (!r.passed && Math.hypot(px - r.x, pz - r.z) < 5.2) {
          r.passed = true;
          score += 150;
          robloxAudio.playCoin();
          signalText = 'NEON RING +150!';
          signalTimer = 1.3;
        }
      }

      const hs = Math.hypot(vx, vz);
      if (hs > 0.5) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, inCar ? 7 : 10);
      } else if (isFp) {
        facingYaw = yaw;
      }

      if (inCar) {
        parkedCar.position.set(px, py + 0.15 + Math.sin(elapsed * 5) * 0.08, pz);
        parkedCar.rotation.y = facingYaw;
        playerRig.root.position.set(px, py + 0.72, pz);
        playerRig.root.rotation.y = facingYaw;
      } else {
        playerRig.root.position.set(px, py, pz);
        playerRig.root.rotation.y = facingYaw;
      }
      animateRobloxCharacter(playerRig, inCar ? 0 : hs, grounded, elapsed, 0);

      const passedCount = loopRings.filter((r) => r.passed).length;
      const done = passedCount >= loopRings.length;
      return {
        worldTitle: 'CYBER VELOCITY',
        stageLabel: `${passedCount}/${loopRings.length} Boost Rings · ${inCar ? 'Hovercar' : 'On Foot'}`,
        timerSec: null,
        score,
        scoreLabel: 'CREDITS',
        lives: 1,
        maxLives: 1,
        phase: done ? 'victory' : 'playing',
        signalText,
        signalTone: done ? 'gold' : 'info',
        actionLabel: nitroCd > 0 ? `NITRO (${Math.ceil(nitroCd)}s)` : 'NITRO BOOST',
        secondaryActionLabel: inCar ? 'EXIT HOVERCAR' : 'DRIVE HOVERCAR',
        canSwitchStage: false,
        inCar,
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
      py = 0.5;
      pz = 0;
      vx = 0;
      vz = 0;
      inCar = false;
      parkedCar.position.set(0, 0.5, 8);
      loopRings.forEach((r) => (r.passed = false));
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// =====================================================================
// NEW GAME 3: OBSIDIAN VOLCANO ESCAPE (Magma River & Rising Lava Surges)
// =====================================================================
export function createVolcanoTempleWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig = DEFAULT_ROBLOX_AVATAR
): WorldController {
  scene.background = new THREE.Color(0x27100b);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0x431407);
    scene.fog.near = 40;
    scene.fog.far = 185;
  }

  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0xfb923c,
    sunIntensity: 2.3,
    hemiSky: 0x7c2d12,
    hemiGround: 0xea580c,
  });
  lights.rim.color.setHex(0xfacc15);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const basaltMat = createVolcanicBasaltMaterial(maxAnisotropy, true, 2, 2);
  const stoneMat = createCarvedStonePbrMaterial(maxAnisotropy, '#57534e', '#1c1917', 2, 2);
  const goldMat = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#eab308', 1, 1);

  const lavaMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.8,
    roughness: 0.3,
  });
  const lavaSea = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), lavaMat);
  lavaSea.rotation.x = -Math.PI / 2;
  lavaSea.position.y = -3.5;
  worldGroup.add(lavaSea);

  const platforms: PlatBox[] = [];
  const gems: Array<{ x: number; y: number; z: number; obj: THREE.Group; collected: boolean }> = [];

  const addVolcanoPlat = (x: number, y: number, z: number, w: number, h: number, d: number, bounce = false) => {
    const plat = buildCompositePlatform(w, h, d, bounce ? goldMat : basaltMat, stoneMat, bounce ? 0xfacc15 : 0xea580c);
    plat.position.set(x, y, z);
    worldGroup.add(plat);
    platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y, bounce });
  };

  // Canyon Spawn Ridge
  addVolcanoPlat(0, 0, 28, 14, 4, 14);

  // Ancient Basalt Bridges & Geyser Platforms winding upward toward Golden Idol Summit
  let lastY = 0;
  let lastZ = 20;
  for (let i = 1; i <= 24; i++) {
    const x = Math.sin(i * 0.72) * 14;
    const y = i * 1.15;
    const z = 20 - i * 6.5;
    const wide = i % 4 === 0 ? 9 : 5.2;
    const bounce = i % 6 === 0;
    addVolcanoPlat(x, y, z, wide, 2.2, 5.2, bounce);

    if (i % 4 === 0) {
      const arch = buildSculptedArchway(6.5, 5.5, stoneMat, basaltMat, 0xf97316);
      arch.position.set(x, y, z);
      worldGroup.add(arch);
    }
    const gem = buildCollectibleGem(0xfb923c);
    gem.position.set(x, y + 1.35, z);
    worldGroup.add(gem);
    gems.push({ x, y: y + 1.35, z, obj: gem, collected: false });

    lastY = y;
    lastZ = z;
  }

  // Summit Golden Temple Altar
  const summitY = lastY + 2;
  const summitZ = lastZ - 11;
  addVolcanoPlat(0, summitY, summitZ, 16, 4.5, 16);
  const idolPortal = buildVictoryPortalGate(0xfacc15);
  idolPortal.position.set(0, summitY, summitZ - 2);
  worldGroup.add(idolPortal);

  let px = 0;
  let py = 0.2;
  let pz = 28;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let facingYaw = Math.PI;
  let grounded = true;
  let grappleCd = 0;
  let score = 0;
  let lives = 3;
  let won = false;
  let signalText: string | null = 'CLIMB ABOVE THE LAVA SURGE TO THE GOLDEN TEMPLE!';
  let signalTimer = 3.5;

  const groundHeightAt = (x: number, z: number): number => {
    let best = -999;
    for (const p of platforms) {
      if (x >= p.minX - 0.35 && x <= p.maxX + 0.35 && z >= p.minZ - 0.35 && z <= p.maxZ + 0.35) {
        if (p.y > best && p.y <= py + 2.4) best = p.y;
      }
    }
    return best;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp): RobloxHudState => {
      playerRig.setFirstPersonHidden(isFp);
      updateSunShadowTarget(lights.sun, [24, 38, 22], px, pz);
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }
      if (grappleCd > 0) grappleCd -= dt;

      // Dynamic volcanic lava surge tide
      const surgeWave = Math.max(-3.5, Math.sin(elapsed * 0.25) * 4.5 - 1.0);
      lavaSea.position.y = surgeWave;
      idolPortal.children[2].rotation.z = elapsed * 2.1;

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = input.sprint ? 11.2 : 7.5;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);

      if (input.actionPressed && grappleCd <= 0) {
        grappleCd = 2.8;
        vy = 11.5;
        vx += _fwd.x * 12;
        vz += _fwd.z * 12;
        robloxAudio.playJump();
        signalText = 'MAGMA DASH!';
        signalTimer = 1.2;
      }

      if (input.jumpPressed && grounded) {
        vy = 12.8;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px += vx * dt;
      pz += vz * dt;
      py += vy * dt;

      let landedBounce = false;
      let bestY = -999;
      for (const p of platforms) {
        if (px >= p.minX - 0.35 && px <= p.maxX + 0.35 && pz >= p.minZ - 0.35 && pz <= p.maxZ + 0.35) {
          if (p.y > bestY && p.y <= py + 2.2) {
            bestY = p.y;
            landedBounce = Boolean(p.bounce);
          }
        }
      }
      if (py <= bestY && bestY > -900) {
        py = bestY;
        if (landedBounce) {
          vy = 19.0;
          grounded = false;
          robloxAudio.playJump();
        } else {
          vy = 0;
          grounded = true;
        }
      } else {
        grounded = false;
      }

      if (py < surgeWave + 0.25 || py < -14) {
        lives = Math.max(0, lives - 1);
        robloxAudio.playElimination();
        px = 0;
        py = 0.4;
        pz = 28;
        vx = 0;
        vy = 0;
        vz = 0;
        if (lives <= 0) lives = 3;
        signalText = 'BURNED IN MAGMA — CLIMB FASTER!';
        signalTimer = 2.0;
      }

      for (const g of gems) {
        if (g.collected) continue;
        g.obj.rotation.y = elapsed * 2.4;
        if (Math.hypot(px - g.x, pz - g.z) < 2.2 && Math.abs(py - g.y) < 2.4) {
          g.collected = true;
          g.obj.visible = false;
          score += 75;
          robloxAudio.playCoin();
        }
      }

      if (!won && Math.hypot(px, pz - (summitZ - 2)) < 4.0 && Math.abs(py - summitY) < 3.5) {
        won = true;
        score += 600;
        robloxAudio.playVictory();
        signalText = 'GOLDEN TEMPLE IDOL CLAIMED!';
        signalTimer = 4.0;
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
        worldTitle: 'OBSIDIAN VOLCANO',
        stageLabel: won ? 'Temple Summit Safe' : `Magma Tide ${surgeWave.toFixed(1)}m`,
        timerSec: null,
        score,
        scoreLabel: 'RELICS',
        lives,
        maxLives: 3,
        phase: won ? 'victory' : 'playing',
        signalText,
        signalTone: surgeWave > 0.5 ? 'red' : 'gold',
        actionLabel: grappleCd > 0 ? `DASH (${Math.ceil(grappleCd)}s)` : 'MAGMA DASH',
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
      pz = 28;
      won = false;
      lives = 3;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}

// =====================================================================
// NEW GAME 4: CORAL ARCHIPELAGO ODYSSEY (Islands + Sail Speedboat!)
// =====================================================================
export function createOceanOdysseyWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig = DEFAULT_ROBLOX_AVATAR
): WorldController {
  scene.background = new THREE.Color(0x38bdf8);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(0xbae6fd);
    scene.fog.near = 60;
    scene.fog.far = 230;
  }

  const skyDome = createRobloxSkyDome(scene, { topHex: '#0284c7', horizonHex: '#fde68a' });
  const clouds = createCloudClusters(scene, isSoftwareGl ? 12 : 22);
  clouds.position.y = 42;

  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor: 0xfff7ed,
    sunIntensity: 2.5,
    hemiSky: 0x7dd3fc,
    hemiGround: 0x0d9488,
  });

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  const sandMat = new THREE.MeshStandardMaterial({
    map: createSandTexture(maxAnisotropy, 6),
    roughness: 0.88,
  });
  const woodMat = createHardwoodDeckMaterial(maxAnisotropy, '#92400e', 2, 2);
  const stoneMat = createCarvedStonePbrMaterial(maxAnisotropy, '#94a3b8', '#475569', 2, 2);

  // Translucent Ocean Surface with dynamic wave motion
  const waterGeo = new THREE.PlaneGeometry(260, 260, isSoftwareGl ? 16 : 32, isSoftwareGl ? 16 : 32);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    roughness: 0.14,
    metalness: 0.1,
    transmission: 0.4,
    transparent: true,
    opacity: 0.88,
  });
  const ocean = new THREE.Mesh(waterGeo, waterMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  worldGroup.add(ocean);

  const islands: Array<{ cx: number; cz: number; rad: number; y: number }> = [
    { cx: 0, cz: 0, rad: 15, y: 1.0 },
    { cx: 48, cz: 26, rad: 14, y: 1.4 },
    { cx: -52, cz: 32, rad: 14, y: 1.4 },
    { cx: 56, cz: -46, rad: 15, y: 1.8 },
    { cx: -50, cz: -50, rad: 16, y: 1.8 },
    { cx: 0, cz: -84, rad: 18, y: 2.2 },
  ];

  const gems: Array<{ x: number; y: number; z: number; obj: THREE.Group; collected: boolean }> = [];

  islands.forEach((isl, idx) => {
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(isl.rad * 0.88, isl.rad * 1.15, isl.y + 2.5, 18), sandMat);
    mound.position.set(isl.cx, (isl.y - 2.5) / 2 + 0.1, isl.cz);
    mound.receiveShadow = true;
    mound.castShadow = true;
    worldGroup.add(mound);

    const pier = buildCompositePlatform(4.5, 0.65, 9, woodMat, woodMat);
    pier.position.set(isl.cx, isl.y + 0.25, isl.cz + isl.rad * 0.9);
    worldGroup.add(pier);

    const lamp = buildNeonLampPost(0xfacc15);
    lamp.position.set(isl.cx + 1.8, isl.y + 0.25, isl.cz + isl.rad * 1.1);
    worldGroup.add(lamp);

    for (let t = 0; t < 3; t++) {
      const ang = (t / 3) * Math.PI * 2 + idx;
      const palm = buildSculptedTree('palm', 0.95);
      palm.position.set(isl.cx + Math.cos(ang) * (isl.rad * 0.55), isl.y, isl.cz + Math.sin(ang) * (isl.rad * 0.55));
      worldGroup.add(palm);
    }

    if (idx > 0) {
      const arch = buildSculptedArchway(6, 5.2, stoneMat, woodMat, 0x2dd4bf);
      arch.position.set(isl.cx, isl.y, isl.cz);
      worldGroup.add(arch);
    }

    for (let k = 0; k < 3; k++) {
      const gx = isl.cx + (k - 1) * 4;
      const gz = isl.cz - 2;
      const gem = buildCollectibleGem(0xfacc15);
      gem.position.set(gx, isl.y + 1.4, gz);
      worldGroup.add(gem);
      gems.push({ x: gx, y: isl.y + 1.4, z: gz, obj: gem, collected: false });
    }
  });

  const sailboat = buildSculptedBoat(0x92400e);
  sailboat.position.set(0, 0.15, 22);
  worldGroup.add(sailboat);

  let px = 0;
  let py = 1.1;
  let pz = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let facingYaw = Math.PI;
  let grounded = true;
  let inBoat = false;
  let score = 0;
  let signalText: string | null = 'WALK TO THE PIER & BOARD YOUR SPEEDBOAT TO SAIL 6 ISLANDS!';
  let signalTimer = 3.8;

  const groundHeightAt = (x: number, z: number): number => {
    for (const isl of islands) {
      if (Math.hypot(x - isl.cx, z - isl.cz) <= isl.rad * 0.92) {
        return isl.y;
      }
      if (Math.abs(x - isl.cx) <= 2.3 && Math.abs(z - (isl.cz + isl.rad * 0.9)) <= 4.6) {
        return isl.y + 0.25;
      }
    }
    return 0;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp): RobloxHudState => {
      playerRig.setFirstPersonHidden(isFp);
      skyDome.position.set(px, 0, pz);
      updateSunShadowTarget(lights.sun, [26, 42, 20], px, pz);
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }

      ocean.position.y = Math.sin(elapsed * 1.4) * 0.14;

      if (input.secondaryPressed || input.actionPressed) {
        if (inBoat) {
          inBoat = false;
          sailboat.position.set(px, 0.15, pz);
          sailboat.rotation.y = facingYaw;
          py = 1.6;
        } else {
          if (Math.hypot(px - sailboat.position.x, pz - sailboat.position.z) > 9) {
            sailboat.position.set(px + 3, 0.15, pz + 3);
          }
          inBoat = true;
          robloxAudio.playCheckpoint();
          signalText = 'SPEEDBOAT LAUNCHED!';
          signalTimer = 1.6;
        }
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const spd = inBoat ? (input.sprint ? 23 : 16) : input.sprint ? 10.6 : 7.2;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, inBoat ? 4.5 : 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, inBoat ? 4.5 : 10, dt);

      if (input.jumpPressed && grounded && !inBoat) {
        vy = 12.2;
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -115, 115);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -115, 115);
      py += vy * dt;

      const fy = groundHeightAt(px, pz);
      if (inBoat) {
        py = 0.2 + Math.sin(elapsed * 2.4) * 0.1;
        vy = 0;
        grounded = true;
      } else if (py <= fy) {
        py = fy;
        vy = 0;
        grounded = true;
      } else {
        grounded = false;
      }

      for (const g of gems) {
        if (g.collected) continue;
        g.obj.rotation.y = elapsed * 2.4;
        if (Math.hypot(px - g.x, pz - g.z) < 2.6 && Math.abs(py - g.y) < 3.0) {
          g.collected = true;
          g.obj.visible = false;
          score += 100;
          robloxAudio.playCoin();
        }
      }

      const hs = Math.hypot(vx, vz);
      if (hs > 0.4) {
        facingYaw = smoothRotateYaw(facingYaw, Math.atan2(vx, vz), dt, inBoat ? 6 : 10);
      } else if (isFp) {
        facingYaw = yaw;
      }

      if (inBoat) {
        sailboat.position.set(px, py - 0.05, pz);
        sailboat.rotation.y = facingYaw;
        playerRig.root.position.set(px, py + 0.65, pz);
        playerRig.root.rotation.y = facingYaw;
      } else {
        playerRig.root.position.set(px, py, pz);
        playerRig.root.rotation.y = facingYaw;
      }
      animateRobloxCharacter(playerRig, inBoat ? 0 : hs, grounded, elapsed, 0);

      const collected = gems.filter((g) => g.collected).length;
      const done = collected >= gems.length;
      return {
        worldTitle: 'CORAL ODYSSEY',
        stageLabel: `${collected}/${gems.length} Treasures · ${inBoat ? 'Sailing' : 'Island'}`,
        timerSec: null,
        score,
        scoreLabel: 'GOLD',
        lives: 1,
        maxLives: 1,
        phase: done ? 'victory' : 'playing',
        signalText,
        signalTone: done ? 'gold' : 'green',
        actionLabel: inBoat ? 'STEP ASHORE' : 'BOARD SPEEDBOAT',
        secondaryActionLabel: null,
        canSwitchStage: false,
        inCar: inBoat,
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
      py = 1.1;
      pz = 0;
      inBoat = false;
      sailboat.position.set(0, 0.15, 22);
      gems.forEach((g) => {
        g.collected = false;
        g.obj.visible = true;
      });
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, skyDome, clouds, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}
