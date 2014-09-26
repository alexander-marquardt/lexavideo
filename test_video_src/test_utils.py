#!/usr/bin/python
import setup_sys_path_for_testing

import unittest


from video_src import utils

class TestUtils(unittest.TestCase):

    def test_one(self):
        input_dict = {'first_outer_key' : 'whatever',
                'second_outer_key' : {
                    'first_inner_key' : 'whatever'
                }}

        new_dict = utils.convert_dict(input_dict, utils.underscore_to_camel)
        self.assertIn('firstOuterKey', new_dict)
        self.assertIn('secondOuterKey', new_dict)
        self.assertIn('firstInnerKey',new_dict['secondOuterKey'])

        old_dict = utils.convert_dict(new_dict, utils.camel_to_underscore)
        self.assertIn('first_outer_key' , old_dict)
        self.assertIn('second_outer_key' , old_dict)
        self.assertIn('first_inner_key' , old_dict['second_outer_key'])


if __name__ == "__main__":
    unittest.main()

