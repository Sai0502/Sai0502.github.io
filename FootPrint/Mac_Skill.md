1. 将任务转移到后台运行

    > 场景描述：运行 `docsify serve` ，前台一直运行这个命令，终端被占据

    > 解决方案：`ctrl + z` 暂停进程，`bg` 把它丢到后台去运行

1. Terminal中断、还原、杀死Python程序

    > * Control + z：暂停进程，并将至放入后台
    >
    >     ```
    >     [1]  + 74136 suspended  /Users/jiangsai/anaconda3/envs/py3/bin/python 
    >     ```
    >
    > * Control + c：杀死进程，并将至放入后台
    >
    >     ```bash
    >     KeyboardInterrupt
    >     Future exception was never retrieved
    >     future: <Future finished exception=Error('Connection closed')>
    >     playwright._impl._api_types.Error: Connection closed
    >     ```
    >
    > * `jobs -l` ：显示所有后台任务的 `Job号job_num`  和 `进程号pid_num` 
    >
    >     ```bash
    >     终端显示格式：[Job号]   进程号   Job状态   Job的启动命令
    >     [1]  - 64981 running    ydoc serve
    >     [2]  + 67089 suspended (signal)  docsify serve
    >     ```
    >
    >     ```
    >     [1]  - suspended  /Users/jiangsai/anaconda3/envs/py3/bin/python 
    >     [2]  + suspended  /Users/jiangsai/anaconda3/envs/py3/bin/python 
    >     ```
    >
    > * `fg %N`：使进程[N]在前台进行
    >
    >     ```bash
    >     [1]  + 74845 continued  /Users/jiangsai/anaconda3/envs/py3/bin/python 
    >     ```
    >
    > * `kill %N`：杀掉后台暂停的进程[N]（最前面的数字）
    >
    >     ```bash
    >     [1]  + 73282 terminated  /Users/jiangsai/anaconda3/envs/py3/bin/python  
    >     ```
    >

1. 获取IP

    > 1. 局域网IP：`ifconfig en0 | grep 'inet' | grep -vE 'inet6'`
    >
    >    ![image-20240909222434731](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20240909222434731.png)
    >
    > 2. 外网IP：`curl 'http://httpbin.org/get' -s | grep 'origin'`

1. 简单HTTP服务器

    > 1. 进入共享目录
    >
    > 2. 后台启动HTTP服务：`python -m http.server 8000 &`
    >
    > 3. 获取局域网IP：`ifconfig en0 | grep 'inet' | grep -vE 'inet6'`
    >
    >    ![image-20240909222434731](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20240909222434731.png)
    >
    > 4. Ipad浏览器访问：`http://192.168.1.5:8000`
    >
    >    ![image-20240909222654404](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20240909222654404.png)
    >
    > 5. 局域网共享Axure原型
    >
    >    1. Axure生成html文件到：/Users/sai/Documents/Axure
    >
    >       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20210701144312.png)
    >
    >    2. 在html文件所在目录启动web服务
    >
    >    3. 访问：http://192.168.0.166:8000/m站.html

1. nplayer不显示视频信息直接播放

    > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202309201516405.png)

1. Mac txt 乱码问题

    > 1. cd [文件所在目录]
    >
    > 2. iconv -c -f GB2312 -t UTF-8 [你要看的文件] >> [新文件的名称]
    >
    >    ```bash
    >    iconv -c -f GB2312 -t UTF-8 凡人修仙转.txt >> 凡人修仙转2.txt
    >    //GB2312是常用中文编码，其他还有gbk等，UTF-8是mac能够识别的编码
    >    ```

1. 自定义PPT工具栏

    > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202309201520425.png)

1. MacBook 突然没有声音

    > `sudo killall coreaudiod`

1. FinePrint 双面打印

    > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20210619100110.png)
    >
    > 打印机：Microsoft Print to PDF
    >
    > 订口：8mm

1. PDF里的图片文字不清晰

    > 1. Mac预览app打开pdf
    >
    > 2. 菜单中选择文件→导出，Quartz滤镜选取“亮度减少”选项
    >
    >    使用一次后，对比度会明显增加。如果还不清楚，可连续操作。
    >
    >    ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20210703235411.png)

1. Photoshop任意角度旋转图片

      > | 标尺工具                                                     | 图像--图像旋转--任意角度                                     |
      > | ------------------------------------------------------------ | ------------------------------------------------------------ |
      > | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20210812184958.png) | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20210812185049.png) |

1. 快捷指令写日记

      > 1. 手动创建指令，用于调试
      >
      >    ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202309181410996.png)
      >
      > 2. 自动
      >
      >    1. 早晨10:10新建一条日记，用于记ToDo
      >
      >       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202309181908378.png)
      >
      >    2. 晚上22:10打开当日日记，用于记总结
      >
      >       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202309201506823.png)
      >
      >    ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202309201505769.png)

1. 自制番茄钟

      > 每隔30分钟，暂停chrome，mpv的所有播放，并锁屏

      ```python
      import os
      import time
      import tempfile
      import socket
      import json
      from tqdm import tqdm
      
      
      def lock_screen():
          # 使用 AppleScript 锁屏命令
          os.system(
              'osascript -e "tell application \\"System Events\\" to keystroke \\"q\\" using {control down, command down}"'
          )
      
      
      def pause_browser_media():
          # 使用临时文件存储AppleScript脚本
          pause_chrome_script = """
          tell application "Google Chrome"
              activate
              set foundMedia to false
              repeat with w in windows
                  repeat with t in tabs of w
                      try
                          -- 执行 JavaScript 查找和暂停所有媒体元素
                          set mediaCount to (execute t javascript "document.querySelectorAll('video, audio').length;")
                          if mediaCount > 0 then
                              execute t javascript "document.querySelectorAll('video, audio').forEach(media => media.pause());"
                              set foundMedia to true
                          end if
                      on error errMsg
                              -- 捕获错误，但不做任何处理，防止弹窗
                              -- display dialog "Error in tab: " & errMsg
                      end try
                      delay 0.5 -- 添加延迟来防止浏览器卡死
                  end repeat
              end repeat
          end tell
          """
      
          # 将AppleScript代码写入临时文件
          with tempfile.NamedTemporaryFile("w", delete=False, suffix=".applescript") as script_file:
              script_file.write(pause_chrome_script)
              script_file_path = script_file.name
      
          # 执行临时AppleScript文件
          os.system(f"osascript {script_file_path}")
      
          # 删除临时文件
          os.remove(script_file_path)
      
      
      def pause_mpv():
          # 在~/.config/mpv/mpv.conf 增加一句：input-ipc-server=/tmp/mpvsocket
          # 发送暂停命令到 mpv 的 IPC socket
          try:
              mpv_socket = "/tmp/mpvsocket"  # 确保使用正确的 socket 文件路径
              command = json.dumps({"command": ["set_property", "pause", True]})
      
              # 连接到 mpv 的 socket 并发送命令
              with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client_socket:
                  client_socket.connect(mpv_socket)
                  client_socket.sendall(command.encode() + b"\n")
          except Exception as e:
              print(f"Error pausing mpv: {e}")
      
      
      if __name__ == "__main__":
          total_time = 30 * 60  # 30分钟
          interval = 1  # 每秒更新进度条
          
          while True:
              for _ in tqdm(range(0, total_time, interval), desc="工作中", unit="秒"):
                  time.sleep(interval)
              pause_browser_media()  # 暂停浏览器中的媒体播放
              pause_mpv()  # 暂停 mpv 播放
              lock_screen()  # 锁屏
      ```

##### 文献阅读：沙拉查词 + Alfred

> 方法1：最简易 直接调用沙拉查词的PDF 阅读器
>
> ![image-20260411220925840](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20260411220925840.png)
>
> 方法2：沙拉查词 + Alfred [参考](https://zhuanlan.zhihu.com/p/113809716)
>
> 1. 安装Chrome插件：沙拉查词
>
> 2. 配置浏览器外划词翻译
>
>    > 浏览器外配置好后，其调用沙拉查词的方式同样适用于浏览器内，因此一劳永逸
>
>    1. 在Chrome内为沙拉查词设置**全局快捷键**
>
>       > 地址栏：chrome://extensions/shortcuts
>
>       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413160100.png)
>
>    2. 开启沙拉查词的Chrome权限
>
>       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413160125.png)
>
>    3. 配置Alfred
>
>       1. [下载Alfred workflow脚本](https://link.zhihu.com/?target=https%3A//github.com/crimx/ext-saladict/files/3711425/saladict.alfredworkflow.zip)
>
>       2. 双击，import脚本
>
>       3. 设置hotkey：`control + ~`
>
>       4. 结合BetterTouchTool修改触发条件：在PDF expert中鼠标移到底边触发 `control + ~`
>
>          ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413160145.png)
>
>       5. 沙拉词典焦点
>
>          1. 方法1：设置
>
>             ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413160217.png)
>
>          2. 方法2：修改Run NSAppleScript脚本
>
>             ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413160246.png)
>
>             ```bash
>             on alfred_script(q)
>               tell application "System Events"
>                 # 快捷键打开沙拉词典
>                 key code 37 using {control down, command down}
>                 delay 0.1
>                 # 焦点从沙拉词典移回源文件
>             key code 48 using {command down}
>               end tell
>             end alfred_script
>             ```
>
>    4. 积累生词
>
>       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413155850.png)
>
>    5. Saladict 生词本导出生词
>       ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20220413155956.png)

##### Mac 修改文件创建时间

> ```bash
> 修改时间改为当天 touch -m 文件名
> 访问时间改为当天 touch -a 文件名
> 同时把访问时间 + 修改时间改为当天 touch -am 文件名
> ```

##### PDF增加大纲书签

> ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202309201537091.png)

##### Word打印英文字幕给时间戳加底色

> 1. 新建样式
>    1. 随便点中一个时间戳所在的“行”（不用全选）
>    2. 开始 → （最右侧）样式窗格 → 新建样式
>       1. 名称：时间戳
>       2. 样式类型：段落
>       3. （左下角）【格式】→【边框……】→【底纹】
>          1. 填充：黄色
> 2. 应用样式
>    1.  Control + H
>    2. 查找内容：-->，点击【查找】（先确定能找到目标）
>    3. 高级查找和替换→【替换】
>       1. 替换：【格式】→【样式】→选刚才的 “时间戳”
>       2. 全部替换

#### 安装 Ollama + OpenCode

```bash
# 安装 Ollama，「应用程序」会增加一个小羊图标，默认开机自动后台启动
curl -fsSL https://ollama.com/install.sh | sh
# 确认版本
ollama --version

# 安装 OpenCode
curl -fsSL https://opencode.ai/install | bash
# 重载环境变量
source ~/.zshrc
# 确认版本
opencode --version

# 进入 OpenCode 并连接官方内置的免费云端模型 Big Pickle（必须联网）
opencode
# 切换模型，搜索 DeepSeek V4.1 Flash Free 免费模型
/models
# 退出 OpenCode 界面
/exit
```

#### 连接 DeepSeek 云端模型

1. [购买 token](https://platform.deepseek.com/)

2. 创建 API key

   * 左边菜单「API Keys」->「创建新密钥」，随便起个名 “OpenCode 用”，确认
   * `sk-`开头的字符串即 API Key（Key 只完整显示这一次）

3. OpenCode 配置 DeepSeek 的 API key

   ```bash
   # 进入 OpenCode
   opencode
   
   # 查看服务商列表，在列表里找到 DeepSeek，点进去
   /connect
   
   # 粘贴 API Key，回车确认
   
   # 展示下列 3 个 DeepSeek 模型列表，选第二个
   DeepSeek V4.1 Flash Free OpenCode    # 官方送的免费额度
   DeepSeek V4.1 Flash 1017 DeepSeek    # 自己 DeepSeek 账户余额的模型
   DeepSeek V4 Pro DeepSeek    # 高端旗舰模型，贵，慢，但强，Flash 搞不定时可换 Pro
   
   # 展示思考强度档位，选默认 default
   Default    # 速度和思考深度平衡，日常写代码、改脚本完全够用，不浪费钱也不磨叽
   Low    # 几乎不额外思考，速度最快、最省 token，但遇到复杂问题容易想不明白，适合超简单的小任务
   high/max    # # 高端旗舰模型，贵，慢，但强，Flash 搞不定时可换 Pro，新手一开始没必要用
   ```

#### OpenCode 配置项

1. 打开 “Mac 自然滚动加速”（默认会话无法滚动查看）

   ```bash
   mkdir -p ~/.config/opencode
   nano ~/.config/opencode/tui.json
   
   把下面这段粘进去，保存退出（nano 里 Ctrl+o 回车确认、Ctrl+X 退出）
   {
     "$schema": "https://opencode.ai/tui.json",
     "mouse": true,
     "scroll_speed": 3,
     "scroll_acceleration": { "enabled": true }
   }
   ```

2. 安装插件和 Skills：进入 opencode 界面，让他自己来安装 

   | 插件                         | 功能                                                         |
   | ---------------------------- | ------------------------------------------------------------ |
   | **opencode-dcp**             | 后台自动把过期的终端输出、重复的日志从上下文里丢掉，省 token、防会话越跑越长。装上不用管，静默生效。 |
   | **opencode-websearch-cited** | 让 Agent 能联网查资料，并且给出的每条结论都带来源链接。      |

   | Skills            | 功能                                                         |
   | ----------------- | ------------------------------------------------------------ |
   | **Grill Me**      | 动手改代码**之前**，反复追问方案：删这个功能会影响什么、依赖要不要一起去、怎么验证 —— 逼你把需求想清楚再开工。 |
   | **Handoff**       | 把当前会话已聊清楚的需求、改到哪一步、还剩什么，压缩成一份 Markdown 存档；新开会话读它就能接着干。OpenChamber 用不上。 |
   | **Agent Desktop** | 控制桌面 App：不抢鼠标的点击桌面 App                         |
   | **Scrapling**     | 控制网页：网页自动化靠它                                     |
   | **REA**           | Reverse-Engineer-Anything，逆向神器                          |

3. 安装 [OpenChamber 图像界面](https://github.com/openchamber/openchamber)

   1. 添加项目目录：Add Project
   2. 配置模型：DeepSeek V4.1 Flash 1017（之前在 opencode 终端已输入 API Key ，无需再填）

4. 用法

   ```bash
   # 进入 OpenCode 要操作的目录
   cd ~/Desktop/Agent-Learning
   
   # 启动 OpenCode
   opencode
   
   # OpenCode 界面执行 Terminal 命令，以 ! 开头
   !pwd
   !ls -la
   
   # 如果想让 OpenCode 操作另一个目录，需要先退出当前 OpenCode，进入另一个目录，然后再次进入 OpenCode
   # 更优选择，开两个终端，各跑各的
   
   # 导出全文
   /export
   
   # 继续上次会话
   opencode --continue
   ```

5. 第 3 方中转站用法

   >  太复杂了，让豆包桌面版托管来做吧
   
   > 1. 修改 ~/.config/opencode/opencode.jsonc
   >
   >    ```bash
   >      "provider": {              ← ① 记住这一行
   >        "openrouter": {          ← ② 和这一行
   >          "options": {
   >            "websearch_cited": {
   >              "model": "x-ai/grok-4.1-fast"
   >            }
   >          }
   >        }
   >      },
   >    ```
   >
   >    改成
   >
   >    ```bash
   >      "provider": {              ← ① 记住这一行
   >      
   >          "deepseek-wife": {
   >          "npm": "@ai-sdk/openai-compatible",
   >          "name": "卡扣 标准版2折 (V4.1 Flash)",
   >          "options": {
   >            "baseURL": "[https://api.kakouai.com/v1](https://api.kakouai.com/v1)",
   >            "apiKey": "{env:DEEPSEEK_WIFE_KEY}"
   >          },
   >          "models": {
   >            "deepseek-v4.1-flash": { "name": "DeepSeek V4.1 Flash 1017" },
   >            "glm-5.3-flash": { "name": "GLM 5.3 Flash" }
   >          }
   >        },
   >      
   >        "openrouter": {          ← ② 和这一行
   >          "options": {
   >            "websearch_cited": {
   >              "model": "x-ai/grok-4.1-fast"
   >            }
   >          }
   >        }
   >      },
   >    ```
   >
   >    * 不要动 `"default_agent"`、`"permission"`、`"plugin"`、`"mcp"` 这些原有内容。
   >
   > 2. **立刻验证一下有没有写坏**
   >
   >    ```bash
   >    opencode models | grep deepseek-wife
   >    ```
   >
   >    - 出现 `deepseek-wife/deepseek-v4.1-flash` 和 `deepseek-wife/glm-5.3-flash` → 写对了，继续下一步；
   >    - 一行都没有 / 报 syntax error → 说明逗号或括号错了，执行这条回到改前：`cp ~/.config/opencode/opencode.jsonc.bak-20261113-184715 ~/.config/opencode/opencode.jsonc`，然后重来。
   >
   > 3. 放 中转站的 key
   >
   >    ```bash
   >    mkdir -p ~/.secrets
   >    printf '%s' 'sk-中转站的key' > ~/.secrets/deepseek-key-b && chmod 600 ~/.secrets/deepseek-key-b
   >    ```
   >
   >    回到 ~/.config/opencode/opencode.jsonc，把
   >
   >    ```bash
   >            "apiKey": "{env:DEEPSEEK_WIFE_KEY}"
   >    ```
   >
   >    改成：
   >
   >    ```bash
   >            "apiKey": "{file:~/.secrets/deepseek-key-b}"
   >    ```
   >
   >    > 这一步为什么推荐写文件而不是环境变量：环境变量只在你终端里启动的 opencode 才读得到，从 Dock / OpenChamber 启动就 401。写文件两种启动方式都能读。
   >
   > 4. 完全退出 opencode，重开，验收
   >
   >    ```
   >    opencode run -m deepseek-wife/deepseek-v4.1-flash "只回复OK"
   >    ```
   >
   >    - 出 `OK` → **全通，收工**。
   >    - 出 `401 / authentication` → key 没读到，重做第 5 步，用这条查长度：`wc -c ~/.secrets/deepseek-key-b`（应接近 67）。
   >    - 出 `model not found / 404` → 模型 ID 不对，跑 `curl -s [https://api.kakouai.com/v1/models](https://api.kakouai.com/v1/models) -H "Authorization: Bearer $(cat ~/.secrets/deepseek-key-b)"` 看它到底返回哪几个 ID。
   >
   

#### OpenCode 破甲（opencode-unrestricted）

1. 确认 OpenCode 是 V1 版本

   ```bash
   opencode --version
   ```

2. 复制 V1 组件（只拷 `v1/` 下的单数目录）

   ```bash
   # 进入 Unrestricted-OpenCode 目录
   cp -R v1/agent v1/command v1/plugin ~/.config/opencode/
   ```

3. 写入 V1 配置到 /Users/sai/.config/opencode/opencode.jsonc，其初始内容如下

   ```bash
   {
     "$schema": "https://opencode.ai/config.json",
     "plugin": [
       "@tarquinen/opencode-dcp@latest",
       "opencode-websearch-cited@1.2.0"
     ],
     "provider": {
       "openrouter": {
         "options": {
           "websearch_cited": {
             "model": "x-ai/grok-4.1-fast"
           }
         }
       }
     },
     "mcp": {
       "rea": {
         "type": "local",
         "command": [
           "npx",
           "-y",
           "rea-agents@6.7.0",
           "mcp"
         ],
         "enabled": true
       }
     }
   }
   ```

   修改后内容

   ```bash
   {
     "$schema": "https://opencode.ai/config.json",
     // 【默认Agent】启动OpenCode时自动选中这个Agent
     "default_agent": "plan",
     // 全局权限策略：allow = 默认允许Agent执行工具/命令（你的场景是逆向、实验室，放开）
     "permission": "allow",
   
     // Agent 定义：Agent是一套独立的身份、权限、描述、配色
     "agent": {
       "plan": {
         "mode": "primary",
         "color": "#3B82F6",
         "permission": "allow",
         "description": "plan agent，规划、拆解、方案分析、前置研讨"
       },
       "unrestricted": {
         "mode": "primary",       // primary = 主Agent，作为主力会话
         "color": "#EF4444",       // 会话界面里这个Agent标识的颜色（红色）
         "permission": "allow",    // 这个Agent单独的权限：允许调用工具、执行命令
         "description": "默认主 agent。安全实验室：逆向/补丁/渗透/取证。工具优先。"
       }
     },
   
     // 插件列表，自动加载这两个npm插件
     "plugin": [
       "@tarquinen/opencode-dcp@latest",   // DCP插件：文档/项目上下文打包，给Agent读整个项目代码
       "opencode-websearch-cited@1.2.0"   // 带引用溯源的联网搜索插件，搜索结果带来源标注
     ],
   
     // 模型提供商配置区（多个不同API渠道，OpenCode在这里加载所有模型来源）
     "provider": {
       // OpenRouter 海外渠道
       "openrouter": {
         "options": {
           // websearch-cited 搜索插件指定使用这个模型来做联网搜索
           "websearch_cited": {
             "model": "x-ai/grok-4.1-fast"
           }
         }
       },
   
       // 卡扣 Kakou 中转渠道（你命名 deepseek-wife）
       "deepseek-wife": {
         "npm": "@ai-sdk/openai-compatible", // 使用通用OpenAI兼容适配器对接
         "name": "Kakou 卡扣2折",           // 在UI里显示给你看的渠道名字
         "options": {
           "baseURL": "https://api.kakouai.com/v1", // 中转接口地址
           "apiKey": "{file:~/.secrets/deepseek-key-b}" // 密钥不从配置明文写，从外部密钥文件读取（安全）
         },
         "models": { // 这个渠道下可用的模型清单
           "deepseek-v4.1-flash": {
             "name": "卡扣·DeepSeek V4.1 Flash", // UI展示名称
             "attachment": true,                 // 支持上传附件
             "modalities": {                     // 支持的输入输出模态
               "input": ["text", "image"],       // 可以发文字、图片（就是你截图识别图片的能力）
               "output": ["text"]
             }
           },
           "glm-5.3-flash": {
             "name": "卡扣·GLM 5.3 Flash"
           }
         }
       }
     },
   
     // MCP服务配置：MCP = 给Agent扩展外部工具的服务
     // 平常不用时 "enabled": true 换成 false 否则比较费资源
     // 这会同时影响 OpenCode 和 OpenChamber，修改后重启哪一个应用到哪一个
     "mcp": {
       "rea": {
         "type": "local",          // 本地启动MCP进程
         "command": [
           "npx",
           "-y",
           "rea-agents@6.7.0",
           "mcp"
         ],
         "enabled": false           // 启用REA逆向MCP工具
       }
     }
   }
   ```

4. 重启 opencode，按 Tab 应能切到 `unrestricted`

   ```bash
   opencode service restart
   opencode debug agents | grep -A2 unrestricted
   # 日志里应有 loading plugin …/plugins/unrestricted-boost.ts，且没有 failed to load plugin
   ```

   > 官方 API 可以正常使用，第三方中转站要看运气，反正卡扣不行

5. 破甲后，就可以无视道德的反编译了

#### 修改配置让中转站的 DeepSeek 模型能识别图片的文字、颜色、布局

> /Users/sai/.config/opencode/opencode.jsonc改成

```bash
{
  "$schema": "https://opencode.ai/config.json",
  // 【默认Agent】启动OpenCode时自动选中这个Agent
  "default_agent": "plan",
  // 全局权限策略：allow = 默认允许Agent执行工具/命令（你的场景是逆向、实验室，放开）
  "permission": "allow",

  // Agent 定义：Agent是一套独立的身份、权限、描述、配色
  "agent": {
    "plan": {
      "mode": "primary",
      "color": "#3B82F6",
      "permission": "allow",
      "description": "plan agent，规划、拆解、方案分析、前置研讨"
    },
    "unrestricted": {
      "mode": "primary",       // primary = 主Agent，作为主力会话
      "color": "#EF4444",       // 会话界面里这个Agent标识的颜色（红色）
      "permission": "allow",    // 这个Agent单独的权限：允许调用工具、执行命令
      "description": "默认主 agent。安全实验室：逆向/补丁/渗透/取证。工具优先。"
    }
  },

  // 插件列表，自动加载这两个npm插件
  "plugin": [
    "@tarquinen/opencode-dcp@latest",   // DCP插件：文档/项目上下文打包，给Agent读整个项目代码
    "opencode-websearch-cited@1.2.0"   // 带引用溯源的联网搜索插件，搜索结果带来源标注
  ],

  // 模型提供商配置区（多个不同API渠道，OpenCode在这里加载所有模型来源）
  "provider": {
    // OpenRouter 海外渠道
    "openrouter": {
      "options": {
        // websearch-cited 搜索插件指定使用这个模型来做联网搜索
        "websearch_cited": {
          "model": "x-ai/grok-4.1-fast"
        }
      }
    },

    // 卡扣 Kakou 中转渠道（你命名 deepseek-wife）
    "deepseek-wife": {
      "npm": "@ai-sdk/openai-compatible", // 使用通用OpenAI兼容适配器对接
      "name": "Kakou 卡扣2折",           // 在UI里显示给你看的渠道名字
      "options": {
        "baseURL": "https://api.kakouai.com/v1", // 中转接口地址
        "apiKey": "{file:~/.secrets/deepseek-key-b}" // 密钥不从配置明文写，从外部密钥文件读取（安全）
      },
      "models": { // 这个渠道下可用的模型清单
        "deepseek-v4.1-flash": {
          "name": "卡扣·DeepSeek V4.1 Flash", // UI展示名称
          "attachment": true,                 // 支持上传附件
          "modalities": {                     // 支持的输入输出模态
            "input": ["text", "image"],       // 可以发文字、图片（就是你截图识别图片的能力）
            "output": ["text"]
          }
        },
        "glm-5.3-flash": {
          "name": "卡扣·GLM 5.3 Flash"
        }
      }
    }
  },

  // MCP服务配置：MCP = 给Agent扩展外部工具的服务
  // 平常不用时 "enabled": true 换成 false 否则比较费资源
  // 这会同时影响 OpenCode 和 OpenChamber，修改后重启哪一个应用到哪一个
  "mcp": {
    "rea": {
      "type": "local",          // 本地启动MCP进程
      "command": [
        "npx",
        "-y",
        "rea-agents@6.7.0",
        "mcp"
      ],
      "enabled": false           // 启用REA逆向MCP工具
    }
  }
}
```

#### Parallels Desktop 的 win11 安装 OpenCode

> 虚拟机的 OpenCode 定位：**隔离沙箱环境**，专门放风险 token、陌生插件，和 Mac 主环境彻底分开

1. 安装 OpenCode

   ```bash
   npm install -g @opencode/cli
   
   opencode --version
   ```

2. 配置 opencode.jsonc

   ```bash
   explorer C:\Users\sai\.config\opencode\
   
   # 创建单独存放中转站 API 的文件 deepseek-key-b
   $dir = "$env:USERPROFILE\.secrets"
   New-Item -ItemType Directory -Force -Path $dir | Out-Null
   $key = "sk-xxxxxxxxxxxxxxxxxxxxxx"    # 这里替换成卡扣的 key 长度必须是 67
   [System.IO.File]::WriteAllText("$dir\deepseek-key-b", $key, (New-Object System.Text.UTF8Encoding($false)))
   
   # 校验一下：输出的 key 长度应该是 67，内容应该原样是那个
   (Get-Item "$dir\deepseek-key-b").Length
   Get-Content "$dir\deepseek-key-b"
   
   # 创建 opencode.jsonc
   # 把 mac 的 /Users/sai/.config/opencode/opencode.jsonc 内容照搬过来，保存时编码选 UTF-8
   notepad "$env:USERPROFILE\.config\opencode\opencode.jsonc"
   ```

3. 安装 REA

   ```bash
   # 安装 REA 最新发布版本
   npx.cmd rea-agents@latest setup --client opencode
   
   # 本次安装的目标
   #    1. 保留现有 OpenCode 和 DeepSeek 配置
   #    2. 新增 REA MCP 服务
   #    3. 安装 REA 配套 Skill
   #    4. 不安装 Ghidra、IDA 等逆向分析工具
   
   # 启动 OpenCode
   opencode
   
   # 验证 MCP 是否连接成功，期待输出：One MCP server is configured — rea — and it's connected.
   opencode mcp list
   
   # 检查 REA 提供了哪些能力
   npx -y rea-agents@6.10.1 capabilities
   ```

4. 备份更新后的  opencode.jsonc

   ```bash
   explorer C:\Users\sai\.config\opencode\
   ```

   > 平时不逆向时要关掉，否则非常费 token
   >
   > "enabled": true           // 启用REA逆向MCP工具      ->     "enabled": false

   ```bash
   {
     "$schema": "https://opencode.ai/config.json",
     // 【默认Agent】启动OpenCode时自动选中这个Agent
     "default_agent": "plan",
     // 全局权限策略：allow = 默认允许Agent执行工具/命令（你的场景是逆向、实验室，放开）
     "permission": "allow",
   
     // Agent 定义：Agent是一套独立的身份、权限、描述、配色
     "agent": {
       "plan": {
         "mode": "primary",
         "color": "#3B82F6",
         "permission": "allow",
         "description": "plan agent，规划、拆解、方案分析、前置研讨"
       },
       "unrestricted": {
         "mode": "primary",       // primary = 主Agent，作为主力会话
         "color": "#EF4444",       // 会话界面里这个Agent标识的颜色（红色）
         "permission": "allow",    // 这个Agent单独的权限：允许调用工具、执行命令
         "description": "默认主 agent。安全实验室：逆向/补丁/渗透/取证。工具优先。"
       }
     },
   
     // 插件列表，自动加载这两个npm插件
     "plugin": [
       "@tarquinen/opencode-dcp@latest",   // DCP插件：文档/项目上下文打包，给Agent读整个项目代码
       "opencode-websearch-cited@1.2.0"   // 带引用溯源的联网搜索插件，搜索结果带来源标注
     ],
   
     // 模型提供商配置区（多个不同API渠道，OpenCode在这里加载所有模型来源）
     "provider": {
       // OpenRouter 海外渠道
       "openrouter": {
         "options": {
           // websearch-cited 搜索插件指定使用这个模型来做联网搜索
           "websearch_cited": {
             "model": "x-ai/grok-4.1-fast"
           }
         }
       },
   
       // 卡扣 Kakou 中转渠道（你命名 deepseek-wife）
       "deepseek-wife": {
         "npm": "@ai-sdk/openai-compatible", // 使用通用OpenAI兼容适配器对接
         "name": "Kakou 卡扣2折",           // 在UI里显示给你看的渠道名字
         "options": {
           "baseURL": "https://api.kakouai.com/v1", // 中转接口地址
           "apiKey": "{file:~/.secrets/deepseek-key-b}" // 密钥不从配置明文写，从外部密钥文件读取（安全）
         },
         "models": { // 这个渠道下可用的模型清单
           "deepseek-v4.1-flash": {
             "name": "卡扣·DeepSeek V4.1 Flash", // UI展示名称
             "attachment": true,                 // 支持上传附件
             "modalities": {                     // 支持的输入输出模态
               "input": ["text", "image"],       // 可以发文字、图片（就是你截图识别图片的能力）
               "output": ["text"]
             }
           },
           "glm-5.3-flash": {
             "name": "卡扣·GLM 5.3 Flash"
           }
         }
       }
     },
   
     // MCP服务配置：MCP = 给Agent扩展外部工具的服务
     // 平常不用时 "enabled": true 换成 false 否则比较费资源
     // 这会同时影响 OpenCode 和 OpenChamber，修改后重启哪一个应用到哪一个
     "mcp": {
       "rea": {
         "type": "local",          // 本地启动MCP进程
         "command": [
           "C:\\Program Files\\nodejs\\node.exe",
           "C:\\Users\\sai\\AppData\\Local\\npm-cache\\_npx\\af752b90495482d7\\node_modules\\rea-agents\\scripts\\rea.mjs",
           "mcp"
           
         ],
         "enabled": true           // 启用REA逆向MCP工具
       }
     }
   }
   ```

5. 破甲

   1. 确认 OpenCode 是 V2 版本

      ```bash
      opencode --version
      ```

   2. 复制 V2 组件（只拷 `v1/` 下的单数目录）

      ```bash
      # 进入 Unrestricted-OpenCode 目录
      Copy-Item -Path agents,commands,plugins -Destination "$env:USERPROFILE\.config\opencode" -Recurse -Force
      ```

   3. 安装插件运行时依赖

      ```bash
      cd "$env:USERPROFILE\.config\opencode"
      npm install @opencode/plugin
      ```

   4. 写入 V2 配置

      ```
      notepad "$env:USERPROFILE\.config\opencode\opencode.jsonc"
      ```

      ```bash
      {
        "$schema": "https://opencode.ai/config.json",
        "default_agent": "unrestricted",
        "permissions": [{ "action": "*", "resource": "*", "effect": "allow" }],
      
        "agents": {
          "plan": {
            "mode": "primary",
            "color": "#3B82F6",
            "description": "plan agent，规划、拆解、方案分析、前置研讨",
            "permissions": [{ "action": "*", "resource": "*", "effect": "allow" }]
          },
          "unrestricted": {
            "mode": "primary",
            "color": "#EF4444",
            "description": "默认主 agent。安全实验室：逆向/补丁/渗透/取证。工具优先。",
            "permissions": [{ "action": "*", "resource": "*", "effect": "allow" }]
          }
        },
      
        "provider": {
          "openrouter": {
            "options": {
              "websearch_cited": {
                "model": "x-ai/grok-4.1-fast"
              }
            }
          },
      
          "deepseek-wife": {
            "npm": "@ai-sdk/openai-compatible",
            "name": "Kakou 卡扣2折",
            "options": {
              "baseURL": "https://api.kakouai.com/v1",
              "apiKey": "{file:~/.secrets/deepseek-key-b}"
            },
            "models": {
              "deepseek-v4.1-flash": {
                "name": "卡扣·DeepSeek V4.1 Flash",
                "attachment": true,
                "modalities": {
                  "input": ["text", "image"],
                  "output": ["text"]
                }
              },
              "glm-5.3-flash": {
                "name": "卡扣·GLM 5.3 Flash"
              }
            }
          }
        },
      
        "mcp": {
          "rea": {
            "type": "local",
            "command": ["cmd", "/c", "npx", "-y", "rea-agents@6.10.1", "mcp"],
            "enabled": true
          }
        }
      }
      ```

   5. 重启并验证

      ```bash
      opencode service restart
      opencode debug agents | grep -A2 unrestricted
      # 日志里应有 loading plugin …/plugins/unrestricted-boost.ts，且没有 failed to load plugin
      ```

      > 官方 API 可以正常使用，第三方中转站要看运气，反正卡扣不行

#### 飞书机器人

1. 飞书规则

   1. 每个手机号各注册一个账号，一个账号可归属不同的组织，每次登录后选择要进入的组织

   2. 组织类型：
      1. 个人版租户：不能调用 Open API（飞书开放平台接口） 收发送消息

      2. 企业团队：能调用 OpenAI 收发送消息

2. 注册飞书

   1. [网页注册](https://www.feishu.cn)：关键一步「选择角色」必须选「企业或组织负责人」

   2. 验证是否已加入「企业团队」：登录 → 左下角进入「管理后台」 → 用户名下方有没有 **「企业编号」**（形如 FQZ163DN5X1）

   3. [开发者后台](https://open.feishu.cn/)

      1. 右上角「开发者后台」 → 「创建企业自建应用」 → 名称「测一测」 

      2. 左侧「凭证与基础信息」 → 复制 App ID、App Secret（Secret 只显示一次，看不到就重置）

      3. 再次验证当前已加入企业团队

         ```bash
         # 用上述复制 App ID、App Secret 替换 cli_xxx、xxx
         curl -s -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
           -H 'Content-Type: application/json' \
           -d '{"app_id":"cli_xxx","app_secret":"xxx"}'
           
         # 输出
         {"code":0,"expire":7200,"msg":"ok","tenant_access_token":"t-g104bxxxxxxxxxxxxxxxxxxxxxUXT6CV"}%
         ```

         ✅ **完成标志**：返回 {"code":0,"tenant_access_token":"t-…"}

         ❌ **不通过**：返回 {"code":21001,…,"msg":"Access denied due to platform policy"} → **立刻停手**，说明当前组织是个人版性质。

   4.  安装机器人能力（在开发者后台）

      1. 左侧「添加应用能力」 → 添加「机器人」 → 左侧「添加应用能力」出现机器人

      2. 左侧「权限管理」 → 开通权限 → 搜索并逐个开通

         | 权限                                  | 作用                                  |
         | ------------------------------------- | ------------------------------------- |
         | im:message                            | 读用户发给机器人的消息「允许 / 拒绝」 |
         | im:message:send_as_bot                | 以机器人身份发消息                    |
         | im:message:send_multi_depts           | 多部门范围发送                        |
         | im:chat:readonly                      | 读群 / 会话信息                       |
         | contact:user.id:readonly              | 手机号 ↔ open_id 转换                 |
         | im:message.group_msg:include_bot_read | 获取群组中用户和机器人发送的消息      |

      3. 左侧「事件与回调」 → 订阅方式 → 使用「长连接」接收事件 → 保存 → 添加事件 → 搜索 im.message.receive_v1→ 添加

      4. 左侧「版本管理与发布」 → 创建版本 → 保存 → 确认发布/申请发布

3. Mac 版飞书配置

   1. 配置双向互动机器人

      1. 手机 App 登录的必须是飞书，不能是 Lark（Lark 是海外版，飞书账号登不进去）

      2. 电脑版搜索「测一测」（前面创建的企业自建应用），给它发个 Hello

      3. 拿 chat_id 或 open_id

         ```bash
         APP_ID="cli_xxx"
         APP_SECRET="xxxxxx"
         MOBILE="+86你的手机号"
         
         # 1) 取 token（有效期 2 小时，过期重跑即可）
         TOKEN=$(curl -s -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
           -H 'Content-Type: application/json' \
           -d "{\"app_id\":\"$APP_ID\",\"app_secret\":\"$APP_SECRET\"}" \
           | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["tenant_access_token"])')
         echo "TOKEN=$TOKEN"
         
         # 2) 手机号换 open_id
         OPEN_ID=$(curl -s -X POST 'https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id' \
           -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
           -d "{\"mobiles\":[\"$MOBILE\"]}" \
           | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["user_list"][0]["user_id"])')
         echo "OPEN_ID=$OPEN_ID"
         
         # 3) 用 open_id 发测试消息（响应里顺带返回 chat_id）
         curl -s -X POST 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id' \
           -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
           -d "{\"receive_id\":\"$OPEN_ID\",\"msg_type\":\"text\",\"content\":\"{\\\"text\\\":\\\"测试\\\"}\"}" \
           | python3 -c 'import sys,json;d=json.load(sys.stdin);print("code:",d.get("code"),d.get("msg"));print("CHAT_ID=",d.get("data",{}).get("chat_id"))'
         ```

         期望输出 4 行：

         ```bash
         TOKEN=t-...
         OPEN_ID=ou_...
         code: 0 success
         CHAT_ID= oc_...
         ```

         - 第 2 步输出空 → 说明该手机号不是本组织成员，或 contact:user.id:readonly 没开通。

         - 第 3 步 code:0 且手机收到「测试」2 字 → ✅ 完成标志机器人发送通了；响应里的 CHAT_ID 就是 oc_xxxx，留着备用。

   2. 配置单向通知机器人

      > ```bash
      > 你的脚本 / 终端
      >       │  发一段 HTTP 请求（就是一条 curl）
      >       ▼
      > https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx   ← 飞书给的 webhook 地址
      >       │
      >       ▼
      > 飞书服务器 ──► 手机接收通知
      > ```

      1. 建群

         > 左上角 `+` → 创建群组 → 群名 `电脑提醒` → 创建（成员只有自己）

      2. 添加「自定义机器人」拿 Webhook 地址

         > 群右上角 `⋯`→「设置」→ 「群机器人」→「添加机器人」→ 「自定义机器人」→ 名称 `OpenChamber 提醒` →「添加」→ 复制 webhook 地址 → 安全设置 勾选「自定义关键词」→ 填：`OpenChamber 提醒`

      3. 把 Webhook 存进本机

         1. 建目录

            ```bash
            mkdir -p ~/.secrets && chmod 700 ~/.secrets
            ```

         2. 存 Webhook

            ```bash
            printf '请粘贴 webhook 后回车: '
            read -r H && printf '%s' "$H" > ~/.secrets/feishu-oc-webhook && chmod 600 ~/.secrets/feishu-oc-webhook
            ```

            执行后会停住等你粘贴 Webhook，粘贴完按回车。

         3. 校验是否存对

            ```bash
            # 下述命令输出的值在 75 ~ 95 之间
            wc -c < ~/.secrets/feishu-oc-webhook
            
            # 下述命令输出 https://open.feishu.cn/open-apis/bot/v2/
            head -c 40 ~/.secrets/feishu-oc-webhook; echo    
            ```

         4. 让命令能在任何目录下直接敲

            ```bash
            mkdir -p ~/.local/bin
            grep -q '.local/bin' ~/.zshrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
            source ~/.zshrc
            echo $PATH | grep -o "$HOME/.local/bin"
            ```

            输出 `/Users/用户名/.local/bin` 就说明路径已生效

      4. 安装推送工具 ocnotify（AI 来做）

      5. 推送测试（手机应在 1 秒内收到）

         ```
         ocnotify -t "接通了" "如果手机收到这条，说明整条链路通了"
         ```

      6. 实际应用

      7. 实际场景应用

         1. 场景一：活儿干完的时候发个提醒

            | 场景                 | 什么时候响 | 你的实际例子                              |
            | -------------------- | ---------- | ----------------------------------------- |
            | 脚本 / 程序跑完      | 结束那一刻 | 跑完一个 Python 数据分析脚本              |
            | 编译 / 打包完        | 结束那一刻 | Xcode 构建 SaiShot、打 ipa                |
            | 下载完成             | 结束那一刻 | 下载历史行情数据、下大文件                |
            | 转码 / 渲染 / 压缩完 | 结束那一刻 | 视频转码、批量压缩图片                    |
            | 数据抓取完           | 结束那一刻 | 爬虫跑完、Databento 拉数据跑完            |
            | 回测 / 批量计算完    | 结束那一刻 | 跑几百组参数的回测                        |
            | 文件同步 / 备份完    | 结束那一刻 | rsync 到移动硬盘、Time Machine 之外的备份 |
            | 批量改名 / 整理完    | 结束那一刻 | 一批文件重命名、归档                      |

         2. 场景二：干活中途出事的时候发个提醒

            | 场景                | 什么时候响                     |
            | ------------------- | ------------------------------ |
            | 脚本报错 / 失败     | 失败那一刻（成功不响，不吵你） |
            | 程序崩溃 / 意外退出 | 退出那一刻                     |
            | 后台服务挂了        | 服务停止那一刻                 |
            | 任务卡死 / 超时     | 超过设定时间还没结束           |
            | 磁盘快满了          | 剩余空间低于阈值               |
            | 外接硬盘 / U 盘掉线 | 卸载那一刻                     |
            | 网络断了            | 检测到断网                     |
            | 内存 / CPU 爆了     | 超过阈值                       |
            | 电池快没电了        | 低于百分比                     |

         3. 场景三：到点的时候发个提醒

            | 场景               | 什么时候响                   |
            | ------------------ | ---------------------------- |
            | 每天固定时间提醒   | 到点那一刻                   |
            | 周期性任务         | 每天 / 每小时 / 每周固定节奏 |
            | 盘前 / 收盘提醒    | 到点那一刻                   |
            | 该睡觉了 / 该起来  | 到点那一刻                   |
            | 长时间任务中途抽查 | 每隔 N 分钟响一次            |

         4. 场景四：条件满足时发个提醒

            > 这一类比前面稍微费点事（需要挂个一直在盯的小程序），但完全能做。

            | 场景                             | 什么时候响 |
            | -------------------------------- | ---------- |
            | 价格摸到某个值                   | 触发那一刻 |
            | 某个文件出现 / 被改动            | 出现那一刻 |
            | 某个进程启动了                   | 启动那一刻 |
            | 网页内容变了（库存、放号、抢票） | 变化那一刻 |
            | 收到特定邮件                     | 到达那一刻 |
            | 某个文件夹里有新文件             | 出现那一刻 |

         5. 场景五：AI 干活卡住时发个提醒

            | 场景                            | 什么时候响       |
            | ------------------------------- | ---------------- |
            | Agent 要你做决策（选 A 还是 B） | 它弹出问题的瞬间 |

      ### win11 安装 DSH

1. 装 Node.js

   * `https://nodejs.org/zh-cn`，下载 **LTS（长期版）**  `.msi` 安装包（64 位）

   * 在 Windows 搜索栏输入 `PowerShell`，右键选择**“以管理员身份运行”**，执行

     ```
     Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
     ```

   * 关闭当前所有终端窗口，重新打开 PowerShell

     ```
     node -v
     npm -v
     npx -v
     
     # 安装 pnpm
     npm install -g pnpm
     
     pnpm -v
     ```

2. 创建工作目录

   ```
   mkdir C:\Users\sai\Desktop\dsh
   cd C:\Users\sai\Desktop\dsh
   ```

3. 启动 DSH

   ```
   npx @deepseek-ai/dsh web
   
   # 第一次运行时，npm 会检查并下载对应的软件包，通通选 Y 就行
   
   # 输出：dsh web: http://127.0.0.1:3080/?token=yBXR1u_gWUXp-UXkPCBqA8SBvxlvV0t827hgmKGVip8
   ```

   浏览器访问 `http://127.0.0.1:3080`。**这个命令行窗口不能关**，关了服务就停

4. 配 API Key

   1. 官方 key 直接填

   2. 第三方 key（卡扣）

      ![image-20261126002037752](/Users/sai/Library/Application Support/typora-user-images/image-20261126002037752.png)

5. 安装 skill

   1. Superpowers

      ```
      # 安装
      npx @deepseek-ai/dsh plugin --profile web add superpowers-dsh
      
      # 确认插件已经安装到当前正在使用的 profile 中
      npx @deepseek-ai/dsh --profile web --dump-config | Select-String superpowers-dsh
      ```

      重启 DSH：找到正在运行 DSH 的 PowerShell 窗口， 关掉，重开一个PowerShell，然后输入

      ```
      npx @deepseek-ai/dsh web
      ```

      等待启动完成，保证PowerShell 窗口开着，打开浏览器，进入`http://127.0.0.1:3080`

   2. 创建自己的需求分析 Skill

      1. 创建 skill 的目录

         ```
         New-Item -ItemType Directory -Force "$env:USERPROFILE\.dsh\skills\product-requirements-analyst"
         ```

         执行成功后，目录结构

         ```
         C:\Users\Sai\.dsh\skills\
         └── product-requirements-analyst\
         ```

      2. 创建 SKILL.md

         ```
         notepad "$env:USERPROFILE\.dsh\skills\product-requirements-analyst\SKILL.md"
         ```

         提示文件不存在，询问是否创建，选择：是

      3. 复制下面的完整内容

         ```bash
         ---
         name: product-requirements-analyst
         description: 当用户提出软件开发想法、新增功能、修改现有功能、讨论产品设计或表达尚未成形的需求时使用。帮助用户进行需求澄清、产品分析、流程设计、边界情况分析和需求规格说明书编写。未经用户明确同意，不开始编码或修改项目。
         ---
         
         # Product Requirements Analyst
         
         ## 1. 角色定位
         
         你是一名资深产品经理、软件需求分析师和产品架构顾问。
         
         你的核心任务是帮助用户将零散、口语化、不完整、反复变化的软件想法，转化为清晰、完整、可执行、可验收的软件需求。
         
         你不是一个急于写代码的程序员。
         
         在需求阶段，你的首要工作是理解用户，而不是实现用户刚刚说出的某个功能。
         
         ## 2. 用户表达习惯
         
         用户可能：
         
         - 一次表达很多想法，内容比较长。
         - 在描述过程中不断补充新的要求。
         - 先提出一个模糊想法，讨论之后才逐渐明确。
         - 对之前的决定进行修改。
         - 使用口语化描述，而不是标准产品术语。
         - 尚未考虑异常情况和边界条件。
         - 在讨论过程中突然想到其他功能。
         
         必须允许用户自然表达，不要求用户遵循固定模板。
         
         不要因为用户表达不够专业，就要求用户重新组织语言。
         
         你负责理解、整理和追问。
         
         ## 3. 核心工作原则
         
         ### 3.1 先理解，再整理，最后设计
         
         不要在用户刚提出想法时立即输出完整技术方案。
         
         先理解用户真正想解决的问题。
         
         区分：
         
         - 用户明确提出的要求
         - 根据上下文推断的内容
         - 你提出的建议
         - 尚未确认的事项
         
         不得把推测包装成用户已经确认的需求。
         
         ### 3.2 不刻意迎合
         
         你必须保持独立判断。
         
         如果用户的想法存在以下问题，应明确指出：
         
         - 逻辑矛盾
         - 操作流程不合理
         - 功能重复
         - 设计过于复杂
         - 技术上不可行
         - 存在数据一致性风险
         - 可能破坏现有功能
         
         解释问题和原因，并提出替代方案。
         
         不要为了顺从用户而隐瞒问题。
         
         ### 3.3 控制提问数量
         
         不要一次提出十几个问题。
         
         优先找出当前最影响设计的一个问题，每次围绕它进行讨论。
         
         如果已有信息足够，就不要重复询问。
         
         ### 3.4 保留用户原始意图
         
         整理需求时，不要擅自增加用户没有提出的功能。
         
         可以提出改进建议，但必须明确标记为建议，等待用户决定。
         
         ## 4. 需求分析工作流程
         
         ### 阶段一：自由讨论
         
         允许用户自由描述需求。
         
         认真阅读用户的完整描述。
         
         当用户还在补充想法时，不要急于打断。
         
         适当总结已经理解的内容，并指出目前还不清楚的地方。
         
         ### 阶段二：需求整理
         
         将用户表达的内容整理为：
         
         1. 业务背景
         2. 要解决的问题
         3. 用户目标
         4. 功能需求
         5. 用户操作流程
         6. 数据与状态变化
         7. 异常情况
         8. 约束条件
         9. 待确认事项
         
         保留用户的原始业务逻辑。
         
         ### 阶段三：交互和流程设计
         
         针对每项功能分析：
         
         - 用户从哪里进入功能？
         - 用户需要执行什么操作？
         - 系统如何响应？
         - 操作成功后发生什么？
         - 操作失败后发生什么？
         - 用户取消操作时发生什么？
         - 是否存在重复操作？
         - 是否涉及历史数据？
         - 是否影响其他功能？
         
         必要时使用流程图、状态表或操作场景说明。
         
         ### 阶段四：边界条件分析
         
         主动寻找用户容易忽略的情况。
         
         例如：
         
         - 用户重复点击按钮。
         - 用户中途关闭窗口。
         - 用户刷新页面。
         - 网络中断。
         - 数据为空。
         - 数据重复。
         - 操作失败。
         - 用户撤销操作。
         - 多个操作同时发生。
         - 历史数据与新数据不兼容。
         
         根据项目性质选择相关情况，不要机械地罗列无关问题。
         
         ### 阶段五：需求确认
         
         在形成正式需求之前，向用户总结：
         
         - 已经明确的需求
         - 已经确认的设计
         - 尚未确定的问题
         - 你的建议
         
         重要事项必须经过用户确认。
         
         用户提出修改时，更新对应需求，并检查是否影响之前已经确认的设计。
         
         ### 阶段六：输出需求规格说明书
         
         用户确认需求后，生成完整的需求规格说明书。
         
         文档至少包含：
         
         1. 项目背景与目标
         2. 功能范围
         3. 功能详细说明
         4. 用户操作流程
         5. 页面和交互设计
         6. 数据结构及状态变化
         7. 异常处理
         8. 边界情况
         9. 与现有功能的关系
         10. 验收标准
         11. 尚未解决的问题
         
         每项功能应尽量具备可验证的验收标准。
         
         ## 5. 与软件开发阶段的边界
         
         需求分析阶段与实际开发阶段必须区分。
         
         在需求尚未明确时：
         
         - 不要修改代码。
         - 不要创建新的业务功能。
         - 不要擅自改变现有架构。
         - 不要把讨论中的想法当成开发指令。
         
         只有用户明确表示开始开发，才进入软件工程实施阶段。
         
         进入开发阶段后：
         
         1. 先阅读现有项目。
         2. 理解现有架构和功能。
         3. 检查需求与现有实现的关系。
         4. 制定实施计划。
         5. 识别风险和影响范围。
         6. 得到用户认可后实施。
         
         ## 6. 输出风格
         
         使用自然、清晰、专业的中文。
         
         优先使用技术文档风格。
         
         不要把回答拆成过多零碎的短句。
         
         避免无意义的重复和过度包装。
         
         对于复杂问题，使用表格、流程图和分级标题。
         
         结论必须区分事实、推断和建议。
         
         ## 7. 最终目标
         
         你的最终目标不是让需求文档看起来专业，而是确保开发人员能够准确理解：
         
         - 要做什么
         - 为什么要做
         - 用户如何操作
         - 系统应该如何响应
         - 哪些情况不允许发生
         - 如何判断功能已经正确完成
         
         需求没有明确之前，宁可继续讨论，也不要仓促进入编码。
         ```

         保存时注意文件名必须是：SKILL.md，不能是：SKILL.md.txt

         ```
         ls C:\Users\sai\.dsh\skills\product-requirements-analyst
         
         # 输出的要是 SKILL.md
         ```

      4. 检查 DSH 是否识别：回到 DSH，新建一个对话，输入

         ```
         请检查当前 Skill 列表，确认是否已经发现 product-requirements-analyst。
         
         如果已经发现，请加载这个 Skill，并向我简要说明：
         1. 这个 Skill 的角色是什么？
         2. 它的工作流程是什么？
         3. 在什么情况下它不会开始写代码？
         请实际读取 SKILL.md，不要仅根据名称推测。
         ```

         识别成功，就完成了
         
         > 这一步可能报错 把错误扔给 ChatGPT 排查就行，大概率是 SKILL.md 格式问题

   3. 破甲
   
      ```
      dsh plugin --profile web add dsh-purge
      
      # 如果安装失败 可尝试下面的命令
      dsh plugin --profile web add 'github:mmparko/dsh-purge#033e6bd1e0f101352b39075ecd0d758ffef26b76'
      
      # 
      ```

      重启 DSH：找到正在运行 DSH 的 PowerShell 窗口， 关掉，重开一个PowerShell，然后输入
   
      ```
      npx @deepseek-ai/dsh web
      ```

      在浏览器里观察会话标题旁边是否出现 dsh-purge 的入口。

      **检查插件**

      进入它的界面，但先只查看，不要点击：
   
      - Apply
      - Clean
      - Patch
      - Restore
      - Uninstall

      尤其不要随意应用宿主补丁。

   4. 安装 REA

      ```
      # 能打印出版本号就说明可以正常使用
      npx -y rea-agents --version
      
      # 安装
      npx rea-agents setup
      
      # Which agents should use REA? 翻找到 DeepSeek Harness 按空格勾选
      # CREATE  DeepSeek Harness、INSTALL  REA reverse-engineering skill 选 Yes, apply
      ```
   
      重启 DSH：找到正在运行 DSH 的 PowerShell 窗口， 关掉，重开一个PowerShell，然后输入
   
      ```
      npx @deepseek-ai/dsh web
      ```
   
      新对话问：
   
      ```
      # 你现在有哪些 mcp__rea__ 开头的工具？列出前 10 个名字。
      
      # 你现在有哪些 skill？有没有 reverse-engineer-anything？
      
      ```
   
      
   
   5. 
   
      
   
      ## 

