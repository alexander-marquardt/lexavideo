#!/usr/bin/python
import functools
import re
from common_imports import *
from StringIO import StringIO

from video_src import error_handling

exception_string = "This function had an exception foobar!!"

@error_handling.handle_exceptions
def wrapped_fn_throws_error():
   raise Exception(exception_string)

def save_stdout_stderr(func):
    # decorator that ensures that the sys.stdout and sys.stderr is set back to the values they
    # had before the wrapped function was executed
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        saved_stdout = sys.stdout
        saved_stderr = sys.stderr
        try:
            return func(*args, **kwargs)
        finally:
            sys.stdout = saved_stdout
            sys.stderr = saved_stderr

    return wrapper



class TestUtils(unittest.TestCase):

    @save_stdout_stderr
    def test_one(self):

        print "*** running test_one()\n"

        stderr = StringIO()
        sys.stderr = stderr
        wrapped_fn_throws_error()
        output = stderr.getvalue()

        # Make sure that the following strings are in the output
        self.assertRegexpMatches(output, 'Traceback' )
        self.assertRegexpMatches(output, 'Exception: %s' % exception_string)
        self.assertRegexpMatches(output, 'Call Stack')


if __name__ == "__main__":
    unittest.main()
