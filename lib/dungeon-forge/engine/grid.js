class Grid {
  static DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  static DIRS8 = [...Grid.DIRS4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

  /**
   * Flat tile map, indexed as cells[y * width + x].
   * @param {number} width
   * @param {number} height
   * @param {number} fill - Tile value
   */
  constructor(width, height, fill=Tile.VOID) {
    this.width  = width;
    this.height = height;
    this.cells  = new Uint8Array(width * height).fill(fill);
  }

  //#region [ Access ]
  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Out of bounds reads as VOID */
  get(x, y) {
    return this.inBounds(x, y)? this.cells[y * this.width + x]: Tile.VOID;
  }

  set(x, y, tile) {
    if(this.inBounds(x, y))
      this.cells[y * this.width + x] = tile;
  }

  fillRect(x, y, width, height, tile) {
    for(let fy = y; fy < y + height; fy++) {
      for(let fx = x; fx < x + width; fx++) {
        this.set(fx, fy, tile);
      }
    }
  }

  forEach(fn) {
    for(let y = 0; y < this.height; y++) {
      for(let x = 0; x < this.width; x++) {
        fn(x, y, this.cells[y * this.width + x]);
      }
    }
  }
  //#endregion

  //#region [ Queries ]
  /** True if any neighbor passes the test */
  someNeighbor(x, y, test, diagonal=true) {
    return (diagonal? Grid.DIRS8: Grid.DIRS4).some(([dx, dy]) => test(this.get(x + dx, y + dy)));
  }

  /**
   * Walking distance (4-dir) from a cell to every other cell, -1 when unreachable.
   * @returns {Int32Array}
   */
  distanceMap(fromX, fromY) {
    const dist  = new Int32Array(this.width * this.height).fill(-1);
    const queue = [[fromX, fromY]];
    dist[fromY * this.width + fromX] = 0;

    for(let q = 0; q < queue.length; q++) {
      const [x, y] = queue[q];
      const d = dist[y * this.width + x];
      for(const [dx, dy] of Grid.DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        const ni = ny * this.width + nx;
        if(!this.inBounds(nx, ny) || dist[ni] !== -1 || !Tile.isWalkable(this.cells[ni])) continue;
        dist[ni] = d + 1;
        queue.push([nx, ny]);
      }
    }
    return dist;
  }
  //#endregion

  toString() {
    let rows = [];
    for(let y = 0; y < this.height; y++) {
      let row = '';
      for(let x = 0; x < this.width; x++) row += Tile.GLYPH[this.get(x, y)];
      rows.push(row);
    }
    return rows.join('\n');
  }
}
