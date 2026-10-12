/** Enemy variations on top of the zombie (Enemy) and skeleton (Skeleton) */

/** Slime: slow grid hopper that may call another when first hit, and splits in up to two small ones when it dies */
class Slime extends Enemy {
  static CALL = 0.3; // chance the first hit makes another slime
  static PAIR = 0.4; // chance a floor spawn comes as a couple (Populate)
  static SPLIT = 2;  // most small slimes left on death, 0 to this

  constructor(cx, cy, tier=0, small=false) {
    super(cx, cy, tier, 'slime');
    this.small = small;
    this.called = small; // small ones and called ones never call
    this.diagonal = 0.2;
    this.dash = 0.25;
    this.pause = {chase: 0.6, wander: 1.6};
    if(small) {
      this.hp = this.maxHp = 1;
      this.sprite = 'smallSlime'; // its own smaller drawing, not the slime scaled down
      this.dash = 0.18;
      this.pause = {chase: 0.35, wander: 1.2};
    }
  }

  hit(...args) {
    super.hit(...args);
    if(this.called || !this.alive) return;
    this.called = true;
    if(Math.random() >= Slime.CALL) return;
    // the new one comes out on a free neighbor, already chasing
    const T = Floor.TILE;
    const near = Enemy.DIRS.map(([dx, dy]) => ({x: this.tx + dx, y: this.ty + dy})).find(t => Enemy.walkable(t.x, t.y));
    if(!near) return;
    const s = new Slime((near.x + 0.5) * T, (near.y + 0.5) * T, this.tier);
    s.called = true;
    s.provoke();
    Game.actors.push(s);
  }

  died() {
    if(this.small) return;
    // 0 to SPLIT of them: the first on its tile, the next on a free neighbor when there is one
    const T = Floor.TILE;
    const near = Enemy.DIRS.map(([dx, dy]) => ({x: this.tx + dx, y: this.ty + dy})).find(t => Enemy.walkable(t.x, t.y));
    const count = Math.floor(Math.random() * (Slime.SPLIT + 1));
    [{x: this.tx, y: this.ty}, near ?? {x: this.tx, y: this.ty}].slice(0, count).forEach(t => {
      const s = new Slime((t.x + 0.5) * T, (t.y + 0.5) * T, this.tier, true);
      s.provoke();
      Game.actors.push(s);
    });
  }
}

/** Mimic: sleeps as a chest (Entity with mimic), wakes when hovered and runs the hero down */
class Mimic extends Enemy {
  constructor(cx, cy, tier=0) {
    super(cx, cy, tier, 'mimic');
    this.hp = this.maxHp = 4 + tier;
    this.damage++;
    this.diagonal = 0.4;
    this.dash = 0.1;
    this.pause = {chase: 0.15, wander: 0.8};
    this.provoke();
  }

  /** Pays like the chest it pretended to be */
  died() {
    Game.give('gold', 20 + Game.depth * 2, this.cx, this.cy - 14);
    Game.give('item', 1, this.cx, this.cy - 28);
  }
}

/** Spider: waits still until it sees the hero, then keeps away spitting webs that slow it */
class Spider extends Skeleton {
  constructor(cx, cy, tier=0) {
    super(cx, cy, tier, 'spider');
    this.reloadTime = 2.5;
    this.keep = Floor.TILE * 3; // closer than the skeleton
  }

  shot() {
    // a bit faster than other shots; sticks to the wall it hits for a while, still slowing on touch
    return {damage: 0, sprite: 'web', effect: 'slow', speed: Projectile.SPEED * 1.25, stick: 3};
  }

  /** One web at a time on any floor */
  get burst() { return 1; }

  /** Lurks: no wandering */
  wanderStep() {
    return null;
  }
}

/** Goblin: keeps away and lobs bombs onto the hero's tile; they hurt only the hero, walls stay */
class Goblin extends Skeleton {
  constructor(cx, cy, tier=0) {
    super(cx, cy, tier, 'goblin');
    this.keep = Floor.TILE * 4;
    this.reloadTime = 3;
  }

  attack() {
    Game.throwBomb(Game.hero.x, Game.hero.y, this.damage);
  }
}

/** Knight: slow chaser with a shield up front; shots only hurt from behind or the sides, bombs always */
class Knight extends Enemy {
  static SHIELD = Floor.TILE; // px, shield sprite drawn size, same pixel scale as the knight

  constructor(cx, cy, tier=0) {
    super(cx, cy, tier, 'knight');
    this.hp = this.maxHp = 3 + tier;
    this.diagonal = 0.2;
    this.dash = 0.2;
    this.pause = {chase: 0.75, wander: 1.6};
    this.dir = [-1, 0]; // the sprite faces left, start with the shield there too
  }

  /** Unit vector of the shield: the direction of its last step, it only turns when it moves */
  get face() {
    const [x, y] = this.dir;
    const len = Math.hypot(x, y) || 1;
    return {x: x / len, y: y / len};
  }

  hit(damage, fromX, fromY, kind='shot') {
    if(kind === 'shot' && Actor.fromFront(this.face, this.cx, this.cy, fromX, fromY)) {
      this.blocked();
      this.provoke();
      return;
    }
    super.hit(damage);
  }

  /** Shield sprite on the front side, at the knight's scale; drawn over the knight unless it's held up toward the back */
  draw(ctx) {
    const {y} = this.face;
    if(y < 0) this.drawShield(ctx);
    super.draw(ctx);
    if(y >= 0) this.drawShield(ctx);
  }

  /** The sprite faces left like the others: turned toward the face, mirrored on the right half so it stays upright */
  drawShield(ctx) {
    const {x, y} = this.face;
    const size = Knight.SHIELD;
    ctx.save();
    ctx.translate(Math.round(this.cx + x * 16), Math.round(this.cy + y * 16));
    if(x > 0) ctx.scale(-1, 1);
    ctx.rotate(Math.atan2(y, -Math.abs(x)) - Math.PI);
    Sprites.draw(ctx, 'shield', -size / 2, -size / 2, size);
    ctx.restore();
  }
}
