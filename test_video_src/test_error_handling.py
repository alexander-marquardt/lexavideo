#!/usr/bin/python
from common_imports import *
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

    def check_stderr_log(self, err_output):
        # Make sure that the following strings are in the output
        # Note: these are not really "error_handling" messages as they come from the status_reporting module.
        # Once we have tests written for status_reporting, these can probably be removed.
        self.assertRegexpMatches(err_output, 'Traceback' )
        self.assertRegexpMatches(err_output, 'Exception: %s' % exception_string)
        self.assertRegexpMatches(err_output, 'Call Stack')

    # This simulates a standard function that is wrapped with the handle_expressions wrapper
    @patch('error_handling.logging.debug')
    @patch('error_handling.logging.error')
    def test_function_errors(self, mock_logging_error , mock_logging_debug):

        handle_exceptions_wrapped_fn_throws_error()

        self.assertTrue(mock_logging_debug.called)
        self.assertTrue(mock_logging_error.called)
        self.check_stderr_log(mock_logging_error.call_args[0][0])


    @patch('error_handling.logging.debug')
    @patch('error_handling.logging.error')
    def test_webapp_handler_errors(self, mock_logging_error, mock_logging_debug):

        app = webapp2.WSGIApplication([('/', WebAppHandler)])
        response = app.get_response('/')

        self.assertRegexpMatches(response.status_message, 'Internal Server Error')
        self.assertRegexpMatches(response.body, 'errorStatusString')

        self.assertTrue(mock_logging_debug.called)
        self.assertTrue(mock_logging_error.called)
        self.check_stderr_log(mock_logging_error.call_args[0])

if __name__ == "__main__":
    unittest.main()
