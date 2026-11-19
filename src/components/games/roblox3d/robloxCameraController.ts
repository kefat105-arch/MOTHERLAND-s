import * as THREE from 'three';

export interface RobloxCameraState {
  yaw: number;
  pitch: number;
  targetDistance: number;
  currentDistance: number;
  isFirstPerson: boolean;
  zoomPercent: number;
}

const _camTarget = new THREE.Vector3();
const _lookPoint = new THREE.Vector3();

export class RobloxCameraController {
  public yaw = Math.PI;
  public pitch = 0.28;
  public targetDistance = 9.2;
  public currentDistance = 9.2;

  private readonly minDistance = 0;
  private readonly maxDistance = 20;
  private readonly firstPersonThreshold = 0.95;

  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchSpan: number | null = null;
  private lookPointerId: number | null = null;
  private domEl: HTMLElement | null = null;

  public attach(el: HTMLElement): () => void {
    this.domEl = el;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Gentle controlled scroll zoom step
      this.stepZoom(THREE.MathUtils.clamp(e.deltaY * 0.0075, -1.6, 1.6));
    };

    const onPointerDown = (e: PointerEvent) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activePointers.size === 1 && this.lookPointerId === null) {
        this.lookPointerId = e.pointerId;
      } else if (this.activePointers.size >= 2) {
        this.lookPointerId = null; // Prevent camera jump during 2-finger pinch!
        this.lastPinchSpan = this.computePinchSpan();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = this.activePointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size >= 2) {
        const span = this.computePinchSpan();
        if (this.lastPinchSpan !== null && span !== null) {
          const delta = span - this.lastPinchSpan;
          // Deadband of 2.5px prevents accidental brush-zooming; smooth deliberate -0.014 multiplier
          if (Math.abs(delta) > 2.5) {
            this.stepZoom(-delta * 0.014);
            this.lastPinchSpan = span;
          }
        } else {
          this.lastPinchSpan = span;
        }
      } else if (e.pointerId === this.lookPointerId) {
        this.rotateBy(dx, dy);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
      if (this.lookPointerId === e.pointerId) {
        this.lookPointerId = null;
      }
      if (this.activePointers.size < 2) {
        this.lastPinchSpan = null;
      }
    };

    const onBlurOrCancel = () => {
      this.activePointers.clear();
      this.lookPointerId = null;
      this.lastPinchSpan = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onBlurOrCancel);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onBlurOrCancel);
      this.activePointers.clear();
      this.domEl = null;
    };
  }

  private computePinchSpan(): number | null {
    if (this.activePointers.size < 2) return null;
    const pts = Array.from(this.activePointers.values());
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  public rotateBy(dx: number, dy: number): void {
    const sens = this.isFirstPerson() ? 0.0044 : 0.0052;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * sens, -0.55, 1.15);
  }

  public stepZoom(deltaDistance: number): void {
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + deltaDistance,
      this.minDistance,
      this.maxDistance
    );
  }

  public setFirstPerson(enable: boolean): void {
    this.targetDistance = enable ? 0 : 9.2;
    if (enable) {
      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.45, 0.55);
    }
  }

  public toggleMode(): boolean {
    const nextFp = !this.isFirstPerson();
    this.setFirstPerson(nextFp);
    return nextFp;
  }

  public isFirstPerson(): boolean {
    return this.currentDistance < this.firstPersonThreshold;
  }

  public getState(): RobloxCameraState {
    const fp = this.isFirstPerson();
    const zoomPercent = Math.round(
      (1 - (this.currentDistance - this.minDistance) / (this.maxDistance - this.minDistance)) * 100
    );
    return {
      yaw: this.yaw,
      pitch: this.pitch,
      targetDistance: this.targetDistance,
      currentDistance: this.currentDistance,
      isFirstPerson: fp,
      zoomPercent,
    };
  }

  public updateCamera(
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    eyeHeight: number,
    groundHeightAt: (x: number, z: number) => number,
    dt: number,
    shakeOffset?: THREE.Vector3
  ): boolean {
    // Deliberate, smooth damping (6.5) prevents jarring snaps!
    this.currentDistance = THREE.MathUtils.damp(this.currentDistance, this.targetDistance, 6.5, dt);
    const isFp = this.isFirstPerson();

    const eyeX = playerPos.x;
    const eyeY = playerPos.y + eyeHeight;
    const eyeZ = playerPos.z;

    if (isFp) {
      camera.position.set(eyeX, eyeY, eyeZ);
      if (shakeOffset) camera.position.add(shakeOffset);
      const cosP = Math.cos(this.pitch);
      _lookPoint.set(
        eyeX + Math.sin(this.yaw) * cosP * 10,
        eyeY - Math.sin(this.pitch) * 10,
        eyeZ + Math.cos(this.yaw) * cosP * 10
      );
      camera.lookAt(_lookPoint);
    } else {
      const cosP = Math.cos(this.pitch);
      const sinP = Math.sin(this.pitch);
      const camX = eyeX - Math.sin(this.yaw) * cosP * this.currentDistance;
      const camZ = eyeZ - Math.cos(this.yaw) * cosP * this.currentDistance;
      const rawCamY = eyeY + sinP * this.currentDistance + 0.35;
      const floorY = groundHeightAt(camX, camZ);
      const clampedY = Math.max(floorY + 0.55, rawCamY);

      _camTarget.set(camX, clampedY, camZ);
      if (shakeOffset) _camTarget.add(shakeOffset);
      camera.position.copy(_camTarget);
      _lookPoint.set(eyeX, eyeY - 0.15, eyeZ);
      camera.lookAt(_lookPoint);
    }

    if (this.domEl) {
      this.domEl.dataset.cameraMode = isFp ? '1P' : '3P';
    }
    return isFp;
  }
}
