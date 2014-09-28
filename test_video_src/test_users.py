#!/usr/bin/python
import setup_sys_path_for_testing

import unittest

from google.appengine.ext import testbed

from video_src import users


class TestUtils(unittest.TestCase):

    new_lx_user_name = None

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

    def step1(self):
        user_obj = users.create_new_user()
        self.assertIsNotNone(user_obj)
        self.assertEqual(user_obj.user_name, str(user_obj.key.id()))
        self.new_lx_user_name = user_obj.user_name

    def step2(self):
        user_obj = users.get_user(int(self.new_lx_user_name))
        self.assertEqual(user_obj.user_name, str(user_obj.key.id()))

    def step3(self):
        users.delete_user(int(self.new_lx_user_name))
        user_obj = users.get_user(self.new_lx_user_name)
        self.assertIsNone(user_obj)

    def test_one(self):
        self.step1()
        self.step2()
        self.step3()

if __name__ == "__main__":
    unittest.main()
