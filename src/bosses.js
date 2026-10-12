/** Bosses beyond the beholder (Boss); all extend Boss so the arena, bar and loot treat them alike */

/** Necromancer: stops to raise minions in waves (spots marked first); shielded while any minion lives, 4 shots or a bomb break the shield */
class Necromancer extends Boss {
  // weighted minion pool: mostly zombies and skeletons, spiders now and then, goblins rarely
  static MINIONS = [{kind: Enemy, weight: 4}, {kind: Skeleton, weight: 4}, {kind: Spider, weight: 2}, {kind: Goblin, weight: 1}];
  static WAVE        = 9;   // s between waves
  static CAST        = 1.4; // s standing still, spots marked, before the wave rises
  static SHIELD_DOWN = 6;   // s the shield stays broken
  static SHIELD_HITS = 4;   // shots to break it, a bomb breaks it at once

  constructor(cx, cy, tier=0) {
    super(cx, cy, tier);
    this.name = 'Necromancer';
    this.sprite = 'necromancer';
    this.setHp(14);
    this.patterns = ['fan', 'burst'];
    this.reloadTime = 2.6;
    this.wave = 0;
    this.waveTimer = 2;
    this.minions = [];
    this.casting = null; // {cells, timer} while raising a wave
    this.shieldDown = 0;
    this.shieldHits = 0;
    this.shieldBlink = 0;
  }

  get shielded() {
    return this.shieldDown <= 0 && this.minions.some(m => m.alive);
  }

  update(dt) {
    this.shieldDown = Math.max(0, this.shieldDown - dt);
    this.shieldBlink = Math.max(0, this.shieldBlink - dt);
    // a fresh shield takes the full count again
    if(!this.shielded) this.shieldHits = 0;

    if(this.casting) {
      this.casting.timer -= dt;
      if(this.casting.timer <= 0) this.raise();
      Actor.prototype.update.call(this, dt);
      return;
    }

    if(this.hunting) {
      this.waveTimer -= dt;
      if(this.waveTimer <= 0) this.cast(Math.min(2 + this.wave, 6) + (this.enraged? 1: 0));
    }
    super.update(dt);
  }

  /** Stops and marks where the wave will rise */
  cast(count) {
    const cells = this.spots(count);
    if(!cells.length) {
      this.waveTimer = 2;
      return;
    }
    this.casting = {cells, timer: Necromancer.CAST};
    this.queue = [];
    Game.float('rise!', this.cx, this.cy - 44, '#bd93f9');
  }

  /** The marked minions come up, at half the health of their kind on this floor */
  raise() {
    const T = Floor.TILE;
    const pool = Necromancer.MINIONS;
    const total = pool.reduce((sum, m) => sum + m.weight, 0);
    this.casting.cells.forEach(({x, y}) => {
      let roll = Math.random() * total;
      const Kind = pool.find(m => (roll -= m.weight) < 0)?.kind ?? Enemy;
      const minion = new Kind((x + 0.5) * T, (y + 0.5) * T, this.tier);
      minion.hp = minion.maxHp = Math.max(1, Math.ceil(minion.maxHp / 2));
      minion.provoke();
      Game.actors.push(minion);
      this.minions.push(minion);
    });
    this.minions = this.minions.filter(m => m.alive);
    this.casting = null;
    this.wave++;
    this.waveTimer = Necromancer.WAVE;
  }

  /** Free arena tiles away from the hero, shuffled */
  spots(count) {
    const T = Floor.TILE;
    const {hero} = Game;
    const a = Game.arena;
    let cells = [];
    for(let y = a.y; y < a.y + a.height; y++)
      for(let x = a.x; x < a.x + a.width; x++)
        if(Enemy.walkable(x, y) && Math.hypot((x + 0.5) * T - hero.x, (y + 0.5) * T - hero.y) > T * 3 &&
           !Game.actors.some(o => o instanceof Enemy && o.tx === x && o.ty === y)) cells.push({x, y});

    for(let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return cells.slice(0, count);
  }

  hit(damage, fromX, fromY, kind='shot') {
    if(this.shielded) {
      const broken = kind === 'blast' || ++this.shieldHits >= Necromancer.SHIELD_HITS;
      if(!broken) {
        this.shieldBlink = 0.2;
        return;
      }
      this.shieldDown = Necromancer.SHIELD_DOWN;
      this.shieldHits = 0;
      Game.float('shield broken', this.cx, this.cy - 44, '#8be9fd');
      // the breaking shot is spent on the shield, a bomb goes through
      if(kind !== 'blast') return;
    }
    super.hit(damage, fromX, fromY, kind);
  }

  draw(ctx) {
    this.casting?.cells.forEach(({x, y}) => Actor.drawMark(ctx, (x + 0.5) * Floor.TILE, (y + 0.5) * Floor.TILE, this.casting.timer));
    super.draw(ctx);
    // shield ring, fading with each shot it takes and blinking on a hit
    if(!this.shielded || Math.floor(this.shieldBlink * 30) % 2) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.shieldBlink > 0? '#f8f8f2': '#bd93f9';
    ctx.globalAlpha = 0.9 - this.shieldHits * 0.18;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.half + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Arms up while casting */
  squish() {
    if(this.casting) return [0.92, 1.1];
    return super.squish();
  }
}

/** Slime King: bounces around the sealed arena, speeding up as it loses health; every hit splits off a slime, full size when it's low */
class SlimeKing extends Boss {
  static SPEED  = {min: 60, max: 130};
  static SLIMES = 8;   // slimes alive at most
  static BIG    = 0.4; // below this health share the split slimes come out full size
  static RAGE   = [{below: 0.25, boost: 1.3}, {below: 0.5, boost: 1.15}]; // extra speed under these health shares
  static DASH   = {chance: 0.4, reach: Floor.TILE * 12, boost: 2.2}; // on a wall bounce, at the hero in reach, until the next wall
  static WILD   = {after: 2, chance: 0.3}; // s of plain walking after a bounce, then maybe a dash in a random direction

  constructor(cx, cy, tier=0) {
    super(cx, cy, tier);
    this.name = 'Slime King';
    this.sprite = 'slimeKing';
    this.setHp(16);
    const angle = Math.PI / 4 + Math.floor(Math.random() * 4) * Math.PI / 2;
    this.vx = Math.cos(angle);
    this.vy = Math.sin(angle);
    this.dashing = false;
    this.walked = 0;     // s of plain walking since the last bounce
    this.rolled = false; // the wild dash was already rolled for this bounce
  }

  update(dt) {
    // waits until the hero is locked in with it
    if(Game.arenaSeal) {
      if(!this.dashing && !this.rolled && (this.walked += dt) >= SlimeKing.WILD.after) this.wildDash();
      const left = this.hp / this.maxHp;
      const rage = SlimeKing.RAGE.find(r => left <= r.below)?.boost ?? 1;
      const speed = (SlimeKing.SPEED.max - (SlimeKing.SPEED.max - SlimeKing.SPEED.min) * left) * rage
                  * (this.dashing? SlimeKing.DASH.boost: 1);
      const nx = this.cx + this.vx * speed * dt, ny = this.cy + this.vy * speed * dt;
      let bounced = false;
      if(this.fits(nx, this.cy)) this.cx = nx; else { this.vx *= -1; bounced = true; }
      if(this.fits(this.cx, ny)) this.cy = ny; else { this.vy *= -1; bounced = true; }
      if(bounced) this.bounce();
    }
    Actor.prototype.update.call(this, dt);
  }

  /** Once per bounce, after walking a while: sometimes dashes off in a random direction */
  wildDash() {
    this.rolled = true;
    if(Math.random() >= SlimeKing.WILD.chance) return;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle);
    this.vy = Math.sin(angle);
    this.dashing = true;
  }

  /** A wall ends a dash; sometimes it launches straight at the hero when close enough */
  bounce() {
    this.walked = 0;
    this.rolled = false;
    const {hero} = Game;
    const dx = hero.x - this.cx, dy = hero.y - this.cy, dist = Math.hypot(dx, dy);
    this.dashing = dist > 0 && dist <= SlimeKing.DASH.reach && Math.random() < SlimeKing.DASH.chance;
    if(!this.dashing) return;
    this.vx = dx / dist;
    this.vy = dy / dist;
  }

  hit(damage, fromX, fromY, kind='shot') {
    this.hp -= damage;
    this.flash = 0.25;
    if(!this.alive || Game.actors.filter(a => a instanceof Slime && a.alive).length >= SlimeKing.SLIMES) return;
    const T = Floor.TILE;
    const tile = Game.floor.tileAt(this.cx, this.cy);
    const big = this.hp / this.maxHp < SlimeKing.BIG;
    const slime = new Slime((tile.x + 0.5) * T, (tile.y + 0.5) * T, this.tier, !big);
    slime.called = true; // its slimes never call more
    slime.provoke();
    Game.actors.push(slime);
  }

  /** Squash as it bounces */
  squish() {
    const s = Math.abs(Math.sin(Game.time * 8)) * 0.12;
    return [1 + s, 1 - s];
  }
}

/**
 * Golem: slow and armored in front. Picks an attack each cycle: a charge that stops dead at a wall (stunned, spikes around),
 * a ground pound when the hero is close, or a line of spikes running at the hero
 */
class Golem extends Boss {
  static STEP   = {move: 0.35, pause: 0.5, length: Floor.TILE * 0.8}; // heavy strides at the hero, off the grid: s moving, s still, px
  static CHARGE = 380; // px/s
  static TRAIL  = 0.15; // chance each tile left behind in a charge grows spikes
  static TIMES  = {walk: 1.6, windup: 0.7, stun: 2.5, pound: 0.35, line: 0.5, recover: 0.9}; // s
  static SLAM   = 3;   // s the spikes around a slam stay
  static POUND  = Floor.TILE * 3.2; // ground pound reach, also how close the hero must be for it
  static LINE   = {tiles: 12, step: 0.07, ttl: 1.5}; // spike line: length, s between spikes, s each stays

  constructor(cx, cy, tier=0) {
    super(cx, cy, tier);
    this.name = 'Golem';
    this.sprite = 'golem';
    this.setHp(24);
    this.state = 'walk';
    this.timer = Golem.TIMES.walk;
    this.face = {x: 1, y: 0};
    this.spikes = []; // {delay, x, y} of the spike line still to come up
    this.history = []; // last two attacks
    this.stride = {t: 0, moving: false};
  }

  update(dt) {
    const {hero} = Game;
    const active = this.hunting || this.state !== 'walk';
    this.timer -= dt;

    switch(this.state) {
      case 'walk':
        if(!active) break;
        this.turn();
        this.step(dt);
        if(this.timer <= 0) this.choose();
        break;
      case 'windup':
      case 'line':
        // aim locked since choose(): its back stays open while it prepares
        if(this.timer > 0) break;
        if(this.state === 'windup') this.set('charge');
        else {
          this.spikeLine();
          this.set('recover');
        }
        break;
      case 'pound':
        if(this.timer > 0) break;
        this.pound();
        this.set('recover');
        break;
      case 'charge':
        this.charge(dt);
        break;
      case 'stun':
      case 'recover':
        if(this.timer <= 0) this.set('walk');
        break;
    }

    for(const s of this.spikes) {
      s.delay -= dt;
      if(s.delay <= 0) Game.spawnSpikes([s], Golem.LINE.ttl);
    }
    this.spikes = this.spikes.filter(s => s.delay > 0);
    Actor.prototype.update.call(this, dt);
  }

  /** Pound when the hero is close, otherwise a charge or a spike line; never the same attack three times in a row */
  choose() {
    const {hero} = Game;
    const close = Math.hypot(hero.x - this.cx, hero.y - this.cy) < Golem.POUND;
    const [a, b] = this.history.slice(-2);
    const tired = a === b? a: null;
    let options = (close? ['pound']: ['windup', 'line']).filter(o => o !== tired);
    if(!options.length) options = ['windup', 'line'];
    const attack = options[Math.floor(Math.random() * options.length)];
    this.history = [...this.history.slice(-1), attack];
    // aims once, then holds that direction through the windup
    this.turn();
    this.set(attack);
  }

  /** Alternates a stride toward the hero and a pause, like the zombie's dashes; speed eases in and out over each stride */
  step(dt) {
    const {STEP} = Golem;
    const s = this.stride;
    s.t -= dt;
    if(s.t <= 0) {
      s.moving = !s.moving;
      s.t = s.moving? STEP.move: STEP.pause;
    }
    if(!s.moving) return;
    // sin over the stride integrates to 2/π, so π/2 makes it cover the full length
    const k = 1 - s.t / STEP.move;
    const {hero} = Game;
    this.approach(hero.x, hero.y, STEP.length / STEP.move * Math.PI / 2 * Math.sin(k * Math.PI), dt);
  }

  /** Faces the hero */
  turn() {
    const {hero} = Game;
    const dist = Math.hypot(hero.x - this.cx, hero.y - this.cy) || 1;
    this.face = {x: (hero.x - this.cx) / dist, y: (hero.y - this.cy) / dist};
    this.facing = this.face.x < 0? 1: -1;
  }

  set(state) {
    this.state = state;
    this.timer = Golem.TIMES[state] ?? 0;
  }

  /** Straight line in small steps, stopping dead at the first one that doesn't fit (no sliding along walls) */
  charge(dt) {
    const dist = Golem.CHARGE * dt;
    const steps = Math.ceil(dist / Actor.STEP);
    const sx = this.face.x * dist / steps, sy = this.face.y * dist / steps;
    for(let s = 0; s < steps; s++) {
      if(!this.fits(this.cx + sx, this.cy + sy)) return this.slam();
      this.cx += sx;
      this.cy += sy;
      this.trail();
    }
  }

  /** Sometimes leaves spikes on the tile it just charged out of */
  trail() {
    const {floor} = Game;
    const tile = floor.tileAt(this.cx, this.cy);
    const last = this.lastTile;
    this.lastTile = tile;
    if(!last || (last.x === tile.x && last.y === tile.y)) return;
    if(Math.random() < Golem.TRAIL && floor.isFree(last.x, last.y)) Game.spawnSpikes([last], Golem.SLAM);
  }

  /** Hit a wall: stunned, spikes come up on the free tiles around it */
  /** Hits the wall: stunned, a blast like the pound around it, and a ring of spikes */
  slam() {
    this.set('stun');
    this.lastTile = null;
    Game.float('stunned', this.cx, this.cy - 44, '#f1fa8c');
    this.pound();
    const tile = Game.floor.tileAt(this.cx, this.cy);
    let cells = [];
    for(let dy = -2; dy <= 2; dy++)
      for(let dx = -2; dx <= 2; dx++)
        if(Math.max(Math.abs(dx), Math.abs(dy)) === 2) cells.push({x: tile.x + dx, y: tile.y + dy});
    Game.spawnSpikes(cells.filter(t => Game.floor.isFree(t.x, t.y)), Golem.SLAM);
  }

  /** Shockwave around it, hurting the hero in reach */
  pound() {
    const {hero} = Game;
    Game.blasts.push({x: this.cx, y: this.cy, t: 0, hostile: true, r: Golem.POUND});
    if(Math.hypot(hero.x - this.cx, hero.y - this.cy) <= Golem.POUND + 8) Game.hurt(this.damage, this.cx, this.cy);
  }

  /** Spikes rising tile after tile toward the hero, until a wall */
  spikeLine() {
    const T = Floor.TILE;
    const {floor} = Game;
    let last = floor.tileAt(this.cx, this.cy);
    let count = 0;
    for(let d = T * 0.5; count < Golem.LINE.tiles; d += T * 0.5) {
      const tile = floor.tileAt(this.cx + this.face.x * (this.half + d), this.cy + this.face.y * (this.half + d));
      if(tile.x === last.x && tile.y === last.y) continue;
      if(!floor.isOpen(tile.x, tile.y)) break;
      last = tile;
      this.spikes.push({...tile, delay: count++ * Golem.LINE.step});
    }
  }

  /** Armored front, except while stunned */
  hit(damage, fromX, fromY, kind='shot') {
    if(kind === 'shot' && this.state !== 'stun' && Actor.fromFront(this.face, this.cx, this.cy, fromX, fromY))
      return this.blocked();
    this.hp -= damage;
    this.flash = 0.25;
  }

  squish() {
    if(['windup', 'pound', 'line'].includes(this.state)) {
      const s = Math.sin(Game.time * 40) * 0.06;
      return this.state === 'pound'? [1 + s + 0.08, 1 - s - 0.08]: [1 + s, 1 - s];
    }
    if(this.state === 'stun') return [1.08, 0.92];
    // leans into each stride
    if(this.state === 'walk' && this.stride.moving) {
      const s = Math.sin((1 - this.stride.t / Golem.STEP.move) * Math.PI);
      return [1 + 0.12 * s, 1 - 0.1 * s];
    }
    return [1, 1];
  }
}

/** Worm: swims under the floor, a ring and cracks mark where it surfaces next to the hero; comes up with one of several volleys, sometimes chaining quick dives */
class Worm extends Boss {
  static TIMES   = {under: [1, 1.6], quick: 0.45, warn: 0.75, up: 1.8}; // s
  static ATTACKS = ['ring', 'double', 'spiral', 'fans', 'cross'];
  static ENRAGED = {pace: 0.7, speed: 1.3}; // below half health: time multiplier, shot speed multiplier
  // triple: marks 3 spots one after another, then pops up at each in turn with a small ring
  // chance per surfacing (never twice in a row; low below the low health share), s between marks, first pop, s between pops,
  // s up after the last, shots per ring
  static TRIPLE  = {chance: 0.3, low: 0.6, below: 0.4, mark: 0.2, first: 0.8, gap: 0.4, last: 1.4, ring: 8};
  static RISE    = 0.18; // s the sprite takes to slide out of the ground, or back into it

  constructor(cx, cy, tier=0) {
    super(cx, cy, tier);
    this.name = 'Worm';
    this.sprite = 'worm';
    this.setHp(18);
    this.state = 'up';
    this.timer = 0;
    this.attack = null;
    this.rising = Worm.RISE; // s into coming up, starts fully out
    this.sinking = 0;        // s left of going down
  }

  get hittable() { return this.state === 'up' || (this.state === 'triple' && this.triple.i >= 0); }

  update(dt) {
    this.rising = Math.min(Worm.RISE, this.rising + dt);
    this.sinking = Math.max(0, this.sinking - dt);
    // waits up and still until the hero is locked in with it
    if(Game.arenaSeal) {
      if(this.state === 'triple') this.tripleStep(dt);
      else {
        this.timer -= dt;
        if(this.timer <= 0) this.next();
      }
    }
    Actor.prototype.update.call(this, dt);
  }

  /** Time multiplier: everything runs quicker below half health */
  get pace() { return this.enraged? Worm.ENRAGED.pace: 1; }

  /** Faster shots below half health */
  shot() {
    return {damage: this.damage, speed: Projectile.SPEED * (this.enraged? Worm.ENRAGED.speed: 1)};
  }

  next() {
    switch(this.state) {
      case 'up': {
        // now and then it dives right back up somewhere else
        const chain = Math.random() < (this.enraged? 0.6: 0.35);
        const [lo, hi] = Worm.TIMES.under;
        this.state = 'under';
        this.timer = (chain? Worm.TIMES.quick: lo + Math.random() * (hi - lo)) * this.pace;
        this.dig('sinking');
        break;
      }
      case 'under': {
        const {chance: base, low, below} = Worm.TRIPLE;
        const chance = this.attack === 'triple'? 0: this.hp / this.maxHp < below? low: base;
        if(Math.random() < chance && this.startTriple()) break;
        // surfaces next to where the hero is now, it has the warning to move away
        const spot = this.spot();
        if(!spot) {
          this.timer = 0.3;
          break;
        }
        this.cx = spot.x;
        this.cy = spot.y;
        this.state = 'warn';
        this.timer = Worm.TIMES.warn * this.pace;
        break;
      }
      case 'warn':
        this.state = 'up';
        this.timer = Worm.TIMES.up * this.pace;
        this.dig('rising');
        this.volley();
        break;
    }
  }

  /** Queues a volley different from the last one, bigger and quicker when enraged */
  volley() {
    const options = Worm.ATTACKS.filter(a => a !== this.attack);
    this.attack = options[Math.floor(Math.random() * options.length)];
    const more = this.enraged? 1.5: 1;
    const shot = (delay, angle) => this.queue.push({delay: delay * this.pace, angle});
    const aim = this.aim, turn = Math.random() * Math.PI * 2;

    switch(this.attack) {
      case 'ring': {
        const n = Math.round(12 * more);
        for(let i = 0; i < n; i++) shot(0, turn + i * Math.PI * 2 / n);
        break;
      }
      case 'double': {
        // two rings, the second fills the gaps of the first
        const n = Math.round(10 * more);
        for(let i = 0; i < n; i++) {
          shot(0, turn + i * Math.PI * 2 / n);
          shot(0.3, turn + (i + 0.5) * Math.PI * 2 / n);
        }
        break;
      }
      case 'spiral': {
        const n = Math.round(18 * more), side = Math.random() < 0.5? 1: -1;
        for(let i = 0; i < n; i++) shot(i * 0.06, turn + side * i * 0.45);
        break;
      }
      case 'fans':
        // three aimed fans of five
        for(let k = 0; k < 3; k++)
          for(let i = 0; i < 5; i++) shot(k * 0.35, aim + (i / 4 - 0.5) * (0.7 + 0.2 * more));
        break;
      case 'cross':
        // three waves of eight, each turned a little
        for(let k = 0; k < Math.round(3 * more); k++)
          for(let i = 0; i < 8; i++) shot(k * 0.25, turn + k * Math.PI / 12 + i * Math.PI / 4);
        break;
    }
  }

  /** Picks 3 spots (the first next to the hero, the others anywhere in the arena, apart); false when they don't fit */
  startTriple() {
    const T = Floor.TILE;
    const {floor} = Game;
    const a = Game.arena;
    const first = this.spot();
    if(!first) return false;
    const spots = [first];
    let cells = [];
    for(let y = a.y; y < a.y + a.height; y++)
      for(let x = a.x; x < a.x + a.width; x++)
        if(floor.isFree(x, y)) cells.push({x: (x + 0.5) * T, y: (y + 0.5) * T});
    cells.sort(() => Math.random() - 0.5);
    for(const c of cells) {
      if(spots.length === 3) break;
      if(spots.every(s => Math.hypot(s.x - c.x, s.y - c.y) >= T * 3)) spots.push(c);
    }
    if(spots.length < 3) return false;
    this.state = 'triple';
    this.attack = 'triple';
    this.triple = {spots, t: 0, i: -1};
    return true;
  }

  /** Pops up at each marked spot in order, a ring at each; dives after the last */
  tripleStep(dt) {
    const tr = this.triple, {first, gap, last, ring} = Worm.TRIPLE;
    tr.t += dt / this.pace;
    const n = tr.i + 1;
    if(n < tr.spots.length && tr.t >= first + n * gap) {
      // dives out of the last spot, then pops up at the next
      if(n > 0) this.dig('sinking');
      tr.i = n;
      ({x: this.cx, y: this.cy} = tr.spots[n]);
      this.dig('rising');
      const count = Math.round(ring * (this.enraged? 1.5: 1)), turn = Math.random() * Math.PI * 2;
      for(let i = 0; i < count; i++) this.queue.push({delay: 0, angle: turn + i * Math.PI * 2 / count});
    }
    else if(tr.i === tr.spots.length - 1 && tr.t >= first + tr.i * gap + last) {
      // back to the normal cycle: dives from here
      this.state = 'up';
      this.timer = 0;
    }
  }

  /** Center of a free tile one or two steps from the hero, inside the arena */
  spot() {
    const T = Floor.TILE;
    const {hero, floor} = Game;
    const a = Game.arena;
    const h = floor.tileAt(hero.x, hero.y);
    let cells = [];
    for(let dy = -2; dy <= 2; dy++)
      for(let dx = -2; dx <= 2; dx++) {
        const x = h.x + dx, y = h.y + dy;
        if((dx || dy) && floor.isFree(x, y) && x >= a.x && x < a.x + a.width && y >= a.y && y < a.y + a.height) cells.push({x, y});
      }
    const pick = cells[Math.floor(Math.random() * cells.length)];
    return pick && {x: (pick.x + 0.5) * T, y: (pick.y + 0.5) * T};
  }

  /** Starts coming up or going down where it stands, kicking up dirt */
  dig(way) {
    if(way === 'rising') this.rising = 0;
    else {
      this.sinking = Worm.RISE;
      this.sunk = {x: this.cx, y: this.cy};
    }
    Effects.burst(this.cx, this.cy + Floor.TILE * 0.8, {count: 8, colors: Effects.COLORS.dirt, speed: 70, life: 0.5, gravity: 260, spread: Floor.TILE});
  }

  /** The sprite pushed down by the part still underground, cut at the ground line; k = share above ground */
  drawRisen(ctx, x, y, k) {
    const size = Floor.TILE * this.tiles;
    const ground = Math.round(y + size / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - size, ground - size * 2, size * 2, size * 2);
    ctx.clip();
    ctx.translate(x - this.cx, y - this.cy + Math.round((1 - k) * size));
    this.digK = k;
    super.draw(ctx);
    ctx.restore();
  }

  /** Stretches up a little while passing through the ground, back to the floating wobble once out */
  squish() {
    if(this.digK < 1) {
      const s = Math.sin(this.digK * Math.PI) * 0.1;
      return [1 - s, 1 + s];
    }
    return super.squish();
  }

  draw(ctx) {
    // going down where it last stood, while the next spot may already show its mark
    if(this.sinking > 0) this.drawRisen(ctx, this.sunk.x, this.sunk.y, this.sinking / Worm.RISE);
    if(this.state === 'under') return;
    if(this.state === 'warn') return Actor.drawMark(ctx, this.cx, this.cy, this.timer);
    if(this.state === 'triple') {
      // marks show one by one and stay until their pop
      const tr = this.triple, {mark, first, gap} = Worm.TRIPLE;
      tr.spots.forEach((s, i) => {
        if(i > tr.i && tr.t >= i * mark) Actor.drawMark(ctx, s.x, s.y, (first + i * gap - tr.t) * this.pace);
      });
      if(tr.i < 0) return;
    }
    if(this.sinking > 0 && this.sunk.x === this.cx && this.sunk.y === this.cy) return;
    this.drawRisen(ctx, this.cx, this.cy, this.rising / Worm.RISE);
  }
}
