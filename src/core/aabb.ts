/** Caixa alinhada aos eixos, com as rotinas de colisão por eixo usadas pela física do original. */
export class AABB {
  constructor(
    public minX: number, public minY: number, public minZ: number,
    public maxX: number, public maxY: number, public maxZ: number,
  ) {}

  static fromCenter(x: number, y: number, z: number, halfW: number, h: number): AABB {
    return new AABB(x - halfW, y, z - halfW, x + halfW, y + h, z + halfW);
  }

  clone(): AABB {
    return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ);
  }

  set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): this {
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
    return this;
  }

  offset(dx: number, dy: number, dz: number): AABB {
    return new AABB(this.minX + dx, this.minY + dy, this.minZ + dz, this.maxX + dx, this.maxY + dy, this.maxZ + dz);
  }

  move(dx: number, dy: number, dz: number): this {
    this.minX += dx; this.minY += dy; this.minZ += dz;
    this.maxX += dx; this.maxY += dy; this.maxZ += dz;
    return this;
  }

  /** Expande na direção do movimento (para coletar caixas candidatas). */
  expandTowards(dx: number, dy: number, dz: number): AABB {
    return new AABB(
      dx < 0 ? this.minX + dx : this.minX, dy < 0 ? this.minY + dy : this.minY, dz < 0 ? this.minZ + dz : this.minZ,
      dx > 0 ? this.maxX + dx : this.maxX, dy > 0 ? this.maxY + dy : this.maxY, dz > 0 ? this.maxZ + dz : this.maxZ,
    );
  }

  inflate(x: number, y = x, z = x): AABB {
    return new AABB(this.minX - x, this.minY - y, this.minZ - z, this.maxX + x, this.maxY + y, this.maxZ + z);
  }

  intersects(o: AABB): boolean {
    return this.minX < o.maxX && this.maxX > o.minX && this.minY < o.maxY && this.maxY > o.minY && this.minZ < o.maxZ && this.maxZ > o.minZ;
  }

  intersectsRaw(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    return this.minX < maxX && this.maxX > minX && this.minY < maxY && this.maxY > minY && this.minZ < maxZ && this.maxZ > minZ;
  }

  contains(x: number, y: number, z: number): boolean {
    return x >= this.minX && x < this.maxX && y >= this.minY && y < this.maxY && z >= this.minZ && z < this.maxZ;
  }

  /** Quanto este box (parado) permite `other` andar em X sem atravessá-lo. */
  clipX(other: AABB, dx: number): number {
    if (other.maxY <= this.minY || other.minY >= this.maxY || other.maxZ <= this.minZ || other.minZ >= this.maxZ) return dx;
    if (dx > 0 && other.maxX <= this.minX) {
      const d = this.minX - other.maxX;
      if (d < dx) dx = d;
    } else if (dx < 0 && other.minX >= this.maxX) {
      const d = this.maxX - other.minX;
      if (d > dx) dx = d;
    }
    return dx;
  }

  clipY(other: AABB, dy: number): number {
    if (other.maxX <= this.minX || other.minX >= this.maxX || other.maxZ <= this.minZ || other.minZ >= this.maxZ) return dy;
    if (dy > 0 && other.maxY <= this.minY) {
      const d = this.minY - other.maxY;
      if (d < dy) dy = d;
    } else if (dy < 0 && other.minY >= this.maxY) {
      const d = this.maxY - other.minY;
      if (d > dy) dy = d;
    }
    return dy;
  }

  clipZ(other: AABB, dz: number): number {
    if (other.maxX <= this.minX || other.minX >= this.maxX || other.maxY <= this.minY || other.minY >= this.maxY) return dz;
    if (dz > 0 && other.maxZ <= this.minZ) {
      const d = this.minZ - other.maxZ;
      if (d < dz) dz = d;
    } else if (dz < 0 && other.minZ >= this.maxZ) {
      const d = this.maxZ - other.minZ;
      if (d > dz) dz = d;
    }
    return dz;
  }

  /** Interseção de um raio com a caixa. Retorna t de entrada e a face (0..5) ou null. */
  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): { t: number; face: number } | null {
    let tmin = 0, tmax = maxT, face = -1;
    const axes: [number, number, number, number, number][] = [
      [ox, dx, this.minX, this.maxX, 4],
      [oy, dy, this.minY, this.maxY, 0],
      [oz, dz, this.minZ, this.maxZ, 2],
    ];
    for (const [o, d, lo, hi, negFace] of axes) {
      if (Math.abs(d) < 1e-12) {
        if (o < lo || o > hi) return null;
        continue;
      }
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      let f = negFace; // entrando pela face mínima => face negativa
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; f = negFace + 1; }
      if (t1 > tmin) { tmin = t1; face = f; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    return { t: tmin, face };
  }
}
