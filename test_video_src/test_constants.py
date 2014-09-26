#!/usr/bin/python
import setup_sys_path_for_testing

import unittest


# Basically a dummy test module since constants don't need much testing.
from video_src import constants

class TestUtils(unittest.TestCase):

    def test_one(self):
        self.assertEqual(constants.room_min_chars, 3)

if __name__ == "__main__":
    unittest.main()
