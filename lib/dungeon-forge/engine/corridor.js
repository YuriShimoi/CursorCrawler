class Corridor {
  /**
   * Picks which rooms get linked: a minimum spanning tree (every room reachable)
   * plus a few extra links so the map has loops.
   * @param {Room[]} rooms
   * @param {Random} rng
   * @param {number} loops - chance per room of an extra link to its nearest unlinked room
   * @returns {[Room, Room][]}
   */
  static connect(rooms, rng, loops=0) {
    if(rooms.length < 2) return [];

    const distance = (a, b) => Math.abs(a.center.x - b.center.x) + Math.abs(a.center.y - b.center.y);
    const key = (a, b) => a.id < b.id? `${a.id}|${b.id}`: `${b.id}|${a.id}`;
    let links = [];
    let linked = new Set();

    // Prim
    let inTree = new Set([rooms[0]]);
    while(inTree.size < rooms.length) {
      let best = null;
      for(const a of inTree) {
        for(const b of rooms) {
          if(inTree.has(b)) continue;
          const d = distance(a, b);
          if(best === null || d < best.d) best = {a, b, d};
        }
      }
      inTree.add(best.b);
      links.push([best.a, best.b]);
      linked.add(key(best.a, best.b));
    }

    for(const a of rooms) {
      if(!rng.chance(loops)) continue;
      const candidates = rooms.filter(b => b !== a && !linked.has(key(a, b)))
                              .sort((b, c) => distance(a, b) - distance(a, c));
      if(!candidates.length) continue;
      links.push([a, candidates[0]]);
      linked.add(key(a, candidates[0]));
    }
    return links;
  }

  /**
   * L-shaped path between room centers. Only digs through VOID, so it never
   * overwrites room floor.
   * @returns {{x:number, y:number}[]} carved cells
   */
  static carve(grid, a, b, rng) {
    const from = a.randomCell(rng);
    const to   = b.randomCell(rng);
    const corner = rng.chance(0.5)? {x: to.x, y: from.y}: {x: from.x, y: to.y};
    let cells = [];

    const line = (p, q) => {
      const sx = Math.sign(q.x - p.x);
      const sy = Math.sign(q.y - p.y);
      let x = p.x;
      let y = p.y;
      while(true) {
        if(grid.get(x, y) === Tile.VOID) {
          grid.set(x, y, Tile.CORRIDOR);
          cells.push({x, y});
        }
        if(x === q.x && y === q.y) break;
        x += sx;
        y += sy;
      }
    };
    line(from, corner);
    line(corner, to);
    return cells;
  }
}
