/* =============================================================
 * views/basics.js — 基础知识：阴阳爻、八卦、画卦顺序、金钱卦规则
 * ============================================================= */
(function (global) {
  'use strict';

  var B = global.BAGUA;

  function card(title, sub, children, extraClass) {
    var body = B.el('div', { class: 'card__body' });
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c) body.appendChild(c);
    });
    var head = B.el('div', { class: 'card__head' }, [
      B.el('h2', { class: 'card__title', text: title }),
      sub ? B.el('p', { class: 'card__sub', text: sub }) : null
    ]);
    return B.el('section', { class: 'card basics__card' + (extraClass ? ' ' + extraClass : '') }, [head, body]);
  }

  function mount(root) {
    root.classList.add('basics-view');
    var basics = B.basics || {};

    var hero = B.el('header', { class: 'basics__hero' }, [
      B.el('p', { class: 'eyebrow', text: '易经入门' }),
      B.el('h1', { class: 'basics__title', text: '从阴阳到六十四卦' }),
      B.el('p', {
        class: 'basics__lede',
        text: '《周易》用两种最简单的符号——阳爻与阴爻——层层叠加，演成八卦，再叠成六十四卦。看懂这张结构图，起卦就不再神秘。'
      })
    ]);

    /* ---- 阴阳 ---- */
    var yinYangRows = B.el('div', { class: 'basics__yinyang' });
    (basics.yinYang || []).forEach(function (item) {
      yinYangRows.appendChild(B.el('div', { class: 'basics__yin-row', dataset: { kind: item.key === '阳爻' ? 'yang' : 'yin' } }, [
        B.el('span', { class: 'basics__glyph', text: item.glyph, 'aria-hidden': 'true' }),
        B.el('div', { class: 'basics__yin-text' }, [
          B.el('strong', { class: 'basics__yin-title', text: item.title }),
          B.el('p', { class: 'small muted', text: item.desc })
        ])
      ]));
    });
    var yinYangCard = card('一、阴爻与阳爻', '万物皆有阴阳两面', [
      yinYangRows,
      B.el('p', { class: 'basics__quote', text: basics.yinYangNote || '' })
    ]);

    /* ---- 画卦顺序 ---- */
    var originCard = card('二、画卦顺序', '从下往上，初爻到上爻', [
      B.el('p', { class: 'basics__para', text: basics.origin || '' }),
      B.el('ol', { class: 'basics__steps' }, [
        B.el('li', { text: '一爻一名：最下面是「初」，依次为二、三、四、五，最上面是「上」。' }),
        B.el('li', { text: '阳爻称「九」，阴爻称「六」：初爻是初九或初六，上爻是上九或上六。' }),
        B.el('li', { text: '下三爻为下卦（内卦），上三爻为上卦（外卦）；上下相叠，共六十四种组合。' })
      ]),
      B.el('div', { class: 'basics__demo' }, [
        B.el('p', { class: 'small muted', text: '示例：泽天夬（上兑 ☱ 下乾 ☰）' }),
        B.renderHex([1, 1, 1, 1, 1, 0], { size: 'sm', labels: true, ariaLabel: '泽天夬，上兑下乾' })
      ])
    ]);

    /* ---- 八卦表 ---- */
    var table = B.el('div', { class: 'basics__trigrams' });
    var rows = basics.trigramTable || [];
    rows.forEach(function (t) {
      table.appendChild(B.el('div', { class: 'basics__trigram' }, [
        B.el('span', { class: 'basics__trigram-sym', text: t.sym, 'aria-hidden': 'true' }),
        B.el('div', { class: 'basics__trigram-text' }, [
          B.el('strong', { class: 'basics__trigram-name', text: t.name }),
          B.el('span', { class: 'basics__trigram-py', text: t.pinyin || '' }),
          B.el('span', { class: 'basics__trigram-img', text: '象：' + t.image }),
          B.el('span', { class: 'basics__trigram-virtue', text: t.virtue })
        ])
      ]));
    });
    var trigramCard = card('三、八卦（八经卦）', basics.mnemonic || '', [table], 'basics__card--wide');

    /* ---- 金钱卦 ---- */
    var coin = basics.coinMethod || {};
    var coinBody = [];
    coinBody.push(B.el('p', { class: 'basics__para', text: coin.prep || '' }));
    var stepList = B.el('ol', { class: 'basics__steps' });
    (coin.steps || []).forEach(function (s) { stepList.appendChild(B.el('li', { text: s })); });
    coinBody.push(stepList);
    if (coin.note) coinBody.push(B.el('p', { class: 'basics__para', text: coin.note }));
    if (coin.example) coinBody.push(B.el('p', { class: 'basics__note', text: coin.example }));

    var coinTable = B.el('div', { class: 'basics__coinmap' }, [
      B.el('div', { class: 'basics__coinrow' }, [B.el('span', { text: '三个正面' }), B.el('span', { class: 'basics__coinval', text: '老阳 ○ 动爻' })]),
      B.el('div', { class: 'basics__coinrow' }, [B.el('span', { text: '二正一反' }), B.el('span', { class: 'basics__coinval', text: '少阳 — 静爻' })]),
      B.el('div', { class: 'basics__coinrow' }, [B.el('span', { text: '一反二正' }), B.el('span', { class: 'basics__coinval', text: '少阴 - - 静爻' })]),
      B.el('div', { class: 'basics__coinrow' }, [B.el('span', { text: '三个反面' }), B.el('span', { class: 'basics__coinval', text: '老阴 × 动爻' })])
    ]);
    coinBody.push(coinTable);
    var coinCard = card('四、金钱卦（纳甲摇卦）', '最主流的起卦法', coinBody);

    /* ---- 断卦 ---- */
    var guideCard = card('五、怎么读一卦', '动爻优先，卦辞为纲', [
      B.el('ul', { class: 'basics__steps' }, [
        B.el('li', { text: '无动爻：以本卦卦辞为主断，参看卦意与六爻整体。' }),
        B.el('li', { text: '一爻动：以该动爻的爻辞为主断，变卦为事情的去向。' }),
        B.el('li', { text: '两爻动：两爻爻辞合看，以上面那一爻为主。' }),
        B.el('li', { text: '三爻动：本卦与变卦卦辞合看，本卦讲当下，变卦讲将来。' }),
        B.el('li', { text: '四爻、五爻、六爻动：事已近变局，以变卦为主，参考本卦。' })
      ]),
      B.el('p', { class: 'basics__note', text: '同一件事不宜反复起卦。卦象是参照，不是命定的结论。' }),
      B.el('a', { class: 'btn btn--primary', href: '#/divination' }, ['去摇一卦'])
    ]);

    root.appendChild(hero);
    root.appendChild(B.el('div', { class: 'basics__grid' }, [
      yinYangCard, originCard, trigramCard, coinCard, guideCard
    ]));
    root.appendChild(B.el('p', { class: 'basics__foot small muted' }, [
      '内容依据《周易》六十四卦整理，另参六十甲子纳音。仅供传统文化研究与娱乐参考。'
    ]));
  }

  global.BAGUA_VIEWS = global.BAGUA_VIEWS || {};
  global.BAGUA_VIEWS.basics = {
    id: 'basics',
    mount: mount
  };
})(window);
