/** One light: visibility polygon from a point plus the wall tiles it reaches */
class LightSource {
  static EPSILON = 0.0001;
  static FACES   = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.polygon = [];
    this.walls = [];
    this.near = [];
    this._path = null;
  }

  //#region [ RAYCAST ]
  /** Builds the visibility polygon against wall segments */
  cast(segments) {
    const {x, y} = this;
    const r = this.radius;
    const [left, top, right, bottom] = [x - r, y - r, x + r, y + r];

    let near = segments.filter(s =>
      Math.max(s.x1, s.x2) >= left && Math.min(s.x1, s.x2) <= right &&
      Math.max(s.y1, s.y2) >= top  && Math.min(s.y1, s.y2) <= bottom);

    // light bounds act as walls so every ray hits something
    near.push(
      {x1: left,  y1: top,    x2: right, y2: top},
      {x1: right, y1: top,    x2: right, y2: bottom},
      {x1: right, y1: bottom, x2: left,  y2: bottom},
      {x1: left,  y1: bottom, x2: left,  y2: top}
    );
    this.near = near;

    // one ray at each corner plus two grazing past it
    let points = [];
    for(const s of near) {
      for(const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        const a = Math.atan2(py - y, px - x);
        for(const angle of [a - LightSource.EPSILON, a, a + LightSource.EPSILON]) {
          const dx = Math.cos(angle), dy = Math.sin(angle);
          const nearest = this.nearest(dx, dy);
          if(nearest < Infinity) points.push({x: x + dx * nearest, y: y + dy * nearest, angle});
        }
      }
    }

    this.polygon = points.sort((a, b) => a.angle - b.angle);
    this._path = null;
  }

  /** Distance to the nearest segment along a ray */
  nearest(dx, dy) {
    let nearest = Infinity;
    for(const s of this.near) {
      const t = LightSource.intersect(this.x, this.y, dx, dy, s);
      if(t !== null && t < nearest) nearest = t;
    }
    return nearest;
  }

  /** Distance along the ray (x, y) + t*(dx, dy) to the segment, or null */
  static intersect(x, y, dx, dy, s) {
    const sx = s.x2 - s.x1, sy = s.y2 - s.y1;
    const den = dx * sy - dy * sx;
    if(Math.abs(den) < 1e-9) return null;

    const t = ((s.x1 - x) * sy - (s.y1 - y) * sx) / den;
    const u = ((s.x1 - x) * dy - (s.y1 - y) * dx) / den;
    // small tolerance so rays can't slip between segments sharing a corner
    if(t < 0 || u < -1e-6 || u > 1 + 1e-6) return null;
    return t;
  }

  /** Wall tiles with an open face the light reaches (run after cast) */
  findWalls(floor) {
    const T = Floor.TILE;
    const r = this.radius;
    const [x0, y0] = [Math.floor((this.x - r) / T), Math.floor((this.y - r) / T)];
    const [x1, y1] = [Math.floor((this.x + r) / T), Math.floor((this.y + r) / T)];

    this.walls = [];
    for(let ty = y0; ty <= y1; ty++)
      for(let tx = x0; tx <= x1; tx++)
        if(floor.tile(tx, ty) === Tile.WALL && this.seesWall(floor, tx, ty))
          this.walls.push({x: tx, y: ty});
  }

  seesWall(floor, tx, ty) {
    const T = Floor.TILE;
    for(const [dx, dy] of LightSource.FACES) {
      if(!floor.isOpen(tx + dx, ty + dy)) continue;

      // face center, skip faces turned away from the light
      const cx = tx * T + T/2 + dx * T/2;
      const cy = ty * T + T/2 + dy * T/2;
      if((this.x - cx) * dx + (this.y - cy) * dy <= 0) continue;

      // sample along the face
      for(const s of [-0.35, 0, 0.35]) {
        const px = cx + (dy? s * T: 0);
        const py = cy + (dx? s * T: 0);
        const dist = Math.hypot(px - this.x, py - this.y);
        if(dist > this.radius) continue;
        if(this.nearest((px - this.x) / dist, (py - this.y) / dist) >= dist - 0.5) return true;
      }
    }
    return false;
  }
  //#endregion

  //#region [ DRAW ]
  get path() {
    if(this._path) return this._path;
    const path = new Path2D();
    this.polygon.forEach((p, i) => i? path.lineTo(p.x, p.y): path.moveTo(p.x, p.y));
    path.closePath();
    return this._path = path;
  }

  /** Point inside the lit area (ctx must have no transform) */
  contains(ctx, x, y) {
    return Math.hypot(x - this.x, y - this.y) <= this.radius && ctx.isPointInPath(this.path, x, y);
  }

  /** Fills the lit area and reached walls with the current fill style */
  fill(ctx) {
    const T = Floor.TILE;
    ctx.fill(this.path);
    this.walls.forEach(w => ctx.fillRect(w.x * T, w.y * T, T, T));
  }
  //#endregion
}

/** Darkness with holes for the hero light, static lights and explored memory */
class Light {
  static DARK    = '#121212';
  static MEMORY  = 0.3; // how much of an explored area stays visible

  /**
   * @param {number} width  - map width in pixels
   * @param {number} height - map height in pixels
   * @param {number} radius - hero light reach in pixels
   */
  constructor(width, height, radius) {
    this.hero = new LightSource(0, 0, radius);
    this.sources = [];

    this.memory = document.createElement('CANVAS');
    this.memory.width  = width;
    this.memory.height = height;
    this.memoryCtx = this.memory.getContext('2d');
  }

  //#region [ HERO LIGHT ]
  get x()       { return this.hero.x; }
  get y()       { return this.hero.y; }
  get radius()  { return this.hero.radius; }
  get polygon() { return this.hero.polygon; }
  get walls()   { return this.hero.walls; }

  cast(x, y, segments) {
    this.hero.x = x;
    this.hero.y = y;
    this.hero.cast(segments);
  }

  findWalls(floor) {
    this.hero.findWalls(floor);
  }
  //#endregion

  //#region [ SOURCES ]
  /** Adds a static light (torch, campfire) and marks its area explored */
  add(source) {
    this.sources.push(source);
    this.rememberSource(source, 1);
  }

  /** Point lit by the hero or any static light */
  isLit(x, y) {
    const ctx = this.memoryCtx;
    return this.hero.contains(ctx, x, y) || this.sources.some(s => s.contains(ctx, x, y));
  }
  //#endregion

  //#region [ DRAW ]
  /** Marks the hero's lit area as explored */
  remember() {
    this.rememberSource(this.hero, 0.8);
  }

  rememberSource(source, reach) {
    const ctx = this.memoryCtx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(source.x, source.y, source.radius * reach, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#000000';
    source.fill(ctx);
    ctx.restore();
  }

  static gradient(ctx, x, y, radius) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0,   '#000000ff');
    gradient.addColorStop(0.5, '#000000dd');
    gradient.addColorStop(1,   '#00000000');
    return gradient;
  }

  /** Darkness over the screen with holes for memory and lights */
  draw(layer, offsetX, offsetY) {
    const ctx = layer.ctx;

    layer.clear();
    ctx.fillStyle = Light.DARK;
    ctx.fillRect(0, 0, layer.element.width, layer.element.height);

    ctx.translate(offsetX, offsetY);
    ctx.globalCompositeOperation = 'destination-out';

    ctx.globalAlpha = Light.MEMORY;
    ctx.drawImage(this.memory, 0, 0);
    ctx.globalAlpha = 1;

    for(const s of this.sources) {
      ctx.fillStyle = Light.gradient(ctx, s.x, s.y, s.radius);
      s.fill(ctx);
    }

    ctx.fillStyle = Light.gradient(ctx, this.hero.x, this.hero.y, this.hero.radius);
    this.hero.fill(ctx);

    ctx.globalCompositeOperation = 'source-over';
  }
  //#endregion
}
