/** One dungeon level: dungeon-forge data plus pixel helpers and wall segments */
class Floor {
  static TILE = 36; // 12x12 icon grid at 3px per pixel

  // darker tone overlay: per-tile shade plus grain in cell x cell blocks (max alphas)
  static NOISE = {
    cell : 6,
    floor: {tile: 0.08, grain: 0.05},
    wall : {tile: 0.14, grain: 0.09}
  };

  // colors of floor 1; walls and doors drift in hue on deeper floors
  static COLOR = {
    floor      : '#212121',
    grid       : '#1a1a1a',
    wall       : '#44475a',
    wallShade  : '#2e3040',
    door       : '#34363f'
  };

  // [hue, saturation %, lightness %] of the drifting colors, matching COLOR above
  static HSL = {
    wall     : [232, 14, 31],
    wallShade: [233, 16, 22],
    door     : [229, 10, 23]
  };
  static HUE_CYCLE = 25; // floors for a full turn of the hue

  static BOSS_EVERY  = 5;
  static ARENA       = {width: 16, height: 11}; // boss room size, normal rooms top at 11x11
  static CAMP        = {width: 13, height: 9};  // monster camp room
  static CAMP_CHANCE = {base: 0.05, step: 0.1, max: 0.55}; // of the normal floors after the first boss, +step per boss after it
  /**
   * dungeon-forge layout for boss floors: start room, one big arena on the far side, scattered rooms
   * @returns {Room[]} arena first after the start room
   */
  static arenaLayout(rng, opt) {
    const {width: W, height: H, start} = opt;
    const size = () => [rng.int(opt.roomMin, opt.roomMax), rng.int(opt.roomMin, opt.roomMax)];
    let rooms = [];

    if(start) {
      const [w, h] = size();
      const room = new Room(Layout.fit(rng, 1, W - 2, w, start.x), Layout.fit(rng, 1, H - 2, h, start.y), w, h);
      room.anchor = {...start};
      rooms.push(room);
    }

    // arena on the half away from the start, falling back to anywhere that's clear (opt.big: its size, the camp's is smaller)
    // shrinks a step every 80 failed attempts (down to a normal room's size), so a start near the middle still leaves room for it
    const big = opt.big ?? Floor.ARENA;
    for(let attempt = 0; attempt < 480; attempt++) {
      const shrink = Math.floor(attempt / 80);
      const aw = Math.max(Math.min(opt.roomMax, big.width), Math.min(big.width, W - 4) - shrink * 2);
      const ah = Math.max(Math.min(opt.roomMax, big.height), Math.min(big.height, H - 4) - shrink);
      const far = start? (start.x < W / 2? [Math.floor(W / 2), W - aw - 1]: [1, Math.ceil(W / 2) - aw]): [1, W - aw - 1];
      const [lo, hi] = attempt % 80 < 40 && far[0] <= far[1]? far: [1, W - aw - 1];
      const arena = new Room(rng.int(lo, hi), rng.int(1, H - ah - 1), aw, ah);
      if(rooms.some(r => r.intersects(arena, 3))) continue;
      arena.arena = true;
      rooms.push(arena);
      break;
    }

    for(let attempt = 0; attempt < opt.attempts && rooms.length < opt.rooms; attempt++) {
      const [w, h] = size();
      const room = new Room(Layout.fit(rng, 1, W - 2, w), Layout.fit(rng, 1, H - 2, h), w, h);
      if(rooms.some(r => r.intersects(room, 2))) continue;
      rooms.push(room);
    }
    return rooms;
  }

  /**
   * @param {number} cols - map width in tiles
   * @param {number} rows - map height in tiles
   * @param {{x:number, y:number}} start - up stairs tile
   * @param {number} depth - floor number, shifts the wall hue
   */
  constructor(cols, rows, start, depth=1) {
    this.depth = depth;
    this.isBossFloor = depth % Floor.BOSS_EVERY === 0;
    const {base, step, max} = Floor.CAMP_CHANCE;
    const camp = Math.min(max, base + step * (Actor.tier(depth) - 1));
    this.isCampFloor = !this.isBossFloor && depth > Floor.BOSS_EVERY && Math.random() < camp;

    // boss and camp floors: one big room among scattered ones
    const layout =
      this.isBossFloor? {layout: 'arena', roomParts: 0, rooms: 9, attempts: 400}:
      this.isCampFloor? {layout: 'arena', big: Floor.CAMP, roomParts: 0, rooms: 9, attempts: 400}:
                        {layout: 'bsp', roomParts: 2};
    Layout.TYPES.arena ??= Floor.arenaLayout;

    this.data = DungeonForge.generate({
      width    : cols,
      height   : rows,
      depth    : 4,
      roomMin  : 4,
      roomMax  : 11,
      loops    : 0.2,
      start,
      ...layout
    });
    this.cols = cols;
    this.rows = rows;
    this.solid = new Set();   // tiles blocked by props, as y * cols + x
    this.hazards = new Set(); // spike tiles, same keys
    this.spikesOn = true;
    this.segments = this.buildSegments();
    this.noiseCache = {};
  }

  //#region [ TILES ]
  get start() { return this.data.start; }
  get end()   { return this.data.end; }

  tile(tx, ty) {
    return this.data.tiles[ty]?.[tx] ?? Tile.VOID;
  }

  isOpen(tx, ty) {
    return Tile.isWalkable(this.tile(tx, ty));
  }

  /** Walkable test on a map-space pixel */
  isOpenAt(px, py) {
    return this.isOpen(Math.floor(px / Floor.TILE), Math.floor(py / Floor.TILE));
  }

  /** Walkable and not blocked by a prop */
  isFree(tx, ty) {
    return this.isOpen(tx, ty) && !this.solid.has(ty * this.cols + tx);
  }

  isFreeAt(px, py) {
    return this.isFree(Math.floor(px / Floor.TILE), Math.floor(py / Floor.TILE));
  }

  tileAt(px, py) {
    return {x: Math.floor(px / Floor.TILE), y: Math.floor(py / Floor.TILE)};
  }

  /** No wall between two map-space points (props don't block sight) */
  lineOfSight(x1, y1, x2, y2) {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8);
    for(let s = 1; s < steps; s++)
      if(!this.isOpenAt(x1 + (x2 - x1) * s / steps, y1 + (y2 - y1) * s / steps)) return false;
    return true;
  }

  /** Turns a wall into floor (bombed cracked wall) */
  open(tx, ty) {
    this.set([{x: tx, y: ty, tile: Tile.FLOOR}]);
  }

  /** Changes tiles and rebuilds what depends on them */
  set(changes) {
    changes.forEach(({x, y, tile}) => this.data.tiles[y][x] = tile);
    this.segments = this.buildSegments();
    this.noiseCache = {};
  }
  //#endregion

  //#region [ LIGHT OCCLUDERS ]
  /** Edges between walkable and blocked tiles, merged into long segments (pixels) */
  buildSegments() {
    const T = Floor.TILE;
    let segments = [];

    // horizontal edges, on the line between row y-1 and row y
    for(let y = 0; y <= this.rows; y++) {
      let from = null;
      for(let x = 0; x <= this.cols; x++) {
        const edge = x < this.cols && this.isOpen(x, y - 1) !== this.isOpen(x, y);
        if(edge && from === null) from = x;
        if(!edge && from !== null) {
          segments.push({x1: from * T, y1: y * T, x2: x * T, y2: y * T});
          from = null;
        }
      }
    }

    // vertical edges, on the line between column x-1 and column x
    for(let x = 0; x <= this.cols; x++) {
      let from = null;
      for(let y = 0; y <= this.rows; y++) {
        const edge = y < this.rows && this.isOpen(x - 1, y) !== this.isOpen(x, y);
        if(edge && from === null) from = y;
        if(!edge && from !== null) {
          segments.push({x1: x * T, y1: from * T, x2: x * T, y2: y * T});
          from = null;
        }
      }
    }

    return segments;
  }
  //#endregion

  //#region [ DRAW ]
  /** Floor colors with walls and doors hue-shifted for this depth */
  get colors() {
    const shift = ((this.depth ?? 1) - 1) * 360 / Floor.HUE_CYCLE;
    const colors = {...Floor.COLOR};
    for(const [name, [h, s, l]] of Object.entries(Floor.HSL))
      colors[name] = `hsl(${(h + shift) % 360}, ${s}%, ${l}%)`;
    return colors;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx   - ground layer
   * @param {CanvasRenderingContext2D} wctx  - walls layer
   * @param {(ctx, wctx) => void} [extras] - props drawn before the noise so they get shaded too
   */
  draw(ctx, wctx, extras=null) {
    const T = Floor.TILE;
    const C = this.colors;
    const shade = T / 6; // bottom face, 2 sprite pixels

    for(let y = 0; y < this.rows; y++) {
      for(let x = 0; x < this.cols; x++) {
        const tile = this.tile(x, y);
        const px = x * T, py = y * T;

        switch(tile) {
          case Tile.VOID:
            break;
          case Tile.WALL:
            wctx.fillStyle = C.wall;
            wctx.fillRect(px, py, T, T);
            wctx.fillStyle = C.wallShade;
            wctx.fillRect(px, py + T - shade, T, shade);
            break;
          default:
            ctx.fillStyle = C.grid;
            ctx.fillRect(px, py, T, T);
            ctx.fillStyle = C.floor;
            ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
        }

        if(tile === Tile.DOOR)        this.drawDoor(ctx, x, y, C.door);
        if(tile === Tile.STAIRS_UP)   Sprites.draw(ctx, 'stairsUp', px, py);
        // sealed by a living boss: drawn with the up stairs sprite
        if(tile === Tile.STAIRS_DOWN) Sprites.draw(ctx, this.sealed? 'stairsUp': 'stairsDown', px, py);
      }
    }

    extras?.(ctx, wctx);

    ctx.drawImage(this.noiseLayer('floor'), 0, 0);
    wctx.drawImage(this.noiseLayer('wall'), 0, 0);
  }

  /** Noise rendered once per floor and kind, reused on every redraw */
  noiseLayer(kind) {
    if(this.noiseCache[kind]) return this.noiseCache[kind];

    const el = document.createElement('CANVAS');
    el.width  = this.cols * Floor.TILE;
    el.height = this.rows * Floor.TILE;
    const test = kind === 'floor'?
      (x, y) => this.isOpen(x, y):
      (x, y) => this.tile(x, y) === Tile.WALL;
    this.drawNoise(el.getContext('2d'), test, Floor.NOISE[kind]);

    return this.noiseCache[kind] = el;
  }

  /** Seeded value in [0, 1) for a cell, stable for this floor */
  noise(x, y, salt) {
    // fmix32 finalizer, spreads close inputs so neighbor cells don't correlate
    let h = Random.hash(`${this.data.seed}|${salt}|${x}|${y}`);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * Subtle darker tones over the matching tiles, drawn last so it also shades sprites
   * @param {(x:number, y:number) => boolean} test - which tiles get noise
   * @param {{tile:number, grain:number}} strength - max alphas
   */
  drawNoise(ctx, test, {tile, grain}) {
    const T = Floor.TILE;
    const cell = Floor.NOISE.cell;
    const n = T / cell;

    for(let y = 0; y < this.rows; y++) {
      for(let x = 0; x < this.cols; x++) {
        if(!test(x, y)) continue;

        const base = this.noise(x, y, 'tile') * tile;
        for(let cy = 0; cy < n; cy++) {
          for(let cx = 0; cx < n; cx++) {
            const alpha = base + this.noise(x * n + cx, y * n + cy, 'grain') * grain;
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
            ctx.fillRect(x * T + cx * cell, y * T + cy * cell, cell, cell);
          }
        }
      }
    }
  }

  drawDoor(ctx, x, y, color) {
    const T = Floor.TILE;
    const bar = T / 6; // same 2-pixel thickness as the sprites
    ctx.fillStyle = color;
    // door bar lies across the passage
    if(this.isOpen(x - 1, y) && this.isOpen(x + 1, y))
      ctx.fillRect(x * T + (T - bar) / 2, y * T, bar, T);
    else
      ctx.fillRect(x * T, y * T + (T - bar) / 2, T, bar);
  }

  //#endregion
}
