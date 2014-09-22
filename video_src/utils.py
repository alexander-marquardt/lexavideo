

import re
import unittest

# Solution for converting dictionaries between camelCase and snake_case taken from StackOverflow.
# See http://stackoverflow.com/questions/17156078/converting-identifier-naming-between-camelcase-and-underscores-during-json-seria
# For more background, see https://docs.python.org/2/howto/regex.html (look at the "Search and Replace" section).
camel_pat = re.compile(r'([A-Z])')
under_pat = re.compile(r'_([a-z])')

def underscore_to_camel(name):

    # Note:  The replacement function is called for every non-overlapping occurrence of pattern.
    # On each call, the function is passed a match object argument for the match and can use this information to
    # compute the desired replacement string and return it.
    return under_pat.sub(lambda match: match.group(1).upper(), name)

def camel_to_underscore(name):
    return camel_pat.sub(lambda x: '_' + x.group(1).lower(), name)

def convert_dict(input_dict, convert_fn):
    # pass in one of camel_to_underscore or underscore_to_camel as convert_fn.
    new_d = {}
    for k, v in input_dict.iteritems():
        new_d[convert_fn(k)] = convert_dict(v,convert_fn) if isinstance(v, dict) else v
    return new_d


class TestCamelCaseAndSnakeCaseConversionFunctions(unittest.TestCase):

    def test_one(self):
        input_dict = {'first_outer_key' : 'whatever',
                'second_outer_key' : {
                    'first_inner_key' : 'whatever'
                }}

        new_dict = convert_dict(input_dict, underscore_to_camel)
        self.failIf(not 'firstOuterKey' in new_dict)
        self.failIf(not 'secondOuterKey' in new_dict)
        self.failIf(not 'firstInnerKey' in new_dict['secondOuterKey'])

        old_dict = convert_dict(new_dict, camel_to_underscore)
        self.failIf(not 'first_outer_key' in old_dict)
        self.failIf(not 'second_outer_key' in old_dict)
        self.failIf(not 'first_inner_key' in old_dict['second_outer_key'])

if __name__ == "__main__":
    unittest.main()