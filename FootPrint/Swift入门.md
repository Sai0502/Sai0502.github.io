### Swift入门

#### 环境配置

> > * 安装Xcode
> >
> > * 安装iOS Simulator
> >
> >   ```bash
> >   # 设置 Xcode 路径	
> >   sudo xcode-select -s /Applications/Xcode.app
> >   # 下载 iOS Simulator
> >   xcodebuild -downloadPlatform iOS
> >   # 查看 iOS Simulator 版本
> >   xcrun simctl runtime list
> >   # 安装 iOS Simulator
> >   xcrun simctl runtime add <path-to-dmg>
> >   ```
> >
> >   
>
> 1. Create New Project... 
>
> 2. Choose a template for your new project：macos -> Command Line Tool
>
> 3. Product Name: Test0613
>
>    Organization ldentifier: WillJiang
>
>    Language: Swift
>
> 4. 左侧main函数

#### 变量

```swift
var Label = "The width is "    // var 声明变量
print(Label)

var Length = "150"
var LabelLength = Label + Length + " cm"    // 字符串拼接
print(LabelLength)

var Width = 94
var LabelWidth = Label + String(Width) + " cm"    // 强制变量转换类型
print(LabelWidth)

var NewLabel = "The width is \(Width) cm."    // 字符串含值
print(NewLabel)
```

#### 数组

```swift
var emptyArray: [String] = []  // 声明空字符串数组
emptyArray.append("First")     // 增
emptyArray.append("Second")
print(emptyArray)

emptyArray.remove(at: 1)     // 删
print(emptyArray)

emptyArray[0] = "Second"    // 改
print(emptyArray)

var shoppingList = ["catfish", "water", "tulips", "blue paint"]    // 声明非空数组
shoppingList[1] = "bottle of water"    // 改
print(shoppingList)
```

#### 字典

```swift
var emptyDictionary: [String: String] = [:]  // 声明空字典，键和值都是 String 类型
emptyDictionary["Jayne"] = "Public Relations"  // 通过下标赋值
print(emptyDictionary)  // 输出字典

var occupations = [    // 声明非空字典
   "Malcolm": "Captain",
   "Kaylee": "Mechanic",
]
occupations["Jayne"] = "Public Relations"    // 有此键则改值，无此键则加值
print(occupations)
```

#### 区间

> Swift没有全开区间，要实现从 a 到 b 的所有值，不包括 a 也不包括 b，那就用 case a+1..<b

```swift
var FirstLoop = 0
for i in 0...3 {     // 闭区间a...b，表示从 a 到 b 的所有值，包括 a 和 b
    FirstLoop += i
}
print(FirstLoop)

var SecondLoop = 0
for i in 0..<3 {     // 半开区间a..<b，表示从 a 到 b 的所有值，包括 a 但不包括 b
    SecondLoop += i
}
print(SecondLoop)


```

#### 控制流

> 条件控制：if、switch
>
> 循环：for-in  、 while 、 repeat-while（即Python的do-while）

##### for-in

```swift
var scores = [75, 43, 103, 87, 12]
for score in scores {
    if score >= 90 {
        print("\(score) is an A")
    } else if score >= 80 {
        print("\(score) is a B")
    } else {
        print("\(score) is Low")
    } 
}
```

##### switch

```swift
var scores = [75, 43, 103, 87, 12, 105, 110]
for score in scores {
    switch score {
    case 110:   // 单个值
        print("\(score) is an A")
    case 103, 105:   // 多个值
        print("\(score) is an A")
    case 90...100:   // 闭区间
        print("\(score) is an A")
    case 80..<90:    // 半开区间
        print("\(score) is a B")
    default:
        print("\(score) is Low")
    }
}
```

##### while

```swift
var scores = [75, 43, 103, 87, 12]
var teamScore = 0
var index = 0
while index < scores.count {
    let score = scores[index]
    if score > 50 {
        teamScore += 3
    } else {
        teamScore += 1
    }
    index += 1
}
print("TeamScore is \(teamScore).")
```

##### repeat-while

```swift
var scores = [75, 43, 103, 87, 12]
var teamScore = 0
var index = 0
repeat {
    let score = scores[index]
    if score > 50 {
        teamScore += 3
    } else {
        teamScore += 1
    }
    index += 1
} while index < scores.count
print("TeamScore is \(teamScore).")
```

#### 嵌套

> 使用 `for-in` 循环遍历字典时，会得到键值对 `(key, value)`。如果用不到键 `key`，可以用 `_` 来忽略它

```swift
let interestingNumbers = [
    "Prime": [2, 3, 5, 7, 11, 13],
    "Fibonacci": [1, 1, 2, 3, 5, 8],
    "Square": [1, 4, 9, 16, 25],
]
var largest = 0
for (_, numbers) in interestingNumbers {  // 使用 _ 忽略键
    for number in numbers {
        if number > largest {
            largest = number
        }
    }
}
print(largest)  // 输出最大值
```

#### 函数

> func 函数名(参数1: 类型, 参数2: 类型) -> 返回值类型 { 
>
> ​        函数体
>
> }

##### 返回1个值

```swift
func greet(name: String, day: String) -> String {
    return "Hello \(name), today is \(day)."
}
var message = greet(name: "Bob", day: "Tuesday")
print(message)
```

##### 返回多个值

> **可选类型**
>
> `nil`：Swift 中函数的返回值可以是未知的，可以有，也可以没有，表示这种模棱两可时用`return nil`
>
> `?`：`?`修饰变量时，可以表示该变量“有值”，也可以表示“没有值”
>
> - `Int?` 表示一个整数，可能有值（如 `3`），也可能没有值（`nil`）
> - `String?` 表示一个字符串，可能有值（如 `"Hello"`），也可能没有值（`nil`）

```swift
func findMinMax(in numbers: [Int]) -> (min: Int, max: Int)? {
    if numbers.isEmpty {
        return nil  // 如果数组为空，返回 nil
    }
    
    var min = numbers[0]
    var max = numbers[0]
    
    for number in numbers {
        if number < min {
            min = number
        }
        if number > max {
            max = number
        }
    }
    
    return (min, max)  // 返回一个元组
}


let numbers = [3, 5, 7, 2, 8, -1, 4, 10, 12]
if let result = findMinMax(in: numbers) {
    print("Minimum: \(result.min), Maximum: \(result.max)")
} else {
    print("The array is empty.")
}
```

```swift
func stringToInt(_ str: String) -> Int? {
    return Int(str)  // 尝试将字符串转换为整数
}

let result1 = stringToInt("123")
let result2 = stringToInt("abc")

if let number = result1 {
    print("成功转换为整数: \(number)")
} else {
    print("转换失败")
}

if let number = result2 {
    print("成功转换为整数: \(number)")
} else {
    print("转换失败")
}
```

```swift
func getValue(from dictionary: [String: String], forKey key: String) -> String? {
    return dictionary[key]  // 尝试从字典中获取键对应的值
}

let dictionary = ["name": "Alice", "age": "30"]

if let name = getValue(from: dictionary, forKey: "name") {
    print("找到名字: \(name)")
} else {
    print("没有找到名字")
}

if let address = getValue(from: dictionary, forKey: "address") {
    print("找到地址: \(address)")
} else {
    print("没有找到地址")
}
```