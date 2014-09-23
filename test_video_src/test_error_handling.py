#!/usr/bin/python
import re
from common_imports import *
from video_src import error_handling

exception_string = "This function had an exception foobar!!"

@error_handling.handle_exceptions
def wrapped_fn_throws_error():
   raise Exception(exception_string)


def test_one(capsys):
    wrapped_fn_throws_error()
    out,err = capsys.readouterr()

    # Just make sure that the following strings are in the output
    assert re.search('Traceback', err) is not None
    assert re.search('Exception: %s' % exception_string,  err) is not None
    assert re.search('Call Stack', err) is not None


def test_two():
    print "running test_two()"
    wrapped_fn_throws_error()

if __name__ == "__main__":
    pytest.main()
