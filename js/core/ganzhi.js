/* =============================================================
 * ganzhi.js — 干支历法（四柱）与节气计算
 * 纯离线算法：太阳视黄经（Meeus 低精度）+ 牛顿迭代求节气时刻。
 * 精度约 ±10 分钟（仅影响出生时刻极接近节气交界的情形，会给出提示）。
 * 日柱以 23:00 换日（23:00–24:00 为晚子时，日柱已进次日）；月柱以「节」为界；年柱以立春为界。
 * ============================================================= */
(function (global) {
  'use strict';

  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var SX = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  var WUXING = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  var ZHI_WUXING = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];

  var JIAZI = [];
  for (var i = 0; i < 60; i++) JIAZI.push(GAN[i % 10] + ZHI[i % 12]);

  /* 二十四节气：名称、太阳黄经、公历近似日（用于迭代初值） */
  var TERMS = [
    { name: '小寒', deg: 285, m: 1, d: 6 },
    { name: '大寒', deg: 300, m: 1, d: 20 },
    { name: '立春', deg: 315, m: 2, d: 4 },
    { name: '雨水', deg: 330, m: 2, d: 19 },
    { name: '惊蛰', deg: 345, m: 3, d: 6 },
    { name: '春分', deg: 0, m: 3, d: 21 },
    { name: '清明', deg: 15, m: 4, d: 5 },
    { name: '谷雨', deg: 30, m: 4, d: 20 },
    { name: '立夏', deg: 45, m: 5, d: 6 },
    { name: '小满', deg: 60, m: 5, d: 21 },
    { name: '芒种', deg: 75, m: 6, d: 6 },
    { name: '夏至', deg: 90, m: 6, d: 21 },
    { name: '小暑', deg: 105, m: 7, d: 7 },
    { name: '大暑', deg: 120, m: 7, d: 23 },
    { name: '立秋', deg: 135, m: 8, d: 8 },
    { name: '处暑', deg: 150, m: 8, d: 23 },
    { name: '白露', deg: 165, m: 9, d: 8 },
    { name: '秋分', deg: 180, m: 9, d: 23 },
    { name: '寒露', deg: 195, m: 10, d: 8 },
    { name: '霜降', deg: 210, m: 10, d: 23 },
    { name: '立冬', deg: 225, m: 11, d: 7 },
    { name: '小雪', deg: 240, m: 11, d: 22 },
    { name: '大雪', deg: 255, m: 12, d: 7 },
    { name: '冬至', deg: 270, m: 12, d: 22 }
  ];
  var TERM_BY_NAME = {};
  TERMS.forEach(function (t, i) { t.index = i; TERM_BY_NAME[t.name] = t; });

  /* 十二「节」（分月之界）：名称、月支序号（寅=0） */
  var JIE = [
    { name: '立春', branch: 0 }, { name: '惊蛰', branch: 1 }, { name: '清明', branch: 2 },
    { name: '立夏', branch: 3 }, { name: '芒种', branch: 4 }, { name: '小暑', branch: 5 },
    { name: '立秋', branch: 6 }, { name: '白露', branch: 7 }, { name: '寒露', branch: 8 },
    { name: '立冬', branch: 9 }, { name: '大雪', branch: 10 }, { name: '小寒', branch: 11 }
  ];

  var RAD = Math.PI / 180;
  var JD1970 = 2440587.5;

  /* ---------- 儒略日 ---------- */
  function jdnFromDate(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) -
      Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  function jdFromMs(ms) { return ms / 86400000 + JD1970; }

  function msFromJd(jd) { return Math.round((jd - JD1970) * 86400000); }

  /* 北京时间的 Date.UTC 值（不依赖运行环境时区） */
  function beijingMs(y, m, d, h, mi) {
    return Date.UTC(y, m - 1, d, h || 0, mi || 0) - 8 * 3600000;
  }

  function beijingParts(ms) {
    var t = new Date(ms + 8 * 3600000);
    return {
      y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
      h: t.getUTCHours(), mi: t.getUTCMinutes()
    };
  }

  /* ---------- ΔT 粗略估计（秒） ---------- */
  var DT_TABLE = [
    [1900, -2.8], [1920, 21.2], [1940, 24.3], [1950, 29.1], [1960, 33.2],
    [1970, 40.2], [1980, 50.5], [1990, 56.9], [2000, 63.8], [2010, 66.1],
    [2020, 69.4], [2030, 74.5], [2050, 93.0], [2100, 180.0]
  ];
  function deltaT(year) {
    var a = DT_TABLE[0], b = DT_TABLE[DT_TABLE.length - 1];
    for (var i = 0; i < DT_TABLE.length - 1; i++) {
      if (year >= DT_TABLE[i][0] && year <= DT_TABLE[i + 1][0]) {
        a = DT_TABLE[i]; b = DT_TABLE[i + 1]; break;
      }
    }
    var t = (year - a[0]) / (b[0] - a[0]);
    return a[1] + (b[1] - a[1]) * t;
  }

  /* ---------- 太阳视黄经（度，0..360） ---------- */
  function sunApparentLongitude(jde) {
    var T = (jde - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var Mr = M * RAD;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
      + 0.000289 * Math.sin(3 * Mr);
    var trueLong = L0 + C;
    var Om = (125.04 - 1934.136 * T) * RAD;
    var lam = trueLong - 0.00569 - 0.00478 * Math.sin(Om);
    return ((lam % 360) + 360) % 360;
  }

  function solveTermJd(year, term) {
    // 初值：该年公历近似日（北京时间 12:00 → UT）
    var guess = jdFromMs(beijingMs(year, term.m, term.d, 12, 0));
    var jde = guess + deltaT(year) / 86400;
    for (var k = 0; k < 10; k++) {
      var lon = sunApparentLongitude(jde);
      var diff = term.deg - lon;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      jde += diff / 0.98564736;
      if (Math.abs(diff) < 1e-8) break;
    }
    var jdUt = jde - deltaT(year) / 86400;
    return jdUt;
  }

  /* 返回某年某节气（北京时间）的时刻，单位 ms */
  function termMs(year, name) {
    var term = TERM_BY_NAME[name];
    if (!term) return null;
    return msFromJd(solveTermJd(year, term));
  }

  function solarTermDate(year, name) {
    var ms = termMs(year, name);
    return ms == null ? null : new Date(ms);
  }

  /* ---------- 日柱 ---------- */
  function dayIndexFrom(y, m, d, h) {
    var jdn = jdnFromDate(y, m, d);
    if (h >= 23) jdn += 1; // 23:00 起算次日（23:00–24:00 为晚子时，日柱进次日）
    return ((jdn + 49) % 60 + 60) % 60;
  }

  function dayGanzhi(parts) {
    var idx = dayIndexFrom(parts.y, parts.m, parts.d, parts.h);
    var gz = JIAZI[idx];
    return { ganzhi: gz, gan: idx % 10, zhi: idx % 12, index: idx };
  }

  /* ---------- 四柱 ---------- */
  function fourPillars(input) {
    var y = input.y, m = input.m, d = input.d;
    var h = (input.h === null || input.h === undefined || input.h === '') ? null : Number(input.h);
    var mi = Number(input.mi || 0);
    if (!y || !m || !d) return null;

    var ms = beijingMs(y, m, d, h || 0, mi);
    var warnings = [];

    /* 年柱：以立春为界 */
    var lichunThis = termMs(y, '立春');
    var pillarYear = ms < lichunThis ? y - 1 : y;
    var yearIdx = ((pillarYear - 4) % 60 + 60) % 60;
    var yearGz = JIAZI[yearIdx];
    var yearGan = yearIdx % 10;
    var yearZhi = yearIdx % 12;

    /* 月柱：以十二节为界 */
    var boundaries = [];
    [y - 1, y].forEach(function (yy) {
      JIE.forEach(function (jie) {
        boundaries.push({ ms: termMs(yy, jie.name), branch: jie.branch, name: jie.name, year: yy });
      });
    });
    boundaries.sort(function (a, b) { return a.ms - b.ms; });
    var cur = boundaries[0];
    for (var i = 0; i < boundaries.length; i++) {
      if (boundaries[i].ms <= ms) cur = boundaries[i]; else break;
    }
    // 月干：甲己之年丙作首（寅月天干 = 丙）
    var monthBaseStem = (yearGan * 2 + 2) % 10;
    var monthStem = (monthBaseStem + cur.branch) % 10;
    var monthZhi = (2 + cur.branch) % 12;
    var monthGz = GAN[monthStem] + ZHI[monthZhi];

    /* 日柱 */
    var dayIdx = dayIndexFrom(y, m, d, h);
    var dayGz = JIAZI[dayIdx];
    var dayGan = dayIdx % 10;

    /* 时柱 */
    var hourObj = null;
    if (h !== null && !isNaN(h)) {
      var hourZhi = Math.floor(((h + 1) % 24) / 2);
      var hourStem = (dayGan * 2 + hourZhi) % 10;
      hourObj = { ganzhi: GAN[hourStem] + ZHI[hourZhi], gan: hourStem, zhi: hourZhi, index: -1 };
    }

    /* 节气邻近提示 */
    var allTerms = [];
    [y - 1, y, y + 1].forEach(function (yy) {
      TERMS.forEach(function (t) { allTerms.push({ ms: termMs(yy, t.name), name: t.name }); });
    });
    allTerms.sort(function (a, b) { return a.ms - b.ms; });
    var near = null, nearDist = Infinity;
    allTerms.forEach(function (t) {
      var dist = Math.abs(t.ms - ms);
      if (dist < nearDist) { nearDist = dist; near = t; }
    });
    if (near && nearDist < 60 * 60000) {
      warnings.push('出生时刻距「' + near.name + '」不足 1 小时：节气交界处的年柱 / 月柱可能落在另一侧。本页按离线天文近似推算（误差约数分钟），如正好临近日界，建议以专业万年历复核。');
    }

    function pack(gz, gan, zhi, kind) {
      var idx = JIAZI.indexOf(gz);
      var ny = indexNayin(idx);
      return {
        ganzhi: gz, gan: gan, zhi: zhi, index: idx,
        nayin: ny ? { name: ny.name, element: ny.element, profile: ny.profile, jiazi: gz } : null,
        ganElement: WUXING[gan], zhiElement: ZHI_WUXING[zhi % 12],
        zodiac: kind === 'year' ? SX[zhi] : null
      };
    }

    var result = {
      input: { y: y, m: m, d: d, h: h, mi: mi },
      ms: ms,
      year: pack(yearGz, yearGan, yearZhi, 'year'),
      month: pack(monthGz, monthStem, monthZhi, 'month'),
      day: pack(dayGz, dayIdx % 10, dayIdx % 12, 'day'),
      hour: hourObj ? pack(hourObj.ganzhi, hourObj.gan, hourObj.zhi, 'hour') : null,
      dayBoundary: '日柱以 23:00 换日' + (h !== null && h >= 23 ? '（本时刻已进次日，晚子时）' : ''),
      monthBoundary: cur.name + '节后',
      warnings: warnings
    };
    return result;
  }

  function indexNayin(idx) {
    var data = global.BAGUA_NAYIN;
    if (!data || !data.nayin || idx < 0) return null;
    return data.nayin[idx] || null;
  }

  function jiaziIndex(gz) { return JIAZI.indexOf(gz); }

  function termName(index) {
    var t = TERMS[index];
    return t ? t.name : null;
  }

  global.BAGUA_GANZHI = {
    GAN: GAN, ZHI: ZHI, JIAZI: JIAZI, SX: SX,
    TERMS: TERMS,
    fourPillars: fourPillars,
    dayGanzhi: dayGanzhi,
    dayIndexFrom: dayIndexFrom,
    jiaziIndex: jiaziIndex,
    termName: termName,
    solarTermDate: solarTermDate,
    termMs: termMs,
    beijingParts: beijingParts,
    beijingMs: beijingMs,
    sunApparentLongitude: sunApparentLongitude
  };
})(window);
