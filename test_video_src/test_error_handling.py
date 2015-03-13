#!/usr/bin/python
import setup_sys_path_for_testing

import unittest

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
        #intentionally throw an error so that the handle_exceptions function will be tested
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


    # # For some strange reason, in the PyCharm debugger, this test will not execute, but in WingIDE and
    # # from the command line it executes properly.
    # @patch('error_handling.logging.debug')
    # @patch('error_handling.logging.error')
    # def test_webapp_handler_errors(self, mock_logging_error, mock_logging_debug):
    #     app = webapp2.WSGIApplication([('/', WebAppHandler)])
    #     response = app.get_response('/')
    #
    #     self.assertRegexpMatches(response.status_message, 'Internal Server Error')
    #     self.assertRegexpMatches(response.body, 'errorStatusString')
    #
    #     self.assertTrue(mock_logging_debug.called)
    #     self.assertTrue(mock_logging_error.called)
    #
    #     try:
    #         debug_called_with = mock_logging_debug.call_args_list[0][0][0]
    #         self.assertRegexpMatches(debug_called_with, 'executing set_http_error_json_response')
    #     except:
    #         self.assertIsNone("Exception while reading call_args_list")
    #
    #     try:
    #         debug_called_with = mock_logging_debug.call_args_list[1][0][0]
    #         self.assertRegexpMatches(debug_called_with, 'executing log_call_stack_and_traceback with extra_info = serverError')
    #     except:
    #         self.assertIsNone("Exception while reading call_args_list")
    #
    #     try:
    #         # Get the argument passed to the most recent (and only) call to logging.error.
    #         error_called_with = mock_logging_error.call_args[0][0]
    #         self.check_stderr_log(error_called_with)
    #     except:
    #         self.assertIsNone("Exception while reading call_args")


if __name__ == "__main__":
    unittest.main()
