/* =============================================================
 * library.js — 六十四卦页：检索、上下卦筛选、卦卡网格、详情模态
 * 依赖 window.BAGUA（core/engine.js），由 app.js 懒挂载。
 * 纯经典脚本，无外部依赖。
 * ============================================================= */
(function (global) {
  'use strict';

  var B = global.BAGUA;
  if (!B) return;

  var TRI_BY_NAME = {};
  B.trigrams.forEach(function (t) { TRI_BY_NAME[t.name] = t; });

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var refs = {};
  var built = false;
  var cardsBuilt = [];
  var cardByNum = {};
  var searchIndex = [];
  var state = { q: '', upper: 'all', lower: 'all' };
  var searchTimer = null;

  var isOpen = false;
  var openNum = null;
  var lastTrigger = null;
  var prevBodyOverflow = '';

  /* ---------------- 文本工具 ---------------- */

  function stripTones(str) {
    var s = String(str == null ? '' : str).toLowerCase();
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s;
  }

  function plainPinyin(str) {
    return stripTones(String(str == null ? '' : str).replace(/[ǖǘǚǜü]/g, 'v'));
  }

  function normQuery(str) {
    return stripTones(str).trim().replace(/\s+/g, ' ');
  }

  /* ---------------- 检索 ---------------- */

  function buildIndex() {
    searchIndex = B.hexagrams.map(function (h) {
      var parts = [
        h.num,
        '第' + h.num + '卦',
        '第' + B.pad2(h.num) + '卦',
        h.name,
        h.fullName,
        h.pinyin,
        plainPinyin(h.pinyin),
        h.upper.name,
        h.upper.image,
        h.upper.sym,
        plainPinyin(h.upper.pinyin || ''),
        h.lower.name,
        h.lower.image,
        h.lower.sym,
        plainPinyin(h.lower.pinyin || ''),
        h.guaci.text,
        h.guaci.trans,
        h.guaci.anal
      ];
      return { h: h, blob: stripTones(parts.join(' ')) };
    });
  }

  function matchItem(item, q) {
    if (!q) return true;
    var byNum = q.match(/^第?\s*(\d{1,2})\s*卦?$/);
    if (byNum) {
      var num = parseInt(byNum[1], 10);
      if (num >= 1 && num <= 64) return item.h.num === num;
    }
    var tokens = q.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] && item.blob.indexOf(tokens[i]) < 0) return false;
    }
    return true;
  }

  /* ---------------- 状态与计数 ---------------- */

  function isFiltered() {
    return !!state.q || state.upper !== 'all' || state.lower !== 'all';
  }

  function applyFilter() {
    if (!built) return;
    var q = normQuery(refs.search.value);
    state.q = q;
    var visible = 0;

    searchIndex.forEach(function (item) {
      var card = cardByNum[item.h.num];
      if (!card) return;
      var on = matchItem(item, q) &&
        (state.upper === 'all' || item.h.upper.name === state.upper) &&
        (state.lower === 'all' || item.h.lower.name === state.lower);
      card.hidden = !on;
      if (on) visible++;
    });

    if (refs.count) {
      refs.count.textContent = isFiltered()
        ? '找到 ' + visible + ' 卦'
        : '共 ' + B.hexagrams.length + ' 卦';
    }
    if (refs.empty) refs.empty.hidden = visible > 0;
    if (refs.grid) refs.grid.hidden = visible === 0;

    var focused = document.activeElement;
    if (visible === 0 && focused && focused.classList && focused.classList.contains('lib__card')) {
      refs.search.focus();
    }
  }

  function syncPressed(group, value) {
    if (!group) return;
    var segs = group.querySelectorAll('.segment');
    for (var i = 0; i < segs.length; i++) {
      var on = segs[i].getAttribute('data-value') === value;
      segs[i].classList.toggle('is-active', on);
      segs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function resetFilters() {
    if (!built) return;
    refs.search.value = '';
    state.q = '';
    state.upper = 'all';
    state.lower = 'all';
    syncPressed(refs.upperGroup, 'all');
    syncPressed(refs.lowerGroup, 'all');
    applyFilter();
    refs.search.focus();
  }

  /* ---------------- DOM 构建 ---------------- */

  function buildHead() {
    return B.el('header', { class: 'lib__head' }, [
      B.el('p', { class: 'eyebrow lib__eyebrow', text: 'THE SIXTY-FOUR HEXAGRAMS' }),
      B.el('div', { class: 'lib__head-row' }, [
        B.el('h1', { class: 'lib__title serif', text: '六十四卦' }),
        B.el('p', { class: 'lib__stat' }, [
          B.el('span', { class: 'lib__stat-label', text: '共' }),
          B.el('strong', { class: 'lib__stat-num', text: String(B.hexagrams.length) }),
          B.el('span', { class: 'lib__stat-label', text: '卦' })
        ])
      ]),
      B.el('p', {
        class: 'lib__lede muted',
        text: '上经三十卦，下经三十四卦，依通行本卦序编次。可检索卦名、拼音、卦序，或按上卦、下卦筛选；点开一卦，读它的卦辞与六爻。'
      })
    ]);
  }

  function buildToolbar() {
    var searchField = B.el('div', { class: 'field lib__field' }, [
      B.el('label', { class: 'field__label', for: 'lib-search', text: '检索' }),
      B.el('input', {
        class: 'input lib__input',
        id: 'lib-search',
        type: 'search',
        placeholder: '卦名 / 拼音 / 序号 / 卦辞关键字，如「43」「第43卦」「夬」',
        autocomplete: 'off',
        spellcheck: 'false',
        'aria-describedby': 'lib-search-hint'
      }),
      B.el('p', { class: 'field__hint', id: 'lib-search-hint', text: '输入即筛，支持「43」「第43卦」这类序号写法。' })
    ]);

    var upperGroup = buildSegmented('lib-upper-filter', 'lib-upper-label', '按上卦');
    var lowerGroup = buildSegmented('lib-lower-filter', 'lib-lower-label', '按下卦');

    var resetBtn = B.el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm lib__reset',
      id: 'lib-reset',
      text: '清除条件'
    });

    var toolbar = B.el('div', { class: 'lib__toolbar' }, [
      B.el('div', { class: 'lib__toolbar-top' }, [searchField, resetBtn]),
      B.el('div', { class: 'lib__filters' }, [
        B.el('div', { class: 'lib__filter' }, [
          B.el('span', { class: 'field__label lib__filter-label', id: 'lib-upper-label', text: '按上卦' }),
          upperGroup
        ]),
        B.el('div', { class: 'lib__filter' }, [
          B.el('span', { class: 'field__label lib__filter-label', id: 'lib-lower-label', text: '按下卦' }),
          lowerGroup
        ])
      ]),
      B.el('div', { class: 'lib__meta-row' }, [
        B.el('p', { class: 'lib__count', id: 'lib-count', role: 'status', 'aria-live': 'polite', text: '共 ' + B.hexagrams.length + ' 卦' }),
        B.el('p', { class: 'lib__hint muted small', text: '卦卡可用方向键浏览，回车打开详情。' })
      ])
    ]);

    refs.search = searchField.querySelector('#lib-search');
    refs.upperGroup = upperGroup;
    refs.lowerGroup = lowerGroup;
    refs.reset = resetBtn;
    refs.count = toolbar.querySelector('#lib-count');
    return toolbar;
  }

  function buildSegmented(id, labelId, labelText) {
    var group = B.el('div', {
      class: 'segmented lib__segmented',
      id: id,
      role: 'group',
      'aria-labelledby': labelId
    });
    var opts = [{ value: 'all', label: '全部', sym: '' }];
    B.trigrams.forEach(function (t) {
      opts.push({ value: t.name, label: t.name, sym: t.sym });
    });
    opts.forEach(function (o) {
      var btn = B.el('button', {
        type: 'button',
        class: 'segment lib__segment' + (o.value === 'all' ? ' is-active' : ''),
        'data-value': o.value,
        'aria-pressed': o.value === 'all' ? 'true' : 'false'
      });
      if (o.sym) btn.appendChild(B.el('span', { class: 'lib__seg-sym', 'aria-hidden': 'true', text: o.sym }));
      btn.appendChild(B.el('span', { class: 'lib__seg-name', text: o.label }));
      group.appendChild(btn);
    });
    return group;
  }

  function buildCard(h) {
    var aria = '第' + h.num + '卦，' + h.name + '，' + h.fullName +
      '，上' + h.upper.name + '下' + h.lower.name + '，打开详情';
    var card = B.el('button', {
      type: 'button',
      class: 'lib__card',
      'data-num': h.num,
      'aria-label': aria
    });

    card.appendChild(B.el('span', { class: 'lib__card-top' }, [
      B.el('span', { class: 'lib__num', text: B.pad2(h.num) }),
      B.el('span', { class: 'lib__card-tris', 'aria-hidden': 'true' }, [
        B.el('span', { class: 'lib__card-tri' }, [
          B.el('span', { class: 'lib__card-tri-k', text: '上' }),
          B.el('span', { class: 'lib__card-tri-sym', text: h.upper.sym })
        ]),
        B.el('span', { class: 'lib__card-tri' }, [
          B.el('span', { class: 'lib__card-tri-k', text: '下' }),
          B.el('span', { class: 'lib__card-tri-sym', text: h.lower.sym })
        ])
      ])
    ]));

    var hexWrap = B.el('span', { class: 'lib__card-hex' });
    hexWrap.appendChild(B.renderHex(h.binary, { size: 'xs' }));
    card.appendChild(hexWrap);

    card.appendChild(B.el('span', { class: 'lib__card-name' }, [
      B.el('span', { class: 'lib__name serif', text: h.name }),
      B.el('span', { class: 'lib__card-pinyin', text: h.pinyin })
    ]));
    card.appendChild(B.el('span', { class: 'lib__card-full', text: h.fullName }));
    card.appendChild(B.el('span', {
      class: 'lib__card-mean muted',
      text: B.firstSentence(h.guaci.anal, 30)
    }));

    return card;
  }

  function buildGrid() {
    var grid = B.el('div', {
      class: 'lib__grid',
      id: 'lib-grid',
      'aria-label': '六十四卦列表'
    });
    B.hexagrams.slice().sort(function (a, b) { return a.num - b.num; }).forEach(function (h) {
      var card = buildCard(h);
      cardByNum[h.num] = card;
      cardsBuilt.push(card);
      grid.appendChild(card);
    });
    refs.grid = grid;
    return grid;
  }

  function buildEmpty() {
    var box = B.el('div', { class: 'empty lib__empty', id: 'lib-empty', hidden: true }, [
      B.el('p', { class: 'empty__title', text: '没有找到相应的卦' }),
      B.el('p', { class: 'muted small', text: '换个卦名、拼音或序号，或清除筛选条件再看看。' }),
      B.el('button', {
        type: 'button',
        class: 'btn btn--ghost btn--sm',
        'data-reset': 'empty',
        text: '清除条件'
      })
    ]);
    refs.empty = box;
    return box;
  }

  function buildModal() {
    var modal = B.el('div', {
      class: 'modal lib__modal',
      id: 'lib-modal',
      'aria-hidden': 'true'
    });

    var dialog = B.el('div', {
      class: 'modal__dialog lib__modal-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'lib-modal-title',
      tabindex: '-1'
    });

    var heading = B.el('div', { class: 'lib__modal-heading' }, [
      B.el('p', { class: 'eyebrow lib__modal-num', id: 'lib-modal-num', text: '' }),
      B.el('h2', { class: 'modal__title lib__modal-title serif', id: 'lib-modal-title', text: '' }),
      B.el('p', { class: 'lib__modal-sub' }, [
        B.el('span', { class: 'lib__modal-pinyin', id: 'lib-modal-pinyin', text: '' }),
        B.el('span', { class: 'lib__modal-dot', 'aria-hidden': 'true', text: '·' }),
        B.el('span', { class: 'lib__modal-full', id: 'lib-modal-full', text: '' })
      ])
    ]);

    var closeBtn = B.el('button', {
      type: 'button',
      class: 'modal__close btn btn--icon lib__modal-close',
      id: 'lib-modal-close',
      'aria-label': '关闭卦象详情',
      text: '×'
    });

    var head = B.el('div', { class: 'modal__head' }, [heading, closeBtn]);
    var body = B.el('div', { class: 'modal__body lib__modal-body', id: 'lib-modal-body' });

    dialog.appendChild(head);
    dialog.appendChild(body);
    modal.appendChild(dialog);

    refs.modal = modal;
    refs.dialog = dialog;
    refs.modalBody = body;
    refs.modalClose = closeBtn;
    refs.modalNum = heading.querySelector('#lib-modal-num');
    refs.modalTitle = heading.querySelector('#lib-modal-title');
    refs.modalPinyin = heading.querySelector('#lib-modal-pinyin');
    refs.modalFull = heading.querySelector('#lib-modal-full');
    return modal;
  }

  /* ---------------- 详情渲染 ---------------- */

  function sectionHead(title, sub) {
    var children = [B.el('h3', { class: 'lib__sec-title serif', text: title })];
    if (sub) children.push(B.el('span', { class: 'lib__sec-sub muted small', text: sub }));
    return B.el('div', { class: 'lib__sec-head' }, children);
  }

  function analysisRow(key, text) {
    var p = B.el('p', { class: 'analysis lib__analysis' });
    p.appendChild(B.el('span', { class: 'analysis__k lib__analysis-k', text: key }));
    p.appendChild(B.el('span', { class: 'lib__analysis-text', text: text || '' }));
    return p;
  }

  function renderTri(roleTri, roleLabel) {
    var t = TRI_BY_NAME[roleTri.name] || {};
    var image = roleTri.image || t.image || '';
    var meta = [];
    if (image) meta.push('象 ' + image);
    if (t.virtue) meta.push('卦德 ' + t.virtue);

    var info = B.el('div', { class: 'lib__tri-info' }, [
      B.el('span', { class: 'lib__tri-role', text: roleLabel }),
      B.el('span', { class: 'lib__tri-name' }, [
        B.el('strong', { class: 'lib__tri-char serif', text: roleTri.name }),
        B.el('span', { class: 'lib__tri-meta muted small', text: meta.join(' · ') })
      ])
    ]);

    return B.el('div', { class: 'lib__tri' }, [
      B.el('span', { class: 'lib__tri-sym', 'aria-hidden': 'true', text: roleTri.sym }),
      info
    ]);
  }

  function renderLine(item, isYong) {
    var wrap = B.el('div', {
      class: 'lib__line' + (isYong ? ' lib__line--yong' : '')
    });
    wrap.appendChild(B.el('div', { class: 'lib__line-head' }, [
      B.el('span', { class: 'badge lib__line-label', text: item.label }),
      B.el('p', { class: 'lib__line-text serif', text: item.text || '' })
    ]));
    if (item.trans) wrap.appendChild(analysisRow('译文', item.trans));
    if (item.anal) wrap.appendChild(analysisRow('解析', item.anal));
    return wrap;
  }

  function renderDetail(h) {
    refs.modalNum.textContent = '第 ' + h.num + ' 卦';
    refs.modalTitle.textContent = h.name + ' · ' + h.fullName;
    refs.modalPinyin.textContent = h.pinyin;
    refs.modalFull.textContent = '上' + h.upper.name + '下' + h.lower.name;

    while (refs.modalBody.firstChild) {
      refs.modalBody.removeChild(refs.modalBody.firstChild);
    }

    var bigHex = B.el('div', { class: 'lib__bighex' });
    bigHex.appendChild(B.renderHex(h.binary, {
      size: 'lg',
      labels: true,
      ariaLabel: B.hexAria(h)
    }));

    var side = B.el('aside', { class: 'lib__detail-side' }, [
      bigHex,
      B.el('div', { class: 'lib__trigrams' }, [
        renderTri(h.upper, '上卦'),
        renderTri(h.lower, '下卦')
      ])
    ]);

    var guaci = B.el('section', { class: 'lib__block lib__block--guaci' }, [
      sectionHead('卦辞', '原文 · 译文 · 解析'),
      B.el('blockquote', { class: 'quote lib__quote serif', text: h.guaci.text || '' }),
      analysisRow('译文', h.guaci.trans),
      analysisRow('解析', h.guaci.anal)
    ]);

    var lineList = B.el('div', { class: 'lib__lines' });
    (h.lines || []).forEach(function (item) { lineList.appendChild(renderLine(item, false)); });
    if (h.yong) lineList.appendChild(renderLine(h.yong, true));

    var linesBlock = B.el('section', { class: 'lib__block lib__block--lines' }, [
      sectionHead('六爻', '自初爻至上爻'),
      lineList
    ]);

    var note = B.el('p', {
      class: 'lib__note muted small',
      text: '内容依《周易》通行本整理，仅供传统文化研究与参考，请勿据以决断重大事务。'
    });

    var main = B.el('div', { class: 'lib__detail-main' }, [guaci, linesBlock, note]);
    var detail = B.el('div', { class: 'lib__detail' }, [side, main]);

    refs.modalBody.appendChild(detail);
    refs.modalBody.scrollTop = 0;
  }

  /* ---------------- 哈希同步 ---------------- */

  function setHash(num) {
    var hash = '#/library' + (num ? '?num=' + num : '');
    if (global.location.hash === hash) return;
    try {
      global.history.replaceState(null, '', hash);
    } catch (e) {
      /* 个别 file:// 环境限制 replaceState，静默降级 */
    }
  }

  /* ---------------- 详情开关 ---------------- */

  function openDetail(num, trigger, opts) {
    var h = B.findHex(num);
    if (!h) return;
    var o = opts || {};

    if (!isOpen) {
      prevBodyOverflow = document.body.style.overflow;
      lastTrigger = trigger || cardByNum[h.num] || null;
    } else if (trigger) {
      lastTrigger = trigger;
    }

    renderDetail(h);
    openNum = h.num;
    isOpen = true;

    refs.modal.classList.add('is-open');
    refs.modal.setAttribute('aria-hidden', 'false');
    refs.modal.setAttribute('aria-modal', 'true');
    refs.dialog.setAttribute('aria-modal', 'true');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onDocKeydown, true);
    document.addEventListener('focusin', onDocFocusIn, true);

    if (o.updateHash !== false) setHash(h.num);
    refs.modalClose.focus();
  }

  function closeDetail(opts) {
    if (!isOpen) return;
    var o = opts || {};
    isOpen = false;
    openNum = null;

    refs.modal.classList.remove('is-open');
    refs.modal.setAttribute('aria-hidden', 'true');
    refs.modal.removeAttribute('aria-modal');
    refs.dialog.removeAttribute('aria-modal');
    document.body.style.overflow = prevBodyOverflow || '';
    prevBodyOverflow = '';

    document.removeEventListener('keydown', onDocKeydown, true);
    document.removeEventListener('focusin', onDocFocusIn, true);

    if (o.updateHash !== false) setHash(null);

    var trigger = lastTrigger;
    lastTrigger = null;
    if (o.restoreFocus !== false) {
      if (trigger && document.contains(trigger) && !trigger.hidden) {
        trigger.focus();
      } else if (refs.search) {
        refs.search.focus();
      }
    }
  }

  function onDocKeydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closeDetail({});
      return;
    }
    if (e.key !== 'Tab') return;

    var nodes = focusableNodes();
    if (!nodes.length) {
      e.preventDefault();
      refs.dialog.focus();
      return;
    }
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    var active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !refs.dialog.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !refs.dialog.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }

  function focusableNodes() {
    var all = refs.dialog.querySelectorAll(FOCUSABLE);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var node = all[i];
      if (node.hidden || node.getAttribute('aria-hidden') === 'true') continue;
      if (node.getClientRects().length) out.push(node);
    }
    return out;
  }

  function onDocFocusIn(e) {
    if (!isOpen) return;
    if (!refs.dialog.contains(e.target) && e.target !== refs.dialog) {
      refs.modalClose.focus();
    }
  }

  /* ---------------- 卦卡键盘导航 ---------------- */

  function visibleCards() {
    return cardsBuilt.filter(function (c) { return !c.hidden; });
  }

  function columnCount(list) {
    if (list.length < 2) return 1;
    var top = list[0].getBoundingClientRect().top;
    var cols = 1;
    for (var i = 1; i < list.length; i++) {
      if (Math.abs(list[i].getBoundingClientRect().top - top) < 2) cols++;
      else break;
    }
    return cols;
  }

  function onGridKeydown(e) {
    var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (keys.indexOf(e.key) < 0) return;
    var list = visibleCards();
    if (!list.length) return;

    var active = document.activeElement;
    var idx = list.indexOf(active);
    if (idx < 0) idx = 0;
    var next = idx;

    if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = list.length - 1;
    } else if (e.key === 'ArrowRight') {
      next = Math.min(list.length - 1, idx + 1);
    } else if (e.key === 'ArrowLeft') {
      next = Math.max(0, idx - 1);
    } else if (e.key === 'ArrowDown') {
      next = Math.min(list.length - 1, idx + columnCount(list));
    } else if (e.key === 'ArrowUp') {
      next = Math.max(0, idx - columnCount(list));
    }

    if (next === idx) return;
    e.preventDefault();
    list[next].focus();
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents() {
    refs.search.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchTimer = null;
        applyFilter();
      }, 110);
    });

    refs.search.addEventListener('search', function () {
      if (searchTimer) {
        clearTimeout(searchTimer);
        searchTimer = null;
      }
      applyFilter();
    });

    refs.search.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (searchTimer) {
        clearTimeout(searchTimer);
        searchTimer = null;
      }
      applyFilter();
      var list = visibleCards();
      if (list.length === 1) {
        openDetail(Number(list[0].getAttribute('data-num')), list[0], { updateHash: true });
      }
    });

    refs.reset.addEventListener('click', resetFilters);

    [refs.upperGroup, refs.lowerGroup].forEach(function (group, gi) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.segment') : null;
        if (!btn || !group.contains(btn)) return;
        var value = btn.getAttribute('data-value');
        if (gi === 0) state.upper = value;
        else state.lower = value;
        syncPressed(group, value);
        applyFilter();
      });
    });

    refs.grid.addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.lib__card') : null;
      if (!card || !refs.grid.contains(card)) return;
      openDetail(Number(card.getAttribute('data-num')), card, { updateHash: true });
    });

    refs.grid.addEventListener('keydown', onGridKeydown);

    refs.empty.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-reset]') : null;
      if (btn) resetFilters();
    });

    refs.modalClose.addEventListener('click', function () { closeDetail({}); });

    refs.modal.addEventListener('click', function (e) {
      var t = e.target;
      if (t === refs.modal) closeDetail({});
    });

    /* app.js 切换路由时不调用 hide()：监听 hashchange，离开本页时收起详情并解锁滚动。
       注意：本页内点击卡片/关闭只做 replaceState，不会触发 hashchange。 */
    global.addEventListener('hashchange', function () {
      if (!isOpen) return;
      var hash = global.location.hash || '';
      if (!/^#\/library(\?|$)/.test(hash)) {
        closeDetail({ updateHash: false, restoreFocus: false });
      }
    });
  }

  /* ---------------- 视图契约 ---------------- */

  function mount(el) {
    if (built) return;
    built = true;

    buildIndex();

    var lib = B.el('div', { class: 'lib' }, [
      buildHead(),
      buildToolbar(),
      buildGrid(),
      buildEmpty()
    ]);
    el.appendChild(lib);

    /* portal：模态挂到 body。
       .view.is-active 的切页动画带 transform，会让 .view 成为 position:fixed 后代的
       containing block，导致 .modal 相对整节内容居中而不是视口。挂到 body 可彻底避开。 */
    document.body.appendChild(buildModal());

    bindEvents();
    applyFilter();
  }

  function show(params) {
    if (!built) return;
    var raw = params && typeof params.get === 'function' ? params.get('num') : null;
    var num = raw == null || raw === '' ? NaN : Number(raw);

    if (num && B.findHex(num)) {
      var target = Math.floor(num);
      if (!isOpen || openNum !== target) {
        openDetail(target, cardByNum[target] || null, { updateHash: false });
      }
    } else if (isOpen) {
      closeDetail({ updateHash: false, restoreFocus: false });
    }
  }

  function hide() {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    if (isOpen) closeDetail({ updateHash: false, restoreFocus: false });
  }

  global.BAGUA_VIEWS = global.BAGUA_VIEWS || {};
  global.BAGUA_VIEWS.library = {
    id: 'library',
    mount: mount,
    show: show,
    hide: hide
  };
})(window);
