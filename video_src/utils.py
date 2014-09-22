import re

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

