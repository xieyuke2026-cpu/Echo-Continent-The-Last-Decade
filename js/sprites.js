// 回声大陆 · 像素美术层：人物精灵 / 地形贴图 / 建筑物件，全部程序绘制（无外部图片）
// 人物为 16×18 像素小人，按调色板换装；敌人另有专用图。

const Sprites = (() => {
  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
    const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
    const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
    return `rgb(${r},${g},${b})`;
  }

  // ---------- 人物 ----------
  // 基础小人体型图：H 发 / S 肤 / E 眼 / R 袍 / D 袍影 / B 腰带饰 / F 鞋 / W 木
  const BODY = [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '....HSSSSSSH....',
    '....HSESSESH....',
    '....HSSSSSSH....',
    '.....SSSSSS.....',
    '......SSSS......',
    '....RRRRRRRR....',
    '...RRRRRRRRRR...',
    '..SRRRBBBBRRRS..',
    '..SRRRRRRRRRRS..',
    '....RRRRRRRR....',
    '....RRR..RRR....',
    '....RRR..RRR....',
    '....DDD..DDD....',
    '...FFFF..FFFF...',
    '................',
  ];
  const SKIN = '#e8b98d', EYE = '#26241f', SHOE = '#3a3428';
  const PEOPLE = {
    yuyin:    { pal: { H: '#2e2a26', R: '#e6ddc4', D: '#b7ac8e', B: '#c9a86a' } },
    achi:     { pal: { H: '#3a3f4d', R: '#5a6b8a', D: '#42506a', B: '#d8d2c0' },
                over: [[5,8,'B'],[6,9,'B'],[7,10,'B'],[8,11,'B'],[12,11,'B'],[13,11,'B'],[12,12,'B'],[13,12,'B']] },
    xianwai:  { pal: { H: '#6a4a3a', R: '#a85f38', D: '#7d4526', B: '#e8c97a' } },
    modan:    { pal: { H: '#2e3328', R: '#5a6650', D: '#424c3a', B: '#31382b' } },
    elder:    { pal: { H: '#cfd0d4', R: '#6a5a4a', D: '#4c4034', B: '#3e362c' },
                over: [[7,0,'H'],[8,0,'H'],[14,9,'W'],[14,10,'W'],[14,11,'W'],[14,12,'W'],[14,13,'W'],[14,14,'W'],[14,15,'W'],[14,16,'W']] },
    villagerA:{ pal: { H: '#26241f', R: '#7a7568', D: '#5a564c', B: '#4c4a41' } },
    villagerB:{ pal: { H: '#4a3626', R: '#7d9a72', D: '#5c7354', B: '#e8c97a' }, scale: 0.86,
                over: [[4,0,'H'],[5,0,'H'],[10,0,'H'],[11,0,'H']] },
    shisheng: { pal: { H: '#b89a5a', R: '#8a6a48', D: '#665034', B: '#4c3a24' },
                over: [[2,1,'H'],[3,1,'H'],[12,1,'H'],[13,1,'H'],[4,2,'H'],[11,2,'H']] },
  };
  const ENEMY_ART = {
    canxiang: { pal: { H: '#3c3d49', S: '#b9bcc4', R: '#4a4b58', D: '#33343e', B: '#26272f' },
                over: [[7,5,'E'],[8,5,'E'],[5,11,'.'],[10,13,'.'],[6,14,'.']] },
  };
  const WUWO_MAP = [
    '......HHHHHH........',
    '....HHHHHHHHHH......',
    '...HHSSSSSSSSHH.....',
    '...HSESESSESESH.....',
    '...HSSSSSSSSSSH.....',
    '...HSSMMSSMMSSH.....',
    '....SSSSSSSSSS......',
    '..RRRRRRRRRRRRRR....',
    '.RRRRRRRRRRRRRRRR...',
    '.SRRRRRRRRRRRRRRS...',
    '.SRRRRRRRRRRRRRRS...',
    '..RRRRRRRRRRRRRR....',
    '..RRRRRRRRRRRRRR....',
    '..RRRR.RRRR.RRRR....',
    '..RRRR.RRRR.RRRR....',
    '..DDDD.DDDD.DDDD....',
    '..FFFF.FFFF.FFFF....',
    '....................',
  ];

  function paintMap(map, pal, over) {
    const w = map[0].length, h = map.length;
    const grid = map.map(r => r.split(''));
    if (over) for (const [x, y, ch] of over) if (grid[y] && grid[y][x] !== undefined) grid[y][x] = ch;
    const c = cnv(w, h), g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (ch === '.') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x, y, 1, 1);
    }
    return c;
  }
  function fullPal(p) {
    return { H: p.H, S: p.S || SKIN, E: EYE, R: p.R, D: p.D, B: p.B, F: SHOE, W: '#7a5c38', M: '#101116' };
  }
  const charCache = {};
  function char(name) {
    if (charCache[name]) return charCache[name];
    let c;
    if (name === 'wuwo') c = paintMap(WUWO_MAP, fullPal({ H: '#33343e', S: '#a9abb4', R: '#3a3b47', D: '#2a2b34', B: '#22232b' }));
    else if (ENEMY_ART[name]) { const d = ENEMY_ART[name]; c = paintMap(BODY, fullPal(d.pal), d.over); }
    else { const d = PEOPLE[name] || PEOPLE.villagerA; c = paintMap(BODY, fullPal(d.pal), d.over); }
    charCache[name] = c;
    return c;
  }
  function url(name, scale) {
    const src = char(name);
    const s = scale || 5;
    const c = cnv(src.width * s, src.height * s), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL();
  }

  // ---------- 地形贴图（32×32 程序像素） ----------
  const tileCache = {};
  function tile(kind) {
    if (tileCache[kind]) return tileCache[kind];
    const bases = { ash: '#403e34', dirt: '#54493a', field: '#5c573c', ruin: '#3a3942', road: '#5a5040', slope: '#4c4a3e', gray: '#2a2a28', void: '#101116' };
    const c = cnv(32, 32), g = c.getContext('2d');
    const base = bases[kind] || '#403e34';
    const rand = rng(kind.length * 7919 + 131);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      g.fillStyle = shade(base, 0.92 + rand() * 0.16);
      g.fillRect(x, y, 1, 1);
    }
    if (kind === 'field') {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 3; y < 32; y += 6) g.fillRect(0, y, 32, 2);
      g.fillStyle = 'rgba(232,201,122,0.5)';
      for (let i = 0; i < 26; i++) g.fillRect(Math.floor(rand() * 32), Math.floor(rand() * 32), 1, 2);
    } else if (kind === 'road') {
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 10, 32, 12);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let i = 0; i < 10; i++) g.fillRect(Math.floor(rand() * 30), Math.floor(rand() * 30), 2, 2);
    } else if (kind === 'ruin') {
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(4, 20); g.lineTo(14, 12); g.lineTo(22, 18); g.stroke();
      g.fillStyle = 'rgba(143,163,199,0.14)';
      for (let i = 0; i < 8; i++) g.fillRect(Math.floor(rand() * 29), Math.floor(rand() * 29), 3, 2);
    } else if (kind === 'gray') {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 12; i++) g.fillRect(Math.floor(rand() * 32), Math.floor(rand() * 32), 1, 1);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i < 9; i++) g.fillRect(Math.floor(rand() * 31), Math.floor(rand() * 31), 2, 1);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 7; i++) g.fillRect(Math.floor(rand() * 32), Math.floor(rand() * 32), 1, 1);
    }
    tileCache[kind] = c;
    return c;
  }

  // ---------- 建筑 / 物件 ----------
  const objCache = {};
  function obj(kind, w, h) {
    const key = kind + '_' + w + 'x' + h;
    if (objCache[key]) return objCache[key];
    let c;
    if (kind === 'house') {
      const W = w * 32, H = h * 32 + 16;
      c = cnv(W, H); const g = c.getContext('2d');
      g.fillStyle = '#6b5d49'; g.fillRect(4, 16, W - 8, H - 16);
      g.fillStyle = 'rgba(0,0,0,0.15)';
      for (let x = 10; x < W - 8; x += 14) g.fillRect(x, 16, 2, H - 16);
      g.fillStyle = '#3f4a56';
      g.beginPath(); g.moveTo(0, 18); g.lineTo(W / 2, 0); g.lineTo(W, 18); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 16, W, 3);
      g.fillStyle = '#2e2a22'; g.fillRect(W / 2 - 6, H - 24, 12, 24);
      g.fillStyle = '#e8c97a'; g.fillRect(10, 26, 7, 7); g.fillRect(W - 17, 26, 7, 7);
    } else if (kind === 'tower') {
      c = cnv(64, 128); const g = c.getContext('2d');
      g.fillStyle = '#57503f'; g.fillRect(10, 22, 44, 106);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 30; y < 128; y += 10) g.fillRect(10, y, 44, 2);
      g.fillStyle = '#333c46'; g.beginPath(); g.moveTo(4, 24); g.lineTo(32, 2); g.lineTo(60, 24); g.closePath(); g.fill();
      g.fillStyle = '#241f16'; g.fillRect(20, 34, 24, 30);
      g.fillStyle = '#c9a86a'; g.beginPath(); g.arc(32, 52, 9, 0, 7); g.fill();
      g.fillStyle = '#8a744a'; g.fillRect(30, 40, 4, 5);
      g.fillStyle = '#241f16'; g.fillRect(25, 96, 14, 32);
    } else if (kind === 'wall') {
      c = cnv(w * 32, h * 32); const g = c.getContext('2d');
      const rand = rng(w * 31 + h * 57);
      for (let y = 0; y < h * 32; y++) for (let x = 0; x < w * 32; x++) {
        g.fillStyle = shade('#4c4a58', 0.9 + rand() * 0.2); g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = 'rgba(0,0,0,0.28)';
      for (let x = 0; x < w * 32; x += 16) g.fillRect(x, 0, 2, h * 32);
      g.fillRect(0, 14, w * 32, 2);
      g.fillStyle = 'rgba(16,17,22,0.85)';
      for (let x = 0; x < w * 32; x++) { const d = Math.floor(rand() * 6); if (d > 0) g.fillRect(x, 0, 1, d); }
    } else if (kind === 'stele') {
      c = cnv(24, 48); const g = c.getContext('2d');
      g.fillStyle = '#5d5e68'; g.fillRect(3, 4, 18, 44);
      g.fillStyle = '#4c4d57'; g.fillRect(3, 4, 18, 5);
      g.fillStyle = 'rgba(232,226,212,0.5)';
      const rand = rng(42);
      for (let i = 0; i < 14; i++) g.fillRect(8 + Math.floor(rand() * 8), 12 + i * 2.4, 2, 1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(3, 44, 18, 4);
    } else if (kind === 'well') {
      c = cnv(32, 28); const g = c.getContext('2d');
      g.fillStyle = '#4e5a68'; g.beginPath(); g.ellipse(16, 15, 13, 9, 0, 0, 7); g.fill();
      g.fillStyle = '#131a24'; g.beginPath(); g.ellipse(16, 14, 9, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#3d4a5a'; g.fillRect(2, 4, 3, 10); g.fillRect(27, 4, 3, 10); g.fillRect(2, 2, 28, 3);
    } else if (kind === 'rock') {
      c = cnv(30, 22); const g = c.getContext('2d');
      g.fillStyle = '#55534a'; g.beginPath(); g.ellipse(15, 13, 13, 8, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.13)'; g.beginPath(); g.ellipse(11, 9, 6, 3.4, 0, 0, 7); g.fill();
    } else if (kind === 'bigstone') {
      c = cnv(36, 32); const g = c.getContext('2d');
      g.fillStyle = '#605e52'; g.beginPath(); g.ellipse(18, 17, 16, 13, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.ellipse(12, 10, 7, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#23231e'; g.beginPath(); g.ellipse(19, 16, 5, 6, 0, 0, 7); g.fill();
    } else if (kind === 'tree') {
      c = cnv(32, 44); const g = c.getContext('2d');
      g.strokeStyle = '#38342b'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(16, 44); g.lineTo(15, 18); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(15, 24); g.lineTo(5, 10); g.moveTo(15, 20); g.lineTo(26, 6); g.moveTo(15, 28); g.lineTo(27, 18); g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(26, 6); g.lineTo(29, 1); g.moveTo(5, 10); g.lineTo(2, 4); g.stroke();
    } else {
      c = cnv(w * 32, h * 32); const g = c.getContext('2d');
      g.fillStyle = '#4c4a41'; g.fillRect(0, 0, w * 32, h * 32);
    }
    objCache[key] = c;
    return c;
  }

  return { char, url, tile, obj, peopleScale: name => (PEOPLE[name] && PEOPLE[name].scale) || 1 };
})();
