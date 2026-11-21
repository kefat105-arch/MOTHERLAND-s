import * as THREE from 'three';

/**
 * Procedural Ultra Pro Max PBR Material & Multi-Part Composite Geometry Factory
 * Eliminates repetitive flat bare boxes and recycled single-color materials across
 * all MOTHERLAND 3D worlds and user-created Studio games.
 */

function makeCanvas(w = 256, h = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX: number,
  repeatY: number,
  isColor: boolean
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, Math.max(1, anisotropy));
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createMarblePbrMaterial(
  anisotropy: number,
  baseHex = '#f1f5f9',
  veinHex = '#94a3b8',
  rx = 2,
  ry = 2
): THREE.MeshStandardMaterial {
  const cColor = makeCanvas(256, 256);
  const cRough = makeCanvas(256, 256);
  const cBump = makeCanvas(256, 256);

  cColor.ctx.fillStyle = baseHex;
  cColor.ctx.fillRect(0, 0, 256, 256);
  cRough.ctx.fillStyle = '#303030'; // smooth polished marble (~0.18 roughness)
  cRough.ctx.fillRect(0, 0, 256, 256);
  cBump.ctx.fillStyle = '#909090';
  cBump.ctx.fillRect(0, 0, 256, 256);

  // Organic veins
  for (let i = 0; i < 14; i++) {
    cColor.ctx.strokeStyle = veinHex;
    cColor.ctx.globalAlpha = 0.16 + (i % 3) * 0.08;
    cColor.ctx.lineWidth = 1 + (i % 2);
    cColor.ctx.beginPath();
    let vx = (i * 37) % 256;
    let vy = 0;
    cColor.ctx.moveTo(vx, vy);
    for (let s = 1; s <= 6; s++) {
      vx += Math.sin(i + s * 1.3) * 28;
      vy = (s / 6) * 256;
      cColor.ctx.lineTo(vx, vy);
    }
    cColor.ctx.stroke();
  }
  cColor.ctx.globalAlpha = 1;

  // Tile grout bevel grid
  const step = 128;
  cColor.ctx.strokeStyle = '#cbd5e1';
  cColor.ctx.lineWidth = 4;
  cRough.ctx.strokeStyle = '#d8d8d8'; // rough mortar seams
  cRough.ctx.lineWidth = 5;
  cBump.ctx.strokeStyle = '#303030'; // recessed grout lines
  cBump.ctx.lineWidth = 5;

  for (const pos of [0, step]) {
    for (const ctx of [cColor.ctx, cRough.ctx, cBump.ctx]) {
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 256);
      ctx.moveTo(0, pos);
      ctx.lineTo(256, pos);
      ctx.stroke();
    }
  }

  return new THREE.MeshStandardMaterial({
    map: finalizeTexture(cColor.canvas, anisotropy, rx, ry, true),
    roughnessMap: finalizeTexture(cRough.canvas, anisotropy, rx, ry, false),
    bumpMap: finalizeTexture(cBump.canvas, anisotropy, rx, ry, false),
    bumpScale: 0.035,
    roughness: 0.9,
    metalness: 0.08,
  });
}

export function createCarvedStonePbrMaterial(
  anisotropy: number,
  stoneHex = '#64748b',
  mortarHex = '#334155',
  rx = 2,
  ry = 2
): THREE.MeshStandardMaterial {
  const cColor = makeCanvas(256, 256);
  const cRough = makeCanvas(256, 256);
  const cBump = makeCanvas(256, 256);

  cColor.ctx.fillStyle = stoneHex;
  cColor.ctx.fillRect(0, 0, 256, 256);
  cRough.ctx.fillStyle = '#c8c8c8';
  cRough.ctx.fillRect(0, 0, 256, 256);
  cBump.ctx.fillStyle = '#9e9e9e';
  cBump.ctx.fillRect(0, 0, 256, 256);

  // Chisel stone grain speckles
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 139) % 256;
    const sz = 2 + (i % 5);
    cColor.ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.12)';
    cColor.ctx.fillRect(x, y, sz, sz);
    cBump.ctx.fillStyle = i % 2 === 0 ? '#b6b6b6' : '#7c7c7c';
    cBump.ctx.fillRect(x, y, sz, sz);
  }

  // Running bond masonry courses
  const rows = 4;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    for (const ctx of [cColor.ctx, cBump.ctx]) {
      ctx.strokeStyle = ctx === cColor.ctx ? mortarHex : '#383838';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      const offset = r % 2 === 0 ? 0 : 64;
      for (let x = offset; x < 256; x += 128) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rh);
      }
      ctx.stroke();
    }
  }

  return new THREE.MeshStandardMaterial({
    map: finalizeTexture(cColor.canvas, anisotropy, rx, ry, true),
    roughnessMap: finalizeTexture(cRough.canvas, anisotropy, rx, ry, false),
    bumpMap: finalizeTexture(cBump.canvas, anisotropy, rx, ry, false),
    bumpScale: 0.06,
    roughness: 0.92,
    metalness: 0.06,
  });
}

export function createBrushedTitaniumPbrMaterial(
  anisotropy: number,
  tintHex = '#38bdf8',
  rx = 2,
  ry = 2
): THREE.MeshStandardMaterial {
  const cColor = makeCanvas(256, 256);
  const cRough = makeCanvas(256, 256);

  cColor.ctx.fillStyle = tintHex;
  cColor.ctx.fillRect(0, 0, 256, 256);
  cRough.ctx.fillStyle = '#404040';
  cRough.ctx.fillRect(0, 0, 256, 256);

  // Micro-brushed anisotropic streaks + riveted panel border
  for (let y = 0; y < 256; y += 2) {
    const alpha = 0.04 + ((y * 17) % 7) * 0.012;
    cColor.ctx.fillStyle = y % 4 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    cColor.ctx.fillRect(0, y, 256, 1);
  }
  cColor.ctx.strokeStyle = 'rgba(15,23,42,0.35)';
  cColor.ctx.lineWidth = 5;
  cColor.ctx.strokeRect(4, 4, 248, 248);

  return new THREE.MeshStandardMaterial({
    map: finalizeTexture(cColor.canvas, anisotropy, rx, ry, true),
    roughnessMap: finalizeTexture(cRough.canvas, anisotropy, rx, ry, false),
    roughness: 0.36,
    metalness: 0.72,
  });
}

export function createWetCyberAsphaltMaterial(
  anisotropy: number,
  neonHex = '#22d3ee',
  rx = 4,
  ry = 4
): THREE.MeshStandardMaterial {
  const cColor = makeCanvas(256, 256);
  const cRough = makeCanvas(256, 256);
  const cBump = makeCanvas(256, 256);

  cColor.ctx.fillStyle = '#0f172a';
  cColor.ctx.fillRect(0, 0, 256, 256);
  cRough.ctx.fillStyle = '#9a9a9a';
  cRough.ctx.fillRect(0, 0, 256, 256);
  cBump.ctx.fillStyle = '#888888';
  cBump.ctx.fillRect(0, 0, 256, 256);

  // Wet rain puddle patches (very low roughness contrast!)
  for (let i = 0; i < 10; i++) {
    const px = ((i * 67) % 210) + 20;
    const py = ((i * 97) % 210) + 20;
    const rad = 18 + (i % 4) * 11;
    cRough.ctx.fillStyle = '#181818';
    cRough.ctx.beginPath();
    cRough.ctx.ellipse(px, py, rad * 1.3, rad * 0.85, i * 0.5, 0, Math.PI * 2);
    cRough.ctx.fill();
    cColor.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    cColor.ctx.beginPath();
    cColor.ctx.ellipse(px, py, rad * 1.3, rad * 0.85, i * 0.5, 0, Math.PI * 2);
    cColor.ctx.fill();
  }

  // Subtle circuit / lane grid lines
  cColor.ctx.strokeStyle = neonHex;
  cColor.ctx.globalAlpha = 0.28;
  cColor.ctx.lineWidth = 2;
  cColor.ctx.strokeRect(2, 2, 252, 252);
  cColor.ctx.globalAlpha = 1;

  return new THREE.MeshStandardMaterial({
    map: finalizeTexture(cColor.canvas, anisotropy, rx, ry, true),
    roughnessMap: finalizeTexture(cRough.canvas, anisotropy, rx, ry, false),
    bumpMap: finalizeTexture(cBump.canvas, anisotropy, rx, ry, false),
    bumpScale: 0.02,
    roughness: 0.72,
    metalness: 0.35,
  });
}

export function createVolcanicBasaltMaterial(
  anisotropy: number,
  withMagmaFissures = true,
  rx = 3,
  ry = 3
): THREE.MeshStandardMaterial {
  const cColor = makeCanvas(256, 256);
  const cEmissive = makeCanvas(256, 256);
  const cBump = makeCanvas(256, 256);

  cColor.ctx.fillStyle = '#1c1917';
  cColor.ctx.fillRect(0, 0, 256, 256);
  cEmissive.ctx.fillStyle = '#000000';
  cEmissive.ctx.fillRect(0, 0, 256, 256);
  cBump.ctx.fillStyle = '#888888';
  cBump.ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 360; i++) {
    const x = (i * 53) % 256;
    const y = (i * 101) % 256;
    const sz = 3 + (i % 6);
    cColor.ctx.fillStyle = i % 2 === 0 ? '#292524' : '#0c0a09';
    cColor.ctx.fillRect(x, y, sz, sz);
    cBump.ctx.fillStyle = i % 2 === 0 ? '#b0b0b0' : '#424242';
    cBump.ctx.fillRect(x, y, sz, sz);
  }

  if (withMagmaFissures) {
    for (let f = 0; f < 6; f++) {
      cColor.ctx.strokeStyle = '#f97316';
      cEmissive.ctx.strokeStyle = f % 2 === 0 ? '#ea580c' : '#fb923c';
      cColor.ctx.lineWidth = 3;
      cEmissive.ctx.lineWidth = 4;
      for (const ctx of [cColor.ctx, cEmissive.ctx]) {
        ctx.beginPath();
        let x = (f * 47) % 256;
        let y = 0;
        ctx.moveTo(x, y);
        for (let s = 1; s <= 5; s++) {
          x += Math.cos(f * 2 + s) * 26;
          y = (s / 5) * 256;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  return new THREE.MeshStandardMaterial({
    map: finalizeTexture(cColor.canvas, anisotropy, rx, ry, true),
    emissive: withMagmaFissures ? new THREE.Color(0xff5500) : new THREE.Color(0x000000),
    emissiveMap: withMagmaFissures ? finalizeTexture(cEmissive.canvas, anisotropy, rx, ry, true) : null,
    emissiveIntensity: withMagmaFissures ? 1.15 : 0,
    bumpMap: finalizeTexture(cBump.canvas, anisotropy, rx, ry, false),
    bumpScale: 0.08,
    roughness: 0.88,
    metalness: 0.12,
  });
}

export function createHardwoodDeckMaterial(
  anisotropy: number,
  baseHex = '#92400e',
  rx = 2,
  ry = 2
): THREE.MeshStandardMaterial {
  const cColor = makeCanvas(256, 256);
  const cBump = makeCanvas(256, 256);
  cColor.ctx.fillStyle = baseHex;
  cColor.ctx.fillRect(0, 0, 256, 256);
  cBump.ctx.fillStyle = '#909090';
  cBump.ctx.fillRect(0, 0, 256, 256);

  const planks = 6;
  const pw = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    cColor.ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)';
    cColor.ctx.fillRect(x, 0, pw, 256);
    cColor.ctx.strokeStyle = 'rgba(20,10,5,0.5)';
    cColor.ctx.lineWidth = 3;
    cColor.ctx.beginPath();
    cColor.ctx.moveTo(x, 0);
    cColor.ctx.lineTo(x, 256);
    cColor.ctx.stroke();

    cBump.ctx.strokeStyle = '#303030';
    cBump.ctx.lineWidth = 4;
    cBump.ctx.beginPath();
    cBump.ctx.moveTo(x, 0);
    cBump.ctx.lineTo(x, 256);
    cBump.ctx.stroke();
  }

  return new THREE.MeshStandardMaterial({
    map: finalizeTexture(cColor.canvas, anisotropy, rx, ry, true),
    bumpMap: finalizeTexture(cBump.canvas, anisotropy, rx, ry, false),
    bumpScale: 0.04,
    roughness: 0.68,
    metalness: 0.05,
  });
}

export function createCrystalMaterial(colorHex = 0x38bdf8, emissiveHex = 0x0284c7): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: colorHex,
    emissive: emissiveHex,
    emissiveIntensity: 0.35,
    roughness: 0.1,
    metalness: 0.08,
    transmission: 0.45,
    ior: 1.48,
    transparent: true,
    opacity: 0.9,
  });
}

/**
 * Multi-Part Composite Platform (replaces flat single BoxGeometry platforms with layered trim, bevel, and under-supports)
 */
export function buildCompositePlatform(
  w: number,
  h: number,
  d: number,
  topMat: THREE.Material,
  trimMat: THREE.Material,
  underGlowHex?: number
): THREE.Group {
  const g = new THREE.Group();

  const coreH = Math.max(0.24, h * 0.68);
  const topSlab = new THREE.Mesh(new THREE.BoxGeometry(w, coreH, d), topMat);
  topSlab.position.y = -coreH / 2;
  topSlab.receiveShadow = true;
  topSlab.castShadow = true;
  g.add(topSlab);

  // Beveled under-skirt frame
  const underW = Math.max(0.6, w * 0.9);
  const underD = Math.max(0.6, d * 0.9);
  const underH = Math.max(0.18, h - coreH);
  const underSlab = new THREE.Mesh(new THREE.BoxGeometry(underW, underH, underD), trimMat);
  underSlab.position.y = -coreH - underH / 2;
  underSlab.castShadow = true;
  underSlab.receiveShadow = true;
  g.add(underSlab);

  // Corner metal/stone caps for silhouette detail
  const capSize = Math.min(0.45, Math.min(w, d) * 0.14);
  if (w >= 2.2 && d >= 2.2) {
    const capGeo = new THREE.BoxGeometry(capSize, coreH * 1.15, capSize);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cap = new THREE.Mesh(capGeo, trimMat);
        cap.position.set(sx * (w / 2 - capSize * 0.45), -coreH / 2, sz * (d / 2 - capSize * 0.45));
        cap.castShadow = true;
        g.add(cap);
      }
    }
  }

  if (underGlowHex !== undefined) {
    const stripMat = new THREE.MeshStandardMaterial({
      color: underGlowHex,
      emissive: underGlowHex,
      emissiveIntensity: 1.4,
      roughness: 0.25,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.09, d * 0.94), stripMat);
    strip.position.y = -coreH * 0.95;
    g.add(strip);
  }

  return g;
}

/**
 * Multi-part Sculpted Tree ('pine' | 'palm' | 'crystal')
 */
export function buildSculptedTree(
  variant: 'pine' | 'palm' | 'crystal' = 'pine',
  scale = 1
): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: variant === 'crystal' ? 0x334155 : 0x6b4423,
    roughness: variant === 'crystal' ? 0.3 : 0.88,
    metalness: variant === 'crystal' ? 0.5 : 0.02,
  });

  if (variant === 'palm') {
    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.32 - s * 0.04, 0.36 - s * 0.04, 1.35, 8), trunkMat);
      seg.position.set(s * 0.14, 0.65 + s * 1.25, 0);
      seg.rotation.z = -0.08 * s;
      seg.castShadow = true;
      g.add(seg);
    }
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.62 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.8, 5), leafMat);
      frond.scale.set(0.45, 1, 0.9);
      frond.position.set(0.45 + Math.cos(ang) * 1.05, 5.2, Math.sin(ang) * 1.05);
      frond.rotation.z = -Math.cos(ang) * 1.15;
      frond.rotation.x = Math.sin(ang) * 1.15;
      frond.castShadow = true;
      g.add(frond);
    }
  } else if (variant === 'crystal') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.55, 7), trunkMat);
    base.position.y = 0.27;
    base.castShadow = true;
    g.add(base);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 3.0, 6), trunkMat);
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    g.add(trunk);
    const crystalMat = createCrystalMaterial(0x38bdf8, 0x0ea5e9);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.85 - (i % 2) * 0.15, 0), crystalMat);
      shard.scale.set(0.75, 1.5, 0.75);
      shard.position.set(Math.cos(ang) * 0.7, 3.4 + (i % 2) * 0.5, Math.sin(ang) * 0.7);
      shard.rotation.set(Math.sin(ang) * 0.35, ang, -Math.cos(ang) * 0.35);
      g.add(shard);
    }
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 2.2, 8), trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    g.add(trunk);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 });
    const upperMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72 });
    for (let tier = 0; tier < 3; tier++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.75 - tier * 0.42, 2.0 - tier * 0.25, 8),
        tier === 2 ? upperMat : foliageMat
      );
      cone.position.y = 2.4 + tier * 1.15;
      cone.castShadow = true;
      cone.receiveShadow = true;
      g.add(cone);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

/**
 * Multi-part Carved Stone / Celestial Archway
 */
export function buildSculptedArchway(
  width = 5.5,
  height = 5.2,
  stoneMat: THREE.Material,
  trimMat: THREE.Material,
  glowHex = 0x38bdf8
): THREE.Group {
  const g = new THREE.Group();
  const halfW = width / 2;
  const colH = height - 1.1;
  for (const sx of [-1, 1]) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 1.3), trimMat);
    plinth.position.set(sx * halfW, 0.35, 0);
    plinth.castShadow = true;
    g.add(plinth);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, colH, 10), stoneMat);
    col.position.set(sx * halfW, 0.7 + colH / 2, 0);
    col.castShadow = true;
    g.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 1.15), trimMat);
    cap.position.set(sx * halfW, colH + 0.85, 0);
    cap.castShadow = true;
    g.add(cap);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 1.4, 0.75, 1.2), stoneMat);
  lintel.position.set(0, height - 0.15, 0);
  lintel.castShadow = true;
  g.add(lintel);

  const keystone = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.52, 0),
    new THREE.MeshStandardMaterial({ color: glowHex, emissive: glowHex, emissiveIntensity: 1.7, roughness: 0.2 })
  );
  keystone.position.set(0, height + 0.42, 0);
  g.add(keystone);
  return g;
}

/**
 * Multi-part Crystal Spire Cluster Shrine
 */
export function buildCrystalCluster(colorHex = 0x10b981, emissiveHex = 0x059669, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.4 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 0.5, 8), plinthMat);
  plinth.position.y = 0.25;
  plinth.castShadow = true;
  g.add(plinth);

  const cMat = createCrystalMaterial(colorHex, emissiveHex);
  const spires = [
    { x: 0, z: 0, h: 2.8, r: 0.42, rx: 0, rz: 0 },
    { x: 0.45, z: 0.25, h: 1.9, r: 0.28, rx: 0.22, rz: -0.24 },
    { x: -0.45, z: -0.2, h: 1.75, r: 0.26, rx: -0.2, rz: 0.25 },
    { x: -0.2, z: 0.48, h: 1.5, r: 0.24, rx: 0.28, rz: 0.12 },
  ];
  for (const s of spires) {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(s.r, s.h, 6), cMat);
    shard.position.set(s.x, 0.45 + s.h * 0.45, s.z);
    shard.rotation.set(s.rx, 0, s.rz);
    shard.castShadow = true;
    g.add(shard);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.055, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.22 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.6;
  g.add(ring);
  g.scale.setScalar(scale);
  return g;
}

/**
 * Multi-part Neon Street / Harbor Lamp Post
 */
export function buildNeonLampPost(glowHex = 0x38bdf8): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.34 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.5, 8), metal);
  base.position.y = 0.25;
  g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 4.2, 8), metal);
  pole.position.y = 2.4;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.14), metal);
  arm.position.set(0.45, 4.45, 0);
  g.add(arm);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: glowHex, emissive: glowHex, emissiveIntensity: 2.2, roughness: 0.15 })
  );
  bulb.position.set(0.9, 4.28, 0);
  g.add(bulb);
  return g;
}

/**
 * Multi-part Sculpted Futuristic Hover Supercar (Cyber Velocity / Brookhaven)
 */
export function buildSculptedHoverCar(bodyHex = 0x06b6d4, trimHex = 0xf43f5e): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex, metalness: 0.65, roughness: 0.2 });
  const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.75, roughness: 0.28 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.08, transmission: 0.5, transparent: true, opacity: 0.85 });
  const neonMat = new THREE.MeshStandardMaterial({ color: trimHex, emissive: trimHex, emissiveIntensity: 2.2 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 2.4 });

  // Lower chassis
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 4.7), obsidianMat);
  lower.position.y = 0.45;
  lower.castShadow = true;
  g.add(lower);
  // Sculpted upper shell + nose taper
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.42, 4.2), bodyMat);
  upper.position.set(0, 0.85, -0.05);
  upper.castShadow = true;
  g.add(upper);
  // Cockpit canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.45, 1.95), glassMat);
  canopy.position.set(0, 1.22, -0.15);
  g.add(canopy);
  // Rear aero wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.55), bodyMat);
  wing.position.set(0, 1.38, -2.0);
  g.add(wing);
  for (const sx of [-0.7, 0.7]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.35), obsidianMat);
    strut.position.set(sx, 1.15, -1.95);
    g.add(strut);
  }
  // 4 Hover turbine pods
  for (const sx of [-1.18, 1.18]) {
    for (const sz of [-1.35, 1.35]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.28, 12), obsidianMat);
      pod.position.set(sx, 0.25, sz);
      g.add(pod);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 6, 16), neonMat);
      glow.rotation.x = Math.PI / 2;
      glow.position.set(sx, 0.16, sz);
      g.add(glow);
    }
  }
  // Headlights & Taillight bar
  for (const sx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.12), headMat);
    hl.position.set(sx, 0.74, 2.28);
    g.add(hl);
  }
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 0.1), neonMat);
  tailBar.position.set(0, 0.85, -2.18);
  g.add(tailBar);
  return g;
}

/**
 * Multi-part Wooden Speedboat / Skiff (Ocean Odyssey)
 */
export function buildSculptedBoat(hullHex = 0x92400e): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: hullHex, roughness: 0.58 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.25 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x7dd3fc, roughness: 0.1, transmission: 0.45, transparent: true, opacity: 0.85 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 4.6), hullMat);
  hull.position.y = 0.28;
  hull.castShadow = true;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.5, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 4;
  bow.scale.set(1, 1, 0.42);
  bow.position.set(0, 0.32, 3.0);
  g.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 4.2), trimMat);
  deck.position.set(0, 0.64, 0);
  g.add(deck);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 0.14), glassMat);
  windshield.position.set(0, 0.96, 0.85);
  windshield.rotation.x = -0.35;
  g.add(windshield);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 1.6 })
  );
  beacon.position.set(0, 1.45, -1.8);
  g.add(beacon);
  return g;
}

/**
 * Multi-part Victory Portal Gate (Builder & Sky Citadel / Finish)
 */
export function buildVictoryPortalGate(glowHex = 0x10b981): THREE.Group {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.45, 10), frameMat);
  base.position.y = 0.22;
  base.receiveShadow = true;
  g.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.0, 0.24, 10, 28),
    frameMat
  );
  ring.position.y = 2.5;
  ring.castShadow = true;
  g.add(ring);

  const vortex = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.12, 8, 28),
    new THREE.MeshStandardMaterial({ color: glowHex, emissive: glowHex, emissiveIntensity: 2.2, roughness: 0.15 })
  );
  vortex.position.y = 2.5;
  g.add(vortex);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 24),
    new THREE.MeshStandardMaterial({
      color: glowHex,
      emissive: glowHex,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    })
  );
  disc.position.y = 2.5;
  g.add(disc);
  return g;
}

/**
 * Multi-part Rotating Collectible Relic / Coin Gem
 */
export function buildCollectibleGem(hex = 0xfacc15): THREE.Group {
  const g = new THREE.Group();
  const gemMat = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: 0.85,
    metalness: 0.55,
    roughness: 0.18,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), gemMat);
  core.castShadow = true;
  g.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.06, 6, 18),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.18 })
  );
  g.add(ring);
  return g;
}
