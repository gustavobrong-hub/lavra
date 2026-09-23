/**
 * Galeria de criaturas para conferir modelos e peles com o renderizador real:
 * `?gallery=cow,sheep@color=black,horse@coat=preto@walk` monta uma plataforma no céu ao meio-dia,
 * põe as criaturas em fila (IA desligada) e expõe `__gallery.view(i)` para trocar o ângulo da câmera.
 */
import type { Game } from '../game/game';
import { spawnMob } from '../game/entity/registry';
import type { Mob } from '../game/entity/mob';
import { S } from '../world/blocks';

export interface GalleryApi { view(i: number): void; mobs: Mob[] }

export function setupGallery(game: Game, spec: string, zoom = 1): GalleryApi {
  const L = game.level;
  L.rules.doMobSpawning = false;
  L.rules.doDaylightCycle = false;
  L.dayTime = 6000;
  const p = game.player;
  p.setGameMode('spectator');
  const bx = Math.floor(p.x), bz = Math.floor(p.z), y = 150;
  // some com as criaturas da geração por perto
  for (const e of [...L.entities.list]) if (e !== p) e.removed = true;
  const entries = spec.split(',').filter(Boolean);
  const mobs: Mob[] = [];
  let x = 0;
  const gap = 1.2;
  const placed: [Mob, number][] = [];
  for (const en of entries) {
    const [type, ...mods] = en.split('@');
    const baby = mods.includes('baby');
    const m = spawnMob(L, type, 0, y + 1, 0, { reason: 'command', yaw: 0, baby });
    if (!m) continue;
    for (const mod of mods) {
      const [k, v] = mod.split('=');
      if (v === undefined) continue;
      const cur = (m as unknown as Record<string, unknown>)[k];
      (m as unknown as Record<string, unknown>)[k] = typeof cur === 'number' ? Number(v) : typeof cur === 'boolean' ? v === 'true' : v;
    }
    if (mods.includes('walk')) (m as Mob & { galleryWalk?: boolean }).galleryWalk = true;
    const w = Math.max(m.width, 0.6);
    x += w / 2;
    placed.push([m, x]);
    x += w / 2 + gap;
    mobs.push(m);
  }
  const total = x - gap;
  const x0 = bx - total / 2;
  // plataforma
  const grass = S('grass_block'), stone = S('stone');
  const half = Math.ceil(total / 2) + 4;
  for (let dx = -half; dx <= half; dx++) for (let dz = -6; dz <= 6; dz++) {
    L.world.setBlock(bx + dx, y, bz + dz, Math.abs(dz) === 6 || Math.abs(dx) === half ? stone : grass);
  }
  for (const [m, px] of placed) {
    m.setPos(x0 + px, y + 1, bz + 0.5);
    m.yaw = m.bodyYaw = m.yawHead = 0;
    m.prevBodyYaw = m.prevYawHead = 0;
    m.goals.entries.length = 0;
    m.targets.entries.length = 0;
    m.persistent = true;
    m.noGravity = false;
  }
  // as criaturas giram (a câmera fica de frente); caminhada no lugar; sem dano nem fogo
  let mobYaw = 0;
  const orig = L.entities.tick.bind(L.entities);
  L.entities.tick = (f) => {
    orig(f);
    for (const m of mobs) {
      m.x = m.prevX; m.z = m.prevZ; m.vx = 0; m.vz = 0;
      if ((m as Mob & { galleryWalk?: boolean }).galleryWalk) { m.limbSwingAmount = 0.5; m.prevLimbSwingAmount = 0.5; m.limbSwing += 0.5; }
      m.yaw = m.bodyYaw = m.yawHead = m.prevBodyYaw = m.prevYawHead = mobYaw;
      m.fireTicks = 0; m.hurtTime = 0; m.health = m.maxHealth; m.dead = false;
    }
  };
  const cx = bx, cz = bz + 0.5;
  const dist = Math.max(4, total * 0.5 + 2.5) / zoom;
  // [giro das criaturas, altura da câmera, inclinação]
  const views: [number, number, number][] = [[-30, 2.0, 16], [0, 1.4, 8], [90, 1.4, 8], [180, 1.8, 12], [-30, dist * 0.8, 48]];
  const api: GalleryApi = {
    mobs,
    view(i: number) {
      const v = views[i % views.length];
      mobYaw = v[0];
      for (const m of mobs) m.yaw = m.bodyYaw = m.yawHead = m.prevBodyYaw = m.prevYawHead = mobYaw;
      p.setPos(cx, y + 1 + v[1] - 1.62, cz + dist);
      game.yaw = 180; game.pitch = v[2];
    },
  };
  api.view(0);
  game.hud.setVisible(false);
  game.hideHand = true;
  return api;
}
