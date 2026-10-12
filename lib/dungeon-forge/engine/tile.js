class Tile {
  static VOID        = 0;
  static FLOOR       = 1;
  static CORRIDOR    = 2;
  static WALL        = 3;
  static DOOR        = 4;
  static STAIRS_UP   = 5;
  static STAIRS_DOWN = 6;

  static GLYPH = {
    [Tile.VOID]       : ' ',
    [Tile.FLOOR]      : '.',
    [Tile.CORRIDOR]   : '#',
    [Tile.WALL]       : '█',
    [Tile.DOOR]       : '+',
    [Tile.STAIRS_UP]  : '<',
    [Tile.STAIRS_DOWN]: '>'
  };

  static isWalkable(tile) {
    return tile !== Tile.VOID && tile !== Tile.WALL;
  }
}
