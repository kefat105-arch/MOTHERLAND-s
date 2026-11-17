import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { LiveSpyPublicState } from '../../types';

export type CameraPreset = 'overview' | 'screen' | 'overhead';

interface LiveSpyLounge3DProps {
  roomState: LiveSpyPublicState | null;
  currentUserId: string;
  cameraPreset: CameraPreset;
  /** Map of userId -> active HTMLVideoElement or segmented HTMLCanvasElement when camera is ON */
  mediaSources: Record<string, HTMLVideoElement | HTMLCanvasElement | null>;
}

interface SeatVisualRig {
  seatIndex: number;
  root: THREE.Group;
  teddyGroup: THREE.Group;
  videoScreenGroup: THREE.Group;
  videoScreenMat: THREE.MeshBasicMaterial;
  videoFrameRingMat: THREE.MeshStandardMaterial;
  videoTexture: THREE.Texture | null;
  lastSourceEl: HTMLVideoElement | HTMLCanvasElement | null;
  emptyRing: THREE.Mesh;
  nameplateCanvas: HTMLCanvasElement;
  nameplateTex: THREE.CanvasTexture;
  lastNameplateKey: string;
  chairCushionMat: THREE.MeshStandardMaterial;
}

function drawDigitalScreenCanvas(
  canvas: HTMLCanvasElement,
  roomState: LiveSpyPublicState | null,
  secondsLeft: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  // Deep obsidian glass screen gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#071019');
  grad.addColorStop(0.55, '#0b1826');
  grad.addColorStop(1, '#09111c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(20, 184, 166, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Outer bezel highlight
  ctx.strokeStyle = 'rgba(20, 184, 166, 0.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // Header strip
  ctx.fillStyle = '#14B8A6';
  ctx.font = 'bold 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MOTHERLAND · LIVE SPY LOUNGE', 34, 48);

  if (!roomState) {
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 42px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CONNECTING TO LOUNGE...', w / 2, h / 2 + 12);
    return;
  }

  // Right-aligned actual player count badge
  const countText = `${roomState.players.length}/${roomState.capacity} PLAYERS`;
  ctx.fillStyle = 'rgba(20, 184, 166, 0.16)';
  ctx.fillRect(w - 230, 22, 198, 38);
  ctx.strokeStyle = '#14B8A6';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(w - 230, 22, 198, 38);
  ctx.fillStyle = '#5EEAD4';
  ctx.font = 'bold 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(countText, w - 131, 48);

  ctx.textAlign = 'center';

  if (roomState.phase === 'waiting') {
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 40px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('MATCHMAKING ACTIVE', w / 2, 158);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      `Waiting for ${roomState.capacity - roomState.players.length} more real player(s) to join table`,
      w / 2,
      206
    );
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Match locks & starts automatically when full', w / 2, 260);
  } else if (roomState.phase === 'countdown') {
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('ALL SEATS FILLED · TABLE LOCKED', w / 2, 125);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 108px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(String(Math.max(1, roomState.countdownSec || 1)), w / 2, 245);
    ctx.fillStyle = '#14B8A6';
    ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('STARTING MATCH...', w / 2, 295);
  } else if (roomState.phase === 'role_reveal') {
    ctx.fillStyle = '#5EEAD4';
    ctx.font = '800 38px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('CHECK YOUR PRIVATE ROLE', w / 2, 165);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`Category: ${roomState.category} · Starting in ${secondsLeft}s`, w / 2, 222);
  } else if (roomState.phase === 'clue') {
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`ROUND ${roomState.round} · CATEGORY: ${roomState.category.toUpperCase()}`, w / 2, 118);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('CLUE SUBMISSION ROUND', w / 2, 180);
    ctx.fillStyle = '#14B8A6';
    ctx.font = '800 32px "Plus Jakarta Sans", system-ui, sans-serif';
    const aliveCount = roomState.players.filter((p) => p.alive).length;
    ctx.fillText(`${roomState.clues.length}/${aliveCount} Clues · ${secondsLeft}s`, w / 2, 242);
  } else if (roomState.phase === 'discussion') {
    ctx.fillStyle = '#5EEAD4';
    ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`ROUND ${roomState.round} · CATEGORY: ${roomState.category.toUpperCase()}`, w / 2, 118);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('LIVE DISCUSSION', w / 2, 178);
    ctx.fillStyle = '#F59E0B';
    ctx.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`DEBATE & SPOT THE SPY · ${secondsLeft}s`, w / 2, 236);
  } else if (roomState.phase === 'voting') {
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`ROUND ${roomState.round} · ELIMINATION VOTE`, w / 2, 118);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 46px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('VOTING IN PROGRESS', w / 2, 182);
    const alive = roomState.players.filter((p) => p.alive);
    const voted = alive.filter((p) => p.hasVoted).length;
    ctx.fillStyle = '#5EEAD4';
    ctx.font = '800 30px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${voted}/${alive.length} Votes Cast · ${secondsLeft}s`, w / 2, 242);
  } else if (roomState.phase === 'elimination') {
    const elim = roomState.eliminatedThisRound;
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`ROUND ${roomState.round} VERDICT`, w / 2, 110);
    if (elim?.eliminatedName) {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 38px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(`${elim.eliminatedName.toUpperCase()} ELIMINATED`, w / 2, 168);
      ctx.fillStyle = elim.revealedRole === 'spy' ? '#14B8A6' : '#EF4444';
      ctx.font = '900 34px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(
        elim.revealedRole === 'spy' ? 'WAS THE SPY!' : 'WAS A CITIZEN',
        w / 2,
        222
      );
    } else {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '800 38px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(elim?.reason === 'tie' ? 'TIE VOTE — NOBODY OUT' : 'NO VOTES — NOBODY OUT', w / 2, 190);
    }
    if (roomState.voteTally.length > 0) {
      const topSummary = roomState.voteTally
        .slice(0, 3)
        .map((t) => `${t.displayName}: ${t.votes}`)
        .join('   ·   ');
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(topSummary, w / 2, 290);
    }
  } else if (roomState.phase === 'winner') {
    const citizensWon = roomState.winner === 'citizens';
    ctx.fillStyle = citizensWon ? '#14B8A6' : '#EF4444';
    ctx.font = '900 54px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(citizensWon ? 'CITIZENS WIN!' : 'THE SPY WINS!', w / 2, 165);
    if (roomState.finalReveal) {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(
        `Spy: ${roomState.finalReveal.spyDisplayName}   ·   Secret Word: ${roomState.finalReveal.secretWord}`,
        w / 2,
        228
      );
    }
  }

  // Footer live bar
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(34, h - 42, w - 68, 2);
  ctx.fillStyle = '#64748B';
  ctx.font = '600 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('PUBLIC LOUNGE DISPLAY · SECRETS SENT PRIVATELY TO PLAYERS ONLY', w / 2, h - 18);
}

function drawNameplateCanvas(
  canvas: HTMLCanvasElement,
  seatIndex: number,
  name: string | null,
  isSelf: boolean,
  alive: boolean,
  micMuted: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = name ? (alive ? '#0F172A' : '#1E1B18') : '#0A0F18';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = isSelf ? '#14B8A6' : name ? '#D97706' : '#334155';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  ctx.textAlign = 'center';
  if (!name) {
    ctx.fillStyle = '#64748B';
    ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`SEAT ${seatIndex + 1} · OPEN`, w / 2, 42);
    return;
  }

  ctx.fillStyle = alive ? '#F8FAFC' : '#94A3B8';
  ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  const label = `${isSelf ? 'YOU · ' : ''}${name.slice(0, 14)}`;
  ctx.fillText(label, w / 2, 34);

  ctx.fillStyle = !alive ? '#EF4444' : micMuted ? '#F59E0B' : '#14B8A6';
  ctx.font = '700 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(!alive ? 'ELIMINATED' : micMuted ? 'MIC MUTED' : 'LIVE', w / 2, 56);
}

/**
 * Multi-part 3D Teddy Avatar rendered when a player's camera is OFF.
 * Neutral luxury plush appearance — never leaks secret role.
 */
function createTeddyAvatarMesh(): THREE.Group {
  const teddy = new THREE.Group();

  const plushMat = new THREE.MeshStandardMaterial({
    color: 0xb97a4b,
    roughness: 0.78,
    metalness: 0.04,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xf1dcc2,
    roughness: 0.82,
    metalness: 0.02,
  });
  const darkFeatureMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.2,
    metalness: 0.35,
  });
  const bowtieMat = new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    roughness: 0.4,
    metalness: 0.25,
  });

  // Torso
  const torsoGeo = new THREE.SphereGeometry(0.24, 20, 16);
  const torso = new THREE.Mesh(torsoGeo, plushMat);
  torso.scale.set(1.0, 1.15, 0.86);
  torso.position.set(0, 0.24, 0);
  teddy.add(torso);

  // Cream belly patch
  const bellyGeo = new THREE.SphereGeometry(0.16, 16, 12);
  const belly = new THREE.Mesh(bellyGeo, creamMat);
  belly.scale.set(0.92, 1.08, 0.55);
  belly.position.set(0, 0.23, 0.14);
  teddy.add(belly);

  // Head pivot for gentle idle look animation
  const headGroup = new THREE.Group();
  headGroup.name = 'teddyHead';
  headGroup.position.set(0, 0.62, 0.02);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 22, 18), plushMat);
  headGroup.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), creamMat);
  snout.scale.set(1.15, 0.85, 0.9);
  snout.position.set(0, -0.04, 0.18);
  headGroup.add(snout);

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), darkFeatureMat);
  nose.scale.set(1.3, 0.9, 0.8);
  nose.position.set(0, -0.01, 0.265);
  headGroup.add(nose);

  // Eyes
  [-0.075, 0.075].forEach((xOffset) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), darkFeatureMat);
    eye.position.set(xOffset, 0.045, 0.185);
    headGroup.add(eye);
  });

  // Ears + inner cream pads
  [-0.16, 0.16].forEach((xOffset) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), plushMat);
    ear.scale.set(1, 1, 0.55);
    ear.position.set(xOffset, 0.17, -0.01);
    headGroup.add(ear);

    const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), creamMat);
    earInner.scale.set(1, 1, 0.45);
    earInner.position.set(xOffset, 0.17, 0.022);
    headGroup.add(earInner);
  });

  teddy.add(headGroup);

  // Classy bowtie at neck
  [-0.045, 0.045].forEach((xOffset) => {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), bowtieMat);
    wing.rotation.z = xOffset < 0 ? -Math.PI / 2 : Math.PI / 2;
    wing.position.set(xOffset, 0.45, 0.17);
    teddy.add(wing);
  });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), bowtieMat);
  knot.position.set(0, 0.45, 0.185);
  teddy.add(knot);

  // Arms resting slightly forward
  [-0.23, 0.23].forEach((xOffset) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.18, 6, 10), plushMat);
    arm.position.set(xOffset, 0.29, 0.09);
    arm.rotation.z = xOffset < 0 ? 0.38 : -0.38;
    arm.rotation.x = -0.55;
    teddy.add(arm);
  });

  // Legs resting on cushion
  [-0.11, 0.11].forEach((xOffset) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 6, 10), plushMat);
    leg.position.set(xOffset, 0.06, 0.19);
    leg.rotation.x = Math.PI / 2 - 0.15;
    teddy.add(leg);
  });

  return teddy;
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          m.dispose();
        });
      } else if (mat) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    }
  });
}

export const LiveSpyLounge3D: React.FC<LiveSpyLounge3DProps> = ({
  roomState,
  currentUserId,
  cameraPreset,
  mediaSources,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Live reactive refs read cleanly inside the Three.js loop without tearing down WebGL
  const roomStateRef = useRef<LiveSpyPublicState | null>(roomState);
  roomStateRef.current = roomState;

  const mediaSourcesRef = useRef(mediaSources);
  mediaSourcesRef.current = mediaSources;

  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  cameraPresetRef.current = cameraPreset;

  const currentUserIdRef = useRef<string>(currentUserId);
  currentUserIdRef.current = currentUserId;

  // Trigger digital screen redraw on state changes
  const screenRedrawFlagRef = useRef(true);
  useEffect(() => {
    screenRedrawFlagRef.current = true;
  }, [roomState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    // Detect software WebGL (SwiftShader / llvmpipe) to adapt render load gracefully
    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(rendererStr);

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(260, container.clientHeight);
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const onContextRestored = () => {
      setWebglUnavailable(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);
    scene.fog = new THREE.FogExp2(0x0b0e14, 0.036);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = roomEnvTexture;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 60);
    camera.position.set(0, 3.15, 5.2);
    camera.lookAt(0, 1.35, -0.6);

    // Three-point warm private lounge lighting
    const hemiLight = new THREE.HemisphereLight(0xbbe0ff, 0x2b1d12, 0.65);
    scene.add(hemiLight);

    const warmChandelierLight = new THREE.PointLight(0xffb86c, 16, 18, 1.6);
    warmChandelierLight.position.set(0, 3.7, 0);
    if (!isSoftwareGl) {
      warmChandelierLight.castShadow = true;
      warmChandelierLight.shadow.mapSize.set(1024, 1024);
      warmChandelierLight.shadow.bias = -0.002;
    }
    scene.add(warmChandelierLight);

    const keyDirLight = new THREE.DirectionalLight(0xffe1b8, 1.15);
    keyDirLight.position.set(4.5, 6.2, 4.5);
    scene.add(keyDirLight);

    const tealRimLight = new THREE.DirectionalLight(0x14b8a6, 0.65);
    tealRimLight.position.set(-4.8, 3.5, -4.5);
    scene.add(tealRimLight);

    // Floor & plush luxury woven rug
    const floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 8.5, 0.1, 48),
      new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 0.72, metalness: 0.08 })
    );
    floorMesh.position.y = -0.05;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const rugMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(4.15, 4.18, 0.025, 48),
      new THREE.MeshStandardMaterial({ color: 0x122629, roughness: 0.92, metalness: 0.02 })
    );
    rugMesh.position.y = 0.012;
    rugMesh.receiveShadow = true;
    scene.add(rugMesh);

    const rugGoldTrim = new THREE.Mesh(
      new THREE.RingGeometry(4.02, 4.12, 64),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide })
    );
    rugGoldTrim.rotation.x = -Math.PI / 2;
    rugGoldTrim.position.y = 0.026;
    scene.add(rugGoldTrim);

    // Architectural curved walnut lounge alcove wall & slatted pillars
    const wallGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1b1512,
      roughness: 0.78,
      metalness: 0.08,
      side: THREE.BackSide,
    });
    const wallShell = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 5.2, 48, 1, true), wallMat);
    wallShell.position.y = 2.6;
    wallGroup.add(wallShell);

    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd99b38,
      roughness: 0.25,
      metalness: 0.85,
    });
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0x3b2619,
      roughness: 0.58,
      metalness: 0.12,
    });
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      // Leave front wall alcove clear for Digital Screen
      if (Math.sin(angle) < -0.78) continue;
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.4, 0.08), slatMat);
      slat.position.set(Math.cos(angle) * 6.55, 2.2, Math.sin(angle) * 6.55);
      slat.lookAt(0, 2.2, 0);
      wallGroup.add(slat);
    }
    scene.add(wallGroup);

    // Luxury circular dark-mahogany conference/dining table
    const tableGroup = new THREE.Group();
    const tabletopMat = new THREE.MeshStandardMaterial({
      color: 0x3b2216,
      roughness: 0.26,
      metalness: 0.12,
    });
    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.62, 0.09, 48), tabletopMat);
    tableTop.position.y = 0.76;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    const tableRim = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.025, 12, 64), brassTrimMat);
    tableRim.rotation.x = Math.PI / 2;
    tableRim.position.y = 0.77;
    tableGroup.add(tableRim);

    const tableTealInlay = new THREE.Mesh(
      new THREE.RingGeometry(0.54, 0.59, 48),
      new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x0d9488,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        side: THREE.DoubleSide,
      })
    );
    tableTealInlay.rotation.x = -Math.PI / 2;
    tableTealInlay.position.y = 0.807;
    tableGroup.add(tableTealInlay);

    const tablePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.58, 0.72, 28),
      new THREE.MeshStandardMaterial({ color: 0x181312, roughness: 0.55, metalness: 0.35 })
    );
    tablePedestal.position.y = 0.36;
    tablePedestal.castShadow = true;
    tableGroup.add(tablePedestal);

    // Centerpiece warm frosted glass lamp
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.06, 20), brassTrimMat);
    lampBase.position.y = 0.83;
    tableGroup.add(lampBase);
    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.22, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffdfb3,
        emissive: 0xffa94d,
        emissiveIntensity: 1.15,
        roughness: 0.35,
      })
    );
    lampShade.position.y = 0.97;
    tableGroup.add(lampShade);
    scene.add(tableGroup);

    // Overhead Chandelier
    const chandelierGroup = new THREE.Group();
    chandelierGroup.position.set(0, 3.85, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 12, 48), brassTrimMat);
    ring.rotation.x = Math.PI / 2;
    chandelierGroup.add(ring);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff3db,
      emissive: 0xffb86c,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    for (let b = 0; b < 8; b++) {
      const ba = (b / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), bulbMat);
      bulb.position.set(Math.cos(ba) * 1.15, -0.04, Math.sin(ba) * 1.15);
      chandelierGroup.add(bulb);
    }
    scene.add(chandelierGroup);

    // Front Wall Public Digital Display
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 960;
    screenCanvas.height = 420;
    drawDigitalScreenCanvas(screenCanvas, roomStateRef.current, 0);
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;

    const screenGroup = new THREE.Group();
    screenGroup.position.set(0, 2.58, -5.25);

    const screenBezel = new THREE.Mesh(
      new THREE.BoxGeometry(5.1, 2.34, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.32, metalness: 0.78 })
    );
    screenGroup.add(screenBezel);

    const screenPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.86, 2.12),
      new THREE.MeshBasicMaterial({ map: screenTexture })
    );
    screenPlane.position.z = 0.075;
    screenGroup.add(screenPlane);
    scene.add(screenGroup);

    // Build dynamic 6 or 8 Seat Rigs
    const seatRigsGroup = new THREE.Group();
    scene.add(seatRigsGroup);
    let currentCapacity = 0;
    let seatRigs: SeatVisualRig[] = [];

    const rebuildSeats = (cap: number) => {
      seatRigs.forEach((rig) => disposeObject3D(rig.root));
      seatRigsGroup.clear();
      seatRigs = [];
      currentCapacity = cap;

      const radius = cap === 8 ? 2.75 : 2.55;
      for (let i = 0; i < cap; i++) {
        // Place seat 0 cleanly on the right-front arc leaving clear sightline to front wall Digital Display
        const angle = (i / cap) * Math.PI * 2 + Math.PI * 0.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const root = new THREE.Group();
        root.position.set(x, 0, z);
        root.lookAt(0, 0, 0);

        // Upholstered Lounge Chair
        const chairCushionMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.65,
          metalness: 0.1,
        });
        const chairBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.28, 0.38, 16),
          new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.75 })
        );
        chairBase.position.y = 0.19;
        root.add(chairBase);

        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.58), chairCushionMat);
        cushion.position.y = 0.44;
        cushion.castShadow = true;
        cushion.receiveShadow = true;
        root.add(cushion);

        const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.64, 0.12), chairCushionMat);
        backrest.position.set(0, 0.8, -0.25);
        backrest.castShadow = true;
        root.add(backrest);

        [-0.29, 0.29].forEach((ax) => {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.48), chairCushionMat);
          arm.position.set(ax, 0.6, -0.02);
          root.add(arm);
        });

        // Empty Seat Pulse Ring
        const emptyRing = new THREE.Mesh(
          new THREE.RingGeometry(0.24, 0.29, 32),
          new THREE.MeshBasicMaterial({
            color: 0x14b8a6,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
          })
        );
        emptyRing.rotation.x = -Math.PI / 2;
        emptyRing.position.set(0, 0.51, 0.04);
        root.add(emptyRing);

        // 3D Teddy Avatar seated on chair
        const teddyGroup = createTeddyAvatarMesh();
        teddyGroup.position.set(0, 0.5, 0.02);
        teddyGroup.visible = false;
        root.add(teddyGroup);

        // Live WebRTC Video Portrait Frame above backrest
        const videoScreenGroup = new THREE.Group();
        videoScreenGroup.position.set(0, 1.24, 0.04);
        videoScreenGroup.visible = false;

        const videoFrameRingMat = new THREE.MeshStandardMaterial({
          color: 0x14b8a6,
          emissive: 0x0d9488,
          emissiveIntensity: 0.65,
          roughness: 0.28,
          metalness: 0.65,
        });
        const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.62, 0.045), videoFrameRingMat);
        videoScreenGroup.add(bezel);

        const videoScreenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide });
        const videoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.54), videoScreenMat);
        videoPlane.position.z = 0.025;
        videoScreenGroup.add(videoPlane);
        root.add(videoScreenGroup);

        // Nameplate Plaque on front of seat/table edge
        const nameplateCanvas = document.createElement('canvas');
        nameplateCanvas.width = 256;
        nameplateCanvas.height = 72;
        drawNameplateCanvas(nameplateCanvas, i, null, false, true, false);
        const nameplateTex = new THREE.CanvasTexture(nameplateCanvas);
        nameplateTex.colorSpace = THREE.SRGBColorSpace;

        const nameplate = new THREE.Mesh(
          new THREE.PlaneGeometry(0.56, 0.16),
          new THREE.MeshBasicMaterial({ map: nameplateTex })
        );
        nameplate.position.set(0, 0.94, 0.52);
        nameplate.rotation.x = -0.35;
        root.add(nameplate);

        seatRigsGroup.add(root);
        seatRigs.push({
          seatIndex: i,
          root,
          teddyGroup,
          videoScreenGroup,
          videoScreenMat,
          videoFrameRingMat,
          videoTexture: null,
          lastSourceEl: null,
          emptyRing,
          nameplateCanvas,
          nameplateTex,
          lastNameplateKey: '',
          chairCushionMat,
        });
      }
    };

    rebuildSeats(roomStateRef.current?.capacity || 6);

    // Interactive Pointer Orbit State
    let targetAzimuth = 0;
    let targetPolar = 0.52;
    let curAzimuth = 0;
    let curPolar = 0.52;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      targetAzimuth = THREE.MathUtils.clamp(targetAzimuth - dx * 0.0055, -1.65, 1.65);
      targetPolar = THREE.MathUtils.clamp(targetPolar + dy * 0.004, 0.25, 1.15);
    };
    const onPointerUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(300, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let disposed = false;
    let rafId = 0;
    let lastClock = performance.now();
    let lastScreenSecond = -1;

    const renderFrame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastClock) / 1000));
      lastClock = now;
      const elapsed = now * 0.001;

      const state = roomStateRef.current;
      const desiredCapacity = state?.capacity || 6;
      if (desiredCapacity !== currentCapacity) {
        rebuildSeats(desiredCapacity);
      }

      // Compute timer seconds remaining for Digital Screen
      const secondsLeft = state?.phaseEndsAt
        ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000))
        : 0;
      if (screenRedrawFlagRef.current || secondsLeft !== lastScreenSecond) {
        screenRedrawFlagRef.current = false;
        lastScreenSecond = secondsLeft;
        drawDigitalScreenCanvas(screenCanvas, state, secondsLeft);
        screenTexture.needsUpdate = true;
      }

      // Sync each seat's Teddy Avatar, Live WebRTC Video Texture, and Nameplate
      const sourcesMap = mediaSourcesRef.current;
      const meId = currentUserIdRef.current;

      for (const rig of seatRigs) {
        const seat = state?.players.find((p) => p.seatIndex === rig.seatIndex) || null;
        if (!seat) {
          rig.emptyRing.visible = true;
          rig.teddyGroup.visible = false;
          rig.videoScreenGroup.visible = false;
          const pulse = 0.25 + 0.15 * Math.sin(elapsed * 2.2 + rig.seatIndex);
          (rig.emptyRing.material as THREE.MeshBasicMaterial).opacity = pulse;
          const npKey = `empty_${rig.seatIndex}`;
          if (rig.lastNameplateKey !== npKey) {
            rig.lastNameplateKey = npKey;
            drawNameplateCanvas(rig.nameplateCanvas, rig.seatIndex, null, false, true, false);
            rig.nameplateTex.needsUpdate = true;
          }
          continue;
        }

        rig.emptyRing.visible = false;
        const isSelf = seat.userId === meId;
        const npKey = `${seat.userId}_${seat.displayName}_${seat.alive}_${seat.micMuted}_${isSelf}`;
        if (rig.lastNameplateKey !== npKey) {
          rig.lastNameplateKey = npKey;
          drawNameplateCanvas(
            rig.nameplateCanvas,
            rig.seatIndex,
            seat.displayName,
            isSelf,
            seat.alive,
            seat.micMuted
          );
          rig.nameplateTex.needsUpdate = true;
        }

        rig.chairCushionMat.color.setHex(seat.alive ? (isSelf ? 0x134e4a : 0x1e293b) : 0x262120);

        const sourceEl = seat.cameraOn ? sourcesMap[seat.userId] || null : null;
        const videoReady =
          sourceEl instanceof HTMLVideoElement
            ? sourceEl.readyState >= 2 && sourceEl.videoWidth > 0
            : sourceEl instanceof HTMLCanvasElement
              ? sourceEl.width > 0
              : false;

        if (seat.cameraOn && sourceEl && videoReady) {
          rig.teddyGroup.visible = false;
          rig.videoScreenGroup.visible = true;

          if (rig.lastSourceEl !== sourceEl) {
            rig.videoTexture?.dispose();
            if (sourceEl instanceof HTMLVideoElement) {
              rig.videoTexture = new THREE.VideoTexture(sourceEl);
            } else {
              rig.videoTexture = new THREE.CanvasTexture(sourceEl);
            }
            rig.videoTexture.colorSpace = THREE.SRGBColorSpace;
            rig.videoTexture.minFilter = THREE.LinearFilter;
            rig.videoTexture.magFilter = THREE.LinearFilter;
            rig.videoScreenMat.map = rig.videoTexture;
            rig.videoScreenMat.needsUpdate = true;
            rig.lastSourceEl = sourceEl;
          }
          if (rig.videoTexture) {
            rig.videoTexture.needsUpdate = true;
          }
          rig.videoFrameRingMat.color.setHex(seat.alive ? 0x14b8a6 : 0x64748b);
        } else {
          // Camera OFF -> Display neutral 3D Teddy Avatar
          rig.videoScreenGroup.visible = false;
          rig.teddyGroup.visible = true;

          const idleBob = seat.alive ? Math.sin(elapsed * 2.0 + rig.seatIndex * 1.1) * 0.015 : 0;
          rig.teddyGroup.position.y = 0.5 + idleBob;
          const headChild = rig.teddyGroup.getObjectByName('teddyHead');
          if (headChild && seat.alive) {
            headChild.rotation.y = Math.sin(elapsed * 0.9 + rig.seatIndex) * 0.14;
          }
        }
      }

      // Smooth Camera Preset + Orbit Interpolation
      const preset = cameraPresetRef.current;
      let camRadius = 5.45;
      let camTargetY = 1.35;
      let camTargetZ = -0.65;
      let goalPolar = targetPolar;
      if (preset === 'screen') {
        camRadius = 3.2;
        camTargetY = 2.4;
        camTargetZ = -2.4;
        goalPolar = 0.14;
      } else if (preset === 'overhead') {
        camRadius = 5.9;
        camTargetY = 0.75;
        camTargetZ = 0.0;
        goalPolar = 1.08;
      }

      curAzimuth = THREE.MathUtils.damp(curAzimuth, targetAzimuth, 6, dt);
      curPolar = THREE.MathUtils.damp(curPolar, goalPolar, 6, dt);

      const desiredX = Math.sin(curAzimuth) * Math.cos(curPolar) * camRadius;
      const desiredY = camTargetY + Math.sin(curPolar) * camRadius * 0.85;
      const desiredZ = camTargetZ + Math.cos(curAzimuth) * Math.cos(curPolar) * camRadius;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 6, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 6, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, 6, dt);
      camera.lookAt(0, preset === 'screen' ? 2.45 : 1.18, preset === 'screen' ? -5.1 : -0.75);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        rafId = window.setTimeout(() => {
          if (!disposed) requestAnimationFrame(renderFrame);
        }, 50);
      } else {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      seatRigs.forEach((rig) => {
        rig.videoTexture?.dispose();
        rig.nameplateTex.dispose();
        disposeObject3D(rig.root);
      });
      screenTexture.dispose();
      roomEnvTexture.dispose();
      pmremGenerator.dispose();
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, []);

  if (webglUnavailable) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d121c] text-center p-6">
        <p className="text-sm font-bold text-amber-400">3D Lounge Fallback View</p>
        <p className="text-xs text-slate-300 mt-1 max-w-sm">
          WebGL hardware context is temporarily unavailable. Voice, clues, voting, and match progression continue seamlessly.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="live-spy-3d-canvas"
      className="w-full h-full relative select-none touch-none bg-[#0b0e14]"
    />
  );
};
