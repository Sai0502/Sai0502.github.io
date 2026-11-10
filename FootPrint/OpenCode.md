#### 安装 Ollama + qwen + OpenCode

```bash
# 安装 Ollama，「应用程序」会增加一个小羊图标，默认开机自动后台启动
curl -fsSL https://ollama.com/install.sh | sh
# 确认版本
ollama --version

# 下载模型（退出 Clash 否则可能报错）
ollama pull qwen3.5:9b
# 运行模型
ollama run qwen3.5:9b
# 验证模型，如果能正常回答，说明本地模型已运行成功
你好，请介绍一下你自己。

# 安装 OpenCode
curl -fsSL https://opencode.ai/install | bash
# 重载环境变量
source ~/.zshrc
# 确认版本
opencode --version

# 进入 OpenCode 并连接官方内置的免费云端模型 Big Pickle（必须联网）
opencode
# 退出 OpenCode 界面
/exit

# 进入 OpenCode 并连接 Ollama（不联网的本地模型）
ollama launch opencode --model qwen3.5:9b
# 退出 OpenCode 界面
/exit

# 已在 OpenCode 里，不退出 OpenCode 切换模型
/models
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

2. 

#### 用法

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

# 删除该项目目录的历史会话
# ① 删数据库
rm -f ~/.local/share/opencode/opencode.db \
      ~/.local/share/opencode/opencode.db-shm \
      ~/.local/share/opencode/opencode.db-wal
# ② 删缓存
rm -rf ~/.local/share/opencode/snapshot \
       ~/.local/share/opencode/tool-output \
       ~/.local/share/opencode/repos \
       ~/.local/share/opencode/log
# ③ 确认 Key 还在，保存的是 DeepSeek API Key
ls -la ~/.local/share/opencode

# 重新进入 OpenCode
opencode


```

