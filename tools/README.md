# 博客的搜索为什么改了

Docsify 自带的搜索有三个坑，这一个目录里放的是补丁和配套脚本。

> 日常维护、换电脑、出故障先看什么，都在仓库根的 **`AGENTS.md`**；
> 这份文件只讲"当初为什么要改"。

## 1. `search.paths: 'auto'` 只索引“当前侧边栏里有的页面”

`auto` 会去读 `.sidebar-nav a`，也就是**当前这个目录的侧边栏**。
从首页进博客时侧边栏只有 FootPrint 那几项，于是整站 43 篇 md 里只有 9 篇进了索引，
其余页面（包括整个 NoteBook 和 Warehouse）永远搜不到。

现在 `index.html` 里换成了一份**写死的 43 个路径**。

**以后新增或改名 md，清单要跟着更新** —— 仓库装了 `pre-commit` 钩子，提交时自动做，
不需要你记着跑（见第 9 节末尾）。忘了装钩子的话，手动跑一次：

```bash
python3 tools/update-search-paths.py
```

不跑的话新页面不会进搜索（页面本身照常能访问）。

## 2. 索引里存的是 markdown 原文

`[文字](https://很长的链接)`、`![](图片)`、`**`、`` ` ``、表格的 `|` 全都原样进了索引。
所以正文写着 `打开 [搬瓦工中文网](https://...)`，搜「打开搬瓦工中文网」是 0 条。

补丁在索引前把这些语法剥成读者看到的纯文本，并且删掉中文之间被链接切开的那几个空格。

## 3. 一个 404 会让整块索引作废

`Warehouse/_sidebar.md` 里 `Warehouse/2_MySQL.md` 指向了不存在的文件，
搜索初始化时这一个请求失败，导致整个 Warehouse 的索引一条都没存进 localStorage。

补丁改成：单个文件抓不到就跳过，其余照常存。

## 4. 搜索结果里看不到关键字

原先标题命中、正文没命中时，摘要会退回正文开头的 70 个字，于是条目里一个关键字都没有；
另外摘要先转义再切，`>`、`&` 转义后偏移算错，也会正好把关键字切掉。

现在是「先切原文、再逐段转义、命中段包高亮」：每一行都是正文里真实的一处命中，
行里一定带着关键字。标题不再单独成行（改成块级索引后，每处命中都在正文里）。

## 5. 一页只出一条，命中 200 次也只看到一条

原来的索引是「一个标题段一条」，一整个标题下的内容（可能十几万字）挤成一条结果，
页面上剩下 200 处命中在搜索栏里完全看不见。
现在索引下沉到**段落块**（每个 `marked` 顶层 token 一条：一段、一个列表、一张表、一个标题），
于是每一处命中都能单独成行：搜索结果按页面分组，组头是页面名和「N 处」，
下面每处一行，带命中词前后 12 / 60 字的上下文、命中词本身绿色加粗。
只给一行字、不带小标题，所以摘要最多显示 3 行；前面的上下文刻意留得短，
否则 40 字的前缀会把命中词挤出可见区，看起来像"这一条没搜到关键词"。
组内先显示 10 行，后面的收在「展开本页其余 N 处」按钮里；组头本身也可以点开/收起。

分组按命中数从多到少排，所以「止损」这种词排第一的页面（234 处）会直接出现在最上面。

## 6. 点进页面后不定位、不高亮

Docsify 只会滚到 `?id=` 那个标题，正文里的关键字既不定位也不标记。
现在点搜索结果后，会在所在页面里把所有命中的词包成 `<mark>`，
其中**你点的那一处**是深色的「当前」，页面滚到它，而不是滚到第一个命中。

定位不能只数「第几个 `mark`」：索引里存的是剥掉 markdown 的纯文本，
页面里是渲染后的 HTML，两边的命中顺序会有偏差。所以每条结果还带着命中前 20 字的原文，
进页后用它去比对每个 `mark` 前面的文本，取吻合最长的那一处。跳走以后不会在别的页面上残留。

滚动是**进页当帧就到位**的。早先为了等 Docsify 自己那段 500ms 的锚点动画，
插件会先等 700ms 再滚，读起来就是"先到标题、再跳到关键词"两段位移；
实测 Docsify 4.13.1 对这个博客的 `?id=` 深链根本没触发滚动，
所以现在直接滚，之后 700ms / 1500ms 只在关键词已经不在视野里时才补一次。

## 7. 索引缓存多久重建一次

`index.html` 里的 `maxAge` 现在是 **1 小时**（`3600000` 毫秒）：

```js
namespace: 'v3',       // 索引格式变了（块级），换掉旧缓存
maxAge: 3600000,       // 索引缓存多久重建一次（1 小时）
```

改笔记频繁的话这个值可以再调小，改完记得递增 `plugins/search-docsify.min.js?v=` 的数字
（只改 `maxAge` 不需要递增，插件没变）。

`namespace` 是索引的缓存命名空间，索引结构一变就必须换一个值（`v2` → `v3`），
否则浏览器会继续用旧结构的那份缓存，搜索直接报错。

**清单变了就不用等这 1 小时**：插件把建索引时用的页面清单存成指纹
（`docsify.search.index/v3:pages`），下次打开一比对，不一样就立刻重建 ——
还留在清单里的页面直接用缓存，新页面当场抓，从清单里删掉的页面顺手清掉。
这条是后来补的：早先只有 `maxAge`，加完笔记要等一小时才能搜到，读者和作者都会被卡住。

全站索引的实测规模：43 页 / 6352 块 / 约 2.2 MB，正好在 localStorage 5 MB 限额内；
本地建索引约 0.2 秒，真实访问还要加上抓 43 个 md 的网络时间。

## 8. 不再依赖别人的 CDN

`index.html` 原来从 jsdelivr 拉 docsify 内核和主题：

```html
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/themes/vue.css">
<script src="//cdn.jsdelivr.net/npm/docsify/lib/docsify.js"></script>
```

现在两个文件都放进了本仓库，指向本地：

```html
<link rel="stylesheet" href="plugins/vue.css?v=1">
<script src="plugins/docsify.min.js?v=1"></script>
```

内核是 **4.13.1**（和搜索插件同一份源码编译出来的，也是所有测试跑过的那一套）。
换掉之前线上用的是 CDN 上的 4.10.2，内核和插件版本并不一致。

这么改以后：jsdelivr 挂了、被封、或者官方删库，博客都照常打开。
`vue.css` 第一行原本还有一句 `@import` 去 Google Fonts 取 Source Sans Pro，
国内拿不到时**会把整个页面卡住**（实测首屏 DOM 就绪从 45ms 变成 10 秒），
也一起删掉了——字体退回系统自带的 Helvetica / Arial，排版看着没有区别。

把 `index.html` 里所有外链都断掉实测过：首屏 54ms 就绪，页面、侧栏、搜索、定位、
代码块、复制按钮全部正常。

剩下的外部资源只有一类，不影响站点运行：笔记里插图用的
`raw.githubusercontent.com/jiangsai0502/PicBedRepo`（779 处），是你自己的图床。
真要彻底自主，得把这些图搬到仓库里。

**以后升级 docsify 内核**：从 `~/Documents/GitHub/SaiDocsify` 重新 `npm run build:js`
（内核）或 `npm run build:css:min`（主题），把 `lib/docsify.min.js`、`lib/themes/vue.css`
复制进 `plugins/`，然后把 `?v=` 递增。

## 9. 搜索结果的顺序：栏目 → 侧栏 → 正文

原来是按命中数降序（`b.count - a.count`）：搜「止损」时「仓储 HuZi (234 处) →
NoteBook 订单流交易 (70 处) → 仓储 XingYanShe (60 处)」这样栏目前后跳，看着很乱。
命中多只说明这篇反复提到这个词，跟它有多重要没关系。

现在按**阅读顺序**排，三层：

```
栏目（index.html 顶部 <nav> 的次序）
  └ 该栏目内文档（这个栏目的侧栏从上到下）
      └ 页内命中（正文里的先后）
```

排序键就是 `search.paths` 的数组顺序（插件在 `init()` 时把它记成 `PAGE_RANK`，
`search()` 按它排），所以**那个数组必须保持阅读顺序**。`tools/update-search-paths.py`
已经照这几条生成：

1. 栏目次序从 `index.html` 顶部的 `<nav>` 读（现在是 脚印 → 仓储 → NoteBook，
   以后改 nav 或增删栏目，跑一次脚本就跟着变）；
2. 栏内次序从该栏目的 `_sidebar.md` 读（脚印用根目录的 `_sidebar.md`）——
   也就是你平时浏览时右侧看到的目录顺序；
3. 侧栏没列出的页面排在该栏目**末尾**，按名字排序。

命中数仍然显示在组头（「234 处」），但不再决定顺序。

**维护方式**：想让某篇在搜索结果里往前，就在侧栏里把它往上挪。新加的笔记在进侧栏之前，
会落在所在栏目的最后。侧栏目前只列了 43 篇里的 21 篇（NoteBook 18 篇只列了 4 篇），
没列的那些就都堆在各自栏目的尾部。

`index.html` 里那份清单由 `tools/update-search-paths.py` 重建，**不需要你手动跑**：
仓库装了 `pre-commit` 钩子，提交时自动重跑并把 `index.html` 一起加进这次提交。
所以日常流程还是三步：写完 md → 在侧栏摆好位置 → 提交（桌面版或命令行都一样）。

钩子在 `.git/hooks/`（git 不跟踪），新克隆/换电脑要装一次：

```bash
sh tools/install-hooks.sh
```

提交时如果 Python 不可用或脚本报错，钩子会**中止提交**并说明原因，而不是悄悄提交一份
过期的清单；真要跳过用 `git commit --no-verify`。手动重建清单仍然可以：

```bash
python3 tools/update-search-paths.py
```

改排序**不需要**换 `namespace`：索引结构没变，只换了排序。但插件文件变了，
`plugins/search-docsify.min.js?v=` 要递增。

## 文件

| 路径 | 说明 |
|---|---|
| `plugins/docsify.min.js` | docsify 内核 4.13.1（自托管，原来是 CDN） |
| `plugins/vue.css` | docsify 默认主题（自托管，原来的 Google Fonts `@import` 已去掉） |
| `plugins/search-docsify.min.js` | 打好补丁的搜索插件（从同一份 4.13.1 源码构建） |
| `tools/update-search-paths.py` | 重新生成 `index.html` 里的路径列表（顺序 = 栏目 → 侧栏） |
| `tools/install-hooks.sh` | 装 `pre-commit` 钩子，提交时自动跑上面那个脚本 |

## 重新构建搜索插件

补丁源码在 `~/Documents/GitHub/SaiDocsify`（GitHub 上的同名仓库，就是 4.13.1 的源码）；
`~/Documents/GitHub/docsify` 那个旧目录已经搬过去了：

```bash
cd ~/Documents/GitHub/SaiDocsify
npm run build:js
cp lib/plugins/search.min.js ~/Documents/GitHub/Sai0502.github.io/plugins/search-docsify.min.js
```

改动在 `src/plugins/search/{search,component,index}.js`。

内核和主题也从同一个仓库出：

```bash
cd ~/Documents/GitHub/SaiDocsify
npm run build:js && npm run build:css:min
cp lib/docsify.min.js lib/themes/vue.css ~/Documents/GitHub/Sai0502.github.io/plugins/
```

复制完记得把 `index.html` 里对应的 `?v=` 数字递增，否则浏览器会用缓存里的旧文件。
主题的 Google Fonts `@import` 已经在源码 `src/themes/vue.styl` 里删掉了，
重建出来的 `vue.css` 开头就是 `*{-webkit-font-smoothing...`，不用再手动处理。
