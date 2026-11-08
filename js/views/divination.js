/* =============================================================
 * views/divination.js — 摇卦（金钱卦）：三枚铜钱 × 6 爻
 * ============================================================= */
(function (global) {
  'use strict';

  var B = global.BAGUA;

  /* 延迟解析：BAGUA_UI 由 app.js 定义，视图脚本不保证加载顺序 */
  function ui() { return global.BAGUA_UI || {}; }

  var COIN_MS = 900;          // 与 --coin-flip-duration 保持一致
  var HISTORY_KEY = 'bagua.history.v1';
  var MAX_HISTORY = 8;

  var state = {
    question: '',
    values: [],
    result: null,
    busy: false
  };
  var refs = {};
  var rootEl = null;

  /* ---------------- 小工具 ---------------- */
  function lineKind(value) {
    if (value === 9) return { value: 9, yang: 1, moving: true, name: '老阳', glyph: '○', to: '阴' };
    if (value === 7) return { value: 7, yang: 1, moving: false, name: '少阳', glyph: '—', to: '' };
    if (value === 8) return { value: 8, yang: 0, moving: false, name: '少阴', glyph: '- -', to: '' };
    return { value: 6, yang: 0, moving: true, name: '老阴', glyph: '×', to: '阳' };
  }

  function chip(text, kind) {
    return B.el('span', { class: 'chip' + (kind ? ' ' + kind : ''), text: text });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* ---------------- 骨架 ---------------- */
  function mount(root) {
    rootEl = root;
    root.classList.add('divi-view');

    /* ---- hero ---- */
    var hero = B.el('header', { class: 'divi__hero' }, [
      B.el('p', { class: 'eyebrow', text: '金钱卦 · 三枚铜钱' }),
      B.el('h1', { class: 'divi__title', text: '静心起卦' }),
      B.el('p', {
        class: 'divi__lede',
        text: '心中默念所问之事，摇六次，自下而上成卦。老阳老阴为动爻，动则生变。'
      })
    ]);

    var wrap = B.el('div', { class: 'divi' });
    var main = B.el('div', { class: 'divi__main' });
    var side = B.el('aside', { class: 'divi__side' });

    /* ---- 提问 ---- */
    var askInput = B.el('input', {
      class: 'input',
      id: 'divi-question',
      type: 'text',
      maxlength: '40',
      placeholder: '如：这一年的工作方向',
      autocomplete: 'off',
      enterkeyhint: 'done'
    });
    askInput.addEventListener('input', function () {
      state.question = askInput.value.trim();
    });
    var askCard = B.el('section', { class: 'card ask-card' }, [
      B.el('div', { class: 'card__body' }, [
        B.el('label', { class: 'field', for: 'divi-question' }, [
          B.el('span', { class: 'field__label' }, [
            '所占之事',
            B.el('span', { class: 'muted small', text: '（可留空）' })
          ]),
          askInput
        ]),
        B.el('p', { class: 'field__hint', text: '一事一占。同一件事不必反复起卦，诚心默念即可。' })
      ])
    ]);

    /* ---- 摇卦 ---- */
    var coins = B.el('div', { class: 'coins', id: 'divi-coins' });
    for (var i = 0; i < 3; i++) coins.appendChild(coinNode());

    var badge = B.el('p', { class: 'toss__badge', id: 'divi-toss-badge', role: 'status', 'aria-live': 'polite' });
    badge.textContent = '三枚铜钱 · 静候落定';

    var hint = B.el('p', { class: 'toss__hint', id: 'divi-hint', text: '第 1 爻 · 自下而上' });

    var progress = B.el('div', { class: 'divi-progress', id: 'divi-progress', 'aria-hidden': 'true' });
    for (var d = 0; d < 6; d++) progress.appendChild(B.el('span', { class: 'divi-progress__dot' }));

    var btnToss = B.el('button', { class: 'btn btn--primary', type: 'button', id: 'divi-toss' }, ['摇一次']);
    var btnAuto = B.el('button', { class: 'btn btn--ghost', type: 'button', id: 'divi-auto' }, ['一键六爻']);
    var btnReset = B.el('button', {
      class: 'btn btn--ghost btn--icon', type: 'button', id: 'divi-reset',
      title: '重新起卦', 'aria-label': '重新起卦'
    }, ['↺']);

    var tossCard = B.el('section', { class: 'card toss-card', id: 'divi-toss-card' }, [
      B.el('div', { class: 'toss-card__stage' }, [coins, badge]),
      hint,
      progress,
      B.el('div', { class: 'row toss-card__actions' }, [btnToss, btnAuto, btnReset]),
      B.el('p', {
        class: 'toss-card__note',
        text: '正面为阳、反面为阴。三正为老阳，二正一反为少阳，一反二正为少阴，三反为老阴。'
      })
    ]);

    /* ---- 卦象预览 ---- */
    var preview = B.el('div', { class: 'preview-card__hex', id: 'divi-preview' });
    var previewSub = B.el('p', { class: 'card__sub', id: 'divi-preview-sub', text: '已摇 0 / 6 爻' });
    var meta = B.el('div', { class: 'preview-card__meta', id: 'divi-preview-meta' });
    var previewBody = B.el('div', { class: 'card__body preview-card__body is-empty' }, [preview, meta]);

    var previewCard = B.el('section', { class: 'card preview-card' }, [
      B.el('div', { class: 'card__head' }, [
        B.el('h2', { class: 'card__title', text: '成卦' }),
        previewSub
      ]),
      previewBody
    ]);

    main.appendChild(askCard);
    main.appendChild(tossCard);
    main.appendChild(previewCard);

    /* ---- 侧栏 ---- */
    var sideCard = B.el('section', { class: 'card side-card' }, [
      B.el('h2', { class: 'card__title', text: '起卦要诀' }),
      B.el('ol', { class: 'side-card__list' }, [
        B.el('li', { text: '三枚铜钱，摇六次，自下而上记：初、二、三、四、五、上。' }),
        B.el('li', { text: '三正为老阳（○），二正一反为少阳（—），一反二正为少阴（- -），三反为老阴（×）。' }),
        B.el('li', { text: '老阳老阴是动爻。本卦所有动爻反转阴阳，即是变卦。' }),
        B.el('li', { text: '解卦先看动爻爻辞；无动爻则以本卦卦辞为断。' })
      ]),
      B.el('a', { class: 'btn btn--ghost btn--sm', href: '#/basics' }, ['查看完整方法'])
    ]);

    var history = B.el('div', { class: 'history', id: 'divi-history' });
    var historyCard = B.el('section', { class: 'card side-card history-card' }, [
      B.el('h2', { class: 'card__title', text: '最近起卦' }),
      history
    ]);

    side.appendChild(sideCard);
    side.appendChild(historyCard);

    wrap.appendChild(main);
    wrap.appendChild(side);

    var result = B.el('div', { class: 'result', id: 'divi-result' });
    result.hidden = true;

    root.appendChild(hero);
    root.appendChild(wrap);
    root.appendChild(result);

    refs = {
      root: root, coins: coins, badge: badge, hint: hint, progress: progress,
      btnToss: btnToss, btnAuto: btnAuto, btnReset: btnReset,
      preview: preview, previewSub: previewSub, meta: meta, previewBody: previewBody,
      result: result, question: askInput, history: history
    };

    btnToss.addEventListener('click', function () { tossOnce(); });
    btnAuto.addEventListener('click', autoRun);
    btnReset.addEventListener('click', function () { reset(); ui().toast('已重新起卦', 'ok'); });

    renderPreview();
    renderHistory();
    updateButtons();
  }

  function coinNode() {
    return B.el('div', { class: 'coin', dataset: { face: 'yang' } }, [
      B.el('div', { class: 'coin__inner' }, [
        B.el('div', { class: 'coin__face coin__face--front' }, [
          B.el('span', { class: 'coin__glyph', text: '乾' })
        ]),
        B.el('div', { class: 'coin__face coin__face--back' }, [
          B.el('span', { class: 'coin__glyph', text: '坤' })
        ])
      ])
    ]);
  }

  function setCoinFaces(coins) {
    if (!refs.coins) return;
    var nodes = refs.coins.querySelectorAll('.coin');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].dataset.face = coins[i] ? 'yang' : 'yin';
    }
  }

  /* ---------------- 摇卦 ---------------- */
  function tossOnce(onDone) {
    if (state.busy || state.result || state.values.length >= 6) return;
    state.busy = true;
    updateButtons();

    var toss = B.newToss();
    refs.coins.classList.add('is-tossing');
    refs.badge.textContent = '摇卦中…';
    refs.badge.className = 'toss__badge';

    setTimeout(function () {
      refs.coins.classList.remove('is-tossing');
      setCoinFaces(toss.coins);
      finishToss(toss);
      state.busy = false;
      updateButtons();
      if (typeof onDone === 'function') onDone();
    }, COIN_MS);
  }

  function finishToss(toss) {
    state.values.push(toss.value);

    var faces = toss.coins.map(function (c) { return c ? '正' : '反'; }).join(' ');
    var kind = lineKind(toss.value);
    refs.badge.className = 'toss__badge' + (kind.moving ? ' is-moving' : '');
    clear(refs.badge);
    refs.badge.appendChild(B.el('span', { class: 'toss__face', text: faces }));
    refs.badge.appendChild(document.createTextNode('  '));
    refs.badge.appendChild(B.el('span', { class: 'toss__kind', text: kind.name + ' ' + kind.glyph }));

    renderPreview();
    renderProgress();
    updateHint();

    if (state.values.length === 6) {
      setTimeout(complete, 240);
    }
  }

  function autoRun() {
    if (state.busy || state.result) return;
    if (state.values.length >= 6) return;
    refs.btnAuto.disabled = true;
    (function next() {
      if (state.result) { refs.btnAuto.disabled = false; return; }
      if (state.values.length >= 6) { refs.btnAuto.disabled = false; return; }
      tossOnce(function () { setTimeout(next, 140); });
    })();
  }

  function complete() {
    if (state.values.length !== 6) return;
    state.result = B.buildResult(state.values, state.question);
    renderResult(state.result);
    renderPreview();
    addHistory(state.values, state.question);
    updateButtons();
    document.title = '第' + state.result.ben.num + '卦 ' + state.result.ben.name + ' — 易 · 六十四卦';
    setTimeout(function () {
      if (refs.result && !refs.result.hidden) {
        refs.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
        refs.result.setAttribute('tabindex', '-1');
        try { refs.result.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }, 90);
  }

  function reset() {
    state.values = [];
    state.result = null;
    state.busy = false;
    state.question = refs.question ? refs.question.value.trim() : '';
    if (refs.coins) refs.coins.classList.remove('is-tossing');
    setCoinFaces([1, 1, 1]);
    refs.badge.className = 'toss__badge';
    refs.badge.textContent = '三枚铜钱 · 静候落定';
    refs.result.hidden = true;
    clear(refs.result);
    renderPreview();
    renderProgress();
    updateHint();
    updateButtons();
    document.title = '摇卦 · 金钱卦 — 易 · 六十四卦';
    if (refs.root) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (location.hash.indexOf('?') >= 0) {
      try { history.replaceState(null, '', '#/divination'); } catch (e) { /* ignore */ }
    }
  }

  /* ---------------- 预览 / 进度 ---------------- */
  function renderPreview() {
    if (!refs.preview) return;
    clear(refs.preview);

    var items = state.values.map(function (v) {
      var k = lineKind(v);
      return { yang: k.yang, moving: k.moving };
    });
    var n = items.length;
    var aria = n === 0 ? '尚未起卦，六爻皆空'
      : (n < 6 ? '已成 ' + n + ' 爻' : (state.result ? B.hexAria(state.result.ben, state.result.movingLabels) : '已成六爻'));

    refs.preview.appendChild(B.renderHex(items, {
      size: 'md',
      labels: true,
      showMark: true,
      ariaLabel: aria
    }));

    if (refs.previewSub) {
      refs.previewSub.textContent = n === 0 ? '已摇 0 / 6 爻' : '已摇 ' + n + ' / 6 爻';
    }
    if (refs.previewBody) {
      refs.previewBody.classList.toggle('is-empty', n === 0);
    }

    if (refs.meta) {
      clear(refs.meta);
      if (n < 6) {
        refs.meta.appendChild(chip('已成 ' + n + ' / 6 爻'));
        refs.meta.appendChild(chip('下一爻：第 ' + (n + 1) + ' 爻 · 自下而上'));
        if (n > 0) {
          var movingNow = state.values.map(lineKind).filter(function (k) { return k.moving; }).length;
          if (movingNow) refs.meta.appendChild(chip('动爻 ' + movingNow + ' 个', 'chip--verm'));
        }
      } else if (state.result) {
        var ben = state.result.ben;
        refs.meta.appendChild(chip('本卦 ' + ben.name + ' · ' + ben.fullName, 'chip--gold'));
        refs.meta.appendChild(chip('上' + ben.upper.name + '（' + ben.upper.image + '） 下' + ben.lower.name + '（' + ben.lower.image + '）'));
        if (state.result.moving.length) {
          refs.meta.appendChild(chip('动爻 ' + state.result.movingLabels.join('、'), 'chip--verm'));
        } else {
          refs.meta.appendChild(chip('六爻皆静 · 无变卦'));
        }
      }
    }
  }

  function renderProgress() {
    if (!refs.progress) return;
    var dots = refs.progress.querySelectorAll('.divi-progress__dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-done', i < state.values.length);
    }
  }

  function updateHint() {
    if (!refs.hint) return;
    if (state.values.length === 6) {
      refs.hint.textContent = '六爻已成 · 卦象已定';
    } else {
      refs.hint.textContent = '第 ' + (state.values.length + 1) + ' 爻 · 自下而上';
    }
  }

  function updateButtons() {
    var done = state.values.length >= 6 || !!state.result;
    if (refs.btnToss) refs.btnToss.disabled = state.busy || done;
    if (refs.btnAuto) refs.btnAuto.disabled = state.busy || done;
    if (refs.btnReset) refs.btnReset.disabled = state.busy;
  }

  /* ---------------- 结果 ---------------- */
  function renderResult(result) {
    var box = refs.result;
    clear(box);
    box.hidden = false;
    box.appendChild(resultHead(result));
    box.appendChild(resultCharts(result));

    var body = B.el('div', { class: 'result__body' });
    body.appendChild(guaciBlock(result.ben, '卦辞', '本卦'));
    body.appendChild(linesBlock(result));
    if (result.bian) body.appendChild(guaciBlock(result.bian, '卦辞', '变卦'));
    body.appendChild(guideBlock(result));
    body.appendChild(resultFoot(result));
    box.appendChild(body);
  }

  function resultHead(result) {
    var ben = result.ben;
    var actions = B.el('div', { class: 'result__actions' }, [
      B.el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'result-copy' }, ['复制全文']),
      B.el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'result-share' }, ['复制分享链接']),
      B.el('button', { class: 'btn btn--primary btn--sm', type: 'button', id: 'result-again' }, ['再起一卦'])
    ]);

    var head = B.el('div', { class: 'result__head' }, [
      B.el('div', { class: 'result__titles' }, [
        B.el('p', { class: 'eyebrow', text: '第 ' + ben.num + ' 卦 · ' + ben.fullName }),
        B.el('h2', { class: 'result__name' }, [
          ben.name,
          B.el('span', { class: 'result__pinyin', text: ben.pinyin || '' })
        ]),
        B.el('p', { class: 'result__fullname', text: '上' + ben.upper.name + '（' + ben.upper.image + '）·下' + ben.lower.name + '（' + ben.lower.image + '）' + (result.question ? ' · 所问：' + result.question : '') })
      ]),
      actions
    ]);

    actions.querySelector('#result-copy').addEventListener('click', function () {
      copyText(B.resultText(result), '已复制卦象全文');
    });
    actions.querySelector('#result-share').addEventListener('click', function () { shareResult(result); });
    actions.querySelector('#result-again').addEventListener('click', reset);

    return head;
  }

  function resultCharts(result) {
    var ben = result.ben;
    var charts = B.el('div', { class: 'result__charts' });

    charts.appendChild(chartFigure({
      cap: '本卦', hex: ben, lines: result.lines, moving: result.moving,
      highlight: result.moving, title: ben.name
    }));

    if (result.bian) {
      charts.appendChild(B.el('div', { class: 'chart__arrow', 'aria-hidden': 'true', text: '→' }));
      charts.appendChild(chartFigure({
        cap: '变卦', hex: result.bian, highlight: [], title: result.bian.name
      }));
    } else {
      charts.appendChild(B.el('p', { class: 'chart__static muted small', text: '六爻皆静 · 无变卦' }));
    }
    return charts;
  }

  function chartFigure(o) {
    var aria = B.hexAria(o.hex, o.lines ? o.lines.filter(function (l) { return l.moving; }).map(function (l) { return l.label; }) : null);
    var hexEl = o.lines
      ? B.renderHex(o.lines.map(function (l) { return { yang: l.yang, moving: l.moving }; }), {
        size: 'lg', labels: true, highlight: o.highlight || [], ariaLabel: aria
      })
      : B.renderHex(o.hex.binary, { size: 'lg', labels: true, ariaLabel: aria });

    return B.el('figure', { class: 'chart' + (o.cap === '变卦' ? ' chart--bian' : '') }, [
      B.el('figcaption', { class: 'chart__cap', text: o.cap }),
      B.el('div', { class: 'chart__hex' }, [hexEl]),
      B.el('p', { class: 'chart__name' }, [
        o.title,
        B.el('span', { class: 'chart__full', text: o.hex.fullName })
      ])
    ]);
  }

  function guaciBlock(hex, title, tag) {
    var block = B.el('section', { class: 'block' }, [
      B.el('h3', { class: 'block__title' }, [
        B.el('span', { text: title }),
        B.el('span', { class: 'badge' + (tag === '变卦' ? ' badge--verm' : ''), text: tag })
      ]),
      B.el('blockquote', { class: 'quote', text: hex.guaci.text })
    ]);
    if (hex.guaci.trans) {
      block.appendChild(B.el('p', { class: 'analysis' }, [
        B.el('span', { class: 'analysis__k', text: '译文' }),
        B.el('span', { text: hex.guaci.trans })
      ]));
    }
    if (hex.guaci.anal) {
      block.appendChild(B.el('p', { class: 'analysis' }, [
        B.el('span', { class: 'analysis__k', text: '解析' }),
        B.el('span', { text: hex.guaci.anal })
      ]));
    }
    return block;
  }

  function linesBlock(result) {
    var ben = result.ben;
    var movingCount = result.moving.length;
    var block = B.el('section', { class: 'block' }, [
      B.el('h3', { class: 'block__title' }, [
        B.el('span', { text: '六爻爻辞' }),
        B.el('span', { class: 'badge ' + (movingCount ? 'badge--verm' : ''), text: movingCount ? '动爻 ' + movingCount : '六爻皆静' })
      ])
    ]);
    var list = B.el('ol', { class: 'lines' });

    for (var pos = 5; pos >= 0; pos--) {
      var value = result.values[pos];
      var kind = lineKind(value);
      var data = ben.lines[pos];
      if (!data) continue;

      var item = B.el('li', {
        class: 'line-item' + (kind.moving ? ' is-moving' : ''),
        dataset: { pos: pos + 1, value: value }
      });
      var head = B.el('div', { class: 'line-item__head' }, [
        B.el('span', { class: 'line-item__label', text: data.label }),
        B.el('span', { class: 'line-item__kind', text: kind.name + ' ' + kind.glyph + (kind.moving ? ' → 变' + kind.to : '') })
      ]);
      if (kind.moving) head.appendChild(B.el('span', { class: 'badge badge--verm', text: '动' }));
      item.appendChild(head);

      item.appendChild(B.el('p', { class: 'line-item__text', text: data.text }));
      if (data.trans) {
        item.appendChild(B.el('p', { class: 'analysis' }, [
          B.el('span', { class: 'analysis__k', text: '译文' }),
          B.el('span', { text: data.trans })
        ]));
      }
      if (data.anal) {
        if (kind.moving) {
          item.appendChild(B.el('p', { class: 'analysis' }, [
            B.el('span', { class: 'analysis__k', text: '解析' }),
            B.el('span', { text: data.anal })
          ]));
        } else {
          item.appendChild(B.el('details', { class: 'line-item__more' }, [
            B.el('summary', { text: '解析' }),
            B.el('p', { class: 'analysis' }, [B.el('span', { text: data.anal })])
          ]));
        }
      }
      list.appendChild(item);
    }

    if (ben.yong) {
      var yongItem = B.el('li', { class: 'line-item line-item--yong' }, [
        B.el('div', { class: 'line-item__head' }, [
          B.el('span', { class: 'line-item__label', text: ben.yong.label }),
          B.el('span', { class: 'line-item__kind', text: '总断' })
        ]),
        B.el('p', { class: 'line-item__text', text: ben.yong.text })
      ]);
      if (ben.yong.trans) {
        yongItem.appendChild(B.el('p', { class: 'analysis' }, [
          B.el('span', { class: 'analysis__k', text: '译文' }),
          B.el('span', { text: ben.yong.trans })
        ]));
      }
      list.appendChild(yongItem);
    }

    block.appendChild(list);
    return block;
  }

  function guideBlock(result) {
    var items = B.guide(result);
    var list = B.el('ul', { class: 'guide' });
    items.forEach(function (text) {
      list.appendChild(B.el('li', { text: text }));
    });
    return B.el('section', { class: 'block block--guide' }, [
      B.el('h3', { class: 'block__title' }, [
        B.el('span', { text: '断卦提示' }),
        B.el('span', { class: 'badge', text: '传统通行之说' })
      ]),
      list
    ]);
  }

  function resultFoot(result) {
    return B.el('div', { class: 'result__foot' }, [
      B.el('p', {
        class: 'small muted',
        text: '起卦时间：' + B.formatTime(result.createdAt) + ' · 卦象是趋势的参照，不是命定的结论。'
      }),
      B.el('a', {
        class: 'btn btn--ghost btn--sm',
        href: '#/library?num=' + result.ben.num
      }, ['查看「' + result.ben.name + '」全解'])
    ]);
  }

  /* ---------------- 分享 ---------------- */
  function shareResult(result) {
    var code = B.encodeResult(result);
    var usp = new URLSearchParams();
    usp.set('r', code);
    if (result.question) usp.set('q', result.question);
    var hash = '#/divination?' + usp.toString();

    var url;
    try {
      if (location.hash !== hash) history.replaceState(null, '', hash);
      url = location.href;
    } catch (e) {
      url = location.origin + location.pathname + hash;
    }
    copyText(url, '分享链接已复制', '复制分享链接', '浏览器拒绝了自动复制：链接已全选，按 Ctrl / ⌘ + C 即可复制。');
  }

  /* ---------------- 复制（失败时弹出可手动复制的面板） ---------------- */
  function copyText(text, okMessage, modalTitle, modalHint) {
    ui().copy(text).then(function (ok) {
      if (ok) {
        ui().toast(okMessage || '已复制', 'ok');
      } else {
        openTextModal(text, modalTitle, modalHint);
      }
    });
  }

  function openTextModal(text, modalTitle, modalHint) {
    // 防重入：同一时刻只允许一个手动复制面板
    if (document.querySelector('.divi__textmodal')) {
      var existing = document.querySelector('.divi__textmodal textarea');
      if (existing) { existing.focus(); existing.select(); }
      return;
    }
    var lastFocus = document.activeElement;
    var bodyOverflow = document.body.style.overflow;

    var area = B.el('textarea', {
      class: 'input divi__copytext',
      readonly: 'readonly',
      spellcheck: 'false',
      rows: '12'
    });
    area.value = text;

    var closeBtn = B.el('button', {
      class: 'modal__close btn btn--icon', type: 'button', 'aria-label': '关闭'
    }, ['×']);

    var dialog = B.el('div', {
      class: 'modal__dialog divi__textmodal-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': modalTitle || '复制卦象全文'
    }, [
      B.el('div', { class: 'modal__head' }, [
        B.el('h2', { class: 'modal__title', text: modalTitle || '复制卦象全文' }),
        closeBtn
      ]),
      B.el('div', { class: 'modal__body divi__textmodal-body' }, [
        B.el('p', {
          class: 'small muted',
          text: modalHint || '浏览器拒绝了自动复制：文本已全选，按 Ctrl / ⌘ + C 即可复制。'
        }),
        area
      ])
    ]);

    var modal = B.el('div', { class: 'modal is-open divi__textmodal', 'aria-hidden': 'false' }, [dialog]);

    function close() {
      modal.classList.remove('is-open');
      document.removeEventListener('keydown', onKey, true);
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      document.body.style.overflow = bodyOverflow;
      if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var focusables = dialog.querySelectorAll('button, textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }

    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      area.focus();
      area.select();
    }, 30);
  }

  /* ---------------- 历史 ---------------- */
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); } catch (e) { /* ignore */ }
  }

  function addHistory(values, question) {
    var list = loadHistory();
    list.unshift({ values: values.slice(), question: question || '', at: Date.now() });
    saveHistory(list);
    renderHistory();
  }

  function renderHistory() {
    if (!refs.history) return;
    var list = loadHistory();
    clear(refs.history);
    if (!list.length) {
      refs.history.appendChild(B.el('p', { class: 'empty empty--sm', text: '还没有起过卦。' }));
      return;
    }
    list.forEach(function (entry) {
      if (!entry || !entry.values || entry.values.length !== 6) return;
      var result = B.buildResult(entry.values, entry.question);
      var ben = result.ben;
      var d = new Date(entry.at);
      var meta = '第' + ben.num + '卦 · ' + (result.moving.length ? '动 ' + result.moving.length + ' 爻' : '静卦') +
        ' · ' + B.pad2(d.getMonth() + 1) + '-' + B.pad2(d.getDate()) + ' ' + B.pad2(d.getHours()) + ':' + B.pad2(d.getMinutes());
      var btn = B.el('button', { class: 'history__item', type: 'button' }, [
        B.el('span', { class: 'history__name', text: ben.name + ' · ' + ben.fullName }),
        B.el('span', { class: 'history__meta', text: meta })
      ]);
      btn.addEventListener('click', function () {
        restore(entry.values, entry.question);
        ui().toast('已载入历史卦象', 'ok');
      });
      refs.history.appendChild(btn);
    });
  }

  /* ---------------- 载入既有卦象 ---------------- */
  function restore(values, question) {
    state.values = values.slice(0, 6);
    state.question = question || '';
    if (refs.question) refs.question.value = state.question;
    state.result = B.buildResult(state.values, state.question);
    setCoinFaces([1, 1, 1]);
    refs.badge.className = 'toss__badge';
    refs.badge.textContent = '三枚铜钱 · 静候落定';
    renderPreview();
    renderProgress();
    updateHint();
    renderResult(state.result);
    updateButtons();
    document.title = '第' + state.result.ben.num + '卦 ' + state.result.ben.name + ' — 易 · 六十四卦';
  }

  /* ---------------- 生命周期 ---------------- */
  function show(params) {
    var r = params && params.get ? params.get('r') : (params ? params.r : null);
    if (!r) return;
    var values = B.decodeResult(r);
    if (!values) return;
    var q = (params.get && params.get('q')) || '';
    if (state.result && B.encodeResult(state.result) === r && state.result.question === q) return;
    restore(values, q);
    // 分享链接打开时，直接把结果带到视野内
    setTimeout(function () {
      if (refs.result && !refs.result.hidden) refs.result.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 60);
  }

  global.BAGUA_VIEWS = global.BAGUA_VIEWS || {};
  global.BAGUA_VIEWS.divination = {
    id: 'divination',
    mount: mount,
    show: show
  };
})(window);
