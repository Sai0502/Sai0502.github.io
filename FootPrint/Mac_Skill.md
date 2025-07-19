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

1. 购买ChatGPT4

      > 方式一：[按次购买，每次买一个月](https://www.youtube.com/watch?v=kkl2YPO33qc) ，[教程](https://hailangya.com/articles/2021/04/02/apple-gift-card/)
      >
      > > 1. 注册Apple美国免税洲账号
      > > 2. 办理招商双币信用卡
      > > 3. Apple官网使用信用卡购买礼品卡，送给自己的美区Apple账号
      > > 4. ChatGPT iOS端内购时自动扣礼品卡金额
      >

1. GitHub + PicGo + Typora搭建图床

      > 1. 创建GitHub图床
      >
      >    > 创建的token只展示一次，要好好保存
      >
      >    ![image-20241223100207621](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20241223100207621.png)
      >
      > 2. 配置PicGo
      >
      >    > * 设定仓库名的时候，是按照“账户名/仓库名”的格式填写
      >    >
      >    >   * 如 jiangsai0502/PicBedRepo
      >    >
      >    > * 分支名统一填写“master”
      >    >
      >    > * 将之前的Token黏贴在这里：`74d803fcee14a9c36a8f1f387e5085446c2489f1`
      >    >
      >    > * 存储路径可以写成img/，这样会在repository下创建一个“img”文件夹
      >    >
      >    > * 自定义域名的作用是，在上传图片后成功后，PicGo会将“自定义域名+上传的图片名”生成的访问链接，放到剪切板上https://raw.githubusercontent.com/账户名/仓库名/分支名，自定义域名需要按照这样去填写
      >    >
      >    >   * 如https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master
      >    >
      >    > * PicGo报错
      >    >
      >    >   ![image-20241107173202457](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/image-20241107173202457.png)
      >
      > 3. Typora自动上传
      >
      >    > Typora到语言必须调成中文，上传服务才能看到PicGo.app
      >
      >    ![image-20240504172744911](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202405041727992.png)

1. Typora设置

      > 1. 展示设置：增加行宽
      >
      >    > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202312161642913.png)
      >
      > 2. 打印设置
      >
      >    1. 页边距
      >
      >       > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202310261112999.png)
      >
      >    2. [行距](https://www.twblogs.net/a/5db288f8bd9eee310d9fd66c/?lang=zh-cn)
      >
      >       > 1. 微调`body`中的`line-height`参数
      >       > 2. 关闭文件重新打开，修改即可生效
      >       >
      >       > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202310261109296.png)

1. Typora图片左对齐

      ```html
      <img src="https://xxx" align='left' style="zoom:25%;" />
      ```

1. Mac创建双击执行脚本

      > 1. 新建文件`command`文件
      >
      >    `touch 重启音频服务.command`
      >
      > 2. 使用`Sublime Text`打开`重启音频服务.command`文件
      >
      >    ```
      >    #!/bin/bash
      >    sudo killall coreaudiod
      >    ```
      >
      > 3. 文件授权
      >
      >    `chmod +x 重启音频服务.command`

1. chrome 书签&插件同步不及时

      > 手动强制同步
      >
      > 1. 架梯子
      > 2. 地址栏输入：chrome://sync-internals
      > 3. 中间那列中下方，点击“Stop Sync (Keep Data)”，之后点击“Request Start”
      > 4. 两个设备上的Chrome都进行一次这个操作

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

1. Sublime Text在非空行且没有标点符号的行末添加句号

      > `(?<![。，？！；：）])(?<=\S)$` 替换 `\0。`

1. Flow番茄钟

      >
      > flow 休息前的叮一声可替换Keep录屏提示音（[MP3转aiff后修改后缀为aif](https://www.freeconvert.com/zh/aif-converter)）
      >
      > /Applications/Flow.app/Contents/Resources/Flow.aif

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

> [参考](https://zhuanlan.zhihu.com/p/113809716)
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

