/**
 * Visual dos projéteis: flecha e arpão (modelos de caixas orientados pela velocidade), bolas de fogo
 * (cubo incandescente girando) e arremessáveis (ícone do item virado para a câmera).
 */
import * as THREE from 'three';
import type { Entity } from '../../game/entity/entity';
import type { EntityRenderer, EntityVisual } from './entityrenderer';
import { instantiate, type ModelDef } from './models/boxmodel';
import type { Arrow, Throwable, Fireball } from '../../game/entity/projectiles';

const ARROW: ModelDef = {
  id: 'proj_arrow',
  parts: [{
    name: 'arrow', pivot: [0, 0, 0],
    cubes: [
      { id: 'shaft', o: [-0.5, -0.5, -8], s: [1, 1, 14] },
      { id: 'tip', o: [-1, -1, 6], s: [2, 2, 3] },
      { id: 'fx', o: [-2, 0, -8], s: [4, 0, 5] },
      { id: 'fy', o: [0, -2, -8], s: [0, 4, 5] },
    ],
  }],
  paint(sk) {
    sk.cube('shaft', (g) => g.noise(0x8a6a44, 0.1));
    sk.cube('tip', (g) => g.vgrad(0xc9ccd1, 0x6d7278, 0.05));
    for (const id of ['fx', 'fy']) sk.cube(id, (g) => { g.fill(0xf1ede2); g.rect(0, 0, g.w, 1, 0xb33a2e); for (let y = 2; y < g.h; y += 3) g.clear(0, y, 1, 1); });
  },
};

const HARPOON: ModelDef = {
  id: 'proj_harpoon',
  parts: [{
    name: 'h', pivot: [0, 0, 0],
    cubes: [
      { id: 'shaft', o: [-0.5, -0.5, -14], s: [1, 1, 24] },
      { id: 'p1', o: [-2.5, -0.5, 8], s: [1, 1, 5] },
      { id: 'p2', o: [1.5, -0.5, 8], s: [1, 1, 5] },
      { id: 'p3', o: [-0.5, -0.5, 10], s: [1, 1, 5] },
      { id: 'bar', o: [-2.5, -0.5, 8], s: [5, 1, 1] },
    ],
  }],
  paint(sk) {
    sk.cube('shaft', (g) => g.noise(0x4f6f6a, 0.12));
    for (const id of ['p1', 'p2', 'p3', 'bar']) sk.cube(id, (g) => g.vgrad(0x9fd8cf, 0x3f7f78, 0.05));
  },
};

function fireballDef(big: boolean): ModelDef {
  const n = big ? 14 : 5;
  return {
    id: big ? 'proj_fireball_big' : 'proj_fireball',
    parts: [{ name: 'f', pivot: [0, n / 2, 0], cubes: [{ id: 'core', o: [-n / 2, 0, -n / 2], s: [n, n, n], emissive: 1 }] }],
    paint(sk) {
      sk.cube('core', (g) => {
        g.noise(0xf08a24, 0.2);
        g.spots(0xffe27a, Math.max(2, g.w), 0.6, 1.6);
        g.spots(0x9e2a12, Math.max(1, g.w / 2), 0.5, 1.2);
      });
    },
  };
}
const FB_SMALL = fireballDef(false), FB_BIG = fireballDef(true);

const lerpDeg = (a: number, b: number, t: number) => { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d * t; };

export function registerProjectileVisuals(r: EntityRenderer): void {
  const oriented = (def: ModelDef) => (e: Entity): EntityVisual => {
    const inst = instantiate(def);
    return {
      obj: inst.root,
      mats: inst.mats,
      update(ent: Entity, alpha: number) {
        const a = ent as Arrow;
        const yaw = lerpDeg(a.prevYaw, a.yaw, alpha) * Math.PI / 180;
        const pitch = (a.prevPitch + (a.pitch - a.prevPitch) * alpha) * Math.PI / 180;
        const shake = a.shake > 0 ? Math.sin((a.shake - alpha) * 3) * (a.shake - alpha) * 0.05 : 0;
        inst.body.rotation.set(-pitch + shake, yaw, 0, 'YXZ');
        inst.body.position.set(0, ent.height / 2, 0);
      },
    };
  };
  r.register('arrow', oriented(ARROW));
  r.register('harpoon', oriented(HARPOON));
  r.register('fireball', (e: Entity): EntityVisual => {
    const f = e as Fireball;
    const inst = instantiate(f.big ? FB_BIG : FB_SMALL);
    return {
      obj: inst.root, mats: inst.mats,
      update(ent: Entity, alpha: number) {
        const t = ent.age + alpha;
        inst.body.rotation.set(t * 0.2, t * 0.31, t * 0.13);
        inst.body.position.set(0, ent.height / 2 - (f.big ? 7 : 2.5) / 16, 0);
      },
    };
  });
  r.register('throwable', (e: Entity): EntityVisual | null => {
    const t = e as Throwable;
    if (!r.itemSprite) return null;
    const g = new THREE.Group();
    const s = r.itemSprite(t.item.id);
    s.scale.setScalar(0.5);
    g.add(s);
    const mats: THREE.ShaderMaterial[] = [];
    s.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (m?.uniforms?.uLight) mats.push(m); });
    return {
      obj: g, mats,
      update() {
        // a cena é relativa à câmera: a câmera está na origem
        g.lookAt(0, 0, 0);
        s.position.set(0, 0.1, 0);
      },
    };
  });
}
