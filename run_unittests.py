#!/usr/bin/python

import unittest

TEST_DIR = "./test_video_src/"
TEST_PATTERN = 'test*.py'

suite = unittest.TestLoader().discover(TEST_DIR, TEST_PATTERN)

runner = unittest.TextTestRunner()
runner.run(suite)
