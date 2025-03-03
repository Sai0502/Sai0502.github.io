#### Python 虚拟环境

> 系统python版本不要轻易升级
>
> 每个应用各自拥有一套“独立”的Python环境

##### Anaconda

> **安装**
>
> * 官网安装
>
> * 给conda挂代理  
>
>   > ```
>   > open ~/.condarc
>   > 最后插入几行
>   > proxy_servers:
>   > http: http://127.0.0.1:1081
>   > https: https://127.0.0.1:1081
>   > ```
>
> * 以下设置已成历史，新版本不必再设置
>
>   > * 定位anaconda3的安装路径
>   >
>   >   > ```bash
>   >   > find / -name "conda" -type f 2>/dev/null
>   >   > 
>   >   > /opt/anaconda3/condabin/conda
>   >   > /opt/anaconda3/bin/conda
>   >   > /opt/anaconda3/pkgs/conda-24.7.1-py312hca03da5_0/condabin/conda
>   >   > /opt/anaconda3/pkgs/conda-24.7.1-py312hca03da5_0/bin/conda
>   >   > /opt/anaconda3/pkgs/conda-24.7.1-py312hca03da5_0/lib/python3.12/site-packages/conda/shell/bin/conda
>   >   > /opt/anaconda3/pkgs/conda-24.5.0-py312hca03da5_0/condabin/conda
>   >   > /opt/anaconda3/pkgs/conda-24.5.0-py312hca03da5_0/bin/conda
>   >   > /opt/anaconda3/pkgs/conda-24.5.0-py312hca03da5_0/lib/python3.12/site-packages/conda/shell/bin/conda
>   >   > ```
>   >   >
>   >   > 可知anaconda3的安装路径是：`/opt/anaconda3`
>   >
>   > * 在环境变量中添加anaconda3的路径
>   >
>   >   > `open ~/.bash_profile`
>   >   >
>   >   > ```bash
>   >   > # >>> conda initialize >>>
>   >   > # !! Contents within this block are managed by 'conda init' !!
>   >   > __conda_setup="$('/opt/anaconda3/bin/conda' 'shell.bash' 'hook' 2> /dev/null)"
>   >   > if [ $? -eq 0 ]; then
>   >   >     eval "$__conda_setup"
>   >   > else
>   >   >     if [ -f "/opt/anaconda3/etc/profile.d/conda.sh" ]; then
>   >   >         . "/opt/anaconda3/etc/profile.d/conda.sh"
>   >   >     else
>   >   >         export PATH="/opt/anaconda3/bin:$PATH"
>   >   >     fi
>   >   > fi
>   >   > unset __conda_setup
>   >   > # <<< conda initialize <<<
>   >   > ```
>   >   >
>   >   > `source ~/.bash_profile`
>   >
>   > * 在oh-my-zsh中添加anaconda3的路径
>   >
>   >   > ```bash
>   >   > open ~/.zshrc
>   >   > 在第三行插入一行：export PATH="/opt/anaconda3/bin:$PATH"
>   >   > source ~/.zshrc
>   >   > ```
>   >   >
>   >   > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202307062310695.png)
>

> **卸载**
>
> * 安装卸载插件
>
>   ```bash
>   $ conda install anaconda-clean
>   $ anaconda-clean
>   $ rm -r /Users/sai/.anaconda_backup/2020-04-24T164213    #删除备份
>   ```
>
> * 删除Anaconda的文件夹
>
>   ```bash
>   $ which conda
>   /opt/anaconda3/bin/conda
>   $ sudo rm -rf /opt/anaconda3
>   ```
>
> * 删除 `~/.bash_profile`中anaconda的环境变量，即删除最后一行：`export PATH="/opt/anaconda3/bin:$PATH"`
>
> * 删除Anaconda的可能存在隐藏的文件：`rm -rf ~/.condarc ~/.conda ~/.continuum`

> **基础用法**
>
> * 查看当前系统下的虚拟环境，安装路径
>
>   > `conda info --envs`
>   >
>   > ```bash
>   > base                     /Users/jiangsai/anaconda3
>   > py3              *       /Users/jiangsai/anaconda3/envs/py3
>   > ```
>   >
>   > *即当前处于py3环境
>
> * 激活base虚拟环境(base是默认创建的)
>
>   >`conda activate base`
>
> * 退出虚拟环境
>
>   >`conda deactivate`
>
> * 创建名为 py2 的python2.7的虚拟环境，创建名为 py3 的python3的虚拟环境
>
>   > `conda create -n py2 python=2.7`
>   >
>   > `conda create -n py3 python=3.10`
>
> * 激活虚拟环境py3
>
>   > `conda activate py3`
>
> * py3中Python的位置
>
>   > `which python `
>   >
>   > ```
>   > # /Users/jiangsai/anaconda3/envs/py3/bin/python
>
> * 切换虚拟环境到py2 
>
>   > `conda activate py2`
>
> * 在当前虚拟环境py2 下，删除虚拟环境 py3
>
>   > `conda env remove -n py3`
>
> * 为当前的虚拟环境 py2 安装flask包
>
>   >`conda install flask`
>
> * 虚拟环境下包的安装路径
>
>   > ```
>   > /Users/jiangsai/anaconda3/envs/py3/lib/python3.10/site-packages
>
> * 为当前的虚拟环境更新flask包
>
>   >`conda update flask`
>
> * 为当前的虚拟环境删除flask包
>
>   > `conda remove flask`
>
> * 查看当前的虚拟环境的所有安装包
>
>   > `conda list`
>
> * 虚拟环境中使用pip
>
>   >坑：[conda虚拟环境使用pip慎重](https://www.cnblogs.com/zhangxingcomeon/p/13801554.html)
>   >
>   >* 进入py3后，查看此时要用的pip在哪个环境
>   >
>   >  >`pip3 -V`
>   >  >
>   >  >base环境的pip：可能在
>   >  >
>   >  >```
>   >  >pip 22.3.1 from /Users/jiangsai/anaconda3/lib/python3.10/site-packages/pip (python 3.10)
>   >  >```
>   >  >
>   >  >而其他conda环境的pip：可能在
>   >  >
>   >  >```
>   >  >pip 23.1.2 from /Users/jiangsai/anaconda3/envs/py3/lib/python3.10/site-packages/pip (python 3.10)
>   >  >```
>   >  >
>   >  >> 尽量不使用base环境的pip3，用哪个环境就用哪个环境下的pip3，如果切到py3环境后，`pip3 -V`仍显示用的base环境的pip3，则可能是py3没安装pip3
>   >  >>
>   >  >> `conda install pip3`
>   >
>   >* 在 py3 环境下使用pip安装playwright包
>   >
>   >  >`pip3 install playwright`
>   >
>   >* 查看pip3安装所有包的位置
>   >
>   >  > `pip3 list`随意找个已安装的包，再执行一次命令 `pip3 install xx`，就会显示安装路径
>   >  >
>   >  > `pip3 install wheel`
>   >  >
>   >  > ```
>   >  > Requirement already satisfied: wheel in /Users/jiangsai/anaconda3/envs/py3/lib/python3.10/site-packages (0.40.0)
>   >  > ```
>   >

#### Charles入门

1. 原理：Charles将自己伪装成1个电脑与互联网之间的代理服务器，来截获包数据

2. 用法

   | 将Charles设为系统代理服务器                                  | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20210930190846.png) |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
   | 安装SSL证书                                                  | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20211010223221.png) |
| 若https还是如下乱码，则先reset，然后删除证书，再重新安装SSL证书 | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20211010223502.png) |
   | 配置SSL代理：Host栏与Port栏都填空（*表示抓所有SSL请求*）     | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/20211010223838.png) |

3. 抓包抓不到[参考](https://blog.csdn.net/crdzg_Amy/article/details/100084297)

   | 解决1：工具栏 Proxy->Recording settings->include 里面，设置了某个网页域名，除此域名之外都不进行抓包，所以打开是一片空白，因为我进行了过滤 | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202307042115803.png) |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
   | 解决2：系统偏好设置 - 网络 - 高级 - 代理                     | ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202307042114996.png) |

5. 抓包分析知乎API

   > ![](https://raw.githubusercontent.com/jiangsai0502/PicBedRepo/master/img/202307042114885.png)
