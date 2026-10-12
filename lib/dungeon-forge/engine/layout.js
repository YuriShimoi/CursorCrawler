/** Room placement strategies, each returns Room[] that fit inside the map with a 1 tile border */
class Layout {
  static TYPES = {
    'bsp'    : Layout.bsp,
    'scatter': Layout.scatter
  };

  /**
   * @param {string} type - 'bsp' | 'scatter'
   * @param {Random} rng
   * @param {Object} opt - Dungeon options; opt.start forces a room around that cell
   * @returns {Room[]}
   */
  static generate(type, rng, opt) {
    if(!(type in Layout.TYPES)) throw new Error(`Unknown layout '${type}'`);
    return Layout.TYPES[type](rng, opt);
  }

  /**
   * Random position for a span of `size` inside [min, max], covering `at` when given.
   * @returns {number|null} null when it can't fit
   */
  static fit(rng, min, max, size, at=null) {
    const lo = at === null? min: Math.max(min, at - size + 1);
    const hi = at === null? max - size + 1: Math.min(max - size + 1, at);
    return lo <= hi? rng.int(lo, hi): null;
  }

  /** Binary space partition: cut the map in leaves, one room per leaf */
  static bsp(rng, opt) {
    const leafMin = opt.roomMin + 2; // 1 tile margin each side keeps walls apart
    let leaves = [];

    const split = (x, y, w, h, depth) => {
      const canH = h >= leafMin * 2;
      const canV = w >= leafMin * 2;
      if(depth >= opt.depth || (!canH && !canV)) {
        leaves.push({x, y, w, h});
        return;
      }

      // prefer cutting the long side, so leaves don't become thin strips
      let horizontal = canH && (!canV || (h > w * 1.25? true: w > h * 1.25? false: rng.chance(0.5)));
      if(horizontal) {
        const cut = rng.int(leafMin, h - leafMin);
        split(x, y,       w, cut,     depth + 1);
        split(x, y + cut, w, h - cut, depth + 1);
      }
      else {
        const cut = rng.int(leafMin, w - leafMin);
        split(x,       y, cut,     h, depth + 1);
        split(x + cut, y, w - cut, h, depth + 1);
      }
    };
    split(1, 1, opt.width - 2, opt.height - 2, 0);

    let rooms = [];
    for(const leaf of leaves) {
      // tiny maps: the leaf can't hold roomMin plus margins, so let the room fill it
      const maxW = Math.min(opt.roomMax, leaf.w - 2 >= opt.roomMin? leaf.w - 2: leaf.w);
      const maxH = Math.min(opt.roomMax, leaf.h - 2 >= opt.roomMin? leaf.h - 2: leaf.h);
      if(maxW < opt.roomMin || maxH < opt.roomMin) continue;

      const w = rng.int(opt.roomMin, maxW);
      const h = rng.int(opt.roomMin, maxH);
      const s = opt.start;
      const hasStart = s && s.x >= leaf.x && s.x < leaf.x + leaf.w && s.y >= leaf.y && s.y < leaf.y + leaf.h;

      // start on a leaf margin: drop the margin there, the rooms end up sharing a wall
      const x = Layout.fit(rng, leaf.x + 1, leaf.x + leaf.w - 2, w, hasStart? s.x: null)
             ?? Layout.fit(rng, leaf.x,     leaf.x + leaf.w - 1, w, hasStart? s.x: null);
      const y = Layout.fit(rng, leaf.y + 1, leaf.y + leaf.h - 2, h, hasStart? s.y: null)
             ?? Layout.fit(rng, leaf.y,     leaf.y + leaf.h - 1, h, hasStart? s.y: null);

      const room = new Room(x, y, w, h);
      if(hasStart) room.anchor = {...s};
      rooms.push(room);
    }
    return rooms;
  }

  /** Random placement, rejecting rooms that overlap */
  static scatter(rng, opt) {
    let rooms = [];
    const size = () => [rng.int(opt.roomMin, Math.min(opt.roomMax, opt.width - 2)), rng.int(opt.roomMin, Math.min(opt.roomMax, opt.height - 2))];

    if(opt.start) {
      const [w, h] = size();
      const room = new Room(Layout.fit(rng, 1, opt.width - 2, w, opt.start.x), Layout.fit(rng, 1, opt.height - 2, h, opt.start.y), w, h);
      room.anchor = {...opt.start};
      rooms.push(room);
    }

    for(let attempt = 0; attempt < opt.attempts && rooms.length < opt.rooms; attempt++) {
      const [w, h] = size();
      const room = new Room(Layout.fit(rng, 1, opt.width - 2, w), Layout.fit(rng, 1, opt.height - 2, h), w, h);
      if(rooms.some(r => r.intersects(room, 2))) continue;
      rooms.push(room);
    }
    return rooms;
  }
}
