/** Sound effects by game event and the ambience loop, which fades to the boss track while a boss room is sealed */
class Sound {
  static ASSETS = 'assets/sounds/'; // relative to the page, the docs set '../assets/sounds/'

  // one file per event in sfx/<name>.wav
  static SFX = ['hit', 'kill', 'hurt', 'bomb', 'break', 'open', 'stairs', 'boss', 'death'];
  static AMBIENCE = {dungeon: 'dungeonAmbience', boss: 'darkCavern'}; // ambience/<file>.ogg

  static VOLUME = {sfx: 0.5, ambience: 0.35};
  static FADE   = 1.5; // s for a full cross-fade

  static loops = {};       // mood -> looping <audio>
  static mood = 'dungeon'; // the loop fading in
  static started = false;

  static play(name) {
    const audio = new Audio(`${Sound.ASSETS}sfx/${name}.wav`);
    audio.volume = Sound.VOLUME.sfx;
    // blocked until the page gets a click, nothing to do about it
    audio.play().catch(() => {});
  }

  /** Starts the loops right away, from the start menu on; browsers hold audio until the first click or key, so it retries then */
  static init() {
    Sound.start();
    const retry = () => {
      Sound.start();
      if(!Sound.started) return;
      removeEventListener('pointerdown', retry);
      removeEventListener('keydown', retry);
    };
    addEventListener('pointerdown', retry);
    addEventListener('keydown', retry);
  }

  /** Starts both loops, the boss one silent */
  static start() {
    if(Sound.started) return;
    Sound.started = true;
    for(const [mood, file] of Object.entries(Sound.AMBIENCE)) {
      const audio = new Audio(`${Sound.ASSETS}ambience/${file}.ogg`);
      audio.loop = true;
      audio.volume = mood === Sound.mood? Sound.VOLUME.ambience: 0;
      audio.play().catch(() => {
        audio.pause();
        Sound.started = false;
      });
      Sound.loops[mood] = audio;
    }
  }

  /** Eases each loop toward full volume when it's the current mood, silence otherwise */
  static update(dt, mood) {
    Sound.mood = mood;
    const step = Sound.VOLUME.ambience * dt / Sound.FADE;
    for(const [name, audio] of Object.entries(Sound.loops)) {
      const target = name === mood? Sound.VOLUME.ambience: 0;
      audio.volume += Math.max(-step, Math.min(step, target - audio.volume));
    }
  }
}
