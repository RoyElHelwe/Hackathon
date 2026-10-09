import type * as Three from 'three';

/** The clips baked into /arzino/arzino-3d.glb (see DECISIONS.md "3D Arzino"). */
export type ArzinoAnim = 'Idle' | 'Walk' | 'Run' | 'Sit' | 'Wave' | 'Celebrate' | 'Disappointed';
const LOOPING: ReadonlySet<ArzinoAnim> = new Set(['Idle', 'Walk', 'Run']);
/** states (not one-shots) whose clip plays once and holds its last frame: Sit sits down, then stays seated */
const HOLD: ReadonlySet<ArzinoAnim> = new Set(['Sit']);

/** Where and how one character is drawn this frame, in canvas pixels (feet position). */
export interface CharView {
  x: number;
  y: number;
  /** on-screen height in px */
  size: number;
  /** radians; 0 = facing the viewer (screen down), π/2 = screen right */
  facing: number;
  /** looping animation for the current state */
  base: ArzinoAnim;
}

interface Assets {
  THREE: typeof Three;
  model: Three.Object3D;
  clips: Three.AnimationClip[];
  clone: (o: Three.Object3D) => Three.Object3D;
  height: number;
}

let assets: Promise<Assets> | null = null;

/** Loads three.js and the model once per page session (shared by every canvas). */
function loadAssets(): Promise<Assets> {
  assets ??= (async () => {
    const [THREE, { GLTFLoader }, SkeletonUtils] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/utils/SkeletonUtils.js'),
    ]);
    const gltf = await new GLTFLoader().loadAsync('/arzino/arzino-3d.glb');
    const model = gltf.scene;
    const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y || 1;
    return { THREE, model, clips: gltf.animations, clone: (o) => SkeletonUtils.clone(o), height };
  })();
  assets.catch(() => (assets = null));
  return assets;
}

interface Char {
  root: Three.Group;
  turn: Three.Group;
  mixer: Three.AnimationMixer;
  actions: Map<ArzinoAnim, Three.AnimationAction>;
  current: Three.AnimationAction | null;
  base: ArzinoAnim;
  /** a one-shot (wave, celebrate…) is playing; the base resumes when it ends */
  oneShot: boolean;
  facing: number;
  frame: number;
}

const TILT = 0.42; // tip the top toward the viewer: the map is seen from above at an angle
const FADE = 0.22;

/**
 * Live 3D Arzinos drawn on a transparent canvas laid over the 2D Phaser campus. Phaser stays the source of truth
 * for positions, collisions, labels and bubbles; every frame the scene tells this layer where each character's feet
 * are on screen, which way it faces and what it is doing.
 */
export class ArzinoLayer {
  private renderer: Three.WebGLRenderer;
  private scene: Three.Scene;
  private camera: Three.OrthographicCamera;
  private chars = new Map<string, Char>();
  private frameNo = 0;
  private w = 0;
  private h = 0;

  private constructor(
    private a: Assets,
    private canvas: HTMLCanvasElement,
    dark: boolean,
  ) {
    const { THREE } = a;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x1d3a30 : 0x9cc8ae, dark ? 1.5 : 2.1));
    const sun = new THREE.DirectionalLight(dark ? 0xcfe3ff : 0xfff6e8, dark ? 1.2 : 1.7);
    sun.position.set(-0.5, 1, 1.2);
    this.scene.add(sun);
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -6000, 6000);
  }

  /** null when WebGL or the model is unavailable — the scene then keeps its 2D avatars. */
  static async create(parent: HTMLElement, dark: boolean): Promise<ArzinoLayer | null> {
    try {
      const a = await loadAssets();
      const canvas = document.createElement('canvas');
      canvas.className = 'pointer-events-none absolute inset-0 block size-full';
      canvas.setAttribute('aria-hidden', 'true');
      parent.appendChild(canvas);
      try {
        return new ArzinoLayer(a, canvas, dark);
      } catch {
        canvas.remove();
        return null;
      }
    } catch {
      return null;
    }
  }

  private make(): Char {
    const { THREE } = this.a;
    const model = this.a.clone(this.a.model);
    model.traverse((o) => {
      // skinned bounds don't follow the animation; we cull by screen position ourselves
      o.frustumCulled = false;
    });
    const turn = new THREE.Group();
    turn.add(model);
    const root = new THREE.Group();
    root.rotation.x = TILT;
    root.add(turn);
    this.scene.add(root);
    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map<ArzinoAnim, Three.AnimationAction>();
    for (const clip of this.a.clips) {
      const action = mixer.clipAction(clip);
      if (!LOOPING.has(clip.name as ArzinoAnim)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions.set(clip.name as ArzinoAnim, action);
    }
    const c: Char = { root, turn, mixer, actions, current: null, base: 'Idle', oneShot: false, facing: 0, frame: 0 };
    mixer.addEventListener('finished', (e) => {
      if (HOLD.has((e.action as Three.AnimationAction).getClip().name as ArzinoAnim)) return;
      c.oneShot = false;
      this.fade(c, c.base);
    });
    this.fade(c, 'Idle');
    return c;
  }

  private fade(c: Char, anim: ArzinoAnim) {
    const next = c.actions.get(anim);
    if (!next || next === c.current) return;
    next.reset().setEffectiveWeight(1).play();
    if (c.current) c.current.crossFadeTo(next, FADE, false);
    // vary the idle start so a crowd doesn't breathe in sync
    if (anim === 'Idle' && !c.current) next.time = Math.random() * next.getClip().duration;
    c.current = next;
  }

  /** Place one character for this frame (creates it on first use). */
  sync(id: string, v: CharView) {
    let c = this.chars.get(id);
    if (!c) {
      c = this.make();
      c.facing = v.facing;
      this.chars.set(id, c);
    }
    c.frame = this.frameNo;
    c.root.position.set(v.x, -v.y, v.y * 0.5);
    const s = v.size / this.a.height;
    c.root.scale.set(s, s, s);
    // turn the shortest way round
    let d = v.facing - c.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    c.facing += d * 0.25;
    c.turn.rotation.y = c.facing;
    if (v.base !== c.base) {
      c.base = v.base;
      // walking or running interrupts a one-shot; standing still lets it finish
      if (!c.oneShot || v.base === 'Walk' || v.base === 'Run') {
        c.oneShot = false;
        this.fade(c, v.base);
      }
    }
  }

  /** Wave, celebrate, look disappointed… then return to the looping state. */
  play(id: string, anim: ArzinoAnim) {
    const c = this.chars.get(id);
    if (!c) return;
    if (LOOPING.has(anim) || HOLD.has(anim)) return this.fade(c, anim);
    if (c.base === 'Walk' || c.base === 'Run') return; // no waving mid-stride
    c.oneShot = true;
    const a = c.actions.get(anim);
    if (a && a === c.current) a.reset().play();
    else this.fade(c, anim);
  }

  /** dev tooling: what each character is doing */
  debug() {
    return [...this.chars].map(([id, c]) => ({ id, base: c.base, oneShot: c.oneShot, playing: c.current?.getClip().name, visible: c.root.visible }));
  }

  remove(id: string) {
    const c = this.chars.get(id);
    if (!c) return;
    c.mixer.stopAllAction();
    this.scene.remove(c.root);
    this.chars.delete(id);
  }

  /** Draw the frame. Characters not synced since the last render are hidden (left the view or the room). */
  render(dtMs: number) {
    const el = this.canvas;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.renderer.setSize(w, h, false);
      Object.assign(this.camera, { left: 0, right: w, top: 0, bottom: -h });
      this.camera.updateProjectionMatrix();
    }
    const dt = Math.min(dtMs, 100) / 1000;
    for (const c of this.chars.values()) {
      const pad = c.root.scale.y * this.a.height;
      const visible = c.frame === this.frameNo && c.root.position.x > -pad && c.root.position.x < w + pad && -c.root.position.y > -pad && -c.root.position.y < h + pad * 1.5;
      c.root.visible = visible;
      if (visible) c.mixer.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
    this.frameNo++;
  }

  dispose() {
    for (const id of [...this.chars.keys()]) this.remove(id);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

/** Which one-shot an emote or reaction plays. 'sit' toggles sitting instead. */
export function animForEmoji(emoji: string): ArzinoAnim | 'sit' | null {
  if (emoji === '👋') return 'Wave';
  if (emoji === '😞') return 'Disappointed';
  if (emoji === '🪑') return 'sit';
  if (['😂', '💃', '🤯', '👏', '❤️', '🔥', '⭐', '🎉', '🙌', '👍', '💡'].includes(emoji)) return 'Celebrate';
  return null;
}

/** Facing angle for a screen-space direction (y grows downwards). */
export function facingFor(dx: number, dy: number) {
  return Math.atan2(dx, dy);
}

export const DIR_FACING = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 } as const;
