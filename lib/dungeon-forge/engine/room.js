class Room {
  /**
   * Bounding box given by the layout; the floor is the union of `parts`
   * (a single rect filling the box unless reshaped).
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   */
  constructor(x, y, width, height) {
    this.id     = null;
    this.x      = x;
    this.y      = y;
    this.width  = width;
    this.height = height;
    this.anchor = null; // cell the floor must include (forced start)
    this.parts  = [{x, y, width, height}];
  }

  get right()  { return this.x + this.width - 1; }
  get bottom() { return this.y + this.height - 1; }

  /** Center of the main part, always a floor cell */
  get center() {
    const main = this.parts[0];
    return {x: Math.floor(main.x + main.width / 2), y: Math.floor(main.y + main.height / 2)};
  }

  contains(x, y) {
    return this.parts.some(p => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height);
  }

  /** Bounding box test. @param {number} padding - extra tiles that must stay free between both */
  intersects(other, padding=0) {
    return this.x - padding <= other.right  && this.right  + padding >= other.x
        && this.y - padding <= other.bottom && this.bottom + padding >= other.y;
  }

  randomCell(rng) {
    const p = rng.pick(this.parts);
    return {x: rng.int(p.x, p.x + p.width - 1), y: rng.int(p.y, p.y + p.height - 1)};
  }

  /**
   * Rebuilds the floor as overlapping rects inside the bounding box.
   * Every part overlaps an earlier one, so the floor stays connected.
   * @param {Random} rng
   * @param {number} extra - rects added over the main one
   */
  reshape(rng, extra) {
    const min = (size) => Math.min(size, Math.max(2, Math.ceil(size / 2)));
    const rect = (w, h, at=null) => {
      const x = at? rng.int(Math.max(this.x, at.x - w + 1), Math.min(this.right  - w + 1, at.x)): rng.int(this.x, this.right  - w + 1);
      const y = at? rng.int(Math.max(this.y, at.y - h + 1), Math.min(this.bottom - h + 1, at.y)): rng.int(this.y, this.bottom - h + 1);
      return {x, y, width: w, height: h};
    };
    const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

    this.parts = [rect(rng.int(min(this.width), this.width), rng.int(min(this.height), this.height), this.anchor)];
    for(let i = 0; i < extra; i++) {
      for(let attempt = 0; attempt < 20; attempt++) {
        const part = rect(rng.int(Math.min(2, this.width), this.width), rng.int(Math.min(2, this.height), this.height));
        if(!this.parts.some(p => overlaps(p, part))) continue;
        this.parts.push(part);
        break;
      }
    }
  }

  carve(grid) {
    this.parts.forEach(p => grid.fillRect(p.x, p.y, p.width, p.height, Tile.FLOOR));
  }
}
