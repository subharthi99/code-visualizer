def depth(node):
    if node is None:
        return 0
    left = depth(node[1])
    right = depth(node[2])
    return 1 + max(left, right)


tree = [1, [2, None, None], [3, [4, None, None], None]]
print(depth(tree))
