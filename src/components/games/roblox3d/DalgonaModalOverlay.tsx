import React, { useCallback, useEffect, useRef, useState } from 'react';
import { robloxAudio } from './robloxAudio';
import type { DalgonaShape } from './types';

interface DalgonaModalOverlayProps {
  shape: DalgonaShape;
  onProgress: (progress: number, cracks: number, failed: boolean, completed: boolean) => void;
}

interface Pt {
  x: number;
  y: number;
}

function buildShapePoints(shape: DalgonaShape, cx: number, cy: number, r: number): Pt[] {
  const pts: Pt[] = [];
  if (shape === 'circle') {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  } else if (shape === 'triangle') {
    const verts = [
      { x: cx, y: cy - r * 1.05 },
      { x: cx + r * 0.95, y: cy + r * 0.8 },
      { x: cx - r * 0.95, y: cy + r * 0.8 },
    ];
    for (let v = 0; v < 3; v++) {
      const a = verts[v];
      const b = verts[(v + 1) % 3];
      for (let s = 0; s < 14; s++) {
        const t = s / 14;
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  } else if (shape === 'star') {
    const verts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? r * 1.05 : r * 0.48;
      verts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad });
    }
    for (let v = 0; v < verts.length; v++) {
      const a = verts[v];
      const b = verts[(v + 1) % verts.length];
      for (let s = 0; s < 5; s++) {
        const t = s / 5;
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  } else {
    // Umbrella dome + handle
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI + (i / 24) * Math.PI;
      pts.push({ x: cx + Math.cos(a) * r, y: cy - r * 0.1 + Math.sin(a) * r * 0.85 });
    }
    for (let s = 0; s < 12; s++) {
      pts.push({ x: cx, y: cy - r * 0.1 + (s / 12) * r * 1.15 });
    }
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      pts.push({ x: cx - r * 0.18 + Math.cos(a) * r * 0.18, y: cy + r * 0.98 + Math.sin(a) * r * 0.18 });
    }
  }
  return pts;
}

export const DalgonaModalOverlay: React.FC<DalgonaModalOverlayProps> = ({ shape, onProgress }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visitedRef = useRef<Set<number>>(new Set());
  const cracksRef = useRef(0);
  const finishedRef = useRef(false);
  const pointsRef = useRef<Pt[]>([]);
  const draggingRef = useRef(false);
  const [pct, setPct] = useState(0);
  const [cracksPct, setCracksPct] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Metallic Tin + Golden Dalgona Honeycomb Disc
    ctx.fillStyle = '#d4d4d8';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 134, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(w / 2 - 20, h / 2 - 25, 16, w / 2, h / 2, 118);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.75, '#d97706');
    grad.addColorStop(1, '#92400e');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 118, 0, Math.PI * 2);
    ctx.fill();

    // Target outline guide
    const pts = pointsRef.current;
    if (pts.length > 0) {
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.85)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      if (shape !== 'umbrella') ctx.closePath();
      ctx.stroke();

      // Carved bright highlight dots
      ctx.fillStyle = '#fef08a';
      visitedRef.current.forEach((idx) => {
        const p = pts[idx];
        if (!p) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [shape]);

  useEffect(() => {
    visitedRef.current.clear();
    cracksRef.current = 0;
    finishedRef.current = false;
    pointsRef.current = buildShapePoints(shape, 150, 150, 74);
    setPct(0);
    setCracksPct(0);
    redraw();
  }, [shape, redraw]);

  const handleTrace = (clientX: number, clientY: number) => {
    if (finishedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    const pts = pointsRef.current;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(x - pts[i].x, y - pts[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestDist <= 20 && bestIdx >= 0) {
      if (!visitedRef.current.has(bestIdx)) {
        visitedRef.current.add(bestIdx);
        robloxAudio.playClick();
      }
    } else if (Math.hypot(x - 150, y - 150) < 118) {
      cracksRef.current = Math.min(100, cracksRef.current + 4.5);
    }

    const progress = Math.min(100, Math.round((visitedRef.current.size / Math.max(1, pts.length * 0.85)) * 100));
    const cracks = Math.round(cracksRef.current);
    setPct(progress);
    setCracksPct(cracks);
    redraw();

    if (cracks >= 100) {
      finishedRef.current = true;
      onProgress(progress, cracks, true, false);
    } else if (progress >= 100) {
      finishedRef.current = true;
      onProgress(100, cracks, false, true);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
      <div className="w-full max-w-sm rounded-3xl bg-[#111827] border border-amber-400/40 p-4 text-slate-100 shadow-2xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black tracking-wide text-amber-400 uppercase">
              Dalgona Candy · {shape.toUpperCase()}
            </p>
            <p className="text-[11px] text-slate-300">
              আঙুল বা মাউস টেনে দাগের ওপর দিয়ে সাবধানে খোদাই করুন!
            </p>
          </div>
          <span className="text-xs font-black text-emerald-400">{pct}%</span>
        </div>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            onPointerDown={(e) => {
              draggingRef.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              handleTrace(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (draggingRef.current) handleTrace(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            className="w-[260px] h-[260px] rounded-2xl bg-[#1f2937] border border-white/10 touch-none cursor-crosshair"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-emerald-400">খোদাই সম্পন্ন: {pct}%</span>
            <span className={cracksPct > 60 ? 'text-rose-400' : 'text-amber-300'}>
              ফাটল ঝুঁকি: {cracksPct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${cracksPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
