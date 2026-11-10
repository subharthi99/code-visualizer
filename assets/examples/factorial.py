def factorial(n):
    if n <= 1:
        return 1
    child = factorial(n - 1)
    return n * child


print(factorial(3))
