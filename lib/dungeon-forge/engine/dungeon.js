class Dungeon {
  static DEFAULTS = {
    width   : 80,
    height  : 45,
    seed    : null,  // null picks a random one
    layout  : 'bsp', // see Layout.TYPES
    roomMin : 4,
    roomMax : 12,
    depth   : 4,     // bsp: split levels, up to 2^depth rooms
    rooms   : 14,    // scatter: target room count
    attempts: 300,   // scatter: placement tries
    loops   : 0.15,  // chance per room of an extra corridor
    doors   : true,
    walls   : true,  // false leaves every non walkable cell as VOID
    start   : null,  // {x, y} forced up stairs, a room is always built around it
    roomParts    : 0, // extra overlapping rects per room, breaks the rectangle shape
    roomIrregular: 1  // chance of a room being reshaped when roomParts > 0
  };

  /**
   * Classic rooms and corridors dungeon, fully deterministic per seed.
   * @param {Object} options - see Dungeon.DEFAULTS
   */
  constructor(options={}) {
    this.options = Dungeon.#normalize({...Dungeon.DEFAULTS, ...options});
    this.seed    = this.options.seed ?? Math.floor(Math.random() * 1e9);
    this.rng     = new Random(this.seed);
    this.grid    = new Grid(this.options.width, this.options.height);

    this.rooms     = [];
    this.corridors = []; // {from, to, cells}
    this.doors     = [];
    this.start     = null;
    this.end       = null;

    this.generate();
  }

  get width()  { return this.grid.width; }
  get height() { return this.grid.height; }

  get(x, y) {
    return this.grid.get(x, y);
  }

  isWalkable(x, y) {
    return Tile.isWalkable(this.grid.get(x, y));
  }

  roomAt(x, y) {
    return this.rooms.find(room => room.contains(x, y)) ?? null;
  }

  //#region [ Generation ]
  static #normalize(opt) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    opt.roomMin = clamp(opt.roomMin, 1, Math.min(opt.width, opt.height) - 2);
    opt.roomMax = Math.max(opt.roomMin, opt.roomMax);
    if(opt.start)
      opt.start = {x: clamp(Math.floor(opt.start.x), 1, opt.width - 2), y: clamp(Math.floor(opt.start.y), 1, opt.height - 2)};
    return opt;
  }

  generate() {
    const opt = this.options;
    this.rooms = Layout.generate(opt.layout, this.rng, opt);
    this.rooms.forEach((room, i) => {
      room.id = i;
      if(opt.roomParts > 0 && this.rng.chance(opt.roomIrregular))
        room.reshape(this.rng, this.rng.int(1, opt.roomParts));
      room.carve(this.grid);
    });

    this.corridors = Corridor.connect(this.rooms, this.rng, this.options.loops).map(([from, to]) => (
      {from, to, cells: Corridor.carve(this.grid, from, to, this.rng)}
    ));

    if(this.options.walls) this.#buildWalls();
    if(this.options.doors) this.#placeDoors();
    this.#placeStairs();
  }

  /** Every empty cell touching something walkable becomes wall */
  #buildWalls() {
    this.grid.forEach((x, y, tile) => {
      if(tile === Tile.VOID && this.grid.someNeighbor(x, y, Tile.isWalkable))
        this.grid.set(x, y, Tile.WALL);
    });
  }

  /** Door where a corridor meets room floor, with solid cells (wall or void) on both sides */
  #placeDoors() {
    this.grid.forEach((x, y, tile) => {
      if(tile !== Tile.CORRIDOR) return;
      for(const [dx, dy] of Grid.DIRS4) {
        if(this.grid.get(x + dx, y + dy) !== Tile.FLOOR || this.grid.get(x - dx, y - dy) !== Tile.CORRIDOR) continue;
        if(Tile.isWalkable(this.grid.get(x + dy, y + dx)) || Tile.isWalkable(this.grid.get(x - dy, y - dx))) continue;

        this.grid.set(x, y, Tile.DOOR);
        this.doors.push({x, y, room: this.roomAt(x + dx, y + dy)});
        return;
      }
    });
  }

  /** Up stairs on the forced start or in a random room, down stairs in the room farthest by walking */
  #placeStairs() {
    if(!this.rooms.length) return;

    const forced = this.options.start;
    const first  = (forced && this.roomAt(forced.x, forced.y)) || this.rng.pick(this.rooms);
    this.start   = forced? {...forced}: first.randomCell(this.rng);

    const dist = this.grid.distanceMap(this.start.x, this.start.y);
    let far = first;
    let farDist = -1;
    for(const room of this.rooms) {
      const c = room.center;
      const d = dist[c.y * this.width + c.x];
      if(room !== first && d > farDist) {
        far = room;
        farDist = d;
      }
    }

    do {
      this.end = far.randomCell(this.rng);
    } while(this.end.x === this.start.x && this.end.y === this.start.y && far.width * far.height > 1);

    this.grid.set(this.start.x, this.start.y, Tile.STAIRS_UP);
    this.grid.set(this.end.x, this.end.y, Tile.STAIRS_DOWN);
  }
  //#endregion

  toString() {
    return this.grid.toString();
  }
}
