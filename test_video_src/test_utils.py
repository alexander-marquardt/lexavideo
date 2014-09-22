#!/usr/bin/python

from common_imports import *

from video_src import utils

class TestCamelCaseAndSnakeCaseConversionFunctions(unittest.TestCase):

    def test_one(self):
        input_dict = {'first_outer_key' : 'whatever',
                'second_outer_key' : {
                    'first_inner_key' : 'whatever'
                }}

        new_dict = utils.convert_dict(input_dict, utils.underscore_to_camel)
        self.failIf(not 'firstOuterKey' in new_dict)
        self.failIf(not 'secondOuterKey' in new_dict)
        self.failIf(not 'firstInnerKey' in new_dict['secondOuterKey'])

        old_dict = utils.convert_dict(new_dict, utils.camel_to_underscore)
        self.failIf(not 'first_outer_key' in old_dict)
        self.failIf(not 'second_outer_key' in old_dict)
        self.failIf(not 'first_inner_key' in old_dict['second_outer_key'])


if __name__ == "__main__":
    unittest.main()

