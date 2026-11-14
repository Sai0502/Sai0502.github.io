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

标题命中、正文没命中时，摘要会退回正文开头的 70 个字，于是条目里一个关键字都没有。
现在：标题里的关键字也会高亮；正文里没有就不摘录（宁可只显示标题，也不给一段无关的正文）。
摘录改成先切原文再转义，避免 `>`、`&` 被转义后偏移算错、正好把关键字切掉。

## 5. 点进页面后不定位、不高亮

Docsify 只会滚到 `?id=` 那个标题，正文里的关键字既不定位也不标记。
现在点搜索结果后，会在所在页面里把所有命中的词包成 `<mark>`（第一个是深色的「当前」），
并滚到第一个命中处。跳走以后不会在别的页面上残留。

## 文件

| 路径 | 说明 |
|---|---|
| `plugins/search-docsify.min.js` | 打好补丁的搜索插件（从 docsify 4.13.1 源码构建） |
| `tools/update-search-paths.py` | 重新生成 `index.html` 里的路径列表 |

## 重新构建搜索插件

补丁源码在 `~/Documents/GitHub/docsify`（分支 `search-cn`）：

```bash
cd ~/Documents/GitHub/docsify
npm run build:js
cp lib/plugins/search.min.js ~/Documents/GitHub/Sai0502.github.io/plugins/search-docsify.min.js
```

改动在 `src/plugins/search/{search,component,index}.js`。
