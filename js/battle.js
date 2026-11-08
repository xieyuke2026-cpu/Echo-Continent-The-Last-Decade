// 回声大陆 v0.1 · 战斗系统：回合制 + 声量机制
// 规则：你的声音既是武器，也是靶子。技能越响，声量越高，失声者扑得越狠。

const Battle = (() => {
  let B = null;
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));

  function start(enemyIds, onDone) {
    const party = Game.getParty();
    B = {
      allies: party.map(c => ({ ...c, cur: c.hp, guard: false, dead: false })),
      enemies: enemyIds.map(id => {
        const e = ENEMIES[id];
        return { id, name: e.name, glyph: e.glyph, hp: e.hp, maxhp: e.hp, atk: e.atk, xp: e.xp, coins: e.coins, boss: !!e.boss, dead: false };
      }),
      sound: 30, actor: 0, over: false, onDone, busy: false,
    };
    $('game-screen').classList.add('hidden');
    $('battle-screen').classList.remove('hidden');
    $('battle-log').innerHTML = '';
    log('失声者循声而来……', 'sys');
    if (B.enemies.some(e => e.boss)) log('无我失声者：声量越高，它的「扑声」越狠。用低鸣压声，或速战速决。', 'sys');
    render(); nextActor();
  }

  function log(msg, cls) {
    const el = $('battle-log');
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = msg;
    el.appendChild(div); el.scrollTop = el.scrollHeight;
  }

  function render() {
    $('battle-enemies').innerHTML = B.enemies.map((e, i) => `
      <div class="fighter enemy ${e.dead ? 'dead' : ''}">
        <div class="avatar">${e.glyph}</div>
        <div class="fname">${e.name}</div>
        <div class="hpbar"><div style="width:${Math.max(0, e.hp / e.maxhp * 100)}%"></div></div>
        <div class="fhp">${Math.max(0, Math.ceil(e.hp))} / ${e.maxhp}</div>
      </div>`).join('') +
      `<div id="sound-meter">声量 ${'▮'.repeat(Math.round(B.sound / 10))}${'▯'.repeat(10 - Math.round(B.sound / 10))} ${B.sound}</div>`;
    $('battle-party').innerHTML = B.allies.map((a, i) => `
      <div class="fighter ally ${a.dead ? 'dead' : ''}">
        <div class="avatar" style="border-color:${a.color}">${a.glyph}</div>
        <div class="fname">${a.name}${i === B.actor && !B.over ? ' ◀' : ''}</div>
        <div class="hpbar"><div style="width:${Math.max(0, a.cur / a.hp * 100)}%"></div></div>
        <div class="fhp">${Math.max(0, Math.ceil(a.cur))} / ${a.hp}${a.guard ? ' · 低鸣中' : ''}</div>
      </div>`).join('');
  }

  function alive(list) { return list.filter(x => !x.dead); }

  function nextActor() {
    if (B.over) return;
    while (B.actor < B.allies.length && B.allies[B.actor].dead) B.actor++;
    if (B.actor >= B.allies.length) { enemyPhase(); return; }
    render(); showActions();
  }

  function showActions() {
    const a = B.allies[B.actor];
    const box = $('battle-actions');
    const itemCount = Game.state.items.bing + Game.state.items.yinxiang;
    box.innerHTML = `
      <button class="act-btn" data-act="attack">发声（普攻）</button>
      <button class="act-btn" data-act="skill">${a.skill.name}</button>
      <button class="act-btn" data-act="guard">低鸣（防御 · 声量-25）</button>
      <button class="act-btn" data-act="item" ${itemCount === 0 ? 'disabled' : ''}>道具</button>
      <span style="align-self:center;color:#8d8fa0;font-size:13px">行动：${a.name} — ${a.skill.desc}</span>`;
    box.querySelectorAll('.act-btn').forEach(btn => btn.onclick = () => doAction(a, btn.dataset.act));
  }

  function pickTarget(cb) {
    const targets = alive(B.enemies);
    if (targets.length === 1) { cb(targets[0]); return; }
    const box = $('battle-actions');
    box.innerHTML = '<span style="align-self:center;color:#c9a86a">选择目标：</span>' +
      targets.map((e, i) => `<button class="act-btn small" data-t="${B.enemies.indexOf(e)}">${e.name}</button>`).join('') +
      '<button class="act-btn small" data-t="-1">取消</button>';
    box.querySelectorAll('.act-btn').forEach(btn => btn.onclick = () => {
      const t = +btn.dataset.t;
      if (t < 0) { showActions(); return; }
      cb(B.enemies[t]);
    });
  }

  function doAction(a, act) {
    if (B.busy || B.over) return;
    if (act === 'attack') {
      pickTarget(t => { hit(a, t, 1.0, '发声'); addSound(10); afterAlly(); });
    } else if (act === 'skill') {
      const s = a.skill;
      if (s.flaky && Math.random() < 0.25) {
        log(`${a.name} 把手抬起来，又收了回去——「……今天不弹。」（改为低鸣）`, 'sys');
        a.guard = true; addSound(-10); afterAlly(); return;
      }
      if (s.heal) {
        B.allies.forEach(x => { if (!x.dead) x.cur = Math.min(x.hp, x.cur + x.hp * s.heal); });
        log(`${a.name} 用出「${s.name}」：全队回复生命。那封信的重量，稳住了所有人的声音。`, 'good');
        addSound(s.sound); afterAlly();
      } else if (s.aoe) {
        alive(B.enemies).forEach(t => hit(a, t, s.mult, s.name, true));
        addSound(s.sound); afterAlly();
      } else {
        pickTarget(t => { hit(a, t, s.mult, s.name); addSound(s.sound); afterAlly(); });
      }
    } else if (act === 'guard') {
      a.guard = true; addSound(-25);
      log(`${a.name} 低鸣：把声音压到最低，失声者一时找不到他。`, 'sys');
      afterAlly();
    } else if (act === 'item') {
      const box = $('battle-actions');
      const it = Game.state.items;
      box.innerHTML =
        `<button class="act-btn small" data-it="bing" ${it.bing <= 0 ? 'disabled' : ''}>灰麦饼 ×${it.bing}（回复45）</button>` +
        `<button class="act-btn small" data-it="yinxiang" ${it.yinxiang <= 0 ? 'disabled' : ''}>引响香 ×${it.yinxiang}（声量-30）</button>` +
        '<button class="act-btn small" data-it="">取消</button>';
      box.querySelectorAll('.act-btn').forEach(btn => btn.onclick = () => {
        const id = btn.dataset.it;
        if (!id) { showActions(); return; }
        if (id === 'bing') {
          pickTargetAlly(t => {
            Game.state.items.bing--; t.cur = Math.min(t.hp, t.cur + ITEMS.bing.heal);
            log(`${a.name} 给 ${t.name} 喂了灰麦饼，回复 45 点生命。`, 'good');
            Game.updateHUD(); afterAlly();
          });
        } else {
          Game.state.items.yinxiang--; addSound(-30);
          log(`${a.name} 点燃引响香，声音被香雾裹住了。（声量-30）`, 'sys');
          Game.updateHUD(); afterAlly();
        }
      });
    }
  }

  function pickTargetAlly(cb) {
    const box = $('battle-actions');
    box.innerHTML = '<span style="align-self:center;color:#c9a86a">给谁吃：</span>' +
      alive(B.allies).map(a => `<button class="act-btn small" data-t="${B.allies.indexOf(a)}">${a.name}</button>`).join('') +
      '<button class="act-btn small" data-t="-1">取消</button>';
    box.querySelectorAll('.act-btn').forEach(btn => btn.onclick = () => {
      const t = +btn.dataset.t;
      if (t < 0) { showActions(); return; }
      cb(B.allies[t]);
    });
  }

  function hit(a, t, mult, label, quiet) {
    const dmg = Math.max(1, Math.round(a.atk * mult * rnd(0.85, 1.15)));
    t.hp -= dmg;
    if (!quiet) log(`${a.name} 「${label}」打中 ${t.name}，造成 ${dmg} 点伤害。`);
    else log(`→ ${t.name} 受到 ${dmg} 点伤害。`);
    if (t.hp <= 0 && !t.dead) { t.dead = true; log(`${t.name} 的形状散了，声音落回灰里。`, 'good'); }
  }

  function addSound(n) { B.sound = Math.max(0, Math.min(100, B.sound + n)); }

  function afterAlly() {
    render();
    if (alive(B.enemies).length === 0) { win(); return; }
    B.actor++; nextActor();
  }

  function enemyPhase() {
    B.busy = true; $('battle-actions').innerHTML = '';
    const foes = alive(B.enemies);
    let i = 0;
    const step = () => {
      if (B.over) return;
      if (i >= foes.length) {
        B.allies.forEach(a => a.guard = false);
        B.actor = 0; B.busy = false; render(); nextActor(); return;
      }
      const e = foes[i++];
      const targets = alive(B.allies);
      if (!targets.length) { lose(); return; }
      const t = targets[ri(0, targets.length - 1)];
      let mult = 1, label = '扑击';
      if (e.boss && B.sound >= 60) { mult = 1.6; label = '扑声（声量过高！）'; }
      else if (B.sound >= 50) { mult = 1.3; label = '循声扑击'; }
      let dmg = Math.max(1, Math.round(e.atk * mult * rnd(0.85, 1.15)));
      if (t.guard) dmg = Math.max(1, Math.round(dmg * 0.4));
      t.cur -= dmg;
      log(`${e.name} ${label} ${t.name}，造成 ${dmg} 点伤害。${t.guard ? '（低鸣挡下了大半）' : ''}`, 'bad');
      if (t.cur <= 0 && !t.dead) { t.dead = true; log(`${t.name} 的声音断了……`, 'bad'); }
      render();
      if (alive(B.allies).length === 0) { lose(); return; }
      setTimeout(step, 650);
    };
    setTimeout(step, 500);
  }

  function win() {
    B.over = true; render();
    const xp = B.enemies.reduce((s, e) => s + e.xp, 0);
    const coins = B.enemies.reduce((s, e) => s + ri(e.coins[0], e.coins[1]), 0);
    log(`战斗胜利。经验 +${xp}，弦币 +${coins}。`, 'good');
    $('battle-actions').innerHTML = '<button class="act-btn" id="b-ok">回到原野</button>';
    $('b-ok').onclick = () => {
      $('battle-screen').classList.add('hidden');
      $('game-screen').classList.remove('hidden');
      const res = Game.gainRewards(xp, coins);
      if (res) Game.toast(res);
      fireDone(true);
    };
  }

  function lose() {
    B.over = true; render();
    log('全队的声音都断了……守碑村的钟声远远传来，把你们的回声捞了回去。', 'bad');
    $('battle-actions').innerHTML = '<button class="act-btn" id="b-ok">在守碑村醒来</button>';
    $('b-ok').onclick = () => {
      $('battle-screen').classList.add('hidden');
      $('game-screen').classList.remove('hidden');
      const lost = Math.floor(Game.state.coins * 0.2);
      Game.state.coins -= lost;
      Game.respawnAtVillage();
      Game.toast(`在守碑村醒来。弦币被灰吹走了 ${lost}。`);
      fireDone(false);
    };
  }

  // 结束回调单独保存：win/lose 收尾时会先清掉 B，不能从 B 上取
  let savedDone = null;
  function fireDone(v) {
    const f = savedDone; savedDone = null; B = null;
    if (f) f(v);
  }
  function startWithSave(enemyIds, onDone) { savedDone = onDone; start(enemyIds, onDone); }

  return { start: startWithSave };
})();
