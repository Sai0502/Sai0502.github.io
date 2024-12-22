Sai问答

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

Sai填空

```
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
    </div>
</div>
```

> 文本处理原理
>
> ```html
> <font color="#ff0000">入场条件</font>：<font color="#d8b0b0">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</font>
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
>    >   <font color="#ff0000">入场条件</font>：<y id="keyy" onclick="switchh(id)">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</y>
>    >   ```
>
> 2. `setn()` 
>
>    1. 给每个 `<y>` 标签分配唯一 ID
>
>       > ```
>       > txt = document.getElementById("secstem").innerHTML.replace(/keyy\"/, idd + '"');
>       > ```
>       >
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
>       >   <font color="#ff0000">入场条件</font>：<y id="keyy1" onclick="switchh(id)">＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</y>
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
>       <font color="#ff0000">入场条件</font>：<y id="keyy2" class="cloze" onclick="switchh(id)">高2/低2的 实体/影线 突破信号K的极值点</y>
>       ```
>
>       `keyy2` 标签显示了正确答案，原先的下划线替换部分消失，填空题的答案展示出来
>
> 
>
> 1. 好的，接下来我将通过一个具体的例子来详细解释这段代码如何处理文本。假设我们有这样一个原始文本：
>
>    ```
>    html
>    
>    
>    复制代码
>    <font color="#ff0000">入场条件</font>：<font color="#d8b0b0">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</font>
>    ```
>
>    这个文本中，我们有 `<font>` 标签和 `<b>` 标签，目标是对其中的特定颜色（`#d8b0b0`）和加粗（`<b>`）标签进行处理，最终渲染出来的效果是根据标签进行填空和交互。下面详细解释这个过程。
>
>    ### 步骤 1: 页面加载后初始化
>
>    1. 页面加载后，浏览器会读取 HTML 内容，并渲染页面。
>
>    2. 假设这段代码会被渲染为：
>
>       ```
>       html
>       
>       
>       复制代码
>       <font color="#ff0000">入场条件</font>：<font color="#d8b0b0">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</font>
>       ```
>
>       其中，红色文本 `<font color="#ff0000">入场条件</font>` 和粉色文本 `<font color="#d8b0b0">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</font>` 被浏览器正确显示。
>
>    ### 步骤 2: `step1()` 函数执行
>
>    当 `step1()` 函数执行时，我们会对文本进行一些修改。具体来说，函数做了以下几件事：
>
>    1. **查找并替换颜色为 `#d8b0b0` 的文本**：
>
>       - `txt = txt.replace(/<font color="#d8b0b0">(.+?)<\/font>/g, '<y id="keyy" onclick="switchh(id)">$1<\/y>');`
>
>       这行代码会把所有颜色为 `#d8b0b0` 的文本（即 `高2/低2的 <b>实体/影线</b> 突破信号K的极值点`）用 `<y id="keyy" onclick="switchh(id)">...</y>` 标签包裹起来。这里使用 `y` 标签是为了后续可以通过点击交互来切换填空。
>
>       执行完后，文本变成了：
>
>       ```
>       html
>       
>       
>       复制代码
>       <font color="#ff0000">入场条件</font>：<y id="keyy" onclick="switchh(id)">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</y>
>       ```
>
>    2. **防止 `<y>` 标签被错误处理**：
>
>       - `txt = txt.replace(/<y.+?\/y>/g, "$&$&");`
>
>       这行代码用于确保在替换过程中，已经包裹在 `<y>` 标签中的文本不会被错误地修改或合并。这一步对 `<y>` 标签进行“安全处理”，确保其内容保持不变。
>
>    3. **更新页面内容**：
>
>       - 最终，处理后的文本会更新回 `secstem` 元素中，形成一个可以交互的文本，页面上显示为：
>
>       ```
>       html
>       
>       
>       复制代码
>       <font color="#ff0000">入场条件</font>：<y id="keyy" onclick="switchh(id)">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</y>
>       ```
>
>    ### 步骤 3: `setn()` 函数执行
>
>    接着，`setn()` 函数会进一步处理 `<y>` 标签，给每个标签分配唯一的 ID，并控制其显示与隐藏：
>
>    1. **给每个 `<y>` 标签分配唯一 ID**：
>
>       - 假设我们只有一个 `<y>` 标签，`setn()` 会给它分配一个唯一的 ID，比如 `keyy1`。所以 `txt = document.getElementById("secstem").innerHTML.replace(/keyy\"/, idd + '"');` 这行代码会将 `keyy` 替换为 `keyy1`。
>
>       最终，页面中的 `<y>` 标签变成：
>
>       ```
>       html
>       
>       
>       复制代码
>       <font color="#ff0000">入场条件</font>：<y id="keyy1" onclick="switchh(id)">高2/低2的 <b>实体/影线</b> 突破信号K的极值点</y>
>       ```
>
>    2. **控制显示与隐藏**：
>
>       - 根据 ID 的奇偶性，如果是偶数（比如 `keyy2`），则标签开始时会被隐藏；如果是奇数（比如 `keyy1`），则标签会显示，并且会将其中的非中文字符（如 `实体/影线` 中的斜杠）替换为下划线 `＿`。
>
>       处理后，文本内容变成了：
>
>       ```
>       html
>       
>       
>       复制代码
>       <font color="#ff0000">入场条件</font>：<y id="keyy1" onclick="switchh(id)">高2/低2的 ＿实体＿影线 ＿ 突破信号K的极值点</y>
>       ```
>
>       这样填空部分会变成下划线，表示填空题的部分。
>
>    ### 步骤 4: 点击 `<y>` 标签时触发 `switchh()` 函数
>
>    当用户点击某个 `<y>` 标签时，`switchh()` 函数会执行：
>
>    1. **隐藏当前标签**：
>
>       - 用户点击 `keyy1` 标签后，它会被隐藏，`hiddendelay` 类会被添加到该标签上，执行后变为隐藏状态。
>
>    2. **显示下一个标签**：
>
>       - 在 20 毫秒后，`keyy1` 会被完全隐藏，同时对应的下一个标签 `keyy2` 会显示出来，用户可以看到答案。
>
>       这时页面内容可能变成：
>
>       ```
>       html
>       
>       
>       复制代码
>       <font color="#ff0000">入场条件</font>：<y id="keyy2" class="cloze" onclick="switchh(id)">高2/低2的 实体/影线 突破信号K的极值点</y>
>       ```
>
>       其中，`keyy2` 标签显示了正确答案，原先的下划线替换部分消失，填空题的答案展示出来。
>
>    ### 总结：
>
>    整个过程是一个从显示带有填空的文本到用户点击交互，逐步揭示答案的过程。具体的步骤包括：
>
>    1. 对 `<font color="#d8b0b0">` 标签中的文本包裹成 `<y>` 标签。
>    2. 将其中的非中文字符替换成下划线表示填空。
>    3. 用户点击填空部分时，切换显示答案。
