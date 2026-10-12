/** Seeded placement of props, loot, traps and actors on a fresh floor */
class Populate {
  /**
   * @param {Floor} floor - gets solid tiles, carved alcoves and new segments
   * @param {number} depth - floor number, scales loot and enemies
   * @returns {{entities: Entity[], actors: Actor[]}}
   */
  static run(floor, depth) {
    const rng = new Random(`${floor.data.seed}|populate`);
    const T = Floor.TILE;
    const {start, end} = floor;
    // the tutorial room stays bare: nothing is placed in it
    const rooms = floor.data.rooms.filter(r => !floor.tutorial || r.x !== floor.tutorial.x || r.y !== floor.tutorial.y);
    const entities = [], actors = [];
    const taken = new Set();
    const key = (x, y) => y * floor.cols + x;
    const near = (p, x, y, d) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= d;
    const tier = Actor.tier(depth);

    //#region [ HELPERS ]
    const inRoom = (room, x, y) => room.parts.some(p => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height);

    const cellsOf = room => {
      let cells = [];
      for(let y = room.y; y < room.y + room.height; y++)
        for(let x = room.x; x < room.x + room.width; x++)
          if(inRoom(room, x, y) && floor.tile(x, y) === Tile.FLOOR) cells.push([x, y]);
      return cells;
    };

    // props never touch each other or a wall: spaced out, and solid ones can't cut a path
    const canSolid = (x, y) => {
      if(floor.tile(x, y) !== Tile.FLOOR || taken.has(key(x, y))) return false;
      if(near(start, x, y, 2) || near(end, x, y, 1)) return false;
      for(let dy = -1; dy <= 1; dy++)
        for(let dx = -1; dx <= 1; dx++)
          if(!floor.isOpen(x + dx, y + dy) || taken.has(key(x + dx, y + dy))) return false;
      return true;
    };

    const canFree = (x, y) =>
      floor.tile(x, y) === Tile.FLOOR && !taken.has(key(x, y)) && !near(start, x, y, 1) && !(x === end.x && y === end.y);

    const place = (type, x, y, data={}) => {
      const entity = new Entity(type, x, y, data);
      entities.push(entity);
      taken.add(key(x, y));
      if(entity.solid) floor.solid.add(key(x, y));
      if(entity.hazard) floor.hazards.add(key(x, y));
      return entity;
    };

    const startRoom = rooms.find(r => inRoom(r, start.x, start.y));
    const others    = rooms.filter(r => r !== startRoom);

    /** First cell passing the test, searching rooms in random order */
    const pick = (test, list=others) => {
      for(const room of rng.shuffle([...list])) {
        const cell = rng.shuffle(cellsOf(room)).find(([x, y]) => test(x, y));
        if(cell) return cell;
      }
      return null;
    };
    //#endregion

    //#region [ BOSS ]
    // boss and camp floors: the biggest room besides the start one is the arena or the camp
    const biggest = others.reduce((best, r) => !best || r.width * r.height > best.width * best.height? r: best, null);
    const arena = floor.isBossFloor? biggest: null;
    const camp  = floor.isCampFloor? biggest: null;
    if(arena) {
      const main = arena.parts[0];
      const bx = main.x + Math.floor(main.width / 2), by = main.y + Math.floor(main.height / 2);
      // bosses come in order, looping after the last one
      const Kind = Populate.BOSSES[(depth / Floor.BOSS_EVERY - 1) % Populate.BOSSES.length];
      actors.push(new Kind(bx * T, by * T, tier));
      // keep its 2x2 area clear of props
      for(let dy = -2; dy <= 1; dy++)
        for(let dx = -2; dx <= 1; dx++) taken.add(key(bx + dx, by + dy));
    }
    //#endregion

    //#region [ SECRETS & SHOP ]
    // shop room box for a door tile, opening toward any side that fits the map
    const shopAt = (x, y) => {
      for(const [dx, dy] of rng.shuffle([...LightSource.FACES])) {
        const layout = Shop.layout(floor, {x, y}, {x: dx, y: dy});
        if(layout) return layout;
      }
      return null;
    };

    // boss floors: the shop door hides behind the cracked wall half of the time, unless that wall faces the arena
    const secrets = Populate.secrets(floor, rng, depth);
    // arena box plus its walls, so the door never ends up in or against the boss room
    const byArena = (x, y) => x >= arena.x - 1 && x <= arena.x + arena.width && y >= arena.y - 1 && y <= arena.y + arena.height;
    const facesArena = ({wall, alcove}) => byArena(2 * wall.x - alcove.x, 2 * wall.y - alcove.y);
    let shopHidden = false;
    if(arena && secrets.length && !facesArena(secrets[0]) && rng.chance(0.5)) {
      const layout = shopAt(secrets[0].alcove.x, secrets[0].alcove.y);
      if(layout) {
        secrets[0].reward = {type: 'door', layout};
        shopHidden = true;
      }
    }

    secrets.forEach(({wall, alcove, reward}) => {
      place('crack', wall.x, wall.y);
      place(reward.type, alcove.x, alcove.y, reward);
    });

    // otherwise on a floor tile of a room outside the arena, spaced from props when possible
    if(arena && !shopHidden) {
      let layout = null;
      // falling back to looser spacing, then to the start room too
      const test = (x, y) => canFree(x, y) && !byArena(x, y) && (layout = shopAt(x, y));
      const cell = pick((x, y) => canSolid(x, y) && test(x, y)) ?? pick(test) ?? pick(test, rooms);
      if(cell) place('door', ...cell, {layout});
    }
    //#endregion

    //#region [ LIGHTS ]
    rooms.forEach(room => {
      if(cellsOf(room).length < 12 || !rng.chance(0.25)) return;
      const cell = pick(canSolid, [room]);
      if(cell) place('torch', ...cell);
    });
    if(rng.chance(0.6)) {
      const cell = pick(canSolid);
      if(cell) place('campfire', ...cell);
    }
    //#endregion

    //#region [ LOOT ]
    const chest = pick(canSolid);
    if(chest) {
      place('chest', ...chest);
      const keyCell = pick(canFree);
      if(keyCell) place('key', ...keyCell);
    }

    // a mimic among the chests after floor 10, open to anyone who comes close; 5% more likely per boss after that
    if(depth > 10 && rng.chance(Math.min(0.35, 0.05 + 0.05 * (Actor.tier(depth) - 2)))) {
      const cell = pick(canSolid);
      if(cell) place('chest', ...cell, {mimic: true, unlocked: true});
    }

    for(let i = rng.int(2, 4); i > 0; i--) {
      const cell = pick(canFree);
      if(cell) place('gold', ...cell, {amount: rng.int(1, 4) + depth});
    }

    for(let i = rng.int(3, 6); i > 0; i--) {
      const cell = pick(canSolid);
      if(cell) place(rng.pick(['jar', 'box']), ...cell);
    }

    if(rng.chance(0.4)) {
      const cell = pick(canFree);
      if(cell) place('bomb', ...cell);
    }
    if(rng.chance(0.25)) {
      const cell = pick(canFree);
      if(cell) place('item', ...cell);
    }

    others.forEach(room => {
      if(!rng.chance(0.35)) return;
      const cell = pick(canSolid, [room]);
      if(cell) place('stones', ...cell);
    });
    //#endregion

    //#region [ TRAPS ]
    // a short run of spikes inside one corridor, switched off by a lever somewhere
    const corridors = rng.shuffle(floor.data.corridors.filter(c => c.cells.length >= 3));
    if(corridors.length) {
      const cells = corridors[0].cells.filter(({x, y}) => floor.tile(x, y) === Tile.CORRIDOR && !taken.has(key(x, y)));
      const from = rng.int(0, Math.max(0, cells.length - 3));
      cells.slice(from, from + rng.int(2, 3)).forEach(({x, y}) => place('spikes', x, y));

      // the lever must be reachable from the start without stepping on the spikes
      const reach = Populate.reachable(floor, start);
      const safe = test => (x, y) => test(x, y) && reach.has(key(x, y));
      const lever = pick(safe(canSolid)) ?? pick(safe(canFree), rooms);
      if(lever) place('lever', ...lever);
      else floor.spikesOn = false;
    }
    //#endregion

    //#region [ ENEMIES ]
    // weighted roster of the kinds unlocked at this depth
    const roster = Populate.ENEMIES.filter(e => depth >= e.from);
    const total = roster.reduce((sum, e) => sum + e.weight, 0);
    const kind = () => {
      let roll = rng.next() * total;
      return roster.find(e => (roll -= e.weight) < 0)?.kind ?? Enemy;
    };
    const spawn = (count, list) => {
      for(let i = count; i > 0; i--) {
        const cell = pick(canFree, list);
        if(!cell) break;
        taken.add(key(...cell));
        const Kind = kind();
        actors.push(new Kind((cell[0] + 0.5) * T, (cell[1] + 0.5) * T, tier));
        // slimes sometimes come in couples, the pair counts toward the total
        if(Kind !== Slime || i < 2 || !rng.chance(Slime.PAIR)) continue;
        const mate = Enemy.DIRS.map(([dx, dy]) => [cell[0] + dx, cell[1] + dy]).find(([x, y]) => canFree(x, y));
        if(!mate) continue;
        taken.add(key(...mate));
        actors.push(new Slime((mate[0] + 0.5) * T, (mate[1] + 0.5) * T, tier));
        i--;
      }
    };

    spawn(Math.min(2 + depth, 9), others.filter(r => r !== arena && r !== camp));
    // monster camp: a crowd in the big room, guarding a chest that needs no key
    if(camp) {
      const reward = pick(canSolid, [camp]);
      if(reward) place('chest', ...reward, {unlocked: true});
      spawn(Math.min(6 + depth, 16), [camp]);
    }
    //#endregion

    floor.segments = floor.buildSegments();
    return {entities, actors, arena, camp};
  }

  // enemy kinds by first depth and spawn weight
  static ENEMIES = [
    {kind: Enemy,    from: 1,  weight: 5},
    {kind: Skeleton, from: 3,  weight: 3},
    {kind: Slime,    from: 6,  weight: 3},
    {kind: Spider,   from: 13, weight: 2},
    {kind: Goblin,   from: 13, weight: 2},
    {kind: Knight,   from: 17, weight: 1}
  ];

  // by difficulty: plain shooter, then bouncing splits, armor timing, reading warnings, waves needing bombs
  static BOSSES = [Boss, SlimeKing, Golem, Worm, Necromancer];
  /**
   * Tiles walkable from a start tile without crossing spike tiles (flood fill)
   * @returns {Set<number>} keys as y * cols + x
   */
  static reachable(floor, start) {
    const cols = floor.cols;
    const seen = new Set([start.y * cols + start.x]);
    const queue = [start];
    for(let i = 0; i < queue.length; i++) {
      const {x, y} = queue[i];
      for(const [dx, dy] of LightSource.FACES) {
        const nx = x + dx, ny = y + dy, n = ny * cols + nx;
        if(seen.has(n) || !floor.isFree(nx, ny) || floor.hazards.has(n)) continue;
        seen.add(n);
        queue.push({x: nx, y: ny});
      }
    }
    return seen;
  }

  /**
   * Carves at most one hidden alcove behind a single wall tile, on 60% of the floors
   * @returns {{wall:{x, y}, alcove:{x, y}, reward:Object}[]}
   */
  static secrets(floor, rng, depth, max=1) {
    if(!rng.chance(0.6)) return [];
    const tiles = floor.data.tiles;
    let candidates = [];

    for(let y = 2; y < floor.rows - 2; y++) {
      for(let x = 2; x < floor.cols - 2; x++) {
        if(tiles[y][x] !== Tile.WALL) continue;

        // exactly one room floor tile next to the wall
        const open = LightSource.FACES.filter(([dx, dy]) => floor.isOpen(x + dx, y + dy));
        if(open.length !== 1) continue;
        const [dx, dy] = open[0];
        if(tiles[y + dy][x + dx] !== Tile.FLOOR) continue;

        // the alcove sits behind the wall, in empty space
        const ax = x - dx, ay = y - dy;
        if(tiles[ay][ax] !== Tile.VOID) continue;
        let clear = true;
        for(let ny = -1; ny <= 1 && clear; ny++)
          for(let nx = -1; nx <= 1 && clear; nx++)
            if(floor.isOpen(ax + nx, ay + ny)) clear = false;
        if(clear) candidates.push({wall: {x, y}, alcove: {x: ax, y: ay}});
      }
    }

    let chosen = [];
    for(const c of rng.shuffle(candidates)) {
      if(chosen.length >= max) break;
      if(chosen.some(o => Math.abs(o.wall.x - c.wall.x) + Math.abs(o.wall.y - c.wall.y) < 6)) continue;
      chosen.push(c);
    }

    chosen.forEach(c => {
      const {x, y} = c.alcove;
      tiles[y][x] = Tile.FLOOR;
      for(let ny = -1; ny <= 1; ny++)
        for(let nx = -1; nx <= 1; nx++)
          if(tiles[y + ny][x + nx] === Tile.VOID) tiles[y + ny][x + nx] = Tile.WALL;
      // usually a chest that needs no key, otherwise a gem
      c.reward = rng.chance(0.7)? {type: 'chest', unlocked: true}: {type: 'item'};
    });

    return chosen;
  }
}
