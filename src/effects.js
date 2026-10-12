/** One square bit of a burst, fading through its colors as it lives */
class Particle {
  constructor(x, y, vx, vy, size, life, colors, gravity) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.life = life;
    this.colors = colors;
    this.gravity = gravity;
    this.t = 0;
    // with gravity it hops and settles a bit below where it started
    this.ground = y + 6 + Math.random() * 10;
  }

  get alive() { return this.t < this.life; }

  get color() {
    return Particle.interpolateColors(this.colors, this.t, this.life);
  }

  update(dt) {
    this.t += dt;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if(this.gravity && this.y > this.ground) {
      this.y = this.ground;
      this.vy *= -0.35;
      this.vx *= 0.5;
    }
    // drag, so bits without gravity slow down instead of flying off
    const drag = Math.pow(0.04, dt);
    this.vx *= drag;
    if(!this.gravity) this.vy *= drag;
  }

  draw(ctx) {
    const s = this.size;
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.round(this.x - s / 2), Math.round(this.y - s / 2), s, s);
  }

  static interpolateColors(colors, time, endTime) {
    const segment = Math.min(1, time / endTime) * (colors.length - 1);
    const index = Math.floor(segment);
    if(index >= colors.length - 1) return colors[colors.length - 1];

    const t = segment - index;
    const a = colors[index], b = colors[index + 1];
    const mix = i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
    return `#${((1 << 24) + (mix(1) << 16) + (mix(3) << 8) + mix(5)).toString(16).slice(1)}`;
  }
}

/** Death pops, particle bursts and the leftovers on the floor (corpses, junk); purely visual */
class Effects {
  static PIXEL = 3; // px, one sprite pixel at the game's scale

  // every enemy and boss shares the dungeon's red, props their wood tones; all fade into the wall shade
  static COLORS = {
    blood: ['#ff5555', '#8f2c2c', '#2e3040'],
    wood : ['#ffb86c', '#b8763a', '#2e3040'],
    dirt : ['#8f2c2c', '#2e3040']
  };

  static POP       = 0.15; // s, the flatten before an enemy bursts
  static BOSS_POP  = 0.35;

  static particles = [];
  static pops = [];
  static waves = [];  // {delay, x, y, options} bursts waiting their turn
  static decals = []; // {sprite, x, y, tx, ty, keep}, one per tile, until the floor changes
  static changed = false; // a decal was added, the floor layer needs a redraw

  static clear() {
    Effects.particles = [];
    Effects.pops = [];
    Effects.waves = [];
    Effects.decals = [];
  }

  /**
   * Spreads square bits out of a point
   * @param {object} o - count, colors, speed (px/s), life (s), gravity (px/s²), size in sprite pixels, spread (px)
   */
  static burst(x, y, {count=10, colors=Effects.COLORS.blood, speed=90, life=0.5, gravity=0, size=1, spread=6}={}) {
    for(let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      // gravity bursts kick upward so the bits hop
      const up = gravity? -speed * 0.6: 0;
      Effects.particles.push(new Particle(
        x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread,
        Math.cos(angle) * v, Math.sin(angle) * v + up,
        Effects.PIXEL * (Math.random() < 0.25? size + 1: size),
        life * (0.6 + Math.random() * 0.4), colors, gravity
      ));
    }
  }

  /** The dead actor squashes flat, then bursts and leaves a corpse */
  static death(actor) {
    const boss = actor instanceof Boss;
    Effects.pops.push({
      sprite: actor.sprite, cx: actor.cx, cy: actor.cy,
      size: Floor.TILE * actor.tiles * actor.scale, facing: actor.facing ?? 1,
      boss, small: actor.small, corpse: !(actor instanceof Slime), t: 0, length: boss? Effects.BOSS_POP: Effects.POP
    });
  }

  /** A jar or box breaks: wood shards hop out, junk stays */
  static shatter(e) {
    Effects.burst(e.cx, e.cy, {count: 8, colors: Effects.COLORS.wood, speed: 70, life: 0.7, gravity: 260});
    Effects.decal('junk', e.cx, e.cy);
  }

  /** A new leftover takes its tile's place, but boss remains are never covered; 1-tile ones sit centered on their tile */
  static decal(sprite, x, y, keep=false) {
    const T = Floor.TILE;
    const tx = Math.floor(x / T);
    const ty = Math.floor(y / T);
    const old = Effects.decals.find(d => d.tx === tx && d.ty === ty);
    if(old?.keep) return;
    if(Sprites.tiles(sprite) === 1) {
      x = (tx + 0.5) * T;
      y = (ty + 0.5) * T;
    }
    Effects.decals = Effects.decals.filter(d => d !== old);
    Effects.decals.push({sprite, x, y, tx, ty, keep});
    Effects.changed = true;
  }

  static update(dt) {
    Effects.pops.forEach(p => p.t += dt);
    Effects.pops.filter(p => p.t >= p.length).forEach(Effects.burstPop);
    Effects.pops = Effects.pops.filter(p => p.t < p.length);

    Effects.waves.forEach(w => w.delay -= dt);
    Effects.waves.filter(w => w.delay <= 0).forEach(w => Effects.burst(w.x, w.y, w.options));
    Effects.waves = Effects.waves.filter(w => w.delay > 0);

    Effects.particles.forEach(p => p.update(dt));
    Effects.particles = Effects.particles.filter(p => p.alive);
  }

  static burstPop(p) {
    if(!p.boss) {
      Effects.burst(p.cx, p.cy, {count: p.small? 6: 10, speed: 90, life: 0.5});
      // slimes just splash, nothing stays
      if(p.corpse) Effects.decal('corpse', p.cx, p.cy);
      return;
    }
    // bosses go in three growing waves and leave their remains for the floor
    [0, 0.12, 0.26].forEach((delay, i) => Effects.waves.push({delay, x: p.cx, y: p.cy, options: {
      count: 12 + i * 6, speed: 110 + i * 40, life: 0.7, size: i? 1: 2, spread: p.size / 2
    }}));
    Effects.decal('remains', p.cx, p.cy, true);
  }

  /** Leftovers, on the floor layer under the props (Game.drawFloor) */
  static drawDecals(ctx) {
    Effects.decals.forEach(d => {
      const size = Floor.TILE * Sprites.tiles(d.sprite);
      Sprites.draw(ctx, d.sprite, Math.round(d.x - size / 2), Math.round(d.y - size / 2));
    });
  }

  /** Pops and bits, over the actors */
  static draw(ctx) {
    Effects.pops.forEach(p => {
      const k = Math.min(1, p.t / p.length);
      // widen and flatten around the feet
      ctx.save();
      ctx.translate(Math.round(p.cx), Math.round(p.cy + p.size / 2));
      ctx.scale((1 + k * 0.15) * p.facing, 1 - k * 0.35);
      Sprites.draw(ctx, p.sprite, -p.size / 2, -p.size, p.size / Sprites.tiles(p.sprite));
      ctx.restore();
    });
    Effects.particles.forEach(p => p.draw(ctx));
  }
}
