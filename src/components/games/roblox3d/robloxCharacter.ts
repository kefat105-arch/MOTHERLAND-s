import * as THREE from 'three';
import type { RobloxAvatarConfig } from '../../../types';

export interface RobloxCharacterStyle {
  skinHex?: number;
  shirtHex?: number;
  pantsHex?: number;
  shoeHex?: number;
  hairHex?: number;
  jerseyNumber?: string;
  faceMood?: 'confident' | 'smile' | 'focused' | 'scared' | 'cool_shades';
  roleVariant?:
    | 'contestant'
    | 'guard_circle'
    | 'guard_triangle'
    | 'guard_square'
    | 'sheriff'
    | 'warrior'
    | 'explorer';
  hatStyle?:
    | 'none'
    | 'hair_swept'
    | 'hair_spiky'
    | 'cap'
    | 'sheriff_hat'
    | 'bandana'
    | 'crown';
  accessory?: 'none' | 'cape' | 'back_sword' | 'aura';
  displayName?: string;
  scale?: number;
}

export interface RobloxCharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  auraRing?: THREE.Mesh;
  capeMesh?: THREE.Mesh;
  carGroup?: THREE.Group;
  eyeHeight: number;
  setFirstPersonHidden: (isFirstPerson: boolean) => void;
  setCarMode: (inCar: boolean) => void;
}

export const AVATAR_PRESET_STORAGE_KEY = 'motherland_roblox_avatar_v1';

export const DEFAULT_ROBLOX_AVATAR: RobloxAvatarConfig = {
  skinHex: 0xf3c297,
  shirtHex: 0x0284c7,
  pantsHex: 0x1e293b,
  hairHex: 0x1e1b18,
  hatStyle: 'hair_swept',
  faceMood: 'smile',
  accessory: 'none',
};

export function loadSavedRobloxAvatar(): RobloxAvatarConfig {
  try {
    const raw = localStorage.getItem(AVATAR_PRESET_STORAGE_KEY);
    if (!raw) return DEFAULT_ROBLOX_AVATAR;
    const parsed = JSON.parse(raw) as Partial<RobloxAvatarConfig>;
    return { ...DEFAULT_ROBLOX_AVATAR, ...parsed };
  } catch {
    return DEFAULT_ROBLOX_AVATAR;
  }
}

export function saveRobloxAvatar(cfg: RobloxAvatarConfig): void {
  try {
    localStorage.setItem(AVATAR_PRESET_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
}

function makeRoundedBoxGeom(w: number, h: number, d: number, bevel = 0.045): THREE.BufferGeometry {
  const hw = Math.max(0.05, w / 2 - bevel);
  const hh = Math.max(0.05, h / 2 - bevel);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.quadraticCurveTo(hw + bevel, -hh, hw + bevel, -hh + bevel);
  shape.lineTo(hw + bevel, hh - bevel);
  shape.quadraticCurveTo(hw + bevel, hh, hw, hh);
  shape.lineTo(-hw, hh);
  shape.quadraticCurveTo(-hw - bevel, hh, -hw - bevel, hh - bevel);
  shape.lineTo(-hw - bevel, -hh + bevel);
  shape.quadraticCurveTo(-hw - bevel, -hh, -hw, -hh);

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.05, d - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  extrude.center();
  return extrude;
}

function createRobloxFaceTexture(
  skinHex: number,
  mood: RobloxCharacterStyle['faceMood'] = 'confident'
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${skinHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);

  const grad = ctx.createRadialGradient(128, 128, 24, 128, 128, 130);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (mood === 'cool_shades') {
    // Sleek dark shades + confident grin
    ctx.fillStyle = '#090d16';
    ctx.fillRect(54, 92, 62, 34);
    ctx.fillRect(140, 92, 62, 34);
    ctx.fillRect(114, 102, 28, 8);
    ctx.fillStyle = 'rgba(56,189,248,0.45)';
    ctx.fillRect(62, 97, 22, 6);
    ctx.fillRect(148, 97, 22, 6);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(98, 158);
    ctx.quadraticCurveTo(132, 180, 162, 152);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.ellipse(90, 112, 11, mood === 'focused' ? 14 : 16, 0, 0, Math.PI * 2);
    ctx.ellipse(166, 112, 11, mood === 'focused' ? 14 : 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'focused') {
      ctx.moveTo(72, 92);
      ctx.lineTo(106, 98);
      ctx.moveTo(184, 92);
      ctx.lineTo(150, 98);
    } else {
      ctx.moveTo(74, 88);
      ctx.quadraticCurveTo(90, 82, 105, 88);
      ctx.moveTo(151, 88);
      ctx.quadraticCurveTo(166, 82, 182, 88);
    }
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(94, 106, 3.6, 0, Math.PI * 2);
    ctx.arc(170, 106, 3.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (mood === 'scared') {
      ctx.ellipse(128, 166, 14, 11, 0, 0, Math.PI * 2);
    } else if (mood === 'focused') {
      ctx.moveTo(104, 166);
      ctx.quadraticCurveTo(128, 161, 152, 166);
    } else {
      ctx.moveTo(96, 156);
      ctx.quadraticCurveTo(128, 182, 160, 156);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGuardMaskTexture(symbol: 'circle' | 'triangle' | 'square'): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#151820';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  if (symbol === 'circle') {
    ctx.beginPath();
    ctx.arc(128, 128, 56, 0, Math.PI * 2);
    ctx.stroke();
  } else if (symbol === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(128, 68);
    ctx.lineTo(188, 178);
    ctx.lineTo(68, 178);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(76, 76, 104, 104);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createJerseyTexture(shirtHex: number, numberText?: string, isSquidTracksuit = false): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${shirtHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);

  if (isSquidTracksuit) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(124, 0, 8, size);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(18, 0, 12, size);
    ctx.fillRect(size - 30, 0, 12, size);
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(92, 0);
    ctx.lineTo(164, 0);
    ctx.lineTo(128, 54);
    ctx.closePath();
    ctx.fill();
  } else {
    // Stylish Roblox R15 hoodie / jacket trim
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(122, 24, 12, size - 24);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, size - 28, size, 28);
  }

  if (numberText) {
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillRect(142, 64, 82, 42);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeRect(142, 64, 82, 42);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numberText, 183, 86);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createNametagSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(9, 13, 24, 0.78)';
  ctx.roundRect(12, 10, 232, 44, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.roundRect(12, 10, 232, 44, 12);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, 3.45, 0);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

export function createRobloxCharacter(style: RobloxCharacterStyle = {}): RobloxCharacterRig {
  const isGuard =
    style.roleVariant === 'guard_circle' ||
    style.roleVariant === 'guard_triangle' ||
    style.roleVariant === 'guard_square';

  const skinHex = style.skinHex ?? 0xf3c297;
  const shirtHex = isGuard ? 0xe11d48 : style.shirtHex ?? 0x0f6b63;
  const pantsHex = isGuard ? 0xbe123c : style.pantsHex ?? 0x0d5c55;
  const shoeHex = style.shoeHex ?? 0x1e293b;
  const hairHex = style.hairHex ?? 0x1e1b18;
  const isSquidSuit = style.roleVariant === 'contestant' || Boolean(style.jerseyNumber);

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.56, metalness: 0.04 });
  const shirtFrontMat = new THREE.MeshStandardMaterial({
    map: createJerseyTexture(shirtHex, style.jerseyNumber, isSquidSuit),
    roughness: 0.58,
    metalness: 0.08,
  });
  const shirtSideMat = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.62, metalness: 0.06 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.7, metalness: 0.04 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: shoeHex, roughness: 0.45, metalness: 0.16 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.65, metalness: 0.08 });

  const torsoGeom = makeRoundedBoxGeom(1.02, 1.06, 0.56, 0.05);
  const torsoMesh = new THREE.Mesh(torsoGeom, [
    shirtSideMat,
    shirtSideMat,
    shirtSideMat,
    shirtSideMat,
    shirtFrontMat,
    shirtSideMat,
  ]);
  torsoMesh.position.y = 1.66;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.21, 0.16, 12),
    isGuard ? shirtSideMat : skinMat
  );
  neckMesh.position.y = 2.24;
  bodyPivot.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.y = 2.28;
  bodyPivot.add(headGroup);

  const headPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.28, 0.0),
    new THREE.Vector2(0.35, 0.07),
    new THREE.Vector2(0.36, 0.52),
    new THREE.Vector2(0.29, 0.61),
    new THREE.Vector2(0.16, 0.62),
    new THREE.Vector2(0.16, 0.68),
    new THREE.Vector2(0.0, 0.68),
  ];
  const headGeom = new THREE.LatheGeometry(headPoints, 20);
  const headMesh = new THREE.Mesh(headGeom, isGuard ? shirtSideMat : skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const facePlateGeom = new THREE.PlaneGeometry(0.52, 0.48);
  const facePlateMat = isGuard
    ? new THREE.MeshStandardMaterial({
        map: createGuardMaskTexture(
          style.roleVariant === 'guard_triangle'
            ? 'triangle'
            : style.roleVariant === 'guard_square'
            ? 'square'
            : 'circle'
        ),
        roughness: 0.35,
        metalness: 0.22,
      })
    : new THREE.MeshStandardMaterial({
        map: createRobloxFaceTexture(skinHex, style.faceMood),
        roughness: 0.5,
        metalness: 0.04,
      });
  const facePlate = new THREE.Mesh(facePlateGeom, facePlateMat);
  facePlate.position.set(0, 0.31, 0.362);
  headGroup.add(facePlate);

  if (isGuard) {
    const hoodMesh = new THREE.Mesh(makeRoundedBoxGeom(0.76, 0.72, 0.72, 0.08), shirtSideMat);
    hoodMesh.position.set(0, 0.33, -0.04);
    hoodMesh.castShadow = true;
    headGroup.add(hoodMesh);
  } else {
    const hatStyle = style.hatStyle ?? 'hair_swept';
    if (hatStyle === 'hair_swept') {
      const topHair = new THREE.Mesh(makeRoundedBoxGeom(0.78, 0.24, 0.76, 0.06), hairMat);
      topHair.position.set(0, 0.58, -0.02);
      const backHair = new THREE.Mesh(makeRoundedBoxGeom(0.76, 0.42, 0.26, 0.05), hairMat);
      backHair.position.set(0, 0.35, -0.27);
      headGroup.add(topHair, backHair);
    } else if (hatStyle === 'hair_spiky') {
      const base = new THREE.Mesh(makeRoundedBoxGeom(0.76, 0.22, 0.74, 0.05), hairMat);
      base.position.set(0, 0.56, -0.02);
      headGroup.add(base);
      for (let s = 0; s < 5; s++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 6), hairMat);
        spike.position.set((s - 2) * 0.16, 0.74, (s % 2 === 0 ? 0.1 : -0.1));
        spike.rotation.z = (2 - s) * 0.18;
        headGroup.add(spike);
      }
    } else if (hatStyle === 'cap') {
      const capCrown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.4, 0.22, 16),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 })
      );
      capCrown.position.set(0, 0.55, 0);
      const brim = new THREE.Mesh(
        makeRoundedBoxGeom(0.68, 0.06, 0.42, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 })
      );
      brim.position.set(0, 0.46, 0.34);
      headGroup.add(capCrown, brim);
    } else if (hatStyle === 'sheriff_hat') {
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.65 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.66, 0.07, 18), hatMat);
      brim.position.set(0, 0.54, 0);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.28, 16), hatMat);
      crown.position.set(0, 0.69, 0);
      headGroup.add(brim, crown);
    } else if (hatStyle === 'bandana') {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.39, 0.14, 18),
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0x92400e,
          emissiveIntensity: 0.35,
          roughness: 0.4,
        })
      );
      band.position.set(0, 0.49, 0);
      headGroup.add(band);
    } else if (hatStyle === 'crown') {
      const crownRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.34, 0.24, 10),
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xca8a04,
          emissiveIntensity: 0.4,
          metalness: 0.85,
          roughness: 0.2,
        })
      );
      crownRing.position.set(0, 0.72, 0);
      headGroup.add(crownRing);
    }
  }

  // Accessories (Cape / Back Sword / Aura)
  let capeMesh: THREE.Mesh | undefined;
  let auraRing: THREE.Mesh | undefined;
  if (style.accessory === 'cape') {
    capeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.35, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 })
    );
    capeMesh.position.set(0, 1.5, -0.34);
    capeMesh.rotation.x = 0.14;
    bodyPivot.add(capeMesh);
  } else if (style.accessory === 'back_sword') {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 1.65, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.7,
        metalness: 0.9,
        roughness: 0.15,
      })
    );
    blade.position.set(0, 1.8, -0.35);
    blade.rotation.z = -0.55;
    bodyPivot.add(blade);
  }

  if (style.accessory === 'aura' || style.roleVariant === 'warrior') {
    auraRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.045, 10, 32),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      })
    );
    auraRing.rotation.x = Math.PI / 2;
    auraRing.position.y = 0.25;
    root.add(auraRing);
  }

  // Arms & Legs
  const buildArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.74, 2.12, 0);
    const sleeve = new THREE.Mesh(makeRoundedBoxGeom(0.42, 0.56, 0.44, 0.04), shirtSideMat);
    sleeve.position.y = -0.26;
    sleeve.castShadow = true;
    pivot.add(sleeve);
    const forearm = new THREE.Mesh(
      makeRoundedBoxGeom(0.38, 0.46, 0.4, 0.04),
      isGuard ? new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 }) : skinMat
    );
    forearm.position.y = -0.72;
    forearm.castShadow = true;
    pivot.add(forearm);
    return pivot;
  };
  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);
  bodyPivot.add(leftArmPivot, rightArmPivot);

  const buildLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26, 1.12, 0);
    const legMesh = new THREE.Mesh(makeRoundedBoxGeom(0.45, 0.9, 0.48, 0.04), pantsMat);
    legMesh.position.y = -0.46;
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    pivot.add(legMesh);
    const shoeMesh = new THREE.Mesh(makeRoundedBoxGeom(0.47, 0.22, 0.58, 0.03), shoeMat);
    shoeMesh.position.set(0, -1.01, 0.04);
    shoeMesh.castShadow = true;
    pivot.add(shoeMesh);
    return pivot;
  };
  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);
  bodyPivot.add(leftLegPivot, rightLegPivot);

  if (style.displayName) {
    root.add(createNametagSprite(style.displayName));
  }

  // Drivable Sports Car Shell
  const carGroup = new THREE.Group();
  carGroup.visible = false;
  const carBodyMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.22, metalness: 0.68 });
  const carGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.2, clearcoat: 1 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const chassis = new THREE.Mesh(makeRoundedBoxGeom(2.2, 0.65, 4.4, 0.12), carBodyMat);
  chassis.position.y = 0.62;
  chassis.castShadow = true;
  carGroup.add(chassis);
  const cabin = new THREE.Mesh(makeRoundedBoxGeom(1.75, 0.6, 2.1, 0.1), carGlassMat);
  cabin.position.set(0, 1.18, -0.2);
  carGroup.add(cabin);
  for (const [wx, wz] of [
    [-1.08, 1.32],
    [1.08, 1.32],
    [-1.08, -1.32],
    [1.08, -1.32],
  ] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    carGroup.add(w);
  }
  root.add(carGroup);

  const scale = style.scale ?? 1;
  if (scale !== 1) root.scale.setScalar(scale);

  return {
    root,
    bodyPivot,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    auraRing,
    capeMesh,
    carGroup,
    eyeHeight: 2.55 * scale,
    setFirstPersonHidden: (isFp: boolean) => {
      headGroup.visible = !isFp;
      neckMesh.visible = !isFp;
      torsoMesh.visible = !isFp;
      if (capeMesh) capeMesh.visible = !isFp;
    },
    setCarMode: (inCar: boolean) => {
      carGroup.visible = inCar;
      bodyPivot.position.y = inCar ? 0.55 : 0;
    },
  };
}

export function smoothRotateYaw(current: number, target: number, dt: number, speed = 11): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-speed * dt));
}

export function animateRobloxCharacter(
  rig: RobloxCharacterRig,
  speed: number,
  grounded: boolean,
  elapsed: number,
  actionTimer = 0
): void {
  if (rig.carGroup?.visible) {
    rig.leftLegPivot.rotation.x = -Math.PI / 2.4;
    rig.rightLegPivot.rotation.x = -Math.PI / 2.4;
    rig.leftArmPivot.rotation.x = -0.6;
    rig.rightArmPivot.rotation.x = -0.6;
    return;
  }

  const normalizedSpeed = Math.min(1.25, speed / 9.2);
  const stridePhase = elapsed * (6.2 + normalizedSpeed * 4.2);

  if (!grounded) {
    rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(rig.leftArmPivot.rotation.x, -2.55, 0.18);
    rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(rig.rightArmPivot.rotation.x, -2.55, 0.18);
    rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(rig.leftLegPivot.rotation.x, 0.35, 0.18);
    rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(rig.rightLegPivot.rotation.x, -0.35, 0.18);
  } else if (normalizedSpeed > 0.07) {
    const swing = Math.sin(stridePhase) * 0.78 * Math.min(1, normalizedSpeed);
    rig.leftLegPivot.rotation.x = swing;
    rig.rightLegPivot.rotation.x = -swing;
    rig.leftArmPivot.rotation.x = -swing * 0.78;
    rig.rightArmPivot.rotation.x = swing * 0.78;
    rig.bodyPivot.position.y = Math.abs(Math.cos(stridePhase)) * 0.06 * Math.min(1, normalizedSpeed);
    if (rig.capeMesh) rig.capeMesh.rotation.x = 0.22 + normalizedSpeed * 0.32 + Math.sin(stridePhase) * 0.08;
  } else {
    rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(rig.leftLegPivot.rotation.x, 0, 0.16);
    rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(rig.rightLegPivot.rotation.x, 0, 0.16);
    rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
      rig.leftArmPivot.rotation.x,
      Math.sin(elapsed * 2.1) * 0.04,
      0.14
    );
    rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
      rig.rightArmPivot.rotation.x,
      -Math.sin(elapsed * 2.1) * 0.04,
      0.14
    );
    rig.bodyPivot.position.y = Math.sin(elapsed * 2.2) * 0.02;
    if (rig.capeMesh) rig.capeMesh.rotation.x = 0.12 + Math.sin(elapsed * 2.0) * 0.04;
  }

  if (actionTimer > 0) {
    rig.rightArmPivot.rotation.x = -1.6 - Math.sin(actionTimer * 18) * 0.6;
  }

  if (rig.auraRing) {
    rig.auraRing.rotation.z = elapsed * 2.1;
  }
}
