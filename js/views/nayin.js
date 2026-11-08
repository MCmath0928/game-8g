/* =============================================================
 * nayin.js — 纳音页：出生日期 → 四柱 → 六十甲子纳音 → 三十纳音格局
 * 依赖：BAGUA（engine.js）、BAGUA_GANZHI（ganzhi.js）、BAGUA_NAYIN（data）
 * 纯经典脚本，无外部请求；仅挂载到 #view-nayin。
 * ============================================================= */
(function (global) {
  'use strict';

  var B = global.BAGUA;
  if (!B) return;

  var GZ = global.BAGUA_GANZHI;
  var DATA = B.nayinData || B.nayin || { jiazi: [], nayin: [], profiles: [] };
  /* 延迟解析：BAGUA_UI 由 app.js 定义，视图脚本不保证加载顺序 */
  function ui() { return global.BAGUA_UI || {}; }

  var MIN_YEAR = 1900;
  var MAX_YEAR = 2100;
  var FIELD_ORDER = ['禀赋', '性格', '事业', '感情', '短板', '喜', '忌'];
  var ELEMENT_ORDER = ['金', '木', '水', '火', '土'];
  var CN_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  var els = {};
  var state = { computed: false };

  /* ---------------- 小工具 ---------------- */
  function el(tag, attrs, children) {
    return B.el(tag, attrs, children);
  }

  function toast(msg, kind) {
    var u = ui();
    if (typeof u.toast === 'function') u.toast(msg, kind || 'ok');
  }

  function warn(msg) {
    if (global.console && global.console.warn) global.console.warn('[nayin] ' + msg);
  }

  function pad2(n) {
    return B.pad2 ? B.pad2(n) : (n < 10 ? '0' + n : String(n));
  }

  function elementKey(element) {
    return (B.elementColor && B.elementColor(element)) || 'plain';
  }

  function profileElementKey(profile) {
    return elementKey(profile && profile.element);
  }

  /* 数据的 fields 仅六键，「喜」常以「；忌…」合写；此处拆成七项 */
  function fieldPairs(profile) {
    var fields = (profile && profile.fields) || {};
    var xi = fields['喜'] || '';
    var ji = fields['忌'] || '';
    if (!ji && xi) {
      var parts = String(xi).split(/[；;]\s*忌\s*/);
      if (parts.length > 1) {
        xi = parts[0].replace(/[；;\s]+$/, '');
        ji = parts.slice(1).join('；');
      }
    }
    var merged = { '喜': xi, '忌': ji };
    var out = [];
    FIELD_ORDER.forEach(function (k) {
      var v = Object.prototype.hasOwnProperty.call(merged, k) ? merged[k] : (fields[k] || '');
      if (v) out.push({ k: k, v: v });
    });
    return out;
  }

  /* ---------------- 三十纳音格局详情（复用组件） ---------------- */
  function profileDetail(profile) {
    var card = el('section', {
      class: 'card nayin__detail',
      dataset: { element: profileElementKey(profile) }
    });
    card.appendChild(el('div', { class: 'card__head' }, [
      el('h3', { class: 'card__title', text: profile.name + (profile.alias ? '（' + profile.alias + '）' : '') }),
      el('p', {
        class: 'card__sub',
        text: '第 ' + profile.n + ' 局 · ' + profile.jiazi.join('、') + ' · 五行属' + profile.element
      })
    ]));
    var body = el('div', { class: 'card__body' });
    body.appendChild(el('p', { class: 'nayin__judgement', text: profile.judgement }));
    body.appendChild(fieldList(profile, 'nayin__fields'));
    card.appendChild(body);
    return card;
  }

  function fieldList(profile, extraClass) {
    var wrap = el('div', { class: 'nayin__fields' + (extraClass ? ' ' + extraClass : '') });
    fieldPairs(profile).forEach(function (pair) {
      wrap.appendChild(el('div', { class: 'analysis nayin__field' }, [
        el('span', { class: 'analysis__k', text: pair.k }),
        el('span', { class: 'nayin__field-v', text: pair.v })
      ]));
    });
    return wrap;
  }

  /* ---------------- 四柱卡片 ---------------- */
  function pillarNode(name, pillar) {
    var element = pillar && pillar.nayin ? elementKey(pillar.nayin.element) : 'plain';
    var node = el('div', { class: 'nayin__pillar', dataset: { element: element } });
    node.appendChild(el('p', { class: 'nayin__pillar-name', text: name }));
    var gz = el('p', { class: 'nayin__gz' });
    gz.appendChild(el('span', { class: 'nayin__gan', text: pillar.ganzhi.charAt(0) }));
    gz.appendChild(el('span', { class: 'nayin__zhi', text: pillar.ganzhi.charAt(1) }));
    node.appendChild(gz);
    node.appendChild(el('p', {
      class: 'nayin__pillar-nayin',
      text: pillar.nayin ? pillar.nayin.name : '—'
    }));
    if (pillar.zodiac) {
      node.appendChild(el('p', { class: 'nayin__pillar-note', text: '生肖 ' + pillar.zodiac }));
    }
    return node;
  }

  /* ---------------- 结果渲染 ---------------- */
  function formatInputText(input) {
    var s = '公历 ' + input.y + ' 年 ' + input.m + ' 月 ' + input.d + ' 日';
    if (input.h !== null && input.h !== undefined) s += ' ' + pad2(input.h) + ':' + pad2(input.mi);
    return s;
  }

  function metaChips(result) {
    var chips = [];
    chips.push(el('span', { class: 'badge badge--gold', text: '生肖 ' + (result.year.zodiac || '—') }));
    if (result.year.nayin) {
      chips.push(el('span', { class: 'badge badge--gold', text: '年柱纳音 ' + result.year.nayin.name }));
    }
    if (result.monthBoundary) {
      chips.push(el('span', { class: 'badge', text: '月柱 · ' + result.monthBoundary }));
    }
    if (result.dayBoundary && result.dayBoundary.indexOf('晚子时') >= 0) {
      chips.push(el('span', { class: 'badge', text: '日柱已进次日' }));
    }
    return chips;
  }

  function warningNodes(result) {
    var nodes = [];
    (result.warnings || []).forEach(function (text) {
      nodes.push(el('p', { class: 'nayin__warning' }, [
        el('span', { class: 'badge chip--verm', text: '提示' }),
        el('span', { class: 'nayin__warning-text', text: text })
      ]));
    });
    if (result.ms && result.ms > Date.now()) {
      nodes.push(el('p', { class: 'nayin__warning' }, [
        el('span', { class: 'badge chip--verm', text: '提示' }),
        el('span', { class: 'nayin__warning-text', text: '这是未来日期，仅作演示参考。' })
      ]));
    }
    return nodes;
  }

  function explainBlock() {
    var box = el('div', { class: 'nayin__explain' });
    box.appendChild(el('p', { class: 'nayin__explain-title', text: '排盘口径与算法说明' }));
    var list = el('ul', { class: 'nayin__explain-list' });
    var rows = [
      ['年柱以立春为界', '立春之前仍作上一年干支，不以农历正月初一换年；故 1、2 月出生者的年柱常与「春节属相」不同。'],
      ['月柱以节气为界', '以十二「节」（立春、惊蛰、清明…）交节换月，不以农历初一月；交节时刻前后数分钟即可能换柱。'],
      ['日柱以 23:00 换日', '23:00 起按次日干支计，称「晚子时」；0:00–1:00 为「早子时」。'],
      ['时柱可留空', '时辰由出生时刻与当日日干推得；留空则只排年、月、日三柱，年、月、日柱不受影响。'],
      ['离线天文近似', '节气时刻由太阳视黄经迭代求得，误差约 ±10 分钟；出生时刻极近节气交界时会给出提示，请自行核对。']
    ];
    rows.forEach(function (row) {
      var li = el('li');
      li.appendChild(el('strong', { text: row[0] }));
      li.appendChild(document.createTextNode('：' + row[1]));
      list.appendChild(li);
    });
    box.appendChild(list);
    box.appendChild(el('p', {
      class: 'nayin__hint',
      text: '纳音属传统命理文化，仅供文化参考，不构成任何决策依据。'
    }));
    return box;
  }

  function renderResult(input, result) {
    var wrap = els.result;
    wrap.textContent = '';
    wrap.hidden = false;
    state.computed = true;

    wrap.appendChild(el('div', { class: 'nayin__result-head' }, [
      el('p', { class: 'eyebrow', text: '四柱排盘' }),
      el('h2', { class: 'nayin__result-title', tabindex: '-1', text: formatInputText(input) }),
      el('div', { class: 'nayin__meta' }, metaChips(result))
    ]));

    var pillars = el('div', {
      class: 'nayin__pillars' + (result.hour ? '' : ' nayin__pillars--3')
    });
    pillars.appendChild(pillarNode('年柱', result.year));
    pillars.appendChild(pillarNode('月柱', result.month));
    pillars.appendChild(pillarNode('日柱', result.day));
    if (result.hour) pillars.appendChild(pillarNode('时柱', result.hour));
    wrap.appendChild(pillars);

    if (!result.hour) {
      wrap.appendChild(el('p', {
        class: 'nayin__hint',
        text: '未填时辰，时柱从略。前三柱照常推排，年柱纳音与格局不受影响。'
      }));
    } else if (result.dayBoundary && result.dayBoundary.indexOf('晚子时') >= 0) {
      wrap.appendChild(el('p', {
        class: 'nayin__hint',
        text: '出生时刻在 23:00 之后：已按「晚子时」换日，日柱进为次日干支。'
      }));
    }

    var warns = warningNodes(result);
    if (warns.length) {
      var box = el('div', { class: 'nayin__warnings' });
      warns.forEach(function (node) { box.appendChild(node); });
      wrap.appendChild(box);
    }

    var profile = B.profileOfJiazi(result.year.ganzhi);
    if (profile) {
      wrap.appendChild(profileDetail(profile));
    } else {
      wrap.appendChild(el('p', {
        class: 'nayin__hint',
        text: '未找到「' + result.year.ganzhi + '」对应的纳音格局数据。'
      }));
    }

    wrap.appendChild(explainBlock());
  }

  /* ---------------- 输入解析与校验 ---------------- */
  function parseDateValue(value) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value || '').trim());
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var check = new Date(Date.UTC(y, mo - 1, d));
    if (!check || isNaN(check.getTime())) return null;
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
    if (y < MIN_YEAR || y > MAX_YEAR) return null;
    return { y: y, m: mo, d: d };
  }

  function parseTimeValue(value) {
    var m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value || '').trim());
    if (!m) return null;
    var h = Number(m[1]);
    var mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return { h: h, mi: mi };
  }

  function readInputs() {
    var rawDate = String(els.date.value || '').trim();
    if (!rawDate) {
      toast('请先选择出生日期。', 'warn');
      try { els.date.focus(); } catch (e) { warn(e && e.message); }
      return null;
    }
    var date = parseDateValue(rawDate);
    if (!date) {
      var yearMatch = /^(\d{1,4})/.exec(rawDate);
      var year = yearMatch ? Number(yearMatch[1]) : 0;
      if (year && (year < MIN_YEAR || year > MAX_YEAR)) {
        toast('仅支持 ' + MIN_YEAR + '–' + MAX_YEAR + ' 年的公历日期。', 'warn');
      } else {
        toast('这个日期不存在或无法识别，请重新选择。', 'error');
      }
      return null;
    }

    var h = null;
    var mi = 0;
    var rawTime = String(els.time.value || '').trim();
    if (rawTime) {
      var time = parseTimeValue(rawTime);
      if (time) {
        h = time.h;
        mi = time.mi;
      } else {
        toast('时间无法识别，已按只排三柱处理。', 'warn');
      }
    }
    return { y: date.y, m: date.m, d: date.d, h: h, mi: mi };
  }

  function focusResult() {
    if (!els.result) return;
    var title = els.result.querySelector('.nayin__result-title');
    if (!title) return;
    try { title.focus({ preventScroll: false }); } catch (e) { warn(e && e.message); }
  }

  function compute(input, opts) {
    if (!GZ || typeof GZ.fourPillars !== 'function') {
      toast('四柱算法未加载，请刷新页面重试。', 'error');
      return;
    }
    var result = null;
    try {
      result = GZ.fourPillars({ y: input.y, m: input.m, d: input.d, h: input.h, mi: input.mi });
    } catch (err) {
      warn('fourPillars 抛错：' + (err && err.message));
      result = null;
    }
    if (!result) {
      toast('排盘失败，请检查日期后重试。', 'error');
      return;
    }
    try {
      renderResult(input, result);
      if (opts && opts.focus) focusResult();
    } catch (err2) {
      warn('渲染失败：' + (err2 && err2.message));
      if (els.result) {
        els.result.textContent = '';
        els.result.hidden = false;
        els.result.appendChild(el('div', { class: 'empty' }, [
          el('p', { class: 'empty__title', text: '结果渲染失败' }),
          el('p', { class: 'muted', text: '请刷新页面后重试。' })
        ]));
      }
      toast('结果渲染失败，请刷新页面重试。', 'error');
    }
  }

  /* ---------------- 六十甲子检索 ---------------- */
  function onJiaziChange() {
    var out = els.lookupResult;
    if (!out) return;
    var gz = els.jiaziSelect.value;
    out.textContent = '';
    if (!gz) {
      out.hidden = true;
      return;
    }
    var nayin = B.nayinOfJiazi(gz);
    var profile = B.profileOfJiazi(gz);
    out.hidden = false;
    out.appendChild(el('div', { class: 'nayin__lookup-head' }, [
      el('p', { class: 'nayin__lookup-name', text: gz + ' · ' + (nayin ? nayin.name : '—') }),
      el('p', {
        class: 'nayin__lookup-sub',
        text: profile
          ? '对应第 ' + profile.n + ' 局「' + profile.name + '」，五行属' + profile.element
          : '未找到对应的三十纳音格局数据。'
      })
    ]));
    if (profile) out.appendChild(profileDetail(profile));
  }

  function stepJiazi(delta) {
    var list = DATA.jiazi || [];
    if (!list.length || !els.jiaziSelect) return;
    var cur = els.jiaziSelect.value;
    var idx = list.indexOf(cur);
    var next;
    if (idx < 0) next = delta > 0 ? 0 : list.length - 1;
    else next = (idx + delta + list.length) % list.length;
    els.jiaziSelect.value = list[next];
    onJiaziChange();
  }

  /* ---------------- 三十纳音格局浏览 ---------------- */
  function profileCard(profile) {
    var card = el('article', {
      class: 'nayin__profile-card',
      dataset: { element: profileElementKey(profile), n: String(profile.n) }
    });
    card.appendChild(el('p', { class: 'nayin__profile-jz', text: profile.jiazi.join('、') }));
    card.appendChild(el('h4', { class: 'nayin__profile-name', text: profile.name }));
    card.appendChild(el('p', {
      class: 'nayin__profile-judge',
      text: B.firstSentence(profile.judgement, 48)
    }));
    var btn = el('button', {
      class: 'btn btn--ghost btn--sm nayin__more',
      type: 'button',
      'aria-expanded': 'false',
      text: '完整七项'
    });
    btn.setAttribute('aria-controls', 'nayin-prof-' + profile.n + '-full');
    card.appendChild(btn);
    return card;
  }

  function toggleProfile(btn) {
    var card = btn.parentNode;
    while (card && !(card.classList && card.classList.contains('nayin__profile-card'))) {
      card = card.parentNode;
    }
    if (!card) return;
    var full = card.querySelector('.nayin__profile-full');
    if (full) {
      card.removeChild(full);
      card.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '完整七项';
      return;
    }
    var num = Number(btn.dataset.n || card.dataset.n);
    var profile = B.profileOfNum ? B.profileOfNum(num) : null;
    if (!profile) {
      toast('未找到该局数据。', 'error');
      return;
    }
    var box = el('div', { class: 'nayin__profile-full', id: 'nayin-prof-' + profile.n + '-full' });
    box.appendChild(el('p', { class: 'nayin__profile-full-judge', text: profile.judgement }));
    box.appendChild(fieldList(profile, 'nayin__fields--card'));
    card.appendChild(box);
    card.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.textContent = '收起';
  }

  function renderGroup(cn, list) {
    var group = el('section', { class: 'nayin__group', dataset: { element: elementKey(cn) } });
    group.appendChild(el('h3', {
      class: 'nayin__group-title',
      text: cn + (CN_NUM[list.length] || list.length) + '局'
    }));
    var grid = el('div', { class: 'nayin__profile-grid' });
    list.forEach(function (profile) { grid.appendChild(profileCard(profile)); });
    group.appendChild(grid);
    return group;
  }

  /* ---------------- 各区块 ---------------- */
  function renderHead() {
    return el('header', { class: 'nayin__head' }, [
      el('p', { class: 'eyebrow', text: 'FIVE PILLARS · NAYIN' }),
      el('h1', { class: 'nayin__title', text: '六十甲子纳音' }),
      el('p', {
        class: 'nayin__lead',
        text: '输入出生日期与时刻，排出年、月、日、时四柱干支，查得年柱纳音，并参看对应的「三十纳音格局」。'
      })
    ]);
  }

  function renderFormCard() {
    var card = el('section', { class: 'card nayin__card', 'aria-labelledby': 'nayin-form-title' });
    card.appendChild(el('div', { class: 'card__head' }, [
      el('h2', { class: 'card__title', id: 'nayin-form-title', text: '一 · 查纳音' }),
      el('p', { class: 'card__sub', text: '公历生日 → 四柱干支 → 年柱纳音' })
    ]));

    var body = el('div', { class: 'card__body' });
    var form = el('form', { class: 'nayin__form', id: 'nayin-form', novalidate: 'novalidate' });

    var dateId = 'nayin-date';
    var dateInput = el('input', {
      class: 'input',
      type: 'date',
      id: dateId,
      name: 'date',
      required: 'required',
      min: '1900-01-01',
      max: '2100-12-31',
      autocomplete: 'bday',
      'aria-describedby': 'nayin-date-hint'
    });
    form.appendChild(el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: dateId, text: '出生日期（公历）' }),
      dateInput,
      el('p', { class: 'field__hint', id: 'nayin-date-hint', text: '支持 1900–2100 年。年柱以立春为界，月柱以节气为界。' })
    ]));

    var timeId = 'nayin-time';
    var timeInput = el('input', {
      class: 'input',
      type: 'time',
      id: timeId,
      name: 'time',
      autocomplete: 'off',
      'aria-describedby': 'nayin-time-hint'
    });
    form.appendChild(el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: timeId, text: '出生时间（可留空）' }),
      timeInput,
      el('p', { class: 'field__hint', id: 'nayin-time-hint', text: '留空则只排年、月、日三柱。23:00 后按次日换日。' })
    ]));

    var submit = el('button', { class: 'btn btn--primary', type: 'submit', text: '排四柱' });
    var reset = el('button', { class: 'btn btn--ghost', type: 'button', id: 'nayin-reset', text: '清空' });
    form.appendChild(el('div', { class: 'nayin__form-actions' }, [submit, reset]));

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = readInputs();
      if (input) compute(input, { focus: true });
    });

    reset.addEventListener('click', function () {
      form.reset();
      if (els.result) {
        els.result.textContent = '';
        els.result.hidden = true;
      }
      state.computed = false;
      toast('已清空。', 'ok');
      try { dateInput.focus(); } catch (e) { warn(e && e.message); }
    });

    body.appendChild(form);
    body.appendChild(el('p', {
      class: 'nayin__form-note',
      text: '提示：可把日期带在链接里分享，如 #/nayin?d=1990-05-12&t=14:30。'
    }));
    card.appendChild(body);

    els.date = dateInput;
    els.time = timeInput;
    return card;
  }

  function renderLookupCard() {
    var card = el('section', { class: 'card nayin__card', 'aria-labelledby': 'nayin-lookup-title' });
    card.appendChild(el('div', { class: 'card__head' }, [
      el('h2', { class: 'card__title', id: 'nayin-lookup-title', text: '二 · 六十甲子检索' }),
      el('p', { class: 'card__sub', text: '任选一柱甲子，查看纳音与格局' })
    ]));

    var body = el('div', { class: 'card__body' });
    var bar = el('div', { class: 'nayin__lookup-bar' });

    var select = el('select', { class: 'select', id: 'nayin-jiazi' });
    select.appendChild(el('option', { value: '', text: '请选择一柱甲子…' }));
    (DATA.jiazi || []).forEach(function (gz) {
      var nayin = B.nayinOfJiazi(gz);
      select.appendChild(el('option', {
        value: gz,
        text: gz + ' · ' + (nayin ? nayin.name : '—')
      }));
    });

    bar.appendChild(el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'nayin-jiazi', text: '六十甲子' }),
      select,
      el('p', { class: 'field__hint', text: '同一纳音成对出现，如「甲子、乙丑」同属海中金。' })
    ]));

    var prev = el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', id: 'nayin-jiazi-prev', text: '上一柱'
    });
    var next = el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', id: 'nayin-jiazi-next', text: '下一柱'
    });
    bar.appendChild(el('div', { class: 'nayin__lookup-actions' }, [prev, next]));
    body.appendChild(bar);

    var out = el('div', { class: 'nayin__lookup-result', id: 'nayin-lookup-result' });
    out.hidden = true;
    body.appendChild(out);
    card.appendChild(body);

    select.addEventListener('change', onJiaziChange);
    prev.addEventListener('click', function () { stepJiazi(-1); });
    next.addEventListener('click', function () { stepJiazi(1); });

    els.jiaziSelect = select;
    els.lookupResult = out;
    return card;
  }

  function renderProfilesSection() {
    var section = el('section', { class: 'nayin__profiles', 'aria-labelledby': 'nayin-profiles-title' });
    section.appendChild(el('div', { class: 'nayin__section-head' }, [
      el('p', { class: 'eyebrow', text: 'THIRTY PROFILES' }),
      el('h2', { class: 'nayin__section-title', id: 'nayin-profiles-title', text: '三 · 三十纳音格局' }),
      el('p', {
        class: 'nayin__section-lead',
        text: '六十甲子两两一局，共三十局，按五行分列。点开任一局可看完整七项：禀赋、性格、事业、感情、短板、喜、忌。'
      })
    ]));

    var groups = el('div', { class: 'nayin__groups' });
    var profiles = DATA.profiles || [];
    if (!profiles.length) {
      groups.appendChild(el('div', { class: 'empty' }, [
        el('p', { class: 'empty__title', text: '格局数据未加载' }),
        el('p', { class: 'muted', text: '请刷新页面重试。' })
      ]));
    } else {
      var known = {};
      ELEMENT_ORDER.forEach(function (cn) {
        known[cn] = true;
        var list = profiles.filter(function (profile) { return profile.element === cn; });
        if (list.length) groups.appendChild(renderGroup(cn, list));
      });
      var rest = profiles.filter(function (profile) { return !known[profile.element]; });
      if (rest.length) groups.appendChild(renderGroup('其他', rest));
    }
    section.appendChild(groups);
    return section;
  }

  /* ---------------- 路由参数 ---------------- */
  function normalizeDateParam(raw) {
    var m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(String(raw || '').trim());
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var check = new Date(Date.UTC(y, mo - 1, d));
    if (!check || isNaN(check.getTime())) return null;
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
    return y + '-' + pad2(mo) + '-' + pad2(d);
  }

  function normalizeTimeParam(raw) {
    var time = parseTimeValue(raw);
    return time ? pad2(time.h) + ':' + pad2(time.mi) : null;
  }

  /* ---------------- 视图接口 ---------------- */
  function mount(section) {
    if (els.date) return;
    var root = el('div', { class: 'nayin' });
    root.appendChild(renderHead());
    root.appendChild(renderFormCard());

    var result = el('div', {
      class: 'nayin__result',
      id: 'nayin-result',
      role: 'region',
      'aria-label': '四柱排盘结果'
    });
    result.hidden = true;
    root.appendChild(result);

    root.appendChild(renderLookupCard());
    root.appendChild(renderProfilesSection());
    root.appendChild(el('p', {
      class: 'nayin__disclaim',
      text: '免责声明：纳音属传统命理文化，仅供文化参考，不构成任何决策依据。'
    }));

    root.addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== root) {
        if (node.classList && node.classList.contains('nayin__more')) {
          toggleProfile(node);
          return;
        }
        node = node.parentNode;
      }
    });

    section.appendChild(root);
    els.root = root;
    els.result = result;
  }

  function show(params) {
    if (!els.date) return;
    var rawDate = params && typeof params.get === 'function' ? params.get('d') : null;
    var rawTime = params && typeof params.get === 'function' ? params.get('t') : null;
    if (!rawDate) return;

    var iso = normalizeDateParam(rawDate);
    if (!iso) {
      toast('链接中的日期无法识别，请手动选择。', 'warn');
      return;
    }
    els.date.value = iso;
    if (rawTime) {
      var time = normalizeTimeParam(rawTime);
      if (time) {
        els.time.value = time;
      } else {
        els.time.value = '';
        toast('链接中的时间无法识别，已按只排三柱处理。', 'warn');
      }
    } else {
      els.time.value = '';
    }
    var input = readInputs();
    if (input) compute(input);
  }

  function hide() {}

  global.BAGUA_VIEWS = global.BAGUA_VIEWS || {};
  global.BAGUA_VIEWS.nayin = { id: 'nayin', mount: mount, show: show, hide: hide };
})(window);
