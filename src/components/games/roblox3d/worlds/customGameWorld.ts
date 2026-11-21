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
  createGrassTexture,
  createRobloxSkyDome,
  createSandTexture,
  createThreePointLights,
  updateSunShadowTarget,
} from '../robloxRenderer';
import {
  buildCollectibleGem,
  buildCompositePlatform,
  buildCrystalCluster,
  buildSculptedArchway,
  buildSculptedTree,
  buildVictoryPortalGate,
  createBrushedTitaniumPbrMaterial,
  createCarvedStonePbrMaterial,
  createHardwoodDeckMaterial,
  createMarblePbrMaterial,
  createVolcanicBasaltMaterial,
  createWetCyberAsphaltMaterial,
} from '../proceduralAssets';
import { robloxAudio } from '../robloxAudio';
import type {
  CustomGameDefinition,
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
          mat.dispose();
        }
      }
    });
  }
}

interface CustomPlatCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  bounce?: boolean;
  moving?: { obj: THREE.Object3D; baseX: number; ampX: number; speed: number; halfW: number };
}

export function createCustomUserGameWorld(
  definition: CustomGameDefinition,
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  initialAvatar: RobloxAvatarConfig = DEFAULT_ROBLOX_AVATAR
): WorldController {
  // Biome Sky + Fog + Lighting
  let topHex = 0x0284c7;
  let botHex = 0xbfe3ff;
  let fogHex = 0xbfe3ff;
  let sunColor = 0xfff5db;
  if (definition.biome === 'golden_sunset') {
    topHex = 0x7c3aed;
    botHex = 0xfb923c;
    fogHex = 0xfdba74;
    sunColor = 0xffedd5;
  } else if (definition.biome === 'cyber_night') {
    topHex = 0x090d1f;
    botHex = 0x1e1b4b;
    fogHex = 0x0f172a;
    sunColor = 0x38bdf8;
  } else if (definition.biome === 'volcano_ash') {
    topHex = 0x27100b;
    botHex = 0x7c2d12;
    fogHex = 0x431407;
    sunColor = 0xfb923c;
  }

  scene.background = new THREE.Color(fogHex);
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.color.setHex(fogHex);
    scene.fog.near = 55;
    scene.fog.far = 220;
  }

  const topStr = '#' + topHex.toString(16).padStart(6, '0');
  const botStr = '#' + botHex.toString(16).padStart(6, '0');
  const skyDome = createRobloxSkyDome(scene, { topHex: topStr, horizonHex: botStr });
  const clouds = createCloudClusters(scene, isSoftwareGl ? 10 : 18);
  clouds.position.y = 42;

  const lights = createThreePointLights(scene, {
    isSoftwareGl,
    sunColor,
    sunIntensity: definition.biome === 'cyber_night' ? 1.9 : 2.45,
  });

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let avatarCfg = initialAvatar;
  let playerRig = createRobloxCharacter(buildAvatarStyle(avatarCfg));
  scene.add(playerRig.root);

  // Ground Material
  let groundMat: THREE.MeshStandardMaterial;
  if (definition.groundMaterial === 'marble') {
    groundMat = createMarblePbrMaterial(maxAnisotropy, '#f8fafc', '#94a3b8', 8, 8);
  } else if (definition.groundMaterial === 'asphalt') {
    groundMat = createWetCyberAsphaltMaterial(maxAnisotropy, '#22d3ee', 10, 10);
  } else if (definition.groundMaterial === 'basalt') {
    groundMat = createVolcanicBasaltMaterial(maxAnisotropy, true, 8, 8);
  } else if (definition.groundMaterial === 'sand') {
    groundMat = new THREE.MeshStandardMaterial({
      map: createSandTexture(maxAnisotropy, 14),
      roughness: 0.88,
    });
  } else {
    groundMat = new THREE.MeshStandardMaterial({
      map: createGrassTexture(maxAnisotropy, 16),
      roughness: 0.84,
    });
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), groundMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  worldGroup.add(floor);

  const stoneMat = createCarvedStonePbrMaterial(maxAnisotropy, '#94a3b8', '#475569', 2, 2);
  const marbleMat = createMarblePbrMaterial(maxAnisotropy, '#f1f5f9', '#64748b', 2, 2);
  const woodMat = createHardwoodDeckMaterial(maxAnisotropy, '#92400e', 2, 2);
  const neonMat = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#06b6d4', 2, 2);
  const goldMat = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#f59e0b', 1, 1);

  const colliders: CustomPlatCollider[] = [];
  const gems: Array<{ x: number; y: number; z: number; obj: THREE.Group; collected: boolean }> = [];
  const checkpoints: Array<{ x: number; y: number; z: number; reached: boolean }> = [];
  const hazards: Array<{ x: number; y: number; z: number; r: number }> = [];
  const spinners: Array<{ obj: THREE.Group; cx: number; cy: number; cz: number; len: number }> = [];
  const portals: Array<{ x: number; y: number; z: number; obj: THREE.Group }> = [];

  let spawnX = 0;
  let spawnY = 0.2;
  let spawnZ = 0;

  for (const obj of definition.objects || []) {
    const s = Math.max(0.4, Math.min(3.0, Number(obj.scale) || 1));
    const rotY = Number(obj.rotY) || 0;

    if (obj.kind === 'spawn_pad') {
      spawnX = obj.x;
      spawnY = obj.y + 0.6;
      spawnZ = obj.z;
      const pad = buildCompositePlatform(4.5 * s, 0.55, 4.5 * s, neonMat, goldMat, 0x10b981);
      pad.position.set(obj.x, obj.y + 0.55, obj.z);
      pad.rotation.y = rotY;
      worldGroup.add(pad);
      colliders.push({
        minX: obj.x - 2.25 * s,
        maxX: obj.x + 2.25 * s,
        minZ: obj.z - 2.25 * s,
        maxZ: obj.z + 2.25 * s,
        y: obj.y + 0.55,
      });
    } else if (
      obj.kind === 'platform_stone' ||
      obj.kind === 'platform_marble' ||
      obj.kind === 'platform_wood' ||
      obj.kind === 'platform_neon' ||
      obj.kind === 'moving_platform' ||
      obj.kind === 'bounce_pad'
    ) {
      const w = 5.5 * s;
      const h = 1.0 * s;
      const d = 5.5 * s;
      const mat =
        obj.kind === 'platform_marble'
          ? marbleMat
          : obj.kind === 'platform_wood'
          ? woodMat
          : obj.kind === 'platform_neon' || obj.kind === 'moving_platform'
          ? neonMat
          : obj.kind === 'bounce_pad'
          ? goldMat
          : stoneMat;
      const glow =
        obj.kind === 'bounce_pad'
          ? 0xfacc15
          : obj.kind === 'platform_neon' || obj.kind === 'moving_platform'
          ? 0x22d3ee
          : undefined;
      const plat = buildCompositePlatform(w, h, d, mat, stoneMat, glow);
      plat.position.set(obj.x, obj.y + h, obj.z);
      plat.rotation.y = rotY;
      worldGroup.add(plat);
      colliders.push({
        minX: obj.x - w / 2,
        maxX: obj.x + w / 2,
        minZ: obj.z - d / 2,
        maxZ: obj.z + d / 2,
        y: obj.y + h,
        bounce: obj.kind === 'bounce_pad',
        moving:
          obj.kind === 'moving_platform'
            ? { obj: plat, baseX: obj.x, ampX: 5.0 * s, speed: 1.5, halfW: w / 2 }
            : undefined,
      });
    } else if (obj.kind === 'stone_arch') {
      const arch = buildSculptedArchway(5.5 * s, 5.2 * s, stoneMat, goldMat, 0x38bdf8);
      arch.position.set(obj.x, obj.y, obj.z);
      arch.rotation.y = rotY;
      worldGroup.add(arch);
    } else if (obj.kind === 'tree_palm') {
      const tree = buildSculptedTree('palm', s);
      tree.position.set(obj.x, obj.y, obj.z);
      tree.rotation.y = rotY;
      worldGroup.add(tree);
    } else if (obj.kind === 'tree_pine') {
      const tree = buildSculptedTree('pine', s);
      tree.position.set(obj.x, obj.y, obj.z);
      tree.rotation.y = rotY;
      worldGroup.add(tree);
    } else if (obj.kind === 'crystal_pillar') {
      const crystal = buildCrystalCluster(0x2dd4bf, 0x0d9488, s);
      crystal.position.set(obj.x, obj.y, obj.z);
      crystal.rotation.y = rotY;
      worldGroup.add(crystal);
    } else if (obj.kind === 'coin_gem') {
      const gem = buildCollectibleGem(0xfacc15);
      gem.scale.setScalar(s);
      gem.position.set(obj.x, obj.y + 1.2, obj.z);
      worldGroup.add(gem);
      gems.push({ x: obj.x, y: obj.y + 1.2, z: obj.z, obj: gem, collected: false });
    } else if (obj.kind === 'checkpoint') {
      const flag = buildCrystalCluster(0x22c55e, 0x15803d, 0.85 * s);
      flag.position.set(obj.x, obj.y, obj.z);
      worldGroup.add(flag);
      checkpoints.push({ x: obj.x, y: obj.y, z: obj.z, reached: false });
    } else if (obj.kind === 'hazard_lava') {
      const lavaPad = new THREE.Mesh(
        new THREE.BoxGeometry(6 * s, 0.35, 6 * s),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.8 })
      );
      lavaPad.position.set(obj.x, obj.y + 0.18, obj.z);
      worldGroup.add(lavaPad);
      hazards.push({ x: obj.x, y: obj.y, z: obj.z, r: 2.9 * s });
    } else if (obj.kind === 'laser_spinner') {
      const spGroup = new THREE.Group();
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, 1.2, 10),
        neonMat
      );
      hub.position.y = 0.6;
      spGroup.add(hub);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 7.5 * s, 8),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 2.2 })
      );
      beam.rotation.z = Math.PI / 2;
      beam.position.y = 0.9;
      spGroup.add(beam);
      spGroup.position.set(obj.x, obj.y, obj.z);
      worldGroup.add(spGroup);
      spinners.push({ obj: spGroup, cx: obj.x, cy: obj.y + 0.9, cz: obj.z, len: 3.7 * s });
    } else if (obj.kind === 'finish_portal') {
      const portal = buildVictoryPortalGate(0x10b981);
      portal.scale.setScalar(s);
      portal.position.set(obj.x, obj.y, obj.z);
      portal.rotation.y = rotY;
      worldGroup.add(portal);
      portals.push({ x: obj.x, y: obj.y, z: obj.z, obj: portal });
    }
  }

  let px = spawnX;
  let py = spawnY;
  let pz = spawnZ;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let facingYaw = Math.PI;
  let grounded = true;
  let score = 0;
  let won = false;
  let signalText: string | null = `PLAYING "${definition.title.toUpperCase()}"!`;
  let signalTimer = 3.0;

  const groundHeightAt = (x: number, z: number): number => {
    let best = 0;
    for (const c of colliders) {
      if (x >= c.minX - 0.3 && x <= c.maxX + 0.3 && z >= c.minZ - 0.3 && z <= c.maxZ + 0.3) {
        if (c.y > best && c.y <= py + 2.4) best = c.y;
      }
    }
    return best;
  };

  return {
    update: (dt, elapsed, input, yaw, _pitch, isFp): RobloxHudState => {
      playerRig.setFirstPersonHidden(isFp);
      skyDome.position.set(px, 0, pz);
      updateSunShadowTarget(lights.sun, [24, 38, 22], px, pz);
      if (signalTimer > 0) {
        signalTimer -= dt;
        if (signalTimer <= 0) signalText = null;
      }

      for (const c of colliders) {
        if (c.moving) {
          const nx = c.moving.baseX + Math.sin(elapsed * c.moving.speed) * c.moving.ampX;
          c.moving.obj.position.x = nx;
          c.minX = nx - c.moving.halfW;
          c.maxX = nx + c.moving.halfW;
        }
      }
      for (const sp of spinners) {
        sp.obj.rotation.y = elapsed * 2.1;
        const dx = px - sp.cx;
        const dz = pz - sp.cz;
        if (Math.hypot(dx, dz) < sp.len && Math.abs(py - sp.cy) < 1.15) {
          px = spawnX;
          py = spawnY + 0.4;
          pz = spawnZ;
          vx = 0;
          vy = 0;
          vz = 0;
          robloxAudio.playElimination();
          signalText = 'HIT LASER SPINNER!';
          signalTimer = 1.5;
        }
      }
      for (const p of portals) {
        p.obj.children[2].rotation.z = elapsed * 2.2;
        if (!won && Math.hypot(px - p.x, pz - p.z) < 3.0 && Math.abs(py - p.y) < 3.2) {
          won = true;
          score += 500;
          robloxAudio.playVictory();
          signalText = 'CUSTOM WORLD VICTORY!';
          signalTimer = 4.0;
        }
      }

      _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      _rgt.set(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
      const baseSpd = Math.min(24, Math.max(5, Number(definition.moveSpeed) || 10.5));
      const spd = input.sprint ? baseSpd * 1.35 : baseSpd;
      vx = THREE.MathUtils.damp(vx, (_fwd.x * -input.moveZ + _rgt.x * input.moveX) * spd, 10, dt);
      vz = THREE.MathUtils.damp(vz, (_fwd.z * -input.moveZ + _rgt.z * input.moveX) * spd, 10, dt);

      if (input.jumpPressed && grounded) {
        vy = Math.min(22, Math.max(7, Number(definition.jumpPower) || 12.2));
        grounded = false;
        robloxAudio.playJump();
      }
      vy -= 26 * dt;
      px = THREE.MathUtils.clamp(px + vx * dt, -86, 86);
      pz = THREE.MathUtils.clamp(pz + vz * dt, -86, 86);
      py += vy * dt;

      let bounceHit = false;
      let bestY = 0;
      for (const c of colliders) {
        if (px >= c.minX - 0.3 && px <= c.maxX + 0.3 && pz >= c.minZ - 0.3 && pz <= c.maxZ + 0.3) {
          if (c.y > bestY && c.y <= py + 2.2) {
            bestY = c.y;
            bounceHit = Boolean(c.bounce);
          }
        }
      }
      if (py <= bestY) {
        py = bestY;
        if (bounceHit) {
          vy = 18.5;
          grounded = false;
          robloxAudio.playJump();
        } else {
          vy = 0;
          grounded = true;
        }
      } else {
        grounded = false;
      }

      for (const hz of hazards) {
        if (Math.hypot(px - hz.x, pz - hz.z) < hz.r && Math.abs(py - hz.y) < 1.2) {
          px = spawnX;
          py = spawnY + 0.5;
          pz = spawnZ;
          robloxAudio.playElimination();
          signalText = 'LAVA HAZARD!';
          signalTimer = 1.4;
        }
      }

      for (const cp of checkpoints) {
        if (!cp.reached && Math.hypot(px - cp.x, pz - cp.z) < 3.0 && Math.abs(py - cp.y) < 2.5) {
          cp.reached = true;
          spawnX = cp.x;
          spawnY = cp.y + 0.4;
          spawnZ = cp.z;
          score += 100;
          robloxAudio.playCheckpoint();
          signalText = 'CHECKPOINT SAVED!';
          signalTimer = 1.8;
        }
      }

      for (const g of gems) {
        if (g.collected) continue;
        g.obj.rotation.y = elapsed * 2.4;
        if (Math.hypot(px - g.x, pz - g.z) < 2.0 && Math.abs(py - g.y) < 2.2) {
          g.collected = true;
          g.obj.visible = false;
          score += 50;
          robloxAudio.playCoin();
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
        worldTitle: definition.title,
        stageLabel: won ? 'Stage Complete!' : `Created by ${definition.creatorName || 'You'}`,
        timerSec: null,
        score,
        scoreLabel: 'SCORE',
        lives: 1,
        maxLives: 1,
        phase: won ? 'victory' : 'playing',
        signalText,
        signalTone: won ? 'gold' : 'green',
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
      px = spawnX;
      py = spawnY;
      pz = spawnZ;
      won = false;
    },
    dispose: () => {
      disposeGroup(worldGroup);
      scene.remove(worldGroup, skyDome, clouds, playerRig.root, lights.sun, lights.hemi, lights.rim);
    },
  };
}
