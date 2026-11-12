import json
import matplotlib.pyplot as plt
from collections import deque

# =========================
# 1. 二叉树节点
# =========================
class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


# =========================
# 2. 字符串解释器
# =========================
def parse_tree_input(s):
    """
    把这种输入:
    "[4,-7,-3,null,null,-9,-3]"
    解析成 Python 列表:
    [4, -7, -3, None, None, -9, -3]
    """
    try:
        arr = json.loads(s)
    except json.JSONDecodeError as e:
        raise ValueError(f"输入格式错误，无法解析: {e}")

    if not isinstance(arr, list):
        raise ValueError("输入必须是列表格式字符串，例如: \"[1,2,3,null,4]\"")

    return arr


# =========================
# 3. 根据层序数组构建二叉树
# =========================
def build_tree(level_list):
    if not level_list or level_list[0] is None:
        return None

    root = TreeNode(level_list[0])
    queue = deque([root])
    i = 1

    while queue and i < len(level_list):
        node = queue.popleft()

        if i < len(level_list) and level_list[i] is not None:
            node.left = TreeNode(level_list[i])
            queue.append(node.left)
        i += 1

        if i < len(level_list) and level_list[i] is not None:
            node.right = TreeNode(level_list[i])
            queue.append(node.right)
        i += 1

    return root


# =========================
# 4. 分配绘图坐标
# =========================
def assign_positions(root):
    pos = {}
    x_counter = [0]

    def dfs(node, depth):
        if not node:
            return
        dfs(node.left, depth + 1)

        pos[node] = (x_counter[0], -depth)
        x_counter[0] += 1

        dfs(node.right, depth + 1)

    dfs(root, 0)
    return pos


# =========================
# 5. 绘制二叉树
# =========================
def draw_tree(root, figsize=(16, 8), font_size=10):
    if not root:
        print("空树，无法绘制")
        return

    pos = assign_positions(root)

    fig, ax = plt.subplots(figsize=figsize)

    def draw_edges(node):
        if not node:
            return
        x, y = pos[node]

        if node.left:
            lx, ly = pos[node.left]
            ax.plot([x, lx], [y, ly], color='black', linewidth=1.5)
            draw_edges(node.left)

        if node.right:
            rx, ry = pos[node.right]
            ax.plot([x, rx], [y, ry], color='black', linewidth=1.5)
            draw_edges(node.right)

    draw_edges(root)

    for node, (x, y) in pos.items():
        circle = plt.Circle((x, y), 0.35, facecolor='white', edgecolor='black', linewidth=1.5)
        ax.add_patch(circle)
        ax.text(x, y, str(node.val), ha='center', va='center', fontsize=font_size)

    xs = [x for x, y in pos.values()]
    ys = [y for x, y in pos.values()]
    ax.set_xlim(min(xs) - 1, max(xs) + 1)
    ax.set_ylim(min(ys) - 1, max(ys) + 1)

    ax.set_aspect('equal')
    ax.axis('off')
    plt.tight_layout()
    plt.show()


# =========================
# 6. 一步完成：字符串 -> 画树
# =========================
def draw_tree_from_string(s):
    arr = parse_tree_input(s)
    root = build_tree(arr)
    draw_tree(root)


# =========================
# 7. 示例
# =========================
if __name__ == "__main__":
    s = "[4,-7,-3,null,null,-9,-3,9,-7,-4,null,6,null,-6,-6,null,null,0,6,5,null,9,null,null,-1,-4,null,null,null,-2]"
    draw_tree_from_string(s)