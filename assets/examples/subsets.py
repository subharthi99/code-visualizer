def visit(nums, index, path, output):
    if index == len(nums):
        output.append(path.copy())
        return
    visit(nums, index + 1, path, output)
    path.append(nums[index])
    visit(nums, index + 1, path, output)
    path.pop()


path = []
output = []
visit([2, 4], 0, path, output)
print(output)
