// 回声大陆 v0.1 · 世界层：状态 / 地图 / 移动 / 对话 / 任务 / 商店 / 存档
// 地图：灰烬原野（残碑原 / 守碑村 / 半埋之城 / 风蚀坡 / 旧驿道 / 灰线）

const Game = (() => {
  const SAVE_KEY = 'echo-continent-save-v1';
  const TW = 72, TH = 48, TILE = 32;
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);

  // ---------- 状态 ----------
  function newState() {
    return {
      stage: 0, level: 1, xp: 0, coins: 50, crystals: 0, shards: 0, notesGot: [],
      items: { bing: 1, yinxiang: 0 },
      chars: {}, party: [], pullsSince5: 0,
      flags: {}, echoCount: 0, echoesDone: false, letterState: 0,
      pos: { x: 10.5, y: 25.5 },
    };
  }
  let S = newState();
  let player = { x: 10.5, y: 25.5, moving: false };
  let ripples = [], stepAcc = 0, encounterCd = 0, started = false;

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      S = Object.assign(newState(), JSON.parse(raw));
      player.x = S.pos.x; player.y = S.pos.y;
      return true;
    } catch (e) { return false; }
  }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

  // ---------- 数值 ----------
  function xpNeed(lv) { return 40 * lv; }
  function soulBonus(cid) { return 1 + 0.06 * Math.max(0, (S.chars[cid] || 1) - 1); }
  function playerStats() {
    const notes = S.notesGot.length;
    const hp = Math.round((100 + (S.level - 1) * 8 + notes * 15) * (1 + 0.06 * (S.chars.yuyin || 0)));
    const atk = Math.round((12 + (S.level - 1) * 2 + notes * 3) * (1 + 0.06 * (S.chars.yuyin || 0)));
    return { hp, atk };
  }
  function getParty() {
    const ps = playerStats();
    const main = { cid: 'yuyin', name: '余音之子', glyph: '律', color: '#c9a86a', hp: ps.hp, atk: ps.atk, skill: CHARACTERS.yuyin.skill };
    const mates = S.party.filter(id => S.chars[id]).map(id => {
      const c = CHARACTERS[id];
      const scale = (1 + 0.05 * (S.level - 1)) * soulBonus(id);
      return { cid: id, name: c.name, glyph: c.glyph, color: c.color, hp: Math.round(c.hp * scale), atk: Math.round(c.atk * scale), skill: c.skill };
    });
    return [main, ...mates];
  }
  function gainRewards(xp, coins) {
    S.coins += coins;
    let msg = '';
    if (S.level < 10) {
      S.xp += xp;
      while (S.level < 10 && S.xp >= xpNeed(S.level)) {
        S.xp -= xpNeed(S.level); S.level++;
        msg = '升级！现在是 Lv.' + S.level + '。';
        if (S.level === 10) msg += '（v0.1 等级上限——乐神试炼将在后续版本开放）';
      }
    }
    updateHUD(); save();
    return msg || null;
  }
  function giveNote(id) {
    if (S.notesGot.includes(id)) return;
    S.notesGot.push(id); updateHUD(); save();
  }

  // ---------- 地图 ----------
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
  function tileAt(x, y) {
    if (x < 0 || y < 0 || x >= TW || y >= TH) return 'void';
    if (y < (S.stage >= 4 ? 2 : 3)) return 'gray';
    if (x >= 46 && x <= 69 && y >= 3 && y <= 21) return 'ruin';
    if (x >= 25 && x <= 45 && y >= 15 && y <= 33) return 'dirt';
    if (x >= 27 && x <= 40 && y >= 34 && y <= 38) return 'field';
    if (y >= 35 && y <= 37 && x >= 44 && x <= 70) return 'road';
    if (y === 25 && x >= 18 && x <= 25) return 'road';
    if (x <= 21 && y >= 34) return 'slope';
    return 'ash';
  }
  const TILE_COLORS = { ash: '#3b392f', dirt: '#4a4136', field: '#57543a', ruin: '#33323a', road: '#504736', slope: '#474439', gray: '#22221f', void: '#101116' };
  const SOLIDS = [];
  function solid(x, y, w, h, kind) { SOLIDS.push({ x, y, w, h, kind }); }
  // 村庄房屋 / 钟塔 / 井
  solid(27, 17, 3, 2, 'house'); solid(32, 16, 4, 2, 'house'); solid(38, 17, 3, 2, 'house');
  solid(28, 28, 3, 2, 'house'); solid(39, 28, 4, 2, 'house');
  solid(26, 19, 2, 3, 'tower'); solid(35, 23, 1, 1, 'well');
  // 半埋之城围墙（南墙留门 54-56）
  solid(46, 3, 24, 1, 'wall'); solid(46, 21, 8, 1, 'wall'); solid(57, 21, 13, 1, 'wall');
  solid(46, 3, 1, 19, 'wall'); solid(69, 3, 1, 19, 'wall');
  // 城内残垣
  solid(50, 7, 3, 1, 'wall'); solid(55, 10, 1, 3, 'wall'); solid(60, 13, 4, 1, 'wall');
  solid(49, 16, 1, 3, 'wall'); solid(63, 6, 1, 4, 'wall'); solid(52, 5, 4, 1, 'wall'); solid(65, 18, 3, 1, 'wall');
  // 残碑 / 界碑 / 鸣石
  solid(10, 21, 1, 1, 'stele'); solid(12, 3, 1, 1, 'stele');
  solid(6, 38, 1, 1, 'rock'); solid(14, 42, 1, 1, 'rock'); solid(17, 36, 1, 1, 'rock'); solid(8, 41, 1, 1, 'bigstone');
  // 灰原散石与枯树（确定性散布，避开功能区）
  for (let x = 2; x < TW - 2; x++) for (let y = 5; y < TH - 2; y++) {
    const t = tileAt(x, y);
    if ((t === 'ash' || t === 'slope') && hash(x, y) > 0.965) solid(x, y, 1, 1, hash(x, y + 99) > 0.5 ? 'rock' : 'tree');
  }
  function isSolid(px, py) {
    if (px < 0.4 || py < 0.4 || px > TW - 0.4 || py > TH - 0.4) return true;
    return SOLIDS.some(s => px > s.x - 0.32 && px < s.x + s.w + 0.32 && py > s.y - 0.32 && py < s.y + s.h + 0.32);
  }
  function inCity(px, py) { return px >= 47 && px <= 69 && py >= 4 && py <= 20; }

  // ---------- 交互对象 ----------
  const OBJS = [
    { id: 'stele', x: 10.5, y: 20.4, glyph: '碑', name: '残碑', color: '#8d8fa0' },
    { id: 'elder', x: 35.5, y: 21.5, glyph: '婆', name: '村长婆婆', color: '#c9a86a', npc: true, spr: 'elder' },
    { id: 'villagerA', x: 31.5, y: 24.5, glyph: '灰', name: '守碑人·阿灰', color: '#9d9fb2', npc: true, spr: 'villagerA' },
    { id: 'villagerB', x: 38.5, y: 25.5, glyph: '满', name: '守碑人·小满', color: '#93c48d', npc: true, spr: 'villagerB' },
    { id: 'bell', x: 27.5, y: 22.6, glyph: '钟', name: '村口大钟', color: '#b7ac8e' },
    { id: 'well', x: 35.5, y: 22.4, glyph: '井', name: '村里的井', color: '#8fa3c7' },
    { id: 'shisheng', x: 55.5, y: 23.5, glyph: '拾', name: '拾声', color: '#b87748', npc: true, spr: 'shisheng' },
    { id: 'heart', x: 58.5, y: 6.5, glyph: '心', name: '城心 · 喊声的源头', color: '#e08a4c', glow: true },
    { id: 'letter', x: 62.5, y: 9.5, glyph: '书', name: '压在塌墙下的遗书', color: '#c9d6ee', glow: true },
    { id: 'echo1', x: 49.5, y: 7.5, glyph: '响', name: '一段回声', color: '#8fa3c7', glow: true },
    { id: 'echo2', x: 66.5, y: 17.5, glyph: '响', name: '一段回声', color: '#8fa3c7', glow: true },
    { id: 'echo3', x: 52.5, y: 15.5, glyph: '响', name: '一段回声', color: '#8fa3c7', glow: true },
    { id: 'noteJiebei', x: 12.5, y: 2.4, glyph: '♪', name: '界碑后的微光', color: '#ffd98a', glow: true },
    { id: 'noteMingshi', x: 8.5, y: 40.4, glyph: '♪', name: '最大的鸣石', color: '#ffd98a', glow: true },
    { id: 'sign', x: 68.5, y: 34.4, glyph: '牌', name: '旧驿道路牌', color: '#9d9fb2' },
  ];
  function objVisible(o) {
    if (o.id === 'heart') return S.stage === 2 && !S.flags.bossDone;
    if (o.id === 'letter') return S.stage >= 2 && S.letterState === 0;
    if (o.id.startsWith('echo')) return S.stage >= 2 && !S.flags['got_' + o.id];
    if (o.id === 'noteJiebei') return !S.notesGot.includes('jiebei');
    if (o.id === 'noteMingshi') return !S.notesGot.includes('mingshi');
    return true;
  }

  // ---------- 对话引擎 ----------
  let dlg = null;
  function say(lines, onEnd) {
    dlg = { lines, i: 0, onEnd };
    $('dialog').classList.remove('hidden');
    renderDlg();
  }
  function renderDlg() {
    const [who, text] = dlg.lines[dlg.i];
    $('dialog-who').textContent = who || '——';
    $('dialog-text').textContent = text;
  }
  function advanceDlg() {
    if (!dlg) return false;
    dlg.i++;
    if (dlg.i >= dlg.lines.length) {
      const cb = dlg.onEnd; dlg = null;
      $('dialog').classList.add('hidden');
      if (cb) cb();
    } else renderDlg();
    return true;
  }
  const inDialog = () => !!dlg;

  // ---------- 提示 ----------
  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3400);
  }
  function modal(title, body) {
    $('modal-title').textContent = title;
    $('modal-body').textContent = body;
    $('modal').classList.remove('hidden');
  }

  // ---------- 任务 / 互动 ----------
  function setStage(n) { S.stage = n; $('objective-text').textContent = OBJECTIVES[n]; updateHUD(); save(); }

  function interact() {
    if (inDialog()) { advanceDlg(); return; }
    if (!$('panel').classList.contains('hidden')) return;
    if (!$('battle-screen').classList.contains('hidden')) return;
    if (!$('modal').classList.contains('hidden')) return;
    let best = null, bd = 1.8;
    for (const o of OBJS) {
      if (!objVisible(o)) continue;
      const d = Math.hypot(o.x - player.x, o.y - player.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) handleObj(best);
  }

  function handleObj(o) {
    switch (o.id) {
      case 'stele':
        if (S.stage === 0) {
          say(DIALOGS.stele_first, () => {
            S.chars.yuyin = 1; S.crystals += 3;
            toast('获得：上一个自己的回声（乐魂 1）· 共鸣结晶 +3');
            setStage(1);
          });
        } else say(DIALOGS.stele_after);
        break;
      case 'elder':
        if (S.stage === 1) say(DIALOGS.elder_first, () => setStage(2));
        else if (S.stage === 2 && S.letterState === 1) {
          say(DIALOGS.letter_deliver, () => {
            S.letterState = 2; S.coins += 60; S.crystals += 3;
            gainRewards(30, 0); updateHUD(); save();
          });
        }
        else if (S.stage === 2) say(DIALOGS.elder_wait);
        else if (S.stage === 3) {
          say(DIALOGS.elder_return, () => {
            gainRewards(100, 0); setStage(4);
          });
        } else if (S.letterState === 1) {
          say(DIALOGS.letter_deliver, () => {
            S.letterState = 2; S.coins += 60; S.crystals += 3; gainRewards(30, 0); updateHUD(); save();
          });
        } else say(DIALOGS.elder_free);
        break;
      case 'villagerA': say(DIALOGS.villager_a); break;
      case 'villagerB':
        if (!S.flags.xiaomanGift) {
          say(DIALOGS.villager_b, () => { S.flags.xiaomanGift = true; S.items.bing++; updateHUD(); save(); });
        } else say([['守碑人·小满', '哥哥，钟修好了要告诉我！我想听它响。']]);
        break;
      case 'bell':
        say(S.stage >= 4 ? DIALOGS.bell_fixed : DIALOGS.bell_broken);
        break;
      case 'well':
        say([['', '井水很凉。水面映着天，天是灰的。井底有什么东西在轻轻回响——是水声，也是六千年前的雨声。']]);
        break;
      case 'shisheng': talkShisheng(); break;
      case 'heart':
        say(DIALOGS.boss_pre, () => {
          Battle.start(['wuwo'], won => {
            if (won) {
              S.flags.bossDone = true;
              say(DIALOGS.boss_post, () => { giveNote('chengxin'); gainRewards(0, 0); setStage(3); });
            }
          });
        });
        break;
      case 'letter':
        say(DIALOGS.letter_pickup, () => { S.letterState = 1; save(); });
        break;
      case 'echo1': case 'echo2': case 'echo3': {
        S.flags['got_' + o.id] = true; S.echoCount++;
        say(DIALOGS.echo_point.map(([w, t]) => [w, t.replace('%N%', S.echoCount)]),
          () => { if (S.echoCount >= 3) toast('三段回声集齐了——拿去给城门口的拾声。'); save(); });
        break;
      }
      case 'noteJiebei':
        say(DIALOGS.note_jiebei, () => { giveNote('jiebei'); S.crystals += 2; updateHUD(); });
        break;
      case 'noteMingshi':
        say(DIALOGS.note_mingshi, () => { giveNote('mingshi'); S.crystals += 2; updateHUD(); });
        break;
      case 'sign': say(DIALOGS.road_sign); break;
    }
  }

  function talkShisheng() {
    if (!S.flags.metShisheng) {
      say(DIALOGS.shisheng_first, () => { S.flags.metShisheng = true; save(); openShop(); });
      return;
    }
    if (S.echoCount >= 3 && !S.echoesDone) {
      say(DIALOGS.shisheng_echoes_done, () => {
        S.echoesDone = true; S.coins += 50; S.crystals += 3; gainRewards(40, 0); updateHUD(); save();
      });
      return;
    }
    openShop();
  }

  // ---------- 商店 ----------
  function openShop() {
    const rows = SHOP_GOODS.map(g => {
      const it = ITEMS[g.itemId];
      return `<div class="shop-row"><div><b style="color:#eee6cf">${it.name}</b> <span style="color:#8d8fa0">${it.desc}</span><br><span style="color:#8d8fa0">持有 ×${S.items[g.itemId] || 0}</span></div>
      <button data-buy="${g.itemId}" ${S.coins < it.price ? 'disabled' : ''}>${it.price} 弦币</button></div>`;
    }).join('');
    showPanel('拾声的小摊', `
      <div class="pool-info">「回声是物资——但有的回声标不了价。」你的弦币：<b style="color:#eee6cf">${S.coins}</b>${S.echoCount < 3 && S.stage >= 2 ? `<br>（城里还散着 ${3 - S.echoCount} 段值钱的回声，拾声在收。）` : ''}</div>
      ${rows}`);
    document.querySelectorAll('[data-buy]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.buy, it = ITEMS[id];
      if (S.coins < it.price) return;
      S.coins -= it.price; S.items[id] = (S.items[id] || 0) + 1;
      updateHUD(); save(); openShop();
    });
  }

  // ---------- 面板 ----------
  function showPanel(title, html) {
    $('panel-title').textContent = title;
    $('panel-body').innerHTML = html;
    $('panel').classList.remove('hidden');
  }
  function closePanel() { $('panel').classList.add('hidden'); }

  // ---------- HUD ----------
  function updateHUD() {
    $('hud-level').textContent = S.level;
    $('hud-xpfill').style.width = (S.level >= 10 ? 100 : Math.min(100, S.xp / xpNeed(S.level) * 100)) + '%';
    $('hud-notes').textContent = S.notesGot.length;
    $('hud-coins').textContent = S.coins;
    $('hud-crystals').textContent = S.crystals;
    $('hud-shards').textContent = S.shards;
    $('objective-text').textContent = OBJECTIVES[S.stage];
  }

  function respawnAtVillage() {
    player.x = 35.5; player.y = 26.5; S.pos = { x: player.x, y: player.y }; save();
  }

  // ---------- 输入 ----------
  const keys = {};
  let joyVec = { x: 0, y: 0 };
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'e' || e.key === 'Enter' || e.key === ' ') interact();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  $('dialog').addEventListener('click', () => advanceDlg());
  $('modal-ok').addEventListener('click', () => $('modal').classList.add('hidden'));
  $('panel-close').addEventListener('click', closePanel);
  $('btn-act').addEventListener('click', () => interact());

  // 虚拟摇杆
  (() => {
    const joy = $('joystick'), knob = $('joy-knob');
    let active = null;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
    joy.addEventListener('pointerdown', e => { active = e.pointerId; joy.setPointerCapture(active); move(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === active) move(e); });
    const end = e => { if (e.pointerId === active) { active = null; joyVec = { x: 0, y: 0 }; setKnob(0, 0); } };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    function move(e) {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy), max = 36;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      setKnob(dx, dy);
      joyVec = { x: Math.abs(dx) < 6 ? 0 : dx / max, y: Math.abs(dy) < 6 ? 0 : dy / max };
    }
  })();

  // ---------- 主循环 ----------
  let lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (!started) return;
    update(dt); draw(t);
  }
  requestAnimationFrame(loop);

  function update(dt) {
    if (inDialog() || !$('panel').classList.contains('hidden') || !$('battle-screen').classList.contains('hidden')) { player.moving = false; return; }
    let vx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0) + joyVec.x;
    let vy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0) + joyVec.y;
    const len = Math.hypot(vx, vy);
    player.moving = len > 0.15;
    if (player.moving) {
      vx /= Math.max(1, len); vy /= Math.max(1, len);
      const sp = 3.4;
      const nx = player.x + vx * sp * dt, ny = player.y + vy * sp * dt;
      if (!isSolid(nx, player.y)) player.x = nx;
      if (!isSolid(player.x, ny)) player.y = ny;
      S.pos = { x: player.x, y: player.y };
      // 脚步声涟漪
      stepAcc += dt;
      if (stepAcc > 0.28) { stepAcc = 0; ripples.push({ x: player.x, y: player.y, r: 0.2, a: 0.5 }); }
      // 半埋之城随机遇敌（取钟舌途中）
      if (encounterCd > 0) encounterCd -= dt;
      else if (S.stage === 2 && inCity(player.x, player.y) && Math.random() < dt * 0.16) {
        encounterCd = 8;
        toast('有东西循声而来——');
        setTimeout(() => Battle.start(Math.random() < 0.4 ? ['canxiang', 'canxiang'] : ['canxiang'], () => {}), 450);
      }
      // 阿忘窥见（一次性）
      if (S.stage === 2 && inCity(player.x, player.y) && player.y < 12 && !S.flags.awangSeen) {
        S.flags.awangSeen = true; say(DIALOGS.awang_sight); save();
      }
      // 阿迟相遇（旧驿道）
      if (S.stage === 4 && player.x > 57 && player.x < 60 && player.y > 34 && player.y < 38 && !S.flags.achiMet) {
        S.flags.achiMet = true;
        say(DIALOGS.achi_meet, () => {
          S.flags.achiUnlocked = true; S.crystals += 10;
          toast('序章完成！普通池新增「阿迟」，共鸣结晶 +10');
          setStage(5);
        });
      }
      // 初入灰线提示
      if (player.y < 3.4 && !S.flags.grayWarned) {
        S.flags.grayWarned = true; say(DIALOGS.grayline); save();
      }
    }
    ripples = ripples.filter(r => (r.r += dt * 1.6) < 1.6 && (r.a -= dt * 0.33) > 0);
  }

  // ---------- 绘制 ----------
  const ZONE_LABELS = [
    { x: 10, y: 29, t: '残 碑 原' }, { x: 35, y: 33.6, t: '守 碑 村' },
    { x: 57, y: 20.2, t: '半 埋 之 城' }, { x: 11, y: 46.4, t: '风 蚀 坡' },
    { x: 57, y: 33.4, t: '旧 驿 道' },
  ];
  function draw(t) {
    const VW = cv.width / TILE, VH = cv.height / TILE;
    const camX = Math.max(0, Math.min(TW - VW, player.x - VW / 2));
    const camY = Math.max(0, Math.min(TH - VH, player.y - VH / 2));
    ctx.fillStyle = '#101116'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let x = Math.floor(camX); x < Math.min(TW, camX + VW + 1); x++)
      for (let y = Math.floor(camY); y < Math.min(TH, camY + VH + 1); y++) {
        const sx = (x - camX) * TILE, sy = (y - camY) * TILE;
        ctx.drawImage(Sprites.tile(tileAt(x, y)), sx, sy);
      }
    // 灰线压迫感
    const grad = ctx.createLinearGradient(0, -camY * TILE, 0, (3 - camY) * TILE);
    grad.addColorStop(0, 'rgba(10,10,12,0.55)'); grad.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cv.width, Math.max(0, (3 - camY) * TILE));
    // 区域名
    ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
    for (const z of ZONE_LABELS) {
      const sx = (z.x - camX) * TILE, sy = (z.y - camY) * TILE;
      if (sx > -80 && sy > -20 && sx < cv.width + 80 && sy < cv.height + 20) {
        ctx.fillStyle = 'rgba(232,226,212,0.28)'; ctx.fillText(z.t, sx, sy);
      }
    }
    // 固体物（像素贴图，底部对齐）
    ctx.imageSmoothingEnabled = false;
    for (const s of SOLIDS) {
      const sx = (s.x - camX) * TILE, sy = (s.y - camY) * TILE;
      if (sx < -160 || sy < -160 || sx > cv.width + 80 || sy > cv.height + 80) continue;
      const img = Sprites.obj(s.kind, s.w, s.h);
      const dx = sx + (s.w * TILE - img.width) / 2;
      const dy = sy + s.h * TILE - img.height;
      ctx.drawImage(img, dx, dy);
    }
    // 涟漪（脚步声）
    for (const r of ripples) {
      ctx.strokeStyle = `rgba(201,214,238,${r.a})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc((r.x - camX) * TILE, (r.y - camY) * TILE, r.r * TILE, 0, 7); ctx.stroke();
    }
    // 交互对象
    for (const o of OBJS) {
      if (!objVisible(o)) continue;
      const sx = (o.x - camX) * TILE, sy = (o.y - camY) * TILE;
      if (sx < -40 || sy < -40 || sx > cv.width + 40 || sy > cv.height + 40) continue;
      if (o.glow) {
        ctx.strokeStyle = `rgba(255,217,138,${0.5 + 0.3 * Math.sin(t / 300)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 13 + 2 * Math.sin(t / 300), 0, 7); ctx.stroke();
      }
      let labelY = sy - 20;
      if (o.spr) {
        const img = Sprites.char(o.spr);
        const sc = 2 * Sprites.peopleScale(o.spr);
        const w = img.width * sc, h = img.height * sc;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(sx, sy + 12, 11, 4, 0, 0, 7); ctx.fill();
        ctx.drawImage(img, sx - w / 2, sy + 12 - h, w, h);
        labelY = sy + 12 - h - 6;
      } else {
        ctx.fillStyle = 'rgba(30,30,38,0.85)';
        ctx.beginPath(); ctx.arc(sx, sy, 13, 0, 7); ctx.fill();
        ctx.strokeStyle = o.color; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = o.color; ctx.font = '14px sans-serif'; ctx.fillText(o.glyph, sx, sy + 5);
      }
      const near = Math.hypot(o.x - player.x, o.y - player.y) < 1.8;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = near ? 'rgba(238,230,207,0.95)' : 'rgba(232,226,212,0.55)';
      ctx.fillText(near ? o.name + '（E）' : o.name, sx, labelY);
    }
    // 玩家（像素小人，走路时轻微起伏）
    const px = (player.x - camX) * TILE, py = (player.y - camY) * TILE;
    const pimg = Sprites.char('yuyin');
    const pw = pimg.width * 2.2, ph = pimg.height * 2.2;
    const bob = player.moving ? Math.abs(Math.sin(t / 110)) * 2.4 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(px, py + 13, 12, 4.4, 0, 0, 7); ctx.fill();
    ctx.drawImage(pimg, px - pw / 2, py + 13 - ph - bob, pw, ph);
  }

  // ---------- 启动 ----------
  function startGame(fresh) {
    if (fresh) { S = newState(); player.x = S.pos.x; player.y = S.pos.y; save(); }
    $('title-screen').classList.add('hidden');
    $('game-screen').classList.remove('hidden');
    started = true; updateHUD();
    if (fresh) setTimeout(() => say(DIALOGS.intro), 350);
  }
  $('btn-new').addEventListener('click', () => {
    if (hasSave() && !confirm('已有存档。开新纪元会覆盖它，确定吗？')) return;
    startGame(true);
  });
  $('btn-continue').addEventListener('click', () => {
    if (load()) { startGame(false); toast('读取存档：第六纪元，继续。'); }
    else toast('还没有存档。');
  });
  if (!hasSave()) $('btn-continue').style.opacity = 0.45;
  $('btn-gacha').addEventListener('click', () => Gacha.open());
  $('btn-party').addEventListener('click', () => Gacha.openParty());
  $('btn-save').addEventListener('click', () => { S.pos = { x: player.x, y: player.y }; save(); toast('已存档。世界记得你。'); });

  return {
    get state() { return S; },
    getParty, gainRewards, updateHUD, save, toast, modal, showPanel, respawnAtVillage,
  };
})();
