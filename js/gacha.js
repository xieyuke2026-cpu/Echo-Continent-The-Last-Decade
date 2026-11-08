// 回声大陆 v0.1 · 共鸣（抽卡）+ 队伍编成
// 规则（设定集已定）：单机、无限定池；乐魂含本体共 7 份封顶；满乐魂溢出转回声碎片；地区角色须完成当地主线且身在当地（v0.1 仅普通池）。

const Gacha = (() => {
  const $ = id => document.getElementById(id);
  const GUARANTEE_5 = 60; // v0.1 暂定保底：60 抽必出五星（正式数值待定）

  function open() {
    Game.showPanel('共 鸣', renderPool());
    bindPool();
  }

  function availablePool() {
    return POOL.filter(p => !p.needFlag || Game.state.flags[p.needFlag]);
  }

  function rollOne() {
    const pool = availablePool();
    const st = Game.state;
    st.pullsSince5 = (st.pullsSince5 || 0) + 1;
    let entry;
    if (st.pullsSince5 >= GUARANTEE_5) {
      const fives = pool.filter(p => p.kind === 'char' && CHARACTERS[p.id].star === 5);
      entry = fives[Math.floor(Math.random() * fives.length)];
      st.pullsSince5 = 0;
    } else {
      const total = pool.reduce((s, p) => s + p.w, 0);
      let r = Math.random() * total;
      entry = pool[pool.length - 1];
      for (const p of pool) { r -= p.w; if (r <= 0) { entry = p; break; } }
      if (entry.kind === 'char' && CHARACTERS[entry.id].star === 5) st.pullsSince5 = 0;
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

  function renderPool(results) {
    const st = Game.state;
    const list = Object.values(CHARACTERS).map(c => {
      const gated = c.id === 'achi' && !st.flags.achiUnlocked;
      return `<div class="pull-card r${c.star}"><div class="pc-ava"><img src="${Sprites.url(c.id, 3)}" alt="${c.name}"></div><div class="pc-name">${c.name}</div><div class="pc-tag">${c.star}星${gated ? ' · 未解锁（序章后）' : ''}</div></div>`;
    }).join('');
    let html = `<div class="pool-info">普通池（常驻 · 无限定）— 五星 6% / 四星 24% / 物资 70% · ${GUARANTEE_5} 抽保底五星（v0.1 暂定）<br>
      共鸣结晶：<b style="color:#eee6cf">${st.crystals}</b> · 距保底还有 ${GUARANTEE_5 - (st.pullsSince5 || 0)} 抽<br>
      共鸣召回的是他们的「声之回声」：本人还在过自己的日子，回声与你同行。重复回声叠成乐魂（含本体共 7 份），满了转回声碎片。</div>
      <div class="gacha-btns">
        <button class="act-btn" id="pull1">共鸣 ×1（1 结晶）</button>
        <button class="act-btn" id="pull10">共鸣 ×10（10 结晶）</button>
      </div>`;
    if (results) {
      html += '<h4>本次共鸣</h4><div class="pull-results">' + results.map(r =>
        `<div class="pull-card r${r.star}"><div class="pc-ava">${r.img ? `<img src="${r.img}" alt="">` : r.glyph}</div><div class="pc-name">${r.name}</div><div class="pc-tag">${r.tag}</div></div>`).join('') + '</div>';
    }
    html += '<h4>池中回声</h4><div class="pull-results">' + list + '</div>';
    return html;
  }

  function bindPool() {
    const p1 = $('pull1'), p10 = $('pull10');
    if (p1) p1.onclick = () => pull(1);
    if (p10) p10.onclick = () => pull(10);
  }

  // ---------- 队伍 ----------
  function openParty() {
    const st = Game.state;
    const selfRow = `<div class="roster-row">
        <div><span class="rr-name" style="color:${CHARACTERS.yuyin.color}">律 余音之子</span> <span class="rr-sub">主角 · 历代回声（乐魂）${st.chars.yuyin || 0}/7</span>
        <div class="rr-sub">他在池中抽到的每一份自己，都是他的一份乐魂，直接让他自己变强（每份 +6%）。</div></div>
        <span class="rr-sub">始终在队</span>
      </div>`;
    const rows = selfRow + Object.keys(st.chars).filter(id => id !== 'yuyin').map(id => {
      const c = CHARACTERS[id];
      const inParty = st.party.includes(id);
      const soul = st.chars[id];
      return `<div class="roster-row">
        <div><span class="rr-name" style="color:${c.color}">${c.glyph} ${c.name}</span> <span class="rr-sub">${c.star}星 · 乐魂 ${soul}/7</span>
        <div class="rr-sub">${c.desc}</div>
        <div class="rr-sub">技能：${c.skill.name} — ${c.skill.desc}</div></div>
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
