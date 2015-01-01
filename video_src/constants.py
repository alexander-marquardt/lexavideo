# -*- coding: utf-8 -*- 

import re

site_name_dot_com = 'chatsurfing.com'
site_name_for_display = 'ChatSurfing'

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
chat_room_name_invalid_chars_regex = r'$&+,/:;=?@"<>#%{}|\\^~\[\]\/\s\*\''
valid_chat_room_name_regex = r'^[^' + chat_room_name_invalid_chars_regex + r']+$'
valid_chat_room_name_regex_compiled = re.compile(valid_chat_room_name_regex)

star_separator = '*'*20
long_star_separator = '*'*80

password_pepper = u'Pepper:Iñtërnâtiônàlizætiøn'

session_settings = {
        'secret_key': 'FooBar123$%^%%%QQQQQQ',
        'cookie_name': 'ChatSurfing',
        'session_max_age': 600,
        'cookie_args': {
            'max_age': 600,
        }
}

cookie_key = '13f2xi^7170a0a564fc2a26b8ffae123-5a17'