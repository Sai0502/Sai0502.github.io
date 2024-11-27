### Docsify 搭建

1. **环境搭建**

   > 详细参照[帮助文档](https://docsify.js.org/#/quickstart)，案例参照 [Node.js技术栈](https://github.com/Q-Angelo/Nodejs-Roadmap) 

2. **简易教程**

   > 若已有Docsify，仅需执行第1、2、5，其中第5需要切换到 `index.html` 所在目录，即 `GitHub/jiangsai0502.github.io` 目录

   1. 安装node.js

      ```js
      brew install node
      node --version
      ```

   2. 安装Docsify

      ```js
      npm i docsify-cli -g
      // 若提示：npm ERR! code EACCES，则使用超管执行即可
      sudo npm install -g docsify-cli
      ```

   3. 创建Docsify目录   

      ```js
      mkdir ~/Documents/MyDocsify && cd ~/Documents/MyDocsify
      // 若提示：npm ERR! code EACCES，则使用超管执行即可
      ```

   4. 初始化项目

      ```js
      docsify init
      // 初始化时自选主题：Docsify 有4种主题可选，buble，dark，pure，vue
      docsify init --theme dark
      ```

   5. 启动本地服务

      ```js
      docsify serve
      // 修改文件保存后，本地服务启动的网页会自动实时更新
      ```

   6. 页面和URL路径说明

      ```js
      ./
      ├── README.md
      ├── guide.md
      └── zh-cn/
            ├── README.md
            ├── guide.md
      ```

      则对应的访问页面将是

      ```js
      ./README.md        => http://domain.com
      ./guide.md         => http://domain.com/guide
      ./zh-cn/README.md  => http://domain.com/zh-cn/
      ./zh-cn/guide.md   => http://domain.com/zh-cn/guide
      ```

3. **系统目录结构**

   一个基本的 docsify 目录结构如下:

   ```js
   ├── MyDocsify/
       ├── index.html
       ├── .nojekyll
       ├── _sidebar.md
       ├── _coverpage.md
       ├── imgs/
       ├── plugins/
       ├── Sai_PM/
             ├── README.md
       └── Sai_FootPrint/
             ├── README.md
   ```

   | 文件                      | 描述                                                         |
   | ------------------------- | ------------------------------------------------------------ |
   | `index.html`              | 初始化时自动生成，主页html配置都在这里，整个网站的核心文件   |
   | `.nojekyll`               | 初始化时自动生成，阻止 GitHub Pages 会忽略掉下划线'_'开头的文件 |
   | `_sidebar.md`             | 左侧侧边栏                                                   |
   | `_coverpage.md`           | 封面编写                                                     |
   | `imgs/`                   | 用户自建的图片目录                                           |
   | `plugins/`                | 用户自建的插件目录                                           |
   | `Sai_PM/`                 | 用户自建的目录                                               |
   | `Sai_PM/README.md`        | Sai_PM 目录的首页                                            |
   | `Sai_FootPrint/`          | 用户自建的目录                                               |
   | `Sai_FootPrint/README.md` | Sai_FootPrint 目录的首页                                     |

   > 注：如果网站要部署到GitHub Pages，一定要注意这个 .nojekyll 文件，很重要！！！

4. **侧边栏配置**

   1. 加载侧边栏

      > 在根目录的 `index.html` 文件中的 `window.$docsify` 添加 `loadSidebar: true,`  具体配置见下方 "插件配置"

      在 docs 根目录创建 `_sidebar.md` ，内容如下

      ```js
      * 一级目录-1
          * [二级目录-1](Sai_FootPrint/)
          * [二级目录-2](Sai_FootPrint/test.md)
      * 一级目录-2
      ```

      > 此时文档目录是
      >
      > > ```js
      > > ├── MyDocsify/
      > >      ├── index.html
      > >      ├── README.md
      > >      ├── .nojekyll
      > >   ├── _sidebar.md
      > >      └── Sai_FootPrint/
      > >              ├── README.md       二级目录-1 的页面
      > >              ├── test.md         二级目录-2 的页面
      > > ```

   2. 侧边栏显示文档目录：即将文档的 `一级标题`，`二级标题`，`三级标题` …… 显示到侧边栏

      > 在根目录的 `index.html` 文件中的 `window.$docsify` 添加 `subMaxLevel: 3,` （侧边栏可显示1 - 6 级标题，此处设为 3 则只会显示到 3 级标题）具体配置见下方 "插件配置"

      在 DocsifyTutorial 目录创建 `README.md` ，内容如下

      > ```js
      > # 第一个一级标题，不会显示在侧边栏
      > 
      > # 一级标题-a
      > ## 二级标题-a 
      > ### 三级标题-a
      > #### 四级标题-a
      > 
      > # 一级标题-b
      > ## 二级标题-b
      > ### 三级标题-b
      > #### 四级标题-b
      > ```

5. **导航栏配置**

   1. 加载导航栏

      > 在根目录的 `index.html` 文件中的 `window.$docsify` 添加 `loadNavbar: true,` 具体配置见下方 "插件配置"

   2. 自定义导航栏

      > 在根目录的 `index.html` 文件中的 `<body> </body>` 内的添加定义导航栏 `<nav> </nav>` ，要注意链接要以 `#/` 开头
      >
      > ```python
      > <body>
      > <nav>
      > <a href="#/Sai_FootPrint/">中文</a>
      > <a href="#/Sai_PM/">产品</a>
      > </nav>
      > </body>
      > ```

      > 1. 点击 `中文` 则访问 `根目录` 下的 `README.md` ，目录遵循 `根目录` 下的 `_sidebar.md` 
      > 2. 点击 `产品` 则访问 `Sai_PM` 目录下的 `README.md` ，目录遵循 `Sai_PM` 下的 `_sidebar.md` 

6. **设置页面内容宽度**

   `plugins` 文件夹的 `vue.css` 文件

   > max-width:1100px 宽度为1100像素（默认为800）

   ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202307281906128.png)

7. **设置封面**

   1. 加载封面

      > 在根目录的 `index.html` 文件中的 `window.$docsify` 添加 `coverpage: true,`  具体配置见下方 "插件配置"

   2. 定义封面

      在 docs 根目录创建 `_coverpage.md` ，内容如下

      ```bash
      ![logo](_media/icon.svg)
      # Sai 的小站
      ### 收录些学习过的碎片知识
      > Stay Hungry. Stay Foolish. 
      
      * 过去的点点滴滴就像散落珍珠，等待着将来某天，某个契机，串成了一串项链
      
      [GitHub](https://github.com/jiangsai0502)
      [Get Started](#quick-start)
      [Get Started](README.md)
      ```

   3. 设置首页只显示封面（默认是同时显示，封面在上，首页在下）

      > 在根目录的 `index.html` 文件中的 `window.$docsify` 添加 `onlyCover: true,`  具体配置见下方 "插件配置"

   4. 增加网页标签上的图标

      > 在\<head>……\</head>直接增加 \<link rel="shortcut icon" href="img/s.svg" />
      >
      > img/s.svg 就是标签图标，可以是svg和icon格式

8. **插件配置**

   1. 参见 [插件列表](https://docsify.js.org/#/zh-cn/plugins)   ,   [插件仓库](https://github.com/PrismJS/prism/tree/gh-pages/components)

   2. 在线使用插件

      如增加python代码高亮插件

      1. 去[插件仓库](https://github.com/PrismJS/prism/tree/gh-pages/components)找到插件，即`prism-python.js`

      2. 拼接成使用路径

         `<script src="//unpkg.com/prismjs/components/prism-python.js"></script>`

         ```html
           <!-- python 代码高亮 -->
           <script src="//unpkg.com/prismjs/components/prism-python.js"></script>
         </body>
         </html>
         ```

   3. 离线使用插件

      1. 下载插件`prism-python.js`插件（方法如下）

      2. 放入plugins 目录

         ```html
           <!-- python 代码高亮 -->
           <script src="plugins/prism-python.js"></script>
         </body>
         </html>
         ```

      > 1. `<script src="//unpkg.com/prismjs/components/prism-python.js"></script>`
      >
      > 2. `<script src="plugins/prism-python.js"></script>`
      >
      > * 1 是在线插件和 2 是离线插件，功能完全相同

   4. 补充

      > 由于 Docsify 的 CSS 样式文件和插件文件默认是在线的，都放在了 unpkg.com 上面，一旦离线 Docsify 是无法使用的

      1. 解决方案：把在线文件都下载到本地 Docsify项目根目录下的 plugins 目录即可

      2. 下载方式：如 \<head> ... \</head> 中的 CSS 样式是在线的

         \<link rel="stylesheet" href="//unpkg.com/docsify/lib/themes/vue.css"> 

         1. 我们将href的值 `unpkg.com/docsify/lib/themes/vue.css` 粘入浏览器
         2. 右键 “存储为”
         3. 目录选根目录下的 plugins 目录
         4. 名称用默认名即可

      3. vue.css 插件的路径： jiangsai0502.github.io/plugins/vue.css

9. 网站跳转

   > 从当前位置跳转到另一个位置；要跳转的位置必须是**标题**，哪怕是h6标题也行

   1. 页面内跳转

      ```js
      // #后不能有空格，「目标位置」文字之间也不能有空格
      [跳转](#目标位置)
      ###### 目标位置

   2. 跨页面跳转

      文档 `a.md`

      ```js
      [跳转](Warehouse/b.md#目标位置)
      ```

      文档 `b.md`

      ```js
      ###### 目标位置


---------

### Blog 部署到Github Pages

1. **创建Blog项目**
   
   ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20200127135755.png)
   
   ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20200127191727.png)
   
   > 创建名为  `jiangsai0502.github.io`  的仓库，只能选择  `master`  分支发布，这就意味着 Blog 文件只能放在仓库的根目录下
   
   > ```js
   > ├── jiangsai0502.github.io/
   >             ├── index.html
   >             ├── README.md
   >             ├── .nojekyll
   >             ├── _sidebar.md
   >             ├── _coverpage.md
   >             ├── EnglishVersion/
   >             ├── imgs/
   >             └── DocsifyTutorial/
   > ```

2. 按照上面的目录将所有上传至Github即可

### Notion Blog部署到Gitee

1. [创建Blog项目](https://blog.csdn.net/qq_36667170/article/details/79318578)
   
   ![](https://gitee.com/jiangsai0502/PicBedRepo/raw/master/img/20200606163045.png)
   
   > Index.html
   > 
   > ```html
   > <!DOCTYPE html>
   > <html>
   >    <head>
   >       <title>HappyAddOne</title>
   >       <meta http-equiv = "refresh" content = "0; url = https://www.notion.so/Sai-1539d75c1a234f609f905f6b19099347" />
   >    </head>
   >    <body>
   >    </body>
   > </html>
   > ```
   > 
   > > 其中`https://www.notion.so/Sai-1539d75c1a234f609f905f6b19099347`是notion的share地址

2. 更新index.html文件后要手动更新部署
   
   > 服务 -> Gitee Pages -> 更新
