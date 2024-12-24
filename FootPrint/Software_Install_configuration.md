#### 常备软件

> * 文字处理：office、sublime、Typora、Easydict、Paste、PDF expert、XMind
> * 效率工具：Keyboard Maestro、go2shell（官网下载）、snipaste、rename、PicGo、Easydict、flow、downie
> * 系统工具：App Cleaner、Mos、itsycal、Alfred 5、iTerm、Snipaste、WgetCloud、GitHub Desktop、Geph、istat menus、VS Code、The Unarchiver、
> * 学习工具：Anki、

##### Itsycal安装后隐藏系统日期

> ```bash
> defaults write com.apple.menuextra.clock DateFormat -string "HH:mm"
> killall SystemUIServer
> killall ControlCenter
> ```

**触摸板**

> 1. 禁用双指右边缘左滑调佣通知中心：触摸板-更多手势-通知中心（关闭）
> 2. 启用三指拖移：辅助功能 - 指针控制 - 触控板选项 - 拖移样式 - 三指拖移
> 3. 启用连接鼠标时禁用触摸板：辅助功能 - 指针控制 - 使用鼠标或无线触控板时忽略内置触控板

**鼠标滚轮缩放**

> 安住control，滚轮缩放
>
> ![image-20241111130129467](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20241111130129467.png)

##### 启动台图标数量7 x 11

> ```bash
> defaults write com.apple.dock springboard-rows -int 7;
> defaults write com.apple.dock springboard-columns -int 11;
> defaults write com.apple.dock ResetLaunchPad -bool true;
> killall Dock
> ```

##### Finder顶端显示完整路径

> ```bash
> defaults write com.apple.finder _FXShowPosixPathInTitle -bool YES
> ```

##### VPN开启后Chrome可翻墙，终端不行

> getcloud代理地址：http://127.0.0.1:8234
>
> ![image-20241107172851202](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20241107172851202.png)
>
> ![image-20241222080951372](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20241222080951372.png)
>
> 1. 测试IP：
>
>    `curl cip.cc`
>
> 2. 设临时代理，仅作用于当前终端
>
>    `export http_proxy=http://127.0.0.1:8234;export https_proxy=http://127.0.0.1:8234`
>
> 3. 最终解决方案
>
>    ```bash
>    # 创建 .zshrc 文件
>    echo >> ~/.zshrc
>    
>    open ~/.zshrc
>    
>    # 在文件最后添加下面两句
>    export http_proxy="http://127.0.0.1:8234" export https_proxy="http://127.0.0.1:8234"
>    ```

**禁止Chrome更新**

> 安装后别打开APP，立刻去'/Library/Application Support/Google/GoogleUpdater'，把GoogleUpdater文件夹删除，随意新建个文件改名为GoogleUpdater，挪到改目录，即可

##### 安装brew

> ```bash
> # 境外源
> /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
> 
> # 获取 brew 安装位置
> which brew
> # 输出 /usr/local/bin/brew
> 
> # 创建 .zprofile文件
> echo >> ~/.zprofile
> 
> # 添加到 PATH 环境变量，否则终端无法识别 brew 命令
> # /usr/local/bin/brew 要改成 which brew 输出的位置
> echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
> 
> source ~/.zprofile
> ```

##### 安装iterm2

> 1. 官网下载安装App
>
> 2. 官网下载安装go2shell
>
>    ![image-20241222085630120](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20241222085630120.png)
>
> 3. 设为默认：iTerm2 -> Make ITerm2 Default Term
>
>    ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413110312.png)
>
> 4. 快捷键
>
>    1. 光标按照单词快速移动：iTerm2 -> Settings -> Keys -> Key Bindings
>
>       修改 ⌘← 和 ⌘→ 的映射，双击进入后，选择Action为 “Send Escape Sequence”，Esc+为 ⌘← 对应 b ， ⌘→ 对应 f
>
>       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220412205506.png)
>
>    2. 按照单词快速删除（结合Keyboard Maestro）
>
>       * 修改 ⌘+Delete 的映射，⌘+Delete 代表 control + w
>
> 5. 安装Oh my zsh [参考](https://segmentfault.com/a/1190000041138667?utm_source=sf-similar-article)
>
>    ```bash
>    brew install wget;
>    export REMOTE=https://gitee.com/imirror/ohmyzsh.git;
>    sh -c "$(wget -O- https://cdn.jsdelivr.net/gh/ohmyzsh/ohmyzsh/tools/install.sh)";
>
>    open ~/.zshrc
>
>    # 在.zshrc文件中搜索 source $ZSH/oh-my-zsh.sh，在本句之前加一句
>    ZSH_DISABLE_COMPFIX="true"
>
>    # 禁用oh-my-zsh自动更新：找到 DISABLE_AUTO_UPDATE 一行，将行首的注释'#'去掉
>    DISABLE_AUTO_UPDATE="true"
>
>    source ~/.zshrc
>    ```
>
> 6. 安装PowerFonts字体
>
>    ```bash
>    1. 下载：https://github.com/powerline/fonts
>    2. 解压
>    3. 进入文件夹：cd fonts-master
>    4. 安装：./install.sh
>    ```
>
> 7. 设置字体
>
>    * iTerm2 -> Settings -> Profiles -> Text，在Font区域选中Change Font，然后找到Meslo LG字体，有L、M、S可选
>
>    ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413112345.png)
>
> 8. 配色方案
>
>    iTerm2 -> Settings -> Profiles -> Colors -> Color Presets
>
>    ![image-20241222090429902](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20241222090429902.png)
>
> 9. 设置主题
>
>    ```bash
>    open ~/.zshrc
>    # 搜索'ZSH_THEME'，修改为ZSH_THEME="agnoster"
>    source ~/.zshrc
>    ```
>
> 10. 设置语法高亮
>
>     ```bash
>     brew install zsh-syntax-highlighting
>     输出To activate the syntax highlighting, add the following at the end of your .zshrc:
>       source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
>     
>     open ~/.zshrc
>     
>     最后插入一行：source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
>     
>     source ~/.zshrc
>     ```
>
> 11. 自动提示与命令补全
>
>     ```bash
>     下载 https://github.com/zsh-users/zsh-autosuggestions，解压并改名为 zsh-autosuggestions
>     open ~/.oh-my-zsh/plugins
>     # 将 zsh-autosuggestions 拖入目录 ~/.oh-my-zsh/plugins
>     open ~/.zshrc
>     
>     搜索'plugins'，修改为 plugins=(zsh-autosuggestions)
>     source ~/.zshrc
>     ```
>
> 12. 隐藏名字和主机名
>
>     ```bash
>     open ~/.oh-my-zsh/themes
>     
>     打开agnoster.zsh-theme文件，找到prompt_context()函数，替换为
>     prompt_context() {
>       if [[ "$USERNAME" != "$DEFAULT_USER" || -n "$SSH_CLIENT" ]]; then
>         prompt_segment black default "Sai"
>       fi
>     }
>     
>     source ~/.oh-my-zsh/themes/agnoster.zsh-theme
>     ```

##### 安装mpv

> ```bash
> brew install mpv --cask
> 
> # 打开 mpv 一次
> # 创建 input.conf 文件
> echo >> ~/.config/mpv/input.conf
> 
> # 打开 input.conf 文件
> nano ~/.config/mpv/input.conf
> 
> # 复制到该文件
> AXIS_UP add volume -2
> AXIS_DOWN add volume 2
> AXIS_LEFT seek -2 exact
> AXIS_RIGHT seek 2 exact
> LEFT seek -2 exact
> RIGHT seek 2 exact
> UP add volume 2
> DOWN add volume -2
> 
> Ctrl + O 保存，Enter 键确认保存，Ctrl + X 退出 nano 编辑器
> ```
>
> 设置mpv多开
>
> 1. 打开Script Editor
>
>    ```bash
>    on run
>        do shell script "open -n /Applications/mpv.app"
>        tell application "mpv" to activate
>    end run
>
>    on open theFiles
>        repeat with theFile in theFiles
>            -- 对路径进行适当的转义
>            set filePath to POSIX path of theFile
>            set escapedPath to quoted form of filePath
>            do shell script "open -na /Applications/mpv.app --args " & escapedPath
>        end repeat
>        tell application "mpv" to activate
>    end open
>
>    ```
>
> 2. 保存
>
>    1. 名称：mpv多开器
>    2. 文件格式：应用程序
>
> 3. 将mpv multiple拖入应用程序，修改视频文件的默认打开方式

##### 安装yt-dlp

> `brew install yt-dlp`
>
> > 直接下载往往被限制分辨率，增加参数可模拟浏览器
>
> * 查看视频所有类型
>
>   `yt-dlp -F --cookies-from-browser chrome URL`
>
> * 直接下载最高品质视频
>
>   `yt-dlp --cookies-from-browser chrome URL`
>
> * 下载指定ID的视频
>
>   `yt-dlp -f ID --cookies-from-browser chrome URL`
>
> * 下载列表
>
>   `yt-dlp --yes-playlist --cookies-from-browser chrome URL`
>
> * 音频、视频分别下载
>
>   > 视频不包含音频
>   >
>   > `yt-dlp -f 242 --cookies-from-browser chrome URL`
>   >
>   > 音频不包含视频
>   >
>   > `yt-dlp -f 230 --cookies-from-browser chrome URL`
>   >
>   > 视频 + 音频
>   >
>   > * 默认mkv：`yt-dlp -f 242+ 230 --cookies-from-browser chrome URL`
>   > * 转mp4：`yt-dlp -f 230 --cookies-from-browser chrome --remux-video mp4 URL`
>   >
>   > ![img](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202308271236418.png)

##### Alfred配置

> 1. 将Spotlight的快捷键分给Alfred
>
>    ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413142827.png)
>
> 2. 搜索排除某个文件夹
>
>    1. 添加要排除的文件夹
>
>    2. 调出alfred，输入reload回车，清空alfred缓存
>
>       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413143239.png)
>
>    3. 自定义文件操作
>
>       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413143409.png)
>
>    **Quick Search**：最常用，`Space + 关键字`快速启用打开文件，功能类似于使用 `Open + 关键字`
>
>    **Inside Files**：最常用，`in + 关键字`查找包含查询字的文件

##### 安装easydict

> brew install --cask easydict

##### 安装picgo

> brew install --cask picgo

##### sublime配置

> 1. 安装
>
>    > ⌘+⇧+P，输入install package，回车自动安装
>
> 2. 解决乱码问题
>
>    > ⌘+⇧+P，输入install package，弹出框，输入ConvertToUTF8,回车自动安装
>
> 3. 中文汉化包
>
>    > ⌘+⇧+P，输入install package，弹出框，输入ChineseLocalizations，回车自动安装
>
> 4. Ayu主题
>
>    > ⌘+⇧+P，输入install package，弹出框，输入ayu，回车自动安装
>    >
>    > 选择主题：ayu: Activate theme，选择，回车

##### Karabiner

> 问题：连外接键盘时，键位不对应
>
> 1. 修改单个键位
>
>    > ![image-20240827025736308](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20240827025736308.png)
>    >
>    > 
>
> 2. 修改组合快捷键[参考](https://blog.csdn.net/qq_26012495/article/details/88539120)
>
> 3. 新建MyShortcut.json，放入`~/.config/karabiner/assets/complex_modifications`
>
>    > ```css
>    > {
>    > "title": "JiangSai",
>    > "rules": [
>    >  {
>    >    "description": "锁屏",
>    >    "manipulators": [
>    >      {
>    >        "type": "basic",
>    >        "from": {
>    >          "key_code": "l",
>    >          "modifiers": {
>    >            "mandatory": ["command"]
>    >          }
>    >        },
>    >        "to": [
>    >          {
>    >            "key_code": "q",
>    >            "modifiers": [
>    >              "command",
>    >              "control"
>    >              ]
>    >          }
>    >        ]
>    >      }
>    >    ]
>    >  },
>    >  {
>    >    "description": "录音-新建",
>    >    "manipulators": [
>    >      {
>    >        "type": "basic",
>    >        "from": {
>    >          "key_code": "1",
>    >          "modifiers": {
>    >            "mandatory": ["option"]
>    >          }
>    >        },
>    >        "to": [
>    >          {
>    >            "key_code": "r",
>    >            "modifiers": [
>    >              "shift",
>    >              "command"
>    >              ]
>    >          }
>    >        ]
>    >      }
>    >    ]
>    >  }
>    > ]
>    > }
>    > ```
>
> 4. preference - complex modification - add rule - 第一行Anki_cloze内的命令"Change command+option+shift+c key to command+3"点击"Enable"
>
> 5. grave_accent_and_tilde即键盘esc下方的`

##### Logitech G HUB

> 1. 关闭板载内存模式
>
> 2. DPI
>
>    > 灵敏度 - 默认设置 - 2400
>
> 3. 侧键快捷键
>
>    > 分配 -宏 - 新建宏 - 不重复 - 立即开始 - 记录按键 - 停止录制
>
>    1. 窗口管理 宏：control ⌃ + ArrowUp ↑
>    2. 全屏左滑宏：control ⌃ + ArrowLift ←
>    3. 全屏右滑宏：control ⌃ + ArrowRight →
>
> 4. 开启板载内存模式 - 点击 放入1 默认 - 选择桌面 默认 - 等待保存完成
