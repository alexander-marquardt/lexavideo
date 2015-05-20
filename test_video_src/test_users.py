#!/usr/bin/python
import setup_sys_path_for_testing

import unittest

from google.appengine.ext import testbed

from video_src import users


class TestUtils(unittest.TestCase):

    new_lx_username = None

    def setUp(self):
        # First, create an instance of the Testbed class.
        self.testbed = testbed.Testbed()
        # Then activate the testbed, which prepares the service stubs for use.
        self.testbed.activate()
        # Next, declare which service stubs you want to use.
        self.testbed.init_datastore_v3_stub()
        self.testbed.init_memcache_stub()

    def tearDown(self):
        self.testbed.deactivate()
    #
    # def step1(self):
    #     user_obj = users.create_new_user()
    #     self.assertIsNotNone(user_obj)
    #     self.assertEqual(user_obj.username, str(user_obj.key.id()))
    #     self.new_lx_username = user_obj.username

    def step2(self):
        pass

    def test_one(self):
        # self.step1()
        self.step2()

if __name__ == "__main__":
    unittest.main()
