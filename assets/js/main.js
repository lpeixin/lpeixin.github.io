/* ============================================================================
 * main.js — 把 content.js 渲染成页面，并处理主题 / 语言 / 交互
 * 一般不需要改这个文件；要改内容请改 assets/js/content.js
 * ========================================================================== */

(function () {
  'use strict';

  var S = window.SITE;
  if (!S) return;

  var root = document.documentElement;
  var state = { lang: root.dataset.lang === 'en' ? 'en' : 'zh' };

  /* ── 小工具 ─────────────────────────────────────────────────────────────── */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 取本地化字段：pick({zh,en}) → 当前语言的字符串 */
  function pick(o, lang) {
    if (o == null) return '';
    if (typeof o === 'object' && ('zh' in o || 'en' in o)) {
      return o[lang || state.lang] || o.zh || o.en || '';
    }
    return o;
  }

  var other = function () { return state.lang === 'zh' ? 'en' : 'zh'; };
  var UI = function () { return S.ui[state.lang]; };

  function el(id) { return document.getElementById(id); }

  /* ── 图标 ───────────────────────────────────────────────────────────────── */

  var ICON = {
    gh: '<svg class="ico ico--fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.93.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2.2Z"/></svg>',
    mail: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.6" y="4.8" width="18.8" height="14.4" rx="2.6"/><path d="m3.4 6.6 8.6 6 8.6-6"/></svg>',
    down: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v14M6.4 13l5.6 5.6 5.6-5.6"/></svg>',
    up: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5v-14M6.4 11l5.6-5.6 5.6 5.6"/></svg>',
    out: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 15.5 19 5M14.4 5H19v4.6M18 14v4.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V7.6A1.6 1.6 0 0 1 5.6 6H10"/></svg>',
    pin: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.4s6.6-6 6.6-11a6.6 6.6 0 1 0-13.2 0c0 5 6.6 11 6.6 11Z"/><circle cx="12" cy="10.2" r="2.4"/></svg>',
    star: '<svg class="ico ico--fill" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/></svg>',
    copy: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11.4" height="11.4" rx="2.2"/><path d="M15 6.2A2.2 2.2 0 0 0 12.8 4H5.8A2.2 2.2 0 0 0 3.6 6.2v7A2.2 2.2 0 0 0 5.8 15.4"/></svg>'
  };

  /* ── 首屏数字（可被 GitHub API 覆盖） ───────────────────────────────────── */

  var statsValues = {
    repos: S.profile.fallbackStats.repos,
    followers: S.profile.fallbackStats.followers
  };

  /* ── 板块外壳 ───────────────────────────────────────────────────────────── */

  var idx = 0;
  function nextIdx() { return String(++idx).padStart(2, '0'); }

  function section(opt) {
    var head =
      '<div class="sec-head reveal">' +
        '<span class="sec-idx">' + nextIdx() + '</span>' +
        '<h2 class="sec-title">' + esc(pick(opt.title)) + '</h2>' +
        '<span class="sec-alt">' + esc(pick(opt.title, other())) + '</span>' +
      '</div>';

    return '<section class="sec' + (opt.sunk ? ' sec--sunk' : '') + '" id="' + opt.id + '">' +
      '<div class="wrap">' + head +
        (opt.lede ? '<p class="sec-lede reveal">' + esc(pick(opt.lede)) + '</p>' : '') +
        opt.body +
      '</div></section>';
  }

  /* ── 首屏 ───────────────────────────────────────────────────────────────── */

  function renderHero() {
    var p = S.profile, h = S.hero;
    var u = UI();

    var stats = h.stats.map(function (s) {
      var value = s.key ? statsValues[s.key] : s.value;
      return '<div class="stat">' +
        '<div class="stat__n"' + (s.key ? ' id="stat-' + s.key + '"' : '') + '>' + esc(value) + '</div>' +
        '<div class="stat__l">' + esc(pick(s.label)) + '</div>' +
      '</div>';
    }).join('');

    var mailBtn = p.email
      ? '<a class="btn" href="mailto:' + esc(p.email) + '">' + ICON.mail + esc(u.btnEmail) + '</a>'
      : '';

    return '<section class="sec hero" id="top">' +
      '<div class="wrap hero__in">' +
        '<div class="hero__grid">' +
          '<div>' +
            '<span class="kicker"><span class="kicker__dot"></span>' + esc(pick(h.kicker)) + '</span>' +
            '<h1 class="hero__name">' + esc(p.name) + '</h1>' +
            '<p class="hero__headline">' + esc(pick(h.headline)) + '</p>' +
            '<p class="hero__sub">' + esc(pick(h.sub)) + '</p>' +
            '<div class="hero__actions">' +
              '<a class="btn btn--primary" href="' + esc(p.github) + '" target="_blank" rel="noopener">' +
                ICON.gh + esc(u.btnGithub) + '</a>' +
              mailBtn +
              '<a class="btn" href="#projects">' + ICON.down + esc(u.btnProjects) + '</a>' +
            '</div>' +
            '<div class="hero__meta">' +
              '<span>' + ICON.pin + esc(pick(p.location)) + '</span>' +
              '<span><i class="status-dot"></i>' + esc(pick(h.status)) + '</span>' +
            '</div>' +
          '</div>' +
          '<aside class="hero__aside">' +
            '<img class="avatar" src="' + esc(p.avatar) + '" alt="' + esc(p.name) + '" width="208" height="208">' +
            '<p class="avatar-cap"><b>@' + esc(p.handle) + '</b><br>github.com/' + esc(p.handle) + '</p>' +
          '</aside>' +
        '</div>' +
        '<div class="stats">' + stats + '</div>' +
      '</div></section>';
  }

  /* ── 最近在做 ───────────────────────────────────────────────────────────── */

  function renderNow() {
    var body = '<div class="now">' + S.now.items.map(function (it) {
      return '<article class="now__item reveal">' +
        '<span class="now__tag">' + esc(it.tag) + '</span>' +
        '<h3 class="now__t">' + esc(it.title) + '</h3>' +
        '<p class="now__d">' + esc(pick(it.desc)) + '</p>' +
      '</article>';
    }).join('') + '</div>';

    return section({ id: 'now', title: S.now.title, lede: S.now.lede, body: body });
  }

  /* ── 代表项目 + 更多仓库 ────────────────────────────────────────────────── */

  function langDot(lang) {
    return '<span class="langdot" data-lang="' + esc(lang) + '"><i></i>' + esc(lang) + '</span>';
  }

  function renderProjects() {
    var P = S.projects, u = UI();

    var cards = P.items.map(function (it) {
      return '<a class="card reveal" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<div class="card__top">' +
          '<span class="card__name">' + esc(it.name) + '</span>' +
          '<span class="card__arrow">' + ICON.out + '</span>' +
        '</div>' +
        '<p class="card__desc">' + esc(pick(it.desc)) + '</p>' +
        (it.tags && it.tags.length
          ? '<div class="tags">' + it.tags.map(function (t) {
              return '<span class="tag">' + esc(t) + '</span>';
            }).join('') + '</div>'
          : '') +
        '<div class="card__foot">' + langDot(it.lang) +
          (it.stars > 0 ? '<span class="card__stat">' + ICON.star + it.stars + '</span>' : '') +
        '</div>' +
      '</a>';
    }).join('');

    var rows = P.more.items.map(function (it) {
      return '<a class="row" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<div class="row__main">' +
          '<span class="row__name">' + esc(it.name) + '</span>' +
          '<p class="row__desc">' + esc(pick(it.desc)) + '</p>' +
        '</div>' +
        '<div class="row__side">' + langDot(it.lang) +
          (it.stars > 0 ? '<span class="card__stat">' + ICON.star + it.stars + '</span>' : '') +
        '</div>' +
      '</a>';
    }).join('');

    var seeAll = u.seeAll.replace('{n}', '<b>' + statsValues.repos + '</b>');

    var body =
      '<div class="grid-cards">' + cards + '</div>' +
      '<div class="subhead reveal">' +
        '<h3>' + esc(pick(P.more.title)) + '</h3>' +
        '<span>' + esc(pick(P.more.title, other())) + '</span>' +
      '</div>' +
      '<div class="list-rows">' + rows + '</div>' +
      '<p class="see-all reveal"><a href="' + esc(S.profile.github) + '?tab=repositories" target="_blank" rel="noopener">' +
        seeAll + ' ' + ICON.out + '</a></p>';

    return section({ id: 'projects', title: P.title, lede: P.lede, body: body });
  }

  /* ── 开源参与 ───────────────────────────────────────────────────────────── */

  function renderOss() {
    var O = S.oss, u = UI();

    var items = O.items.map(function (it) {
      return '<a class="card reveal" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<div class="card__top">' +
          '<span class="card__name">' + esc(it.label || it.name) + '</span>' +
          '<span class="badge badge--fork">' + esc(pick(it.badge)) + '</span>' +
          '<span class="card__arrow">' + ICON.out + '</span>' +
        '</div>' +
        '<p class="card__desc">' + esc(pick(it.desc)) + '</p>' +
        '<div class="card__foot"><span class="repo-path">' + esc(it.name) + '</span></div>' +
      '</a>';
    }).join('');

    var slot = '<div class="card card--slot reveal">' +
      '<div class="card__top">' +
        '<span class="card__name">' + esc(u.slotPrTitle) + '</span>' +
        '<span class="badge">' + esc(u.slotLabel) + '</span>' +
      '</div>' +
      '<p class="card__desc">' + esc(u.slotPrDesc) + '</p>' +
    '</div>';

    var body =
      '<div class="oss-grid">' + items + slot + '</div>' +
      '<p class="note-line reveal">' + esc(u.ossNote) + '</p>';

    return section({ id: 'oss', title: O.title, lede: O.lede, body: body });
  }

  /* ── 学习笔记 ───────────────────────────────────────────────────────────── */

  function slotCard(i, hint) {
    var u = UI();
    return '<div class="slot reveal">' +
      '<span class="slot__plus">+</span>' +
      '<span class="slot__label">note-' + String(i + 1).padStart(2, '0') + ' · ' + esc(u.slotLabel) + '</span>' +
      '<span class="slot__hint">' + esc(hint || u.slotHint) + '</span>' +
    '</div>';
  }

  function renderNotes() {
    var N = S.notes;
    var real = (N.items || []).map(function (it) {
      return '<a class="card reveal" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<div class="card__top">' +
          '<span class="card__name">' + esc(pick(it.title)) + '</span>' +
          '<span class="card__arrow">' + ICON.out + '</span>' +
        '</div>' +
        (it.summary ? '<p class="card__desc">' + esc(pick(it.summary)) + '</p>' : '<p class="card__desc"></p>') +
        (it.tags && it.tags.length
          ? '<div class="tags">' + it.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>'
          : '') +
        '<div class="card__foot"><span class="mono">' + esc(it.date) + '</span></div>' +
      '</a>';
    }).join('');

    var slots = '';
    for (var i = 0; i < (N.slotCount || 0); i++) slots += slotCard(i);

    return section({ id: 'notes', title: N.title, lede: N.lede, body: '<div class="grid-cards">' + real + slots + '</div>' });
  }

  /* ── 技能栈 ─────────────────────────────────────────────────────────────── */

  function renderSkills() {
    var K = S.skills;
    var body = '<div class="skills">' + K.groups.map(function (g) {
      return '<div class="skillbox reveal">' +
        '<div class="skillbox__h"><i></i>' + esc(pick(g.name)) +
          '<em>' + esc(pick(g.name, other())) + '</em></div>' +
        '<div class="tags">' + g.items.map(function (t) {
          return '<span class="tag">' + esc(t) + '</span>';
        }).join('') + '</div>' +
      '</div>';
    }).join('') + '</div>';

    return section({ id: 'skills', title: K.title, lede: K.lede, body: body });
  }

  /* ── 关于本站 ───────────────────────────────────────────────────────────── */

  function renderColophon() {
    var C = S.colophon;
    var body = '<div class="colophon">' + C.rows.map(function (r) {
      return '<div class="reveal">' +
        '<div class="colo__k">' + esc(pick(r.k)) + '</div>' +
        '<div class="colo__v">' + pick(r.v) + '</div>' +   /* v 允许写 HTML（比如链接） */
      '</div>';
    }).join('') + '</div>';

    return section({ id: 'colophon', title: C.title, body: body, sunk: true });
  }

  /* ── 页脚 ───────────────────────────────────────────────────────────────── */

  function renderFooter() {
    var p = S.profile, u = UI();
    var year = new Date().getFullYear();
    var copyBtn = p.email
      ? '<button type="button" id="copyMail" aria-label="' + esc(u.copyLabel) + '" title="' + esc(u.copyLabel) + '">' + ICON.copy + '</button>'
      : '';
    var mailLink = p.email
      ? '<a href="mailto:' + esc(p.email) + '">' + ICON.mail + esc(p.email) + '</a>'
      : '';

    return '<div class="wrap ftr__in">' +
      '<span>© ' + year + ' ' + esc(p.name) + ' · ' + esc(u.rights) + '</span>' +
      '<span class="ftr__top">updated ' + esc(p.updated) + '</span>' +
      '<div class="ftr__links">' +
        '<a href="' + esc(p.github) + '" target="_blank" rel="noopener">' + ICON.gh + 'GitHub</a>' +
        mailLink + copyBtn +
        '<a href="#top">' + ICON.up + esc(u.backTop) + '</a>' +
      '</div>' +
    '</div>';
  }

  /* ── 导航 ───────────────────────────────────────────────────────────────── */

  function renderNav() {
    var nav = el('nav');
    if (!nav) return;
    nav.innerHTML = UI().nav.map(function (n) {
      var href = n.id === 'contact' ? '#contact' : '#' + n.id;
      return '<a href="' + href + '" data-nav="' + n.id + '">' + esc(n.label) + '</a>';
    }).join('');
  }

  /* ── 整页渲染 ───────────────────────────────────────────────────────────── */

  function render() {
    idx = 0;
    var main = el('main');

    /* noscript 里的兜底内容不需要保留 */
    var noScript = main.querySelector('noscript');
    if (noScript) noScript.remove();

    main.innerHTML =
      renderHero() +
      renderNow() +
      renderProjects() +
      renderOss() +
      renderNotes() +
      renderSkills() +
      renderColophon();

    var footer = document.querySelector('.ftr');
    if (footer) footer.innerHTML = renderFooter();

    renderNav();
    document.title = S.profile.name + ' — ' + pick(S.hero.kicker);
    root.lang = state.lang === 'zh' ? 'zh-Hans' : 'en';

    var brandSub = document.querySelector('[data-t="brand.sub"]');
    if (brandSub) brandSub.textContent = UI().brandSub;

    var langLabel = el('langLabel');
    if (langLabel) langLabel.textContent = state.lang === 'zh' ? 'EN' : '中';

    syncJsonLd();
    observeReveal();
    bindCopy();
  }

  /* ── SEO：让结构化数据跟着 content.js 走 ───────────────────────────────── */

  function syncJsonLd() {
    var tag = document.querySelector('script[type="application/ld+json"]');
    if (!tag) return;
    var p = S.profile;
    try {
      tag.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: p.name,
        alternateName: p.handle,
        jobTitle: pick(S.hero.kicker),
        description: pick(S.hero.sub),
        url: 'https://' + p.handle + '.github.io/',
        image: p.avatar,
        email: p.email ? 'mailto:' + p.email : undefined,
        sameAs: [p.github],
        knowsAbout: S.skills.groups.reduce(function (a, g) { return a.concat(g.items); }, [])
      }, null, 2);
    } catch (e) {}
  }

  /* ── 入场动画 ───────────────────────────────────────────────────────────── */

  var revealObserver = null;
  function observeReveal() {
    var nodes = document.querySelectorAll('.reveal:not(.is-in)');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          revealObserver.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    }
    nodes.forEach(function (n, i) {
      n.style.transitionDelay = Math.min(i % 4, 3) * 45 + 'ms';
      revealObserver.observe(n);
    });
  }

  /* ── 顶栏：吸顶状态 + 阅读进度 ─────────────────────────────────────────── */

  var hdr = el('hdr'), bar = el('hdrProgress');
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (hdr) hdr.classList.toggle('is-stuck', y > 8);
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? Math.min(y / max, 1) * 100 : 0) + '%';
    }
    spy();
  }

  /* ── 导航高亮 ───────────────────────────────────────────────────────────── */

  function spy() {
    var ids = UI().nav.map(function (n) { return n.id; });
    var line = (hdr ? hdr.offsetHeight : 60) + 30;
    var current = null;

    /* 取"最后一个越过判定线的板块"，而不是"正好跨越判定线的板块"——
       后者在锚点跳转后会因为 1px 的误差慢一节。 */
    ids.forEach(function (id) {
      var target = document.getElementById(id);
      if (!target) return;
      if (target.getBoundingClientRect().top <= line) current = id;
    });

    /* 滚到底部时高亮「联系」 */
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = 'contact';
    }

    document.querySelectorAll('.nav a').forEach(function (a) {
      if (a.dataset.nav === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  /* ── 主题 ───────────────────────────────────────────────────────────────── */

  function setTheme(t) {
    root.dataset.theme = t;
    try { localStorage.setItem('site-theme', t); } catch (e) {}
  }

  el('themeToggle').addEventListener('click', function () {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ── 语言 ───────────────────────────────────────────────────────────────── */

  function setLang(l) {
    state.lang = l;
    root.dataset.lang = l;
    try { localStorage.setItem('site-lang', l); } catch (e) {}
    render();
    spy();
  }

  el('langToggle').addEventListener('click', function () {
    setLang(state.lang === 'zh' ? 'en' : 'zh');
  });

  /* ── 复制邮箱 ───────────────────────────────────────────────────────────── */

  var toastTimer = null;
  function toast(msg) {
    var t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  function bindCopy() {
    var btn = el('copyMail');
    if (!btn || !S.profile.email) return;
    btn.addEventListener('click', function () {
      var done = function () { toast(UI().copied); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(S.profile.email).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = S.profile.email;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }

  /* ── 首屏数字：尝试用 GitHub API 覆盖，失败就静默保留兜底值 ─────────────── */

  function fetchStats() {
    if (!S.profile.liveStats || !window.fetch) return;
    fetch('https://api.github.com/users/' + encodeURIComponent(S.profile.handle))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || typeof d.public_repos !== 'number') return;
        statsValues.repos = d.public_repos;
        statsValues.followers = d.followers;
        ['repos', 'followers'].forEach(function (k) {
          var n = el('stat-' + k);
          if (n) n.textContent = statsValues[k];
        });
        var seeAll = document.querySelector('.see-all b');
        if (seeAll) seeAll.textContent = statsValues.repos;
      })
      .catch(function () { /* 限流或离线：保持静态值 */ });
  }

  /* ── 启动 ───────────────────────────────────────────────────────────────── */

  render();
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  fetchStats();
})();
