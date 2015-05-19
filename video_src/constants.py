# -*- coding: utf-8 -*- 

import re

site_name_dot_com = 'chatsurfing.com'
site_name_for_display = 'ChatSurfing'

room_min_chars = 3
room_max_chars = 20
room_max_occupancy = 100 # arbitrarily limit the number of people in a chat room

# When pickling objects, ensure that we use most recent pickling protocol
pickle_protocol = 2

""""
Make sure that unicode characters don't cause crashes.
Try testing the javascript and the server with the following string: Iñtërnâtiônàlizætiøn☃💩

The following characters are reserved with special meaning in the URL, and should not be allowed in room names.
         $&+,/:;=?@"<>#%{}|\^~[]

We also forbid the following characters because they may confuse the server
         '/' (forward slash), \s (blank space),

We also forbid the following characters, just in case we want to use them for internal purposes in the future
         '*', '''

(note that in the regexp below, that '\', '[', ']', '/', '*', and ''' are escaped with '\')
"""     
chat_room_name_invalid_chars_regex = r'$&+,/:;=?@"<>#%{}|\\^~\[\]\/\s\*\''

"""
valid_chat_room_name_regex - The initial caret means that the regexp must match starting at the beginning
of the string. The ending $ means that the regexp must match all the way to the end of the string.
The characters between the '[' and the ']' is the set of characters that we are matching against, however
because the first symbol is '^' this is a negative match, which means that we are matching all characters
not in this set.
The '+' symbol before the '$' means that we must match at least one or more characters
"""
valid_chat_room_name_regex = r'^[^' + chat_room_name_invalid_chars_regex + r']+$'
valid_chat_room_name_regex_compiled = re.compile(valid_chat_room_name_regex)


username_min_chars = 3
username_max_chars = 20
username_invalid_chars_regex = r'$&+,/:;=?@"<>#%|\\^~\s\*\''
valid_username_regex = r'^[^' + chat_room_name_invalid_chars_regex + r']+$'
valid_username_regex_compiled = re.compile(valid_chat_room_name_regex)


star_separator = '*'*20
long_star_separator = '*'*80

password_pepper = u'Pepper:Iñtërnâtiônàlizætiøn'

secret_key = '13f2xi^7170a0a564fc2a26b8ffae123-5a17'
token_session_expiry_days = 30

# The client periodically updates that server with their status, and if a heartbeat is missed then we can
# presume that the user has closed the connection to our website.
heartbeat_interval_seconds = 10 # reduce this speed for production
db_presence_update_interval_seconds = 5 * 60

# when determining if a user is considered offline, we check if they have updated their presence state within an
# expected amount of time (ie. heartbeat_interval_seconds), however, due to the way that javascript works this heartbeat
# is not guaranteed to happen exactly every heartbeat_interval_seconds, but may take a few additional seconds. The
# following variable compensates for this uncertainty.
leeway_seconds_for_determining_timeout = 5

# maximum number of windows (clients) that a user can have open at once
maximum_number_of_client_connections_per_user = 2