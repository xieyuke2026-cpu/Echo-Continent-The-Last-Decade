// 回声大陆 v0.4 · 共鸣（角色池/专武池）与队伍界面（全屏）
const Gacha = (() => {
  const $ = id => document.getElementById(id);
  const GUARANTEE_5 = 60; // 暂定保底：60 抽必出五星 / 专武（正式数值待定）
  let curTab = 'char';
  let curChar = 'yuyin';

  /* ================= 共鸣 ================= */
  function open() {
    renderGacha(null);
    $('gacha-screen').classList.remove('hidden');
  }
  function close() { $('gacha-screen').classList.add('hidden'); }

  function availablePool() {
    return POOL.filter(p => !p.needFlag || Game.state.flags[p.needFlag]);
  }

  function rollOne() {
    const weaponTab = curTab === 'weapon';
    const pool = weaponTab ? WPOOL : availablePool();
    const st = Game.state;
    st.pullsSince5 = (st.pullsSince5 || 0) + 1;
    const isTop = p => weaponTab ? p.kind === 'weapon' : (p.kind === 'char' && CHARACTERS[p.id].star === 5);
    let entry;
    if (st.pullsSince5 >= GUARANTEE_5) {
      const fives = pool.filter(isTop);
      entry = fives[Math.floor(Math.random() * fives.length)];
      st.pullsSince5 = 0;
    } else {
      const total = pool.reduce((s, p) => s + p.w, 0);
      let r = Math.random() * total;
      entry = pool[pool.length - 1];
      for (const p of pool) { r -= p.w; if (r <= 0) { entry = p; break; } }
      if (isTop(entry)) st.pullsSince5 = 0;
    }
    return apply(entry);
  }

  function apply(entry) {
    const st = Game.state;
    if (entry.kind === 'char') {
      const c = CHARACTERS[entry.id];
      const cur = st.chars[entry.id] || 0;
      if (entry.id === 'yuyin') {
        if (cur < 7) { st.chars.yuyin = cur + 1; return { star: 5, img: Sprites.url('yuyin', 3), name: '余音之子（历代回声）', tag: `乐魂 ${cur} → ${cur + 1} · 他自己的回声，也算他的乐魂` }; }
        st.shards += 12;
        return { star: 5, img: Sprites.url('yuyin', 3), name: '余音之子（回声）', tag: '乐魂已满 · 转回声碎片 ×12' };
      }
      if (cur === 0) {
        st.chars[entry.id] = 1;
        if (entry.id !== 'achi' && !st.party.includes(entry.id) && st.party.length < 2) st.party.push(entry.id);
        return { star: c.star, img: Sprites.url(entry.id, 3), name: c.name, tag: c.star + '星 · 新的回声加入' };
      }
      if (cur < 7) { st.chars[entry.id] = cur + 1; return { star: c.star, img: Sprites.url(entry.id, 3), name: c.name, tag: `乐魂 ${cur} → ${cur + 1}（每份 +6%）` }; }
      st.shards += 12;
      return { star: c.star, img: Sprites.url(entry.id, 3), name: c.name, tag: '乐魂已满 · 转回声碎片 ×12' };
    }
    if (entry.kind === 'weapon') {
      const w = WEAPONS[entry.id];
      st.weapons = st.weapons || {};
      const lvl = st.weapons[entry.id] || 0;
      const img = Sprites.url(w.owner, 3);
      if (lvl === 0) { st.weapons[entry.id] = 1; return { star: 5, glyph: w.glyph, img, name: w.name, tag: '专武 · ' + CHARACTERS[w.owner].name + ' 专用' }; }
      if (lvl < 5) { st.weapons[entry.id] = lvl + 1; return { star: 5, glyph: w.glyph, img, name: w.name, tag: '专武精炼 ' + lvl + ' → ' + (lvl + 1) + '（上限 5 阶）' }; }
      st.shards += 8;
      return { star: 5, glyph: w.glyph, img, name: w.name, tag: '精炼已满 · 转回声碎片 ×8' };
    }
    if (entry.kind === 'coins') { st.coins += entry.amt; return { star: 0, glyph: entry.glyph, name: entry.label, tag: '物资' }; }
    if (entry.kind === 'shard') { st.shards += entry.amt; return { star: 0, glyph: entry.glyph, name: entry.label, tag: '物资' }; }
    if (entry.kind === 'item') { st.items[entry.id] = (st.items[entry.id] || 0) + entry.amt; return { star: 0, glyph: entry.glyph, name: entry.label, tag: '物资' }; }
    return { star: 0, glyph: '?', name: '?', tag: '' };
  }

  function pull(n) {
    const st = Game.state;
    if (st.crystals < n) { Game.toast(`共鸣结晶不够（有 ${st.crystals}，需要 ${n}）。始鸣晶可在主角面板兑换。`); return; }
    st.crystals -= n;
    const results = [];
    for (let i = 0; i < n; i++) results.push(rollOne());
    Game.save(); Game.refreshHud();
    renderGacha(results);
    Game.toast(n === 10 ? '十次共鸣，回声们一起应声。' : '一次共鸣，有回声应了你。');
  }

  function cardHtml(r) {
    return `<div class="pull-card r${r.star}"><div class="pc-ava">${r.img ? `<img src="${r.img}" alt="">` : r.glyph}</div><div class="stars">${r.star ? '★'.repeat(r.star) : ''}</div><div class="pc-name">${r.name}</div><div class="pc-tag">${r.tag}</div></div>`;
  }

  function renderGacha(results) {
    const st = Game.state;
    $('gacha-crystals').textContent = st.crystals;
    $('tab-char').classList.toggle('on', curTab === 'char');
    $('tab-weapon').classList.toggle('on', curTab === 'weapon');
    $('gacha-pity').innerHTML = `距保底还有 <b>${GUARANTEE_5 - (st.pullsSince5 || 0)}</b> 抽 · 结晶 <b>${st.crystals}</b>`;
    if (curTab === 'char') {
      $('gacha-hero-art').innerHTML = ['xianwai', 'yuyin', 'achi'].map(id => `<img src="${Sprites.url(id, 8)}" alt="">`).join('');
      $('gacha-pool-name').textContent = '普通池 · 常 驻';
      $('gacha-pool-desc').innerHTML = '五星 6% / 四星 24% / 物资 70% · 无限定，全部常驻。<br>共鸣召回的是他们的「声之回声」——本人还在过自己的日子，回声与你同行。重复回声叠成乐魂（含本体共 7 份），满了转回声碎片。';
      $('gacha-list').innerHTML = '<div class="sec-label">池 中 回 声</div><div class="pull-results">' + Object.values(CHARACTERS).map(c => {
        const gated = c.id === 'achi' && !st.flags.achiUnlocked;
        return cardHtml({ star: c.star, img: Sprites.url(c.id, 3), name: c.name, tag: gated ? '序章之后解锁' : (st.chars[c.id] ? '乐魂 ' + st.chars[c.id] + '/7' : '尚未共鸣') });
      }).join('') + '</div>';
    } else {
      $('gacha-hero-art').innerHTML = Object.values(WEAPONS).map(w => `<div class="wicon">${w.glyph}</div>`).join('');
      $('gacha-pool-name').textContent = '专武池 · 独 立';
      $('gacha-pool-desc').innerHTML = '专武 9% / 物资 91%。只有五星角色有专武。<br>抽到即自动装备给本人；重复转为精炼（上限 5 阶，每阶放大效果）；满阶溢出转回声碎片 ×8。';
      $('gacha-list').innerHTML = '<div class="sec-label">池 中 专 武</div><div class="pull-results">' + Object.values(WEAPONS).map(w => {
        const lvl = (st.weapons || {})[w.id] || 0;
        return cardHtml({ star: 5, img: Sprites.url(w.owner, 3), name: w.name, tag: CHARACTERS[w.owner].name + ' 专武' + (lvl ? ' · 精炼 ' + lvl : ' · 未获得') });
      }).join('') + '</div>';
    }
    $('gacha-results').innerHTML = results ? '<div class="sec-label">本 次 共 鸣</div><div class="pull-results">' + results.map(cardHtml).join('') + '</div>' : '';
    $('pull1').onclick = () => pull(1);
    $('pull10').onclick = () => pull(10);
    $('tab-char').onclick = () => { curTab = 'char'; renderGacha(null); };
    $('tab-weapon').onclick = () => { curTab = 'weapon'; renderGacha(null); };
    $('gacha-close').onclick = close;
  }

  /* ================= 队伍 ================= */
  function openParty() {
    if (!Game.state.chars[curChar] && curChar !== 'yuyin') curChar = 'yuyin';
    renderParty();
    $('party-screen').classList.remove('hidden');
  }
  function closeParty() { $('party-screen').classList.add('hidden'); }

  function pips(n, total) {
    return '<span class="pips">' + Array.from({ length: total }, (_, i) => `<span class="pip ${i < n ? 'on' : ''}"></span>`).join('') + '</span>';
  }

  function renderParty() {
    const st = Game.state;
    const ids = ['yuyin', ...Object.keys(CHARACTERS).filter(id => id !== 'yuyin' && st.chars[id])];
    $('party-list').innerHTML = ids.map(id => {
      const c = CHARACTERS[id];
      const inParty = id === 'yuyin' || st.party.includes(id);
      return `<div class="party-row ${id === curChar ? 'sel' : ''}" data-cid="${id}">
        <div class="pr-ava"><img src="${Sprites.url(id, 3)}" alt=""></div>
        <div><div class="pr-name">${c.name}</div><div class="pr-sub">${'★'.repeat(c.star)} · 乐魂 ${st.chars[id] || (id === 'yuyin' ? 0 : 0)}/7</div></div>
        ${inParty ? '<span class="pr-in">同行中</span>' : ''}
      </div>`;
    }).join('');
    document.querySelectorAll('.party-row').forEach(el => el.onclick = () => { curChar = el.dataset.cid; renderParty(); });
    $('party-close').onclick = closeParty;

    const c = CHARACTERS[curChar];
    const ps = Game.previewStats(curChar);
    const w = Object.values(WEAPONS).find(x => x.owner === curChar);
    const wlvl = w ? (st.weapons || {})[w.id] || 0 : 0;
    const inParty = curChar === 'yuyin' || st.party.includes(curChar);
    $('party-detail').innerHTML = `
      <div class="d-top">
        <div class="d-ava"><img src="${Sprites.url(curChar, 8)}" alt=""></div>
        <div style="flex:1;min-width:230px">
          <div class="d-name">${c.name}</div>
          <div class="d-title">${c.title}</div>
          <div class="d-stars">${'★'.repeat(c.star)}</div>
          <div class="d-desc">${c.desc}</div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-box"><div class="sb-k">生命（当前编成）</div><div class="sb-v">${ps.hp}</div></div>
        <div class="stat-box"><div class="sb-k">攻击</div><div class="sb-v">${ps.atk}</div></div>
        <div class="stat-box"><div class="sb-k">乐魂</div><div class="sb-v" style="font-size:15px">${st.chars[curChar] || 0} / 7 ${pips(st.chars[curChar] || 0, 7)}</div></div>
      </div>
      <div class="d-sec"><h5>技 能</h5><p><b>${c.skill.name}</b> — ${c.skill.desc}</p></div>
      ${w ? `<div class="d-sec"><h5>专 武</h5><p><b style="color:var(--gold)">${w.name}</b>${wlvl ? ' · 精炼 ' + wlvl + ' / 5 ' + pips(wlvl, 5) : ' · 未获得（共鸣 → 专武池）'}<br>${w.desc}</p></div>` : '<div class="d-sec"><h5>专 武</h5><p>四星角色没有专武。</p></div>'}
      ${curChar === 'yuyin'
        ? '<button class="deploy-btn off" disabled>主角 · 始终在队</button>'
        : `<button class="deploy-btn ${inParty ? 'off' : ''}" id="deploy-btn">${inParty ? '移出队伍' : '编入队伍（同行 ' + st.party.length + '/2）'}</button>`}`;
    const db = $('deploy-btn');
    if (db) db.onclick = () => { toggleParty(curChar); renderParty(); };
  }

  function toggleParty(id) {
    const st = Game.state;
    if (st.party.includes(id)) { st.party = st.party.filter(x => x !== id); Game.toast(CHARACTERS[id].name + ' 留在原地——她的回声散回风里。'); }
    else {
      if (st.party.length >= 2) { Game.toast('同行已满（主角 + 2 人）。先移出一位。'); return; }
      st.party.push(id); Game.toast(CHARACTERS[id].name + ' 的回声与你同行。');
    }
    Game.save();
  }

  return { open, openParty };
})();
