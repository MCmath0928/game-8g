# 易 · 六十四卦 — 工程契约（SPEC）

> 本项目是一个**纯静态、零构建、零外部依赖、零网络请求**的中文算卦网页，直接部署到 GitHub Pages。
> 本文件是团队成员之间的唯一契约。**动手前先读完；不要修改自己负责范围之外的文件。**

## 1. 项目定位

- 数据来源：`doc/八卦.docx`（工作区 `E:\DeepseekCraftTable\Coding\doc\八卦.docx`），已解析为 `bagua/js/data/*.js`。
- 四个页面（哈希路由）：
  - `#/divination` 摇卦（金钱卦，主功能）
  - `#/library` 六十四卦（浏览 + 搜索 + 详情）
  - `#/nayin` 纳音（出生日期 → 四柱 → 六十甲子纳音 → 三十纳音格局）
  - `#/basics` 基础（阴阳爻、八卦表、摇卦规则）
- 展示语言：简体中文；语气：古雅、克制、可信，不要迷信夸张，不要绝对化断言。
- 仅供传统文化研究与娱乐参考，页脚需有免责声明。

## 2. 技术约束（硬要求）

1. 纯静态：`index.html` + `css/` + `js/` + `assets/`。**不允许** npm / 打包器 / 框架 / CDN / 网络字体 / fetch 外部资源。
2. 脚本用**经典脚本**（`<script src>`，非 ES module），按固定顺序加载，通过 `window` 全局通信。原因：需要兼容 `file://` 直接打开。
3. 浏览器目标：Chrome / Edge / Safari / Firefox 近两年版本 + iOS Safari。支持移动端（≥360px）。
4. 不使用内联事件属性（`onclick=`）；一律 `addEventListener`。
5. 不写 `document.write`；不依赖 `innerHTML` 拼接用户输入（用 `textContent` 或 `BAGUA.esc()`）。
6. 所有文件 UTF-8、LF 换行。缩进 2 空格（CSS/JS）。
   例外：`js/data/*.js` 为构建脚本生成的数据文件，保持**单行 JSON**（体积与解析考虑），不要求缩进。
7. 尊重 `prefers-reduced-motion: reduce`：关闭硬币旋转、位移动画，只保留淡入。

## 3. 文件结构与归属（写权限边界）

| 路径 | 归属 | 说明 |
| --- | --- | --- |
| `bagua/index.html` | Lead | 唯一 HTML 外壳，所有页面容器与脚本顺序 |
| `bagua/css/tokens.css` `base.css` `components.css` `layout.css` | **视觉设计** | 设计令牌、重置、通用组件、外壳布局 |
| `bagua/css/views/divination.css` | Lead | 摇卦页专属样式 |
| `bagua/css/views/basics.css` | Lead | 基础页专属样式 |
| `bagua/css/views/library.css` | **六十四卦页负责人** | 只作用于 `#view-library` |
| `bagua/css/views/nayin.css` | **纳音页负责人** | 只作用于 `#view-nayin` |
| `bagua/js/data/hexagrams.js` `nayin.js` | Lead（已生成，勿改） | 数据 |
| `bagua/js/core/engine.js` `ganzhi.js` | Lead | 纯逻辑与渲染组件 |
| `bagua/js/views/divination.js` `basics.js` | Lead | |
| `bagua/js/views/library.js` | **六十四卦页负责人** | |
| `bagua/js/views/nayin.js` | **纳音页负责人** | |
| `bagua/js/app.js` | Lead | 路由、导航、toast |
| `bagua/README.md` `.nojekyll` `.github/**` `favicon.svg` | Lead | |

> 需要改动他人文件/外壳 HTML 时：**先给 Lead 发消息**，不要直接改。

## 4. 数据模型（已生成，只读）

### 4.1 `window.BAGUA_HEXAGRAMS`

```js
{
  meta: { title, subtitle, source, version },
  trigrams: [ { sym:"☰", name:"乾", pinyin:"qián", image:"天", bits:[1,1,1], virtue:"健，自强不息", meaning:"刚健、主动…" } ], // 8 条
  hexagrams: [
    {
      num: 1,                 // 1..64，按通行本（周易）卦序
      name: "乾",
      pinyin: "qián",
      fullName: "乾为天",      // 如「泽天夬」「乾为天」「习坎」
      binary: [1,1,1,1,1,1],  // **自下而上**：binary[0] 是初爻，1=阳(—)，0=阴(- -)
      upper: { sym:"☰", name:"乾", image:"天", pinyin:"qián" },  // 上卦（外卦）
      lower: { sym:"☰", name:"乾", image:"天", pinyin:"qián" },  // 下卦（内卦）
      guaci: { text:"乾，元亨，利贞", trans:"…译文…", anal:"…解析…" },
      lines: [ { label:"初九", text:"潜龙勿用", trans:"…", anal:"…" }, … ], // 6 条，初爻→上爻
      yong: null | { label:"用六", text:"利永贞", trans:"…", anal:"…" }    // 仅坤卦有
    }
  ],
  basics: { yinYang, yinYangNote, origin, mnemonic, trigramTable, coinMethod }
}
```

### 4.2 `window.BAGUA_NAYIN`

```js
{
  jiazi: ["甲子","乙丑",…],            // 60 个，纳音顺序与六十甲子同序
  nayin: [ { jiazi:"甲子", index:0, name:"海中金", element:"金", profile:1 } ], // 60 条
  profiles: [                           // 30 条（三十纳音格局）
    { n: 1, jiazi:["甲子","乙丑"], name:"海中金", alias:"", element:"金",
      judgement:"海中金，金藏沧海深渊…",                       // 一句「象」
      fields: { 禀赋:"…", 性格:"…", 事业:"…", 感情:"…", 短板:"…", 喜:"…", 忌:"…" } }
  ]
}
```

## 5. 全局 API（由 Lead 提供，页面负责人调用）

> 加载顺序保证：`data/* → core/ganzhi.js → core/engine.js → views/* → app.js`。
> **因此视图脚本加载时 `window.BAGUA_UI` 尚不存在**：视图内必须延迟解析（如 `function ui(){ return window.BAGUA_UI || {}; }`），
> 不可在模块顶层 `var UI = window.BAGUA_UI;` 那样立即捕获，否则点击复制 / toast 会抛错。

### 5.1 `window.BAGUA`（engine.js）

```js
BAGUA.hexagrams        // 64 卦数组（同 BAGUA_HEXAGRAMS.hexagrams）
BAGUA.trigrams         // 8 经卦
BAGUA.basics           // 基础内容
BAGUA.nayinData        // BAGUA_NAYIN

BAGUA.esc(str) -> string                 // HTML 转义
BAGUA.el(tag, attrs?, children?) -> Element
BAGUA.findHex(num) -> hexObj | null
BAGUA.findHexByBinary([0|1 ×6]) -> hexObj   // 自下而上，一定有结果
BAGUA.lineLabel(pos0to5, yangBool) -> "初九"|"六二"|…
BAGUA.trigramOfBits([0|1 ×3]) -> trigramObj // 自下而上

// 卦象渲染（唯一权威渲染器，两个页面都用它，不要自己画爻）
BAGUA.renderHex(binaryOrLines, opts) -> HTMLElement
//   binaryOrLines: [0|1 ×6]（自下而上）或 [{yang:0|1, moving?:bool} ×6]
//   opts: {
//     size: 'xs'|'sm'|'md'|'lg'  (默认 'md'),
//     labels: false|true,          // 是否在每爻左侧显示「初九」等
//     showMark: true,              // 动爻显示 ○ / ×
//     highlight: [pos…],           // 需要高亮的爻（0=初爻）
//     ghosts: n,                   // 顶部补 n 条虚线空爻（摇卦预览用）
//     interactive: false
//   }
//   返回 <div class="hex" data-size="md">，内部结构见 §8.5

// 起卦
BAGUA.newToss() -> { coins:[1|0,1|0,1|0], value:6|7|8|9, yang:0|1, moving:bool,
                     kind:"老阳"|"少阳"|"少阴"|"老阴", glyph:"○"|"—"|"- -"|"×" }
BAGUA.buildResult(values6) -> result
//   values6: [6|7|8|9 ×6] 自下而上
//   {
//     values:[…], lines:[{pos:0..5, value, yang, moving, label}],
//     binary:[…], bianBinary:[…],
//     ben: hexObj, bian: hexObj|null,
//     moving:[pos…], createdAt:number, question:string,
//     hasMoving:boolean, allMoving:boolean
//   }
BAGUA.encodeResult(result) -> "678978"      // 6 位数字即可分享
BAGUA.decodeResult("678978") -> values | null
BAGUA.resultText(result) -> string            // 纯文本摘要（复制/分享用）
BAGUA.guide(result) -> [ "…", "…" ]           // 断卦提示条目（0~6 动爻的通行规则）
BAGUA.canvas?   // 无

// 纳音
BAGUA.nayinOfJiazi("甲子") -> { jiazi, index, name, element, profile } | null
BAGUA.profileOfJiazi("甲子") -> profileObj | null
BAGUA.elementColor("金") -> "…"   // 可选：返回语义色名（供样式 data 属性）
```

### 5.2 `window.BAGUA_GANZHI`（ganzhi.js）

```js
BAGUA_GANZHI.GAN = ["甲",…"癸"];  ZHI = ["子",…"亥"];
BAGUA_GANZHI.fourPillars({ y, m, d, h=0, mi=0, zone=8 }) -> {
  year:  { ganzhi:"甲子", gan:0, zhi:0, nayin:{name,element,profile} },
  month: { … }, day: { … }, hour: { … } | null,
  dayBoundary: "日柱以 23:00 换日" | "日柱以 23:00 换日（本时刻已进次日，晚子时）",  // 后者含「晚子时」子串
  warnings: [ "…" ],     // 例如出生时辰接近节气交界
  solarTermHint: "…"     // 当前所处节气说明（可选）
}
BAGUA_GANZHI.dayGanzhi({y,m,d,h,mi}) -> { ganzhi, gan, zhi, index }
BAGUA_GANZHI.jiaziIndex(ganzhi) -> 0..59
BAGUA_GANZHI.termName(index0to23) -> "立春"
BAGUA_GANZHI.solarTermDate(year, termName) -> Date（北京时间）
```

### 5.3 `window.BAGUA_UI`（app.js）

```js
BAGUA_UI.toast(msg, type?)        // type: 'ok'|'warn'|'error'，默认 ok
BAGUA_UI.copy(text) -> Promise<boolean>
BAGUA_UI.route() -> { name, params: URLSearchParams }   // 当前路由
BAGUA_UI.go(name, params?)        // 切换路由，如 BAGUA_UI.go('divination', {r:'678978'})
```

### 5.4 视图模块契约

```js
window.BAGUA_VIEWS = window.BAGUA_VIEWS || {};
window.BAGUA_VIEWS.library = {
  id: 'library',
  mount(el) {},        // el = <section class="view" data-view="library">；只挂载一次
  show(params) {},     // 每次进入该路由调用（含刷新/分享链接）
  hide() {}            // 可选
};
```

`app.js` 负责：创建 4 个 `<section class="view">`、懒挂载、切换 `hidden`/`is-active`、高亮导航。视图**不得**自己改 `document.title` 以外的全局 DOM（可改 `document.title`）。

## 6. 路由

- 格式：`#/divination`、`#/library`、`#/nayin`、`#/basics`；参数用 `?a=b&c=d`。
- 默认（空或未知 hash）→ `#/divination`（用 `location.replace` 或直接渲染，不要产生历史污染）。
- 分享链接：`#/divination?r=678978`，摇卦页 `show(params)` 中若 `params.get('r')` 合法则直接呈现结果。
- 切换页面必须有可见的过渡（淡入/轻微上移），并滚动到顶部。

## 7. 视觉规范

### 7.1 设计语言

「古卷 · 夜色」：深墨底、暖金线、朱砂点。克制留白，衬线中文标题 + 无衬线正文，细边框与轻微纸纹（用 CSS 渐变/噪点 SVG data URI，不得请求外部图片）。禁止霓虹/玻璃拟态堆砌，禁止大面积纯黑纯金。

### 7.2 设计令牌（`css/tokens.css`，其他文件只能用变量，不得硬编码色值）

```css
:root{
  --bg:#0d0f12; --bg-soft:#12151a; --bg-elev:#171b21; --panel:#14181e; --panel-2:#1b2028;
  --ink:#e8e3d8; --ink-dim:#b9b2a4; --ink-faint:#8a8478;
  --gold:#c9a86a; --gold-soft:#e3cf9e; --gold-deep:#8a6d3b;
  --verm:#b3503f; --verm-soft:#d9745f;
  --jade:#6f8f7a;
  --line:rgba(201,168,106,.18); --line-strong:rgba(201,168,106,.34);
  --radius-s:6px; --radius-m:10px; --radius-l:16px;
  --shadow-1:0 1px 2px rgba(0,0,0,.35);
  --shadow-2:0 10px 30px -12px rgba(0,0,0,.7);
  --font-serif:"Songti SC","STSong","Noto Serif SC","Source Han Serif SC",serif;
  --font-sans:system-ui,-apple-system,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px;
  --space-5:24px; --space-6:32px; --space-7:48px; --space-8:64px;
  --dur-1:120ms; --dur-2:240ms; --dur-3:420ms;
  --ease:cubic-bezier(.22,.61,.36,1);
  --maxw:1120px;
  --coin-flip-duration:900ms;   /* 摇卦页硬依赖此值：动画时长必须为 900ms */
}
```
（数值可微调，但**变量名不得改**；`--coin-flip-duration` 必须保留且为 900ms。）

### 7.3 外壳结构（`index.html` 由 Lead 定稿，此处为约定）

```html
<body>
  <a class="skip-link" href="#main">跳到主内容</a>
  <header class="app-header">
    <div class="app-header__inner">
      <a class="brand" href="#/divination">
        <span class="brand__seal">易</span>
        <span class="brand__text"><strong>六十四卦</strong><em>COIN DIVINATION</em></span>
      </a>
      <nav class="site-nav" aria-label="主导航">
        <a class="nav-link" href="#/divination" data-route="divination">摇卦</a>
        <a class="nav-link" href="#/library" data-route="library">六十四卦</a>
        <a class="nav-link" href="#/nayin" data-route="nayin">纳音</a>
        <a class="nav-link" href="#/basics" data-route="basics">基础</a>
      </nav>
    </div>
  </header>
  <main id="main" class="app-main"><!-- 4 个 section 由 app.js 注入 --></main>
  <footer class="app-footer">…</footer>
  <div id="toast-root" class="toast-root" aria-live="polite" aria-atomic="true"></div>
</body>
```
导航激活态：`.nav-link.is-active` + `aria-current="page"`。

### 7.4 通用组件（`css/components.css`，所有页面复用；class 名不得改）

| 组件 | class |
| --- | --- |
| 卡片 | `.card` `.card__head` `.card__title` `.card__sub` `.card__body` `.card__foot` |
| 按钮 | `.btn` `.btn--primary` `.btn--ghost` `.btn--sm` `.btn--icon` |
| 表单 | `.field` `.field__label` `.field__hint` `.input` `.select` `.segmented` `.segment`（选中 `.is-active`） |
| 徽标/标签 | `.badge` `.chip` `.chip--gold` `.chip--verm` `.tag-list` |
| 排版 | `.eyebrow`（小号字距）`.serif` `.muted` `.small` `.center` `.divider` `.stack` `.row` `.spacer` `.grid` `.grid--2` `.grid--3` |
| 引文/解析 | `.quote`（卦辞原文）`.analysis` `.analysis__k`（译文/解析标签） |
| 卦象 | `.hex` `.hex__line` `.hex__bar` `.hex__label` `.hex__mark`（见 §8.5） |
| 硬币 | `.coins` `.coin` `.coin__inner` `.coin__face` `.coin__face--front` `.coin__face--back` `.coin__glyph` `.is-tossing`（见 §8.6） |
| Toast | `.toast-root` `.toast` `.toast--show` `.toast--warn` `.toast--error` |
| 模态框 | `.modal` `.modal__dialog` `.modal__head` `.modal__title` `.modal__close` `.modal__body` `.modal.is-open` |
| 空态 | `.empty` |
| 无障碍 | `.sr-only` `.skip-link` |

页面私有 class 一律加页面前缀：`divi__*`、`lib__*`、`nayin__*`、`basics__*`。

### 7.5 卦象渲染结构（唯一权威，CSS 只需按此写）

```html
<div class="hex" data-size="md">
  <!-- 自下而上：pos=1 是初爻，最后渲染的是上爻；DOM 顺序为 上→下 以免读屏逆序混乱？ -->
  <!-- 约定：DOM 顺序 = 上爻 → 初爻（视觉自上而下），data-pos 标明 1..6 -->
  <div class="hex__line" data-pos="6" data-yang="1" data-moving="0">
    <span class="hex__label">上九</span>   <!-- 仅 labels:true 时存在 -->
    <span class="hex__bar"></span>
    <span class="hex__bar"></span>
    <span class="hex__mark" aria-hidden="true"></span>  <!-- 动爻 ○/×，静爻为空 -->
  </div>
  …
</div>
```
- `data-yang="1"`：两个 `.hex__bar` 合并为一根长横（CSS 让两段紧贴、无缝隙、无圆角中缝）。
- `data-yang="0"`：两段之间留中缝（约 0.55em）。
- 动爻 `.hex__line[data-moving="1"]` 需有朱砂色高亮 + 轻微脉冲（`prefers-reduced-motion` 下取消）。
- `data-size` 映射宽度：`xs`≈64px、`sm`≈96px、`md`≈132px、`lg`≈184px（用 `--hex-w` 变量控制，行高约 10%）。
- 隐藏 `ghosts`（预览未摇出的爻）：`.hex__line[data-ghost="1"]`，虚线、低透明度。

### 7.6 硬币结构（摇卦页硬依赖）

```html
<div class="coins" id="divi-coins">
  <div class="coin" data-face="yang">        <!-- data-face: yang(正面/阳) | yin(反面/阴) -->
    <div class="coin__inner">
      <div class="coin__face coin__face--front"><span class="coin__glyph">乾</span></div>
      <div class="coin__face coin__face--back"><span class="coin__glyph">坤</span></div>
    </div>
  </div>
  × 3
</div>
```
- `data-face="yang"` 显示正面（乾/阳），`"yin"` 显示反面（坤/阴）。
- 摇卦页在 `.coins` 上加 `.is-tossing` 触发动画，**900ms 后移除**并按结果设置 `data-face`。
- `prefers-reduced-motion` 时只做淡入/闪光，不旋转。

## 8. 页面契约

### 8.1 摇卦页（Lead 实现，视觉设计需按此写 `components.css` 等）

流程：默念所问 → 摇 6 次 → 得到本卦 / 变卦 / 动爻 → 展示卦辞、爻辞、断卦提示 → 可复制/分享/再看历史。

DOM 大纲（class 名固定）：
- `.divi` 容器，`.divi__main` 主列，`.divi__side` 侧列（规则速览）
- 提问卡片：`.ask-card` 内 `.field` + `.input#divi-question`
- 摇卦卡片：`.toss-card` 内 `.coins#divi-coins`、`.toss__hint#divi-hint`、`.toss__badge#divi-toss-badge`（显示本次三枚结果）、按钮 `#divi-toss`/`#divi-auto`/`#divi-reset`、进度 `.divi-progress` + `.divi-progress__dot`
- 预览：`.preview-card` > `#divi-preview`
- 结果：`#divi-result.result`，含 `.result__head`（`.eyebrow`/`h2.result__name`/`.result__pinyin`/`.result__fullname`）、`.result__actions`（按钮 `.btn--sm`）、`.result__charts`（`.chart` `.chart--ben` `.chart--bian` `.chart__cap` `.chart__hex` `.chart__name` `.chart__arrow`）、`.result__body`（`.block` `.block__title`、`.quote`、`.analysis`、`.lines` > `.line-item` `.is-moving`、`.guide` > `li`）
- 历史：`.history` > `.history__item`（`.history__name` `.history__meta`）

### 8.2 六十四卦页（负责人自定细节，必须复用 §7.4 组件与 §7.2 令牌）

要求：
- 搜索框（卦名 / 拼音 / 序号 / 全名 / 卦辞关键字，输入即筛，防抖 ≤120ms）。
- 过滤：八经卦（上卦或下卦）筛选；至少支持「全部 / 按上卦 / 按下卦」。
- 64 张卦卡（`.lib__grid`），每卡：序号、卦象（`BAGUA.renderHex(binary,{size:'xs'})`）、卦名 + 拼音 + 全名、一句「卦意」（取 `guaci.anal` 首句，过长截断）。
- 点击卡片打开详情（复用 `.modal`）：卦象（`size:'lg'`、`labels:true`）、上下卦、卦辞原文/译文/解析、六爻全文、`yong`（若有）。支持 ESC 关闭、焦点还原、滚动锁定。
- 空结果 `.empty`；键盘可用（卡片是 `<button>`）。

### 8.3 纳音页（负责人自定细节，必须复用组件与令牌）

- 输入出生日期（`<input type="date">`）+ 时分（`<input type="time">`，可空）→ 调 `BAGUA_GANZHI.fourPillars` → 展示四柱（年月日时）与各自纳音，以及**年柱纳音对应的「三十纳音格局」**详情。
- 提示清晰：以立春分年、以节气分月；说明时辰可留空（则仅显示年月日三柱）；`warnings` 需以 `.analysis` 或 `.badge` 形式展示。
- 六十甲子检索：下拉选择任意甲子 → 显示纳音名 + 对应格局卡。
- 「三十纳音格局」浏览：按金/木/水/火/土分组，点击查看完整 7 项（禀赋/性格/事业/感情/短板/喜/忌）+ `judgement`。
- 免责：纳音属传统命理，仅供文化参考。

### 8.4 基础页（Lead 实现）

阴阳爻、八卦表（`.basics__trigrams`）、摇卦规则（`.basics__steps`）、六爻结构与画卦顺序说明。

### 8.5 无障碍与质量底线

- 所有交互可键盘操作；可见 `:focus-visible` 轮廓。
- 卦象给 `aria-label`（如「泽天夬，上兑下乾」），纯装饰元素 `aria-hidden="true"`。
- 对比度不低于 WCAG AA（正文 ≥4.5:1）。
- 无控制台报错；无 404（本地起服务验证）。
- 首屏 JS 执行后无布局跳动，移动端 375px 下无横向滚动。

## 9. 验收清单（每个人交付前自查）

1. 起本地静态服务后打开 `http://127.0.0.1:8787/index.html#/<你的路由>`，功能可用、无控制台错误。
2. 375 / 768 / 1440 三个宽度截图无明显破版。
3. 只改了自己负责的文件（`git` 不可用时用 `Get-ChildItem` 核对修改时间）。
4. 不使用任何外部 URL；`Ctrl+F` 搜 `http` 仅应出现注释/文档链接。
5. `prefers-reduced-motion` 下有可用的静态版本。
