#!/usr/bin/python

import unittest

from mock import patch

import setup_sys_path_for_testing


# Basically a dummy test module that we use for learning/demonstrating various techniques that we
# use for writing unit tests.
from video_src import testing

class TestUtils(unittest.TestCase):

    @patch('testing.logging.error')
    def test_two(self, mock_logging_error):
        testing.check_if_logging_can_be_mocked()
        self.assertTrue(mock_logging_error.called)

if __name__ == "__main__":
    unittest.main()
