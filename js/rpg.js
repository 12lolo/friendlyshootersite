// FriendlyShooter World RPG - roguelike squad battler
(function () {
  'use strict';

  const CHAR_DIR = 'Charachters/';
  const ENEMY_DIR = 'Enemy/';
  const SAVE_KEY = 'fs_rpg_best_level';

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
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
      id: 'justice', name: 'Justice', img: 'RevolverV2', maxHp: 65,
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
      id: 'phoenix', name: 'Phoenix', img: 'PhoenixV2', maxHp: 60,
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
  // Enemy types
  // ---------------------------------------------------------------
  const ENEMY_TYPES = [
    { id: 'weak', name: 'Weak', img: 'Weak', baseHp: 20, baseAtk: 4 },
    { id: 'burst', name: 'Burst', img: 'Burst', baseHp: 26, baseAtk: 6 },
    { id: 'machinegunner', name: 'Machine Gunner', img: 'MachineGunner', baseHp: 32, baseAtk: 7 },
    { id: 'spreadshooter', name: 'Spread Shooter', img: 'SpreadShooter', baseHp: 30, baseAtk: 6 },
    { id: 'sniper', name: 'Sniper', img: 'Sniper', baseHp: 24, baseAtk: 10 },
    { id: 'rocketeer', name: 'Rocketeer', img: 'Rocketeer', baseHp: 34, baseAtk: 9 },
    { id: 'grenande', name: 'Grenadier', img: 'Grenande', baseHp: 36, baseAtk: 8 },
    { id: 'boomshooter', name: 'Boom Shooter', img: 'BoomShooter', baseHp: 30, baseAtk: 9 },
    { id: 'frobble', name: 'Frobble', img: 'Frobble', baseHp: 22, baseAtk: 5 },
    { id: 'gable', name: 'Gable', img: 'Gable', baseHp: 26, baseAtk: 6 },
    { id: 'goble', name: 'Goble', img: 'Goble', baseHp: 26, baseAtk: 6 },
    { id: 'cannontower', name: 'Cannon Tower', img: 'CannonTower', baseHp: 46, baseAtk: 11 },
    { id: 'dosserttower', name: 'Desert Tower', img: 'DessertTower', baseHp: 44, baseAtk: 10 },
    { id: 'tank', name: 'Tank', img: 'Tank', baseHp: 60, baseAtk: 9 },
    { id: 'tankdessert', name: 'Desert Tank', img: 'Tankdessert', baseHp: 64, baseAtk: 10 },
    { id: 'homing', name: 'The Homing', img: 'The homing', baseHp: 28, baseAtk: 8 }
  ];

  // ---------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------
  const state = {
    squad: [],       // up to 4 { id, name, img, maxHp, hp, shield, burn, def, acted }
    enemies: [],
    unlocked: new Set(['pistol', 'melee']),
    level: 1,
    round: 1,
    pendingAttacker: null,
    battleOver: false
  };

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
      hp: def.maxHp, shield: 0, burn: null, acted: false
    };
  }

  function makeEnemy(type, level) {
    const hpMul = 1 + (level - 1) * 0.22;
    const atkMul = 1 + (level - 1) * 0.14;
    return {
      id: type.id + '_' + Math.random().toString(36).slice(2, 7),
      name: type.name, img: type.img,
      maxHp: Math.round(type.baseHp * hpMul),
      hp: Math.round(type.baseHp * hpMul),
      atk: Math.round(type.baseAtk * atkMul),
      suppressed: false, burn: null
    };
  }

  function genEnemies(level) {
    const count = clamp(1 + Math.floor(level / 2), 1, 5);
    const list = [];
    for (let i = 0; i < count; i++) list.push(makeEnemy(pick(ENEMY_TYPES), level));
    return list;
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
    q('#btn-next-level').addEventListener('click', nextLevel);
    q('#btn-spin').addEventListener('click', spinWheel);

    const best = localStorage.getItem(SAVE_KEY);
    if (best) q('#best-level').textContent = best;
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
    state.level = 1;
    beginLevel();
  }

  function beginLevel() {
    state.round = 1;
    state.battleOver = false;
    state.enemies = genEnemies(state.level);
    state.squad.forEach(u => { if (u) { u.shield = 0; u.acted = false; u.burn = null; } });
    clearLog();
    log(`Level ${state.level} begins!`, 'sys');
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
    q('#hud-level').textContent = state.level;
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
    enemy.hp = clamp(enemy.hp - amount, 0, enemy.maxHp);
  }

  function resolveAttack(enemyIdx) {
    const attackerIdx = state.pendingAttacker;
    const unit = state.squad[attackerIdx];
    const def = CHAR_BY_ID[unit.id];
    const target = enemyIdx !== null ? state.enemies[enemyIdx] : null;

    const ctx = {
      self: unit, squad: state.squad, enemies: state.enemies, target,
      damageEnemy: (e, amt, crit, ignoreShield) => { damageEnemy(e, amt, crit, ignoreShield); },
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
    state.enemies.filter(e => e.hp > 0).forEach(e => {
      const aliveSquad = state.squad.filter(u => u && u.hp > 0);
      if (!aliveSquad.length) return;
      const target = pick(aliveSquad);
      let dmg = e.atk + rand(-2, 3);
      if (e.suppressed) { dmg = Math.round(dmg * 0.7); e.suppressed = false; }
      dmg = Math.max(1, dmg);
      if (target.shield > 0) {
        const absorbed = Math.min(target.shield, dmg);
        target.shield -= absorbed;
        dmg -= absorbed;
        log(`${target.name}'s shield absorbs ${absorbed} damage.`, 'heal');
      }
      if (dmg > 0) {
        target.hp = clamp(target.hp - dmg, 0, target.maxHp);
        log(`${e.name} attacks ${target.name} for ${dmg}.`, 'dmg');
      }
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
    if (state.level > best) localStorage.setItem(SAVE_KEY, String(state.level));
    q('#gameover-level').textContent = state.level;
    showScreen('screen-gameover');
  }

  // ---------------------------------------------------------------
  // Victory + Wheel
  // ---------------------------------------------------------------
  let currentReward = null;
  let wheelSegments = [];

  function onVictory() {
    log(`Level ${state.level} cleared!`, 'sys');
    showScreen('screen-victory');
    buildWheel();
  }

  function nextLevel() {
    state.level++;
    beginLevel();
  }

  function buildWheel() {
    const lockedIds = ROSTER.map(c => c.id).filter(id => !state.unlocked.has(id));
    const segs = [];
    const shuffledLocked = lockedIds.sort(() => Math.random() - 0.5).slice(0, 4);
    shuffledLocked.forEach(id => segs.push({ type: 'char', id }));
    const upgrades = [
      { type: 'upgrade', kind: 'heal', label: 'Full Heal', img: null },
      { type: 'upgrade', kind: 'maxhp', label: 'Max HP Up', img: null },
      { type: 'upgrade', kind: 'atk', label: 'Power Up', img: null }
    ];
    while (segs.length < 6) segs.push(pick(upgrades));
    wheelSegments = segs.sort(() => Math.random() - 0.5);

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
        label.innerHTML = `<span>${s.label}</span>`;
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
    } else {
      const labels = {
        heal: ['Full Heal', 'Fully restores your squad\'s HP for the next level.'],
        maxhp: ['Max HP Up', 'Permanently boosts a random squad member\'s max HP by 15.'],
        atk: ['Power Up', 'Fully heals and readies your squad for battle.']
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
  }

  function applyUpgrade(kind) {
    if (kind === 'heal' || kind === 'atk') {
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

  document.addEventListener('DOMContentLoaded', init);
})();
