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
