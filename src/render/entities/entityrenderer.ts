/**
 * Representação visual das entidades no Three: itens soltos (girando e flutuando), blocos caindo
 * e, via fábricas registradas, as criaturas. Tudo em coordenadas relativas à câmera.
 */
import * as THREE from 'three';
import type { Entity } from '../../game/entity/entity';
import { ItemEntity } from '../../game/entity/itementity';
import { FallingBlock } from '../../game/entity/fallingblock';
import { item } from '../../game/items/registry';
import { S } from '../../world/blocks';
import type { World } from '../../world/world';
import { blockGeometry, itemTint } from './blockmesh';
import { blockMaterial } from './shared';

export interface EntityVisual {
  obj: THREE.Object3D;
  mats: THREE.ShaderMaterial[];
  /** atualização por frame (animação); alpha = interpolação entre ticks */
  update?(e: Entity, alpha: number): void;
  dispose?(): void;
}

export type VisualFactory = (e: Entity) => EntityVisual | null;

export class EntityRenderer {
  readonly group = new THREE.Group();
  private readonly visuals = new Map<number, EntityVisual>();
  private readonly factories = new Map<string, VisualFactory>();
  /** ícone plano para itens que não são blocos */
  itemSprite?: (id: string) => THREE.Object3D;

  register(type: string, f: VisualFactory): void { this.factories.set(type, f); }

  private create(e: Entity): EntityVisual | null {
    const f = this.factories.get(e.type);
    if (f) return f(e);
    if (e instanceof ItemEntity) return this.itemVisual(e);
    if (e instanceof FallingBlock) {
      const m = blockMaterial();
      m.uniforms.uTint.value = itemTint(e.state);
      const mesh = new THREE.Mesh(blockGeometry(e.state), m);
      return { obj: mesh, mats: [m] };
    }
    return null;
  }

  private itemVisual(e: ItemEntity): EntityVisual {
    const g = new THREE.Group();
    const def = item(e.stack.id);
    const mats: THREE.ShaderMaterial[] = [];
    const copies = e.stack.count >= 49 ? 5 : e.stack.count >= 33 ? 4 : e.stack.count >= 17 ? 3 : e.stack.count >= 2 ? 2 : 1;
    if (def?.block) {
      const st = S(def.block);
      const m = blockMaterial();
      m.uniforms.uTint.value = itemTint(st);
      mats.push(m);
      for (let i = 0; i < copies; i++) {
        const mesh = new THREE.Mesh(blockGeometry(st), m);
        mesh.scale.setScalar(0.25);
        if (i > 0) mesh.position.set((Math.sin(i * 7.3) * 0.08), i * 0.03, (Math.cos(i * 5.1) * 0.08));
        g.add(mesh);
      }
    } else if (this.itemSprite) {
      for (let i = 0; i < copies; i++) {
        const s = this.itemSprite(e.stack.id);
        s.scale.setScalar(0.5);
        s.position.set(i * 0.03, i * 0.02, i * 0.04);
        g.add(s);
        s.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (mm?.uniforms?.uLight) mats.push(mm); });
      }
    }
    return {
      obj: g, mats,
      update: (ent, alpha) => {
        const ie = ent as ItemEntity;
        const t = ie.age + alpha;
        const bob = Math.sin(t / 10 + ie.bobOffset) * 0.1 + 0.1;
        g.children.forEach((c) => { c.position.y = (c.userData.baseY ??= c.position.y) + bob + 0.125; });
        g.rotation.y = t / 20 + ie.bobOffset;
      },
    };
  }

  /** Sincroniza com a lista de entidades (cria/remove visuais, atualiza transformações e luz). */
  sync(entities: readonly Entity[], alpha: number, camX: number, camY: number, camZ: number, world: World, skip?: Entity): void {
    const seen = new Set<number>();
    for (const e of entities) {
      if (e === skip || e.removed) continue;
      let v = this.visuals.get(e.id);
      if (!v) {
        const nv = this.create(e);
        if (!nv) continue;
        v = nv;
        this.visuals.set(e.id, v);
        this.group.add(v.obj);
      }
      seen.add(e.id);
      const x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha, z = e.prevZ + (e.z - e.prevZ) * alpha;
      // distância de renderização de entidades (64 blocos)
      const d2 = (x - camX) ** 2 + (y - camY) ** 2 + (z - camZ) ** 2;
      v.obj.visible = d2 < 96 * 96;
      if (!v.obj.visible) continue;
      v.obj.position.set(x - camX, y - camY, z - camZ);
      v.update?.(e, alpha);
      const raw = world.getLightRaw(Math.floor(x), Math.floor(y + e.height * 0.5), Math.floor(z));
      const sky = (raw >> 4) / 15, blk = (raw & 15) / 15;
      for (const m of v.mats) m.uniforms.uLight.value.set(sky, blk);
    }
    for (const [id, v] of this.visuals) {
      if (seen.has(id)) continue;
      this.group.remove(v.obj);
      v.dispose?.();
      this.visuals.delete(id);
    }
  }

  get count(): number { return this.visuals.size; }

  /** Descarta todos os visuais (recriados no próximo quadro — ex.: modelos novos carregados). */
  reset(): void {
    for (const v of this.visuals.values()) { this.group.remove(v.obj); v.dispose?.(); }
    this.visuals.clear();
  }
}
