# 博客的搜索为什么改了

Docsify 自带的搜索有三个坑，这一个目录里放的是补丁和配套脚本。

## 1. `search.paths: 'auto'` 只索引“当前侧边栏里有的页面”

`auto` 会去读 `.sidebar-nav a`，也就是**当前这个目录的侧边栏**。
从首页进博客时侧边栏只有 FootPrint 那几项，于是整站 43 篇 md 里只有 9 篇进了索引，
其余页面（包括整个 NoteBook 和 Warehouse）永远搜不到。

现在 `index.html` 里换成了一份**写死的 43 个路径**。

**以后新增或改名 md，必须跑一次：**

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

**以后升级 docsify 内核**：从 `~/Documents/GitHub/docsify` 重新 `npm run build:js`
（内核）或 `npm run build:css:min`（主题），把 `lib/docsify.min.js`、`lib/themes/vue.css`
复制进 `plugins/`，然后把 `?v=` 递增。

## 文件

| 路径 | 说明 |
|---|---|
| `plugins/docsify.min.js` | docsify 内核 4.13.1（自托管，原来是 CDN） |
| `plugins/vue.css` | docsify 默认主题（自托管，原来的 Google Fonts `@import` 已去掉） |
| `plugins/search-docsify.min.js` | 打好补丁的搜索插件（从同一份 4.13.1 源码构建） |
| `tools/update-search-paths.py` | 重新生成 `index.html` 里的路径列表 |

## 重新构建搜索插件

补丁源码在 `~/Documents/GitHub/docsify`（分支 `main`，也就是 GitHub 上的 `SaiDocsify`）：

```bash
cd ~/Documents/GitHub/docsify
npm run build:js
cp lib/plugins/search.min.js ~/Documents/GitHub/Sai0502.github.io/plugins/search-docsify.min.js
```

改动在 `src/plugins/search/{search,component,index}.js`。

内核和主题也从同一个仓库出：

```bash
cd ~/Documents/GitHub/docsify
npm run build:js && npm run build:css:min
cp lib/docsify.min.js lib/themes/vue.css ~/Documents/GitHub/Sai0502.github.io/plugins/
```

复制完记得把 `index.html` 里对应的 `?v=` 数字递增，否则浏览器会用缓存里的旧文件。
另外 `npm run build:css:min` 出来的 `vue.css` 开头带着 Google Fonts 的 `@import`，
复制过去以后要手动删掉那一行（就是它让国内打开时白屏 10 秒）。
