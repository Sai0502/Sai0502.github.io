# AGENTS.md — 这个仓库怎么运转，坏了先看哪里

> 给接手这个仓库的 AI（也给人看）：先读完这一页再动手。
> 这里记的是**代码里看不出来的约定**：为什么这么写、哪些文件是产物、哪些步骤藏在自动化里、
> 出了症状该先查哪一处。改动过程中的历史原因（每次修了什么 bug）在 `tools/README.md`。
>
> 本文件的事实都经过实测（本地无头浏览器 + 线上抓取）。如果现状和本文不符，
> 说明有人改过但没更新这里：**以实测为准，并把这个文件改对**。

---

## 0. 三十秒地图

- 纯静态博客，Docsify **4.13.1**，托管在 GitHub Pages，域名 `sai0502.github.io`。
- 内容分三个栏目：`FootPrint/`（脚印）、`Warehouse/`（仓储）、`NoteBook/`（NoteBook）。
  栏目次序写在 `index.html` 顶部的 `<nav>` 里，**这是唯一的权威来源**。
- 页面打开时只加载仓库里的本地文件：`plugins/vue.css`、`plugins/docsify.min.js`、
  `plugins/search-docsify.min.js`。**没有任何 CDN 依赖**（正文里引用的外链不算）。
- 搜索插件是**自己改过的**，不是官方版。它的源码不在本仓库，在另一个仓库 `SaiDocsify`。

---

## 1. 两个仓库，各管一半

| 仓库 | 内容 | 什么时候动它 |
|---|---|---|
| `Sai0502.github.io`（本仓库） | 笔记 `.md`、侧栏、`index.html`、`plugins/` 里的成品 | 写笔记、改样式、改搜索配置 |
| `SaiDocsify` | Docsify 4.13.1 源码 + 我们对搜索插件的改造 + `lib/` 编译产物 | 只有改插件/内核/主题的行为时才动 |

`SaiDocsify` 里的 `lib/` 和 `themes/` **是刻意提交的**（不是构建垃圾）：博客直接加载这些文件，
所以成品要跟着源码一起存档。`node_modules/` 已被 `.gitignore` 排除，别再加回去。

判定方法：本仓库 `plugins/*.min.js` 里的文件，如果 `SaiDocsify/lib/` 下没有对应物，
说明有人绕过了源码直接改产物——那是错的做法，见第 12 节。

---

## 2. 目录职责

| 路径 | 是什么 |
|---|---|
| `index.html` | 唯一的入口。样式、`$docsify` 配置、顶部 `<nav>`、脚本加载顺序都在这里。**CRLF 行尾** |
| `FootPrint/` `Warehouse/` `NoteBook/` | 三个栏目的 `.md` 笔记 |
| `_sidebar.md` | 根侧栏，脚印栏目用它（`FootPrint/` 下没有自己的侧栏） |
| `Warehouse/_sidebar.md` `NoteBook/_sidebar.md` | 这两个栏目各自的侧栏 |
| `plugins/` | 运行时成品：内核、主题、搜索插件、Prism 等。**都是产物，不手改** |
| `tools/update-search-paths.py` | 重建 `index.html` 里的 `search.paths` 列表 |
| `tools/install-hooks.sh` | 装 `pre-commit` 钩子，提交时自动跑上面那个脚本 |
| `tools/README.md` | 每次搜索改造解决了什么问题的详细记录 |

Docsify 的侧栏规则：页面在哪个目录，就用那个目录的 `_sidebar.md`；没有则回落到根 `_sidebar.md`。
所以脚印用根侧栏、仓储和 NoteBook 各用自己的。

---

## 3. 运行时链路（搜索）

```
打开 index.html
  ├─ plugins/vue.css?v=2
  ├─ plugins/docsify.min.js?v=1        内核 4.13.1
  ├─ window.$docsify = { search: {...} }   ← paths / namespace / maxAge 在这里
  └─ plugins/search-docsify.min.js?v=7  改造过的搜索插件
         │
         ├─ init()：把 paths 的下标记进 PAGE_RANK（决定结果顺序）
         ├─ init()：抓 paths 里的每个 .md，切成块，写进 localStorage
         └─ search(词)：按块出命中，按页分组，用 PAGE_RANK 排序
```

索引存在 `localStorage`：

| key | 内容 |
|---|---|
| `docsify.search.index/v3` | `{ "/路径": { "块id": {slug, title, body} } }` |
| `docsify.search.expires/v3` | 过期时间戳（`maxAge` = 1 小时） |
| `docsify.search.index/v3:pages` | 建索引时用的**页面清单指纹**（JSON 字符串） |

`v3` 是 `index.html` 里的 `namespace`。索引结构一变就必须换一个值（`v3` → `v4`），
否则读者的浏览器会用旧结构的缓存直接报错。只改排序、改清单**不需要**换。

---

## 4. 四条不变量（改任何东西之前先读）

1. **`search.paths` 的数组顺序 = 搜索结果的阅读顺序。**
   栏目次序 → 栏内文档次序。它不是随便一份清单，顺序有语义。
2. **`plugins/*.min.js` 是编译产物。** 要改行为，去 `SaiDocsify` 改源码、重新构建、复制回来。
3. **`index.html` 是 CRLF。** 用 Python 改它必须 `io.open(..., newline='')`，
   否则整个文件会被转成 LF，产生 300 多行的假 diff。
4. **插件文件变了，`plugins/search-docsify.min.js?v=` 必须递增**（现在是 `7`）。
   不递增，读者浏览器和 GitHub Pages 会继续用旧文件，表现为"改了没效果"。
   只改 `index.html` 里的配置（`namespace`、`maxAge`、`paths`）**不需要**递增。

---

## 5. 搜索结果为什么是这个顺序

按三层排，从外到内：

```
栏目（index.html 顶部 <nav> 的次序：脚印 → 仓储 → NoteBook）
  └ 栏目内文档（该栏目 _sidebar.md 里从上到下）
      └ 页内命中（正文里的先后）
```

实现：`search.js` 的 `init()` 里 `PAGE_RANK[path] = index`（`paths` 的数组下标），
`search()` 末尾 `rank(a.path) - rank(b.path) || a.path.localeCompare(b.path)`，
不在清单里的路径排最后。**命中数不参与排序**，只在组头显示「N 处」。

结果面板的其他固定行为（别无意中改掉）：

- 按页分组，每组默认 10 条，多的折起来，点「展开本页其余 N 处」；
- 摘要 3 行截断，命中前后各 12 / 60 字上下文；
- 每条命中自带高亮，没有灰色小标题行；
- 点某一条：跳进页面、当帧滚到那一处、把命中标成 `mark.search-hit-current`；
- 关键词是 OR 语义（整串 + 各分词都算）。

---

## 6. `search.paths` 为什么存在，谁在维护它

**为什么不能自动**：静态站没法列出自己目录下有哪些 `.md`。搜索插件必须拿到一份页面清单。

**为什么不用 `paths: 'auto'`**：那个模式是读**当前那一页渲染出来的侧栏**。
站在脚印页面搜只覆盖根侧栏那 8 篇，站在仓储页面只覆盖 9 篇，NoteBook 只 4 篇 ——
全站 43 篇里有 22 篇从来没被搜到过。这就是当初改成固定清单的原因。

**怎么维护**（对人是零步骤）：

```
tools/update-search-paths.py  读数据生成清单：
  1. 栏目次序：index.html 顶部 <nav> 的 #/<栏目>/ 链接
  2. 栏内次序：该栏目 _sidebar.md 的链接顺序
  3. 侧栏没列出的页面：追加到该栏目末尾，按名字排序
                        ↑ 目前 21/43 篇在侧栏里，其余 22 篇都落在各栏尾部

tools/install-hooks.sh       写 .git/hooks/pre-commit：
  提交时自动跑上面那个脚本，并把 index.html 一起加进这次提交
```

**钩子失败会中止提交**（不会静默提交过期清单），报错里会说明是 python3 缺失还是脚本报错。
临时跳过用 `git commit --no-verify`。

**忘了装钩子的后果**：新笔记照常能访问、能点开，但**搜不到**，而且排序不在侧栏该在的位置。

---

## 7. 三层缓存（"改了没生效"看这里）

| 层 | 位置 | 什么时候失效 |
|---|---|---|
| 静态文件 | `index.html` 里的 `?v=` 数字 | 手动递增才失效。改插件必须递增 |
| 搜索索引 | 读者浏览器的 `localStorage` | `maxAge` 到点（1 小时）**或者**清单指纹变了 |
| GitHub Pages | 边缘缓存 | 推送后通常几十秒内生效 |

清单指纹（`docsify.search.index/v3:pages`）是插件新增的判断：`paths` 一变（加笔记、改名、
在侧栏里挪位置），下次打开立刻重建索引，**不用等 1 小时**。只保留还在清单里的页面，
新增的页面当场抓取。

---

## 8. 哪些东西跟着克隆走，哪些是本机的

| 东西 | 位置 | 克隆/换电脑后 |
|---|---|---|
| 笔记、侧栏、`index.html`、`plugins/` 成品 | 仓库里 | 自动就有 |
| `tools/*.py` `tools/*.sh` | 仓库里 | 自动就有 |
| **pre-commit 钩子** | `.git/hooks/pre-commit` | **要装一次**：`sh tools/install-hooks.sh` |
| `SaiDocsify/node_modules` | 381 MB，被忽略 | 重建内核/插件时才需要 `npm install` |
| Node.js / npm | 系统 | 只写笔记不需要；重建插件才需要 |
| Python 3 | 系统（macOS 装了 Xcode 命令行工具即有 `/usr/bin/python3` 3.9） | 钩子用它；缺了提交会被拦下并提示 |

**换电脑 / 重装系统的完整清单**（其余照旧）：

```bash
# 1. GitHub Desktop 登录 → Clone Sai0502.github.io（和以前一样）
# 2. 仓库根目录跑一次，给这台机器装提交钩子
sh tools/install-hooks.sh
# 之后就是老流程：改 md → 摆侧栏 → 提交/推送
```

只有"重新编译插件/内核"才需要 `SaiDocsify` + Node：

```bash
git clone https://github.com/Sai0502/SaiDocsify && cd SaiDocsify && npm install
```

---

## 9. 重建成品（改插件、内芯、主题时）

```bash
cd ~/Documents/GitHub/SaiDocsify

npm run build:js        # lib/plugins/search.min.js（搜索插件）+ lib/docsify.min.js（内核）
npm run build:css:min   # lib/themes/vue.css（压缩主题）

cp lib/plugins/search.min.js      ~/Documents/GitHub/Sai0502.github.io/plugins/search-docsify.min.js
cp lib/docsify.min.js             ~/Documents/GitHub/Sai0502.github.io/plugins/docsify.min.js
cp lib/themes/vue.css             ~/Documents/GitHub/Sai0502.github.io/plugins/vue.css
```

复制完递增 `index.html` 里对应文件的 `?v=`。改完在 `SaiDocsify` 里提交源码 + `lib/`，
在本仓库提交成品 + `index.html`，两边都推。

**指纹对照**（用来确认成品没被绕过源码手改）：

| 文件 | 字节 | md5 |
|---|---|---|
| `plugins/docsify.min.js` | 160639 | `2a57052c07a7e3e08699582b4eb63f6a` |
| `plugins/vue.css` | 12966 | `fe4ac040f26c5a4ff0798f3c19efb16e` |
| `plugins/search-docsify.min.js` | 15373 | `583fd8682d38586408ba4d4ac9ec886c` |

主题源码 `src/themes/vue.styl` 第一行的 Google Fonts `@import` 已删。**别加回来**：
被墙时它会把首屏卡 10 秒（实测 DOM 就绪从 45ms 变成 10s）。字体退回系统 Helvetica / Arial，
排版没有可见区别。

---

## 10. 怎么验证（改完搜索相关的东西必做）

```bash
# 1. 起一个本地服务（在仓库根目录或临时副本里都行）
python3 -m http.server 8904

# 2. 地址必须带 #/，否则是空壳页
open 'http://127.0.0.1:8904/#/FootPrint/'
```

要自动化的话（这台机器上已验证可用）：

```js
// playwright-core 只有 CommonJS 默认导出，具名导入会 SyntaxError
import pw from '/Users/sai/Documents/GitHub/SaiDocsify/node_modules/playwright-core/index.js';
const { chromium } = pw;
const browser = await chromium.launch({
  executablePath:
    '/Users/sai/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  args: ['--headless=new'],
});
```

回归要点（这几条是用户明确要求的，改完必须一条条过）：

1. 搜「止损」：17 个页面组顺序严格递增，仓储那组连成一块、NoteBook 连成一块，不交叉；
2. 第一组显示 10 条 → 点「展开本页其余」变全部 → 点组头折叠回 10 条；
3. 点第 7 条：进页后 `mark.search-hit-current` 在视口内（`top` 是正数）；
4. 摘要 3 行、无小标题行、每条都带 `mark.search-keyword`；
5. 无 `pageerror`。

---

## 11. 故障速查

| 症状 | 先查这一处 | 处理 |
|---|---|---|
| 新写的笔记搜不到 | `index.html` 的 `search.paths` 里有没有它 | 跑 `python3 tools/update-search-paths.py`；顺手查钩子装没装 |
| 搜索结果顺序不对 | `search.paths` 的顺序 vs 侧栏顺序 | 侧栏是权威，跑脚本重建 |
| 某篇明明存在却搜不到 | 它是不是没进 `paths`（比如在别的目录） | 加进侧栏，跑脚本 |
| 改了插件没变化 | `?v=` 有没有递增 | 递增后强刷 |
| 改完 `paths` 立刻搜不到新页 | 浏览器里是不是旧索引 | 现在不会了（有指纹校验）；若仍是旧版插件，等 1 小时或清 localStorage |
| 搜索整个不出结果 | `localStorage` 里索引是否完整、`namespace` 是否对得上 | 清 `docsify.search.*` 再看；索引约 2.2 MB / 43 页 / 6352 块 |
| 首屏空白十几秒 | `plugins/vue.css` 第一行是不是又出现 `fonts.googleapis` | 删掉并递增 `?v=` |
| 索引里混进 404 页 | 某个 `paths` 指向不存在的文件 | 修 `paths`；单个 404 不会拖垮整块索引（已处理） |
| 提交被 pre-commit 拦下 | 报错里写的原因（python3 缺失 / 脚本失败） | 装 python3 或修脚本；应急 `--no-verify` |

---

## 12. 别做的事

- **别手改 `plugins/*.min.js`**：下次构建就丢，源码在 `SaiDocsify`。
- **别把 `index.html` 转成 LF**。
- **别把 `paths` 改回 `'auto'`**：会退回"只索引当前栏目侧栏"的残状态（22 篇搜不到）。
- **别在 `paths` 里手动增删**：跑脚本，否则下次提交钩子会把它改回去。
- **别给主题加回 Google Fonts**。
- **别删 `.git`、别删任何 `.md`**（笔记不可再生；成品可以重建）。
- **别把 `node_modules` 提交进 `SaiDocsify`**。

---

## 13. 现状锚点（写这段时的状态）

- 本仓库提交：`e6d4694`（本文件 + 搜索插件 7）、`cc9bed7`（钩子）、`499121f`（排序）。
- `SaiDocsify` 提交：`f8ccf0b`（清单变更立即重建）、`6d82afd`（4.13.1 源码 + 搜索改造）。
- 索引规模：43 页 / 6352 块 / 2,236,890 字节（localStorage 5 MB 限额内）。
- 侧栏覆盖：脚印 8/11、仓储 9/14、NoteBook 4/18（未列出的排各栏末尾）。
- 内核版本：`window.Docsify.version === '4.13.1'`。
- 搜索插件版本号：`plugins/search-docsify.min.js?v=7`。
