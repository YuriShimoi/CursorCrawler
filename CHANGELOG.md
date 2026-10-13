# Changelog

All notable changes to this project are documented here.
This project follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## 2026-10-11 - Half hearts and title font

- Hero bombs now break jars and boxes in blast reach. Hero shots break jars (the shot is spent). Implemented via a new Game.smash(e) helper (src/game.js), also used by the manual 'break' action; jar check added in Projectile.update (src/actors.js).
- Health counts half hearts: each hit costs half a heart. Start 3 (1½ hearts), max 12 (six hearts). Gem heals one heart, or at full health adds half a max heart 40% of the time (Game.GROW_CHANCE), otherwise 15 gold. HUD draws half hearts as an outline heart with a solid heart clipped to its left half (.half-heart); Font Awesome Free has no half-heart icon. Floating texts show hearts with no fractions, half hearts count as 1 (Game.hearts, e.g. "-1 ♥", "+2 ♥", "+1 ♥ max").
- Odd max health is supported: the last heart slot is half capacity, drawn as the left half of the icon (#hud-hearts .icon.half, 12px wide, object-fit cover, object-position left).
- Jars only drop coins (60%) or nothing; boxes keep the mixed loot.
- The boss bar stays on screen after dying.
- Title font: Jacquard 24 (OFL, Google Fonts), pixel blackletter in the old RPG style, at 5.5rem with a hard shadow. Downloaded candidates in assets/fonts/: Jacquard24, Jacquard12, PressStart2P, Silkscreen, PixelifySans, Jersey10. Comparison page in D:\claude_cache\design-samples\cursor-crawler-fonts\.
- Title font switched to Jersey 10 (tall condensed pixel). Only Jersey10 and Jacquard24 are kept in assets/fonts/; the other candidates were removed.
- Title sits closer to the START button (top: calc(50% - 128px)).
- Start screen hint text removed (the #hint element stays for the pause and death screens).
- docs/style.html has a new TITLE section showing the game title in the Jersey 10 "Title" font.
- HUD icons now use the sprite PNGs (assets/icons gold, key, bomb) at 2x via a new `.icon` class (24px, image-rendering pixelated), replacing the Font Awesome coins/key/bomb icons. HUD bubbles are 34px tall to fit them.
- Hearts use the new heart, heartHalf and heartEmpty sprites (Gui.HEARTS, indexed by fill in half hearts). The old .half-heart clip-path trick is removed.
- Style page (docs/style.html) UI components updated: sprite HUD icons, a heart row showing full/half/empty, Descend popover icon fixed to fa-arrow-down.
- Combat rework: click-to-attack removed. Aiming is slingshot-style: right press marks a point, the hero keeps moving with the mouse but is held within 72px of it (Game.pullLimit); release fires from the hero back through the press point once pulled past 14px. Drawn as a subtle light donut between the min and max radius plus a line from the press point to the hero. Shot cooldown 0.3s (Game.SHOT_COOLDOWN).
- Projectile now takes {hostile, damage}: hero shots fly at 360px/s (enemy 220), hit actors, and stay visible in the dark (white pixel block with hard shadow).
- Bombs: holding the right button still (inside the min radius) for 1s (Game.BOMB.hold) drops a bomb at the hero if they have one, shown by a cyan progress arc. 1.5s fuse, blinks the whole time (8Hz, 16Hz in the last half second), explodes hurting only actors (3 dmg, reach 2 tiles via Game.BOMB.actorReach) and opening cracked walls within 1.2 tiles, with a cyan ring sized to the actor reach. Cracked walls are no longer click-to-bomb; their popover is only a "Cracked wall" hint.
- New Skeleton enemy (skeleton.png, extends Enemy): ranged, holds still and shoots when it sees the hero, backs off when closer than 3 tiles. Spawns from floor 2 at ~30% of enemies.
- Sprites renamed: enemy -> zombie, boss -> beholder.
- Scaling by Actor.tier(depth) (boss floors cleared): enemies +1 hp per tier and +1 damage every 2 tiers; beholder +50% base hp and +1 damage per tier. Boss bar uses boss.maxHp.
- Campfires heal 2 half hearts (Game.REST_HEAL, was 6).
- Low-health vignette (#vignette): a faint dark edge at 2 half hearts and a faint red edge at 1 half heart, as ::before/::after layers that each fade in and out over 1.2s.
- Controls bubble lists R-Drag to shoot and R-Hold still to bomb (game and style page); style page entity list uses the new sprite names.
- Hero shots use the new playerProjectile.png sprite.
- Popover is now an icon-only speech bubble centered above the hero with a bottom tail (CSS ::before/::after triangles, drop-shadow); all text labels removed from interaction targets. Style page popovers updated.
- Popover icons: chest is now fa-key (both open and locked), campfire is fa-heart.
- Style page (docs/style.html) UI COMPONENTS lists every popover bubble in use (descend, sealed stairs, chest with/without key, break, lever on/off, torch, rest and rest at full health, cracked wall, shop door, shop chest goods with/without gold), each in a card with its icon class.
- Bombs drop on the center of the hero's tile, one per tile.
- Campfires burn out after resting: new unlitCampfire.png sprite, and their light source is removed.
- Zombies (and skeletons) faster: dash 0.14s per tile (was 0.2), pauses chase 0.3s / wander 1.2s (was 0.5 / 1.6).
- Popover tail fix: the bubble is auto width (min 30px, kept even by Gui.popover) and positioned on whole pixels (no translate(-50%)); disabled shop goods fade, and the fill triangle is the same size as the border one but 2px higher, so it covers the bottom border with no seam and leaves ~1px tail edges (Gui.TAIL = 7).
- Shop (new src/shop.js, class Shop): every boss floor gets a door (door.png) as a floor prop: on a free floor tile of a room, never in or against the boss arena (the arena box plus its walls is excluded). Half of the time it goes in the secret alcove behind the cracked wall when the floor has one, but that variant is skipped when the cracked wall faces the arena. Placement falls back to looser spacing, then the start room, so every boss floor gets a door (12/12 in tests). Clicking it swaps Game.floor/Game.entities for a 9x6-tile walled room drawn on a new 'shop' canvas layer (z 25, 150ms opacity fade) over the dimmed dungeon. The room opens toward any side that fits the map. The shop door is a floor tile on the first inner row against the wall (Shop.layout checks the wall behind it and the far wall fit the map); the hero enters one step past it, and leaving puts the hero on the dungeon door tile. Door targeting measures from the whole arrow box, like walls. The dungeon freezes while inside (no actors, shots, bombs or light updates; aiming disabled). Inside: 3 chests (shopChest) each with 1-3 random goods (bombs 16g, keys 20g, gem 28g, +max heart 60g, per unit) priced by their sum with a +50% markup per tier; goods are no longer drawn in the room, the popover bubble over a chest lists them (sprite + amount) instead of an icon, and the price stays below each chest. A campfire (shopFire) sits in the top right inner corner, stepping left off the door and entry tiles, heals half a heart for 12g (tier markup), 3 uses, then goes unlit. Its price shows only below it, like the chests. Shop state persists per door. New give type 'heart'.
- Boss floors: the sealed exit stairs are drawn with the stairsUp sprite until the beholder dies (floor.sealed).
- Beholder volleys rotate between patterns, never the same twice in a row: fan (5 aimed), ring (10), burst (4 shots aimed one by one), spiral (12); x1.5 shots when enraged. Reload 1.8s (x0.7 enraged).
- Enemy outline is now a 2px white ring at 80% opacity, built once per sprite and size (Sprites.OUTLINE).
- Start and death menus list the controls (#menu-controls, copied from the in-game controls bubble; hidden on pause).
- Skeletons shoot every 1.2s (was 2s).
- Sprites.draw skips broken (missing) images instead of throwing.
- All coin drops halved through Game.GOLD_RATE = 0.5, applied in Game.give('gold') (minimum 1).
- Spike lever is always reachable from the start without stepping on spikes: Populate.reachable flood-fills from the start tile avoiding spike tiles, and the lever only goes on a reached tile (spaced first, then any free tile in any room); with none, the spikes start lowered.
- Boss bullets in flight are no longer cleared when the beholder dies.
- Death reveals the whole floor like the start screen: the light layer fades out over 0.8s (Game.darkness / Game.REVEAL) and every actor and shot is drawn; the darkness snaps back on retry.
- Death screen text sits lower: title at 50% - 170px, hint at 50% - 65px.
- Boss arena lockdown: once the whole arrow is inside the arena while the beholder lives, every open tile on the ring around the arena (corners skipped) turns into wall ("the passages close"); they reopen when the boss or the hero dies (Game.sealArena / unsealArena, Game.arenaSeal). New Floor.set(changes) rebuilds segments and noise after tile changes; Floor.open uses it.
- Boss bar moved to the bottom center (it overlapped the controls bubble at the top), wider track (min(520px, 70vw), 10px tall), name centered above it (#bossbar-name, ellipsis when too long). The name comes from boss.name (Boss sets 'Beholder'; future bosses set their own), upper-cased by Gui.boss.
- Fix: arena passages stayed walled after the boss died. The dead boss stays in Game.actors until the next filter, so the same frame's seal check found it and sealed the arena again; Game.boss now only returns a living boss.
- New enemies (src/enemies.js), spawned by a weighted roster by depth (Populate.ENEMIES): Slime (3; slow hopper, splits into 2 small slimes on death), Spider (3; lurks still, keeps away, web shots slow the hero to 40% for 2s), Goblin (4; keeps away, lobs bombs onto the hero's tile with a red danger area, 1.4s fuse; they hurt only the hero and never open cracked walls), Knight (6; shield in front (now a sprite: placeholder shield.png, 12x12 drawn at 24px, on its front side, drawn behind the knight when facing up, replacing the white bar), shots only hurt from behind or the sides, bombs always; slower: dash 0.2s, chase pause 0.75s; the shield only turns when it steps, facing its last move, so it can be flanked), no Archer (removed: instead each skeleton burst fires a random 1 to N shots, 0.15s apart, where N grows by one every 6 floors up to 5; Skeleton.BURST, spiders keep single webs). Mimic: from floor 3, 35% of floors hide one as a keyless chest; hovering it wakes a fast chaser that drops 20+ gold and a gem.
- Grid enemies can step diagonally now and then (Enemy.diagonal chance; both side tiles must be open so they never cut wall corners; while chasing only when the hero is off both axes; a diagonal dash takes sqrt(2) times longer): zombie 25%, mimic 40%, slime and knight 20%; skeleton, spider and goblin stay orthogonal.
- Bosses come in a fixed order by difficulty, looping after the last (Populate.BOSSES): Beholder, Slime King, Golem, Worm, Necromancer on floors 5, 10, 15, 20, 25, then again from floor 30.
- New bosses (src/bosses.js, all extend Boss): Necromancer (summons zombie/skeleton waves every 9s, growing; fan and burst volleys; shielded while any minion lives: the shield breaks after 4 shots (the 4th is spent on the shield) or at once with a bomb, blinks white on each blocked shot and fades with each hit, and a fresh shield needs 4 again; raising a wave it stops for 1.4s with the spawn spots marked (Actor.drawMark), then the minions rise with half the health of their kind on that floor), Slime King (bounces around the sealed arena, every hit splits off a small slime and shrinks it, faster as it shrinks), Golem (slow, armored front; the charge moves in small straight steps and stops dead at the first one that doesn't fit (it used to slide along walls when only one axis was blocked); each cycle it picks a ground pound when the hero is within 2.3 tiles (0.55s windup, red shockwave ring, hurts in reach), otherwise a charge or a spike line (0.5s aim, spikes rise tile after tile toward the hero until a wall, 0.07s apart, 1.5s each); it never uses the same attack three times in a row (keeps its last two in history; a third pound in a row becomes a charge or spike line); stunned 2.5s when it hits a wall; shots from the front only land while stunned; blast rings take an optional radius (r)), Worm (swims under the floor once the arena is sealed; it is faster now (under 1-1.6s, warning 0.75s, up 1.8s; below half health (Worm.ENRAGED) all its timings x0.7 (under, warning, up, volley delays) and its shots 1.3x faster, Projectile takes an optional speed) and sometimes chains a quick 0.45s dive (35%, 60% enraged); the surfacing volley rotates between ring (12), double ring (10+10 offset), spiral (18), three aimed fans of 5, and cross (3 waves of 8), x1.5 enraged; the warning is drawn with Actor.drawMark: a red ring closing in plus blinking cracks next to the hero; hittable only while up).
- Monster camp: on normal floors after floor 5, 50% chance (Floor.CAMP_CHANCE) of a bigger 13x9 room (arena layout with opt.big = Floor.CAMP) holding 6 + depth monsters (max 16) and a keyless chest; it gets the full-room light like the arena but is not sealed.
- Actor base: shot queue for every actor, fire()/shot() options, hit kinds ('shot' | 'blast' | 'spikes'), died() hook called by Game.kill, hittable getter, scale, flying, Boss.setHp. Projectile takes sprite and effect ('slow'). Temporary always-on spikes (Game.spawnSpikes / updateSpikes).
- Placeholder sprites (colored blobs with eyes, to be replaced): slime, mimic, spider, web, goblin, knight, shield (12x12) and necromancer, slimeKing, golem, worm (24x24).
- Boss test page docs/arena.html: pick a boss and a floor number; it shows the tier and the boss hp/damage there, and pre-fills the hero's max health, bombs, gold and keys with an estimate for that floor (editable). FIGHT builds only the boss arena, centered on the map (16x11, up stairs left, down stairs right, boss in the middle) through a new Game.buildFloor hook; the 'start inside the arena' option and the Floor.forceBoss / Populate.forceBoss hooks are gone. The panel replaces the pause (with CONTINUE) and death menus. Test hooks: Game.buildFloor, Game.start(x, y, {depth, stats}), Gui.ICONS (sprite folder relative to the page).
- Fix: the boss arena could fail to fit when the start stairs were near the middle of the map, leaving a normal room as the arena. Floor.arenaLayout now shrinks the arena a step every 80 failed attempts (down to a normal room's size) instead of giving up.
- Fix: the monster camp message was cleared right after being shown (clearCombat now runs before building the floor).
- Break popover icon (jars and boxes) is now a fist (fa-hand-fist) instead of a hammer.
- Style page reorganized into categories with subsections and short notes. The game title card comes first, then the font info and the page description (no separate Brand section). Then Color (map, UI), Map (tiles, noise, sample room), Sprites (cursor, props, loot, enemies, bosses, shots, plus 'other' for ungrouped sprites; alphabetical inside each group), UI (menu, HUD, controls, boss bar, popovers). Stairs removed from the tiles list (they are in the props sprites). The unlit and lit sample rooms sit side by side at 0.75x, and the UI samples sit on the page without card containers (.card.plain for the popover list).
- Style page (docs/style.html): the Enemies and Bosses sprite sections are now animated rooms: every enemy (the knight with its shield) and every boss stands in a walled room with its name below, breathing with the game's idle squish and turning left/right now and then.
- Arena test page (docs/arena.html): the "entity" list now has a bosses group (options in red, the closed select turns red too) and an enemies group (every Populate.ENEMIES kind plus the mimic, named by sprite). New "amount" field (1-30) spawns that many of the chosen kind, spread out from the arena middle (bosses 3 tiles apart on tile corners, enemies on tile centers) and at least 4 tiles from the up stairs. The info line shows hp/damage for enemies too.
- Fix: knight shield on its back. Sprites face left (facing 1 = left, -1 = flipped right). Knights now start with their shield direction to the left (Knight dir [-1, 0], it was [1, 0] while the sprite faced left), and the style page draws the shield on the side the sprite faces.
- Fix: the arena test page crashed on load and listed no enemies. Building a Mimic outside a run called Enemy.provoke with no floor; provoke now only sets the goal when Game.floor and Game.hero exist.
- Arena test page: mimics spawn as dormant mimic chests (Entity 'chest' with {mimic: true, unlocked: true}, walkable like in a run; marking the tile solid left an invisible wall after the mimic woke), drawn with the chest sprite; hovering one wakes it into the mimic actor through Game.wakeMimic, like in a run.
- Style page: the enemy and boss idle rooms have no top and bottom wall rows, only the side walls.
- The cursor no longer turns into the pointer hand over a cracked wall (it only shows a hint bubble, nothing to click).
- Enemy roster rebalanced (Populate.ENEMIES, from floor / weight): zombie 1/5, skeleton 3/3, slime 6/3, spider 13/2, goblin 13/2, knight 17/1.
- Monster camp chance grows with depth: 5% on the normal floors after the first boss, +10% per boss after that, up to 55% (Floor.CAMP_CHANCE = {base, step, max}, by Actor.tier).
- Mimics only after floor 10: 5% chance, +5% per boss after that, up to 35%.
- Bombs: hold to plant 0.8s (was 1s), fuse stays 1.5s. Actor reach 3 tiles (was 2) with damage falloff: 3 at the center, one less per third of the reach, at least 1.
- Style page order: COLOR, MAP, UI, SPRITES; inside SPRITES the Enemies and Bosses rooms come last (after Shots and Other).
- Fix: entering the shop jumped the cursor a tile into the room. The hero now stays on the door tile (Hero.placeIn only nudges it off the wall behind the door), like when leaving; Shop.inside only keeps the tile past the door free of props.
- Slimes: the first hit that doesn't kill a slime has a 30% chance (Slime.CALL) to bring out another full slime on a free neighbor tile, already chasing; called, small and Slime King slimes never call. Floor spawns that roll a slime come as a couple 40% of the time (Slime.PAIR), the second on a free neighbor tile, counting toward the floor's enemy total.
- Small slimes (from splits) drop no coins. Skeletons back off when the hero is within 5 tiles (Skeleton.KEEP, was 3); spiders keep their 3 tiles, goblins their 4.
- Buying max health (shop 'heart') no longer heals: when hurt, the new heart comes empty; at full health it stays full. (The gem's +max only happens at full health, unchanged.)
- Knight shield sprite turns with its facing (Knight.drawShield): rotated toward the face direction (up, down, diagonals), mirrored instead of upside down on the right side; the style page mirrors it with the knight.
- Spider webs fly 25% faster (Projectile.SPEED x1.25) and stick to the wall they hit for 3s (new Projectile option stick, in s), still slowing the hero on touch, fading out over the last half second.
- Necromancer minions come from a weighted pool (Necromancer.MINIONS): zombie 4, skeleton 4, spider 2, goblin 1 (about 36% / 36% / 18% / 9%).
- Slime King: extra speed x1.15 at or below 50% health and x1.3 at or below 25% (SlimeKing.RAGE), on top of speeding up as it shrinks. Each wall bounce has a 40% chance, with the hero within 12 tiles, to dash straight at the hero at x2.2 speed until the next wall (SlimeKing.DASH).
- Golem locks its aim when it picks an attack: during the charge windup (0.7s) and the spike line aim (0.5s) it no longer turns to follow the hero, so its back and sides can be shot while it prepares.
- Worm triple attack (Worm.TRIPLE): 30% of surfacings (never twice in a row) it picks 3 spots (the first next to the hero, the others anywhere in the arena, at least 3 tiles apart), marks them one by one 0.2s apart, then pops up at each in order 0.4s apart (first at 0.8s), firing a ring of 8 shots (x1.5 enraged) at each; hittable while up, dives 0.8s after the last. All timings scale with its enraged pace.
- Slime King no longer shrinks when hit (keeps its size). Below 40% health (SlimeKing.BIG) the slimes it splits off are full size instead of small (they still split into small ones when killed, and never call more slimes); the cap of 8 living slimes stays.
- Worm triple attack: 60% chance per surfacing below 40% health (30% above, still never twice in a row); it stays up 1.4s after the third pop before diving (was 0.8s).
- Sprites moved out of assets/icons into one folder per group: assets/props, loot, enemies, bosses, shots, ui (heartHalf, heartEmpty). Sprites.FOLDERS lists each folder's sprites (Sprites.NAMES derives from it, every sprite is loaded); Sprites.src(name) builds the path from Sprites.ASSETS ('assets/', the docs set '../assets/'). Gui.ICONS is gone (Gui uses Sprites.src); HUD <img> paths updated in index.html, docs/arena.html and docs/style.html. The style page builds its sprite groups from Sprites.FOLDERS; the 'Other' group became 'UI'.
- Arena page (docs/arena.html): removed gold and keys from the hero inputs and the per-floor estimate; only max health and bombs remain.
- Style doc (docs/style.html): color palettes now show as one strip of touching color bands (equal width, name + hex under each) so colors compare side by side; removed the "Dark Material Dracula" reference.
- Arena page (docs/arena.html): floor input now steps by 5 (min 5, max 95), landing on boss floors.
- Knight shield now draws at tile size (3x, was 2x), matching the knight sprite's pixel scale (game and style doc).
- New src/effects.js (Particle + Effects): visual-only death and break effects, loaded in index.html and docs/arena.html before game.js.
- Enemy/boss death: sprite squashes slightly (x +15%, y -35%) (0.15s, bosses 0.35s), then bursts into 3px red bits (#ff5555 -> #8f2c2c -> wall shade); every enemy and boss uses the same red to keep the dungeon's color bias. Bosses burst in three growing waves.
- Jar/box break: wood-toned shards hop out with gravity and settle.
- Floor decals: corpse (enemies), junk (jars/boxes) and boss remains (24x24) stay until the floor changes, one per tile (a new one replaces the old, boss remains are never replaced). No collision.
- Corpses and junk snap to the center of their tile; slimes (and split slimes) leave no corpse, just the burst.
- Slimes split into 0 to 2 small slimes on death (random, Slime.SPLIT), was always 2.
- Golem: strides go ~0.8 tile in 0.35s (was ~0.45 tile in 0.3s); walks 1.6s before picking an attack (was 2.6s).
- Golem ground pound: 0.35s windup (was 0.55s), reach 3.2 tiles (was 2.3), which also widens when it picks the pound.
- Golem charge: 380px/s (was 280); each tile it charges through has a 15% chance to grow spikes (Golem.TRAIL, same 3s as the slam ring); hitting the wall also blasts like the ground pound.
- Boss sprites golem, necromancer, slimeKing and worm redrawn in the enemies' two reds (#ff5555 body, #8f2c2c shading), no outline, facing left: rock brute, hooded caster with skull staff, crowned giant slime, worm rearing out of a mound. Old placeholders backed up in D:/claude_cache/backups/cursor-crawler-bosses.
- Worm sprite redrawn like Terraria's Eater of Worlds (spiked armored segments arcing out of the mound, big head with hooked mandibles); necromancer redrawn as a lich (crowned skull in a cowl, glowing eyes, ragged robe, orb staff).
- Small slimes use their own smallSlime sprite at full scale instead of the slime sprite scaled to 0.6.
- Decals now draw on the floor layer under the props (Game.drawFloor), redrawn when one is added (Effects.changed), instead of on the actors layer.
- Wall/door hue now takes 25 floors for a full turn (Floor.HUE_CYCLE, was 20).
- Sound (CC0, credits in assets/sounds/CREDITS.md): new src/sound.js. SFX in assets/sounds/sfx named by event: hit (shot lands, enemy survives), kill, hurt, bomb, break, open (chest, shop door in/out, lever), stairs, boss (boss killed), death. No sound for shots, coins or pickups. Ambience: dungeonAmbience loops, cross-fades (1.5s) to darkCavern while a boss room is sealed until the boss dies; starts on the first click into play. Style doc SOUND section lists them from Sound; unused candidates deleted.
- Ambience starts at the start menu (Sound.init in Game.init, retried on the first click/key when the browser blocks autoplay); every menu, including pause and death during a boss fight, uses dungeonAmbience. Style doc sound list is now just play buttons named by effect/mood.
- Font Awesome link falls back to the jsDelivr CDN (fontawesome-free 7.3.1, same version as the local copy) when the local css fails to load (index.html, docs).
- Enemy hp bonus: +1 on floor 5, then every 10 floors (15, 25...) via Enemy.extraHp / Enemy.HP_FLOORS, was +1 per tier (every 5 floors from floor 6). Damage and bosses still scale by tier.
- Slime King: after 2s of plain walking since a wall bounce, 30% chance (once per bounce) to dash in a random direction until the next wall (SlimeKing.WILD).
- Boxes: on floors that spawned a goblin, 10% chance breaking one drops a lit goblin bomb instead of loot (Game.BOX_BOMB, Game.goblinFloor).
- Spider: shoots a normal hurting projectile instead of the web 15% of the time, or always when the hero is closer than 3 tiles (Spider.BITE).
- Removed the 'the camp is restless' text on reaching a monster camp floor.
- Spider web slows harder: hero moves at 30% speed while webbed (Game.SLOW.factor, was 40%).
- Hero bombs now hit sleeping mimics: a mimic chest in the blast wakes up and takes the blast damage (dies if it's enough).
- Slimes (and small slimes) take double damage from explosions (Slime.BLAST); the Slime King doesn't.
- Goblin bombs (thrown or from boxes) also hurt enemies within their blast radius, same damage as to the hero.
- Knight fix: the shield no longer snaps to each step (a chasing knight always faced the hero, blocking from every side). It turns at most 45° per step (Knight.TURN) and blocks within 60° of its facing (Knight.CONE, was ~72°); Actor.fromFront takes a cone argument.
- Boss damage grows 0.75 half heart per tier, rounded (Boss.DAMAGE), was 1: tiers 1-6 now hit for 2, 3, 3, 4, 5, 6 instead of 2-7.
- Worm digs: slides up out of the ground when surfacing and back down when diving (0.18s, Worm.RISE), clipped at its ground line, with a puff of dirt bits (Effects.COLORS.dirt); also between the triple attack's pops. Visual only, timing and hit windows unchanged. It stretches slightly (up to 10%) while passing through the ground.
- Style doc MAP section: 'Wall hue by floor' strip, the drawn wall tile (with its noise) for each floor over a full Floor.HUE_CYCLE, side by side.
- dungeon-forge engine vendored into lib/dungeon-forge/engine (was loaded from the sibling ../dungeon-forge); script tags in index.html and the docs repointed. Added README.md and .gitignore for the public repo YuriShimoi/CursorCrawler.
- New placeholder sprites in assets/decals/: corpse.png, junk.png, remains.png; Sprites.FOLDERS gets a 'decals' group and the style doc a Decals section.
- Beholder: every 3-6s it lunges ~90px at the hero with no warning (150px/s for 0.6s); other bosses built on Boss don't lunge.
- Bosses never lose the hero once triggered (seen once or the arena sealed): new Boss.hunting replaces the sight checks in Boss, Necromancer and Golem.
- Golem walks in strides like the zombie but off the grid: 0.3s eased stride (~0.45 tile) then 0.5s pause, leaning into each stride; Golem.SPEED replaced by Golem.STEP.
- Necromancer only raises a wave while fewer than 5 enemies are in the arena (Necromancer.CROWD); otherwise it retries 2s later.
- Necromancer minion hp fix: halving the whole hp also halved the floor bonus (Enemy.extraHp), which often rounded it away; minions now get half their kind's base hp, plus the floor bonus (Enemy.extraHp).
- Fix: the page froze after dying, mostly in boss fights. Game.die moves the hero to -10000,-10000, and an enemy still chasing (provoked minions, alert zombies) ran Enemy.pathStep to an off-map tile; the walk back from the target never reached the start (infinite loop). pathStep now returns null for goals outside the grid.
- HUD floor number turns red on boss floors (Gui.floor toggles .boss, #hud .depth b.boss).
- Credits room (src/credits.js, Credits.build): the stairs of floor 25 (Credits.AFTER) lead once per run to a hand-built 15x9 room centered on the map instead of floor 26. The HUD shows CREDITS; the credits text is drawn on the room floor canvas by Credits.draw (called from Game.drawFloor when floor.credits is set): the title in the Title font, "thank you for playing this DEMO", "made by Yuri Shimoi", and a caption "extra material about the game" above the two link items. Two item sprites (entity type 'link') open docs/arena.html and docs/style.html in a new tab; a door (type 'creditsDoor') says "keep on infinite mode" and leads to floor 26. The room box is used as Game.arena so its light covers the whole room. Game.showCredits, Game.credits flag (reset in Game.start).
- Popovers can show text next to the icon (target.text).
- Fix: docs/arena.html broke (missing #menu-controls); Gui.init now skips the menu controls list when the page lacks it, and arena.html loads src/credits.js.
- Fix: enemy hp never grew with floors. Enemy.extraHp read globalThis.Game, but a top-level class isn't a property of globalThis, so the bonus was always 0 (in runs and in the arena page). It now checks the Game binding directly. New rule: +1 hp every 10 floors (Enemy.HP_FLOORS = 10: floor 10 +1, 20 +2...), was +1 on floor 5 then every 10.
- Necromancer minions now get half their kind's base hp plus Enemy.extraHp (Necromancer.MINION_HP removed).
- Arena page info line sets Game.depth to the chosen floor before reading enemy hp.
- Start screen subtitle under the title: "a 25 floors demo" on the left and "by. Yuri Shimoi" on the right (#subtitle, a span inside #title, so Gui.menu replacing the title text removes it on the pause and death screens).
- Death screen shows run stats instead of "floor N, N gold. the next dungeon is built around your click": floor reached, coins collected and spent, enemies killed (bosses included), chests opened (shop chests included). Tracked in Game.run (reset in Game.start; coins in Game.give, spent on shop chests and the shop fire, kills in Game.kill, chests on 'open' and 'buy'); Gui.dead(depth, run) shows them as rows, each with a sprite icon instead of a text label (stairsDown: floor reached; gold: "N · N spent"; slime: enemies killed; openedChest: chests opened), left-aligned (#menu.dead #hint flex column, .stat rows); the RETRY button sits lower (#menu.dead #menu-button margin-top 168px).
- Tutorial room (src/tutorial.js): floor 1 of a run starts in a bare 7x4 room (Floor.tutorialLayout: bsp with the start room swapped for a Tutorial.SIZE room around the start tile and the rooms it overlaps dropped; floor 1 rooms stay rectangular, roomParts 0). Nothing is placed in it (Populate skips it). Its floor shows two drawings, pixelated at 3px (half the noise cell) and multiplied over the floor as a 50% darker shade with a bare-floor gap around the pieces: shoot (pull ring, thick aim line, a shot past the ring) and bomb (bomb with the hold arc). The faded tile grid it introduced is now the floor default everywhere. Drawn by Tutorial.draw from Game.drawFloor when floor.tutorial is set; previewed in docs/style.html (MAP > Tutorial room). The room is placed so the up stairs land on a tile no drawing touches (Tutorial.freeTiles measures the drawing's tiles once; Floor.tutorialLayout picks a room corner from them, falling back to any fit at the map edge). The style doc preview is shown at 1x.
- Floor tile outlines are fainter on every floor: Floor.COLOR.grid #1a1a1a -> #1c1c1c (35% toward the floor color); Tutorial.fadeGrid / Tutorial.GRID removed.
- Style doc (docs/style.html): removed most notes under titles (kept the intro line and the sound credits); UI palette lists the swapped button colors (button #8a63c9, hover #bd93f9).
- Fix: loading the game from file:// sometimes threw "SecurityError ... canvas has been tainted" in Tutorial.freeTiles (getImageData on a canvas with sprite images). While measuring (Tutorial.measuring) the sprites are drawn as plain tile boxes through Tutorial.sprite, so the canvas stays readable.
- Bomb hold arc shows as soon as the hero holds still (Game.drawAim), it used to wait 0.25s.
- Cracked walls no longer show a hint popover (actionFor 'crack' removed; also removed from the style doc popover list).
- Health items always add max health and heal the same amount: gem (item) +half a heart max and heals half a heart, shop heart the same, boss heart +1 heart; when max health is capped and health full they give gold (15 per half heart). Game.GROW_CHANCE removed.
- Boss loot: instead of instant rewards, the boss drops pickups on the free floor tiles nearest its remains: a heart (+1 heart max, new 'heart' pickup entity), gold (30 + floor x3) and a bomb (Game.BOSS_LOOT, Game.bossLoot). A fight without taking damage since the arena sealed (Game.bossHit) also leaves an unlocked chest with a yellow "perfect!" text; it holds gold (40 + floor x5), +1 heart max, 2 bombs, a key and a gem (Game.PERFECT_LOOT).
- After floor 15 each floor gets 2-3 chests but only a 60% chance of one key (was 1 chest and its key) (Populate.LATE).
- After floor 20 cracked walls are more common: 90% chance per floor (was 60%) and up to 2 (Populate.secrets).
- Necromancer: waves only while fewer than 4 enemies are in the arena (CROWD 5 -> 4), waves every 13s (was 9s), the cast lasts 2.2s (was 1.4s) with a side-to-side sway (squish) so it doesn't look frozen, and it shoots ring and spiral volleys too (patterns fan, burst, ring, spiral).
- Bombs put out lights: hero and goblin bombs douse lit torches (they can be lit again) and campfires in reach (they burn out without healing). Game.douse, also used by resting; Game.blastProps.
- Goblin bombs break jars and boxes in their small reach, without loot (Game.smash(e, loot)).
- Boxes hide a goblin bomb 20% of the time on floors with goblins (Game.BOX_BOMB 0.1 -> 0.2).
- Monster camps always have a campfire, on the free tile nearest the middle of the camp room (Populate.run), on top of the floor's usual random campfire chance.
- Raised spikes kill walking monsters outright (Game.spikeActors hits for their full hp; bosses and flyers are still spared); the "-1" text is gone.
- After floor 12 each room corner (start room and boss room excluded) has a 25% chance of spikes (lowered by the floor's lever like the corridor ones), 45% after floor 18, never on a corner where a passage comes in (Populate.LATE.corners, Populate.CORNER_SPIKES).
- Max health cap raised from 6 to 20 hearts (Game.MAX_HP 12 -> 40 half hearts); the HUD hearts wrap at 10 per row (#hud-hearts flex-wrap, max-width 258px); the arena page max health input goes up to 40.
- Bosses gain less health per tier: +40% of their base hp per tier, rounded (Boss.HP_TIER), was +50%.
- Worm fast phase (quicker timings, faster and bigger volleys) starts below 30% health (Worm.ENRAGED.below), was 50%.
- Necromancer: the first time it drops below half health it raises one big wave of 10 (Necromancer.HORDE), ignoring the crowd cap, with a cast twice as long.
- Max health is rarer: gems on the floor 15% per floor (was 25%), in chests 20% (was 35%), in boxes 4% (was 8%); the shop's max health good can only show in 40% of offers (Shop.HEART_CHANCE). Boss loot and the perfect chest still always give it.
- The shop shows max health with the empty heart icon (heartEmpty).
- Slime King dashes more when desperate: at or below 20% health a wall bounce turns into a dash at the hero 75% of the time (SlimeKing.DASH.low / desperate), 40% otherwise.
- Golem moves 1.5x faster below half health: its strides and charges run on a faster clock (Golem.HASTE, haste getter); windups, stuns and attack timings are unchanged.
- Slime King drops a small slime every 2s below half health (SlimeKing.SPAWN), still capped at 8 living slimes; hit splits and these share SlimeKing.spawn.
- Gems add max health only half the time (Game.GEM_GROW 0.5), otherwise they just heal half a heart (gold when already full). This was not a bug: gems had been set to always add max health. The shop's max health good shows in 25% of offers (Shop.HEART_CHANCE 0.4 -> 0.25).
- Boss loot gives the max health heart only 30% of the time (Game.BOSS_LOOT.heartChance); gold and a bomb always drop. The perfect chest is unlocked, so it never uses a key.
- Chests that need no key (camp, alcove, perfect and mimic chests) show an open lock icon (fa-lock-open) in the popover instead of the key; also listed in the style doc popovers.
- Mimics no longer wake when the hero comes close: a mimic chest stays a harmless chest until it is clicked (the 'open' action wakes it instead of opening), shot (the shot wakes it and lands) or bombed.

## 2026-10-11 - Death backdrop and fades

- Death no longer freezes the game: the hero leaves the map, zombies lose track and go back to wandering, projectiles finish, all under the last light (Game.updateDead). Floating texts, the popover and the boss bar are cleared on death.
- RETRY button only 60px lower than normal on the death screen (the 2s countdown already prevents misclicks).
- Fast fade (120ms each way, Gui.FAST_FADE) when descending stairs; Gui.fade takes a duration. A flag blocks a second descend during the fade.
- Bomb texts ("+bomb", "BOOM") and the HUD bomb icon use cyan (#8be9fd), matching the new bomb sprite colors.
- docs/style.html lists the entity icons grouped by sprite color (orange, yellow, green, cyan, purple, gray), reds last.
- Checked the report of zombies drawn under stones: not reproducible, the actors layer is always above props. Zombies do disappear when their center leaves the light while stones stay visible in remembered areas.

## 2026-10-10 - Start screen and polish

- Start screen backdrop: a random floor (1 to 4, never a boss floor) fully visible behind the menu, torches lit, zombies wandering (Game.demo / Game.drawDemo; script.js starts it once the icons load).
- START and RETRY fade to black (300ms), build the run, then fade back in (#fade, Gui.fade).
- Death screen: run info moved above, RETRY moved 150px lower and disabled for 2 seconds with a countdown (Gui.RETRY_DELAY), so attack clicks can't hit it.
- HUD bubbles have a fixed 32px height with centered content so floor and items line up.
- Descend popover icon is now a down arrow (fa-arrow-down).
- Inside the boss arena the hero light grows to cover the whole room (Game.ARENA_LIGHT, eased in and out); Populate.run now also returns the arena room.

## 2026-10-10 - Boss arenas and fixes

- Boss floors every 5 floors (was 3), using a custom dungeon-forge layout (Floor.arenaLayout, registered as 'arena'): start room first, one 16x11 arena on the far half of the map from the start (normal rooms max 11x11), then scattered rooms. Boss floors use rectangular rooms (roomParts 0).
- The beholder only spawns in the arena (the biggest room that isn't the start room); zombies never spawn inside it.
- Fixed: cracked walls couldn't be used from the tile above, because the arrow body hangs 16px below the tip and the reach is 12px. Reach to walls is now measured from the whole arrow box (Entity.distanceToBox).
- Chests switch to the new openedChest.png sprite when opened (no more fading).
- Zombies face the other way (sprite faces left) and move less often: dash 0.2s, pauses 0.5s chasing / about 1.6s wandering.

## 2026-10-10 - Grid zombies, HUD and wall hue

- HUD split into bubbles: floor number, then gold/keys/bombs, side by side; hearts below them with no container (hard drop shadow). New .bubble CSS class, also used by the controls bubble.
- Wall bottom shading and door bars are now 1/6 of a tile (6px, two sprite pixels) to match the sprites.
- Lever uses the new activeLever.png sprite when pulled instead of a mirrored sprite.
- Zombies move on the grid: short eased dashes tile to tile with pauses, BFS pathfinding to the hero's last seen tile (stay alert 3s after losing sight), avoid raised spikes and tiles taken by other zombies, wander tile by tile otherwise. Their hit box covers the tile; no knockback on hit. Removed Game.separate (tile reservation replaces it).
- Squish animation: zombies stretch during dashes and wobble when idle; the beholder breathes. Zombies flip horizontally to face their movement.
- Wall and door colors drift in hue each floor (Floor.HSL, Floor.HUE_CYCLE = 20 floors for a full turn), same saturation and lightness as floor 1. Floor takes a depth argument.
- Beholder name and health bar are red, as is the "something watches you" text.
- docs/style.html HUD sample updated.

## 2026-10-10 - Interaction fixes

- Interactive props (chest, jar, box, lever, torch, campfire) no longer block movement; only stones and walls (including cracked walls) are solid. Props still spawn spaced apart.
- Raised spikes hurt zombies too (1 damage per second on the tile, Game.spikeActors); the beholder floats and is immune.
- No knockback on the hero when hit, since the mouse controls it.
- Bombed cracked walls leave walkable rubble (stones sprite) on the opened tile.
- Torches start unlit (new unlitTorch.png icon); click "Light" to turn them into a static light source. Campfires still light up when seen.
- Target selection picks the nearest entity that has an action, so stones or rubble never hide a nearby jar.
- Static lights no longer flicker.
- Stones on the floor are walkable too (no prop has collision now).
- Torches are rarer: 25% of larger rooms (was 50%).
- Cracked walls are rarer: at most one per floor, on 60% of floors (was up to two on every floor). The alcove holds a chest that needs no key 70% of the time, otherwise a gem.

## 2026-10-10 - Mechanics from the icons

### Added
- Player stats: hearts (start 3, max 6), gold, keys, bombs (start 1). HUD shows them with Font Awesome icons.
- New files: src/entities.js (Entity: props, pickups, spikes, wall cracks), src/actors.js (Actor, Enemy, Boss, Projectile), src/populate.js (seeded placement per floor).
- Pickups by touch: gold (scales with depth), key, bomb, gem item (heals 1, or +1 max heart when full).
- Click interactions (popover shows label, greyed when not possible): open chest (needs a key; gold + chance of bomb/gem), break jar/box (random loot), pull lever (toggles the floor's spikes), rest at campfire (full heal, once), blow up cracked wall with a bomb (opens a hidden alcove with gold or a gem, damages nearby actors), attack enemies (cooldown 0.25s).
- Spikes: a short run inside one corridor, hurt while raised; a lever lowers them.
- Torches (50% of larger rooms) and campfires are static lights with a slight flicker; they light up once the hero sees them.
- Hidden alcoves: up to 2 per floor, carved behind single wall tiles and marked with the crack overlay.
- Zombies (2 + depth, max 9): wander, chase on line of sight, contact damage, 2 hp.
- Beholder boss every 3rd floor in the stairs room: keeps distance, shoots projectiles (3-way below half hp), 12 hp, seals the stairs until dead; boss bar at the top center once seen.
- Damage: 1s invulnerability with hero blink, knockback, red screen flash, floating texts for all loot and damage.
- Death screen with RETRY (new dungeon built around the click).
- Window resize re-centers the map.
- Moving actors are only drawn where lit.
- Actors push apart when overlapping (Game.separate), so chasing zombies don't stack.

### Changed
- Light split into LightSource (polygon, walls, contains) and Light (darkness, memory, static sources).
- Floor: solid prop tiles (isFree/isFreeAt for movement, light ignores props), lineOfSight, open() for bombed walls, draw() takes an extras callback so props get the noise shading.
- Game loop runs every frame with delta time instead of only on mouse move.
- docs/style.html shows the new HUD, disabled popover and boss bar.

### Performance
- Floor noise rendered once per floor into cached canvases, so redraws after props change are cheap.
- Headless test over 12 floors: average frame 0.33ms, p95 0.5ms.

## 2026-10-10 - Stairs as icons

### Changed
- Icons in assets/icons/ were hand-edited by the user; they are the source of truth now (no generator).
- Stairs moved to icons: added assets/icons/stairsUp.png and stairsDown.png (12x12, same 3-step look). Floor.draw uses Sprites.draw for them. Floor.drawStairs and the stairsUp/stairsDown entries in Floor.COLOR are removed.
- docs/style.html waits for the icons to load before drawing, so stairs show in tiles and the sample room.
- START button hover is now a darker purple (#8a63c9), same hue as the button (#bd93f9).

## 2026-10-10 - 12x12 icons

### Changed
- All icons redrawn on a 12x12 pixel grid (boss 24x24). Floor.TILE changed from 32 to 36px so each icon pixel is exactly 3px. Floor noise grain cell changed from 8 to 6px to stay aligned.
- Boss is now a beholder (round body, eyestalks, big central eye) in the same green as the enemy.
- Spikes: narrower, stepped triangles, with the two darker back spikes higher for depth.
- Bomb uses the spikes' reds.
- Lever, torch and campfire share the orange tones and are centered in the tile.
- Icons switched from SVG to PNG at native size (12x12, boss 24x24) in assets/icons/; Sprites.draw scales them up with image smoothing off so pixels stay sharp.

### Added
- Size comparison samples (8x, 12x, 16x) in D:\claude_cache\design-samples\cursor-crawler-icons\.

## 2026-10-10 - SVG icons

### Changed
- Icons are now SVG files in assets/icons/, one per icon: plain `<rect>` pixels with shape-rendering crispEdges, drawn on an 8x8 grid per tile (boss 16x16 on 2x2 tiles), top view, sharp squared edges.
- Each icon uses one hue in two tones (main plus darker or lighter).
- Enemy is a green zombie in classic Space Invaders style.
- Boss is a stone golem.
- Projectile has no trail.
- Gold is coins scattered on the floor.
- Bomb is squared.
- Lever is a single flat color.
- Item gem is smaller.
- crackedWall is only the crack, used as an overlay on walls.
- src/sprites.js loads the SVGs with Sprites.load(base), called in script.js, and draws them with Sprites.draw(ctx, name, px, py). Sprites.COLOR is removed.
- docs/style.html loads the SVGs and shows the crack on a wall. The entity palette section is removed.
- Bomb is smaller (4x4 body).
- Enemy and boss are silhouettes only, no faces.
- Torch, campfire and spikes back to side view.
- Projectile is purple so it doesn't read as a coin.
- Jar and box use the chest's orange tones.
- Lever follows the a_cat_shadow look: steel-blue socket with dark inside and a brown wooden stick (3 colors).
- Lever and torch made smaller.
- Spikes: one bright triangle in front, two darker triangles behind.
- Jar switched to side view.
- Enemy and boss heads enlarged so the silhouettes don't look headless.

### Removed
- Trap icon.

## 2026-10-10 - Geometric icons

### Changed
- Replaced the pixel-art sprites with flat geometric icons in the stairs style: plain rects, circles and triangles, one or two colors each, no outlines or shadows.
- Colors by role in Sprites.COLOR: loot yellow/orange, item cyan, enemy purple, boss pink (2x2 tiles), hazards red, props muted, fire orange.
- Same API: Sprites.draw(ctx, name, px, py), cached per size.

## 2026-10-10 - Pixel-art sprites

### Changed
- src/sprites.js rewritten as retro pixel art: each sprite is a 16x16 char grid (boss 32x32, left half mirrored), 2px per pixel in game, rendered with fillRect and cached.
- 3/4 (2.5D) view: lit top faces, darker fronts, ground shadow pixels. The old offset shadow is removed.
- Flat, muted 20-color palette in Sprites.PALETTE (one char per color, '.' transparent), replacing Sprites.COLOR.
- Cracked wall is now a brick pattern with a lit top edge and a crack through it.
- docs/style.html: notes and palette section updated.

## 2026-10-10 - Entity sprites

### Changed
- START button hover color is now muted #6272a4.

### Added
- src/sprites.js: code-drawn sprites on a 32-unit box with dark outline and hard offset shadow, cached per size. Sprites.draw(ctx, name, px, py).
- Sprites: chest, item, enemy, boss (2x2 tiles via Sprites.TILES), projectile, key, gold, bomb, crackedWall, stones, spikes, jar, box, trap, lever, torch, campfire.
- Sprites.COLOR adds wood/clay tones on top of the Dracula palette.
- Loaded in index.html but not placed in the game yet.
- docs/style.html: new Entities and Entity palette sections.

## 2026-10-10 - Style reference page

### Added
- docs/style.html: live style reference drawn with the game's own Floor, Hero, and Light classes and src/style.css.
- Sections: map palette (Floor.COLOR), UI palette, tiles at 3x, noise on/off comparison, cursor shapes (arrow, pointer) at 4x, sample room unlit vs lit, and UI components (start button, HUD, controls, popover).
- Floors are built from ASCII sketches, not dungeon-forge generation, so the page updates automatically when styles change.

## 2026-10-10 - Floor noise

### Changed
- Rooms and corridors share the same floor color (corridor color removed).
- Subtle darker noise overlay on walkable tiles: per-tile shade (max alpha 0.08) plus 8px grain (max alpha 0.05), seeded by floor seed and position (FNV hash + fmix32), configured in Floor.NOISE. Drawn last over the ground layer so future sprites get shaded too.
- Walls get the same noise, stronger (tile 0.14, grain 0.09), on the walls layer. Floor.NOISE now holds cell size plus per-type strengths (floor, wall); drawNoise(ctx, test, strength) is generic.

## 2026-10-10 - Controls bubble

### Changed
- Removed the seed from the top-left HUD (floor number only).
- New top-right bubble with controls: "Esc to pause" and "L-Click to interact", with keys styled as kbd.
- Popover no longer shows "click".

## 2026-10-10 - Interaction popover

### Added
- Generic interactions: Floor.interaction(tx, ty) returns {action, icon, label}, and Game.interact handles it on click. Down stairs return "Descend".
- Hero switches to a pointing-hand shape over interactive tiles.

### Changed
- Stairs icon flipped: the top step is the shortest and the bottom step spans the tile.
- Doors toned down to a dim gray (#34363f) with a thinner bar.
- Popover tag follows the hero over interactive tiles (Font Awesome icon, label, and "click"). It replaces the HUD "click to descend" text.

## 2026-10-10 - Lighting fix, click stairs

### Fixed
- Removed the polygon stroke that revealed walls; it leaked light strips into shadow. Walls are now lit per tile when the light reaches one of their open faces (3 sample rays per face).
- Ray/segment test has a small tolerance so rays no longer slip through shared corners.

### Changed
- Stairs: descending now requires a click while standing on the down stairs. The HUD shows "click to descend" there.

## 2026-10-10 - Playable demo

### Added
- Start menu with a centered START button. Clicking it generates the first floor with dungeon-forge, placing the up stairs under the click position. The hero starts at the click.
- Hero is a cursor arrow driven by Pointer Lock mouse deltas, with the system cursor hidden. It slides along walls using axis-separated, sub-stepped collision.
- Esc releases the pointer and pauses the game. CONTINUE resumes it.
- Light uses a visibility polygon raycast against merged wall-edge segments (approach taken from NightLights), with radial falloff and a radius of 6 tiles.
- Explored areas stay visible at 30% through a memory canvas.
- Reaching the green down stairs generates the next floor, with its up stairs on that tile. The HUD shows the floor number and seed.
- Files: src/floor.js, src/hero.js, src/light.js, src/game.js, src/gui.js.

### Changed
- Map fills the window, using 32px tiles and no camera.
- Canvas layers are now background, walls, light, and hero. canvas.js gained ctx, resize, and clear.
- dungeon-forge is loaded from ../dungeon-forge/engine.

### Not yet
- Light shrinking.
- Enemies.
- Items.
- Window resize handling.
