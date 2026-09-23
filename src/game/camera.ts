/**
 * Câmera do jogador: olhos interpolados, balanço ao andar (view bobbing do original),
 * modificador de FOV (corrida/voo) e terceira pessoa (F5) com recuo por colisão.
 */
import type { Player } from './player/player';
import { raycastBlocks } from './raycast';
import type { World } from '../world/world';

export interface CameraState {
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number; // radianos (Three: yaw = π − yawOriginal)
  fov: number;
  bobPhase: number;
  bobAmount: number;
  thirdPerson: 0 | 1 | 2;
}

export function playerCamera(p: Player, world: World, alpha: number, baseFov: number, bobbing: boolean, mode: 0 | 1 | 2, yawDeg: number, pitchDeg: number): CameraState {
  const x = p.prevX + (p.x - p.prevX) * alpha;
  const y = p.prevY + (p.y - p.prevY) * alpha + (p.prevEyeY + (p.eyeY - p.prevEyeY) * alpha);
  const z = p.prevZ + (p.z - p.prevZ) * alpha;
  let cx = x, cy = y, cz = z;
  let yaw = yawDeg, pitch = pitchDeg;
  // balanço ao andar
  const walk = p.prevWalkDist + (p.walkDist - p.prevWalkDist) * alpha;
  const speed = Math.min(1, Math.hypot(p.x - p.prevX, p.z - p.prevZ) * 4);
  const bobAmount = bobbing && p.onGround && !p.flying ? speed * 0.8 : 0;
  let roll = 0;
  if (mode === 0 && bobbing && bobAmount > 0) {
    const ph = walk * Math.PI;
    // desloca a câmera de lado e para cima (translação) e inclina levemente
    const sx = Math.sin(ph) * bobAmount * 0.06, sy = -Math.abs(Math.cos(ph) * bobAmount) * 0.1;
    const yr = (yawDeg * Math.PI) / 180;
    cx += Math.cos(yr) * sx; cz += Math.sin(yr) * sx; cy += sy;
    roll = Math.sin(ph) * bobAmount * 0.012;
    pitch += Math.abs(Math.cos(ph - 0.2) * bobAmount) * 1.5;
  }
  if (mode !== 0) {
    // terceira pessoa: 4 blocos atrás (ou à frente, olhando para o jogador)
    const yr = (yawDeg * Math.PI) / 180, pr = (pitchDeg * Math.PI) / 180;
    let dx = -Math.sin(yr) * Math.cos(pr), dy = -Math.sin(pr), dz = Math.cos(yr) * Math.cos(pr);
    if (mode === 1) { dx = -dx; dy = -dy; dz = -dz; }
    let dist = 4;
    const hit = raycastBlocks(world, x, y, z, dx, dy, dz, 4.2);
    if (hit) dist = Math.max(0.5, hit.dist - 0.25);
    cx = x + dx * dist; cy = y + dy * dist; cz = z + dz * dist;
    if (mode === 2) { yaw = yawDeg + 180; pitch = -pitchDeg; }
  }
  const fovMod = p.prevFovMod + (p.fovMod - p.prevFovMod) * alpha;
  return {
    x: cx, y: cy, z: cz,
    yaw: Math.PI - (yaw * Math.PI) / 180,
    pitch: (-pitch * Math.PI) / 180,
    roll,
    fov: baseFov * fovMod,
    bobPhase: walk, bobAmount, thirdPerson: mode,
  };
}
