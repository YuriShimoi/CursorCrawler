/** Static things on a tile: props, pickups, traps and wall cracks */
class Entity {
  /*
   * solid  : blocks movement (not light), unused for now: every prop is walkable
   * pickup : collected by touching
   * hazard : hurts while active
   * light  : static light radius in tiles. Campfires light once seen, torches once lit by the hero
   */
  static TYPES = {
    chest   : {sprite: 'chest'},
    jar     : {sprite: 'jar'},
    box     : {sprite: 'box'},
    lever   : {sprite: 'lever'},
    torch   : {sprite: 'unlitTorch', light: 3.5},
    campfire: {sprite: 'campfire', light: 4.5},
    stones  : {sprite: 'stones'},
    rubble  : {sprite: 'stones'},
    gold    : {sprite: 'gold', pickup: true},
    key     : {sprite: 'key', pickup: true},
    item    : {sprite: 'item', pickup: true},
    bomb    : {sprite: 'bomb', pickup: true},
    heart   : {sprite: 'heart', pickup: true},  // boss loot: max health, amount in half hearts
    spikes  : {sprite: 'spikes', hazard: true},
    crack   : {sprite: 'crackedWall', wall: true},
    door    : {sprite: 'door'},              // shop entrance on boss floors, on a floor tile
    shopChest: {sprite: 'chest'},            // items + price, bought with gold
    shopFire: {sprite: 'campfire'},          // paid healing, a few uses
    link    : {sprite: 'item'},              // credits room: opens a docs page
    creditsDoor: {sprite: 'door'}            // credits room: on to infinite mode
  };

  constructor(type, tx, ty, data={}) {
    this.type = type;
    this.tx = tx;
    this.ty = ty;
    this.alive = true;
    Object.assign(this, Entity.TYPES[type], data);
  }

  get cx() { return (this.tx + 0.5) * Floor.TILE; }
  get cy() { return (this.ty + 0.5) * Floor.TILE; }

  /** Distance from a point to this tile's box */
  distanceTo(x, y) {
    return this.distanceToBox(x, y, x, y);
  }

  /** Gap between a box and this tile's box, 0 when they overlap */
  distanceToBox(left, top, right, bottom) {
    const T = Floor.TILE;
    const dx = Math.max(this.tx * T - right, 0, left - (this.tx + 1) * T);
    const dy = Math.max(this.ty * T - bottom, 0, top - (this.ty + 1) * T);
    return Math.hypot(dx, dy);
  }

  draw(ctx, floor) {
    const T = Floor.TILE;
    const px = this.tx * T, py = this.ty * T;

    ctx.save();
    if(this.type === 'spikes' && !floor.spikesOn && !this.always) ctx.globalAlpha = 0.3;
    Sprites.draw(ctx, this.currentSprite, px, py);
    ctx.restore();
  }

  /** Sprite for the current state */
  get currentSprite() {
    if(this.type === 'torch' && this.lit) return 'torch';
    if(this.type === 'lever' && this.pulled) return 'activeLever';
    if(this.type === 'chest' && this.opened) return 'openedChest';
    if(this.type === 'shopChest' && this.opened) return 'openedChest';
    if(this.type === 'campfire' && this.used) return 'unlitCampfire';
    if(this.type === 'shopFire' && !this.uses) return 'unlitCampfire';
    return this.sprite;
  }
}
