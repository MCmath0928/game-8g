/* =============================================================
 * app.js — 哈希路由、导航、toast、通用 UI
 * ============================================================= */
(function (global) {
  'use strict';

  var B = global.BAGUA;
  var ROUTES = ['divination', 'library', 'nayin', 'basics'];
  var TITLES = {
    divination: '摇卦 · 金钱卦',
    library: '六十四卦',
    nayin: '六十甲子纳音',
    basics: '基础知识'
  };

  var sections = {};
  var mounted = {};
  var current = null;
  var mainEl = null;
  var initialized = false;

  function parseHash() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    if (!raw) return { name: 'divination', params: new URLSearchParams('') };
    var qi = raw.indexOf('?');
    var path = qi >= 0 ? raw.slice(0, qi) : raw;
    var query = qi >= 0 ? raw.slice(qi + 1) : '';
    var name = path.split('/')[0];
    if (ROUTES.indexOf(name) < 0) name = 'divination';
    return { name: name, params: new URLSearchParams(query) };
  }

  function buildShell() {
    mainEl = document.getElementById('main');
    if (!mainEl) return;
    ROUTES.forEach(function (name) {
      var sec = B.el('section', { class: 'view', id: 'view-' + name, dataset: { view: name } });
      sec.hidden = true;
      mainEl.appendChild(sec);
      sections[name] = sec;
    });
  }

  function highlightNav(name) {
    var links = document.querySelectorAll('.nav-link[data-route]');
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute('data-route') === name;
      links[i].classList.toggle('is-active', on);
      if (on) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  function mountView(name) {
    if (mounted[name]) return true;
    var view = global.BAGUA_VIEWS && global.BAGUA_VIEWS[name];
    var sec = sections[name];
    if (!view || typeof view.mount !== 'function' || !sec) {
      sec.innerHTML = '';
      sec.appendChild(B.el('div', { class: 'empty' }, [
        B.el('p', { class: 'empty__title', text: '这一页还没准备好' }),
        B.el('p', { class: 'muted', text: '请稍后再来，或先去看看摇卦。' })
      ]));
      return false;
    }
    view.mount(sec);
    mounted[name] = true;
    return true;
  }

  function apply() {
    var rawHash = location.hash || '';
    // 页内锚点（例如 skip-link 的 #main）不是路由，忽略之，避免被当成未知路由踢回首页
    if (initialized && rawHash && rawHash.indexOf('#/') !== 0) return;
    initialized = true;

    var route = parseHash();
    if (!mainEl) buildShell();
    var target = route.name;

    ROUTES.forEach(function (name) {
      var sec = sections[name];
      if (!sec) return;
      var on = name === target;
      sec.hidden = !on;
      sec.classList.toggle('is-active', on);
    });

    highlightNav(target);
    document.title = (TITLES[target] || '') + ' — 易 · 六十四卦';

    mountView(target);
    var view = global.BAGUA_VIEWS && global.BAGUA_VIEWS[target];
    if (view && typeof view.show === 'function') {
      try { view.show(route.params); } catch (err) { console && console.error(err); }
    }
    var prev = current;
    current = target;

    // 切页回到顶部（同页内参数变化不滚）
    if (prev !== target) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /* ---------------- toast ---------------- */
  function toast(msg, type) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var kind = type === 'warn' ? 'toast--warn' : (type === 'error' ? 'toast--error' : '');
    var node = B.el('div', { class: 'toast' + (kind ? ' ' + kind : ''), role: 'status', text: msg });
    root.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('toast--show'); });
    setTimeout(function () {
      node.classList.remove('toast--show');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 260);
    }, 2400);
  }

  /* ---------------- 复制 ---------------- */
  function copy(text) {
    var done = function (ok) { return Promise.resolve(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; })
        .catch(function () { return fallbackCopy(text); });
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  /* ---------------- 路由跳转 ---------------- */
  function go(name, params) {
    var hash = '#/' + name;
    if (params) {
      var usp = new URLSearchParams();
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v != null && v !== '') usp.set(k, v);
      });
      var q = usp.toString();
      if (q) hash += '?' + q;
    }
    if (location.hash === hash) {
      apply();
    } else {
      location.hash = hash;
    }
  }

  global.BAGUA_UI = {
    toast: toast,
    copy: copy,
    go: go,
    route: parseHash,
    apply: apply
  };

  window.addEventListener('hashchange', apply);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      buildShell();
      apply();
    });
  } else {
    buildShell();
    apply();
  }
})(window);
