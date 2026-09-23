/**
 * Mão em primeira pessoa e item segurado: animação de golpe (como o original), troca de item
 * (desce e sobe), balanço ao andar e atraso suave ao virar a câmera.
 */
import * as THREE from 'three';
import { S } from '../world/blocks';
import { item } from '../game/items/registry';
import type { ItemStack } from '../game/items/stack';
import { blockGeometry, itemTint } from './entities/blockmesh';
import { blockMaterial, skinMaterial } from './entities/shared';

function armTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 24;
  const g = c.getContext('2d')!;
  // manga (jaqueta verde-oliva com costura) e mão
  g.fillStyle = '#4f6b3a'; g.fillRect(0, 0, 8, 10);
  g.fillStyle = '#5d7a45'; g.fillRect(0, 0, 8, 2);
  g.fillStyle = '#3f5530'; g.fillRect(0, 9, 8, 1);
  g.fillStyle = '#c8905e'; g.fillRect(0, 10, 8, 14);
  g.fillStyle = '#b77f50'; g.fillRect(0, 20, 8, 4);
  g.fillStyle = '#d6a070'; g.fillRect(1, 11, 2, 8);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class HandRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  private readonly root = new THREE.Group();
  private readonly arm: THREE.Mesh;
  private readonly armMat: THREE.ShaderMaterial;
  private held: THREE.Object3D | null = null;
  private heldKey = '';
  private heldMats: THREE.ShaderMaterial[] = [];
  /** 0..1 progresso de "equipar" (troca de item) */
  private equip = 1;
  private lastYaw = 0;
  private lastPitch = 0;
  private swayX = 0;
  private swayY = 0;
  itemSprite?: (id: string) => THREE.Object3D;

  constructor() {
    this.armMat = skinMaterial(armTexture());
    const g = new THREE.BoxGeometry(0.25, 0.75, 0.25);
    g.translate(0, -0.3, 0);
    this.arm = new THREE.Mesh(g, this.armMat);
    this.root.add(this.arm);
    this.scene.add(this.root);
  }

  private setHeld(st: ItemStack | null): void {
    const key = st ? st.id : '';
    if (key === this.heldKey) return;
    this.heldKey = key;
    this.equip = 0;
    if (this.held) { this.root.remove(this.held); this.held = null; }
    this.heldMats = [];
    if (!st) return;
    const def = item(st.id);
    if (def?.block) {
      const state = S(def.block);
      const m = blockMaterial();
      m.uniforms.uTint.value = itemTint(state);
      const mesh = new THREE.Mesh(blockGeometry(state), m);
      mesh.scale.setScalar(0.4);
      this.held = mesh;
      this.heldMats.push(m);
    } else if (this.itemSprite) {
      const s = this.itemSprite(st.id);
      s.scale.setScalar(0.7);
      this.held = s;
      s.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (mm?.uniforms?.uLight) this.heldMats.push(mm); });
    }
    if (this.held) this.root.add(this.held);
  }

  /**
   * @param swing 0..1 progresso do golpe
   * @param bob distância andada (para o balanço)
   */
  update(held: ItemStack | null, swing: number, walkBob: number, bobAmount: number, yaw: number, pitch: number, aspect: number, light: [number, number], dt: number): void {
    this.setHeld(held);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.equip = Math.min(1, this.equip + dt * 6);
    // atraso ao virar
    const dyaw = ((yaw - this.lastYaw + 540) % 360) - 180;
    this.swayX += (dyaw * 0.004 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += ((pitch - this.lastPitch) * 0.004 - this.swayY) * Math.min(1, dt * 10);
    this.lastYaw = yaw; this.lastPitch = pitch;
    const s = Math.sqrt(swing);
    const sp = Math.sin(s * Math.PI), sp2 = Math.sin(s * Math.PI * 2), sw = Math.sin(swing * Math.PI);
    const bobX = Math.sin(walkBob * Math.PI) * bobAmount * 0.5;
    const bobY = -Math.abs(Math.cos(walkBob * Math.PI) * bobAmount);
    const lower = (1 - this.equip) * -0.6;
    this.root.position.set(0.56 - sp * 0.4 + bobX + this.swayX, -0.52 + sp2 * 0.2 + lower + bobY - this.swayY, -0.72 - sw * 0.2);
    this.root.rotation.set(0, 0, 0);
    this.root.rotateY(-sw * 0.35);
    this.root.rotateX(-sp * 0.9);
    if (this.held) {
      this.arm.visible = !item(held?.id ?? '')?.block ? false : false;
      this.arm.visible = false;
      this.held.position.set(0, 0, 0);
      this.held.rotation.set(0, Math.PI / 4, 0);
      if (!item(held?.id ?? '')?.block) this.held.rotation.set(0, -Math.PI / 2 + 0.3, 0.3);
    } else {
      this.arm.visible = true;
      this.arm.position.set(0.1, 0.05, 0.05);
      this.arm.rotation.set(Math.PI * 0.42, 0.2, -0.3);
    }
    for (const m of [this.armMat, ...this.heldMats]) m.uniforms.uLight.value.set(light[0], light[1]);
  }
}
