# -*- coding: utf-8 -*- 

import re

site_name_dot_com = 'chatsurfing.com'
site_name_for_display = 'ChatSurfing'

room_min_chars = 3
room_max_chars = 20
room_max_occupancy = 100 # arbitrarily limit the number of people in a chat room

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

# The client periodically updates that server with their status, and if a heartbeat is missed then we can
# presume that the user has closed the connection to our website.
heartbeatIntervalSeconds = 10 # reduce this speed for production

# maximum number of windows (clients) that a user can have open at once
maximum_number_of_client_connections_per_user = 2