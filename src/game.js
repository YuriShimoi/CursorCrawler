/** Game state, input, mechanics and render loop */
class Game {
  static LIGHT_RADIUS    = Floor.TILE * 6;
  static ARENA_LIGHT     = Floor.TILE * 28; // reaches every corner of a 16x11 arena
  static REACH           = 12;   // px from the cursor tip to a target
  static INVULNERABLE    = 1;    // s after taking damage
  static SHOT_COOLDOWN   = 0.3;  // s
  static MAX_HP          = 12;   // half hearts, six hearts
  static REST_HEAL       = 2;    // half hearts a campfire gives back, one heart
  static SHOP_FADE       = 150;  // ms, shop room in and out
  static REVEAL          = 800;  // ms, darkness fading off the floor on death
  static GOBLIN_FUSE     = 1.4;  // s, goblin bombs
  static BOX_BOMB        = 0.1;  // chance a box holds a goblin bomb, on floors that spawned goblins
  static SLOW            = {time: 2, factor: 0.3}; // web hit: s, movement multiplier
  static AIM             = {min: 14, max: 72};  // px pull from the press point: shoots past min, clamped at max
  static GROW_CHANCE     = 0.4;  // a gem at full health adds half a max heart, otherwise gold
  static GOLD_RATE       = 0.5;  // scales every coin drop
  // s held still, s, px to cracked walls, px to actors, hp at the center (falls off to 1 at the edge), s of ring
  static BOMB            = {hold: 0.8, fuse: 1.5, reach: Floor.TILE * 1.2, actorReach: Floor.TILE * 3, damage: 3, blast: 0.3};

  static layers = {};
  static state  = 'menu'; // menu | play | pause | dead
  static depth  = 0;
  static floor  = null;
  static hero   = null;
  static light  = null;
  static offset = {x: 0, y: 0};
  static target = null;   // interaction under the hero

  static stats       = {};
  static entities    = [];
  static actors      = [];
  static projectiles = [];
  static floats      = []; // rising feedback texts
  static bombs       = []; // {x, y, fuse} ticking on the ground
  static blasts      = []; // {x, y, t} explosion rings
  static slow        = 0;    // s left webbed
  static aim         = null; // {x, y, hold} press point and s held still, while the right button is down

  static time         = 0;
  static last         = 0;
  static invulnerable = 0;
  static cooldown     = 0;
  static bossSeen     = false;
  static arena        = null; // boss room on boss floors
  static arenaSeal    = null; // {x, y, tile} passages walled up while fighting the boss
  static descending   = false;
  static credits      = false; // in the credits room (Credits), shown once per run
  static shop         = null; // open Shop, holding the dungeon floor and entities in .saved
  static buildFloor   = null; // test hook: (cols, rows, start, depth) => {floor, entities, actors, arena}

  //#region [ SETUP ]
  static init(container) {
    Canvas.container = container;
    Sound.init();
    Game.layers.background = new Canvas('background');
    Game.layers.walls      = new Canvas('walls', 10);
    Game.layers.actors     = new Canvas('actors', 15);
    Game.layers.light      = new Canvas('light', 20);
    Game.layers.shop       = new Canvas('shop', 25);
    Game.layers.hero       = new Canvas('hero', 30);
    Game.layers.shop.element.style.transition = `opacity ${Game.SHOP_FADE}ms ease`;
    Game.layers.shop.element.style.opacity = 0;

    // while aiming the hero is held inside the pull circle
    document.addEventListener('mousemove', e => {
      if(Game.state !== 'play') return;
      const [dx, dy] = Game.aim? Game.pullLimit(e.movementX, e.movementY): [e.movementX, e.movementY];
      const k = Game.slow > 0? Game.SLOW.factor: 1;
      Game.hero.move(dx * k, dy * k, Game.floor);
    });

    document.addEventListener('mousedown', e => {
      if(Game.state !== 'play') return;
      if(e.button === 0 && Game.target?.enabled) Game.interact(Game.target);
      if(e.button === 2 && !Game.shop) Game.aim = {x: Game.hero.x, y: Game.hero.y, hold: 0};
    });

    document.addEventListener('mouseup', e => {
      if(Game.state === 'play' && e.button === 2) Game.shoot();
    });

    document.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      if(!document.pointerLockElement && Game.state === 'play') Game.pause();
    });

    addEventListener('resize', () => Game.layout());

    requestAnimationFrame(Game.loop);
  }

  /** Fits the layers to the window and centers the current map */
  static layout() {
    Object.values(Game.layers).forEach(l => l.resize(innerWidth, innerHeight));
    if(!Game.floor) return;

    const T = Floor.TILE;
    Game.offset = {
      x: Math.floor((innerWidth  - Game.floor.cols * T) / 2),
      y: Math.floor((innerHeight - Game.floor.rows * T) / 2)
    };
    Game.drawFloor();
    if(Game.state === 'menu') Game.drawDemo();
    else Game.draw();
  }

  /** Start screen backdrop: a whole random floor in view with zombies wandering */
  static demo() {
    const T = Floor.TILE;
    const cols = Math.floor(innerWidth  / T);
    const rows = Math.floor(innerHeight / T);
    // any floor before the first boss one
    const depth = 1 + Math.floor(Math.random() * (Floor.BOSS_EVERY - 1));

    Game.hero = new Hero(-1e4, -1e4); // far away, nothing notices it
    Game.closeShop();
    Game.floor = new Floor(cols, rows, {x: cols >> 1, y: rows >> 1}, depth);
    const {entities, actors} = Populate.run(Game.floor, depth);
    entities.forEach(e => e.type === 'torch' && (e.lit = true));
    Game.entities = entities;
    Game.actors = actors;
    Game.clearCombat();
    Game.layout();
  }

  static drawDemo() {
    const {actors, light, hero} = Game.layers;
    light.clear();
    hero.clear();
    actors.clear();
    actors.ctx.translate(Game.offset.x, Game.offset.y);
    Game.actors.forEach(a => a.draw(actors.ctx));
  }

  /** Starts a run with the up stairs under the cursor */
  /**
   * @param {{depth?:number, stats?:Object}} [from] - test hook (docs/arena.html): first floor and starting stats
   */
  static start(clientX, clientY, {depth=1, stats={}}={}) {
    const T = Floor.TILE;
    const cols = Math.floor(innerWidth  / T);
    const rows = Math.floor(innerHeight / T);

    Game.offset = {
      x: Math.floor((innerWidth  - cols * T) / 2),
      y: Math.floor((innerHeight - rows * T) / 2)
    };
    Object.values(Game.layers).forEach(l => l.resize(innerWidth, innerHeight));

    const x = clientX - Game.offset.x;
    const y = clientY - Game.offset.y;
    Game.hero = new Hero(x, y);
    // health counts half hearts: 6 is three hearts
    Game.stats = {hp: 3, maxHp: 3, gold: 0, keys: 0, bombs: 1, ...stats};
    Game.depth = depth - 1;
    Game.credits = false;
    Game.invulnerable = 0;
    Game.descending = false;
    Game.darkness(true);
    Game.descend(cols, rows, {x: Math.floor(x / T), y: Math.floor(y / T)});
    Gui.stats(Game.stats);

    Game.resume();
  }

  /** Builds the next floor with its up stairs at the given tile */
  static descend(cols, rows, start) {
    Game.depth++;
    Game.target = null;
    Game.closeShop();
    Game.clearCombat();
    // test hook (docs/arena.html): a hand-built floor instead of a generated one
    const built = Game.buildFloor?.(cols, rows, start, Game.depth);
    Game.floor = built?.floor ?? new Floor(cols, rows, start, Game.depth);
    Game.light = new Light(cols * Floor.TILE, rows * Floor.TILE, Game.LIGHT_RADIUS);
    Game.hero.placeIn(Game.floor.start.x, Game.floor.start.y);

    const {entities, actors, arena, camp} = built ?? Populate.run(Game.floor, Game.depth);
    Game.entities = entities;
    Game.actors = actors;
    // boxes may hide a goblin bomb on floors where goblins showed up
    Game.goblinFloor = actors.some(a => a instanceof Goblin);
    // the monster camp gets the arena's full-room light too; only a boss seals it
    Game.arena = arena ?? camp;
    Game.arenaSeal = null;
    Game.bossSeen = false;
    Game.floor.sealed = !!Game.boss;

    Game.drawFloor();
    Gui.floor(Game.depth);
    if(Game.boss) Game.float('something watches you', Game.hero.x, Game.hero.y - 20, '#ff5555');
  }

  /** Credits room in place of the next floor, the depth stays until its door */
  static showCredits(cols, rows) {
    Game.credits = true;
    Game.target = null;
    Game.clearCombat();
    const {floor, entities, box} = Credits.build(cols, rows, Game.depth);
    Game.floor = floor;
    Game.light = new Light(cols * Floor.TILE, rows * Floor.TILE, Game.LIGHT_RADIUS);
    Game.hero.placeIn(floor.start.x, floor.start.y);
    Game.entities = entities;
    Game.actors = [];
    Game.goblinFloor = false;
    Game.arena = box;
    Game.arenaSeal = null;
    Game.bossSeen = false;
    Game.floor.sealed = false;

    Game.drawFloor();
    Gui.floor('CREDITS');
  }

  static get boss() {
    // alive check: a boss killed this frame stays in the list until the next filter
    return Game.actors.find(a => a instanceof Boss && a.alive) ?? null;
  }

  /** Drops shots, bombs, texts and the aim, for a fresh floor */
  static clearCombat() {
    Game.projectiles = [];
    Game.floats = [];
    Game.bombs = [];
    Game.blasts = [];
    Game.aim = null;
    Game.slow = 0;
    Effects.clear();
  }
  //#endregion

  //#region [ STATE ]
  static resume() {
    Game.state = 'play';
    Gui.play();
    // pointer lock can be refused right after leaving it
    document.getElementById('screen').requestPointerLock()?.catch?.(() => Game.pause());
  }

  static pause() {
    Game.state = 'pause';
    Game.aim = null;
    Gui.pause();
  }

  /** Death: the hero leaves the map, the floor keeps living behind the menu */
  static die() {
    Game.state = 'dead';
    Sound.play('death');
    Game.floats = [];
    Game.bombs = [];
    Game.aim = null;
    Game.target = null;
    Gui.popover(null);
    // far away, so zombies lose track and go back to wandering
    Game.hero.x = Game.hero.y = -1e4;
    Game.unsealArena();
    Game.darkness(false);
    document.exitPointerLock();
    Gui.dead(Game.depth, Game.stats.gold);
  }

  /** Fades the light layer out (whole floor in view, like the start screen) or snaps it back */
  static darkness(on) {
    const {style} = Game.layers.light.element;
    style.transition = on? 'none': `opacity ${Game.REVEAL}ms ease`;
    style.opacity = on? 1: 0;
  }

  /** Dead screen backdrop: the whole floor in view, actors keep moving */
  static updateDead(dt) {
    Game.time += dt;
    Game.actors.forEach(a => a.update(dt));
    Game.projectiles.forEach(p => p.update(dt));
    Game.projectiles = Game.projectiles.filter(p => p.alive);
    Effects.update(dt);
    if(Effects.changed) Game.drawFloor();

    const actors = Game.layers.actors;
    actors.clear();
    actors.ctx.translate(Game.offset.x, Game.offset.y);
    Game.actors.forEach(a => a.draw(actors.ctx));
    Effects.draw(actors.ctx);
    Game.projectiles.forEach(p => p.draw(actors.ctx));
    Game.layers.hero.clear();
  }
  //#endregion

  //#region [ LOOP ]
  static loop(now) {
    const dt = Math.min((now - Game.last) / 1000 || 0, 0.05);
    Game.last = now;

    if(Game.state === 'play' && Game.floor) {
      Game.update(dt);
      if(Game.state === 'play') Game.draw();
    }
    else if(Game.state === 'menu' && Game.floor) {
      Game.time += dt;
      Game.actors.forEach(a => a.update(dt));
      Game.drawDemo();
    }
    else if(Game.state === 'dead') Game.updateDead(dt);
    // the boss track holds while the arena is sealed, until the boss dies; menus keep the dungeon one
    Sound.update(dt, Game.state === 'play' && Game.arenaSeal && Game.boss? 'boss': 'dungeon');
    requestAnimationFrame(Game.loop);
  }

  static update(dt) {
    const {floor, hero, light} = Game;
    Game.time += dt;
    Game.invulnerable = Math.max(0, Game.invulnerable - dt);
    Game.slow = Math.max(0, Game.slow - dt);
    Game.cooldown = Math.max(0, Game.cooldown - dt);

    // things on the hero's tile
    const tile = floor.tileAt(hero.x, hero.y);
    for(const e of Game.entities) {
      if(!e.alive || e.tx !== tile.x || e.ty !== tile.y) continue;
      if(e.pickup) Game.collect(e);
      if(e.hazard && (floor.spikesOn || e.always)) Game.hurt(1, e.cx, e.cy);
    }

    // the dungeon waits while the hero is in the shop
    if(!Game.shop) {
      Game.actors.forEach(a => a.update(dt));
      Game.spikeActors(dt);
      Game.actors = Game.actors.filter(a => a.alive);
      Game.projectiles.forEach(p => p.update(dt));
      Game.projectiles = Game.projectiles.filter(p => p.alive);
      Game.updateAim(dt);
      Game.updateBombs(dt);
      Game.updateSpikes(dt);
      Effects.update(dt);
      if(Effects.changed) Game.drawFloor();
    }

    Game.floats.forEach(f => {
      f.t += dt;
      f.y -= 22 * dt;
    });
    Game.floats = Game.floats.filter(f => f.t < 1);

    if(Game.shop) {
      Game.target = Game.findTarget();
      Gui.popover(Game.target, hero.x + Game.offset.x, hero.y + Game.offset.y);
      return;
    }

    // inside the boss arena the light covers the whole room, eased in and out
    const a = Game.arena;
    const inside = t => a && t.x >= a.x && t.x < a.x + a.width && t.y >= a.y && t.y < a.y + a.height;
    const inArena = inside(tile);
    // the whole arrow past the doorway: the passages close until the boss or the hero dies
    if(inArena && Game.boss && !Game.arenaSeal && inside(floor.tileAt(hero.x + Hero.BOX.width, hero.y + Hero.BOX.height)))
      Game.sealArena();
    const reach = inArena? Game.ARENA_LIGHT: Game.LIGHT_RADIUS;
    light.hero.radius += (reach - light.hero.radius) * Math.min(1, dt * 4);

    light.cast(hero.x, hero.y, floor.segments);
    light.findWalls(floor);
    Game.discoverLights();

    // boss bar shows from the moment it's seen
    const boss = Game.boss;
    if(boss && light.isLit(boss.cx, boss.cy)) Game.bossSeen = true;
    Gui.boss(Game.bossSeen? boss: null);

    Game.target = Game.findTarget();
    if(Game.target?.entity?.mimic) {
      Game.wakeMimic(Game.target.entity);
      Game.target = null;
    }
    Gui.popover(Game.target, hero.x + Game.offset.x, hero.y + Game.offset.y);
  }

  static draw() {
    const {hero, light, offset} = Game;

    // in the shop the dungeon keeps its last frame under the shop layer
    if(!Game.shop) {
      light.remember();
      light.draw(Game.layers.light, offset.x, offset.y);

      // moving things only show while lit
      const actors = Game.layers.actors;
      actors.clear();
      actors.ctx.translate(offset.x, offset.y);
      Game.drawBombs(actors.ctx);
      Game.actors.forEach(a => {
        if(!light.isLit(a.cx, a.cy)) return;
        a.inView = light.inView(a.cx, a.cy);
        a.draw(actors.ctx);
      });
      Effects.draw(actors.ctx);
      // the hero's own shots stay visible in the dark
      Game.projectiles.forEach(p => (!p.hostile || light.isLit(p.x, p.y)) && p.draw(actors.ctx));
    }

    const layer = Game.layers.hero;
    layer.clear();
    layer.ctx.translate(offset.x, offset.y);
    Game.drawAim(layer.ctx);
    layer.ctx.globalAlpha = Game.invulnerable > 0 && Math.floor(Game.time * 12) % 2? 0.35: 1;
    // cracked walls only show a hint, they aren't clickable
    hero.draw(layer.ctx, Game.target !== null && Game.target.entity?.type !== 'crack');
    layer.ctx.globalAlpha = 1;
    Game.drawFloats(layer.ctx);
  }

  /** Floor, walls and props, plus the shop over them when open; redrawn when a prop changes */
  static drawFloor() {
    const {background, walls, shop} = Game.layers;
    const {floor, entities} = Game.dungeon;
    background.clear();
    walls.clear();
    background.ctx.translate(Game.offset.x, Game.offset.y);
    walls.ctx.translate(Game.offset.x, Game.offset.y);
    Effects.changed = false;
    floor.draw(background.ctx, walls.ctx, (ctx, wctx) => {
      // leftovers lie on the floor, under the props
      Effects.drawDecals(ctx);
      entities.forEach(e => e.alive && e.draw(e.wall? wctx: ctx, floor));
      if(floor.credits) Credits.draw(ctx, floor.credits);
    });

    if(!Game.shop) return;
    shop.clear();
    Game.shop.draw(shop.ctx, shop.element.width, shop.element.height, Game.offset, Game.stats.gold);
  }

  /** The dungeon's floor and entities, also while the shop swaps them out */
  static get dungeon() {
    return Game.shop?.saved ?? {floor: Game.floor, entities: Game.entities};
  }

  static drawFloats(ctx) {
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#121212';
    Game.floats.forEach(f => {
      ctx.globalAlpha = 1 - f.t;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  }

  static float(text, x, y, color='#f8f8f2') {
    Game.floats.push({text, x, y, color, t: 0});
  }
  //#endregion

  //#region [ LIGHTS ]
  /** Campfires light up once the hero sees them (torches are lit by hand) */
  static discoverLights() {
    const {light} = Game;
    for(const e of Game.entities) {
      if(!e.alive || !e.light || e.source || e.type === 'torch') continue;
      if(!light.hero.contains(light.memoryCtx, e.cx, e.cy)) continue;
      e.source = Game.castSource(e);
      light.add(e.source);
    }
  }

  static castSource(e) {
    const source = new LightSource(e.cx, e.cy, e.light * Floor.TILE);
    source.cast(Game.floor.segments);
    source.findWalls(Game.floor);
    return source;
  }

  /** Recasts static lights after the walls change */
  static recastLights() {
    Game.light.sources = [];
    Game.entities.forEach(e => {
      if(!e.source) return;
      e.source = Game.castSource(e);
      Game.light.add(e.source);
    });
  }
  //#endregion

  //#region [ INTERACTION ]
  /** What a click would do right now, or null */
  static findTarget() {
    const {hero, floor} = Game;
    if(Game.descending) return null;
    const R = Game.REACH;

    const tile = floor.tileAt(hero.x, hero.y);
    if(tile.x === floor.end.x && tile.y === floor.end.y) {
      return Game.boss?
        {action: 'descend', icon: 'fa-lock', enabled: false}:
        {action: 'descend', icon: 'fa-arrow-down', enabled: true};
    }

    // nearest entity that has something to do
    let nearest = null, best = R;
    for(const e of Game.entities) {
      if(!e.alive) continue;
      // walls (and the shop door, a wall from inside) can't be entered: measure from the whole arrow, its body hangs below and right of the tip
      const dist = e.wall || e.type === 'door'?
        e.distanceToBox(hero.x, hero.y, hero.x + Hero.BOX.width, hero.y + Hero.BOX.height):
        e.distanceTo(hero.x, hero.y);
      if(dist > best) continue;
      const action = Game.actionFor(e);
      if(action) {
        nearest = action;
        best = dist;
      }
    }
    return nearest;
  }

  /** Click action an entity offers right now, or null */
  static actionFor(e) {
    const {floor, stats} = Game;
    switch(e.type) {
      case 'chest':
        if(e.opened) return null;
        return e.unlocked || stats.keys?
          {action: 'open', icon: 'fa-key', enabled: true, entity: e}:
          {action: 'open', icon: 'fa-key', enabled: false, entity: e};
      case 'jar':
      case 'box':
        return {action: 'break', icon: 'fa-hand-fist', enabled: true, entity: e};
      case 'lever':
        return {action: 'pull', icon: floor.spikesOn? 'fa-toggle-off': 'fa-toggle-on', enabled: true, entity: e};
      case 'torch':
        if(e.lit) return null;
        return {action: 'light', icon: 'fa-fire', enabled: true, entity: e};
      case 'campfire':
        if(e.used) return null;
        return stats.hp < stats.maxHp?
          {action: 'rest', icon: 'fa-heart', enabled: true, entity: e}:
          {action: 'rest', icon: 'fa-heart', enabled: false, entity: e};
      case 'crack':
        // only a hint: bombs are dropped by holding the right button still
        return {action: 'none', icon: 'fa-bomb', enabled: false, entity: e};
      case 'door':
        return {action: Game.shop? 'leave': 'enter', icon: 'fa-door-open', enabled: true, entity: e};
      case 'shopChest':
        if(e.opened) return null;
        // the bubble shows the goods inside instead of an icon
        return {action: 'buy', items: e.items, enabled: stats.gold >= e.price, entity: e};
      case 'link':
        return {action: 'link', icon: 'fa-arrow-up-right-from-square', text: e.label, enabled: true, entity: e};
      case 'creditsDoor':
        return {action: 'infinite', icon: 'fa-door-open', text: 'keep on infinite mode', enabled: true, entity: e};
      case 'shopFire':
        if(!e.uses) return null;
        return {action: 'heal', icon: 'fa-heart', enabled: stats.gold >= e.price && stats.hp < stats.maxHp, entity: e};
    }
    return null;
  }

  static interact(target) {
    const {stats, floor, hero} = Game;
    const e = target.entity;

    switch(target.action) {
      case 'enter':
        Sound.play('open');
        Game.enterShop(e);
        break;

      case 'leave':
        Sound.play('open');
        Game.leaveShop();
        break;

      case 'buy':
        stats.gold -= e.price;
        e.opened = true;
        e.items.forEach((g, i) => Game.give(g.type, g.amount, e.cx, e.cy - 14 * i));
        Game.drawFloor();
        break;

      case 'heal':
        stats.gold -= e.price;
        stats.hp++;
        e.uses--;
        Game.float(`+${Game.hearts(1)}`, hero.x, hero.y - 12, '#ff5555');
        Game.drawFloor();
        break;

      case 'descend':
        // no second click while the fade runs
        Sound.play('stairs');
        Game.descending = true;
        Gui.fade(() => {
          if(Game.depth === Credits.AFTER && !Game.credits) Game.showCredits(floor.cols, floor.rows);
          else Game.descend(floor.cols, floor.rows, floor.end);
          Game.descending = false;
        }, Gui.FAST_FADE);
        break;

      case 'link':
        window.open(e.url, '_blank');
        break;

      case 'infinite':
        Sound.play('stairs');
        Game.descending = true;
        Gui.fade(() => {
          Game.descend(floor.cols, floor.rows, {x: e.tx, y: e.ty});
          Game.descending = false;
        }, Gui.FAST_FADE);
        break;

      case 'open':
        Sound.play('open');
        if(!e.unlocked) stats.keys--;
        e.opened = true;
        Game.give('gold', 10 + Game.depth * 2 + Math.floor(Math.random() * 10), e.cx, e.cy);
        if(Math.random() < 0.5)  Game.give('bomb', 1, e.cx, e.cy - 14);
        if(Math.random() < 0.35) Game.give('item', 1, e.cx, e.cy - 28);
        Game.drawFloor();
        break;

      case 'break':
        Game.smash(e);
        break;

      case 'light':
        e.lit = true;
        e.source = Game.castSource(e);
        Game.light.add(e.source);
        Game.drawFloor();
        break;

      case 'pull':
        Sound.play('open');
        floor.spikesOn = !floor.spikesOn;
        Game.entities.filter(l => l.type === 'lever').forEach(l => l.pulled = !floor.spikesOn);
        Game.float(floor.spikesOn? 'spikes raised': 'spikes lowered', e.cx, e.cy - 10);
        Game.drawFloor();
        break;

      case 'rest': {
        const heal = Math.min(Game.REST_HEAL, stats.maxHp - stats.hp);
        e.used = true;
        stats.hp += heal;
        Game.float(`+${Game.hearts(heal)}`, hero.x, hero.y - 12, '#ff5555');
        // the fire burns out: unlit sprite, its light goes away
        Game.light.sources = Game.light.sources.filter(s => s !== e.source);
        e.source = null;
        e.light = 0;
        Game.drawFloor();
        break;
      }
    }
    Gui.stats(stats);
  }
  //#endregion

  //#region [ MECHANICS ]
  /** Adds loot to the player with feedback text */
  static give(type, amount, x, y) {
    const {stats} = Game;
    switch(type) {
      case 'gold':
        // every coin drop goes through here
        amount = Math.max(1, Math.round(amount * Game.GOLD_RATE));
        stats.gold += amount;
        Game.float(`+${amount} gold`, x, y, '#f1fa8c');
        break;
      case 'key':
        stats.keys += amount;
        Game.float('+key', x, y, '#f1fa8c');
        break;
      case 'bomb':
        stats.bombs += amount;
        Game.float('+bomb', x, y, '#8be9fd');
        break;
      case 'heart':
        // shop: half a max heart; full health stays full, otherwise the new heart comes empty (no healing)
        if(stats.hp >= stats.maxHp) stats.hp = Math.min(Game.MAX_HP, stats.hp + amount);
        stats.maxHp = Math.min(Game.MAX_HP, stats.maxHp + amount);
        Game.float(`+${Game.hearts(amount)} max`, x, y, '#ff5555');
        break;
      case 'item':
        // gem heals a heart; when already full it sometimes adds half a heart, otherwise gold
        if(stats.hp < stats.maxHp) {
          const heal = Math.min(2, stats.maxHp - stats.hp);
          stats.hp += heal;
          Game.float(`+${Game.hearts(heal)}`, x, y, '#8be9fd');
        }
        else if(stats.maxHp < Game.MAX_HP && Math.random() < Game.GROW_CHANCE) {
          stats.maxHp++;
          stats.hp++;
          Game.float(`+${Game.hearts(1)} max`, x, y, '#8be9fd');
        }
        else Game.give('gold', 15, x, y);
        break;
    }
    Gui.stats(stats);
  }

  static collect(e) {
    e.alive = false;
    Game.give(e.type, e.amount ?? 1, e.cx, e.cy - 10);
    Game.drawFloor();
  }

  /** Health text counting half hearts as 1: 3 -> '3 ♥' */
  static hearts(halves) {
    return `${halves} ♥`;
  }

  /** Breaks a jar or box: by hand, a hero bomb, or a hero shot (jars only) */
  static smash(e) {
    Sound.play('break');
    e.alive = false;
    Effects.shatter(e);
    Game.dropFrom(e);
    Game.drawFloor();
  }

  /** Loot from a broken jar (coins only) or box */
  static dropFrom(e) {
    if(e.type === 'box' && Game.goblinFloor && Math.random() < Game.BOX_BOMB) {
      Game.float('a bomb!', e.cx, e.cy - 10, '#ff5555');
      Game.throwBomb(e.cx, e.cy, 1 + Math.floor(Actor.tier(Game.depth) / 2));
      return;
    }
    const roll = Math.random();
    if(e.type === 'jar') {
      if(roll < 0.6) Game.give('gold', 1 + Math.floor(Math.random() * (2 + Game.depth)), e.cx, e.cy);
      else Game.float('empty', e.cx, e.cy, '#6272a4');
      return;
    }
    if(roll < 0.45)      Game.give('gold', 1 + Math.floor(Math.random() * (2 + Game.depth)), e.cx, e.cy);
    else if(roll < 0.55) Game.give('bomb', 1, e.cx, e.cy);
    else if(roll < 0.63) Game.give('item', 1, e.cx, e.cy);
    else Game.float('empty', e.cx, e.cy, '#6272a4');
  }

  static hurt(damage, fromX, fromY) {
    if(Game.invulnerable > 0 || Game.state !== 'play') return;
    const {stats, hero} = Game;

    stats.hp -= damage;
    Game.invulnerable = Game.INVULNERABLE;
    Game.float(`-${Game.hearts(damage)}`, hero.x, hero.y - 12, '#ff5555');
    Gui.stats(stats);
    Gui.flash();

    if(stats.hp <= 0) Game.die();
    else Sound.play('hurt');
  }

  static kill(actor) {
    actor.died();
    Effects.death(actor);
    Sound.play(actor instanceof Boss? 'boss': 'kill');
    if(actor instanceof Boss) {
      Game.give('gold', 30 + Game.depth * 3, actor.cx, actor.cy);
      Game.give('item', 1, actor.cx, actor.cy - 16);
      Game.float('the stairs are free', actor.cx, actor.cy - 32, '#50fa7b');
      Game.floor.sealed = false;
      Game.unsealArena();
      Game.drawFloor();
    }
    // small slimes from a split drop nothing
    else if(!actor.small && Math.random() < 0.6) Game.give('gold',1 + Math.floor(Math.random() * 3), actor.cx, actor.cy);
  }

  /** Raised spikes hurt walking actors too, once per second (bosses and flyers are spared) */
  static spikeActors(dt) {
    const {floor} = Game;
    for(const a of Game.actors) {
      a.spikeTimer = Math.max(0, (a.spikeTimer ?? 0) - dt);
      if(a instanceof Boss || a.flying || !a.alive || a.spikeTimer > 0) continue;

      const tile = floor.tileAt(a.cx, a.cy);
      if(!Game.entities.some(e => e.alive && e.hazard && (floor.spikesOn || e.always) && e.tx === tile.x && e.ty === tile.y)) continue;
      a.hit(1, a.cx, a.cy, 'spikes');
      a.spikeTimer = 1;
      if(Game.light.isLit(a.cx, a.cy)) Game.float('-1', a.cx, a.cy - 14, '#ff5555');
      if(!a.alive) Game.kill(a);
    }
  }

  /** Swaps the dungeon for the shop room (built on first visit), the hero on the door tile */
  static enterShop(door) {
    door.shop ??= new Shop(Game.floor, door.layout, Game.depth, Game.stats);
    const shop = Game.shop = door.shop;
    shop.saved = {floor: Game.floor, entities: Game.entities};
    Game.floor = shop.floor;
    Game.entities = shop.entities;
    Game.aim = null;
    // the hero is the cursor: stay on the door tile, nudged only as far as needed to clear the wall behind it
    Game.hero.placeIn(shop.outside.x, shop.outside.y);
    Game.drawFloor();
    Game.layers.shop.element.style.opacity = 1;
  }

  static leaveShop() {
    const {outside} = Game.shop;
    Game.closeShop();
    Game.hero.placeIn(outside.x, outside.y);
  }

  /** Puts the dungeon back; the shop layer fades out keeping its last picture */
  static closeShop() {
    if(!Game.shop) return;
    ({floor: Game.floor, entities: Game.entities} = Game.shop.saved);
    Game.shop = null;
    Game.layers.shop.element.style.opacity = 0;
  }

  /** Walls up every passage into the arena: open tiles on the ring around its box, corners skipped */
  static sealArena() {
    const {arena: a, floor, hero} = Game;
    let ring = [];
    for(let x = a.x; x < a.x + a.width; x++) ring.push({x, y: a.y - 1}, {x, y: a.y + a.height});
    for(let y = a.y; y < a.y + a.height; y++) ring.push({x: a.x - 1, y}, {x: a.x + a.width, y});

    Game.arenaSeal = ring.filter(t => floor.isOpen(t.x, t.y)).map(t => ({...t, tile: floor.tile(t.x, t.y)}));
    if(!Game.arenaSeal.length) return;
    floor.set(Game.arenaSeal.map(t => ({...t, tile: Tile.WALL})));
    Game.recastLights();
    Game.drawFloor();
    Game.float('the passages close', hero.x, hero.y - 20, '#ff5555');
  }

  /** Puts the arena passages back */
  static unsealArena() {
    if(!Game.arenaSeal) return;
    Game.floor.set(Game.arenaSeal);
    Game.arenaSeal = null;
    Game.recastLights();
    Game.drawFloor();
  }

  /** Opens a cracked wall into rubble */
  static openCrack(e) {
    e.alive = false;
    Game.floor.open(e.tx, e.ty);
    Game.entities.push(new Entity('rubble', e.tx, e.ty));
    Game.recastLights();
    Game.drawFloor();
  }
  //#endregion

  //#region [ COMBAT ]
  /** Mouse delta cut so the hero stays within the max pull from the press point */
  static pullLimit(dx, dy) {
    const {aim, hero} = Game;
    let x = hero.x + dx - aim.x, y = hero.y + dy - aim.y;
    const dist = Math.hypot(x, y);
    if(dist > Game.AIM.max) {
      x *= Game.AIM.max / dist;
      y *= Game.AIM.max / dist;
    }
    return [aim.x + x - hero.x, aim.y + y - hero.y];
  }

  static get pull() {
    const {aim, hero} = Game;
    return aim? Math.hypot(hero.x - aim.x, hero.y - aim.y): 0;
  }

  /** Holding still inside the min pull for BOMB.hold drops a bomb */
  static updateAim(dt) {
    const {aim} = Game;
    if(!aim) return;
    aim.hold = Game.pull < Game.AIM.min && Game.stats.bombs? aim.hold + dt: 0;
    if(aim.hold < Game.BOMB.hold) return;
    Game.aim = null;
    Game.dropBomb();
  }

  /** Right release: slingshot, fires from the hero back through the press point */
  static shoot() {
    const {aim, hero} = Game;
    if(!aim) return;
    const ready = Game.pull >= Game.AIM.min && Game.cooldown === 0;
    Game.aim = null;
    if(!ready) return;
    Game.cooldown = Game.SHOT_COOLDOWN;
    Game.projectiles.push(new Projectile(hero.x, hero.y, Math.atan2(aim.y - hero.y, aim.x - hero.x), {hostile: false}));
  }

  /** Bomb on the center of the hero's tile, one per tile */
  static dropBomb() {
    const {stats, hero, floor} = Game;
    const T = Floor.TILE;
    const tile = floor.tileAt(hero.x, hero.y);
    const x = (tile.x + 0.5) * T, y = (tile.y + 0.5) * T;
    if(!stats.bombs || Game.bombs.some(b => b.x === x && b.y === y)) return;
    stats.bombs--;
    Game.bombs.push({x, y, fuse: Game.BOMB.fuse});
    Gui.stats(stats);
  }

  static updateBombs(dt) {
    Game.bombs.forEach(b => {
      b.fuse -= dt;
      if(b.fuse <= 0) Game.explode(b);
    });
    Game.bombs = Game.bombs.filter(b => b.fuse > 0);
    Game.blasts.forEach(b => b.t += dt);
    Game.blasts = Game.blasts.filter(b => b.t < Game.BOMB.blast);
  }

  /** Hero bombs hurt actors, break jars and boxes and open cracked walls in reach, never the hero; goblin bombs only hurt the hero */
  static explode(b) {
    const {reach, actorReach, damage} = Game.BOMB;
    Sound.play('bomb');
    Game.blasts.push({x: b.x, y: b.y, t: 0, hostile: b.hostile});

    if(b.hostile) {
      Game.float('BOOM', b.x, b.y, '#ff5555');
      if(Math.hypot(Game.hero.x - b.x, Game.hero.y - b.y) <= reach + 8) Game.hurt(b.damage, b.x, b.y);
      // goblin bombs don't pick sides: enemies in the same small radius take the same damage
      Game.actors.forEach(a => {
        if(!a.alive || !a.hittable || a.distanceTo(b.x, b.y) > reach) return;
        a.hit(b.damage, b.x, b.y, 'blast');
        if(!a.alive) Game.kill(a);
      });
      return;
    }

    Game.float('BOOM', b.x, b.y, '#8be9fd');
    // full damage near the center, one less per third of the reach, at least 1
    const blast = (a, d) => {
      a.hit(Math.max(1, Math.ceil(damage * (1 - d / actorReach))), b.x, b.y, 'blast');
      if(!a.alive) Game.kill(a);
    };
    Game.actors.forEach(a => {
      const d = a.distanceTo(b.x, b.y);
      if(a.alive && a.hittable && d <= actorReach) blast(a, d);
    });
    // sleeping mimics feel it too: they wake up already hurt
    Game.entities
      .filter(e => e.alive && e.mimic && e.distanceTo(b.x, b.y) <= actorReach)
      .forEach(e => blast(Game.wakeMimic(e), e.distanceTo(b.x, b.y)));
    Game.entities
      .filter(e => e.alive && e.type === 'crack' && e.distanceTo(b.x, b.y) <= reach)
      .forEach(e => Game.openCrack(e));
    Game.entities
      .filter(e => e.alive && (e.type === 'jar' || e.type === 'box') && e.distanceTo(b.x, b.y) <= actorReach)
      .forEach(e => Game.smash(e));
  }

  /** Goblin bomb landing on the tile of a point, its blast area shown on the ground */
  static throwBomb(x, y, damage) {
    const T = Floor.TILE;
    const tile = Game.floor.tileAt(x, y);
    Game.bombs.push({x: (tile.x + 0.5) * T, y: (tile.y + 0.5) * T, fuse: Game.GOBLIN_FUSE, hostile: true, damage});
  }

  /** Ticking bombs (blinking all along, faster in the last half second) and explosion rings */
  static drawBombs(ctx) {
    const T = Floor.TILE;
    Game.bombs.forEach(b => {
      // goblin bombs: the danger area on the ground
      if(b.hostile) {
        ctx.fillStyle = '#ff5555';
        ctx.globalAlpha = 0.18 + Math.sin(Game.time * 12) * 0.06;
        ctx.beginPath();
        ctx.arc(b.x, b.y, Game.BOMB.reach + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if(Math.floor(b.fuse * (b.fuse < 0.5? 16: 8)) % 2) return;
      Sprites.draw(ctx, 'bomb', Math.round(b.x - T/2), Math.round(b.y - T/2));
    });

    ctx.lineWidth = 3;
    Game.blasts.forEach(b => {
      const k = b.t / Game.BOMB.blast;
      ctx.strokeStyle = b.hostile? '#ff5555': '#8be9fd';
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      // r: own radius, e.g. the golem's ground pound
      ctx.arc(b.x, b.y, (b.r ?? (b.hostile? Game.BOMB.reach: Game.BOMB.actorReach)) * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  /** Web hit: the hero moves slower for a while */
  static slowHero() {
    if(Game.slow <= 0) Game.float('webbed', Game.hero.x, Game.hero.y - 12, '#f8f8f2');
    Game.slow = Game.SLOW.time;
  }

  /** Spikes that stay up for a few seconds whatever the lever says (golem slam) */
  static spawnSpikes(cells, ttl) {
    const {floor} = Game;
    cells.forEach(({x, y}) => {
      Game.entities.push(new Entity('spikes', x, y, {always: true, ttl}));
      floor.hazards.add(y * floor.cols + x);
    });
    Game.drawFloor();
  }

  /** Counts down temporary spikes, removing them when done */
  static updateSpikes(dt) {
    const {floor} = Game;
    let changed = false;
    for(const e of Game.entities) {
      if(!e.alive || e.ttl === undefined) continue;
      e.ttl -= dt;
      if(e.ttl > 0) continue;
      e.alive = false;
      floor.hazards.delete(e.ty * floor.cols + e.tx);
      changed = true;
    }
    if(changed) Game.drawFloor();
  }

  /** A hovered (or bombed) mimic chest jumps out */
  static wakeMimic(e) {
    e.alive = false;
    Game.drawFloor();
    const mimic = new Mimic(e.cx, e.cy, Actor.tier(Game.depth));
    Game.actors.push(mimic);
    Game.float('!', e.cx, e.cy - 24, '#ff5555');
    return mimic;
  }

  /** Pull band (donut from min to max), a line from the press point to the hero, and the bomb hold progress */
  static drawAim(ctx) {
    const {aim, hero} = Game;
    if(!aim) return;
    const {min, max} = Game.AIM;
    const ready = Game.pull >= min && Game.cooldown === 0;

    ctx.fillStyle = '#f8f8f2';
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, max, 0, Math.PI * 2);
    ctx.arc(aim.x, aim.y, min, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.lineWidth = 2;
    ctx.strokeStyle = ctx.fillStyle = ready? '#f8f8f2': '#6272a4';
    ctx.beginPath();
    ctx.moveTo(aim.x, aim.y);
    ctx.lineTo(hero.x, hero.y);
    ctx.stroke();
    ctx.fillRect(Math.round(aim.x) - 2, Math.round(aim.y) - 2, 4, 4);

    // quick presses don't flash it
    if(aim.hold < 0.25) return;
    ctx.strokeStyle = '#8be9fd';
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, min - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * aim.hold / Game.BOMB.hold);
    ctx.stroke();
  }
  //#endregion
}
