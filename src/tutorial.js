/** Tutorial room: the first room of a run, 7x4, with drawings on the floor showing how to shoot and drop a bomb */
class Tutorial {
  static SIZE  = {width: 7, height: 4}; // inner tiles
  static ALPHA = 0.5;                   // how dark the drawing shades the floor
  static RING  = 0.6;                   // pull band opacity inside the drawing, the darkest part
  static SCALE = 0.75;                  // each demo shrunk to fit its share of the room
  static AIM   = {min: 14, max: 44};    // Game.AIM with the pull band narrowed so the rings don't overlap (the docs don't load game.js)
  static CONTRAST = 0.6;                // flattens the drawing's light and dark parts toward each other
  static PIXEL = 3;                     // map px per drawn pixel, half the floor noise cell
  static HOLD  = 0.85;                  // share of the bomb hold arc shown filled
  static free  = null;                  // Tutorial.freeTiles, cached
  static measuring = false;             // sprites drawn as plain boxes: images loaded from file:// would taint the canvas for getImageData
  // left to right, each off the middle line so they don't read as a row
  static DEMOS = [{draw: 'shoot', dy: 12}, {draw: 'bomb', dy: -10}];

  /**
   * Draws the demos on the room floor, in map pixels. The rings and the pieces (aim line, shot, hold arc, bomb) are drawn
   * in color offscreen, turned into a darkness map (grayscale, inverted so light parts shade the most, flattened)
   * and multiplied over the floor, with a gap of bare floor around the pieces so they stand apart from the rings
   * @param {{x, y, width, height}} box - inner room tiles
   */
  static draw(ctx, box) {
    const T = Floor.TILE, P = Tutorial.PIXEL;
    const width = box.width * T, height = box.height * T;
    const rings = Tutorial.layer(width, height, 'ring'), pieces = Tutorial.layer(width, height, 'pieces');

    // small canvas, one pixel per P map px, scaled back up without smoothing
    const src = Tutorial.canvas(Math.ceil(width / P), Math.ceil(height / P));
    const sctx = src.getContext('2d');
    sctx.scale(1 / P, 1 / P);
    sctx.drawImage(rings, 0, 0);
    // black stays bare floor after the inversion: a ring of it around the pieces, one drawn pixel wide
    sctx.filter = 'brightness(0)';
    for(const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]])
      sctx.drawImage(pieces, dx * P, dy * P);
    sctx.filter = 'none';
    sctx.drawImage(pieces, 0, 0);

    // darkness map: what gets multiplied over the floor
    const dark = Tutorial.canvas(src.width, src.height);
    const dctx = dark.getContext('2d');
    dctx.filter = `grayscale(1) invert(1) contrast(${Tutorial.CONTRAST})`;
    dctx.drawImage(src, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const x = box.x * T, y = box.y * T, w = src.width * P, h = src.height * P;
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = Tutorial.ALPHA;
    ctx.drawImage(dark, x, y, w, h);
    ctx.restore();
  }

  /** One part of every demo ('ring' or 'pieces'), in color, on a room-sized canvas */
  static layer(width, height, part) {
    const el = Tutorial.canvas(width, height);
    const ctx = el.getContext('2d');
    Tutorial.DEMOS.forEach(({draw, dy}, i) => {
      ctx.save();
      ctx.translate(width / Tutorial.DEMOS.length * (i + 0.5), height / 2 + dy);
      ctx.scale(Tutorial.SCALE, Tutorial.SCALE);
      Tutorial[draw](ctx, part);
      ctx.restore();
    });
    return el;
  }

  /** Room tiles no drawing touches, as {x, y} offsets from the room corner: where the up stairs may go. Measured once */
  static freeTiles() {
    if(Tutorial.free) return Tutorial.free;
    const T = Floor.TILE, {width: W, height: H} = Tutorial.SIZE;
    const el = Tutorial.canvas(W * T, H * T);
    const ctx = el.getContext('2d');
    Tutorial.measuring = true;
    ctx.drawImage(Tutorial.layer(W * T, H * T, 'ring'), 0, 0);
    ctx.drawImage(Tutorial.layer(W * T, H * T, 'pieces'), 0, 0);
    Tutorial.measuring = false;
    const {data} = ctx.getImageData(0, 0, el.width, el.height);
    Tutorial.free = [];
    for(let ty = 0; ty < H; ty++)
      for(let tx = 0; tx < W; tx++) {
        let used = false;
        for(let y = ty * T; y < (ty + 1) * T && !used; y++)
          for(let x = tx * T; x < (tx + 1) * T && !used; x++) used = data[(y * el.width + x) * 4 + 3] > 0;
        if(!used) Tutorial.free.push({x: tx, y: ty});
      }
    return Tutorial.free;
  }

  /** A sprite, or its tile box while measuring */
  static sprite(ctx, name, x, y) {
    if(!Tutorial.measuring) return Sprites.draw(ctx, name, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, Floor.TILE, Floor.TILE);
  }

  static canvas(width, height) {
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    return el;
  }

  /** Pull band around the press point, like Game.drawAim */
  static ring(ctx, x, y) {
    const {min, max} = Tutorial.AIM;
    ctx.save();
    ctx.globalAlpha = Tutorial.RING;
    ctx.fillStyle = '#f8f8f2';
    ctx.beginPath();
    ctx.arc(x, y, max, 0, Math.PI * 2);
    ctx.arc(x, y, min, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();
  }

  /** Right drag: the line from the press point back to where the cursor was pulled, and the shot flying the other way, past the ring */
  static shoot(ctx, part) {
    const T = Floor.TILE;
    const aim = {x: 4, y: 8}, hero = {x: -8, y: 34};
    if(part === 'ring') return Tutorial.ring(ctx, aim.x, aim.y);

    const dist = Math.hypot(aim.x - hero.x, aim.y - hero.y);
    const dir = {x: (aim.x - hero.x) / dist, y: (aim.y - hero.y) / dist};
    // thicker than in game: at least one drawn pixel wide after the scale
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle = '#f8f8f2';
    ctx.beginPath();
    ctx.moveTo(aim.x, aim.y);
    ctx.lineTo(hero.x, hero.y);
    ctx.stroke();
    ctx.fillRect(aim.x - 4, aim.y - 4, 8, 8);

    const d = Tutorial.AIM.max + 22;
    Tutorial.sprite(ctx, 'playerProjectile', aim.x + dir.x * d - T / 2, aim.y + dir.y * d - T / 2);
  }

  /** Right hold still: the hold arc almost full around the bomb it drops */
  static bomb(ctx, part) {
    const T = Floor.TILE;
    if(part === 'ring') return;
    Tutorial.sprite(ctx, 'bomb', -T / 2, -T / 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#8be9fd';
    ctx.beginPath();
    ctx.arc(0, 0, Tutorial.AIM.min + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Tutorial.HOLD);
    ctx.stroke();
  }
}
