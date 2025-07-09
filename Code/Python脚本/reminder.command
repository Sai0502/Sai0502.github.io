#!/bin/bash

LOCK_FILE="$HOME/.reminder.lock"
SCRIPT_PATH="$HOME/Downloads/Python脚本/reminder.py"

# 如果锁文件存在，读取其中的 PID
if [ -f "$LOCK_FILE" ]; then
    OLD_PID=$(cat "$LOCK_FILE")

    # 检查该 PID 是否仍在运行且是我们这个脚本
    if ps -p "$OLD_PID" > /dev/null && ps -p "$OLD_PID" -o args= | grep -q "$SCRIPT_PATH"; then
        # 是在运行中，关闭它
        kill "$OLD_PID"
        rm -f "$LOCK_FILE"
        osascript -e 'display notification "程序已关闭" with title "提醒助手"'
        exit 0
    else
        # PID 不存在或不是我们的脚本，移除锁文件
        rm -f "$LOCK_FILE"
    fi
fi

# 启动脚本（后台），保存 PID
/opt/anaconda3/bin/python3 "$SCRIPT_PATH" "(15)" &
# /opt/anaconda3/bin/python3 "$SCRIPT_PATH" "(5+30)" >> "$HOME/Downloads/Python脚本/reminder.log" 2>&1 &
# /opt/anaconda3/bin/python3 "$SCRIPT_PATH" "(30)" &

NEW_PID=$!
echo "$NEW_PID" > "$LOCK_FILE"
osascript -e 'display notification "程序已启动" with title "提醒助手"'

exit 0

