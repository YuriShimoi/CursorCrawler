/** Boss floor shop: a walled room drawn over the floor, entered through a door on a floor tile, which is on the shop's own wall */
class Shop {
  static SIZE = {along: 9, depth: 6}; // tiles with walls, the door sits on the first inner row
  static FIRE = {uses: 3, price: 12}; // campfire: half a heart per use

  // price is per unit, before the tier markup
  static GOODS = [
    {type: 'bomb',  sprite: 'bomb',  price: 16, max: 3},
    {type: 'key',   sprite: 'key',   price: 20, max: 2},
    {type: 'item',  sprite: 'item',  price: 28, max: 1},
    {type: 'heart', sprite: 'heart', price: 60, max: 1} // +half a max heart
  ];

  /**
   * Room box for a door tile: the door is on the first inner row, against the wall, the inside going one way from it
   * @param {{x, y}} door - dungeon floor tile
   * @param {{x, y}} dir - unit step from the door into the shop
   * @returns {{door, dir, from:number}|null} from is the first box tile along the wall, null when it doesn't fit the map
   */
  static layout(floor, door, dir, size=Shop.SIZE) {
    const {along, depth} = size;
    const [pos, limit] = dir.x? [door.y, floor.rows]: [door.x, floor.cols];
    // keep the door off the side walls and the box inside the map
    const lo = Math.max(0, pos - (along - 2)), hi = Math.min(limit - along, pos - 1);
    if(lo > hi) return null;
    // the wall behind the door and the far wall must be on the map too
    const [at, span] = dir.x? [door.x, floor.cols]: [door.y, floor.rows];
    const step = dir.x || dir.y;
    const front = at - step, back = at + step * (depth - 2);
    if(Math.min(front, back) < 0 || Math.max(front, back) >= span) return null;
    return {door, dir, from: Math.min(hi, Math.max(lo, pos - (along >> 1)))};
  }

  /**
   * @param {Floor} floor - dungeon floor the shop opens over
   * @param {{door, dir, from}} layout - from Shop.layout
   */
  constructor(floor, layout, depth, stats) {
    const {along, depth: deep} = Shop.SIZE;
    const {door, dir, from} = layout;
    const rng = new Random(`${floor.data.seed}|shop`);
    const markup = 1 + Actor.tier(depth) * 0.5;

    // (u along the wall, v away from it) to map tiles; v 0 is the wall behind the door, the door is at v 1
    const cell = (u, v) => dir.x? {x: door.x + (v - 1) * dir.x, y: from + u}: {x: from + u, y: door.y + (v - 1) * dir.y};
    const du = (dir.x? door.y: door.x) - from;

    let tiles = Array.from({length: floor.rows}, () => Array(floor.cols).fill(Tile.VOID));
    for(let v = 0; v < deep; v++) {
      for(let u = 0; u < along; u++) {
        const {x, y} = cell(u, v);
        tiles[y][x] = u === 0 || v === 0 || u === along - 1 || v === deep - 1? Tile.WALL: Tile.FLOOR;
      }
    }

    // a floor only for drawing and collisions, skipping dungeon-forge
    this.floor = Object.assign(Object.create(Floor.prototype), {
      data: {seed: `${floor.data.seed}|shop`, tiles, start: {x: -1, y: -1}, end: {x: -1, y: -1}},
      depth: floor.depth, cols: floor.cols, rows: floor.rows,
      solid: new Set(), hazards: new Set(), spikesOn: false, noiseCache: {}
    });
    this.floor.segments = this.floor.buildSegments();

    const corners = [cell(0, 0), cell(along - 1, deep - 1)];
    this.box = {
      x: Math.min(corners[0].x, corners[1].x), y: Math.min(corners[0].y, corners[1].y),
      width: dir.x? deep: along, height: dir.x? along: deep
    };
    // the door is a floor tile on both sides: the hero enters and leaves on it (the cursor never jumps);
    // inside, the tile past it, stays free of props
    this.inside  = cell(du, 2);
    this.outside = {x: door.x, y: door.y};

    // three chests in the middle row, the campfire in the top right inner corner (stepping left off the door and entry tiles)
    const box = this.box;
    let fire = {x: box.x + box.width - 2, y: box.y + 1};
    while([door, this.inside].some(t => t.x === fire.x && t.y === fire.y)) fire.x--;
    this.entities = [
      new Entity('door', door.x, door.y),
      ...[2, 4, 6].map(u => {
        const {x, y} = cell(u, deep - 3);
        return new Entity('shopChest', x, y, Shop.offer(rng, markup, stats));
      }),
      new Entity('shopFire', fire.x, fire.y, {uses: Shop.FIRE.uses, price: Math.round(Shop.FIRE.price * markup)})
    ];
  }

  /** 1 to 3 different goods with amounts, priced by their sum */
  static offer(rng, markup, stats) {
    const goods = Shop.GOODS.filter(g => g.type !== 'heart' || stats.maxHp < Game.MAX_HP);
    const items = rng.shuffle([...goods]).slice(0, rng.int(1, 3)).map(g => ({...g, amount: rng.int(1, g.max)}));
    const price = Math.round(items.reduce((sum, g) => sum + g.price * g.amount, 0) * markup);
    return {items, price};
  }

  /** Dims the dungeon and draws the room with a hard shadow and the prices (the goods show in the popover) */
  draw(ctx, width, height, offset, gold) {
    const T = Floor.TILE;
    const {box} = this;

    ctx.fillStyle = '#121212b3';
    ctx.fillRect(0, 0, width, height);
    ctx.translate(offset.x, offset.y);

    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x * T + 6, box.y * T + 6, box.width * T, box.height * T);
    this.floor.draw(ctx, ctx, c => this.entities.forEach(e => e.alive && e.draw(c, this.floor)));

    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#121212';
    const label = (text, x, y, color) => {
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    for(const e of this.entities) {
      const color = gold >= e.price? '#f1fa8c': '#6272a4';
      if(e.type === 'shopChest' && !e.opened) label(`${e.price}g`, e.cx, (e.ty + 1) * T + 12, color);
      if(e.type === 'shopFire' && e.uses) label(`${e.price}g`, e.cx, (e.ty + 1) * T + 12, color);
    }
  }
}
