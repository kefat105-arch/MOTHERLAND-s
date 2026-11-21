import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Copy,
  Layers,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '../../../api';
import type { UserProfile } from '../../../types';
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
} from './proceduralAssets';
import { createGrassTexture, createRobloxSkyDome, createSandTexture } from './robloxRenderer';
import type {
  CustomGameBiome,
  CustomGameDefinition,
  CustomGameObject,
  CustomGroundMaterial,
  CustomObjectKind,
} from './types';

export const CUSTOM_GAMES_STORAGE_KEY = 'motherland_custom_games_v1';

export function loadLocalCustomGames(): CustomGameDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_GAMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomGameDefinition[]) : [];
  } catch {
    return [];
  }
}

export function upsertLocalCustomGame(def: CustomGameDefinition): CustomGameDefinition[] {
  const existing = loadLocalCustomGames();
  const idx = existing.findIndex((g) => g.id === def.id);
  const next = idx >= 0 ? existing.map((g, i) => (i === idx ? def : g)) : [def, ...existing];
  try {
    localStorage.setItem(CUSTOM_GAMES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota failure
  }
  return next;
}

export function removeLocalCustomGame(id: string): CustomGameDefinition[] {
  const next = loadLocalCustomGames().filter((g) => g.id !== id);
  try {
    localStorage.setItem(CUSTOM_GAMES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

interface PaletteItemMeta {
  kind: CustomObjectKind;
  label: string;
  bnLabel: string;
  badgeColor: string;
  defaultY: number;
  defaultColor?: string;
}

const OBJECT_PALETTE: PaletteItemMeta[] = [
  { kind: 'spawn_pad', label: 'Spawn Pad', bnLabel: 'শুরু প্যাড', badgeColor: '#14b8a6', defaultY: 0.35 },
  { kind: 'platform_marble', label: 'Marble Block', bnLabel: 'শ্বেতপাথর', badgeColor: '#f1f5f9', defaultY: 1.4 },
  { kind: 'platform_stone', label: 'Stone Block', bnLabel: 'খোদাই পাথর', badgeColor: '#94a3b8', defaultY: 1.4 },
  { kind: 'platform_wood', label: 'Wood Deck', bnLabel: 'কাঠের ডেক', badgeColor: '#b45309', defaultY: 1.4 },
  { kind: 'platform_neon', label: 'Neon Deck', bnLabel: 'নিয়ন প্ল্যাটফর্ম', badgeColor: '#06b6d4', defaultY: 1.4, defaultColor: '#06b6d4' },
  { kind: 'moving_platform', label: 'Moving Bridge', bnLabel: 'চলন্ত ব্রিজ', badgeColor: '#38bdf8', defaultY: 2.2, defaultColor: '#38bdf8' },
  { kind: 'bounce_pad', label: 'Bounce Pad', bnLabel: 'বাউন্স প্যাড', badgeColor: '#a855f7', defaultY: 0.35, defaultColor: '#a855f7' },
  { kind: 'stone_arch', label: 'Stone Archway', bnLabel: 'তোরণ / গেট', badgeColor: '#f59e0b', defaultY: 0, defaultColor: '#38bdf8' },
  { kind: 'tree_palm', label: 'Palm Tree', bnLabel: 'পাম গাছ', badgeColor: '#16a34a', defaultY: 0 },
  { kind: 'tree_pine', label: 'Pine Tree', bnLabel: 'পাইন গাছ', badgeColor: '#15803d', defaultY: 0 },
  { kind: 'crystal_pillar', label: 'Crystal Cluster', bnLabel: 'ক্রিস্টাল', badgeColor: '#22d3ee', defaultY: 0, defaultColor: '#10b981' },
  { kind: 'coin_gem', label: 'Gold Relic', bnLabel: 'কয়েন জেম', badgeColor: '#facc15', defaultY: 1.8, defaultColor: '#facc15' },
  { kind: 'checkpoint', label: 'Checkpoint', bnLabel: 'চেকপয়েন্ট', badgeColor: '#10b981', defaultY: 0.35 },
  { kind: 'laser_spinner', label: 'Laser Spinner', bnLabel: 'লেজার ব্লেড', badgeColor: '#ef4444', defaultY: 1.4 },
  { kind: 'hazard_lava', label: 'Lava Hazard', bnLabel: 'লাভা জোন', badgeColor: '#f97316', defaultY: 0.2 },
  { kind: 'finish_portal', label: 'Victory Portal', bnLabel: 'ফিনিশ পোর্টাল', badgeColor: '#10b981', defaultY: 0, defaultColor: '#10b981' },
];

const BIOME_OPTIONS: Array<{ id: CustomGameBiome; label: string; bn: string }> = [
  { id: 'sky_day', label: 'Sky Day', bn: 'রৌদ্রোজ্জ্বল আকাশ' },
  { id: 'golden_sunset', label: 'Golden Sunset', bn: 'সোনালি গোধূলি' },
  { id: 'cyber_night', label: 'Cyber Night', bn: 'নিয়ন রাত' },
  { id: 'volcano_ash', label: 'Volcano Ember', bn: 'আগ্নেয়গিরি' },
];

const GROUND_OPTIONS: Array<{ id: CustomGroundMaterial; label: string; bn: string }> = [
  { id: 'grass', label: 'Meadow Grass', bn: 'সবুজ ঘাস' },
  { id: 'marble', label: 'Marble Court', bn: 'মার্বেল টাইলস' },
  { id: 'asphalt', label: 'Wet Asphalt', bn: 'নিয়ন রোড' },
  { id: 'basalt', label: 'Basalt Rock', bn: 'ব্যাসল্ট শিলা' },
  { id: 'sand', label: 'Golden Sand', bn: 'সোনালি বালু' },
];

function createUid(): string {
  return `obj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

interface StarterTemplate {
  id: string;
  label: string;
  bn: string;
  build: () => CustomGameDefinition;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'sky_parkour',
    label: 'Aether Parkour',
    bn: 'আকাশের পার্কোর',
    build: () => ({
      id: `custom_${Date.now().toString(36)}`,
      title: 'My Sky Citadel Obby',
      description: 'ভাসমান মার্বেল প্ল্যাটফর্ম, বাউন্স প্যাড ও সোনালি পোর্টাল চ্যালেঞ্জ!',
      biome: 'golden_sunset',
      groundMaterial: 'marble',
      moveSpeed: 14,
      jumpPower: 15,
      objects: [
        { uid: createUid(), kind: 'spawn_pad', x: 0, y: 0.35, z: 14, scale: 1 },
        { uid: createUid(), kind: 'stone_arch', x: 0, y: 0, z: 8, scale: 1, colorHex: '#f59e0b' },
        { uid: createUid(), kind: 'platform_marble', x: 0, y: 1.5, z: 0, scale: 1.1 },
        { uid: createUid(), kind: 'coin_gem', x: 0, y: 3.1, z: 0, scale: 1, colorHex: '#facc15' },
        { uid: createUid(), kind: 'bounce_pad', x: 0, y: 1.8, z: -7, scale: 1, colorHex: '#a855f7' },
        { uid: createUid(), kind: 'moving_platform', x: 0, y: 4.5, z: -15, scale: 1.1, colorHex: '#38bdf8' },
        { uid: createUid(), kind: 'checkpoint', x: 0, y: 4.8, z: -24, scale: 1 },
        { uid: createUid(), kind: 'crystal_pillar', x: -5, y: 0, z: -10, scale: 1.1, colorHex: '#38bdf8' },
        { uid: createUid(), kind: 'crystal_pillar', x: 5, y: 0, z: -10, scale: 1.1, colorHex: '#38bdf8' },
        { uid: createUid(), kind: 'finish_portal', x: 0, y: 4.5, z: -34, scale: 1.1, colorHex: '#10b981' },
      ],
    }),
  },
  {
    id: 'cyber_sprint',
    label: 'Cyber Neon Sprint',
    bn: 'নিয়ন সিটি রেস',
    build: () => ({
      id: `custom_${Date.now().toString(36)}`,
      title: 'Neon Velocity Track',
      description: 'নিয়ন ডেক, লেজার স্পিনার ও বাউন্স প্যাডের দ্রুতগতির ৩ডি ট্র্যাক!',
      biome: 'cyber_night',
      groundMaterial: 'asphalt',
      moveSpeed: 18,
      jumpPower: 16,
      objects: [
        { uid: createUid(), kind: 'spawn_pad', x: 0, y: 0.35, z: 18, scale: 1 },
        { uid: createUid(), kind: 'platform_neon', x: 0, y: 1.2, z: 8, scale: 1.3, colorHex: '#06b6d4' },
        { uid: createUid(), kind: 'laser_spinner', x: 0, y: 2.2, z: 0, scale: 1 },
        { uid: createUid(), kind: 'coin_gem', x: -3.5, y: 2.5, z: 0, scale: 1, colorHex: '#22d3ee' },
        { uid: createUid(), kind: 'coin_gem', x: 3.5, y: 2.5, z: 0, scale: 1, colorHex: '#22d3ee' },
        { uid: createUid(), kind: 'platform_neon', x: 0, y: 2.0, z: -10, scale: 1.2, colorHex: '#ec4899' },
        { uid: createUid(), kind: 'crystal_pillar', x: -8, y: 0, z: -5, scale: 1.2, colorHex: '#ec4899' },
        { uid: createUid(), kind: 'crystal_pillar', x: 8, y: 0, z: -5, scale: 1.2, colorHex: '#06b6d4' },
        { uid: createUid(), kind: 'finish_portal', x: 0, y: 2.0, z: -22, scale: 1.15, colorHex: '#22d3ee' },
      ],
    }),
  },
  {
    id: 'volcano_trial',
    label: 'Volcano Trial',
    bn: 'লাভা মন্দির পরীক্ষা',
    build: () => ({
      id: `custom_${Date.now().toString(36)}`,
      title: 'Obsidian Lava Sanctuary',
      description: 'উত্তপ্ত লাভা জোনের ওপর ব্যাসল্ট পাথরের মন্দির ও রিলিক সংগ্রহ!',
      biome: 'volcano_ash',
      groundMaterial: 'basalt',
      moveSpeed: 15,
      jumpPower: 16,
      objects: [
        { uid: createUid(), kind: 'spawn_pad', x: 0, y: 0.35, z: 16, scale: 1 },
        { uid: createUid(), kind: 'hazard_lava', x: -6, y: 0.2, z: 4, scale: 1.2 },
        { uid: createUid(), kind: 'hazard_lava', x: 6, y: 0.2, z: 4, scale: 1.2 },
        { uid: createUid(), kind: 'platform_stone', x: 0, y: 1.8, z: 5, scale: 1.15 },
        { uid: createUid(), kind: 'stone_arch', x: 0, y: 1.8, z: -3, scale: 1, colorHex: '#f97316' },
        { uid: createUid(), kind: 'moving_platform', x: 0, y: 2.4, z: -12, scale: 1, colorHex: '#f97316' },
        { uid: createUid(), kind: 'coin_gem', x: 0, y: 4.0, z: -12, scale: 1.1, colorHex: '#facc15' },
        { uid: createUid(), kind: 'finish_portal', x: 0, y: 2.4, z: -24, scale: 1.1, colorHex: '#f59e0b' },
      ],
    }),
  },
  {
    id: 'blank_island',
    label: 'Blank Island',
    bn: 'খালি দ্বীপ (শূন্য থেকে)',
    build: () => ({
      id: `custom_${Date.now().toString(36)}`,
      title: 'My New 3D World',
      description: 'নিজের তৈরি ম্যাপ, গাছ, পাথর ও ২৫-প্লেয়ার অব্বি চ্যালেঞ্জ!',
      biome: 'sky_day',
      groundMaterial: 'grass',
      moveSpeed: 14,
      jumpPower: 15,
      objects: [
        { uid: createUid(), kind: 'spawn_pad', x: 0, y: 0.35, z: 12, scale: 1 },
        { uid: createUid(), kind: 'tree_palm', x: -9, y: 0, z: 6, scale: 1 },
        { uid: createUid(), kind: 'tree_pine', x: 9, y: 0, z: -2, scale: 1 },
        { uid: createUid(), kind: 'coin_gem', x: 0, y: 1.8, z: 0, scale: 1, colorHex: '#facc15' },
        { uid: createUid(), kind: 'finish_portal', x: 0, y: 0, z: -16, scale: 1, colorHex: '#10b981' },
      ],
    }),
  },
];

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
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

function parseHexNum(hex: string | undefined, fallback: number): number {
  if (!hex) return fallback;
  const clean = hex.replace('#', '').trim();
  const n = parseInt(clean, 16);
  return Number.isFinite(n) ? n : fallback;
}

interface GameCreatorStudioProps {
  initialDefinition?: CustomGameDefinition | null;
  currentUser: UserProfile | null;
  onBack: () => void;
  onRunAndPlay: (def: CustomGameDefinition) => void;
  onPublished: (def: CustomGameDefinition) => void;
}

export const GameCreatorStudio: React.FC<GameCreatorStudioProps> = ({
  initialDefinition,
  currentUser,
  onBack,
  onRunAndPlay,
  onPublished,
}) => {
  const [definition, setDefinition] = useState<CustomGameDefinition>(() =>
    initialDefinition ? { ...initialDefinition, objects: initialDefinition.objects.map((o) => ({ ...o })) } : STARTER_TEMPLATES[0].build()
  );
  const [selectedUid, setSelectedUid] = useState<string | null>(
    () => definition.objects[0]?.uid || null
  );
  const [activeTab, setActiveTab] = useState<'objects' | 'world' | 'inspector'>('objects');
  const [saving, setSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const selectedObj = useMemo(
    () => definition.objects.find((o) => o.uid === selectedUid) || null,
    [definition.objects, selectedUid]
  );

  // Orbit Camera State for Live 3D Studio Viewport
  const mountRef = useRef<HTMLDivElement | null>(null);
  const orbitRef = useRef({ yaw: 0.48, pitch: 0.48, dist: 38, targetX: 0, targetY: 1, targetZ: -4 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const sceneSyncRef = useRef<{
    rebuildContent: (def: CustomGameDefinition, selId: string | null) => void;
  } | null>(null);

  const resetStudioCamera = () => {
    orbitRef.current = { yaw: 0.48, pitch: 0.48, dist: 38, targetX: 0, targetY: 1, targetZ: -4 };
  };

  // Mount WebGL Preview Viewport
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(mount.clientWidth || 640, mount.clientHeight || 360);
    mount.appendChild(renderer.domElement);

    const glCtx = renderer.getContext();
    const dbg = glCtx.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(glCtx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(rendererStr);
    const maxAnisotropy = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      52,
      Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight),
      0.2,
      420
    );

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.9);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    dirLight.position.set(28, 42, 24);
    dirLight.castShadow = !isSoftwareGl;
    dirLight.shadow.mapSize.set(1024, 1024);
    scene.add(dirLight);

    const rebuildContent = (def: CustomGameDefinition, selId: string | null) => {
      while (dynamicGroup.children.length > 0) {
        const c = dynamicGroup.children[0];
        dynamicGroup.remove(c);
        disposeObjectTree(c);
      }

      // Sky & Fog matching Biome
      const skyConf: Record<
        CustomGameBiome,
        { top: string; horizon: string; bottom: string; fog: number; hemiSky: number; sun: number }
      > = {
        sky_day: { top: '#0284c7', horizon: '#bae6fd', bottom: '#e0f2fe', fog: 0xdbeafe, hemiSky: 0xe0f2fe, sun: 0xfffdf2 },
        golden_sunset: { top: '#312e81', horizon: '#fb923c', bottom: '#fef08a', fog: 0xfdba74, hemiSky: 0xfed7aa, sun: 0xffedd5 },
        cyber_night: { top: '#020617', horizon: '#0f172a', bottom: '#1e1b4b', fog: 0x090d1b, hemiSky: 0x38bdf8, sun: 0xc084fc },
        volcano_ash: { top: '#18181b', horizon: '#7c2d12', bottom: '#dc2626', fog: 0x271311, hemiSky: 0xfb923c, sun: 0xffedd5 },
      };
      const sc = skyConf[def.biome] || skyConf.sky_day;
      scene.background = new THREE.Color(sc.fog);
      scene.fog = new THREE.FogExp2(sc.fog, 0.0052);
      hemiLight.color.setHex(sc.hemiSky);
      dirLight.color.setHex(sc.sun);

      createRobloxSkyDome(dynamicGroup as unknown as THREE.Scene, {
        topHex: sc.top,
        horizonHex: sc.horizon,
        groundHex: sc.bottom,
      });

      // Ground Arena + Reference Grid
      const groundMat =
        def.groundMaterial === 'marble'
          ? createMarblePbrMaterial(maxAnisotropy, '#f8fafc', '#94a3b8', 16, 16)
          : def.groundMaterial === 'asphalt'
          ? createWetCyberAsphaltMaterial(maxAnisotropy, '#22d3ee', 16, 16)
          : def.groundMaterial === 'basalt'
          ? createVolcanicBasaltMaterial(maxAnisotropy, true, 14, 14)
          : def.groundMaterial === 'sand'
          ? new THREE.MeshStandardMaterial({ map: createSandTexture(maxAnisotropy, 16), roughness: 0.88 })
          : new THREE.MeshStandardMaterial({ map: createGrassTexture(maxAnisotropy, 18), roughness: 0.85 });

      const ground = new THREE.Mesh(new THREE.CylinderGeometry(72, 75, 2.4, 32), groundMat);
      ground.position.y = -1.2;
      ground.receiveShadow = true;
      dynamicGroup.add(ground);

      const grid = new THREE.GridHelper(120, 30, 0x38bdf8, 0x475569);
      grid.position.y = 0.02;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.25;
      dynamicGroup.add(grid);

      // Shared PBR mats for preview objects
      const marbleMat = createMarblePbrMaterial(maxAnisotropy, '#f8fafc', '#cbd5e1', 2, 2);
      const stoneMat = createCarvedStonePbrMaterial(maxAnisotropy, '#64748b', '#334155', 2, 2);
      const woodMat = createHardwoodDeckMaterial(maxAnisotropy, '#92400e', 2, 2);
      const neonMat = createWetCyberAsphaltMaterial(maxAnisotropy, '#22d3ee', 2, 2);
      const goldTrim = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#f59e0b', 1, 1);
      const steelTrim = createBrushedTitaniumPbrMaterial(maxAnisotropy, '#334155', 1, 1);

      for (const item of def.objects) {
        const s = Math.max(0.4, Math.min(3, item.scale || 1));
        const col = parseHexNum(item.colorHex, 0x38bdf8);
        let obj3d: THREE.Object3D;

        if (item.kind === 'spawn_pad') {
          obj3d = buildCompositePlatform(5 * s, 0.7, 5 * s, marbleMat, steelTrim, 0x14b8a6);
        } else if (item.kind === 'platform_marble') {
          obj3d = buildCompositePlatform(6.5 * s, 1.0, 6.5 * s, marbleMat, goldTrim);
        } else if (item.kind === 'platform_stone') {
          obj3d = buildCompositePlatform(6.5 * s, 1.1, 6.5 * s, stoneMat, steelTrim);
        } else if (item.kind === 'platform_wood') {
          obj3d = buildCompositePlatform(6.5 * s, 0.9, 6.5 * s, woodMat, steelTrim);
        } else if (item.kind === 'platform_neon' || item.kind === 'moving_platform') {
          obj3d = buildCompositePlatform(6.0 * s, 0.9, 6.0 * s, neonMat, steelTrim, col);
        } else if (item.kind === 'bounce_pad') {
          obj3d = buildCompositePlatform(3.6 * s, 0.7, 3.6 * s, steelTrim, goldTrim, col);
        } else if (item.kind === 'checkpoint') {
          obj3d = buildCompositePlatform(4.4 * s, 0.65, 4.4 * s, marbleMat, goldTrim, 0x10b981);
        } else if (item.kind === 'stone_arch') {
          obj3d = buildSculptedArchway(5.5 * s, 5.2 * s, stoneMat, goldTrim, col);
        } else if (item.kind === 'tree_palm') {
          obj3d = buildSculptedTree('palm', s);
        } else if (item.kind === 'tree_pine') {
          obj3d = buildSculptedTree('pine', s);
        } else if (item.kind === 'crystal_pillar') {
          obj3d = buildCrystalCluster(col, col, s * 1.1);
        } else if (item.kind === 'coin_gem') {
          obj3d = buildCollectibleGem(parseHexNum(item.colorHex, 0xfacc15));
          obj3d.scale.setScalar(s);
        } else if (item.kind === 'laser_spinner') {
          const g = new THREE.Group();
          const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.65, 0.85, 1.3, 12),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
          );
          g.add(hub);
          const beam = new THREE.Mesh(
            new THREE.BoxGeometry(8 * s, 0.25, 0.25),
            new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
          );
          beam.position.y = 0.2;
          g.add(beam);
          obj3d = g;
        } else if (item.kind === 'hazard_lava') {
          const lavaMat = new THREE.MeshStandardMaterial({
            color: 0xf97316,
            emissive: 0xea580c,
            emissiveIntensity: 1.5,
            roughness: 0.25,
          });
          obj3d = new THREE.Mesh(new THREE.BoxGeometry(7 * s, 0.45, 7 * s), lavaMat);
        } else {
          // finish_portal
          obj3d = buildVictoryPortalGate(parseHexNum(item.colorHex, 0x10b981));
          obj3d.scale.setScalar(s);
        }

        obj3d.position.set(item.x, item.y, item.z);
        obj3d.rotation.y = ((item.rotY || 0) * Math.PI) / 180;
        dynamicGroup.add(obj3d);

        // Clean selection ring marker for selected object in Studio
        if (item.uid === selId) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(3.2 * Math.max(0.7, s), 0.12, 8, 28),
            new THREE.MeshBasicMaterial({ color: 0xfacc15 })
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.set(item.x, item.y + 0.25, item.z);
          dynamicGroup.add(ring);
        }
      }
    };

    sceneSyncRef.current = { rebuildContent };
    rebuildContent(definition, selectedUid);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(100, entry.contentRect.width);
        const h = Math.max(100, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(mount);

    let rafId = 0;
    const renderLoop = () => {
      const o = orbitRef.current;
      const cx = o.targetX + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist;
      const cy = o.targetY + Math.sin(o.pitch) * o.dist;
      const cz = o.targetZ + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist;
      camera.position.set(cx, Math.max(1.2, cy), cz);
      camera.lookAt(o.targetX, o.targetY, o.targetZ);
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      sceneSyncRef.current = null;
      while (dynamicGroup.children.length > 0) {
        const c = dynamicGroup.children[0];
        dynamicGroup.remove(c);
        disposeObjectTree(c);
      }
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync 3D preview scene cleanly whenever definition or selection updates
  useEffect(() => {
    sceneSyncRef.current?.rebuildContent(definition, selectedUid);
  }, [definition, selectedUid]);

  const handleAddObject = (meta: PaletteItemMeta) => {
    const last = definition.objects[definition.objects.length - 1];
    const nextZ = last ? Math.round((last.z - 6.5) * 10) / 10 : 0;
    const nextX = last && definition.objects.length % 2 === 0 ? 3.5 : 0;
    const created: CustomGameObject = {
      uid: createUid(),
      kind: meta.kind,
      x: meta.kind === 'spawn_pad' ? 0 : nextX,
      y: meta.defaultY,
      z: meta.kind === 'spawn_pad' ? 14 : nextZ,
      rotY: 0,
      scale: 1,
      colorHex: meta.defaultColor,
    };
    setDefinition((prev) => ({
      ...prev,
      objects: [...prev.objects, created],
    }));
    setSelectedUid(created.uid);
    orbitRef.current.targetX = created.x;
    orbitRef.current.targetZ = created.z;
    setActiveTab('inspector');
  };

  const updateSelected = useCallback(
    (patch: Partial<CustomGameObject>) => {
      if (!selectedUid) return;
      setDefinition((prev) => ({
        ...prev,
        objects: prev.objects.map((o) => (o.uid === selectedUid ? { ...o, ...patch } : o)),
      }));
    },
    [selectedUid]
  );

  const duplicateSelected = () => {
    if (!selectedObj) return;
    const copy: CustomGameObject = {
      ...selectedObj,
      uid: createUid(),
      x: Number((selectedObj.x + 3).toFixed(1)),
      z: Number((selectedObj.z - 3).toFixed(1)),
    };
    setDefinition((prev) => ({ ...prev, objects: [...prev.objects, copy] }));
    setSelectedUid(copy.uid);
  };

  const deleteSelected = () => {
    if (!selectedUid) return;
    setDefinition((prev) => {
      const nextObjs = prev.objects.filter((o) => o.uid !== selectedUid);
      setSelectedUid(nextObjs[0]?.uid || null);
      return { ...prev, objects: nextObjs };
    });
  };

  const applyTemplate = (tpl: StarterTemplate) => {
    const built = tpl.build();
    // Preserve id when editing an existing game
    const nextDef: CustomGameDefinition = {
      ...built,
      id: initialDefinition?.id || definition.id || built.id,
    };
    setDefinition(nextDef);
    setSelectedUid(nextDef.objects[0]?.uid || null);
    resetStudioCamera();
    setStatusNotice({ text: `${tpl.bn} টেমপ্লেট লোড হয়েছে!`, tone: 'ok' });
  };

  const handleSaveAndPublish = async () => {
    const cleanTitle = definition.title.trim() || 'My 3D World';
    const payload: CustomGameDefinition = {
      ...definition,
      title: cleanTitle,
      creatorId: currentUser?.id || definition.creatorId || 'local',
      creatorName: currentUser?.displayName || definition.creatorName || 'Creator',
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    setStatusNotice(null);
    upsertLocalCustomGame(payload);
    try {
      if (currentUser) {
        const res = await api.saveCustomGame(payload);
        const saved = (res?.game as CustomGameDefinition) || payload;
        upsertLocalCustomGame(saved);
        onPublished(saved);
        setStatusNotice({ text: 'আপনার গেম সেভ ও প্রকাশ হয়েছে — এখন "গেম খেলুন"-এ খেলতে পারবেন!', tone: 'ok' });
      } else {
        onPublished(payload);
        setStatusNotice({ text: 'গেম লোকালি সেভ হয়েছে — "গেম খেলুন"-এ গিয়ে খেলুন!', tone: 'ok' });
      }
    } catch {
      onPublished(payload);
      setStatusNotice({ text: 'গেম ডিভাইসে সেভ হয়েছে — "গেম খেলুন"-এ গিয়ে খেলতে পারবেন!', tone: 'ok' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="game-creator-studio" className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24">
      {/* Studio Top Bar */}
      <div className="ml-glass rounded-2xl p-3.5 border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            data-testid="studio-back-btn"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0"
            aria-label="Back to Games Portal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-[var(--text-primary)] truncate">
              গেম তৈরি করুন · 3D CREATOR STUDIO
            </h1>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
              ম্যাপ ডিজাইন করুন, লাইভ থ্রিডি-তে দেখুন এবং ২৫ প্লেয়ার সার্ভারে প্রকাশ করুন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="studio-run-play-btn"
            onClick={() => onRunAndPlay(definition)}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>চালিয়ে দেখুন</span>
          </button>

          <button
            type="button"
            data-testid="studio-publish-btn"
            disabled={saving}
            onClick={handleSaveAndPublish}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-black flex items-center gap-1.5 shadow disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'সেভ হচ্ছে...' : 'গেম প্রকাশ করুন'}</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div
          data-testid="studio-status-banner"
          className={`rounded-2xl px-4 py-2.5 border text-xs font-bold flex items-center gap-2 ${
            statusNotice.tone === 'ok'
              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* Main Studio Workspace: Live 3D Viewport + Side Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Top: Live 3D Viewport (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[#090e1a] h-[300px] sm:h-[380px] shadow-xl">
            <div
              ref={mountRef}
              onPointerDown={(e) => {
                dragRef.current = { active: true, x: e.clientX, y: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.active) return;
                const dx = e.clientX - dragRef.current.x;
                const dy = e.clientY - dragRef.current.y;
                dragRef.current = { active: true, x: e.clientX, y: e.clientY };
                orbitRef.current.yaw -= dx * 0.008;
                orbitRef.current.pitch = Math.max(0.08, Math.min(1.42, orbitRef.current.pitch + dy * 0.008));
              }}
              onPointerUp={() => {
                dragRef.current.active = false;
              }}
              onWheel={(e) => {
                orbitRef.current.dist = Math.max(12, Math.min(85, orbitRef.current.dist + e.deltaY * 0.04));
              }}
              className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
            />

            <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#0d1322]/90 border border-white/15 text-[11px] font-black text-sky-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>ড্র্যাগ করে ৩ডি ওয়ার্ল্ড ঘুরিয়ে দেখুন ({definition.objects.length} Objects)</span>
            </div>

            <button
              type="button"
              onClick={resetStudioCamera}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-[#0d1322]/90 border border-white/20 text-[11px] font-bold text-slate-100 flex items-center gap-1 hover:border-amber-400"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Cam</span>
            </button>
          </div>

          {/* Starter Templates Quick Bar */}
          <div className="ml-glass rounded-2xl p-3 border border-[var(--border-subtle)] space-y-2">
            <p className="text-xs font-black text-[var(--text-primary)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>রেডি স্টার্টার টেমপ্লেট দিয়ে শুরু করুন:</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STARTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  data-testid={`studio-tpl-${tpl.id}`}
                  onClick={() => applyTemplate(tpl)}
                  className="p-2 rounded-xl bg-[var(--bg-surface-alt)] hover:border-amber-400/60 border border-[var(--border-subtle)] text-left transition-all"
                >
                  <p className="text-[11px] font-black text-[var(--text-primary)] truncate">{tpl.label}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] truncate">{tpl.bn}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Studio Workbench (5 cols) */}
        <div className="lg:col-span-5 ml-glass rounded-3xl border border-[var(--border-subtle)] overflow-hidden flex flex-col">
          {/* Workbench Tabs */}
          <div className="grid grid-cols-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-alt)]">
            <button
              type="button"
              data-testid="studio-tab-objects"
              onClick={() => setActiveTab('objects')}
              className={`py-2.5 text-xs font-black flex items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === 'objects'
                  ? 'border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                  : 'border-transparent text-[var(--text-secondary)]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>অবজেক্ট</span>
            </button>

            <button
              type="button"
              data-testid="studio-tab-inspector"
              onClick={() => setActiveTab('inspector')}
              className={`py-2.5 text-xs font-black flex items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === 'inspector'
                  ? 'border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                  : 'border-transparent text-[var(--text-secondary)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>এডিট ({definition.objects.length})</span>
            </button>

            <button
              type="button"
              data-testid="studio-tab-world"
              onClick={() => setActiveTab('world')}
              className={`py-2.5 text-xs font-black flex items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === 'world'
                  ? 'border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                  : 'border-transparent text-[var(--text-secondary)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>সেটিংস</span>
            </button>
          </div>

          {/* Tab Panel Content */}
          <div className="p-3.5 space-y-3 max-h-[440px] overflow-y-auto">
            {activeTab === 'objects' && (
              <>
                <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                  যেকোনো থ্রিডি অবজেক্টে ক্লিক করলে সরাসরি আপনার ওয়ার্ল্ডে যুক্ত হবে:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {OBJECT_PALETTE.map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      data-testid={`palette-add-${item.kind}`}
                      onClick={() => handleAddObject(item)}
                      className="p-2.5 rounded-xl bg-[var(--bg-surface-alt)] hover:border-[var(--accent-primary)] border border-[var(--border-subtle)] text-left flex items-center gap-2 transition-all active:scale-95"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-md shrink-0 border border-white/25"
                        style={{ backgroundColor: item.badgeColor }}
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-[var(--text-primary)] truncate">
                          {item.bnLabel}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">{item.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'inspector' && (
              <div className="space-y-3">
                {/* Object List Picker */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-[var(--text-secondary)]">
                    ওয়ার্ল্ডের অবজেক্ট তালিকা:
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
                    {definition.objects.map((o, idx) => {
                      const meta = OBJECT_PALETTE.find((p) => p.kind === o.kind);
                      const isSel = o.uid === selectedUid;
                      return (
                        <button
                          key={o.uid}
                          type="button"
                          onClick={() => {
                            setSelectedUid(o.uid);
                            orbitRef.current.targetX = o.x;
                            orbitRef.current.targetZ = o.z;
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {idx + 1}. {meta?.bnLabel || o.kind}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedObj ? (
                  <div className="p-3 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[var(--text-primary)]">
                        {OBJECT_PALETTE.find((p) => p.kind === selectedObj.kind)?.bnLabel || selectedObj.kind}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={duplicateSelected}
                          className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-sky-400"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={deleteSelected}
                          className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-400 hover:bg-rose-500/30"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* X / Y / Z / Scale / Rotation Controls */}
                    {(
                      [
                        { key: 'x', label: 'X অবস্থান', min: -55, max: 55, step: 0.5 },
                        { key: 'y', label: 'উচ্চতা (Y)', min: 0, max: 35, step: 0.25 },
                        { key: 'z', label: 'Z অবস্থান', min: -65, max: 55, step: 0.5 },
                        { key: 'scale', label: 'আকার (Scale)', min: 0.5, max: 3, step: 0.1 },
                        { key: 'rotY', label: 'ঘূর্ণন (Deg)', min: 0, max: 360, step: 15 },
                      ] as const
                    ).map((ctrl) => {
                      const val =
                        ctrl.key === 'scale'
                          ? selectedObj.scale ?? 1
                          : ctrl.key === 'rotY'
                          ? selectedObj.rotY ?? 0
                          : selectedObj[ctrl.key];
                      return (
                        <div key={ctrl.key} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)]">
                            <span>{ctrl.label}</span>
                            <span className="tabular-nums text-[var(--text-primary)]">{val}</span>
                          </div>
                          <input
                            type="range"
                            min={ctrl.min}
                            max={ctrl.max}
                            step={ctrl.step}
                            value={val}
                            onChange={(e) => updateSelected({ [ctrl.key]: Number(e.target.value) })}
                            className="w-full accent-amber-500"
                          />
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">অ্যাক্সেন্ট কালার</span>
                      <input
                        type="color"
                        value={selectedObj.colorHex || '#38bdf8'}
                        onChange={(e) => updateSelected({ colorHex: e.target.value })}
                        className="w-8 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">এডিট করতে উপরে একটি অবজেক্ট সিলেক্ট করুন।</p>
                )}
              </div>
            )}

            {activeTab === 'world' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-[var(--text-secondary)]">গেমের নাম</label>
                  <input
                    type="text"
                    value={definition.title}
                    onChange={(e) => setDefinition((p) => ({ ...p, title: e.target.value }))}
                    maxLength={60}
                    className="w-full rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-[var(--text-secondary)]">গেমের বিবরণ</label>
                  <textarea
                    rows={2}
                    value={definition.description}
                    onChange={(e) => setDefinition((p) => ({ ...p, description: e.target.value }))}
                    maxLength={200}
                    className="w-full rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-[var(--text-secondary)]">আকাশ ও আবহাওয়া (Biome)</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BIOME_OPTIONS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setDefinition((p) => ({ ...p, biome: b.id }))}
                        className={`p-2 rounded-xl text-left border text-[11px] font-bold ${
                          definition.biome === b.id
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] border-transparent'
                            : 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {b.bn}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-[var(--text-secondary)]">মাটি ও সারফেস</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {GROUND_OPTIONS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setDefinition((p) => ({ ...p, groundMaterial: g.id }))}
                        className={`p-2 rounded-xl text-left border text-[11px] font-bold ${
                          definition.groundMaterial === g.id
                            ? 'bg-emerald-500 text-slate-950 border-transparent'
                            : 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {g.bn}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-[var(--text-secondary)]">
                      <span>দৌড়ানোর গতি</span>
                      <span className="text-[var(--text-primary)]">{definition.moveSpeed}</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={24}
                      step={1}
                      value={definition.moveSpeed}
                      onChange={(e) => setDefinition((p) => ({ ...p, moveSpeed: Number(e.target.value) }))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-[var(--text-secondary)]">
                      <span>লাফের শক্তি</span>
                      <span className="text-[var(--text-primary)]">{definition.jumpPower}</span>
                    </div>
                    <input
                      type="range"
                      min={11}
                      max={22}
                      step={1}
                      value={definition.jumpPower}
                      onChange={(e) => setDefinition((p) => ({ ...p, jumpPower: Number(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
