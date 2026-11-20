/* GoKnowledge – Wissens-Reels für Safari/iPhone */
(() => {
  'use strict';

  const CATS = {
    geschichte: 'Geschichte',
    geografie: 'Geografie',
    natur: 'Naturwissenschaften',
    kunst: 'Kunst',
    politik: 'Politik',
  };
  const CAT_SHORT = { natur: 'Naturwiss.' };
  const REPEAT_AFTER = 10;
  const STORE_KEY = 'goknowledge.v1';
  const SESSION_GAP = 30 * 60 * 1000;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Images (Wikimedia Commons) ---------- */
  const imgUrl = (file, w = 960) =>
    'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file.replace(/ /g, '_')) + '?width=' + w;
  const fileUrl = (file) => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'));
  const imgTag = (file, cls, w, eager) =>
    `<img class="${cls}" src="${imgUrl(file, w)}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" onerror="this.style.visibility='hidden'">`;

  /* ---------- Persistent state ---------- */
  const now = () => Date.now();
  function freshState() {
    return {
      version: 1,
      createdAt: now(),
      filters: Object.keys(CATS),
      liked: {},
      saved: {},
      cards: {},
      pendingRepeats: [],
      sessions: { count: 0, last: 0 },
      events: [],
    };
  }
  let state;
  try { state = JSON.parse(localStorage.getItem(STORE_KEY)) || freshState(); } catch (e) { state = freshState(); }
  state = Object.assign(freshState(), state);
  let saveTimer = null;
  function persist(immediate) {
    clearTimeout(saveTimer);
    const write = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* voll oder blockiert */ } };
    immediate ? write() : (saveTimer = setTimeout(write, 300));
  }
  function cs(id) {
    return state.cards[id] || (state.cards[id] = { seen: 0, opened: 0, skipped: 0, dwellMs: 0, readMs: 0, maxScroll: 0, repeatReq: 0 });
  }
  function log(type, id, extra) {
    const ev = { t: now(), type };
    if (id) ev.id = id;
    if (extra) Object.assign(ev, extra);
    state.events.push(ev);
    if (state.events.length > 3000) state.events.splice(0, state.events.length - 3000);
    persist();
  }
  function touchSession() {
    const t = now();
    if (t - state.sessions.last > SESSION_GAP) { state.sessions.count++; log('session_start'); }
    state.sessions.last = t;
    persist();
  }

  /* ---------- Data ---------- */
  let CARDS = [];
  let BY_ID = {};

  /* ---------- Feed engine ---------- */
  const feedEl = $('#feed');
  let seq = [];          // rendered card ids in order
  let deck = [];         // remaining shuffled ids of the current loop
  let repeats = [];      // {id, due} – due = sequence index
  let cur = -1;          // current visible index
  let viewStart = 0;
  let openedThisView = false;

  const allowed = (id) => BY_ID[id] && state.filters.includes(BY_ID[id].cat);
  const pool = () => CARDS.filter((c) => state.filters.includes(c.cat)).map((c) => c.id);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function nextId() {
    const idx = seq.length;
    const r = repeats.findIndex((x) => x.due <= idx && allowed(x.id));
    if (r >= 0) return repeats.splice(r, 1)[0].id;
    if (!deck.length) {
      deck = shuffle(pool());
      // nicht zweimal dieselbe Karte direkt hintereinander
      const last = seq[seq.length - 1];
      if (deck.length > 1 && deck[deck.length - 1] === last) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    }
    return deck.pop();
  }
  function cardHTML(c, i) {
    const liked = !!state.liked[c.id], saved = !!state.saved[c.id];
    const rep = repeats.some((r) => r.id === c.id && r.from === i);
    return `<div class="card cat-${c.cat}" data-i="${i}" data-id="${c.id}">
      ${imgTag(c.cover.file, 'card-img', 960, i < 2)}
      <div class="card-shade"></div>
      <div class="card-info">
        <span class="chip">${CATS[c.cat]}</span>
        <h2 class="card-title">${esc(c.title)}</h2>
        <p class="card-teaser">${esc(c.teaser)}</p>
        <div class="card-meta">⏱ 1 Min. Lesezeit · ${c.sections.length} Abschnitte</div>
      </div>
      <div class="card-actions">
        <button class="act ${liked ? 'on' : ''}" data-act="like" data-id="${c.id}"><svg><use href="#i-heart"/></svg>Like</button>
        <button class="act ${saved ? 'on' : ''}" data-act="save" data-id="${c.id}"><svg><use href="#i-save"/></svg>Merken</button>
        <button class="act ${rep ? 'on' : ''}" data-act="repeat" data-id="${c.id}" data-i="${i}"><svg><use href="#i-repeat"/></svg>Bald<br>wieder</button>
      </div>
      <div class="card-open"><span>Antippen oder <b>←</b> wischen zum Lesen</span></div>
    </div>`;
  }
  function append(n) {
    const frag = document.createElement('div');
    let html = '';
    for (let k = 0; k < n; k++) {
      const id = nextId();
      if (!id) break;
      seq.push(id);
      html += cardHTML(BY_ID[id], seq.length - 1);
    }
    frag.innerHTML = html;
    while (frag.firstChild) feedEl.appendChild(frag.firstChild);
  }
  function resetFeed() {
    endView();
    const base = Math.max(cur, 0);
    repeats.forEach((r) => { r.due = Math.max(1, r.due - base); r.from = -1; });
    feedEl.innerHTML = '';
    seq = []; deck = []; cur = -1;
    if (!pool().length) {
      feedEl.innerHTML = '<div class="card"><div class="card-info" style="bottom:45%"><h2 class="card-title">Keine Themen gewählt</h2><p class="card-teaser">Wähle oben rechts mindestens ein Thema aus.</p></div></div>';
      return;
    }
    append(6);
    feedEl.scrollTop = 0;
    onScrollSettled();
  }

  function endView() {
    if (cur < 0 || !seq[cur]) return;
    const id = seq[cur];
    const d = now() - viewStart;
    const s = cs(id);
    s.dwellMs += d;
    if (!openedThisView) { s.skipped++; log('skip', id, { ms: d }); }
    persist();
  }
  function startView(i) {
    cur = i;
    viewStart = now();
    openedThisView = false;
    const id = seq[i];
    if (!id) return;
    cs(id).seen++;
    log('view', id);
  }
  let scrollTimer = null;
  function onScrollSettled() {
    const h = feedEl.clientHeight || 1;
    const i = Math.round(feedEl.scrollTop / h);
    if (i !== cur && seq[i]) { endView(); startView(i); }
    if (seq.length - cur <= 3) append(5);
  }
  feedEl.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(onScrollSettled, 110); }, { passive: true });

  /* ---------- Actions: like / save / repeat ---------- */
  function syncButtons(id) {
    $$(`[data-act="like"][data-id="${id}"]`).forEach((b) => b.classList.toggle('on', !!state.liked[id]));
    $$(`[data-act="save"][data-id="${id}"]`).forEach((b) => b.classList.toggle('on', !!state.saved[id]));
    if (articleId === id) {
      $('.article-bar [data-act="like"]').classList.toggle('on', !!state.liked[id]);
      $('.article-bar [data-act="save"]').classList.toggle('on', !!state.saved[id]);
    }
  }
  function toggleLike(id) {
    if (state.liked[id]) { delete state.liked[id]; log('unlike', id); }
    else { state.liked[id] = now(); log('like', id); toast('❤︎ Gefällt dir'); }
    syncButtons(id);
  }
  function toggleSave(id) {
    if (state.saved[id]) { delete state.saved[id]; log('unsave', id); toast('Aus „Gemerkt“ entfernt'); }
    else { state.saved[id] = now(); log('save', id); toast('Gemerkt'); }
    syncButtons(id);
    if ($('#view-saved').classList.contains('active')) renderSaved();
  }
  function requestRepeat(id, fromIndex, btn) {
    const existing = repeats.findIndex((r) => r.id === id);
    if (existing >= 0 && btn && btn.classList.contains('on')) {
      repeats.splice(existing, 1);
      btn.classList.remove('on');
      log('repeat_cancel', id);
      toast('Wiederholung abgebrochen');
    } else {
      if (existing >= 0) repeats.splice(existing, 1);
      const base = Math.max(fromIndex, cur, 0);
      repeats.push({ id, due: base + REPEAT_AFTER, from: fromIndex });
      cs(id).repeatReq++;
      log('repeat', id);
      if (btn) btn.classList.add('on');
      toast('Kommt in ca. 10 Karten wieder');
    }
    // Karten, die schon vorab gerendert sind, ggf. nachziehen: Repeat greift ab dem nächsten append.
    savePendingRepeats();
  }
  function savePendingRepeats() {
    state.pendingRepeats = repeats.map((r) => ({ id: r.id, left: Math.max(1, r.due - Math.max(cur, 0)) }));
    persist();
  }

  feedEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.act === 'like') toggleLike(id);
      else if (btn.dataset.act === 'save') toggleSave(id);
      else if (btn.dataset.act === 'repeat') requestRepeat(id, +btn.dataset.i, btn);
      return;
    }
    const card = e.target.closest('.card[data-id]');
    if (card) openArticle(card.dataset.id, 'tap');
  });

  // Wischen nach links öffnet den Artikel
  let tx = 0, ty = 0, tt = 0;
  feedEl.addEventListener('touchstart', (e) => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = now(); }, { passive: true });
  feedEl.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - tx, dy = t.clientY - ty;
    if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.6 && now() - tt < 700) {
      const card = e.target.closest('.card[data-id]');
      if (card) openArticle(card.dataset.id, 'swipe');
    }
  }, { passive: true });

  /* ---------- Article ---------- */
  const articleEl = $('#article');
  const aScroll = $('#article-scroll');
  let articleId = null, articleOpenedAt = 0, articleMaxScroll = 0, articleFrom = 'feed';

  function articleHTML(c) {
    const secs = c.sections.map((s) => `
      <h2>${esc(s.h)}</h2>
      <p>${s.p}</p>
      ${s.img ? `<figure><div class="fig-wrap">${imgTag(s.img.file, '', 960)}</div>
        <figcaption>${esc(s.img.caption || '')} · <a href="${fileUrl(s.img.file)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>` : ''}
    `).join('');
    return `
      <div class="hero">${imgTag(c.cover.file, '', 960, true)}</div>
      <div class="a-body">
        <span class="chip">${CATS[c.cat]}</span>
        <h1 class="a-title">${esc(c.title)}</h1>
        <div class="a-meta">⏱ 1 Min.${c.meta ? ' · ' + esc(c.meta) : ''}</div>
        ${secs}
        <div class="summary"><b>KURZ GESAGT</b><ul>${c.summary.map((x) => `<li>${x}</li>`).join('')}</ul></div>
        <div class="credit">Titelbild: ${esc(c.cover.caption || '')} · <a href="${fileUrl(c.cover.file)}" target="_blank" rel="noopener">Wikimedia Commons</a></div>
      </div>`;
  }
  function openArticle(id, how) {
    const c = BY_ID[id];
    if (!c) return;
    articleId = id;
    articleFrom = $('.view.active').id;
    articleEl.className = 'article cat-' + c.cat;
    aScroll.innerHTML = articleHTML(c);
    aScroll.scrollTop = 0;
    $('#progress-bar').style.width = '0';
    $$('.article-bar [data-act]').forEach((b) => (b.dataset.id = id));
    $('.article-bar [data-act="repeat"]').classList.toggle('on', repeats.some((r) => r.id === id));
    syncButtons(id);
    requestAnimationFrame(() => { articleEl.classList.add('open'); articleEl.setAttribute('aria-hidden', 'false'); });
    articleOpenedAt = now();
    articleMaxScroll = 0;
    if (articleFrom === 'view-feed' && seq[cur] === id) openedThisView = true;
    cs(id).opened++;
    log('open', id, { how, from: articleFrom.replace('view-', '') });
  }
  function closeArticle(how) {
    if (!articleId) return;
    const id = articleId;
    const ms = now() - articleOpenedAt;
    const s = cs(id);
    s.readMs += ms;
    s.maxScroll = Math.max(s.maxScroll, Math.round(articleMaxScroll * 100));
    log('close', id, { ms, scroll: Math.round(articleMaxScroll * 100), how });
    articleEl.classList.remove('open');
    articleEl.style.transform = '';
    articleEl.setAttribute('aria-hidden', 'true');
    articleId = null;
  }
  aScroll.addEventListener('scroll', () => {
    const max = aScroll.scrollHeight - aScroll.clientHeight;
    const p = max > 0 ? Math.min(1, aScroll.scrollTop / max) : 1;
    articleMaxScroll = Math.max(articleMaxScroll, p);
    $('#progress-bar').style.width = (p * 100).toFixed(1) + '%';
  }, { passive: true });
  $('#article-close').addEventListener('click', () => closeArticle('x'));
  $('.article-bar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !articleId) return;
    if (b.dataset.act === 'like') toggleLike(articleId);
    else if (b.dataset.act === 'save') toggleSave(articleId);
    else if (b.dataset.act === 'repeat') {
      const feedBtn = seq[cur] === articleId ? $(`.card[data-i="${cur}"] [data-act="repeat"]`) : null;
      requestRepeat(articleId, Math.max(cur, 0), b);
      if (feedBtn) feedBtn.classList.toggle('on', b.classList.contains('on'));
    }
  });
  // Nach unten ziehen (wenn ganz oben) schließt den Artikel
  let dStartY = null, dDy = 0;
  aScroll.addEventListener('touchstart', (e) => { dStartY = aScroll.scrollTop <= 0 ? e.touches[0].clientY : null; dDy = 0; }, { passive: true });
  aScroll.addEventListener('touchmove', (e) => {
    if (dStartY === null) return;
    dDy = e.touches[0].clientY - dStartY;
    if (dDy > 0 && aScroll.scrollTop <= 0) {
      articleEl.classList.add('dragging');
      articleEl.style.transform = `translateY(${dDy * 0.8}px)`;
    }
  }, { passive: true });
  aScroll.addEventListener('touchend', () => {
    articleEl.classList.remove('dragging');
    if (dStartY !== null && dDy > 110) closeArticle('drag');
    else articleEl.style.transform = '';
    dStartY = null;
  }, { passive: true });

  /* ---------- Filter sheet ---------- */
  const sheet = $('#sheet'), backdrop = $('#sheet-backdrop');
  let draftFilters = null;
  function renderSheet() {
    $('#sheet-options').innerHTML = Object.entries(CATS).map(([k, v]) => `
      <button class="opt cat-${k} ${draftFilters.includes(k) ? 'on' : ''}" data-cat="${k}">
        <span class="dot"></span>${v}<span class="chk"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>
      </button>`).join('');
  }
  function openSheet() { draftFilters = [...state.filters]; renderSheet(); sheet.classList.add('show'); backdrop.classList.add('show'); }
  function closeSheet(apply) {
    sheet.classList.remove('show'); backdrop.classList.remove('show');
    if (!apply) return;
    if (!draftFilters.length) { toast('Mindestens ein Thema wählen'); return; }
    const changed = draftFilters.slice().sort().join() !== state.filters.slice().sort().join();
    state.filters = draftFilters;
    updateFilterLabel();
    if (changed) { log('filter', null, { filters: state.filters }); resetFeed(); }
    persist();
  }
  function updateFilterLabel() {
    const f = state.filters;
    $('#filter-label').textContent = f.length === 5 ? 'Alle Themen' : f.length === 1 ? (CAT_SHORT[f[0]] || CATS[f[0]]) : `${f.length} Themen`;
  }
  $('#filter-btn').addEventListener('click', openSheet);
  backdrop.addEventListener('click', () => closeSheet(false));
  $('#sheet-done').addEventListener('click', () => closeSheet(true));
  $('#sheet-options').addEventListener('click', (e) => {
    const o = e.target.closest('.opt');
    if (!o) return;
    const k = o.dataset.cat;
    draftFilters = draftFilters.includes(k) ? draftFilters.filter((x) => x !== k) : [...draftFilters, k];
    o.classList.toggle('on');
  });

  /* ---------- Tabs ---------- */
  function showView(name) {
    if (articleId) closeArticle('tab');
    const leavingFeed = $('#view-feed').classList.contains('active') && name !== 'feed';
    if (leavingFeed) { endView(); cur = -1; }
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
    if (name === 'feed') onScrollSettled();
    if (name === 'saved') renderSaved();
    if (name === 'stats') renderStats();
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

  /* ---------- Gemerkt ---------- */
  function itemHTML(c, sub) {
    return `<button class="item cat-${c.cat}" data-open="${c.id}">
      ${imgTag(c.cover.file, 'thumb', 330)}
      <div><div class="item-t">${esc(c.title)}</div><div class="item-s"><span class="dot"></span>${CATS[c.cat]}${sub ? ' · ' + sub : ''}</div></div>
    </button>`;
  }
  function fmtTime(ms) {
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`;
  }
  function renderSaved() {
    const ids = Object.keys(state.saved).filter((id) => BY_ID[id]).sort((a, b) => state.saved[b] - state.saved[a]);
    $('#saved-count').textContent = ids.length ? `${ids.length} Artikel` : '';
    $('#saved-list').innerHTML = ids.length
      ? ids.map((id) => itemHTML(BY_ID[id], (state.cards[id] && state.cards[id].readMs) ? fmtTime(state.cards[id].readMs) + ' gelesen' : 'noch nicht gelesen')).join('')
      : '<div class="empty">Noch nichts gemerkt.<br>Tippe im Feed auf das Lesezeichen.</div>';
  }
  $('#saved-list').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) openArticle(b.dataset.open, 'saved'); });

  /* ---------- Statistik ---------- */
  function totals() {
    let seen = 0, opened = 0, skipped = 0, readMs = 0;
    const per = {};
    Object.keys(CATS).forEach((k) => (per[k] = { seen: 0, opened: 0, liked: 0, readMs: 0 }));
    for (const [id, s] of Object.entries(state.cards)) {
      seen += s.seen; opened += s.opened; skipped += s.skipped; readMs += s.readMs;
      const c = BY_ID[id];
      if (c) { per[c.cat].seen += s.seen; per[c.cat].opened += s.opened; per[c.cat].readMs += s.readMs; }
    }
    for (const id of Object.keys(state.liked)) if (BY_ID[id]) per[BY_ID[id].cat].liked++;
    return { seen, opened, skipped, readMs, likes: Object.keys(state.liked).length, saved: Object.keys(state.saved).length, per };
  }
  function renderStats() {
    const t = totals();
    const d = new Date(state.createdAt);
    $('#stats-since').textContent = `seit ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} · ${state.sessions.count} Sitzung${state.sessions.count === 1 ? '' : 'en'}`;
    const rows = Object.keys(CATS)
      .map((k) => ({ k, q: t.per[k].seen ? t.per[k].opened / t.per[k].seen : 0 }))
      .sort((a, b) => b.q - a.q)
      .map(({ k, q }) => `<div class="row cat-${k}"><span class="nm">${CAT_SHORT[k] || CATS[k]}</span><span class="tr"><i style="width:${Math.round(Math.min(1, q) * 100)}%"></i></span><span class="v">${Math.round(q * 100)}%</span></div>`)
      .join('');
    const top = Object.entries(state.cards).filter(([id, s]) => BY_ID[id] && s.readMs > 0)
      .sort((a, b) => b[1].readMs - a[1].readMs).slice(0, 5)
      .map(([id, s]) => itemHTML(BY_ID[id], fmtTime(s.readMs) + ' gelesen' + (state.liked[id] ? ' · ❤︎' : ''))).join('');
    $('#stats-body').innerHTML = `
      <div class="tiles">
        <div class="tile"><div class="n">${t.seen}</div><div class="l">gesehen</div></div>
        <div class="tile"><div class="n">${t.opened}</div><div class="l">aufgeklappt</div></div>
        <div class="tile"><div class="n" style="color:var(--c-geschichte)">${t.likes}</div><div class="l">Likes</div></div>
        <div class="tile"><div class="n">${t.skipped}</div><div class="l">übersprungen</div></div>
        <div class="tile"><div class="n">${t.saved}</div><div class="l">gemerkt</div></div>
        <div class="tile"><div class="n">${Math.round(t.readMs / 60000)}</div><div class="l">Min. gelesen</div></div>
      </div>
      <div class="sec">Aufklapp-Quote nach Thema</div>
      ${rows}
      <div class="sec">Am längsten gelesen</div>
      ${top || '<div class="empty" style="padding:14px">Noch keine Artikel gelesen.</div>'}
      <button id="export-btn" class="btn-primary" style="margin-top:22px">📋 Statistik exportieren</button>
      <button id="reset-btn" class="btn-secondary">Statistik zurücksetzen</button>`;
    $('#export-btn').addEventListener('click', exportStats);
    $('#reset-btn').addEventListener('click', () => {
      if (!confirm('Wirklich alle Statistikdaten löschen? Likes und Gemerkt bleiben erhalten.')) return;
      state.cards = {}; state.events = []; state.sessions = { count: 1, last: now() }; state.createdAt = now();
      persist(true); renderStats(); toast('Statistik zurückgesetzt');
    });
    $('#stats-body').querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openArticle(b.dataset.open, 'stats')));
  }
  function exportStats() {
    const t = totals();
    const perCard = CARDS.map((c) => {
      const s = state.cards[c.id] || {};
      return {
        id: c.id, title: c.title, cat: c.cat,
        seen: s.seen || 0, opened: s.opened || 0, skipped: s.skipped || 0,
        readSec: Math.round((s.readMs || 0) / 1000), dwellSec: Math.round((s.dwellMs || 0) / 1000),
        maxScrollPct: s.maxScroll || 0, repeatReq: s.repeatReq || 0,
        liked: !!state.liked[c.id], saved: !!state.saved[c.id],
      };
    });
    const data = {
      app: 'GoKnowledge', exportedAt: new Date().toISOString(),
      since: new Date(state.createdAt).toISOString(), sessions: state.sessions.count,
      totals: { seen: t.seen, opened: t.opened, skipped: t.skipped, likes: t.likes, saved: t.saved, readMin: +(t.readMs / 60000).toFixed(1) },
      perCategory: t.per, perCard,
      events: state.events.slice(-1500).map((e) => [new Date(e.t).toISOString().slice(0, 19), e.type, e.id || '', e.ms ? Math.round(e.ms / 1000) : '']),
    };
    const text = JSON.stringify(data);
    log('export');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      toast(ok ? 'Statistik kopiert – jetzt im Chat einfügen' : 'Kopieren fehlgeschlagen');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Statistik kopiert – jetzt im Chat einfügen'), fallback);
    } else fallback();
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1700);
  }

  /* ---------- Lifecycle ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (articleId) { const s = cs(articleId); s.readMs += now() - articleOpenedAt; articleOpenedAt = now(); }
      else if (cur >= 0 && seq[cur]) { cs(seq[cur]).dwellMs += now() - viewStart; viewStart = now(); }
      savePendingRepeats();
      persist(true);
    } else {
      touchSession();
      if (articleId) articleOpenedAt = now(); else viewStart = now();
    }
  });
  window.addEventListener('pagehide', () => persist(true));

  async function init() {
    try {
      const res = await fetch('data/cards.json', { cache: 'no-cache' });
      CARDS = (await res.json()).cards;
    } catch (e) {
      feedEl.innerHTML = '<div class="card"><div class="card-info" style="bottom:45%"><h2 class="card-title">Fehler</h2><p class="card-teaser">Inhalte konnten nicht geladen werden.</p></div></div>';
      return;
    }
    BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
    state.filters = state.filters.filter((k) => CATS[k]);
    if (!state.filters.length) state.filters = Object.keys(CATS);
    repeats = (state.pendingRepeats || []).filter((r) => BY_ID[r.id]).map((r) => ({ id: r.id, due: r.left }));
    updateFilterLabel();
    touchSession();
    resetFeed();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
