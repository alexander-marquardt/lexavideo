#!/usr/bin/python

from common_imports import *

from video_src import utils

def test_one():
    input_dict = {'first_outer_key' : 'whatever',
            'second_outer_key' : {
                'first_inner_key' : 'whatever'
            }}

    new_dict = utils.convert_dict(input_dict, utils.underscore_to_camel)
    assert 'firstOuterKey' in new_dict
    assert 'secondOuterKey' in new_dict
    assert 'firstInnerKey' in new_dict['secondOuterKey']

    old_dict = utils.convert_dict(new_dict, utils.camel_to_underscore)
    assert 'first_outer_key' in old_dict
    assert 'second_outer_key' in old_dict
    assert 'first_inner_key' in old_dict['second_outer_key']


if __name__ == "__main__":
    pytest.main()

