# -*- coding: utf-8 -*- 

import re

site_name = 'VideoconferenceClub'

room_min_chars = 3
room_max_chars = 80
room_max_occupancy = 2

""""
Make sure that unicode characters don't cause crashes.
Try testing the javascript and the server with the following string: Iñtërnâtiônàlizætiøn☃💩

The following characters are reserved with speacial meaning in the URL, and should not be allowed in room names.
         $&+,/:;=?@"<>#%{}|\^~[]

We also forbid the following characters because they may confuse the server
         '/' (forward slash), \s (blank space),

We also forbid the following characters, just in case we want to use them for internal purposes in the future
         '*', '''

(note that in the regexp below, that '\', '[', ']', '/', '*', and ''' are escaped with '\')
"""     
room_name_invalid_chars_regex = r'$&+,/:;=?@"<>#%{}|\\^~\[\]\/\s\*\''
valid_room_name_regex = r'^[^' + room_name_invalid_chars_regex + r']+$'
valid_room_name_regex_compiled = re.compile(valid_room_name_regex)

star_separator = '*'*20
long_star_separator = '*'*80