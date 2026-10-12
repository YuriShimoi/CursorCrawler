/** The player: a cursor arrow whose tip is the position */
class Hero {
  // arrow outline, relative to the tip
  static SHAPE = [[0, 0], [0, 14], [3.5, 10.5], [6, 16], [8.5, 15], [6, 9.5], [10.5, 9.5]];
  // pointing hand, relative to the fingertip
  static POINTER = [
    [-1, 0], [1, 0], [2, 1], [2, 6], [4, 5.5], [5, 6.5], [6.5, 6.5], [7.5, 7.5],
    [8.5, 7.8], [9.5, 9], [9.5, 13], [7.5, 17], [1.5, 17], [-2, 12.5], [-4, 9.5],
    [-3.5, 8.5], [-2, 9], [-2, 1]
  ];
  static BOX   = {width: 11, height: 16};
  static STEP  = 2;

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  /** Moves by a mouse delta, sliding along walls */
  move(dx, dy, floor) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Hero.STEP) || 1;
    const sx = dx / steps, sy = dy / steps;

    for(let s = 0; s < steps; s++) {
      if(this.fits(this.x + sx, this.y, floor)) this.x += sx;
      if(this.fits(this.x, this.y + sy, floor)) this.y += sy;
    }
  }

  fits(x, y, floor) {
    const {width, height} = Hero.BOX;
    return floor.isFreeAt(x, y)
        && floor.isFreeAt(x + width, y)
        && floor.isFreeAt(x, y + height)
        && floor.isFreeAt(x + width, y + height);
  }

  /** Puts the tip inside a tile, keeping the whole arrow in it */
  placeIn(tx, ty) {
    const T = Floor.TILE;
    const {width, height} = Hero.BOX;
    this.x = Math.min(Math.max(this.x, tx * T + 1), tx * T + T - width  - 1);
    this.y = Math.min(Math.max(this.y, ty * T + 1), ty * T + T - height - 1);
  }

  /** @param {boolean} pointer - hand shape over interactive things */
  draw(ctx, pointer=false) {
    const path = new Path2D();
    (pointer? Hero.POINTER: Hero.SHAPE).forEach(([px, py], i) => i? path.lineTo(this.x + px, this.y + py): path.moveTo(this.x + px, this.y + py));
    path.closePath();

    // hard offset shadow, no blur
    ctx.save();
    ctx.translate(2, 2);
    ctx.fillStyle = '#000000';
    ctx.fill(path);
    ctx.restore();

    ctx.fillStyle = '#f8f8f2';
    ctx.fill(path);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#121212';
    ctx.stroke(path);
  }
}
