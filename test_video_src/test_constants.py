#!/usr/bin/python

from common_imports import *

# For the moment, this is basically just a dummy test module, so don't take it too seriously.
from video_src import constants

class TestConstants(unittest.TestCase):

    def test_one(self):
        self.failIf(constants.room_min_chars != 3)

if __name__ == "__main__":
    unittest.main()

