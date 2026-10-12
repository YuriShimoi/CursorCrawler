/** Moving things: enemies, the boss and projectiles. Positions are box centers in map pixels */
class Actor {
  static STEP = 2;

  /** Boss floors cleared before this depth: 0 up to the first boss, 1 after it... */
  static tier(depth) {
    return Math.max(0, Math.floor((depth - 1) / Floor.BOSS_EVERY));
  }

  /**
   * @param {{hp:number, half:number, sprite:string, tiles?:number, damage?:number}} spec - half is the collision box half size, damage in half hearts
   */
  constructor(cx, cy, {hp, half, sprite, tiles=1, damage=1}) {
    this.cx = cx;
    this.cy = cy;
    this.hp = hp;
    this.maxHp = hp;
    this.half = half;
    this.sprite = sprite;
    this.tiles = tiles;
    this.damage = damage;
    this.flash = 0;
    this.scale = 1;     // drawn size, small slimes shrink
    this.flying = false; // flyers skip spikes
    this.queue = [];     // {delay, angle} shots waiting to fire, angle null aims when fired
    this.blockedAt = -1; // last 'blocked' text, so they don't pile up
  }

  get alive() { return this.hp > 0; }

  /** Shots, blasts and touches reach it (the worm underground isn't) */
  get hittable() { return true; }

  get aim() { return Math.atan2(Game.hero.y - this.cy, Game.hero.x - this.cx); }

  fits(x, y) {
    const h = this.half;
    const floor = Game.floor;
    return floor.isFreeAt(x - h, y - h) && floor.isFreeAt(x + h, y - h)
        && floor.isFreeAt(x - h, y + h) && floor.isFreeAt(x + h, y + h);
  }

  /** Moves sliding along walls and props */
  move(dx, dy) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Actor.STEP) || 1;
    const sx = dx / steps, sy = dy / steps;
    for(let s = 0; s < steps; s++) {
      if(this.fits(this.cx + sx, this.cy)) this.cx += sx;
      if(this.fits(this.cx, this.cy + sy)) this.cy += sy;
    }
  }

  /** Moves toward a point at a speed (px/s) */
  approach(x, y, speed, dt) {
    const dist = Math.hypot(x - this.cx, y - this.cy);
    if(dist < 1) return;
    this.move((x - this.cx) / dist * speed * dt, (y - this.cy) / dist * speed * dt);
  }

  /** Distance from a point to the collision box */
  distanceTo(x, y) {
    const dx = Math.max(Math.abs(x - this.cx) - this.half, 0);
    const dy = Math.max(Math.abs(y - this.cy) - this.half, 0);
    return Math.hypot(dx, dy);
  }

  sees(x, y, range) {
    return Math.hypot(x - this.cx, y - this.cy) <= range && Game.floor.lineOfSight(this.cx, this.cy, x, y);
  }

  /** Projectile options for this actor's shots */
  shot() {
    return {damage: this.damage};
  }

  fire(angle) {
    Game.projectiles.push(new Projectile(this.cx, this.cy, angle, this.shot()));
  }

  /**
   * @param {'shot'|'blast'|'spikes'} kind - what hit it, shields and armor care
   */
  hit(damage, fromX, fromY, kind='shot') {
    this.hp -= damage;
    this.flash = 0.25;
    // knockback away from the hit
    const dist = Math.hypot(this.cx - fromX, this.cy - fromY) || 1;
    this.move((this.cx - fromX) / dist * 10, (this.cy - fromY) / dist * 10);
  }

  /** A shot hitting from the front of a facing (unit vector): it travels against it */
  /** @param {number} cone - cosine limit, -0.3 blocks within ~72° of the face, -0.5 within 60° */
  static fromFront(face, cx, cy, fromX, fromY, cone=-0.3) {
    const dx = cx - fromX, dy = cy - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    return (dx * face.x + dy * face.y) / dist < cone;
  }

  /** Feedback for a hit that did nothing */
  blocked(text='blocked') {
    if(Game.time - this.blockedAt < 0.4) return;
    this.blockedAt = Game.time;
    Game.float(text, this.cx, this.cy - this.half - 10, '#6272a4');
  }

  /** Called by Game.kill, e.g. slimes split */
  died() {}

  /**
   * Warning where something comes out of the floor: a pulsing red ring and blinking cracks
   * @param {number} left - s until it happens, the ring closes in as it runs out
   */
  static drawMark(ctx, x, y, left) {
    const T = Floor.TILE;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff5555';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, T * (0.45 + Math.min(left, 1) * 0.35), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if(Math.floor(left * 8) % 2) Sprites.draw(ctx, 'crackedWall', Math.round(x - T/2), Math.round(y - T/2));
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);

    for(const shot of this.queue) {
      shot.delay -= dt;
      if(shot.delay <= 0) this.fire(shot.angle ?? this.aim);
    }
    this.queue = this.queue.filter(s => s.delay > 0);

    if(this.hittable && this.distanceTo(Game.hero.x, Game.hero.y) <= 1) Game.hurt(this.damage, this.cx, this.cy);
  }

  /** [scaleX, scaleY] of the squish animation */
  squish() {
    return [1, 1];
  }

  draw(ctx) {
    // blink while hurt
    if(this.flash > 0 && Math.floor(this.flash * 20) % 2) return;
    const size = Floor.TILE * this.tiles;
    const [sx, sy] = this.squish();

    // scale around the feet so the squish stays on the ground
    ctx.save();
    ctx.translate(Math.round(this.cx), Math.round(this.cy + size * this.scale / 2));
    ctx.scale(sx * (this.facing ?? 1) * this.scale, sy * this.scale);
    // faint white border on enemies inside the hero's own light
    if(this.inView) Sprites.outline(ctx, this.sprite, -size/2, -size);
    Sprites.draw(ctx, this.sprite, -size/2, -size);
    ctx.restore();
  }
}

/** Zombie: dashes tile to tile, paths to the hero while alert, wanders otherwise */
class Enemy extends Actor {
  static SIGHT = Floor.TILE * 7;
  static ALERT = 3;    // s still chasing after losing sight
  static DASH  = 0.14; // s per tile
  static PAUSE = {chase: 0.3, wander: 1.2}; // s between dashes
  static DIRS  = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  static DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  static HP_FLOORS = {first: 5, every: 10}; // +1 hp on floor 5, then 15, 25...

  /** Extra hp at the current floor; none outside a run (docs) */
  static extraHp(depth=globalThis.Game?.depth ?? 0) {
    const {first, every} = Enemy.HP_FLOORS;
    return depth < first? 0: 1 + Math.floor((depth - first) / every);
  }

  /** @param {number} tier - Actor.tier: +1 damage every 2 tiers (hp grows with Enemy.extraHp) */
  constructor(cx, cy, tier=0, sprite='zombie') {
    // box covers the tile: it touches the hero when sharing a tile
    super(cx, cy, {hp: 2 + Enemy.extraHp(), half: Floor.TILE / 2 - 2, sprite, damage: 1 + Math.floor(tier / 2)});
    const T = Floor.TILE;
    this.tier = tier;
    this.tx = Math.floor(cx / T);
    this.ty = Math.floor(cy / T);
    this.to = null;      // tile being dashed to
    this.from = null;
    this.progress = 0;
    this.dash = Enemy.DASH;
    this.dashTime = this.dash; // of the current dash, longer on a diagonal
    this.pause = Enemy.PAUSE;
    this.diagonal = 0.25;      // chance a step goes diagonal when one fits
    this.wait = Math.random() * Enemy.PAUSE.wander;
    this.alert = 0;
    this.goal = null;    // last tile the hero was seen on
    this.dir = Enemy.DIRS[0];
    this.facing = 1;
    this.phase = Math.random() * 6;
  }

  /** Chases right away, for summoned and awakened ones */
  provoke() {
    this.alert = Enemy.ALERT * 3;
    // no floor yet when built outside a run (test page listing); it finds the hero once it looks
    if(Game.floor && Game.hero) this.goal = Game.floor.tileAt(Game.hero.x, Game.hero.y);
  }

  update(dt) {
    const {hero, floor} = Game;
    const T = Floor.TILE;

    if(this.sees(hero.x, hero.y, Enemy.SIGHT)) {
      this.alert = Math.max(this.alert, Enemy.ALERT);
      this.goal = floor.tileAt(hero.x, hero.y);
    }
    else this.alert = Math.max(0, this.alert - dt);

    if(this.to) {
      // dash with ease out, lands on the tile center
      this.progress = Math.min(1, this.progress + dt / this.dashTime);
      const ease = 1 - (1 - this.progress) ** 2;
      this.cx = this.from.x + ((this.to.x + 0.5) * T - this.from.x) * ease;
      this.cy = this.from.y + ((this.to.y + 0.5) * T - this.from.y) * ease;
      if(this.progress >= 1) {
        this.tx = this.to.x;
        this.ty = this.to.y;
        this.to = null;
        this.wait = this.alert? this.pause.chase: this.pause.wander * (0.6 + Math.random());
      }
    }
    else {
      this.wait -= dt;
      if(this.wait <= 0) this.step();
    }

    this.phase += dt;
    super.update(dt);
  }

  /** Picks the next tile and starts a dash to it */
  step() {
    const chasing = this.alert && this.goal;
    // now and then a diagonal step, toward the goal while chasing
    const diagonal = Math.random() < this.diagonal? this.diagonalStep(chasing? this.goal: null): null;
    this.dashTo(diagonal ?? (chasing? this.pathStep(this.goal): this.wanderStep()));
  }

  /**
   * Free diagonal neighbor with both side tiles open (no cutting wall corners)
   * @param {{x, y}|null} goal - picks the one closest to it, a random one when null
   */
  diagonalStep(goal) {
    const options = Enemy.DIAGONALS
      .map(([dx, dy]) => ({x: this.tx + dx, y: this.ty + dy, dx, dy}))
      .filter(t => Enemy.walkable(t.x, t.y) && Enemy.walkable(this.tx + t.dx, this.ty) && Enemy.walkable(this.tx, this.ty + t.dy)
                   && !this.occupied(t.x, t.y));
    if(!goal) return options[Math.floor(Math.random() * options.length)] ?? null;

    // only when the goal is off both axes, so the diagonal really gains ground
    if(goal.x === this.tx || goal.y === this.ty) return null;
    return options.find(t => Math.sign(goal.x - this.tx) === t.dx && Math.sign(goal.y - this.ty) === t.dy) ?? null;
  }

  /** Starts a dash to a neighbor tile, or waits a bit when null */
  dashTo(next) {
    if(!next) {
      this.wait = 0.3;
      return;
    }
    // the sprite faces left
    if(next.x !== this.tx) this.facing = next.x < this.tx? 1: -1;
    this.dir = [next.x - this.tx, next.y - this.ty];
    this.dashTime = this.dash * (next.x !== this.tx && next.y !== this.ty? Math.SQRT2: 1);
    this.from = {x: this.cx, y: this.cy};
    this.to = next;
    this.progress = 0;
  }

  /** Tile an enemy can step on: free, no raised spikes */
  static walkable(x, y) {
    const floor = Game.floor;
    return floor.isFree(x, y) && !(floor.spikesOn && floor.hazards.has(y * floor.cols + x));
  }

  /** Tile taken by another enemy, standing or dashing */
  occupied(x, y) {
    return Game.actors.some(a => a !== this && a instanceof Enemy &&
      ((a.tx === x && a.ty === y) || (a.to && a.to.x === x && a.to.y === y)));
  }

  /** First step of the shortest grid path to a tile (BFS), null when blocked or there */
  pathStep(goal) {
    const floor = Game.floor;
    const cols = floor.cols;
    const start = this.ty * cols + this.tx, target = goal.y * cols + goal.x;
    if(start === target) return null;

    const prev = new Int32Array(cols * floor.rows).fill(-1);
    prev[start] = start;
    const queue = [start];
    for(let i = 0; i < queue.length && prev[target] === -1; i++) {
      const cell = queue[i];
      const x = cell % cols, y = (cell - x) / cols;
      for(const [dx, dy] of Enemy.DIRS) {
        const nx = x + dx, ny = y + dy, n = ny * cols + nx;
        if(prev[n] !== -1 || !Enemy.walkable(nx, ny)) continue;
        prev[n] = cell;
        queue.push(n);
      }
    }
    if(prev[target] === -1) return null;

    // walk back to the step right after the start
    let cell = target;
    while(prev[cell] !== start) cell = prev[cell];
    const next = {x: cell % cols, y: Math.floor(cell / cols)};
    return this.occupied(next.x, next.y)? null: next;
  }

  /** Random neighbor, keeping the last direction more often than not */
  wanderStep() {
    const options = Enemy.DIRS
      .map(([dx, dy]) => ({x: this.tx + dx, y: this.ty + dy, same: dx === this.dir[0] && dy === this.dir[1]}))
      .filter(t => Enemy.walkable(t.x, t.y) && !this.occupied(t.x, t.y));
    if(!options.length) return null;
    return options.find(t => t.same && Math.random() < 0.6) ?? options[Math.floor(Math.random() * options.length)];
  }

  /** No knockback, it would push the enemy off the grid */
  hit(damage) {
    this.hp -= damage;
    this.flash = 0.25;
    this.alert = Math.max(this.alert, Enemy.ALERT);
    this.goal = Game.floor.tileAt(Game.hero.x, Game.hero.y);
  }

  squish() {
    // stretch along the dash, settle with a slow idle wobble
    if(this.to) {
      const s = Math.sin(this.progress * Math.PI);
      return [1 + 0.25 * s, 1 - 0.2 * s];
    }
    const s = Math.sin(this.phase * 5) * 0.04;
    return [1 - s, 1 + s];
  }
}

/** Skeleton: walks the grid like the zombie, but holds its distance and attacks from range */
class Skeleton extends Enemy {
  static KEEP   = Floor.TILE * 5; // backs off when the hero is closer
  static RELOAD = 1.2;
  static BURST  = {every: 6, max: 5, gap: 0.15}; // floors per extra shot in the cap, cap at most, s between shots

  constructor(cx, cy, tier=0, sprite='skeleton') {
    super(cx, cy, tier, sprite);
    this.diagonal = 0; // ranged ones keep to straight lines
    this.keep = Skeleton.KEEP;
    this.reloadTime = Skeleton.RELOAD;
    this.reload = Skeleton.RELOAD * (0.5 + Math.random());
  }

  update(dt) {
    super.update(dt);
    const {hero} = Game;
    if(!this.alert || this.to || !this.sees(hero.x, hero.y, Enemy.SIGHT)) return;

    // the sprite faces left
    this.facing = hero.x < this.cx? 1: -1;
    this.reload -= dt;
    if(this.reload > 0) return;
    this.reload = this.reloadTime;
    this.attack();
  }

  /** Shots per attack: random from 1 up to a cap that grows by one every BURST.every floors, to BURST.max */
  get burst() {
    const cap = Math.min(Skeleton.BURST.max, 1 + Math.floor(Game.depth / Skeleton.BURST.every));
    return 1 + Math.floor(Math.random() * cap);
  }

  /** A burst of aimed shots, each aimed when it fires */
  attack() {
    for(let i = 0; i < this.burst; i++) this.queue.push({delay: i * Skeleton.BURST.gap, angle: null});
  }

  step() {
    const {hero} = Game;
    if(this.alert && this.sees(hero.x, hero.y, Enemy.SIGHT)) {
      // in sight: hold still and shoot, back off when too close
      this.dashTo(Math.hypot(hero.x - this.cx, hero.y - this.cy) < this.keep? this.fleeStep(): null);
      return;
    }
    super.step();
  }

  /** Neighbor tile farthest from the hero, null when none gains distance */
  fleeStep() {
    const T = Floor.TILE;
    const {hero} = Game;
    let best = null, far = Math.hypot(hero.x - this.cx, hero.y - this.cy);
    for(const [dx, dy] of Enemy.DIRS) {
      const x = this.tx + dx, y = this.ty + dy;
      if(!Enemy.walkable(x, y) || this.occupied(x, y)) continue;
      const dist = Math.hypot(hero.x - (x + 0.5) * T, hero.y - (y + 0.5) * T);
      if(dist > far) {
        best = {x, y};
        far = dist;
      }
    }
    return best;
  }
}

/** Beholder, and the base of every boss: keeps its distance and fires volleys in changing patterns, bigger below half health */
class Boss extends Actor {
  static HP       = 12;
  static SIGHT    = Floor.TILE * 10;
  static SPEED    = 26;
  static KEEP     = Floor.TILE * 3;
  static RELOAD   = 1.8; // s after a volley is queued
  static PATTERNS = ['fan', 'ring', 'burst', 'spiral'];
  static DAMAGE   = 0.75; // extra half hearts per tier, rounded: tiers 1-6 hit for 2, 3, 3, 4, 5, 6
  static LUNGE    = {every: [3, 6], time: 0.6, speed: 150}; // beholder only: s between, s and px/s of the dash

  /** @param {number} tier - Actor.tier: +half hp and +DAMAGE (rounded) damage per tier */
  constructor(cx, cy, tier=0) {
    super(cx, cy, {hp: Boss.HP + tier * Boss.HP / 2, half: 28, sprite: 'beholder', tiles: 2, damage: 1 + Math.round(tier * Boss.DAMAGE)});
    this.name = 'Beholder'; // shown on the boss bar; other bosses set their own
    this.tier = tier;
    this.reload = Boss.RELOAD;
    this.reloadTime = Boss.RELOAD;
    this.patterns = Boss.PATTERNS;
    this.pattern = null;
    // a short dash at the hero now and then; bosses built on this one keep their own moves
    this.lunge = this.constructor === Boss? {wait: Boss.lungeWait(), time: 0, x: 0, y: 0}: null;
  }

  static lungeWait() {
    const [min, max] = Boss.LUNGE.every;
    return min + Math.random() * (max - min);
  }

  /** Base hp for this boss, scaled by tier like the beholder */
  setHp(base) {
    this.hp = this.maxHp = base + this.tier * base / 2;
  }

  get enraged() { return this.hp <= this.maxHp / 2; }

  /** Once it has seen the hero (or the arena seals) it always knows where the hero is */
  get hunting() {
    const {hero} = Game;
    return this.triggered ||= !!Game.arenaSeal || this.sees(hero.x, hero.y, Boss.SIGHT);
  }

  update(dt) {
    const {hero} = Game;
    if(this.hunting) {
      const dist = Math.hypot(hero.x - this.cx, hero.y - this.cy);
      // hold a distance: back off when the hero comes close (a lunge takes over the movement)
      if(!this.lunging(dt, dist)) {
        if(dist > Boss.KEEP) this.approach(hero.x, hero.y, Boss.SPEED, dt);
        else this.approach(2 * this.cx - hero.x, 2 * this.cy - hero.y, Boss.SPEED, dt);
      }

      this.reload -= dt;
      if(this.reload <= 0 && !this.queue.length) {
        this.volley();
        this.reload = this.enraged? this.reloadTime * 0.7: this.reloadTime;
      }
    }
    super.update(dt);
  }

  /** Counts down to a lunge, then dashes along the aim it took, no warning; true while it owns the movement */
  lunging(dt, dist) {
    const l = this.lunge;
    if(!l) return false;
    const {LUNGE} = Boss;

    if(l.time > 0) {
      l.time -= dt;
      this.move(l.x * LUNGE.speed * dt, l.y * LUNGE.speed * dt);
      return true;
    }
    l.wait -= dt;
    if(l.wait > 0 || dist < 1) return false;
    const {hero} = Game;
    l.x = (hero.x - this.cx) / dist;
    l.y = (hero.y - this.cy) / dist;
    l.time = LUNGE.time;
    l.wait = Boss.lungeWait();
    return true;
  }

  /** Queues a volley in a pattern different from the last one */
  volley() {
    const options = this.patterns.filter(p => p !== this.pattern);
    this.pattern = options[Math.floor(Math.random() * options.length)] ?? this.patterns[0];
    const more = this.enraged? 1.5: 1;
    const shot = (delay, angle=null) => this.queue.push({delay, angle});
    const aim = this.aim;

    switch(this.pattern) {
      case 'fan': {
        // wide aimed spread
        const n = Math.round(5 * more);
        for(let i = 0; i < n; i++) shot(0, aim + (i / (n - 1) - 0.5) * 1.2);
        break;
      }
      case 'ring': {
        const n = Math.round(10 * more), turn = Math.random() * Math.PI;
        for(let i = 0; i < n; i++) shot(0, turn + i * Math.PI * 2 / n);
        break;
      }
      case 'burst':
        // quick shots, each aimed when fired
        for(let i = 0; i < Math.round(4 * more); i++) shot(i * 0.15);
        break;
      case 'spiral': {
        const n = Math.round(12 * more), side = Math.random() < 0.5? 1: -1;
        for(let i = 0; i < n; i++) shot(i * 0.07, aim + side * i * 0.55);
        break;
      }
    }
  }

  /** Slow breathing wobble while it floats */
  squish() {
    const s = Math.sin(Game.time * 3) * 0.06;
    return [1 + s, 1 - s];
  }
}

/** Shot that flies straight until a wall; hostile ones hurt the hero, the hero's hurt actors */
class Projectile {
  static SPEED      = 220; // px/s
  static HERO_SPEED = 360;

  /**
   * @param {{hostile?:boolean, damage?:number, sprite?:string, effect?:'slow', speed?:number, stick?:number}} options -
   *   effect replaces the damage, speed overrides the default, stick is s it stays glued where it hits a wall
   */
  constructor(x, y, angle, {hostile=true, damage=1, sprite=null, effect=null, speed=null, stick=0}={}) {
    speed ??= hostile? Projectile.SPEED: Projectile.HERO_SPEED;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.hostile = hostile;
    this.damage = damage;
    this.sprite = sprite ?? (hostile? 'projectile': 'playerProjectile');
    this.effect = effect;
    this.stick = stick;
    this.stuck = 0; // s left glued to a wall
    this.alive = true;
  }

  update(dt) {
    if(this.stuck > 0) {
      this.stuck -= dt;
      if(this.stuck <= 0) this.alive = false;
    }
    else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if(!Game.floor.isOpenAt(this.x, this.y)) {
        if(!this.stick) {
          this.alive = false;
          return;
        }
        // back out of the wall and stay on its face
        this.x -= this.vx * dt;
        this.y -= this.vy * dt;
        this.stuck = this.stick;
      }
    }

    if(this.hostile) {
      const {hero} = Game;
      if(Math.hypot(hero.x - this.x, hero.y - this.y) < 8) {
        if(this.effect === 'slow') Game.slowHero();
        else Game.hurt(this.damage, this.x - this.vx, this.y - this.vy);
        this.alive = false;
      }
      return;
    }

    // hero shots break jars on the way
    const jar = Game.entities.find(e => e.alive && e.type === 'jar' && e.distanceTo(this.x, this.y) <= 2);
    if(jar) {
      Game.smash(jar);
      this.alive = false;
      return;
    }

    const actor = Game.actors.find(a => a.alive && a.hittable && a.distanceTo(this.x, this.y) <= 2);
    if(!actor) return;
    actor.hit(this.damage, this.x - this.vx, this.y - this.vy, 'shot');
    if(!actor.alive) Game.kill(actor);
    else Sound.play('hit');
    this.alive = false;
  }

  draw(ctx) {
    const T = Floor.TILE;
    // a stuck shot fades over its last half second
    const alpha = ctx.globalAlpha;
    if(this.stuck > 0) ctx.globalAlpha = alpha * Math.min(1, this.stuck / 0.5);
    Sprites.draw(ctx, this.sprite, Math.round(this.x - T/2), Math.round(this.y - T/2));
    ctx.globalAlpha = alpha;
  }
}
