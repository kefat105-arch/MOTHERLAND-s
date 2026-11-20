import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function probeSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = 4;
    probeCanvas.height = 4;
    const probeGl = probeCanvas.getContext('webgl2');
    const dbg = probeGl?.getExtension('WEBGL_debug_renderer_info');
    const rendererName = dbg
      ? String(probeGl?.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '')
      : '';
    const isSoft = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
    probeGl?.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoft;
  } catch {
    return false;
  }
}

export interface RobloxRendererBundle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pmremGenerator: THREE.PMREMGenerator;
  envTarget: THREE.WebGLRenderTarget;
  isSoftwareGl: boolean;
  maxAnisotropy: number;
  resize: (width: number, height: number) => void;
  renderFrame: (onDone?: () => void) => void;
  dispose: () => void;
}

export function createRobloxRendererBundle(
  mountEl: HTMLElement,
  options?: { skyHex?: number; fogHex?: number; fogNear?: number; fogFar?: number }
): RobloxRendererBundle {
  const isSoftwareGl = probeSoftwareGl();
  const width = Math.max(1, mountEl.clientWidth || window.innerWidth);
  const height = Math.max(1, mountEl.clientHeight || window.innerHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  mountEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyColor = options?.skyHex ?? 0x0b1220;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(
    options?.fogHex ?? skyColor,
    options?.fogNear ?? 42,
    options?.fogFar ?? 155
  );

  const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 350);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envTarget = pmremGenerator.fromScene(envScene, 0.04);
  scene.environment = envTarget.texture;
  envScene.dispose();

  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const resize = (w: number, h: number) => {
    const safeW = Math.max(1, Math.round(w));
    const safeH = Math.max(1, Math.round(h));
    camera.aspect = safeW / safeH;
    camera.updateProjectionMatrix();
    renderer.setSize(safeW, safeH);
  };

  let pendingSyncTimer: number | null = null;
  const renderFrame = (onDone?: () => void) => {
    renderer.render(scene, camera);
    if (!onDone) return;
    if (!isSoftwareGl) {
      requestAnimationFrame(onDone);
      return;
    }
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = typeof gl.fenceSync === 'function' ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      pendingSyncTimer = window.setTimeout(onDone, 64);
      return;
    }
    const poll = () => {
      const status = gl.clientWaitSync(sync, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
        gl.deleteSync(sync);
        pendingSyncTimer = window.setTimeout(onDone, 75);
      } else {
        pendingSyncTimer = window.setTimeout(poll, 16);
      }
    };
    gl.flush();
    pendingSyncTimer = window.setTimeout(poll, 16);
  };

  const dispose = () => {
    if (pendingSyncTimer !== null) {
      clearTimeout(pendingSyncTimer);
      pendingSyncTimer = null;
    }
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.normalMap?.dispose();
          std.roughnessMap?.dispose();
          std.emissiveMap?.dispose();
          m.dispose();
        }
      }
    });
    envTarget.dispose();
    pmremGenerator.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === mountEl) {
      mountEl.removeChild(renderer.domElement);
    }
  };

  return {
    renderer,
    scene,
    camera,
    pmremGenerator,
    envTarget,
    isSoftwareGl,
    maxAnisotropy,
    resize,
    renderFrame,
    dispose,
  };
}

// ==========================================
// PROCEDURAL PBR CANVAS TEXTURE GENERATORS
// ==========================================

export function createStudTexture(
  baseHex: string,
  maxAnisotropy = 4,
  repeatX = 4,
  repeatY = 4
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const cell = size / 4;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const cx = gx * cell + cell / 2;
      const cy = gy * cell + cell / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.arc(cx + 2, cy + 3, cell * 0.27, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSandTexture(maxAnisotropy = 4, repeat = 10): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d4b483';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? 'rgba(255,244,218,0.22)' : 'rgba(130,98,55,0.2)';
    ctx.fillRect(x, y, 3, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCheckerTexture(
  c1: string,
  c2: string,
  maxAnisotropy = 4,
  repeatX = 6,
  repeatY = 6
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWoodPlankTexture(
  baseHex = '#6d4528',
  maxAnisotropy = 4,
  repeatX = 4,
  repeatY = 4
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const planks = 4;
  const h = size / planks;
  for (let p = 0; p < planks; p++) {
    ctx.fillStyle = p % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, p * h, size, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, p * h, size, 3);
    for (let g = 0; g < 18; g++) {
      ctx.fillStyle = 'rgba(25,12,4,0.12)';
      ctx.fillRect(Math.random() * size, p * h + Math.random() * h, 24 + Math.random() * 48, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAsphaltRoadTexture(maxAnisotropy = 4, repeatX = 1, repeatY = 8): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#252a34';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  // Yellow dashed centerline + white edge stripes
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(8, 0, 6, size);
  ctx.fillRect(size - 14, 0, 6, size);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(size / 2 - 4, 16, 8, 92);
  ctx.fillRect(size / 2 - 4, 144, 8, 92);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSquidCourtTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b99362';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,245,220,0.12)' : 'rgba(90,60,30,0.12)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
  }
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  // Circle (Squid head at top)
  ctx.beginPath();
  ctx.arc(size / 2, 100, 44, 0, Math.PI * 2);
  ctx.stroke();
  // Triangle
  ctx.beginPath();
  ctx.moveTo(size / 2, 118);
  ctx.lineTo(size / 2 - 96, 250);
  ctx.lineTo(size / 2 + 96, 250);
  ctx.closePath();
  ctx.stroke();
  // Square body
  ctx.strokeRect(size / 2 - 78, 250, 156, 158);
  // Bottom circle gate
  ctx.beginPath();
  ctx.arc(size / 2, 434, 40, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createThreePointLights(
  scene: THREE.Scene,
  opts?: {
    isSoftwareGl?: boolean;
    sunColor?: number;
    sunIntensity?: number;
    sunPos?: [number, number, number];
    hemiSky?: number;
    hemiGround?: number;
    hemiIntensity?: number;
  }
): { sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; rim: THREE.DirectionalLight } {
  const hemi = new THREE.HemisphereLight(
    opts?.hemiSky ?? 0xbad8ff,
    opts?.hemiGround ?? 0x2b211a,
    opts?.hemiIntensity ?? 0.65
  );
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(opts?.sunColor ?? 0xfff3d8, opts?.sunIntensity ?? 2.3);
  const pos = opts?.sunPos ?? [26, 38, 22];
  sun.position.set(pos[0], pos[1], pos[2]);
  if (!opts?.isSoftwareGl) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 140;
    const d = 38;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
  }
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x68b5ff, 0.75);
  rim.position.set(-22, 14, -24);
  scene.add(rim);

  return { sun, hemi, rim };
}
