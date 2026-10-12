//#region [ELEMENTS]
const $screen = document.getElementById('screen');
const $gui = document.getElementById('gui');
//#endregion

Gui.init();
Game.init($screen);
Sprites.load().then(() => Game.demo());
