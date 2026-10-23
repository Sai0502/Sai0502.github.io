# Temptation Blocker 安装说明

一个本地 Chrome 扩展：当你访问你列在 `rules.json` 里的网站时，自动跳转到「这是魔鬼的诱惑么」那一页。

## 安装步骤（Mac / Windows 通用）

1. 打开 Chrome，地址栏输入 `chrome://extensions` 回车
2. 右上角打开「开发者模式 / Developer mode」
3. 点左上角「加载已解压的扩展程序 / Load unpacked」
4. 选这个 `blocker-extension` 文件夹（就是包含 manifest.json 的那一层）
5. 装好后，看到「Temptation Blocker」出现在列表里就成了

## 让它在无痕窗口里也生效（你问的重点）

默认无痕模式是不加载扩展的，需要手动开：

1. 在 `chrome://extensions` 页面，点 Temptation Blocker 卡片上的「详细信息 / Details」
2. 找到「允许在无痕模式下运行 / Allow in incognito」，打开开关
3. 以后开无痕窗口，它就会生效

## 要拦截哪些网站，自己改 rules.json

用文本编辑器打开 `rules.json`，照着现有的两条加。每加一条记得：
- `id` 必须是不重复的数字（1、2、3……）
- `urlFilter` 的写法：
  - `||example.com`  → 拦截 example.com 以及它所有子域名（www.、m. 等等）
  - `||example.com/path/` → 只拦截这个路径
  - `||*.example.com` 这种通配也支持
- 改完保存，回到 `chrome://extensions` 页面，点这个扩展卡片上的刷新圆形按钮，规则立刻生效，不用重启浏览器

想加一个网站，就是复制下面这一段，把数字 id 和 urlFilter 改成你的：

```json
{
  "id": 3,
  "priority": 1,
  "action": {
    "type": "redirect",
    "redirect": { "extensionPath": "/index.html" }
  },
  "condition": {
    "urlFilter": "||你要拦的网站.com",
    "resourceTypes": ["main_frame"]
  }
}
```

注意：这是 JSON 文件，最后一条规则后面不要加逗号。

## 关于原理

- 它只在你自己的 Chrome 里生效，别人、别的浏览器都不受影响
- 不需要联网，不需要服务器，HTML 是打包在扩展里的
- 想临时关掉：`chrome://extensions` 里把开关拨到 off 就行
- 想彻底卸载：点「移除」即可

## 小提醒

这是个自我提醒工具，不是什么硬核屏蔽。真想绕开它，开个别的浏览器或者把扩展关了就行——工具的意义是在你手已经点下去的那一秒，让你停一下。
