/**
 * Visual das criaturas: instancia o modelo de caixas, aplica rotação do corpo, animação da espécie,
 * filhote (escala 0,5 com cabeça maior), vermelho de dano, tombo de morte (20 ticks), item na mão e fogo.
 */
import * as THREE from 'three';
import type { Entity } from '../../game/entity/entity';
import type { Mob } from '../../game/entity/mob';
import type { EntityRenderer, EntityVisual } from './entityrenderer';
import { instantiate, resetParts, type ModelDef, type AnimState, type ModelInstance } from './models/boxmodel';
import { blockGeometry, itemTint } from './blockmesh';
import { blockMaterial } from './shared';

export interface MobModelSpec {
  def: ModelDef;
  /** variante de pele a partir do estado da criatura */
  variant?(e: Mob): string;
  /** ajustes extras por frame (partes escondidas, sela, lã...) */
  pose?(inst: ModelInstance, e: Mob, s: AnimState): void;
  /** parte onde vai o item da mão (padrão: armR) */
  hand?: string;
  /** deslocamento do item na mão (pixels, relativo ao pivô da parte) */
  handOffset?: [number, number, number];
  /** escala do filhote (padrão 0,5) */
  babyScale?: number;
  /** multiplicador da cabeça do filhote */
  babyHead?: number;
  /** bloco carregado (estado; 0 = nenhum), desenhado na parte vazia `carry` do modelo */
  carryBlock?(e: Mob): number;
  /** disfarce: se devolver um estado ≠ 0, o modelo some e um bloco inteiro aparece no lugar */
  disguise?(e: Mob): number;
}

const lerpAngle = (a: number, b: number, t: number): number => {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return a + d * t;
};

export function registerMobVisuals(r: EntityRenderer, specs: Record<string, MobModelSpec>): void {
  for (const [type, spec] of Object.entries(specs)) r.register(type, (e) => mobVisual(e as Mob, spec, r));
}

function mobVisual(e: Mob, spec: MobModelSpec, r: EntityRenderer): EntityVisual {
  let variant = spec.variant?.(e) ?? '';
  const inst = instantiate(spec.def, variant);
  const mats = inst.mats;
  let handItem: THREE.Object3D | null = null;
  let handId = '';
  const headPart = inst.parts.head;
  // blocos auxiliares (carregado / disfarce)
  let carryMesh: THREE.Mesh | null = null, carryState = 0;
  let disguiseMesh: THREE.Mesh | null = null, disguiseState = 0;
  const blockMat = blockMaterial();
  mats.push(blockMat);
  const setBlockMesh = (mesh: THREE.Mesh | null, state: number): THREE.Mesh | null => {
    if (!state) { if (mesh) mesh.visible = false; return mesh; }
    if (!mesh) mesh = new THREE.Mesh(blockGeometry(state), blockMat);
    else mesh.geometry = blockGeometry(state);
    blockMat.uniforms.uTint.value = itemTint(state);
    mesh.visible = true;
    return mesh;
  };
  return {
    obj: inst.root,
    mats,
    update(ent: Entity, alpha: number) {
      const m = ent as Mob;
      const v = spec.variant?.(m) ?? '';
      if (v !== variant) { variant = v; inst.setVariant(v); }
      const bodyYaw = lerpAngle(m.prevBodyYaw, m.bodyYaw, alpha);
      const headYaw = lerpAngle(m.prevYawHead, m.yawHead, alpha);
      let rel = ((headYaw - bodyYaw) % 360 + 540) % 360 - 180;
      rel = Math.max(-75, Math.min(75, rel));
      inst.root.rotation.set(0, -bodyYaw * Math.PI / 180, 0);
      const s: AnimState = {
        e: m, t: m.age + alpha, alpha,
        swing: m.limbSwing - m.limbSwingAmount * (1 - alpha),
        amount: Math.min(1, m.prevLimbSwingAmount + (m.limbSwingAmount - m.prevLimbSwingAmount) * alpha),
        headYaw: rel, headPitch: m.prevPitch + (m.pitch - m.prevPitch) * alpha,
        attack: m.swinging || m.attackAnim > 0 ? Math.min(1, m.prevAttackAnim + (m.attackAnim - m.prevAttackAnim) * alpha) : 0,
      };
      if (m.dead) s.amount = 0;
      resetParts(inst.parts);
      for (const k in inst.parts) inst.parts[k].scale.setScalar(1);
      spec.def.animate?.(inst.parts, s);
      // filhote
      const baby = m.isBaby;
      const k = (baby ? spec.babyScale ?? 0.5 : 1) * (spec.def.scale ?? 1);
      inst.body.scale.setScalar(k);
      inst.body.position.set(0, 0, 0);
      if (headPart) headPart.scale.setScalar(baby ? spec.babyHead ?? 1.5 : 1);
      // vermelho de dano (a pose pode trocar, ex.: clarão branco do pavio)
      const hurt = m.hurtTime > 0 || m.dead;
      for (const mt of mats) mt.uniforms.uOverlay.value.set(1, 0.1, 0.1, hurt ? 0.45 : 0);
      spec.pose?.(inst, m, s);
      // bloco carregado
      const cs = spec.carryBlock?.(m) ?? 0;
      if (cs !== carryState || (cs && !carryMesh)) {
        carryState = cs;
        const anchor = inst.parts.carry;
        carryMesh = setBlockMesh(carryMesh, cs);
        if (carryMesh && anchor && carryMesh.parent !== anchor) { anchor.add(carryMesh); carryMesh.scale.setScalar(0.5); carryMesh.position.set(0, -0.25, 0); }
      }
      // disfarce de bloco
      const ds = spec.disguise?.(m) ?? 0;
      if (ds !== disguiseState) {
        disguiseState = ds;
        disguiseMesh = setBlockMesh(disguiseMesh, ds);
        if (disguiseMesh && disguiseMesh.parent !== inst.root) inst.root.add(disguiseMesh);
      }
      inst.body.visible = !ds;
      // morte: tomba para o lado
      if (m.dead) {
        let f = ((m.deathTime + alpha - 1) / 20) * 1.6;
        f = Math.sqrt(Math.max(0, f));
        inst.body.rotation.z = Math.min(1, f) * Math.PI / 2;
      } else inst.body.rotation.z = 0;
      // item na mão
      const hid = m.mainHand?.id ?? '';
      if (hid !== handId) {
        handId = hid;
        if (handItem) { handItem.parent?.remove(handItem); handItem = null; }
        const part = inst.parts[spec.hand ?? 'armR'];
        if (hid && part && r.itemSprite) {
          handItem = r.itemSprite(hid);
          const o = spec.handOffset ?? [-1, -10, 1];
          handItem.position.set(o[0] / 16, o[1] / 16, o[2] / 16);
          handItem.rotation.set(-Math.PI / 2, 0, Math.PI / 2 * 0);
          handItem.scale.setScalar(0.6);
          part.add(handItem);
          handItem.traverse((o2) => { const mm = (o2 as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (mm?.uniforms?.uLight && !mats.includes(mm)) mats.push(mm); });
        }
      }
    },
  };
}
