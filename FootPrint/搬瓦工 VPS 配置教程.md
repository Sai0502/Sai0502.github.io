# 搬瓦工 VPS 配置教程（Mac 版）

## 1. 购买搬瓦工 VPS

1. 打开 [搬瓦工中文网](https://www.bandwagonhost.net/)，参考 [购买教程](https://www.bandwagonhost.net/716.html)
2. 推荐套餐：[CN2 GIA-E](https://bwh81.net/cart.php?a=confproduct&i=0)（性价比最高，中国优化线路）

## 2. 选择配置

- `Billing Cycle`：$49.99 USD Quarterly（季度付费）
- `Location`：US - Los Angeles DC6
- 点 `Add to Cart` 添加到购物车

## 3. 结算

- `Your Details`：随便填（姓名地址）
- `Payment Method`：选 Alipay（支付宝）
- 邮箱验证码确认
- `Make payment`：扫支付宝二维码支付

## 4. 进入 KiwiVM 管理面板

1. 登录 [客户中心](https://bwh81.net/clientarea.php?incorrect=true)
2. Services → My Services → 找到你的机器 → 点 `Manage` → `Open KiwiVM`
3. 在 KiwiVM 中：
   - Main controls → 先 Stop 停机
   - Install new OS → 选 `ubuntu-22.04-x86_64`
   - **记录新密码**（安装完会显示，只出现一次！）
   - 等待安装进度条到 100%，确认 Status: Running
   - 记录服务器 IP（如 `199.19.110.23`）

## 5. 扫描可用域名（最关键）

### 5.1 SSH 连接 VPS

```bash
# 在 Mac 终端通过 SSH 连接 VPS
ssh root@199.19.110.23
# 输入第4步安装 Ubuntu 时获得的密码
# 第一次连接会问 yes/no，输入 yes
```

### 5.2 下载并运行扫描工具

```bash
# 在 VPS 上下载并运行 RealiTLScanner 扫描工具
wget https://github.com/XTLS/RealiTLScanner/releases/download/v0.2.3/RealiTLScanner-linux-amd64

# 加执行权限
chmod +x RealiTLScanner-linux-amd64

# 运行扫描（用 VPS 公网 IP 作为起点）
./RealiTLScanner-linux-amd64 -addr 199.19.110.23 -port 443 -thread 100 -timeout 5 -out file.csv
```

**等待 5-10 分钟**，看到终端不断滚动输出说明在扫描。觉得扫够了按 `Ctrl+C` 停止。

检查数据量：

```bash
ls
wc -l file.csv
# 几十条以上就够了，太少就重新跑，多等一会儿
```

### 5.3 筛选可用域名（直接粘贴到终端执行）

```bash
python3 -c "
import csv, subprocess
domains = set()
with open('file.csv') as f:
    r = csv.reader(f)
    next(r)
    for row in r:
        if len(row) >= 9:
            d = row[8].strip()
            issuer = row[9].strip() if len(row) > 9 else ''
            # 过滤垃圾域名
            skip = ['Cloud','Origin','Certificate','Kubernetes','Forti','OPNsense','OpenVPN','Fake','Controller','noname','localhost','pfSense']
            if d and not d.startswith('*') and not any(s in d for s in skip):
                domains.add(d)
results = []
for d in sorted(domains):
    try:
        r = subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','--connect-timeout','3',f'https://{d}'], capture_output=True, text=True, timeout=5)
        code = r.stdout.strip()
        if code and code != '000':
            results.append((code, d))
    except:
        pass
for code, d in sorted(results, key=lambda x: x[0]):
    mark = 'OK' if code == '200' else '  '
    print(f'{code}  {mark}  {d}')
"
```

> **注意**：此命令在 VPS 上执行，检测的是 VPS 能否访问该域名。
> VPS 在国外能访问 ≠ 你在国内能直连。下一步必须在国内验证。

输出类似：

```bash
200  OK  cca.edu
200  OK  rayfalling.com
200  OK  waziki.com
301      yupoo.ru
404      yahoo.com
```

### 5.4 验证域名国内可直连（必须做！）

**这一步最关键，跳过会导致后续连不上。**

从上面 200 的域名里挑几个候选（排除大厂域名如 apple.com、microsoft.com、cloudflare.com、weixin.qq.com），然后：

1. **关掉所有代理/梯子**（Clash、Surge 等全部关闭）
2. 在 Mac 浏览器里逐个打开 
3. **能直接打开、显示安全锁（HTTPS 有效）的域名才能用**

> ⚠️ 如果一个域名关了代理就打不开，说明它在国内被墙了，不能用！换一个继续试，直到找到能直连的。

### 5.5 如果扫到的域名都不可用

换几个不同的起始 IP 重新扫描，凑够数据再筛：

```bash
# 删掉旧文件
rm -f file.csv

# 换起始 IP 重扫（试试附近的其他 IP 段）
./RealiTLScanner-linux-amd64 -addr 104.16.0.1 -port 443 -thread 100 -timeout 5 -out file.csv
# 等 5-10 分钟再 Ctrl+C

# 然后重新执行 5.3 的 python 脚本
```

## 6. 安装 s-ui 面板

```bash
# 更新系统 + 安装依赖
apt update && apt install -y unzip curl

# 安装 s-ui 面板
bash <(curl -Ls https://raw.githubusercontent.com/alireza0/s-ui/master/install.sh)
```

安装过程中会问 `Do you want to continue with the modification?[y/n]`，**输入 n**。

安装完成后会显示，**全部记下来！**

- **Username**：`xxxxxxxx`
- **Password**：`xxxxxxxx`
- **Global address**：`http://199.19.110.23:2095/app/`

---

## 7. 配置 s-ui 面板

1. 浏览器打开后台地址：`http://199.19.110.23:2095/app/`
2. 输入 Username 和 Password 登录
3. 右上角语言切换为「简体中文」

### 7.1 TLS 设置

- TLS 设置 → 添加
  - 名称：`Atas0821`（随便起）
  - 类型：`Reality`
  - SNI：`你在第5步验证通过的域名`
  - 握手服务器：同上
  - 点「生成」→ 得到**私钥、公钥、Short IDs**
  - 保存

### 7.2 配置IOS - ShadowRocket 和 MAC - Clash Verge（常用）

![image-20260822013541527](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202608220135614.png)

- 入站管理 → 添加
  - 类型：`VLESS`（标签和端口会自动生成，如 标签`vless-20727`，端口`20727`）
  - 模板：`Atas0821`（7.1 步建的 Reality）
  - 保存
  
- 放行防火墙端口
  
  ```bash
  ufw allow 20727/tcp
  ```

- 用户管理 → 添加
  - 名称：`ShadowRocket-ClashVerge`
  - 入站标签：选 `vless-20727`
  - 保存
  - 点二维码图标 → 切到链接Tab → 单击即可复制链接 `vless://xxxx-xxx-xxx` 
  
- 配置 IOS - ShadowRocket
  - 用户管理 → 点二维码图标 → 切到链接Tab → ShadowRocket扫描，即可获取订阅地址
  
- 配置 MAC - Clash Verge
  - [下载 官方 Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev/releases)：Apple M芯片
  
  - 订阅转换 → 打开 [订阅转换工具](https://kjfx.github.io/socks/clash.html)
    - 粘贴 `vless://xxxx-xxx-xxx`
    - 转换成 Mihomo 格式
    - 下载得到 `default.yaml`
    
  - 导入订阅
    1. 关闭当前梯子 Surge
    2. 打开 Clash Verge Rev
    3. 左侧 → `订阅`（Profiles）
    4. 把 `default.yaml` 文件拖入窗口，或点「新建」→ 粘贴订阅 URL
    5. 右键该订阅 → `使用`（激活）
    
  - 选择节点
    1. 左侧 → `代理`（Proxies）
    2. 节点选择：选 `vless-28641`
    
  - 开启代理
    
    |            | 系统代理模式           | TUN 虚拟网卡模式                 |
    | ---------- | ---------------------- | -------------------------------- |
    | 兼容性     | 几乎所有系统都稳定     | 可能和其他 VPN / 安全软件冲突    |
    | 覆盖范围   | 覆盖浏览器、大部分 App | 覆盖所有应用，没有例外           |
    | 出问题概率 | 低                     | 稍高（驱动层面的东西）           |
    | 适合场景   | 普通浏览网页           | 桌面软件不遵守代理、需要全局控制 |
    
    ![image-20260822031633933](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202608220316987.png)
    
    1. 系统代理模式：通过 HTTP/SOCKS 代理转发，覆盖大部分应用，一般用「系统代理」模式就够了，但为了确保 Altas 一定会走 VPS，所以我们使用TUN 模式
    2. 若某些应用不走代理，可额外开 TUN 模式。
    
  - 验证：浏览器打开 google.com，能访问就成功了
  
- 配置 Windows - Clash Verge
  
  - [下载 官方 Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev/releases)：ARM64版本
  - 订阅转换 → 打开 [订阅转换工具](https://kjfx.github.io/socks/clash.html)
    - 粘贴 `vless://xxxx-xxx-xxx`
    - 转换成 Mihomo 格式
    - 下载得到 `default.yaml`
  
  - 导入订阅
    1. 关闭当前梯子 Surge
    2. 打开 Clash Verge Rev
    3. 左侧 → `订阅`（Profiles）
    4. 把 `default.yaml` 文件拖入窗口，或点「新建」→ 粘贴订阅 URL
    5. 右键该订阅 → `使用`（激活）
  
  - 选择节点
    1. 左侧 → `代理`（Proxies）
    2. 节点选择：选 `vless-28641`
  
  - 开启代理
  

### 7.3 配置 MAC - Surge（备用）

> |              | Surge                                      | Clash Verge Rev                |
> | ------------ | ------------------------------------------ | ------------------------------ |
> | 可用协议     | VMess 无 TLS / Shadowsocks（不支持 VLESS） | VLESS+Reality                  |
> | 抗封锁能力   | ⚠️ 弱，无 TLS 混淆，GFW 能识别协议特征      | ✅ 强，Reality 伪装成正常 HTTPS |
> | 长连接稳定性 | ⚠️ 已验证有问题（GitHub push 断连）         | ✅ TLS 加密，GFW 不会主动干扰   |
> | 网页加载速度 | ✅ 快                                       | ⚠️ 慢（Reality 握手 650ms）     |
> | 对交易的影响 | ❌ 长连接可能被重置，致命                   | ✅ 长连接稳定，网页慢不影响交易 |

![image-20260822013601453](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202608220136526.png)

- 入站管理 → 添加

  - 类型：`VMESS`（标签和端口会自动生成，如 标签`vmess-35994`，端口`35994`）
  - 模板：`无`（默认就是“无”，⚠️ 不能选 Reality，Surge 不支持）
  - 保存

- 放行防火墙端口

  ```bash
  ufw allow 35994/tcp
  ```

- 用户管理 → 添加

  - 名称：`Surge`
  - 入站标签：选 `vmess-35994`
  - 保存
  - 点这个用户的**编辑**，切换到 **配置** 标签页，**复制 UUID**

- 配置 MAC - Surge

  - 更多 → 配置 → 新配置 → 取名VPS → 右键 VPS → 在文本编辑器中编辑

    ```bash
    [General]
    
    [Proxy]
    VPS = vmess, 199.19.110.23, 替换成端口, username=替换成UUID, encrypt-method=aes-128-gcm, vmess-aead=true
    
    [Proxy Group]
    Proxy = select, VPS
    
    [Rule]
    GEOIP,CN,DIRECT
    FINAL,Proxy
    ```

  - 策略 → 规则判断 → 代理 → 点击即可测试延迟

  - 概览 → 系统代理 → 打开即可正常工作

  - 验证：浏览器打开 google.com，能访问就成功了

### 8. 验证出口 IP

* 打开 `ip.sb` ，确认显示的 IP 是 `199.19.110.23`，说明流量确实走了代理。

## 常见问题

**Q: ssh 连接提示 Permission denied？**
确认密码对不对（Ubuntu 安装时给的那个密码）。大小写敏感。

**Q: reality-checker 只提取到 1 个域名？**
RealiTLScanner v0.2.3 的 CSV 格式与 reality-checker 不兼容，改用第 5.3 步的 python 脚本。

**Q: python 脚本执行后没有输出？**
确认 file.csv 在当前目录，且有数据（`wc -l file.csv` 至少几十行）。脚本需要 1-2 分钟跑完。

**Q: s-ui 后台打不开？**

```bash
ufw allow 2095/tcp
```

**Q: 代理连不上，打开 google.com 超时？**
最可能的原因：SNI 域名在国内被墙了。关掉代理，在浏览器里直接打开 `https://你的SNI域名`，如果打不开就必须换一个域名（回到第5步重新选）。
