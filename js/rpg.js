// FriendlyShooter World RPG - roguelike squad battler
(function () {
  'use strict';

  const CHAR_DIR = 'Charachters/';
  const ENEMY_DIR = 'Enemy/';
  const SAVE_KEY = 'fs_rpg_best_stage';
  const THEME_TRACK_ID = '7gl7F2y7tiB9x8c3bdqwiu'; // "Main theme - Friendlyshooter" on Spotify

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------------------------------------------------------------
  // Character roster. Each has a single signature attack.
  // targetType: 'enemy' (choose a target), 'auto' (no target needed)
  // ---------------------------------------------------------------
  const ROSTER = [
    {
      id: 'pistol', name: 'Pistol', img: 'Pistol2', maxHp: 60, starter: true,
      atkName: 'Double Tap', targetType: 'enemy',
      desc: 'Fires two quick shots at one enemy (6-11 dmg each).',
      run(ctx) {
        for (let i = 0; i < 2; i++) {
          const dmg = rand(6, 11);
          ctx.damageEnemy(ctx.target, dmg);
          ctx.log(`${ctx.self.name} fires at ${ctx.target.name} for ${dmg}.`);
        }
      }
    },
    {
      id: 'melee', name: 'Melee', img: 'MeleeV2', maxHp: 75, starter: true,
      atkName: 'Cleave', targetType: 'auto',
      desc: 'Swings at all enemies (6-10 dmg each).',
      run(ctx) {
        ctx.enemies.filter(e => e.hp > 0).forEach(e => {
          const dmg = rand(6, 10);
          ctx.damageEnemy(e, dmg);
        });
        ctx.log(`${ctx.self.name} cleaves through the enemy line.`);
      }
    },
    {
      id: 'gambler', name: 'Gambler', img: 'GamblerV2', maxHp: 55,
      atkName: 'Dice Toss', targetType: 'enemy',
      desc: 'Throws loaded dice for wildly random damage (5-45).',
      run(ctx) {
        const dmg = rand(5, 45);
        ctx.damageEnemy(ctx.target, dmg, dmg >= 35);
        ctx.log(`${ctx.self.name} rolls the dice on ${ctx.target.name} for ${dmg}!`, dmg >= 35 ? 'crit' : '');
      }
    },
    {
      id: 'revolver', name: 'Revolver', img: 'RevolverV2', maxHp: 65,
      atkName: 'Verdict', targetType: 'enemy',
      desc: 'Judges one enemy; executes foes below 25% HP.',
      run(ctx) {
        const t = ctx.target;
        if (t.hp / t.maxHp <= 0.25) {
          ctx.damageEnemy(t, t.hp, true);
          ctx.log(`${ctx.self.name} passes judgement — ${t.name} is executed!`, 'crit');
        } else {
          const dmg = rand(20, 28);
          ctx.damageEnemy(t, dmg);
          ctx.log(`${ctx.self.name} delivers a verdict on ${t.name} for ${dmg}.`);
        }
      }
    },
    {
      id: 'grenadier', name: 'Grenadier', img: 'GrenadeLauncher', maxHp: 70,
      atkName: 'Frag Out', targetType: 'auto',
      desc: 'Lobs a grenade, damaging all enemies (12-18).',
      run(ctx) {
        ctx.enemies.filter(e => e.hp > 0).forEach(e => ctx.damageEnemy(e, rand(12, 18)));
        ctx.log(`${ctx.self.name} throws a grenade into the enemy group!`);
      }
    },
    {
      id: 'rpg', name: 'RPG', img: 'RPGV2', maxHp: 68,
      atkName: 'Rocket Barrage', targetType: 'enemy',
      desc: 'Heavy rocket hit (35-50) with splash to others (8).',
      run(ctx) {
        const dmg = rand(35, 50);
        ctx.damageEnemy(ctx.target, dmg);
        ctx.log(`${ctx.self.name} launches a rocket at ${ctx.target.name} for ${dmg}!`, 'crit');
        ctx.enemies.filter(e => e.hp > 0 && e !== ctx.target).forEach(e => ctx.damageEnemy(e, 8));
      }
    },
    {
      id: 'sniper', name: 'Sniper', img: 'SniperV2', maxHp: 50,
      atkName: 'Headshot', targetType: 'enemy',
      desc: 'Precise shot (18-24), 30% chance to critical for double.',
      run(ctx) {
        let dmg = rand(18, 24);
        const crit = Math.random() < 0.3;
        if (crit) dmg *= 2;
        ctx.damageEnemy(ctx.target, dmg, crit);
        ctx.log(`${ctx.self.name} snipes ${ctx.target.name} for ${dmg}${crit ? ' (CRIT!)' : ''}.`, crit ? 'crit' : '');
      }
    },
    {
      id: 'shotgun', name: 'Shotgun', img: 'Shotgunv2', maxHp: 72,
      atkName: 'Buckshot Spray', targetType: 'auto',
      desc: 'Fires 3 pellets at random enemies (8-12 each).',
      run(ctx) {
        for (let i = 0; i < 3; i++) {
          const alive = ctx.enemies.filter(e => e.hp > 0);
          if (!alive.length) break;
          const t = pick(alive);
          ctx.damageEnemy(t, rand(8, 12));
        }
        ctx.log(`${ctx.self.name} sprays buckshot across the field.`);
      }
    },
    {
      id: 'medic', name: 'Medic', img: 'MedicV2', maxHp: 60,
      atkName: 'Field Aid', targetType: 'auto',
      desc: 'Heals the lowest-HP ally for 20-30.',
      run(ctx) {
        const alive = ctx.squad.filter(u => u.hp > 0);
        if (!alive.length) return;
        const t = alive.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
        const heal = rand(20, 30);
        t.hp = clamp(t.hp + heal, 0, t.maxHp);
        ctx.log(`${ctx.self.name} patches up ${t.name} for ${heal} HP.`, 'heal');
      }
    },
    {
      id: 'wizard', name: 'Wizard', img: 'WizardV2', maxHp: 55,
      atkName: 'Arcane Bolt', targetType: 'enemy',
      desc: 'Magic damage (14-20) and burns the target for 2 turns.',
      run(ctx) {
        const dmg = rand(14, 20);
        ctx.damageEnemy(ctx.target, dmg);
        ctx.target.burn = { turns: 2, dmg: 5 };
        ctx.log(`${ctx.self.name} scorches ${ctx.target.name} with arcane fire for ${dmg}.`);
      }
    },
    {
      id: 'engineer', name: 'Engineer', img: 'ENgineerV2', maxHp: 65,
      atkName: 'Deploy Turret', targetType: 'auto',
      desc: 'Damages all enemies (6-10) and weakens their next attack.',
      run(ctx) {
        ctx.enemies.filter(e => e.hp > 0).forEach(e => {
          ctx.damageEnemy(e, rand(6, 10));
          e.suppressed = true;
        });
        ctx.log(`${ctx.self.name} deploys an auto-turret, suppressing the enemy.`);
      }
    },
    {
      id: 'shield', name: 'Shield', img: 'ShieldV2', maxHp: 85,
      atkName: 'Bulwark', targetType: 'auto',
      desc: 'Grants the whole squad a shield that absorbs the next hit.',
      run(ctx) {
        ctx.squad.filter(u => u.hp > 0).forEach(u => u.shield = (u.shield || 0) + 15);
        ctx.log(`${ctx.self.name} raises a bulwark protecting the squad.`, 'heal');
      }
    },
    {
      id: 'flamethrower', name: 'Flamethrower', img: 'Flamethrower', maxHp: 70,
      atkName: 'Scorch', targetType: 'auto',
      desc: 'Burns all enemies (10-14) and applies a damage-over-time burn.',
      run(ctx) {
        ctx.enemies.filter(e => e.hp > 0).forEach(e => {
          ctx.damageEnemy(e, rand(10, 14));
          e.burn = { turns: 2, dmg: 4 };
        });
        ctx.log(`${ctx.self.name} sets the enemy line ablaze.`);
      }
    },
    {
      id: 'minigunner', name: 'Minigunner', img: 'MiniGunnerV2', maxHp: 78,
      atkName: 'Spin Up', targetType: 'auto',
      desc: 'Sprays 5 random hits (4-7 dmg each) across enemies.',
      run(ctx) {
        for (let i = 0; i < 5; i++) {
          const alive = ctx.enemies.filter(e => e.hp > 0);
          if (!alive.length) break;
          ctx.damageEnemy(pick(alive), rand(4, 7));
        }
        ctx.log(`${ctx.self.name} spins up the minigun and lets loose!`);
      }
    },
    {
      id: 'fistfighter', name: 'Fistfighter', img: 'Fistfighter', maxHp: 90,
      atkName: 'Haymaker', targetType: 'enemy',
      desc: 'A single devastating punch (30-40 dmg).',
      run(ctx) {
        const dmg = rand(30, 40);
        ctx.damageEnemy(ctx.target, dmg, true);
        ctx.log(`${ctx.self.name} lands a haymaker on ${ctx.target.name} for ${dmg}!`, 'crit');
      }
    },
    {
      id: 'bow', name: 'Bow', img: 'bowV2', maxHp: 58,
      atkName: 'Piercing Shot', targetType: 'enemy',
      desc: 'Arrow pierces through, hitting a second enemy for half.',
      run(ctx) {
        const dmg = rand(15, 20);
        ctx.damageEnemy(ctx.target, dmg);
        ctx.log(`${ctx.self.name} looses a piercing arrow at ${ctx.target.name} for ${dmg}.`);
        const others = ctx.enemies.filter(e => e.hp > 0 && e !== ctx.target);
        if (others.length) {
          const second = pick(others);
          ctx.damageEnemy(second, Math.floor(dmg / 2));
          ctx.log(`The arrow pierces through into ${second.name} for ${Math.floor(dmg / 2)}.`);
        }
      }
    },
    {
      id: 'justice', name: 'Justice', img: 'PhoenixV2', maxHp: 60,
      atkName: 'Rebirth', targetType: 'auto',
      desc: 'Revives a fallen ally, or heals the squad if none have fallen.',
      run(ctx) {
        const fallen = ctx.squad.filter(u => u.hp <= 0);
        if (fallen.length) {
          const t = pick(fallen);
          t.hp = Math.floor(t.maxHp * 0.5);
          ctx.log(`${ctx.self.name} revives ${t.name} in a burst of flame!`, 'heal');
        } else {
          ctx.squad.filter(u => u.hp > 0).forEach(u => u.hp = clamp(u.hp + 10, 0, u.maxHp));
          ctx.log(`${ctx.self.name} radiates warmth, healing the squad for 10.`, 'heal');
        }
      }
    },
    {
      id: 'cannon', name: 'Cannon', img: 'CanonV@', maxHp: 80,
      atkName: 'Cannonball', targetType: 'enemy',
      desc: 'A heavy cannonball strike (30-45 dmg).',
      run(ctx) {
        const dmg = rand(30, 45);
        ctx.damageEnemy(ctx.target, dmg, dmg >= 40);
        ctx.log(`${ctx.self.name} fires a cannonball at ${ctx.target.name} for ${dmg}!`);
      }
    },
    {
      id: 'rifle', name: 'Rifle', img: 'Riflev2', maxHp: 62,
      atkName: 'Focused Fire', targetType: 'enemy',
      desc: 'Steady, reliable damage (16-22) that ignores shields.',
      run(ctx) {
        const dmg = rand(16, 22);
        ctx.damageEnemy(ctx.target, dmg, false, true);
        ctx.log(`${ctx.self.name} lands focused fire on ${ctx.target.name} for ${dmg}.`);
      }
    },
    {
      id: 'smg', name: 'SMG', img: 'SMGv2', maxHp: 58,
      atkName: 'Spray', targetType: 'auto',
      desc: 'Fires 3 quick hits at random enemies (5-8 each).',
      run(ctx) {
        for (let i = 0; i < 3; i++) {
          const alive = ctx.enemies.filter(e => e.hp > 0);
          if (!alive.length) break;
          ctx.damageEnemy(pick(alive), rand(5, 8));
        }
        ctx.log(`${ctx.self.name} sprays the enemy line.`);
      }
    },
    {
      id: 'dualsmg', name: 'Dual SMG', img: 'DualSMG', maxHp: 56,
      atkName: 'Twin Spray', targetType: 'auto',
      desc: 'Fires 4 hits at random enemies (4-6 each).',
      run(ctx) {
        for (let i = 0; i < 4; i++) {
          const alive = ctx.enemies.filter(e => e.hp > 0);
          if (!alive.length) break;
          ctx.damageEnemy(pick(alive), rand(4, 6));
        }
        ctx.log(`${ctx.self.name} unloads twin SMGs.`);
      }
    },
    {
      id: 'dualshotgun', name: 'Dual Shotgun', img: 'DualShotgunv2', maxHp: 76,
      atkName: 'Double Blast', targetType: 'enemy',
      desc: 'Two heavy blasts on one target (14-18 each).',
      run(ctx) {
        for (let i = 0; i < 2; i++) {
          const dmg = rand(14, 18);
          ctx.damageEnemy(ctx.target, dmg);
        }
        ctx.log(`${ctx.self.name} unloads both barrels into ${ctx.target.name}.`);
      }
    },
    {
      id: 'duallaser', name: 'Dual Laser', img: 'DualLAzer', maxHp: 64,
      atkName: 'Laser Storm', targetType: 'auto',
      desc: 'Burning laser damage (10-14) to all enemies.',
      run(ctx) {
        ctx.enemies.filter(e => e.hp > 0).forEach(e => {
          ctx.damageEnemy(e, rand(10, 14));
          e.burn = { turns: 1, dmg: 4 };
        });
        ctx.log(`${ctx.self.name} unleashes a storm of lasers.`);
      }
    },
    {
      id: 'lmg', name: 'LMG', img: 'LMGV2', maxHp: 82,
      atkName: 'Suppressing Fire', targetType: 'auto',
      desc: 'Damages all enemies (8-12) and suppresses them.',
      run(ctx) {
        ctx.enemies.filter(e => e.hp > 0).forEach(e => {
          ctx.damageEnemy(e, rand(8, 12));
          e.suppressed = true;
        });
        ctx.log(`${ctx.self.name} pins down the enemy with suppressing fire.`);
      }
    },
    {
      id: 'ar', name: 'AR', img: 'ARv2', maxHp: 66,
      atkName: 'Burst Fire', targetType: 'enemy',
      desc: 'Fires a 3-round burst at one target (6-9 each).',
      run(ctx) {
        for (let i = 0; i < 3; i++) ctx.damageEnemy(ctx.target, rand(6, 9));
        ctx.log(`${ctx.self.name} burst-fires on ${ctx.target.name}.`);
      }
    }
  ];

  const CHAR_BY_ID = Object.fromEntries(ROSTER.map(c => [c.id, c]));

  // ---------------------------------------------------------------
  // Enemy types. Each may define `abilities`: a list of
  // { name, chance, run(ctx) } rolled in order on the enemy's turn.
  // If none trigger, the enemy falls back to a basic attack.
  // ---------------------------------------------------------------
  const ENEMY_TYPES = [
    { id: 'weak', name: 'Weak', img: 'Weak', baseHp: 20, baseAtk: 4 },
    {
      id: 'burst', name: 'Burst', img: 'Burst', baseHp: 26, baseAtk: 6,
      abilities: [{
        name: 'Rapid Burst', chance: 0.35,
        run(ctx) {
          shuffle(ctx.squad).slice(0, 2).forEach(t =>
            ctx.applyDamageToSquad(t, Math.round(ctx.self.atk * 0.6) + rand(-1, 2), `${ctx.self.name}'s Rapid Burst`));
        }
      }]
    },
    {
      id: 'machinegunner', name: 'Machine Gunner', img: 'MachineGunner', baseHp: 32, baseAtk: 7,
      abilities: [{
        name: 'Suppressive Fire', chance: 0.4,
        run(ctx) {
          const t = pick(ctx.squad);
          for (let i = 0; i < 3; i++) ctx.applyDamageToSquad(t, Math.round(ctx.self.atk * 0.4), `${ctx.self.name}'s Suppressive Fire`);
        }
      }]
    },
    {
      id: 'spreadshooter', name: 'Spread Shooter', img: 'SpreadShooter', baseHp: 30, baseAtk: 6,
      abilities: [{
        name: 'Spread Shot', chance: 0.45,
        run(ctx) {
          shuffle(ctx.squad).slice(0, 2).forEach(t => ctx.applyDamageToSquad(t, ctx.self.atk, `${ctx.self.name}'s Spread Shot`));
        }
      }]
    },
    {
      id: 'sniper', name: 'Sniper', img: 'Sniper', baseHp: 24, baseAtk: 10,
      abilities: [{
        name: 'Deadeye', chance: 0.35,
        run(ctx) {
          const t = ctx.squad.reduce((a, b) => (a.hp < b.hp ? a : b));
          ctx.applyDamageToSquad(t, ctx.self.atk * 2, `${ctx.self.name}'s Deadeye`);
        }
      }]
    },
    {
      id: 'rocketeer', name: 'Rocketeer', img: 'Rocketeer', baseHp: 34, baseAtk: 9,
      abilities: [{
        name: 'Rocket Volley', chance: 0.3,
        run(ctx) { ctx.squad.forEach(t => ctx.applyDamageToSquad(t, Math.round(ctx.self.atk * 0.5), `${ctx.self.name}'s Rocket Volley`)); }
      }]
    },
    {
      id: 'grenande', name: 'Grenadier', img: 'Grenande', baseHp: 36, baseAtk: 8,
      abilities: [{
        name: 'Grenade Toss', chance: 0.4,
        run(ctx) { ctx.squad.forEach(t => ctx.applyDamageToSquad(t, Math.round(ctx.self.atk * 0.6), `${ctx.self.name}'s Grenade Toss`)); }
      }]
    },
    {
      id: 'boomshooter', name: 'Boom Shooter', img: 'BoomShooter', baseHp: 30, baseAtk: 9,
      abilities: [{
        name: 'Boom Blast', chance: 0.35,
        run(ctx) { ctx.squad.forEach(t => ctx.applyDamageToSquad(t, Math.round(ctx.self.atk * 0.7), `${ctx.self.name}'s Boom Blast`)); }
      }]
    },
    {
      id: 'frobble', name: 'Frobble', img: 'Frobble', baseHp: 22, baseAtk: 5,
      abilities: [{
        name: 'Quick Strike', chance: 1,
        run(ctx) {
          for (let i = 0; i < 2; i++) ctx.applyDamageToSquad(pick(ctx.squad), Math.round(ctx.self.atk * 0.65), `${ctx.self.name}'s Quick Strike`);
        }
      }]
    },
    {
      id: 'gable', name: 'Gable', img: 'Gable', baseHp: 26, baseAtk: 6,
      abilities: [{
        name: 'Rally Cry', chance: 0.4,
        run(ctx) {
          const ally = ctx.enemies.find(e => e.hp > 0 && e !== ctx.self);
          if (ally) { ally.atkBuff = 1.5; ctx.log(`${ctx.self.name} rallies ${ally.name}, boosting its attack!`); }
          else { ctx.self.hp = clamp(ctx.self.hp + Math.round(ctx.self.maxHp * 0.15), 0, ctx.self.maxHp); ctx.log(`${ctx.self.name} rallies itself and recovers HP.`); }
        }
      }]
    },
    {
      id: 'goble', name: 'Goble', img: 'Goble', baseHp: 26, baseAtk: 6,
      abilities: [{
        name: 'Heavy Slam', chance: 0.4,
        run(ctx) { ctx.applyDamageToSquad(pick(ctx.squad), Math.round(ctx.self.atk * 1.6), `${ctx.self.name}'s Heavy Slam`); }
      }]
    },
    {
      id: 'cannontower', name: 'Cannon Tower', img: 'CannonTower', baseHp: 46, baseAtk: 11,
      abilities: [{
        name: 'Cannon Blast', chance: 0.5,
        run(ctx) { ctx.applyDamageToSquad(pick(ctx.squad), Math.round(ctx.self.atk * 1.5), `${ctx.self.name}'s Cannon Blast`); }
      }]
    },
    {
      id: 'dosserttower', name: 'Desert Tower', img: 'DessertTower', baseHp: 44, baseAtk: 10,
      abilities: [{
        name: 'Cannon Blast', chance: 0.5,
        run(ctx) { ctx.applyDamageToSquad(pick(ctx.squad), Math.round(ctx.self.atk * 1.5), `${ctx.self.name}'s Cannon Blast`); }
      }]
    },
    {
      id: 'tank', name: 'Tank', img: 'Tank', baseHp: 60, baseAtk: 9,
      abilities: [{
        name: 'Fortify', chance: 0.3,
        run(ctx) { ctx.self.defBuff = 0.4; ctx.log(`${ctx.self.name} hunkers down, bracing for the next attack.`); }
      }]
    },
    {
      id: 'tankdessert', name: 'Desert Tank', img: 'Tankdessert', baseHp: 64, baseAtk: 10,
      abilities: [{
        name: 'Fortify', chance: 0.3,
        run(ctx) { ctx.self.defBuff = 0.4; ctx.log(`${ctx.self.name} hunkers down, bracing for the next attack.`); }
      }]
    },
    { id: 'homing', name: 'The Homing', img: 'The homing', baseHp: 28, baseAtk: 8, homing: true },
    {
      id: 'spawner', name: 'Spawner', img: 'Spawner', baseHp: 24, baseAtk: 5,
      abilities: [{
        name: 'Spawn Minion', chance: 0.3,
        run(ctx) {
          if (ctx.enemies.filter(e => e.hp > 0).length < 5) {
            ctx.enemies.push(ctx.makeEnemy(ENEMY_TYPE_BY_ID.weak, ctx.stageScale, 0.8));
            ctx.log(`${ctx.self.name} spawns a minion!`);
          } else {
            ctx.applyDamageToSquad(pick(ctx.squad), ctx.self.atk, ctx.self.name);
          }
        }
      }]
    },
    {
      id: 'spawnerbig', name: 'Big Spawner', img: 'Spawnerbig', baseHp: 90, baseAtk: 10,
      abilities: [{
        name: 'Mass Spawn', chance: 0.4,
        run(ctx) {
          const n = ctx.enemies.filter(e => e.hp > 0).length < 4 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            if (ctx.enemies.filter(e => e.hp > 0).length >= 6) break;
            ctx.enemies.push(ctx.makeEnemy(ENEMY_TYPE_BY_ID.weak, ctx.stageScale, 0.8));
          }
          ctx.log(`${ctx.self.name} spawns minions to aid it!`);
        }
      }]
    }
  ];
  const ENEMY_TYPE_BY_ID = Object.fromEntries(ENEMY_TYPES.map(t => [t.id, t]));

  // ---------------------------------------------------------------
  // Arenas & campaign stages
  // ---------------------------------------------------------------
  const ARENAS = {
    forest: { label: 'Whispering Forest' },
    desert: { label: 'Scorching Desert' },
    city: { label: 'Ruined City' },
    quick: { label: 'Quick Level 5' },
    doors: { label: 'The Final Corridor' },
    final: { label: 'Final Showdown' }
  };

  // Each arena pool only contains that arena's own enemies — no bosses
  // from other arenas ever appear outside their own stage.
  const STAGE_POOLS = {
    forest: ['weak', 'burst', 'frobble', 'spawner'],
    desert: ['boomshooter', 'grenande', 'rocketeer', 'tank', 'tankdessert'],
    city: ['machinegunner', 'spreadshooter', 'homing', 'burst', 'sniper'],
    quick: ['frobble']
  };

  // Every stage is 3 waves; wave 3 is always the boss wave. A wheel spin
  // follows every wave, win or boss alike.
  const STAGES = [
    { stageNumber: 1, arena: 'forest', type: 'fight', count: 2, waveLabel: 'Wave 1/3', label: 'Forest — Wave 1/3' },
    { stageNumber: 1, arena: 'forest', type: 'fight', count: 3, waveLabel: 'Wave 2/3', label: 'Forest — Wave 2/3' },
    { stageNumber: 1, arena: 'forest', type: 'boss', bossIds: ['spawnerbig'], waveLabel: 'Boss Wave 3/3', label: 'Forest Boss: Big Spawner', bossScale: 1.4 },

    { stageNumber: 2, arena: 'desert', type: 'fight', count: 2, waveLabel: 'Wave 1/3', label: 'Desert — Wave 1/3' },
    { stageNumber: 2, arena: 'desert', type: 'fight', count: 3, waveLabel: 'Wave 2/3', label: 'Desert — Wave 2/3' },
    { stageNumber: 2, arena: 'desert', type: 'boss', bossIds: ['tankdessert'], waveLabel: 'Boss Wave 3/3', label: 'Desert Boss: The Tank', bossScale: 1.5 },

    { stageNumber: 3, arena: 'city', type: 'fight', count: 2, waveLabel: 'Wave 1/3', label: 'City — Wave 1/3' },
    { stageNumber: 3, arena: 'city', type: 'fight', count: 3, waveLabel: 'Wave 2/3', label: 'City — Wave 2/3' },
    { stageNumber: 3, arena: 'city', type: 'boss', bossIds: ['cannontower'], waveLabel: 'Boss Wave 3/3', label: 'City Boss: Cannon Tower', bossScale: 1.5 },

    { stageNumber: 4, arena: 'quick', type: 'fight', count: 1, waveLabel: 'Wave 1/3', label: 'Quick Level 5 — Wave 1/3' },
    { stageNumber: 4, arena: 'quick', type: 'fight', count: 2, waveLabel: 'Wave 2/3', label: 'Quick Level 5 — Wave 2/3' },
    { stageNumber: 4, arena: 'quick', type: 'boss', bossIds: ['frobble', 'frobble', 'frobble'], waveLabel: 'Boss Wave 3/3', label: 'Quick Level 5 Boss: Frobble Swarm', bossScale: 1.2 },

    { stageNumber: 5, arena: 'doors', type: 'doors', label: 'The Final Corridor' },
    { stageNumber: 6, arena: 'final', type: 'boss', bossIds: ['gable', 'goble'], waveLabel: 'Final Boss', label: 'Final Showdown: Gable & Goble', bossScale: 2 }
  ];
  const TOTAL_STAGE_NUMBERS = STAGES[STAGES.length - 1].stageNumber;

  // ---------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------
  const state = {
    squad: [],       // up to 4 { id, name, img, maxHp, hp, shield, burn, atkMult, acted }
    enemies: [],
    unlocked: new Set(['pistol', 'melee']),
    stageIndex: 0,
    round: 1,
    pendingAttacker: null,
    battleOver: false
  };
  let doorsResolved = false;
  let musicOn = false;

  let els = {};

  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function imgSrc(dir, name) {
    return `${dir}${name}.webp`;
  }
  function imgFallback(el, dir, name) {
    el.onerror = () => { el.onerror = null; el.src = `${dir}${name}.png`; };
  }

  function showScreen(id) {
    qa('.rpg-screen').forEach(s => s.classList.remove('active'));
    q('#' + id).classList.add('active');
  }

  function makeUnit(def) {
    return {
      id: def.id, name: def.name, img: def.img, maxHp: def.maxHp,
      hp: def.maxHp, shield: 0, burn: null, acted: false, atkMult: 1
    };
  }

  function makeEnemy(type, stageIndex, scaleMult) {
    scaleMult = scaleMult || 1;
    const hpMul = (1 + (stageIndex || 0) * 0.12) * scaleMult;
    const atkMul = (1 + (stageIndex || 0) * 0.08) * scaleMult;
    return {
      id: type.id + '_' + Math.random().toString(36).slice(2, 7),
      typeId: type.id, name: type.name, img: type.img,
      maxHp: Math.round(type.baseHp * hpMul),
      hp: Math.round(type.baseHp * hpMul),
      atk: Math.round(type.baseAtk * atkMul),
      homing: !!type.homing,
      suppressed: false, burn: null, defBuff: 0, atkBuff: 0
    };
  }

  function genEnemiesForStage(stage, stageIndex) {
    if (stage.type === 'fight') {
      const poolIds = STAGE_POOLS[stage.arena];
      const list = [];
      for (let i = 0; i < stage.count; i++) list.push(makeEnemy(ENEMY_TYPE_BY_ID[pick(poolIds)], stageIndex, 1));
      return list;
    }
    if (stage.type === 'boss') {
      return stage.bossIds.map(id => makeEnemy(ENEMY_TYPE_BY_ID[id], stageIndex, stage.bossScale || 1.3));
    }
    return [];
  }

  // ---------------------------------------------------------------
  // Init / Start
  // ---------------------------------------------------------------
  function init() {
    els.log = q('#battle-log');
    state.squad = ROSTER.filter(c => c.starter).map(makeUnit);
    while (state.squad.length < 4) state.squad.push(null);
    renderStart();
    showScreen('screen-start');

    q('#btn-start-run').addEventListener('click', startRun);
    q('#btn-restart').addEventListener('click', startRun);
    q('#btn-next-level').addEventListener('click', nextStage);
    q('#btn-spin').addEventListener('click', spinWheel);
    q('#btn-doors-continue').addEventListener('click', nextStage);
    q('#btn-play-again').addEventListener('click', startRun);
    q('#btn-music-toggle').addEventListener('click', toggleMusic);

    const best = localStorage.getItem(SAVE_KEY);
    if (best) q('#best-level').textContent = best;
  }

  function toggleMusic() {
    const holder = q('#music-embed');
    const btn = q('#btn-music-toggle');
    musicOn = !musicOn;
    if (musicOn) {
      holder.innerHTML = `<iframe src="https://open.spotify.com/embed/track/${THEME_TRACK_ID}?utm_source=generator&autoplay=1" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
      btn.textContent = '\uD83D\uDD07 Stop Theme';
    } else {
      holder.innerHTML = '';
      btn.textContent = '\uD83C\uDFB5 Play Theme';
    }
  }

  function renderStart() {
    const wrap = q('#start-squad-preview');
    wrap.innerHTML = '';
    state.squad.forEach(u => {
      const div = document.createElement('div');
      div.className = 'unit-card';
      if (u) {
        div.innerHTML = `<img src="${imgSrc(CHAR_DIR, u.img)}" alt="${u.name}"><div class="u-name">${u.name}</div>`;
        imgFallback(div.querySelector('img'), CHAR_DIR, u.img);
      } else {
        div.classList.add('empty-slot');
        div.textContent = 'Empty';
      }
      wrap.appendChild(div);
    });
  }

  function startRun() {
    state.squad = ROSTER.filter(c => c.starter).map(makeUnit);
    while (state.squad.length < 4) state.squad.push(null);
    state.unlocked = new Set(['pistol', 'melee']);
    state.stageIndex = 0;
    beginStage();
  }

  function setArenaVisual(arenaKey, label, isBoss) {
    const bf = q('#battlefield');
    bf.className = 'battlefield arena-' + arenaKey;
    const banner = q('#stage-banner');
    banner.textContent = label;
    banner.className = 'stage-banner' + (isBoss ? ' boss-banner' : '');
  }

  function beginStage() {
    const stage = STAGES[state.stageIndex];
    state.round = 1;
    state.battleOver = false;
    state.pendingAttacker = null;
    state.squad.forEach(u => { if (u) { u.shield = 0; u.acted = false; u.burn = null; } });
    clearLog();

    if (stage.type === 'doors') {
      showDoorsStage(stage);
      return;
    }

    state.enemies = genEnemiesForStage(stage, state.stageIndex);
    log(`${stage.label}!`, 'sys');
    setArenaVisual(stage.arena, stage.label, stage.type === 'boss');
    showScreen('screen-battle');
    renderBattle();
  }

  // ---------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------
  function clearLog() { els.log.innerHTML = ''; }
  function log(msg, cls) {
    const d = document.createElement('div');
    if (cls) d.className = 'l-' + cls;
    d.textContent = msg;
    els.log.appendChild(d);
    els.log.scrollTop = els.log.scrollHeight;
  }

  // ---------------------------------------------------------------
  // Battle rendering
  // ---------------------------------------------------------------
  function renderBattle() {
    const stage = STAGES[state.stageIndex];
    q('#hud-level').textContent = `Stage ${stage.stageNumber} / ${TOTAL_STAGE_NUMBERS} — ${stage.waveLabel || ''}`;
    q('#hud-round').textContent = state.round;
    q('#hud-alive').textContent = state.squad.filter(u => u && u.hp > 0).length;

    const squadRow = q('#squad-row');
    squadRow.innerHTML = '';
    state.squad.forEach((u, idx) => {
      const card = document.createElement('div');
      card.className = 'unit-card';
      if (!u) { card.classList.add('empty-slot'); card.textContent = 'Empty'; squadRow.appendChild(card); return; }
      const dead = u.hp <= 0;
      if (dead) card.classList.add('dead');
      if (u.acted && !dead) card.classList.add('acted');
      if (state.pendingAttacker === idx) card.classList.add('active-turn');
      if (!dead && !u.acted && state.pendingAttacker === null) card.classList.add('selectable');
      const pct = clamp(u.hp / u.maxHp * 100, 0, 100);
      card.innerHTML = `
        <img src="${imgSrc(CHAR_DIR, u.img)}" alt="${u.name}">
        <div class="u-name">${u.name}</div>
        <div class="u-hpbar"><div class="u-hpfill ${pct <= 30 ? 'low' : ''}" style="width:${pct}%"></div></div>
        <div class="u-hptext">${Math.max(0, u.hp)}/${u.maxHp}</div>
        ${u.shield > 0 ? `<div class="u-shield">Shield ${u.shield}</div>` : ''}
        ${u.atkMult > 1 ? `<div class="u-burn">ATK x${u.atkMult.toFixed(2)}</div>` : ''}
      `;
      imgFallback(card.querySelector('img'), CHAR_DIR, u.img);
      if (!dead && !u.acted && state.pendingAttacker === null) {
        card.addEventListener('click', () => selectAttacker(idx));
      }
      squadRow.appendChild(card);
    });

    const enemyRow = q('#enemy-row');
    enemyRow.innerHTML = '';
    state.enemies.forEach((e, idx) => {
      const card = document.createElement('div');
      card.className = 'unit-card';
      if (e.hp <= 0) card.classList.add('dead');
      if (state.pendingAttacker !== null && e.hp > 0) card.classList.add('targetable');
      const pct = clamp(e.hp / e.maxHp * 100, 0, 100);
      card.innerHTML = `
        <img src="${imgSrc(ENEMY_DIR, e.img)}" alt="${e.name}">
        <div class="u-name">${e.name}</div>
        <div class="u-hpbar"><div class="u-hpfill ${pct <= 30 ? 'low' : ''}" style="width:${pct}%"></div></div>
        <div class="u-hptext">${Math.max(0, e.hp)}/${e.maxHp}</div>
        ${e.burn ? `<div class="u-burn">Burning (${e.burn.turns})</div>` : ''}
        ${e.suppressed ? `<div class="u-shield">Suppressed</div>` : ''}
      `;
      imgFallback(card.querySelector('img'), ENEMY_DIR, e.img);
      if (state.pendingAttacker !== null && e.hp > 0) {
        card.addEventListener('click', () => resolveAttack(idx));
      }
      enemyRow.appendChild(card);
    });

    const ap = q('#ability-panel');
    if (state.pendingAttacker !== null) {
      const u = state.squad[state.pendingAttacker];
      const def = CHAR_BY_ID[u.id];
      ap.classList.add('show');
      ap.innerHTML = `<div class="a-name">${def.atkName}</div><div class="a-desc">${def.desc}</div>`;
      if (def.targetType === 'enemy') {
        ap.innerHTML += `<p style="color:#ffd166;font-size:0.8rem;">Choose an enemy target.</p>`;
      } else {
        ap.innerHTML += `<button class="button" id="btn-confirm-auto">Use Ability</button>`;
        setTimeout(() => {
          const b = q('#btn-confirm-auto');
          if (b) b.addEventListener('click', () => resolveAttack(null));
        });
      }
      ap.innerHTML += `<div><button class="button secondary" id="btn-cancel-attack" style="margin-top:8px;">Cancel</button></div>`;
      setTimeout(() => {
        const c = q('#btn-cancel-attack');
        if (c) c.addEventListener('click', () => { state.pendingAttacker = null; renderBattle(); });
      });
    } else {
      ap.classList.remove('show');
      ap.innerHTML = '';
    }

    const allActed = state.squad.every(u => !u || u.hp <= 0 || u.acted);
    q('#action-bar').textContent = allActed ? 'All squad members have acted — resolving enemy turn...' :
      'Select a squad member to act.';
    if (allActed && !state.battleOver) {
      setTimeout(enemyTurn, 700);
    }
  }

  function selectAttacker(idx) {
    state.pendingAttacker = idx;
    renderBattle();
  }

  function damageEnemy(enemy, amount, crit, ignoreShield) {
    let amt = amount;
    if (enemy.defBuff && !ignoreShield) amt = Math.round(amt * (1 - enemy.defBuff));
    enemy.hp = clamp(enemy.hp - amt, 0, enemy.maxHp);
  }

  function applyDamageToSquad(target, dmg, sourceName) {
    if (!target || target.hp <= 0) return;
    dmg = Math.max(1, Math.round(dmg));
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      dmg -= absorbed;
      log(`${target.name}'s shield absorbs ${absorbed} damage.`, 'heal');
    }
    if (dmg > 0) {
      target.hp = clamp(target.hp - dmg, 0, target.maxHp);
      log(`${sourceName} hits ${target.name} for ${dmg}.`, 'dmg');
    }
  }

  function resolveAttack(enemyIdx) {
    const attackerIdx = state.pendingAttacker;
    const unit = state.squad[attackerIdx];
    const def = CHAR_BY_ID[unit.id];
    const target = enemyIdx !== null ? state.enemies[enemyIdx] : null;

    const ctx = {
      self: unit, squad: state.squad, enemies: state.enemies, target,
      damageEnemy: (e, amt, crit, ignoreShield) => {
        const scaled = Math.round(amt * (unit.atkMult || 1));
        damageEnemy(e, scaled, crit, ignoreShield);
      },
      log
    };
    def.run(ctx);

    unit.acted = true;
    state.pendingAttacker = null;

    if (state.enemies.every(e => e.hp <= 0)) {
      state.battleOver = true;
      renderBattle();
      setTimeout(onVictory, 500);
      return;
    }
    renderBattle();
  }

  function enemyTurn() {
    if (state.battleOver) return;
    const aliveEnemies = state.enemies.filter(e => e.hp > 0);
    aliveEnemies.forEach(e => {
      // burn tick
      if (e.burn && e.burn.turns > 0) {
        damageEnemy(e, e.burn.dmg);
        e.burn.turns--;
        if (e.burn.turns <= 0) e.burn = null;
        if (e.hp <= 0) return;
      }
    });
    if (state.enemies.every(e => e.hp <= 0)) {
      state.battleOver = true;
      renderBattle();
      setTimeout(onVictory, 500);
      return;
    }
    // clear defensive buffs from last round so they don't stack forever
    state.enemies.forEach(e => { if (e.hp > 0) e.defBuff = 0; });

    state.enemies.filter(e => e.hp > 0).forEach(e => {
      const aliveSquad = state.squad.filter(u => u && u.hp > 0);
      if (!aliveSquad.length) return;

      const type = ENEMY_TYPE_BY_ID[e.typeId];
      const buffMult = e.atkBuff || 1;
      e.atkBuff = 0;
      const baseAtk = e.atk;
      e.atk = Math.round(baseAtk * buffMult);

      let used = false;
      if (type && type.abilities) {
        for (const ab of type.abilities) {
          if (Math.random() < ab.chance) {
            ab.run({
              self: e, enemies: state.enemies, squad: aliveSquad,
              applyDamageToSquad, log, makeEnemy, stageScale: state.stageIndex
            });
            used = true;
            break;
          }
        }
      }
      if (!used) {
        const target = e.homing ? aliveSquad.reduce((a, b) => (a.hp < b.hp ? a : b)) : pick(aliveSquad);
        let dmg = e.atk + rand(-2, 3);
        if (e.suppressed) { dmg = Math.round(dmg * 0.7); e.suppressed = false; }
        applyDamageToSquad(target, dmg, e.name);
      }
      e.atk = baseAtk;
    });

    if (state.squad.every(u => !u || u.hp <= 0)) {
      state.battleOver = true;
      renderBattle();
      setTimeout(onGameOver, 500);
      return;
    }

    state.round++;
    state.squad.forEach(u => { if (u && u.hp > 0) u.acted = false; });
    renderBattle();
  }

  function onGameOver() {
    const best = parseInt(localStorage.getItem(SAVE_KEY) || '0', 10);
    if (state.stageIndex > best) localStorage.setItem(SAVE_KEY, String(state.stageIndex));
    const stage = STAGES[state.stageIndex];
    q('#gameover-level').textContent = `Stage ${stage.stageNumber} (${stage.waveLabel || stage.label})`;
    showScreen('screen-gameover');
  }

  // ---------------------------------------------------------------
  // Victory + Wheel
  // ---------------------------------------------------------------
  let currentReward = null;
  let wheelSegments = [];

  function onVictory() {
    const stage = STAGES[state.stageIndex];
    log(`${stage.label} cleared!`, 'sys');
    if (state.stageIndex >= STAGES.length - 1) {
      onCampaignComplete();
      return;
    }
    q('#victory-heading').textContent = `${stage.label} Cleared!`;
    showScreen('screen-victory');
    buildWheel();
  }

  function onCampaignComplete() {
    const best = parseInt(localStorage.getItem(SAVE_KEY) || '0', 10);
    if (STAGES.length > best) localStorage.setItem(SAVE_KEY, String(STAGES.length));
    showScreen('screen-complete');
  }

  function nextStage() {
    state.stageIndex++;
    beginStage();
  }

  function buildWheel() {
    const lockedIds = ROSTER.map(c => c.id).filter(id => !state.unlocked.has(id));
    const segs = [];
    const shuffledLocked = shuffle(lockedIds).slice(0, 4);
    shuffledLocked.forEach(id => segs.push({ type: 'char', id }));
    const upgrades = [
      { type: 'upgrade', kind: 'heal' },
      { type: 'upgrade', kind: 'maxhp' },
      { type: 'upgrade', kind: 'upgrade' }
    ];
    while (segs.length < 6) segs.push(pick(upgrades));
    wheelSegments = shuffle(segs);

    const wheel = q('#wheel');
    wheel.innerHTML = '';
    wheel.style.transform = 'rotate(0deg)';
    const n = wheelSegments.length;
    const colors = ['#123b1a', '#1a5c2a', '#0c2b12', '#204e26'];
    const gradientParts = wheelSegments.map((s, i) => {
      const a1 = (360 / n) * i, a2 = (360 / n) * (i + 1);
      return `${colors[i % colors.length]} ${a1}deg ${a2}deg`;
    });
    wheel.style.background = `conic-gradient(${gradientParts.join(',')})`;

    const wheelLabels = { heal: 'Full Heal', maxhp: 'Max HP Up', upgrade: 'Upgrade Char' };
    wheelSegments.forEach((s, i) => {
      const mid = (360 / n) * i + (360 / n) / 2;
      const label = document.createElement('div');
      label.className = 'wheel-seg-label';
      label.style.transform = `rotate(${mid}deg) translate(0, -110px) rotate(${-mid}deg)`;
      if (s.type === 'char') {
        const def = CHAR_BY_ID[s.id];
        label.innerHTML = `<img src="${imgSrc(CHAR_DIR, def.img)}" alt="${def.name}"><span>${def.name}</span>`;
        imgFallback(label.querySelector('img'), CHAR_DIR, def.img);
      } else {
        label.innerHTML = `<span>${wheelLabels[s.kind]}</span>`;
      }
      wheel.appendChild(label);
    });

    q('#btn-spin').disabled = false;
    q('#btn-spin').style.display = '';
    q('#reward-result').classList.remove('show');
    q('#reward-result').innerHTML = '';
    q('#btn-next-level').style.display = 'none';
  }

  function spinWheel() {
    const btn = q('#btn-spin');
    btn.disabled = true;
    const n = wheelSegments.length;
    const chosenIdx = rand(0, n - 1);
    const segAngle = 360 / n;
    // land so the chosen segment center sits at top (0deg / pointer)
    const targetCenter = segAngle * chosenIdx + segAngle / 2;
    const spins = 5;
    const finalRotation = spins * 360 + (360 - targetCenter);
    const wheel = q('#wheel');
    wheel.style.transform = `rotate(${finalRotation}deg)`;

    setTimeout(() => {
      currentReward = wheelSegments[chosenIdx];
      showRewardResult(currentReward);
      btn.style.display = 'none';
    }, 4100);
  }

  function showRewardResult(reward) {
    const box = q('#reward-result');
    box.classList.add('show');
    if (reward.type === 'char') {
      const def = CHAR_BY_ID[reward.id];
      const alreadyOwned = state.unlocked.has(def.id);
      box.innerHTML = `
        <img src="${imgSrc(CHAR_DIR, def.img)}" alt="${def.name}">
        <h3>${alreadyOwned ? 'Duplicate: ' : ''}${def.name}</h3>
        <p>${def.atkName} — ${def.desc}</p>
        <div class="reward-actions">
          <button class="button" id="btn-keep">Keep</button>
          <button class="button secondary" id="btn-discard">Discard</button>
        </div>
      `;
      imgFallback(box.querySelector('img'), CHAR_DIR, def.img);
      q('#btn-keep').addEventListener('click', () => keepCharacter(def));
      q('#btn-discard').addEventListener('click', () => discardReward());
      return;
    }
    if (reward.kind === 'upgrade') {
      showUpgradePicker();
      return;
    }
    const labels = {
      heal: ['Full Heal', 'Fully restores your squad\'s HP for the next fight.'],
      maxhp: ['Max HP Up', 'Permanently boosts a random squad member\'s max HP by 15.']
    };
    const [title, desc] = labels[reward.kind];
    box.innerHTML = `
      <h3>${title}</h3>
      <p>${desc}</p>
      <div class="reward-actions">
        <button class="button" id="btn-keep">Keep</button>
        <button class="button secondary" id="btn-discard">Discard</button>
      </div>
    `;
    q('#btn-keep').addEventListener('click', () => applyUpgrade(reward.kind));
    q('#btn-discard').addEventListener('click', () => discardReward());
  }

  function applyUpgrade(kind) {
    if (kind === 'heal') {
      state.squad.forEach(u => { if (u) u.hp = u.maxHp; });
      log('Squad fully healed!', 'heal');
    } else if (kind === 'maxhp') {
      const alive = state.squad.filter(u => u);
      if (alive.length) {
        const u = pick(alive);
        u.maxHp += 15;
        u.hp = Math.min(u.hp + 15, u.maxHp);
        log(`${u.name}'s max HP increased to ${u.maxHp}!`, 'heal');
      }
    }
    finishReward();
  }

  function showUpgradePicker() {
    const box = q('#reward-result');
    box.innerHTML = `
      <h3>Upgrade Character</h3>
      <p>Choose a squad member to permanently boost their attack power by 25%.</p>
      <div class="roster-grid" id="upgrade-grid"></div>
      <div class="reward-actions"><button class="button secondary" id="btn-skip-upgrade">Skip</button></div>
    `;
    const grid = q('#upgrade-grid');
    state.squad.forEach(u => {
      if (!u) return;
      const card = document.createElement('div');
      card.className = 'unit-card selectable';
      card.innerHTML = `<img src="${imgSrc(CHAR_DIR, u.img)}" alt="${u.name}"><div class="u-name">${u.name}</div><div class="u-hptext">ATK x${(u.atkMult || 1).toFixed(2)}</div>`;
      imgFallback(card.querySelector('img'), CHAR_DIR, u.img);
      card.addEventListener('click', () => {
        u.atkMult = Math.round(((u.atkMult || 1) + 0.25) * 100) / 100;
        log(`${u.name}'s attack power increased to x${u.atkMult}!`, 'heal');
        finishReward();
      });
      grid.appendChild(card);
    });
    q('#btn-skip-upgrade').addEventListener('click', () => discardReward());
  }

  function discardReward() {
    log('Reward discarded.', 'sys');
    finishReward();
  }

  function keepCharacter(def) {
    state.unlocked.add(def.id);
    const emptyIdx = state.squad.findIndex(u => !u);
    if (emptyIdx !== -1) {
      state.squad[emptyIdx] = makeUnit(def);
      log(`${def.name} joins your squad!`, 'sys');
      finishReward();
    } else {
      showSwapPicker(def);
    }
  }

  function showSwapPicker(def) {
    const box = q('#reward-result');
    box.innerHTML = `
      <h3>Squad Full</h3>
      <p>Choose a member to replace with ${def.name}, or discard the new recruit.</p>
      <div class="roster-grid" id="swap-grid"></div>
      <div class="reward-actions"><button class="button secondary" id="btn-discard-new">Discard ${def.name}</button></div>
    `;
    const grid = q('#swap-grid');
    state.squad.forEach((u, idx) => {
      const card = document.createElement('div');
      card.className = 'unit-card selectable';
      card.innerHTML = `<img src="${imgSrc(CHAR_DIR, u.img)}" alt="${u.name}"><div class="u-name">${u.name}</div>`;
      imgFallback(card.querySelector('img'), CHAR_DIR, u.img);
      card.addEventListener('click', () => {
        log(`${u.name} was replaced by ${def.name}.`, 'sys');
        state.squad[idx] = makeUnit(def);
        finishReward();
      });
      grid.appendChild(card);
    });
    q('#btn-discard-new').addEventListener('click', () => discardReward());
  }

  function finishReward() {
    q('#reward-result').classList.remove('show');
    q('#btn-next-level').style.display = '';
  }

  // ---------------------------------------------------------------
  // Prefinal doors corridor: shoot a door for an ability, or nothing.
  // ---------------------------------------------------------------
  function showDoorsStage(stage) {
    doorsResolved = false;
    showScreen('screen-doors');
    q('#doors-result').classList.remove('show');
    q('#doors-result').innerHTML = '';
    q('#btn-doors-continue').style.display = 'none';
    const wrap = q('#doors-wrap');
    wrap.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div');
      d.className = 'door selectable';
      d.innerHTML = `<div class="door-face">Door ${i + 1}</div>`;
      d.addEventListener('click', () => openDoor(d));
      wrap.appendChild(d);
    }
  }

  function openDoor(doorEl) {
    if (doorsResolved) return;
    doorsResolved = true;
    qa('.door').forEach(d => d.classList.add('acted'));
    doorEl.classList.add('active-turn');

    const box = q('#doors-result');
    box.classList.add('show');
    const got = Math.random() < 0.5;
    if (!got) {
      box.innerHTML = `<h3>Empty Room</h3><p>Nothing but dust behind this door.</p>`;
      log('The door was empty.', 'sys');
    } else {
      const kind = pick(['heal', 'maxhp', 'upgrade']);
      const alive = state.squad.filter(u => u);
      if (kind === 'upgrade' && alive.length) {
        const u = pick(alive);
        u.atkMult = Math.round(((u.atkMult || 1) + 0.25) * 100) / 100;
        box.innerHTML = `<h3>Hidden Cache!</h3><p>${u.name}'s attack power increased to x${u.atkMult}!</p>`;
      } else if (kind === 'maxhp' && alive.length) {
        const u = pick(alive);
        u.maxHp += 15;
        u.hp = Math.min(u.hp + 15, u.maxHp);
        box.innerHTML = `<h3>Hidden Cache!</h3><p>${u.name}'s max HP increased to ${u.maxHp}!</p>`;
      } else {
        state.squad.forEach(u => { if (u) u.hp = u.maxHp; });
        box.innerHTML = `<h3>Hidden Cache!</h3><p>Your squad has been fully healed.</p>`;
      }
      log('The door held a hidden reward!', 'heal');
    }
    q('#btn-doors-continue').style.display = '';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
