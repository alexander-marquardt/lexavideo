#!/usr/bin/python
from common_imports import *
from StringIO import StringIO
import webapp2

from mock import patch

from video_src import error_handling

exception_string = "This function had an exception foobar!!"


@error_handling.handle_exceptions
def handle_exceptions_wrapped_fn_throws_error():

    #intentionally throw an error so that the handle_exceptions function will be tested
    raise Exception(exception_string)


class WebAppHandler(webapp2.RequestHandler):
    @error_handling.handle_exceptions
    def get(self):
        raise Exception(exception_string)


class TestErrorHandlingHandleExceptions(unittest.TestCase):


    def setUp(self):
        # Note: Once stdout and stderr are switched to StringIO buffers, the logging functions can not not be
        # switched back to write to stdout and stderr. See the following for an explanation:
        # http://stackoverflow.com/questions/25989123/python-stringio-is-not-correctly-capturing-data-from-stderr
        self.saved_stdout = sys.stdout
        self.saved_stderr = sys.stderr
        self.stderr_string_io = StringIO()
        sys.stderr = self.stderr_string_io

    def tearDown(self):
        # This will not restore the logging functions as their output has now "permanently" been directed to
        # the StringIO buffer.
        sys.stdout = self.saved_stdout
        sys.stderr = self.saved_stderr

    def check_basic_strings(self, err_output):
        # Make sure that the following strings are in the output

        self.assertRegexpMatches(err_output, 'Traceback' )
        self.assertRegexpMatches(err_output, 'Exception: %s' % exception_string)
        self.assertRegexpMatches(err_output, 'Call Stack')


    # This simulates a standard function that is wrapped with the handle_expressions wrapper
    #@patch(error_handling.logging)
    def test_one(self):#, mock_logging):

        handle_exceptions_wrapped_fn_throws_error()
        #self.assertTrue(mock_logging.error.called)

        err_output =  self.stderr_string_io.getvalue()
        self.check_basic_strings(err_output)
        self.stderr_string_io.truncate(0) # clear the stderr_string_io buffer


    # This test simulates a method function that is inside a webapp2 RequestHandler object
    def test_two(self):
        def check_webapp_handler():
            app = webapp2.WSGIApplication([('/', WebAppHandler)])
            response = app.get_response('/')
            self.assertRegexpMatches(response.status_message, 'Internal Server Error')
            self.assertRegexpMatches(response.body, 'errorStatusString')
            check_webapp_handler()
            err_output =  self.stderr_string_io.getvalue()
            self.check_basic_strings( err_output)
            self.stderr_string_io.truncate(0) # clear the stderr_string_io buffer

if __name__ == "__main__":
    unittest.main()
