/** Credits room shown once after the last demo floor: title and thanks on top, doc links and the door to infinite mode below */
class Credits {
  static AFTER = 25;                    // floor whose stairs lead here instead of the next floor
  static SIZE  = {width: 15, height: 9}; // inner tiles, walls around
  static LINKS = [
    {label: 'arena', url: 'docs/arena.html', x: 5},
    {label: 'style', url: 'docs/style.html', x: 9}
  ];

  /** Hand-built floor centered on the map, in place of Floor + Populate */
  static build(cols, rows, depth) {
    const {width: W, height: H} = Credits.SIZE;
    const x0 = Math.floor((cols - W) / 2), y0 = Math.floor((rows - H) / 2), row = y0 + H - 3;

    let tiles = Array.from({length: rows}, () => Array(cols).fill(Tile.VOID));
    for(let y = y0 - 1; y <= y0 + H; y++)
      for(let x = x0 - 1; x <= x0 + W; x++)
        tiles[y][x] = x < x0 || y < y0 || x >= x0 + W || y >= y0 + H? Tile.WALL: Tile.FLOOR;
    const start = {x: x0 + 1, y: row};
    tiles[start.y][start.x] = Tile.STAIRS_UP;

    const floor = Object.assign(Object.create(Floor.prototype), {
      data: {seed: `credits|${depth}`, tiles, start, end: {x: -1, y: -1}, rooms: [], corridors: []},
      depth, cols, rows, isBossFloor: false, isCampFloor: false, credits: null,
      solid: new Set(), hazards: new Set(), spikesOn: false, noiseCache: {}
    });
    floor.segments = floor.buildSegments();

    const entities = [
      ...Credits.LINKS.map(l => new Entity('link', x0 + l.x, row, {label: l.label, url: l.url})),
      new Entity('creditsDoor', x0 + W - 2, row)
    ];
    // the box doubles as the arena: its light covers the whole room
    const box = {x: x0, y: y0, width: W, height: H};
    floor.credits = box;
    return {floor, entities, box};
  }

  /** Text written on the room floor: title and thanks on top, a caption over the links */
  static draw(ctx, box) {
    const T = Floor.TILE;
    const cx = (box.x + box.width / 2) * T;
    const links = Credits.LINKS.map(l => (box.x + l.x + 0.5) * T);
    const linksX = (Math.min(...links) + Math.max(...links)) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const write = (text, x, y, font, color, shadow) => {
      ctx.font = font;
      ctx.fillStyle = '#000000';
      ctx.fillText(text, x + shadow, y + shadow);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    write('CURSOR CRAWLER', cx, (box.y + 1.4) * T, `48px 'Title', monospace`, '#f8f8f2', 3);
    write('thank you for playing this DEMO', cx, (box.y + 2.7) * T, 'bold 15px monospace', '#6272a4', 1);
    write('made by Yuri Shimoi', cx, (box.y + 3.4) * T, 'bold 15px monospace', '#bd93f9', 1);
    write('extra material about the game', linksX, (box.y + box.height - 3.6) * T, 'bold 13px monospace', '#6272a4', 1);
    ctx.restore();
  }
}
