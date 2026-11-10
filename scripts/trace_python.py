"""Trace small, trusted study programs. This process is not a security sandbox."""
import ast
import builtins
import dis
import hashlib
import json
import math
import signal
import sys
import types


class TraceLimit(Exception):
    pass


ALLOWED = {
    'Module', 'FunctionDef', 'arguments', 'arg', 'Return', 'Assign', 'AugAssign',
    'Expr', 'If', 'For', 'While', 'Break', 'Continue', 'Pass', 'Try', 'ExceptHandler',
    'Raise', 'Assert', 'Name', 'Load', 'Store', 'Constant', 'List', 'Tuple', 'Dict',
    'Set', 'Subscript', 'Slice', 'Call', 'keyword', 'Attribute', 'BinOp', 'UnaryOp',
    'BoolOp', 'Compare', 'IfExp', 'Add', 'Sub', 'Mult', 'Div', 'FloorDiv', 'Mod',
    'USub', 'UAdd', 'Not', 'And', 'Or', 'Eq', 'NotEq', 'Lt', 'LtE', 'Gt', 'GtE',
    'Is', 'IsNot', 'In', 'NotIn',
}
METHODS = {'append', 'pop', 'copy', 'extend', 'insert', 'remove', 'reverse',
           'sort', 'get', 'keys', 'values', 'items', 'add', 'discard'}
BUILTINS = ('range', 'len', 'min', 'max', 'sum', 'abs', 'enumerate', 'sorted',
            'list', 'dict', 'tuple', 'set', 'bool', 'int', 'str', 'zip',
            'Exception', 'ValueError', 'TypeError', 'IndexError', 'KeyError',
            'ZeroDivisionError', 'RuntimeError')


def trace_program(request):
    source = request.get('source')
    result = {'version': 1, 'engine': 'cpython-settrace-v1',
              'python': sys.version.split()[0], 'source': source,
              'status': 'error', 'message': '', 'stdout': '', 'events': []}
    frames, stack, objects, identities = {}, [], [], {}
    byte_count = 0
    limit_reason = None

    def stop(message):
        nonlocal limit_reason
        limit_reason = limit_reason or message
        raise TraceLimit(message)
    max_events = request.get('maxEvents', 1000)
    if type(max_events) is not int or not 1 <= max_events <= 1000:
        result['message'] = 'Use 1–1000 events.'
        return result

    def capture_print(*values, sep=' ', end='\n'):
        output = sep.join(str(value) for value in values) + end
        if len(result['stdout']) + len(output) > 8000:
            stop('Output limit: 8000 characters.')
        result['stdout'] += output

    def snapshot(extra=None):
        heap = {}

        def encode(value):
            if value is None or type(value) is bool:
                return value
            if type(value) is int:
                return value if abs(value) <= 9007199254740991 else {'integer': str(value)}
            if type(value) is float and math.isfinite(value):
                return value
            if type(value) is str:
                if len(value) > 1000:
                    stop('Value limit: strings may contain at most 1000 characters.')
                return value
            if type(value) not in (list, tuple, dict, set):
                stop('Unsupported value: ' + type(value).__name__)
            if len(value) > 50:
                stop('Value limit: collections may contain at most 50 entries.')
            identity = id(value)
            if identity not in identities:
                if len(objects) >= 256:
                    stop('Object limit: 256 identities per run.')
                identities[identity] = 'o' + str(len(objects) + 1)
                objects.append(value)  # Keep identities alive; do not allow id reuse.
            ref = identities[identity]
            if ref not in heap:
                heap[ref] = {'type': type(value).__name__, 'items': []}
                heap[ref]['items'] = ([[encode(k), encode(v)] for k, v in value.items()]
                                      if type(value) is dict else [encode(v) for v in value])
            return {'ref': ref}

        captured = []
        for i, frame_id in enumerate(stack):
            frame = frames[frame_id]
            if len(frame.f_locals) > 200:
                stop('Local variable limit: 200 per frame.')
            locals_now = {name: encode(value) for name, value in frame.f_locals.items()
                          if not name.startswith('__') and not isinstance(value, types.FunctionType)}
            captured.append({'id': frame_id, 'parentId': stack[i - 1] if i else None,
                             'function': frame.f_code.co_name, 'line': max(1, frame.f_lineno),
                             'status': 'active' if i == len(stack) - 1 else 'suspended',
                             'locals': locals_now})
        return captured, heap, encode(extra)

    def trace(frame, event, arg):
        nonlocal byte_count
        if frame.f_code.co_filename != '<study>' or event not in ('call', 'line', 'return', 'exception'):
            return trace
        if len(result['events']) >= max_events:
            stop('Event limit reached; trace is incomplete.')
        if event == 'call':
            if len(stack) >= 50:
                stop('Call depth limit: 50 frames.')
            frame_id = 'f' + str(len(frames) + 1)
            frames[frame_id] = frame
            stack.append(frame_id)
        frame_id = stack[-1]
        # A finally block also emits line events while an exception unwinds.
        # Inspect the terminating opcode rather than treating any line as a catch.
        returning = dis.opname[frame.f_code.co_code[frame.f_lasti]] in ('RETURN_VALUE', 'RETURN_CONST')
        kind = 'unwind' if event == 'return' and not returning else event
        captured, heap, value = snapshot(arg if kind == 'return' else None)
        if event == 'return':
            captured[-1]['status'] = 'raised' if kind == 'unwind' else 'returned'
        entry = {'id': len(result['events']) + 1, 'kind': kind, 'frameId': frame_id,
                 'parentId': captured[-1]['parentId'], 'function': frame.f_code.co_name,
                 'line': max(1, frame.f_lineno), 'frames': captured, 'heap': heap}
        if kind == 'return':
            entry['value'] = value
        if kind == 'exception':
            entry['exception'] = {'type': arg[0].__name__, 'message': str(arg[1])[:1000]}
        byte_count += len(json.dumps(entry, ensure_ascii=True))
        if byte_count > 3_000_000:
            stop('Serialized trace limit: 3 MB of events.')
        result['events'].append(entry)
        if event == 'return':
            stack.pop()
        return trace

    def deadline(signum, frame):
        stop('Time limit: 3 seconds; trace is incomplete.')

    try:
        if not isinstance(source, str) or not source.strip() or len(source) > 20000:
            raise ValueError('Use a non-empty Python program up to 20,000 characters.')
        result['sourceHash'] = hashlib.sha256(source.encode()).hexdigest()
        tree = ast.parse(source, filename='<study>')
        for node in ast.walk(tree):
            if type(node).__name__ not in ALLOWED:
                raise ValueError('Unsupported syntax: ' + type(node).__name__)
            if isinstance(node, (ast.Name, ast.arg, ast.FunctionDef)):
                name = node.id if isinstance(node, ast.Name) else node.arg if isinstance(node, ast.arg) else node.name
                if name.startswith('__'):
                    raise ValueError('Unsupported double-underscore name.')
            if isinstance(node, ast.Attribute) and node.attr not in METHODS:
                raise ValueError('Unsupported attribute: ' + node.attr)
            if isinstance(node, ast.FunctionDef) and node.decorator_list:
                raise ValueError('Unsupported function decorators.')
        namespace = {'__builtins__': {name: getattr(builtins, name) for name in BUILTINS}}
        namespace['__builtins__']['print'] = capture_print
        code = compile(tree, '<study>', 'exec')
        signal.signal(signal.SIGALRM, deadline)
        signal.setitimer(signal.ITIMER_REAL, 3)
        sys.settrace(trace)
        exec(code, namespace)
        if limit_reason or sys.gettrace() is not trace:
            stop(limit_reason or 'Tracing stopped before completion.')
        result['status'] = 'complete'
    except TraceLimit as error:
        result['status'], result['message'] = 'limited', str(error)
    except BaseException as error:
        result['message'] = type(error).__name__ + ': ' + str(error)[:1000]
    finally:
        sys.settrace(None)
        signal.setitimer(signal.ITIMER_REAL, 0)
    return result


if __name__ == '__main__':
    # Bound native allocations too. Supported on the documented macOS/Linux CLI.
    import resource
    resource.setrlimit(resource.RLIMIT_CPU, (4, 4))
    if sys.platform.startswith('linux'):
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    try:
        request = json.loads(sys.stdin.read(100000))
        if not isinstance(request, dict):
            raise ValueError('Expected a JSON request object.')
        print(json.dumps(trace_program(request), ensure_ascii=True, allow_nan=False))
    except (ValueError, TypeError) as error:
        print(json.dumps({'error': str(error)}))
        sys.exit(1)
