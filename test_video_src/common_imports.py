
import functools
import os
import sys
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, '/usr/local/google_appengine/')
import dev_appserver
dev_appserver.fix_sys_path()


def stdout_stderr_wrapper(func, *args, **kwargs):

    from StringIO import StringIO

    saved_stdout = sys.stdout
    saved_stderr = sys.stderr

    stderr_string_io = StringIO()
    sys.stderr = stderr_string_io
    stdout_string_io = StringIO()
    sys.stdout = stdout_string_io
    try:
        func(*args, **kwargs)
    finally:
        sys.stdout = saved_stdout
        sys.stderr = saved_stderr

    err_output = stderr_string_io.getvalue()
    std_output = stdout_string_io.getvalue()

    return (std_output, err_output)
