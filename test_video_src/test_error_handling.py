#!/usr/bin/python
import functools
import re
from common_imports import *

from video_src import error_handling

exception_string = "This function had an exception foobar!!"

@error_handling.handle_exceptions
def handle_exceptions_wrapped_fn_throws_error():
   raise Exception(exception_string)



class TestUtils(unittest.TestCase):

    def test_one(self):

        print "*** running test_one()\n"

        (std_output, err_output) = stdout_stderr_wrapper(handle_exceptions_wrapped_fn_throws_error)

        # Make sure that the following strings are in the output
        self.assertRegexpMatches(err_output, 'Traceback' )
        self.assertRegexpMatches(err_output, 'Exception: %s' % exception_string)
        self.assertRegexpMatches(err_output, 'Call Stack')


if __name__ == "__main__":
    unittest.main()
