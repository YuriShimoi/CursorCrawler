/** PNG sprites from assets/<folder>/ at native size: 12x12 pixels per tile (boss 24x24), two tones of one hue */
class Sprites {
  static ASSETS = 'assets/'; // relative to the page, the docs set '../assets/'

  // folder of each sprite ('ui' ones are HUD <img>s, loaded too so the style page can draw them)
  static FOLDERS = {
    props  : ['stairsUp', 'stairsDown', 'door', 'chest', 'openedChest', 'box', 'jar', 'campfire', 'unlitCampfire',
              'torch', 'unlitTorch', 'lever', 'activeLever', 'stones', 'crackedWall', 'spikes'],
    loot   : ['gold', 'key', 'bomb', 'item', 'heart'],
    enemies: ['zombie', 'skeleton', 'slime', 'smallSlime', 'mimic', 'spider', 'goblin', 'knight', 'shield'],
    bosses : ['beholder', 'slimeKing', 'golem', 'worm', 'necromancer'],
    shots  : ['projectile', 'playerProjectile', 'web'],
    decals : ['corpse', 'junk', 'remains'],
    ui     : ['heartHalf', 'heartEmpty']
  };

  // every sprite, loaded up front
  static NAMES = Object.values(Sprites.FOLDERS).flat();

  // size in tiles, default 1
  static TILES = {beholder: 2, necromancer: 2, slimeKing: 2, golem: 2, worm: 2, remains: 2};

  static images = {};

  static tiles(name) {
    return Sprites.TILES[name] ?? 1;
  }

  /** Path of a sprite's png, relative to the page */
  static src(name) {
    const folder = Object.keys(Sprites.FOLDERS).find(f => Sprites.FOLDERS[f].includes(name));
    return `${Sprites.ASSETS}${folder}/${name}.png`;
  }

  /**
   * Loads every sprite
   * @param {string} base - assets folder, relative to the page
   */
  static load(base=Sprites.ASSETS) {
    Sprites.ASSETS = base;
    return Promise.all(Sprites.NAMES.map(name => new Promise(resolve => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = () => {
        console.warn(`Couldn't load icon '${name}'.`);
        resolve();
      };
      img.src = Sprites.src(name);
      Sprites.images[name] = img;
    })));
  }

  /** Draws an icon with its top-left at (px, py) */
  static draw(ctx, name, px, py, tile=Floor.TILE) {
    const img = Sprites.images[name];
    // still loading, or a missing file (drawing a broken image throws)
    if(!img?.complete || !img.naturalWidth) return;
    const size = tile * Sprites.tiles(name);
    // scale pixel art up without blur
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px, py, size, size);
    ctx.imageSmoothingEnabled = smoothing;
  }
}
