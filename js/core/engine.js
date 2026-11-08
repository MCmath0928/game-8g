/* =============================================================
 * engine.js — 数据访问、卦象渲染、起卦逻辑、纳音查询
 * 全部纯前端、无依赖。对外暴露 window.BAGUA。
 * ============================================================= */
(function (global) {
  'use strict';

  var HEX_DATA = global.BAGUA_HEXAGRAMS || { hexagrams: [], trigrams: [], basics: {} };
  var NAYIN_DATA = global.BAGUA_NAYIN || { jiazi: [], nayin: [], profiles: [] };

  var hexagrams = HEX_DATA.hexagrams;
  var trigrams = HEX_DATA.trigrams;
  var basics = HEX_DATA.basics;

  var BY_BINARY = {};
  hexagrams.forEach(function (h) { BY_BINARY[h.binary.join('')] = h; });

  var TRI_BY_BITS = {};
  trigrams.forEach(function (t) { TRI_BY_BITS[(t.bits || []).join('')] = t; });

  var NAYIN_BY_JIAZI = {};
  (NAYIN_DATA.nayin || []).forEach(function (n) { NAYIN_BY_JIAZI[n.jiazi] = n; });

  var PROFILE_BY_NUM = {};
  (NAYIN_DATA.profiles || []).forEach(function (p) { PROFILE_BY_NUM[p.n] = p; });

  /* ---------------- 基础工具 ---------------- */
  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val == null || val === false) return;
        if (key === 'class') node.className = val;
        else if (key === 'text') node.textContent = val;
        else if (key === 'html') node.innerHTML = val;
        else if (key === 'dataset') {
          Object.keys(val).forEach(function (dk) {
            if (val[dk] != null) node.dataset[dk] = String(val[dk]);
          });
        } else if (key === 'on') {
          Object.keys(val).forEach(function (ev) { node.addEventListener(ev, val[ev]); });
        } else if (key === 'style') {
          Object.keys(val).forEach(function (sk) { node.style.setProperty(sk, val[sk]); });
        } else {
          node.setAttribute(key, String(val));
        }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (child) {
        if (child == null || child === false) return;
        node.appendChild(typeof child === 'string' || typeof child === 'number'
          ? document.createTextNode(String(child)) : child);
      });
    }
    return node;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function firstSentence(text, maxLen) {
    if (!text) return '';
    var limit = maxLen || 42;
    var idx = text.indexOf('。');
    var s = idx > 0 && idx <= limit ? text.slice(0, idx) : text.slice(0, limit);
    if (s.length < text.length && s.charAt(s.length - 1) !== '。') s += '…';
    return s;
  }

  /* ---------------- 卦 ---------------- */
  function findHex(num) {
    var n = Number(num);
    for (var i = 0; i < hexagrams.length; i++) if (hexagrams[i].num === n) return hexagrams[i];
    return null;
  }

  function findHexByBinary(binary) {
    return BY_BINARY[binary.join('')] || null;
  }

  var POS_NAME = ['初', '二', '三', '四', '五', '上'];

  function lineLabel(pos, yang) {
    if (pos === 0) return yang ? '初九' : '初六';
    if (pos === 5) return yang ? '上九' : '上六';
    return (yang ? '九' : '六') + POS_NAME[pos];
  }

  function trigramOfBits(bits) { return TRI_BY_BITS[bits.join('')] || null; }

  function hexTitle(h) { return h ? h.name + '卦 · ' + h.fullName : ''; }

  function hexAria(h, movingLabels) {
    if (!h) return '';
    var base = h.fullName + '（第' + h.num + '卦），上' + h.upper.name + '下' + h.lower.name;
    if (movingLabels && movingLabels.length) base += '，动爻：' + movingLabels.join('、');
    return base;
  }

  /* ---------------- 卦象渲染（全站唯一权威） ---------------- */
  function renderHex(binaryOrLines, opts) {
    var o = opts || {};
    var size = o.size || 'md';
    var items;
    if (binaryOrLines && binaryOrLines.length && typeof binaryOrLines[0] === 'object') {
      items = binaryOrLines.map(function (it) {
        return { yang: it.yang ? 1 : 0, moving: !!it.moving };
      });
    } else {
      items = (binaryOrLines || []).map(function (bit) {
        return { yang: bit ? 1 : 0, moving: false };
      });
    }
    var built = Math.max(0, Math.min(6, items.length));
    var ghosts = o.ghosts || 0;

    var box = el('div', { class: 'hex', dataset: { size: size } });

    for (var pos = 6; pos >= 1; pos--) {
      var isGhost = pos > built;
      var item = isGhost ? { yang: 0, moving: false } : items[pos - 1];
      var line = el('div', {
        class: 'hex__line',
        dataset: {
          pos: pos,
          yang: item.yang,
          moving: (!isGhost && item.moving) ? 1 : 0,
          ghost: isGhost ? 1 : 0
        }
      });
      if (o.labels) {
        line.appendChild(el('span', {
          class: 'hex__label',
          text: isGhost ? '　' : lineLabel(pos - 1, item.yang === 1)
        }));
      }
      line.appendChild(el('span', { class: 'hex__bar' }));
      line.appendChild(el('span', { class: 'hex__bar' }));
      if (o.showMark !== false) {
        line.appendChild(el('span', {
          class: 'hex__mark',
          text: (!isGhost && item.moving) ? (item.yang ? '○' : '×') : ''
        }));
      }
      if (!isGhost && o.highlight && o.highlight.indexOf(pos - 1) >= 0) line.classList.add('is-highlight');
      box.appendChild(line);
    }

    if (o.ariaLabel) {
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', o.ariaLabel);
    } else {
      box.setAttribute('aria-hidden', 'true');
    }
    return box;
  }

  /* ---------------- 起卦 ---------------- */
  var RANDOM_OK = !!(global.crypto && global.crypto.getRandomValues);

  function randBit() {
    if (RANDOM_OK) {
      var buf = new Uint8Array(1);
      global.crypto.getRandomValues(buf);
      return buf[0] & 1;
    }
    return Math.random() < 0.5 ? 1 : 0;
  }

  function newToss() {
    var coins = [randBit(), randBit(), randBit()];
    var heads = coins.reduce(function (a, b) { return a + b; }, 0); // 正面=阳=1
    var value, kind, glyph, moving;
    if (heads === 3) { value = 9; kind = '老阳'; glyph = '○'; moving = true; }
    else if (heads === 2) { value = 7; kind = '少阳'; glyph = '—'; moving = false; }
    else if (heads === 1) { value = 8; kind = '少阴'; glyph = '- -'; moving = false; }
    else { value = 6; kind = '老阴'; glyph = '×'; moving = true; }
    return {
      coins: coins, heads: heads, value: value,
      yang: (value === 7 || value === 9) ? 1 : 0,
      moving: moving, kind: kind, glyph: glyph
    };
  }

  function buildResult(values, question) {
    var lines = values.map(function (v, pos) {
      var yang = (v === 7 || v === 9) ? 1 : 0;
      return {
        pos: pos, value: v, yang: yang,
        moving: (v === 6 || v === 9),
        label: lineLabel(pos, yang)
      };
    });
    var binary = lines.map(function (l) { return l.yang; });
    var bianBinary = binary.map(function (b, i) { return lines[i].moving ? 1 - b : b; });
    var moving = [];
    lines.forEach(function (l) { if (l.moving) moving.push(l.pos); });
    var ben = findHexByBinary(binary);
    var bian = moving.length ? findHexByBinary(bianBinary) : null;
    return {
      values: values.slice(),
      lines: lines,
      binary: binary,
      bianBinary: bianBinary,
      ben: ben,
      bian: bian,
      moving: moving,
      movingLabels: moving.map(function (p) { return lines[p].label; }),
      hasMoving: moving.length > 0,
      allMoving: moving.length === 6,
      createdAt: Date.now(),
      question: question || ''
    };
  }

  function encodeResult(result) { return result.values.join(''); }

  function decodeResult(str) {
    if (!str || !/^[6789]{6}$/.test(String(str).trim())) return null;
    return String(str).trim().split('').map(Number);
  }

  function elementOfNayin(jiazi) {
    var n = NAYIN_BY_JIAZI[jiazi];
    return n ? n.element : '';
  }

  function formatTime(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  var VALUE_NAME = { 6: '老阴 ×', 7: '少阳 —', 8: '少阴 - -', 9: '老阳 ○' };

  function resultText(result) {
    if (!result || !result.ben) return '';
    var ben = result.ben;
    var out = [];
    out.push('【易 · 六十四卦】');
    if (result.question) out.push('所问：' + result.question);
    out.push('第' + ben.num + '卦　' + ben.name + '（' + ben.fullName + '）' +
      '　上' + ben.upper.name + '下' + ben.lower.name);
    out.push('');
    out.push('本卦：' + ben.name + '　' + ben.fullName);
    out.push('卦辞：' + ben.guaci.text);
    if (ben.guaci.trans) out.push('译文：' + ben.guaci.trans);
    out.push('');
    if (result.bian) {
      out.push('变卦：' + result.bian.name + '　' + result.bian.fullName);
      out.push('卦辞：' + result.bian.guaci.text);
      if (result.bian.guaci.trans) out.push('译文：' + result.bian.guaci.trans);
      out.push('');
    }
    out.push('动爻：' + (result.moving.length ? result.movingLabels.join('、') : '无'));
    out.push('');
    if (result.moving.length) {
      result.moving.forEach(function (pos) {
        var castLine = result.lines[pos];
        var data = ben.lines[pos] || {};
        out.push('【' + castLine.label + '】' + (data.text || ''));
        if (data.trans) out.push('译文：' + data.trans);
      });
      out.push('');
    }
    var g = guide(result);
    if (g.length) {
      out.push('断卦提示：');
      g.forEach(function (item) { out.push('· ' + item); });
      out.push('');
    }
    out.push('起卦：' + formatTime(result.createdAt));
    out.push('（内容仅供传统文化研究与娱乐参考）');
    return out.join('\n');
  }

  /* 断卦提示：传统通行规则（朱熹《易学启蒙》之说），与文档「优先看动爻爻辞」一致 */
  function guide(result) {
    if (!result) return [];
    var out = [];
    var n = result.moving.length;
    var labels = result.movingLabels || [];
    if (n === 0) {
      out.push('六爻皆静，以本卦卦辞为主断，参看' + result.ben.fullName + '的卦意。');
    } else if (n === 1) {
      out.push('一爻独动，以本卦「' + labels[0] + '」的爻辞为主断，变卦为事情的发展去向。');
    } else if (n === 2) {
      out.push('二爻皆动，以两动爻爻辞合看，上面那一爻（' + labels[1] + '）为主，' + labels[0] + '为辅。');
      out.push('变卦「' + result.bian.name + '」表事情后期的走向。');
    } else if (n === 3) {
      out.push('三爻动，本卦与变卦卦辞合看，以本卦为主、变卦为辅，再参动爻爻辞。');
      out.push('本卦讲当下之势，变卦「' + result.bian.name + '」讲未来之变。');
    } else if (n === 4) {
      out.push('四爻动，以变卦中两个不动爻的爻辞为主断，下面一爻为主。');
      out.push('动多而静少，事已近变局，宜顺势而不宜强求。');
    } else if (n === 5) {
      out.push('五爻动，以变卦中唯一不动的那一爻爻辞为主断。');
      out.push('变卦「' + result.bian.name + '」渐成主角，看它的卦意更多。');
    } else {
      out.push('六爻皆动，以变卦「' + result.bian.name + '」的卦辞为主断。');
      if (result.ben.name === '乾' || result.ben.name === '坤') {
        out.push('本卦为' + result.ben.name + '卦，可再参「' + (result.ben.name === '乾' ? '用九' : '用六') + '」之辞。');
      }
    }
    out.push('同一件事不宜反复起卦；卦象是参照，不是命定的结论。');
    return out;
  }

  /* ---------------- 纳音 ---------------- */
  function nayinOfJiazi(jiazi) {
    return NAYIN_BY_JIAZI[jiazi] || null;
  }

  function profileOfJiazi(jiazi) {
    var n = NAYIN_BY_JIAZI[jiazi];
    return n ? (PROFILE_BY_NUM[n.profile] || null) : null;
  }

  function profileOfNum(n) { return PROFILE_BY_NUM[n] || null; }

  function elementColor(element) {
    return ({ 金: 'metal', 木: 'wood', 水: 'water', 火: 'fire', 土: 'earth' })[element] || 'plain';
  }

  global.BAGUA = {
    hexagrams: hexagrams,
    trigrams: trigrams,
    basics: basics,
    trigramTable: (basics && basics.trigramTable) || [],
    nayin: NAYIN_DATA,
    nayinData: NAYIN_DATA,
    jiazi: NAYIN_DATA.jiazi || [],
    profiles: NAYIN_DATA.profiles || [],
    esc: esc,
    el: el,
    pad2: pad2,
    firstSentence: firstSentence,
    findHex: findHex,
    findHexByBinary: findHexByBinary,
    lineLabel: lineLabel,
    trigramOfBits: trigramOfBits,
    hexTitle: hexTitle,
    hexAria: hexAria,
    renderHex: renderHex,
    newToss: newToss,
    buildResult: buildResult,
    encodeResult: encodeResult,
    decodeResult: decodeResult,
    resultText: resultText,
    guide: guide,
    formatTime: formatTime,
    valueName: function (v) { return VALUE_NAME[v] || ''; },
    nayinOfJiazi: nayinOfJiazi,
    profileOfJiazi: profileOfJiazi,
    profileOfNum: profileOfNum,
    elementColor: elementColor
  };
})(window);
