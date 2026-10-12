/** Public entry point: params in, plain data out (no classes, no DOM) */
class DungeonForge {
  /**
   * @param {Object} params - see Dungeon.DEFAULTS
   * @returns {{
   *   seed: number|string, width: number, height: number,
   *   tiles: number[][],
   *   rooms: {id:number, x:number, y:number, width:number, height:number, parts:{x, y, width, height}[]}[],
   *   corridors: {from:number, to:number, cells:{x:number, y:number}[]}[],
   *   doors: {x:number, y:number, room:number}[],
   *   start: {x:number, y:number}, end: {x:number, y:number}
   * }} tiles is indexed tiles[y][x], values from Tile
   */
  static generate(params={}) {
    const dungeon = new Dungeon(params);
    const {width, height, cells} = dungeon.grid;

    let tiles = [];
    for(let y = 0; y < height; y++)
      tiles.push(Array.from(cells.subarray(y * width, (y + 1) * width)));

    return {
      seed: dungeon.seed,
      width,
      height,
      tiles,
      rooms    : dungeon.rooms.map(({id, x, y, width, height, parts}) => ({id, x, y, width, height, parts})),
      corridors: dungeon.corridors.map(c => ({from: c.from.id, to: c.to.id, cells: c.cells})),
      doors    : dungeon.doors.map(d => ({x: d.x, y: d.y, room: d.room.id})),
      start    : dungeon.start,
      end      : dungeon.end
    };
  }
}
