# VPS 配置教程

#### 1. [购买Nosla](https://ccp.nosla.cloud/client/)

1. 洛杉矶标准优化-S（45 块/月，支付宝支付）

2. 系统：Ubuntu 22.04 LTS，密码记住 后面要用

3. 进入管理面板

   1. 仪表盘 - 服务 - 已购买的套餐列表 - 洛杉矶标准优化-S - 管理 - 左侧列表「管理」

      > 进入后，确认
      >
      > - VPS 状态为 `Running`
      > - IPv4 地址正确
      > - 操作系统为 Ubuntu

   2. 由于开通时已经是 Ubuntu 22.04，因此不需要像搬瓦工教程那样执行 `Install new OS`

#### 2. [购买搬瓦工](https://www.bandwagonhost.net/)

1. 参考 [购买教程](https://www.bandwagonhost.net/716.html)，推荐套餐：[CN2 GIA-E](https://bwh81.net/cart.php?a=confproduct&i=0)（性价比最高，中国优化线路）$49.99 USD/季
2. Location：US - Los Angeles DC6
3. 进入 KiwiVM 管理面板
   1. 登录 [客户中心](https://bwh81.net/clientarea.php?incorrect=true)
   2. Services → My Services → 找到你的机器 → 点 `Manage` → `Open KiwiVM`
   3. 在 KiwiVM 中：
      - Main controls → 先 Stop 停机
      - Install new OS → 选 `ubuntu-22.04-x86_64`
      - **记录新密码**（安装完会显示，只出现一次！）
      - 等待安装进度条到 100%，确认 Status: Running
      - 记录服务器 IP（如 `199.19.110.23`）

#### 3. 测试 SSH

```bash
ssh root@你的服务器IPv4

# 第一次连接会出现：
Are you sure you want to continue connecting?    # 输入：yes
```

#### 4. 第一次登录后的基础配置

```bash
apt update
apt upgrade -y
apt install -y curl wget ca-certificates unzip ufw

# 设置时区为上海（可选）
timedatectl set-timezone Asia/Shanghai

# 查看系统和 IP：
hostnamectl
ip addr

# 查看公网 IPv4，输出的 IP 应该和 NoSLA 面板中的 IPv4 一致。
curl -4 ip.sb

```

####  5. 配置防火墙

```
# 先放行 SSH，避免把自己锁在服务器外
ufw allow OpenSSH

# 如果使用 s-ui 默认后台端口 2095
ufw allow 2095/tcp

# 如果准备使用 443 作为代理端口(用不到)
ufw allow 443/tcp

# 启用防火墙
ufw enable

# 查看规则
ufw status

# 如果后面把代理端口改成其他端口，例如 44566，还要执行
ufw allow 44566/tcp
```

#### 6. 扫描可用域名（最关键）

1. SSH 连接 VPS

   ```
   # 在 Mac 终端通过 SSH 连接 VPS
   ssh root@199.19.110.23
   # 输入第4步安装 Ubuntu 时获得的密码
   # 第一次连接会问 yes/no，输入 yes

2. 下载并运行扫描工具

   ```
   # 在 VPS 上下载并运行 RealiTLScanner 扫描工具
   wget https://github.com/XTLS/RealiTLScanner/releases/download/v0.2.3/RealiTLScanner-linux-amd64
   
   # 加执行权限
   chmod +x RealiTLScanner-linux-amd64
   
   # 运行扫描（用 VPS 公网 IP 作为起点）
   ./RealiTLScanner-linux-amd64 -addr 199.19.110.23 -port 443 -thread 100 -timeout 5 -out file.csv
   ```

   **等待 5-10 分钟**，看到终端不断滚动输出说明在扫描。觉得扫够了按 `Ctrl+C` 停止，检查数据量：

   ```
   ls
   wc -l file.csv
   # 几十条以上就够了，太少就重新跑，多等一会儿
   ```

3. 筛选可用域名（直接粘贴到终端执行）

   ```
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

   > **注意**：此命令在 VPS 上执行，检测的是 VPS 能否访问该域名。执行可能会花几分钟 并不是卡死。
   > VPS 在国外能访问 ≠ 你在国内能直连。下一步必须在国内验证。

   输出类似：

   ```bash
   200  OK  cca.edu
   200  OK  rayfalling.com
   200  OK  waziki.com
   301      yupoo.ru
   404      yahoo.com
   ```

4. 验证域名国内可直连（必须做！）

   **这一步最关键，跳过会导致后续连不上。**

   从上面开头是 200 的域名里挑几个候选（排除大厂域名如 apple.com、microsoft.com、cloudflare.com、weixin.qq.com），然后：

   1. **关掉所有代理/梯子**（Clash、Surge 等全部关闭）
   2. 在 Mac 浏览器里逐个打开 （也可以让豆包桌面版来干这个）
   3. **能直接打开、显示安全锁（HTTPS 有效）的域名才能用**

   > ⚠️ 如果一个域名关了代理就打不开，说明它在国内被墙了，不能用！换一个继续试，直到找到能直连的。

   2026 年 11 月 18 号实测，https://rayfalling.com/ 可用

5. 如果扫到的域名都不可用，换几个不同的起始 IP 重新扫描，凑够数据再筛

   ```
   # 删掉旧文件
   rm -f file.csv
   
   # 换起始 IP 重扫（试试附近的其他 IP 段）
   ./RealiTLScanner-linux-amd64 -addr 104.16.0.1 -port 443 -thread 100 -timeout 5 -out file.csv
   # 等 5-10 分钟再 Ctrl+C
   
   # 然后重新执行 5.3 的 python 脚本
   ```

#### 7. 安装 s-ui 面板

```
# 更新系统 + 安装依赖
apt update && apt install -y unzip curl

# 安装 s-ui 面板
bash <(curl -Ls https://raw.githubusercontent.com/alireza0/s-ui/master/install.sh)

# 如果安装程序询问：
Do you want to continue with the modification? [y/n]    # 输入 n
```

安装完成后会显示，**全部记下来！**

- **Username**：`xxxxxxxx`
- **Password**：`xxxxxxxx`

#### 8. 配置 s-ui 面板

![image-20260822013541527](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202608220135614.png)

1. s-ui 后台：`http://服务器IPv4:2095/app/`

   1. s-ui 官方项目当前仍提供 Linux 一键安装方式，默认后台端口是 `2095`，默认路径是 `/app/`

   2. 输入第 7 步得到的 Username 和 Password 登录

      > 如果后台打不开，检查：
      >
      > ```
      > ufw status
      > ss -tlnp | grep 2095
      > ```
      >
      > 确认端口后补放行：
      >
      > ```
      > ufw allow 2095/tcp
      > ```
      >

   3. 右上角语言切换为「简体中文」

2. TLS 设置 → 添加

   1. 名称：`Atas1118`（随便起）
   2. 类型：`Reality`
   3. SNI：`第 6 步验证通过的域名`
   4. 握手服务器：同上
   5. 点右侧 🔑「生成」→ 得到**私钥、公钥、Short IDs**
   6. 保存

3. 入站管理 → 添加

   - 类型：`VLESS`（标签和端口会自动生成，如 标签`vless-32991`，端口`32991`）
   - 模板：`Atas1118`（上一步建的 Reality）
   - 保存

4. 放行防火墙端口

   ```bash
   ufw allow 32991/tcp
   ```

5. 用户管理 → 添加

   - 名称：`ClashVerge`
   - 入站标签：选 `vless-32991`
   - 保存
   - 点二维码图标 → 切到Tab「链接」 → 单击即可复制链接 `vless://xxxx-xxx-xxx` 

6. 配置 IOS - ShadowRocket

   - 用户管理 → 点二维码图标 → 切到链接Tab → ShadowRocket扫描，即可获取订阅地址

7. 配置 MAC - Clash Verge

   - [下载 官方 Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev/releases)：Apple M芯片

   - 订阅转换 → 打开 [订阅转换工具](https://kjfx.github.io/socks/clash.html)

     - 粘贴 `vless://xxxx-xxx-xxx`
     - 转换成 Mihomo 格式
     - 下载得到 `default.yaml`

   - 配置 Clash Verge Rev

     - 删除原订阅
       - 左侧 → 订阅 → 右键删除
     - 导入新订阅
       - 把 `default.yaml` 文件拖入窗口，或点「新建」→ 粘贴订阅 URL
       - 右键该订阅 → 使用（激活）
       - 左侧 → 代理 → 选 `vless-20727` → 延迟测试

   - 修改配置文件

     > 症状：Google、YouTube 正常，`chatgpt.com`、`x.com` 打不开
     >
     > 解决方式如下

     订阅 → 右键`default.yaml` → 编辑规则 → 直接点「取消」

     ```bash
     cd ~/Library/Application\ Support/io.github.clash-verge-rev.clash-verge-rev/profiles
     grep -l "Rules Template" *.yaml
     
     # 输出 xxxxxxxxxx.yaml
     ```

     打开 xxxxxxxxxx.yaml，将下述设置写入该文件

     > 下述「节点选择」其实是Clash Verge → 代理 → 代理组的名称，如果重装后改名了，要替换
     >
     > ![image-20261123194129602](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20261123194129-image-20261123194129602.png)

     ```bash
     prepend:
       - DOMAIN-SUFFIX,chatgpt.com,节点选择
       - DOMAIN-SUFFIX,openai.com,节点选择
       - DOMAIN-SUFFIX,oaistatic.com,节点选择
       - DOMAIN-SUFFIX,oaiusercontent.com,节点选择
       - DOMAIN-SUFFIX,sora.com,节点选择
       - DOMAIN-SUFFIX,x.com,节点选择
       - DOMAIN-SUFFIX,twitter.com,节点选择
       - DOMAIN-SUFFIX,twimg.com,节点选择
       - DOMAIN-SUFFIX,t.co,节点选择
     
     append: []
     
     delete: []
     ```

     同目录下的 Merge.yaml，将下述设置写入该文件

     > 下述「节点选择」其实是Clash Verge → 代理 → 代理组的名称，如果重装后改名了，要替换

     ```bash
     profile:
       store-selected: true
     
     dns:
       enable: true
       listen: 0.0.0.0:1053
       enhanced-mode: fake-ip
       fake-ip-range: 198.18.0.1/16
       fake-ip-filter:
         - "*.lan"
         - "*.local"
         - "localhost.ptlogin2.qq.com"
       nameserver:
         - https://doh.pub/dns-query
         - https://dns.alidns.com/dns-query
       fallback:
         - https://dns.google/dns-query#节点选择
         - https://cloudflare-dns.com/dns-query#节点选择
       fallback-filter:
         geoip: true
         geoip-code: CN
       nameserver-policy:
         "chatgpt.com,openai.com,oaistatic.com,oaiusercontent.com,sora.com": https://doh.pub/dns-query
         "x.com,twitter.com,twimg.com,t.co": https://doh.pub/dns-query
     ```

     重启 Clash Verge Rev

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

8. 配置 Windows - Clash Verge

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

#### 9. 验证出口 IP

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

1. 最可能的原因：SNI 域名在国内被墙了。关掉代理，在浏览器里直接打开 `https://你的SNI域名`，如果打不开就必须换一个域名（回到第5步重新选）。

2. 20261026 原因：vless 端口被封

   1. 排查（其实是豆包排查的）

      ```bash
      # SSH 登录
      ssh root@199.19.110.23
      # 确认是否端口被封
      ss -tlnp | grep 20727     # 没反馈
      ss -tlnp | grep 44566     # 有反馈，说明 44566 端口 ok
      LISTEN 0      4096               *:44566            *:*    users:(("sui",pid=623188,fd=14))
      ```

   2. 处理

      1. 浏览器登录s-ui：`http://199.19.110.23:2095/app/` 
      2. **入站管理** → 编辑 `vless-20727` → 端口改成一个随机高位端口（建议 40000-60000 之间随便挑，比如 44566，**不要用 80/443/8080 这些常见端口**）→ 保存
      3. SSH 放行新端口：`ufw allow 44566/tcp`
      4. 让端口生效：面板里重启 s-ui，或 SSH 执行 `s-ui restart`
      5. **用户管理** → 找到你的用户 → 复制新的 `vless://` 链接 → 去 [订阅转换工具](https://kjfx.github.io/socks/clash.html) 处理
      6. **Clash Verge**：删除旧订阅 → 拖入新订阅







## 虚拟U卡

|         | SafePal Mastercard                                           | Bybit Card                               |
| ------- | ------------------------------------------------------------ | ---------------------------------------- |
| 性质    | SafePal 是加密钱包，不是银行或卡组织                         | Bybit 是加密货币交易所，本身不是卡组织   |
| 卡类型  | 万事达借记卡（与 Fiat24 合作）                               | 万事达借记卡（与 Mastercard 合作）       |
| 入金    | 充 USDC，手动换成 USD，手动存卡里                            | 充 USDC / USDT，自动换成 USD，自动存卡里 |
| 用途    | 可在全球 Mastercard 商户消费，也可绑定支付宝、微信、Apple Pay 等 | 同 SafePal                               |
| 安全    | 钱在本地钱包，私钥至关重要                                   | 钱在平台                                 |
| AppleID | 美区Gmail                                                    | 美区Gmail                                |

#### Bybit 用法

1. VPN：台湾、日本

2. [入金](https://www.youtube.com/watch?v=1xd2U8_RhWs)

   ![image-20261029165638271](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202610291656323.png)

3. 用法

   ![image-20261029171300595](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202610291713680.png)

4. 绑定支付宝

### SafePal 用法

1. 查看私钥、助记词

   ![image-20261030112557342](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202610301125422.png)

2. [入金](https://www.youtube.com/watch?v=fjRuY8ucYvo&t=75s)

   ![image-20261030153920316](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202610301539370.png)

3. 用法

   ![image-20261030153802690](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202610301538768.png)

4. 必备：在 Arbitrum 链上留 15 美金的 ETH，因入金、划转、消费都要消耗 ETH 作 Gas 费

