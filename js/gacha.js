// 回声大陆 v0.1 · 共鸣（抽卡）+ 队伍编成
// 规则（设定集已定）：单机、无限定池；乐魂含本体共 7 份封顶；满乐魂溢出转回声碎片；地区角色须完成当地主线且身在当地（v0.1 仅普通池）。

const Gacha = (() => {
  const $ = id => document.getElementById(id);
  const GUARANTEE_5 = 60; // 暂定保底：60 抽必出五星 / 专武（正式数值待定）
  let curTab = 'char';

  function open() {
    Game.showPanel('共 鸣', renderPool());
    bindPool();
  }

  function availablePool() {
    return POOL.filter(p => !p.needFlag || Game.state.flags[p.needFlag]);
  }

  function rollOne() {
    const weaponTab = curTab === 'weapon';
    const pool = weaponTab ? WPOOL : availablePool();
    const st = Game.state;
    st.pullsSince5 = (st.pullsSince5 || 0) + 1;
    let entry;
    const isTop = p => weaponTab ? p.kind === 'weapon' : (p.kind === 'char' && CHARACTERS[p.id].star === 5);
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
      const owned = st.chars[entry.id] || 0;
      if (owned === 0) {
        st.chars[entry.id] = 1;
        return { star: c.star, glyph: c.glyph, img: Sprites.url(entry.id, 3), name: c.name, tag: c.star + '星 · 新同伴！' };
      }
      if (owned < 7) {
        st.chars[entry.id] = owned + 1;
        return { star: c.star, glyph: c.glyph, img: Sprites.url(entry.id, 3), name: c.name, tag: c.star + '星 · 乐魂 ' + owned + '→' + (owned + 1) + '（共7份封顶）' };
      }
      st.shards += 5;
      return { star: c.star, glyph: c.glyph, img: Sprites.url(entry.id, 3), name: c.name, tag: '乐魂已满 · 转回声碎片 ×5' };
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
    st.items[entry.id] = (st.items[entry.id] || 0) + entry.amt;
    return { star: 0, glyph: entry.glyph, name: entry.label, tag: '物资' };
  }

  function pull(n) {
    const st = Game.state;
    if (st.crystals < n) { Game.toast('共鸣结晶不够（需要 ' + n + '，现有 ' + st.crystals + '）。探索、支线和主线都会产出。'); return; }
    st.crystals -= n;
    const results = [];
    for (let i = 0; i < n; i++) results.push(rollOne());
    Game.updateHUD(); Game.save();
    $('panel-body').innerHTML = renderPool(results);
    bindPool();
  }

  function tabsHtml() {
    return `<div class="gacha-btns">
      <button class="act-btn" id="tab-char" ${curTab === 'char' ? 'style="border-color:#c9a86a;color:#ffd98a"' : ''}>角色池</button>
      <button class="act-btn" id="tab-weapon" ${curTab === 'weapon' ? 'style="border-color:#c9a86a;color:#ffd98a"' : ''}>专武池（独立）</button>
    </div>`;
  }
  function resultsHtml(results) {
    if (!results) return '';
    return '<h4>本次共鸣</h4><div class="pull-results">' + results.map(r =>
      `<div class="pull-card r${r.star}"><div class="pc-ava">${r.img ? `<img src="${r.img}" alt="">` : r.glyph}</div><div class="pc-name">${r.name}</div><div class="pc-tag">${r.tag}</div></div>`).join('') + '</div>';
  }
  function pullBtnsHtml(st) {
    return `<div class="pool-info">共鸣结晶：<b style="color:#eee6cf">${st.crystals}</b> · 距保底还有 ${GUARANTEE_5 - (st.pullsSince5 || 0)} 抽</div>
      <div class="gacha-btns">
        <button class="act-btn" id="pull1">共鸣 ×1（1 结晶）</button>
        <button class="act-btn" id="pull10">共鸣 ×10（10 结晶）</button>
      </div>`;
  }

  function renderPool(results) {
    const st = Game.state;
    if (curTab === 'weapon') {
      const wlist = Object.values(WEAPONS).map(w => {
        const lvl = (st.weapons || {})[w.id] || 0;
        return `<div class="pull-card r5"><div class="pc-ava"><img src="${Sprites.url(w.owner, 3)}" alt=""></div><div class="pc-name">${w.name}</div><div class="pc-tag">${CHARACTERS[w.owner].name} 专武${lvl ? ' · 精炼 ' + lvl : ''}</div></div>`;
      }).join('');
      return tabsHtml() + `<div class="pool-info">专武池（独立常驻池）— 专武 9% / 物资 91%。只有五星角色有专武；抽到即自动装备给本人，重复转为精炼（上限 5 阶，每阶放大效果），满阶溢出转回声碎片 ×8。</div>`
        + pullBtnsHtml(st) + resultsHtml(results)
        + '<h4>池中专武</h4><div class="pull-results">' + wlist + '</div>';
    }
    const list = Object.values(CHARACTERS).map(c => {
      const gated = c.id === 'achi' && !st.flags.achiUnlocked;
      return `<div class="pull-card r${c.star}"><div class="pc-ava"><img src="${Sprites.url(c.id, 3)}" alt="${c.name}"></div><div class="pc-name">${c.name}</div><div class="pc-tag">${c.star}星${gated ? ' · 未解锁（序章后）' : ''}</div></div>`;
    }).join('');
    let html = tabsHtml() + `<div class="pool-info">普通池（常驻 · 无限定）— 五星 6% / 四星 24% / 物资 70% · ${GUARANTEE_5} 抽保底五星（暂定）<br>
      共鸣召回的是他们的「声之回声」：本人还在过自己的日子，回声与你同行。重复回声叠成乐魂（含本体共 7 份），满了转回声碎片。</div>`
      + pullBtnsHtml(st)
      + resultsHtml(results);
    html += '<h4>池中回声</h4><div class="pull-results">' + list + '</div>';
    return html;
  }

  function bindPool() {
    const p1 = $('pull1'), p10 = $('pull10');
    if (p1) p1.onclick = () => pull(1);
    if (p10) p10.onclick = () => pull(10);
    const tc = $('tab-char'), tw = $('tab-weapon');
    if (tc) tc.onclick = () => { curTab = 'char'; $('panel-body').innerHTML = renderPool(); bindPool(); };
    if (tw) tw.onclick = () => { curTab = 'weapon'; $('panel-body').innerHTML = renderPool(); bindPool(); };
  }

  // ---------- 队伍 ----------
  function openParty() {
    const st = Game.state;
    const weaponLine = cid => {
      const w = Object.values(WEAPONS).find(x => x.owner === cid);
      if (!w) return '';
      const lvl = (st.weapons || {})[w.id] || 0;
      return `<div class="rr-sub">${lvl ? '专武：<span style="color:#ffd98a">' + w.name + '（精炼 ' + lvl + '）</span> — ' + w.desc : '专武：' + w.name + '（未获得，去共鸣的专武池）'}</div>`;
    };
    const selfRow = `<div class="roster-row">
        <div><span class="rr-name" style="color:${CHARACTERS.yuyin.color}">律 余音之子</span> <span class="rr-sub">主角 · 历代回声（乐魂）${st.chars.yuyin || 0}/7</span>
        <div class="rr-sub">他在池中抽到的每一份自己，都是他的一份乐魂，直接让他自己变强（每份 +6%）。</div>${weaponLine('yuyin')}</div>
        <span class="rr-sub">始终在队</span>
      </div>`;
    const rows = selfRow + Object.keys(st.chars).filter(id => id !== 'yuyin').map(id => {
      const c = CHARACTERS[id];
      const inParty = st.party.includes(id);
      const soul = st.chars[id];
      return `<div class="roster-row">
        <div><span class="rr-name" style="color:${c.color}">${c.glyph} ${c.name}</span> <span class="rr-sub">${c.star}星 · 乐魂 ${soul}/7</span>
        <div class="rr-sub">${c.desc}</div>
        <div class="rr-sub">技能：${c.skill.name} — ${c.skill.desc}</div>${weaponLine(id)}</div>
        <button data-char="${id}">${inParty ? '撤下' : '同行'}</button>
      </div>`;
    }).join('');
    Game.showPanel('队 伍', `
      <div class="pool-info">余音之子始终在队。另可带 2 名回声同行（当前 ${st.party.length}/2）。乐魂越高，同伴越强（每份乐魂 +6% 攻击与生命）。</div>
      <h4>已召回的回声</h4>${rows || '<div class="pool-info">还没有同伴。去碑前共鸣一次吧。</div>'}`);
    document.querySelectorAll('#panel-body [data-char]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.char;
      const st2 = Game.state;
      if (st2.party.includes(id)) st2.party = st2.party.filter(x => x !== id);
      else {
        if (st2.party.length >= 2) { Game.toast('同行名额满了（2 名）。先撤下一位。'); return; }
        st2.party.push(id);
      }
      Game.save(); openParty();
    });
  }

  return { open, openParty };
})();
