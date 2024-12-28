#### Sai问答

```
<meta content="initial-scale=1.0,maximum-scale=1.0,user-scalable=no" name="viewport" />

<div class=bg>
 <div class=bg2>
     {{#问题}}
     <div style="margin:5px 0 0 0"></div>
     <div id="blank" class="section">
         <div class="title">{{问题}}</div>
         <div id="front-tag" style="text-align:left; margin:-5px 12px 0px 6px"></div>
     </div>
     <div style="margin:8px 0 0 0"></div>
     {{/问题}}
     <script type="text/javascript">
         divs = document.querySelectorAll('#blank');
         [].forEach.call(divs, function (div) {
             div.innerHTML = div.innerHTML
                 .replace(/(<br>)(<br>)/g, "$1<div class=\"divider\"></div>$2")
                 .replace(/(<div>|<br>)(#)(.*)/g, "");
         });
     </script>
 </div>
</div>
```

#### Sai填空

**正面**

```html
<!-- 设置移动设备上的显示方式，避免页面缩放，让页面始终以合适的比例显示 -->
<meta content="initial-scale=1.0,maximum-scale=1.0,user-scalable=no" name="viewport" />

<div class=bg>
    <div class=bg2>

        {{#阅读/填空正文}}
        <div style="margin:16px 0 0 0"></div>
        <div id="div2" style="display:block">
            <div id="blank" class="section2">
                <!-- secstem 是一个点击事件容器，里面包含需要填空的内容 -->
                <div id="secstem" onclick="blockk">
                    <!-- mbooks-highlight-txt 类定义了文本的样式 -->
                    <div class="mbooks-highlight-txt">{{阅读/填空正文}}</div>
                </div>
            </div>
        </div>
        {{/阅读/填空正文}}

        <script type="text/javascript">
            // 定位所有 id="blank" 的元素，逐个处理 div ，先替换掉多余的 <br> 标签，插入自定义的分割线，去掉包含 # 的无用标签
            divs = document.querySelectorAll('#blank');
            [].forEach.call(divs, function (div) {
                div.innerHTML = div.innerHTML
                    .replace(/(<br>)(<br>)/g, "$1<div class=\"divider\"></div>$2")
                    .replace(/(<div>|<br>)(#)(.*)/g, "");
            });


            function step1() {
                // 定位所有 id="secstem" 的元素
                var ele = document.getElementById("secstem");
                var txt = document.getElementById("secstem").innerHTML;

// 显示原始 HTML 内容（调试用）
// var debugDiv = document.createElement("div");
// debugDiv.style.border = "1px solid red";
// debugDiv.style.margin = "10px";
// debugDiv.style.padding = "10px";
// debugDiv.style.backgroundColor = "#f8f8f8";
// debugDiv.innerText = "Original HTML: " + txt;
// document.body.appendChild(debugDiv);

                // 将 #d8b0b0颜色 的文本挖空
                // txt = txt.replace(/<font color="#d8b0b0">(.+?)<\/font>/g, '<y id="keyy" onclick="switchh(id)">$1<\/y>');
                txt = txt.replace(/<font color="#990033">(.+?)<\/font>/g, '<y id="keyy" onclick="switchh(id)">$1<\/y>');

                // txt = txt.replace(/<b>/g, '<y id="keyy" onclick="switchh(id)">');
                // txt = txt.replace(/<\/b>/g, "<\/y>");

                // 确保每个 <y> 标签不被错误处理，防止标签合并或丢失
                txt = txt.replace(/<y.+?\/y>/g, "$&$&");
                // 将修改后的文本放回到 secstem 元素中，更新页面内容
                ele.innerHTML = txt;
            }
            // 执行 step1 函数
            step1();

            // 为每个 <y> 标签生成一个唯一的 ID（例如 keyy1、keyy2）。然后把文本中的 keyy 替换成新的 ID，确保每个填空标签都有唯一的标识
            function setn() {
                var i = 1;
                while (/keyy\"/.test(document.getElementById("secstem").innerHTML)) {
                    idd = 'keyy' + String(i);
                    var txt = document.getElementById("secstem").innerHTML.replace(/keyy\"/, idd + '"');
                    document.getElementById("secstem").innerHTML = txt;

                    if (i % 2 == 0) {
                    // 根据编号 i 是偶数，则给 <y> 标签加上 hidden 类，表示该标签初始时是隐藏的
                        document.getElementById(idd).setAttribute("class", "hidden");
                    } else {
                        // 获取指定 id 的元素内容
                        let a = document.getElementById(idd).innerHTML;
                        // 替换所有非中文字符为下划线（＿），但保留 <b> 和 </b>
                        a = a.replace(/<b>|<\/b>/g, ""); // 替换 <b> 和 </b> 为空字符
                        a = a.replace(/[^\u4e00-\u9fa5、；，。！？：—“”（）《》【】]+?/g, "_"); // 替换其他非中文字符为下划线（＿）

                        // 替换所有中文字符为下划线（＿）
                        let b = a.replace(/[\u4e00-\u9fa5、；，。！？：—“”（）《》【】]+?/g, "＿");
                        // 将处理后的内容重新赋值回去
                        document.getElementById(idd).innerHTML = b;
                        // 将处理后的内容重新赋值回去
                        document.getElementById(idd).innerHTML = b;

                        document.getElementById(idd).setAttribute("class", "color");
                    }
                    i++;
                }
                return i;
            }
            // 执行 setn 函数
            var sum = setn();


            function switchh(id) {
                idd = id.replace(/keyy/, "");
                if (Number(idd) % 2 == 1) {
                    idd = Number(idd) + 1;
                    var neww = "keyy" + String(idd);
                } else {
                    idd = Number(idd) - 1;
                    var neww = "keyy" + String(idd);
                }


                // 把当前点击的 <y> 标签的类名设置为 hiddendelay
                document.getElementById(id).setAttribute("class", "hiddendelay");
                // window.setTimeout() 延迟 20 毫秒后，执行一个隐藏和显示操作
                window.setTimeout(
                    function delay() {
                        // 把当前点击的标签彻底隐藏
                        document.getElementById(id).setAttribute("class", "hidden");
                        // 显示对应的另一个状态标签，即答案部分，用户点击后会看到答案
                        document.getElementById(neww).setAttribute("class", "cloze");
                    }, 20);
            }

        </script>
        <div style='font-family: Arial; font-size: 12px;float:left;color:#A2886D'>《{{《》}}》
    </div>
</div>
```

> **文本处理原理**
>
> 使用 `// 显示原始 HTML 内容（调试用）` 可显示转义后的html代码，如
> 
> ```html
><font color="#ff0000">入场条件</font>：<font color="#d8b0b0">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</font>
> ```
>
> 1. `step1()` 
> 
>    > 查找并替换颜色为 `#d8b0b0` 的文本
>    >
>    > ```html
>    > txt = txt.replace(/<font color="#d8b0b0">(.+?)<\/font>/g, '<y id="keyy" onclick="switchh(id)">$1<\/y>');
>    > ```
>    >
>    > * 把所有颜色为 `#d8b0b0` 的文本（即 `高2/低2的 <b>实体/影线</b> 突破信号K的极值点`）用 `<y id="keyy" onclick="switchh(id)">...</y>` 标签包裹起来。
>    > * 这里使用 `y` 标签是为了后续可以通过点击交互来切换填空。
>    >
>    > * 执行完后，文本变成了
>    >
>    >   ```html
>   >   <font color="#ff0000">入场条件</font>：<y id="keyy" onclick="switchh(id)">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</y>
>    >   ```
>
> 2. `setn()` 
>
>    1. 给每个 `<y>` 标签分配唯一 ID
> 
>       > ```
>       > txt = document.getElementById("secstem").innerHTML.replace(/keyy\"/, idd + '"');
>       > ```
>      >
>       > - 假设只有一个 `<y>` 标签，`setn()` 会给它分配一个唯一的 ID，比如 `keyy1`
>
>    2. 控制显示与隐藏
> 
>       > * 如果ID是偶数（如 `keyy2`），则标签开始时会被隐藏
>       >
>       > * 如果ID是奇数（如 `keyy1`），则标签开始时会显示，并且会将其中的中文和非中文字符替换为下划线 `＿`
>       >
>       > * 执行完后，文本变成了
>       >
>       >   ```html
>      >   <font color="#ff0000">入场条件</font>：<y id="keyy1" onclick="switchh(id)">＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</y>
>       >   ```
>
> 3. 点击某个 `<y>` 标签，执行`switchh()` 
>
>    1. 隐藏当前标签
>
>       > * 点击 `keyy1` 标签后，`hiddendelay` 类会被添加到该标签上，该标签变为隐藏状态
>
>    2. 显示下一个标签
>
>       > * 20 毫秒后，`keyy1` 会被完全隐藏，同时对应的下一个标签 `keyy2` 会显示出来
>
>    3. 执行完后，文本变成了
> 
>       ```html
>      <font color="#ff0000">入场条件</font>：<y id="keyy2" class="cloze" onclick="switchh(id)">高2/低2的 实体/影线 突破信号K的极值点</y>
>       ```
>
>       `keyy2` 标签显示了正确答案，原先的下划线替换部分消失，填空题的答案展示出来
>

**反面**

```html
<meta content="initial-scale=1.0,maximum-scale=1.0,user-scalable=no" name="viewport" />

<div class=bg>
    <div class=bg2>
        <div style="margin:16px 0 0 0"></div>
        <div id="div2" style="display:block">
            <div id="blank" class="section2">
                <div class="mbooks-highlight-txt">{{阅读/填空正文}}</div>
            </div>
        </div>
        <div style='font-family: Arial; font-size: 12px;float:left;color:#A2886D'>《{{《》}}》
    </div>
    <script type="text/javascript">
        divs = document.querySelectorAll('#blank');
        [].forEach.call(divs, function (div) {
            div.innerHTML = div.innerHTML
                .replace(/(<br>)(<br>)/g, "$1<div class=\"divider\"></div>$2")
                .replace(/(<div>|<br>)(#)(.*)/g, "");
        });
    </script>
    </div>
</div>
```

样式

```css
<style></style>

<style>
/* --- 正面背面默认字体、字号、对齐、字色、背景色、行高 --- */
    .card {
        margin: 10px;
        font-family: avenir next, helvetica, arial, sans-serif;
        font-size: 20px;
        text-align: left;
        color: #336633;
        background-color: #e9ebee;
        line-height: 128%;
    }
    
    .mbooks-highlight-txt {
        margin: 8px 12px 7px;
        display: block;
        font-size: 0.9em;
        line-height: 165%;
        text-align: left;
    }

    ::-webkit-scrollbar {
        display: none
    }
    body {
        transform: none !important;
    }
    .bg {
        z-index: -1;
        background-image: url(_bg_texture.png);
        background-attachment: fixed;
        position: fixed;
        top: 0px;
        left: 0px;
        bottom: 0px;
        right: 0px;
        width: 100%;
        height: 100%;
        overflow-y: scroll;
        -webkit-overflow-scrolling: touch;
    }
    
    .bg::-webkit-scrollbar {
        display: none;
    }
    
    .bg2 {
        margin: 0.6em 0.65em
    }
    
    .ipad .bg2 {
        margin: 0.6em 0.65em
    }
    
    .android .bg2 {
        margin: 0.6em 0.5em
    }
    
    .hide {
        color: #fff;
    }
    
    .nightMode .hide {
        color: #222;
    }
    
    .hidden {
        display: none
    }
    
    #question span {
        display: inline-block
    }
    /* --------- 字体样式 --------- */
    
    /* --- 背面挖空文字 --- */

    b {
        font-size: 20px;
    }

    
    .cloze {
        /* --- 正面挖空文字颜色 --- */
        color: #990033;
        font-size: 1.05em;
        margin: 0 2px;
        text-decoration: underline;
        font-family: avenir next, kt;
    }
    
    .color {
        /* --- 正面挖空横线颜色 --- */
        color: #D8B0B0;
        font-size: 1.05em;
        text-decoration: underline;
        margin: 0 2px;
        font-family: avenir next, kt;
        display: inline;
        -webkit-animation-name: fadeinn;
        -webkit-animation-duration: 0.03s;
        -webkit-animation-timing-fuction: linear;
    }
    
    .hiddendelay {
        color: #338eca;
        font-size: 1.05em;
        text-decoration: underline;
        margin: 0 2px;
        font-family: avenir next, kt;
        -webkit-animation-name: fadeoutt;
        -webkit-animation-duration: 0.03s;
        -webkit-animation-timing-fuction: linear;
    }
    
    .br {
        display: block;
        content: "";
        border-bottom: 0.6em solid transparent
    }
    
    .divider {
        margin: 5px -6px;
        height: 2px;
        background-color: #ececec
    }
    
    a:link {
        color: #007aff
    }
    
    th,
    tr,
    td {
        border-collapse: collapse;
        border: 1px solid #808080;
    }
    
    #typeans {
        font-size: 0.85em !important
    }
    
    .ios #typeans {
        font-size: 1em !important
    }
    
    @font-face {
        font-family: kt;
        src: url('_kt.ttf');
    }
    
    @font-face {
        font-family: times;
        src: url('_times.ttf');
    }    

   
    .win .section-type {
        display: block
    }
    
    .mac .section-type {
        display: block
    }
        /* --- 正面卡片区域 --- */
    .section2 {
				 /* --- 区域边框粗细 --- */
        border: 1px solid;
				 /* --- 区域边框颜色 --- */
        border-color: #fff;
				 /* --- 区域边框圆角 --- */
        border-radius: 5px;
				 /* --- 区域背景色 --- */
        background-color: rgba(255, 255, 255, 0.85);
				 /* --- 卡内边框与文字的边距 --- */
        padding: 10px 12px;
				 /* --- 以下未知 --- */
        margin: 5px 0;
        line-height: 100%;
        max-width: 828px;
        margin: 0 auto;
        box-shadow: #b7d5eb 2px 2px 5px 1px;
        word-break: break-word;
    }
```



