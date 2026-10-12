/** DOM overlay: start/pause/death menu, HUD and popover */
class Gui {
  static $menu;
  static $title;
  static $button;
  static $hint;
  static $hud;
  static $hearts;
  static $gold;
  static $keys;
  static $bombs;
  static $depth;
  static $controls;
  static $menuControls;
  static $popover;
  static $vignette;

  static RETRY_DELAY = 2;   // s
  static FADE        = 300; // ms, start and retry
  static FAST_FADE   = 120; // ms, between floors

  // heart icon by fill, in half hearts
  static HEARTS = ['heartEmpty', 'heartHalf', 'heart'];
  static TAIL   = 7; // px, popover tail height (style.css)

  static init() {
    Gui.$menu     = document.getElementById('menu');
    Gui.$title    = document.getElementById('title');
    Gui.$button   = document.getElementById('menu-button');
    Gui.$hint     = document.getElementById('hint');
    Gui.$hud      = document.getElementById('hud');
    Gui.$hearts   = document.getElementById('hud-hearts');
    Gui.$gold     = document.getElementById('hud-gold');
    Gui.$keys     = document.getElementById('hud-keys');
    Gui.$bombs    = document.getElementById('hud-bombs');
    Gui.$depth    = document.getElementById('hud-depth');
    Gui.$controls = document.getElementById('controls');
    Gui.$menuControls = document.getElementById('menu-controls');
    // same list as the in-game controls bubble, shown on the start and death screens (missing on the docs pages)
    if(Gui.$menuControls) Gui.$menuControls.innerHTML = Gui.$controls.innerHTML;
    else Gui.$menuControls = {};
    Gui.$popover  = document.getElementById('popover');
    Gui.$vignette = document.getElementById('vignette');

    Gui.$button.onclick = e => {
      if(Gui.$button.disabled) return;
      if(Game.state === 'menu' || Game.state === 'dead') {
        Gui.$button.disabled = true;
        Gui.fade(() => Game.start(e.clientX, e.clientY));
      }
      else if(Game.state === 'pause') Game.resume();
    };
  }

  /**
   * Fades to black, runs the change, fades back in
   * @param {number} duration - ms each way
   */
  static fade(change, duration=Gui.FADE) {
    const $fade = document.getElementById('fade');
    $fade.style.transitionDuration = `${duration}ms`;
    $fade.classList.add('on');
    setTimeout(() => {
      change();
      $fade.classList.remove('on');
    }, duration);
  }

  //#region [ MENU ]
  static play() {
    Gui.$menu.hidden = true;
    Gui.$hud.hidden = false;
    Gui.$controls.hidden = false;
  }

  static pause() {
    Gui.menu('PAUSED', 'CONTINUE', 'press Esc anytime to release the cursor');
    Gui.$menuControls.hidden = true;
  }

  /** Death screen: button lower and locked for a moment, so attack clicks can't hit it */
  static dead(depth, gold) {
    Gui.$popover.hidden = true;
    Gui.$vignette.classList.remove('dark', 'red');
    Gui.menu('YOU DIED', 'RETRY', `floor ${depth}, ${gold} gold. the next dungeon is built around your click`, true);

    Gui.$button.disabled = true;
    let left = Gui.RETRY_DELAY;
    const tick = () => {
      if(left <= 0) {
        Gui.$button.textContent = 'RETRY';
        Gui.$button.disabled = false;
        return;
      }
      Gui.$button.textContent = `RETRY (${left--})`;
      setTimeout(tick, 1000);
    };
    tick();
  }

  static menu(title, button, hint, dead=false) {
    Gui.$title.textContent  = title;
    Gui.$button.textContent = button;
    Gui.$hint.textContent   = hint;
    Gui.$button.disabled = false;
    Gui.$menu.classList.toggle('dead', dead);
    Gui.$menuControls.hidden = false;
    Gui.$menu.hidden = false;
  }
  //#endregion

  //#region [ HUD ]
  /** HUD numbers; hp and maxHp count half hearts */
  static stats({hp, maxHp, gold, keys, bombs}) {
    let hearts = '';
    for(let i = 0; i < maxHp / 2; i++) {
      const fill = Math.max(0, Math.min(2, hp - i * 2));
      // odd max: the last slot holds half a heart, drawn as the left half of the icon
      const half = maxHp - i * 2 === 1;
      hearts += `<img class="icon${half? ' half': ''}" src="${Sprites.src(Gui.HEARTS[fill])}" alt="">`;
    }
    Gui.$hearts.innerHTML = hearts;
    Gui.$vignette.classList.toggle('dark', hp === 2);
    Gui.$vignette.classList.toggle('red', hp === 1);
    Gui.$gold.textContent  = gold;
    Gui.$keys.textContent  = keys;
    Gui.$bombs.textContent = bombs;
  }

  /** Floor number, red on boss floors; the credits room passes its name */
  static floor(depth) {
    Gui.$depth.textContent = depth;
    Gui.$depth.classList.toggle('boss', typeof depth === 'number' && depth % Floor.BOSS_EVERY === 0);
  }

  /** Boss health bar with the boss's own name, hidden when null */
  static boss(boss) {
    const $bar = document.getElementById('bossbar');
    $bar.hidden = !boss;
    if(!boss) return;
    const $name = document.getElementById('bossbar-name');
    const name = boss.name.toUpperCase();
    if($name.textContent !== name) $name.textContent = name;
    document.getElementById('bossbar-fill').style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
  }

  static flash() {
    const $flash = document.getElementById('flash');
    $flash.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => $flash.classList.remove('on')));
  }

  /** Speech bubble above the hero with the icon of what a click does (null hides it) */
  static popover(target, x, y) {
    Gui.$popover.hidden = !target;
    if(!target) return;

    const items = target.items?.map(g => `${g.sprite}${g.amount}`).join() ?? '';
    const id = `${target.icon}|${target.text}|${items}|${target.enabled}`;
    if(Gui.$popover.dataset.id !== id) {
      Gui.$popover.dataset.id = id;
      // shop chests list their goods (sprite and amount) instead of an icon
      Gui.$popover.innerHTML = target.items?
        target.items.map(g => `<img class="icon" src="${Sprites.src(g.sprite)}" alt="">${g.amount > 1? `<b>${g.amount}</b>`: ''}`).join(''):
        `<i class="fa-solid ${target.icon}"></i>${target.text? `<span>${target.text}</span>`: ''}`;
      Gui.$popover.classList.toggle('disabled', !target.enabled);
      // even width so the tail centers on a whole pixel
      Gui.$popover.style.width = '';
      Gui.$popover.style.width = `${Gui.$popover.offsetWidth + Gui.$popover.offsetWidth % 2}px`;
    }
    // centered over the point with the tail tip just above it, on whole pixels so the 1px lines stay crisp
    const {offsetWidth: w, offsetHeight: h} = Gui.$popover;
    Gui.$popover.style.left = `${Math.round(x - w / 2)}px`;
    Gui.$popover.style.top  = `${Math.round(y - h - Gui.TAIL - 4)}px`;
  }
  //#endregion
}
