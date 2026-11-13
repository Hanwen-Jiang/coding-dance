# LeetCode 题解

个人刷题记录，题解使用 **Java / Python / Go** 编写，题目均来自 [力扣](https://leetcode.cn/)。

当前收录 **49** 份题解；[热题 100](https://leetcode.cn/studyplan/top-100-liked/) 的 100 道题均有独立的题目文档。

## 目录结构

```
.
├── problems/        # 热题 100 题目文档，一题一份：<编号>.<题名>.md（图片在 problems/images/）
├── solutions/       # 题解代码，按语言分目录：<编号>.<题名>.<后缀>
│   ├── java/
│   ├── python/
│   └── go/
├── illustrations/   # 解题思路图解页面：<编号>.<题名>.html，浏览器直接打开
├── studyplan/
│   ├── 热题100.md        # 做题进度（按专题）
│   └── 优先级清单.md      # 按重要程度排序的待刷清单（暂不含困难题）
├── notes/           # 笔记、提示与不在热题 100 内的题目原文
└── tools/           # 小工具（TreeGraph.py：二叉树可视化）
```

## 题解索引

| # | 题目 | 语言 | 文件 |
| ---: | --- | --- | --- |
| 5 | [最长回文子串](<problems/0005.最长回文子串.md>) | Java | [0005.最长回文子串.java](<solutions/java/0005.最长回文子串.java>) |
| 6 | Z 字形变换 | Java | [0006.Z 字形变换.java](<solutions/java/0006.Z 字形变换.java>) |
| 7 | 整数反转 | Java | [0007.整数反转.java](<solutions/java/0007.整数反转.java>) |
| 10 | 正则表达式匹配 | Java | [0010.正则表达式匹配.java](<solutions/java/0010.正则表达式匹配.java>) |
| 19 | [删除链表的倒数第 N 个结点](<problems/0019.删除链表的倒数第 N 个结点.md>) | Java | [0019.删除链表的倒数第 N 个结点.java](<solutions/java/0019.删除链表的倒数第 N 个结点.java>) |
| 20 | [有效的括号](<problems/0020.有效的括号.md>) | Java | [0020.有效的括号.java](<solutions/java/0020.有效的括号.java>) |
| 21 | [合并两个有序链表](<problems/0021.合并两个有序链表.md>) | Java | [0021.合并两个有序链表.java](<solutions/java/0021.合并两个有序链表.java>) |
| 23 | [合并 K 个升序链表](<problems/0023.合并 K 个升序链表.md>) | Java | [0023.合并 K 个升序链表.java](<solutions/java/0023.合并 K 个升序链表.java>) |
| 24 | [两两交换链表中的节点](<problems/0024.两两交换链表中的节点.md>) | Java | [0024.两两交换链表中的节点.java](<solutions/java/0024.两两交换链表中的节点.java>) |
| 25 | [K 个一组翻转链表](<problems/0025.K 个一组翻转链表.md>) | Java | [0025.K 个一组翻转链表.java](<solutions/java/0025.K 个一组翻转链表.java>) |
| 41 | [缺失的第一个正数](<problems/0041.缺失的第一个正数.md>) | Java | [0041.缺失的第一个正数.java](<solutions/java/0041.缺失的第一个正数.java>) |
| 42 | [接雨水](<problems/0042.接雨水.md>) | Java | [0042.接雨水.java](<solutions/java/0042.接雨水.java>) |
| 48 | [旋转图像](<problems/0048.旋转图像.md>) | Java | [0048.旋转图像.java](<solutions/java/0048.旋转图像.java>) |
| 49 | [字母异位词分组](<problems/0049.字母异位词分组.md>) | Java | [0049.字母异位词分组.java](<solutions/java/0049.字母异位词分组.java>) |
| 53 | [最大子数组和](<problems/0053.最大子数组和.md>) | Java | [0053.最大子数组和.java](<solutions/java/0053.最大子数组和.java>) |
| 54 | [螺旋矩阵](<problems/0054.螺旋矩阵.md>) | Java | [0054.螺旋矩阵.java](<solutions/java/0054.螺旋矩阵.java>) |
| 56 | [合并区间](<problems/0056.合并区间.md>) | Java | [0056.合并区间.java](<solutions/java/0056.合并区间.java>) |
| 73 | [矩阵置零](<problems/0073.矩阵置零.md>) | Java | [0073.矩阵置零.java](<solutions/java/0073.矩阵置零.java>) |
| 76 | [最小覆盖子串](<problems/0076.最小覆盖子串.md>) | Java | [0076.最小覆盖子串.java](<solutions/java/0076.最小覆盖子串.java>) |
| 94 | [二叉树的中序遍历](<problems/0094.二叉树的中序遍历.md>) | Java | [0094.二叉树的中序遍历.java](<solutions/java/0094.二叉树的中序遍历.java>) |
| 101 | [对称二叉树](<problems/0101.对称二叉树.md>) | Java | [0101.对称二叉树.java](<solutions/java/0101.对称二叉树.java>) |
| 102 | [二叉树的层序遍历](<problems/0102.二叉树的层序遍历.md>) | Java | [0102.二叉树的层序遍历.java](<solutions/java/0102.二叉树的层序遍历.java>) |
| 104 | [二叉树的最大深度](<problems/0104.二叉树的最大深度.md>) | Java | [0104.二叉树的最大深度.java](<solutions/java/0104.二叉树的最大深度.java>) |
| 108 | [将有序数组转换为二叉搜索树](<problems/0108.将有序数组转换为二叉搜索树.md>) | Python | [0108.将有序数组转换为二叉搜索树.py](<solutions/python/0108.将有序数组转换为二叉搜索树.py>) |
| 128 | [最长连续序列](<problems/0128.最长连续序列.md>) | Java | [0128.最长连续序列.java](<solutions/java/0128.最长连续序列.java>) |
| 138 | [随机链表的复制](<problems/0138.随机链表的复制.md>) | Java | [0138.随机链表的复制.java](<solutions/java/0138.随机链表的复制.java>) |
| 141 | [环形链表](<problems/0141.环形链表.md>) | Java | [0141.环形链表.java](<solutions/java/0141.环形链表.java>) |
| 142 | [环形链表 II](<problems/0142.环形链表 II.md>) | Java | [0142.环形链表 II.java](<solutions/java/0142.环形链表 II.java>) |
| 146 | [LRU 缓存](<problems/0146.LRU 缓存.md>) | Java | [0146.LRU 缓存.java](<solutions/java/0146.LRU 缓存.java>) |
| 146 | [LRU 缓存](<problems/0146.LRU 缓存.md>) | Python | [0146.LRU 缓存.py](<solutions/python/0146.LRU 缓存.py>) |
| 146 | [LRU 缓存](<problems/0146.LRU 缓存.md>) | Go | [0146.LRU 缓存.go](<solutions/go/0146.LRU 缓存.go>) |
| 148 | [排序链表](<problems/0148.排序链表.md>) | Java | [0148.排序链表.java](<solutions/java/0148.排序链表.java>) |
| 160 | [相交链表](<problems/0160.相交链表.md>) | Java | [0160.相交链表.java](<solutions/java/0160.相交链表.java>) |
| 189 | [轮转数组](<problems/0189.轮转数组.md>) | Java | [0189.轮转数组.java](<solutions/java/0189.轮转数组.java>) |
| 200 | [岛屿数量](<problems/0200.岛屿数量.md>) | Python | [0200.岛屿数量.py](<solutions/python/0200.岛屿数量.py>) |
| 200 | [岛屿数量](<problems/0200.岛屿数量.md>) | Python | [0200.岛屿数量.简洁递归.py](<solutions/python/0200.岛屿数量.简洁递归.py>) |
| 200 | [岛屿数量](<problems/0200.岛屿数量.md>) | Python | [0200.岛屿数量.BFS.py](<solutions/python/0200.岛屿数量.BFS.py>) |
| 206 | [反转链表](<problems/0206.反转链表.md>) | Java | [0206.反转链表.java](<solutions/java/0206.反转链表.java>) |
| 215 | [数组中的第K个最大元素](<problems/0215.数组中的第K个最大元素.md>) | Python | [0215.数组中的第K个最大元素.py](<solutions/python/0215.数组中的第K个最大元素.py>) |
| 215 | [数组中的第K个最大元素](<problems/0215.数组中的第K个最大元素.md>) | Python | [0215.数组中的第K个最大元素.堆.py](<solutions/python/0215.数组中的第K个最大元素.堆.py>) |
| 226 | [翻转二叉树](<problems/0226.翻转二叉树.md>) | Java | [0226.翻转二叉树.java](<solutions/java/0226.翻转二叉树.java>) |
| 234 | [回文链表](<problems/0234.回文链表.md>) | Java | [0234.回文链表.java](<solutions/java/0234.回文链表.java>) |
| 238 | [除自身以外数组的乘积](<problems/0238.除了自身以外数组的乘积.md>) | Java | [0238.除自身以外数组的乘积.java](<solutions/java/0238.除自身以外数组的乘积.java>) |
| 239 | [滑动窗口最大值](<problems/0239.滑动窗口最大值.md>) | Java | [0239.滑动窗口最大值.java](<solutions/java/0239.滑动窗口最大值.java>) |
| 240 | [搜索二维矩阵 II](<problems/0240.搜索二维矩阵 II.md>) | Java | [0240.搜索二维矩阵 II.java](<solutions/java/0240.搜索二维矩阵 II.java>) |
| 283 | [移动零](<problems/0283.移动零.md>) | Java | [0283.移动零.java](<solutions/java/0283.移动零.java>) |
| 438 | [找到字符串中所有字母异位词](<problems/0438.找到字符串中所有字母异位词.md>) | Java | [0438.找到字符串中所有字母异位词.java](<solutions/java/0438.找到字符串中所有字母异位词.java>) |
| 543 | [二叉树的直径](<problems/0543.二叉树的直径.md>) | Java | [0543.二叉树的直径.java](<solutions/java/0543.二叉树的直径.java>) |
| 560 | [和为 K 的子数组](<problems/0560.和为 K 的子数组.md>) | Java | [0560.和为 K 的子数组.java](<solutions/java/0560.和为 K 的子数组.java>) |

## 备注

- 部分 Java 文件含 LeetCode 插件自动生成的本地测试用例，体量较大；解题代码位于 `Submit Code Region` 标记之间。
- 题目文档中的题面文本取自开源仓库 [doocs/leetcode](https://github.com/doocs/leetcode)，版权归力扣所有。
