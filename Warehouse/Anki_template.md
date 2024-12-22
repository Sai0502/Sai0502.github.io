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
<meta content="initial-scale=1.0,maximum-scale=1.0,user-scalable=no" name="viewport" />

<div class=bg>
    <div class=bg2>

        {{#阅读/填空正文}}
        <div style="margin:16px 0 0 0"></div>
        <div id="div2" style="display:block">
            <div id="blank" class="section2">
                <div id="secstem" onclick="blockk">
                    <div class="mbooks-highlight-txt">{{阅读/填空正文}}</div>
                </div>
            </div>
        </div>
        {{/阅读/填空正文}}

        <script type="text/javascript">
            divs = document.querySelectorAll('#blank');
            [].forEach.call(divs, function (div) {
                div.innerHTML = div.innerHTML
                    .replace(/(<br>)(<br>)/g, "$1<div class=\"divider\"></div>$2")
                    .replace(/(<div>|<br>)(#)(.*)/g, "");
            });


            function step1() {
                var ele = document.getElementById("secstem");
                var txt = document.getElementById("secstem").innerHTML;
                // 新增：将 加粗 的文本挖空
                txt = txt.replace(/\*\*(.+?)\*\*/g, '<y id="keyy" onclick="switchh(id)">$1<\/y>');
                // 新增：将 #d8b0b0颜色 的文本挖空
                txt = txt.replace(/<font color="#d8b0b0">(.+?)<\/font>/g, '<y id="keyy" onclick="switchh(id)">$1<\/y>');

                txt = txt.replace(/<b>/g, '<y id="keyy" onclick="switchh(id)">');
                txt = txt.replace(/<\/b>/g, "<\/y>");
                txt = txt.replace(/<y.+?\/y>/g, "$&$&");
                ele.innerHTML = txt;
            }

            step1();

            function setn() {
                var i = 1;
                while (/keyy\"/.test(document.getElementById("secstem").innerHTML)) {
                    idd = 'keyy' + String(i);
                    var txt = document.getElementById("secstem").innerHTML.replace(/keyy\"/, idd + '"');
                    document.getElementById("secstem").innerHTML = txt;

                    if (i % 2 == 0) {
                        document.getElementById(idd).setAttribute("class", "hidden");
                    } else {

                        document.getElementById(idd).innerHTML = document.getElementById(idd).innerHTML.replace(/[^\u4e00-\u9fa5、；，。！？：—“”（）《》【】]+?/g, "＿").replace(/[\u4e00-\u9fa5、；，。！？：—“”（）《》【】]+?/g, "＿");

                        document.getElementById(idd).setAttribute("class", "color");
                    }
                    i++;
                }
                return i;
            }

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


                document.getElementById(id).setAttribute("class", "hiddendelay");
                window.setTimeout(
                    function delay() {
                        document.getElementById(id).setAttribute("class", "hidden");
                        document.getElementById(neww).setAttribute("class", "cloze");
                    }, 20);
            }
        </script>
    </div>
</div>
```

