# -*- coding: utf-8 -*- 

# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import re
import logging

project_name = 'chatsurfing'
site_name_dot_com = 'chatsurfing.com'
site_name_for_display = 'ChatSurfing'

room_min_chars = 3
room_max_chars = 20
room_max_occupancy = 100 # arbitrarily limit the number of people in a chat room

# When pickling objects, ensure that we use most recent pickling protocol
pickle_protocol = 2

""""
Make sure that unicode characters don't cause crashes when entered as a chat room name.
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


default_secret_key_value = 'You must set the secret_key value to something that is unique and secret'
secret_key = default_secret_key_value
# Make sure that the site has set the secret_key to something other than the default.
if secret_key == default_secret_key_value:
    logging.warning('You need to set secret_key in file %s' % __file__)

# The following value is used when connecting to the turn server, and ensures that only our application can
# use our turn server. If this is not set correctly, then other websites may use your turn server which will
# increase your bandwidth costs.
default_turn_shared_secret = 'You must set the turn_shared_secret value to something that is uniqe and secret'
turn_shared_secret = "AlexFromCanada19721234567890ABCDIsXXXTTTTfjgklfdsjgfkldsjkl"
if default_secret_key_value == turn_shared_secret:
    logging.warning('You need to set turn_shared_secret value in %s' % __file__)

# You must enter your own turn servers IP address here. Without a turn server, some WebRTC connections will
# fail to be established.
default_turn_ip = 'XXX.XXX.XXX.XXX'
turn_ip = '34.70.171.46'
if default_turn_ip == turn_ip:
    logging.warning('You should set turn_ip to the IP address of your turn server.')

# The token will expire very quickly, but if the user is still connected (ie. sending heartbeats)
# then the session will be refreshed and given additional time before expiry.
unregistered_user_token_session_expiry_minutes = 5
registered_user_token_session_expiry_days = 365
seconds_before_expiration_to_refresh_token = 60

# The client periodically updates that server with their status, and if a heartbeat is missed then we can
# presume that the user has closed the connection to our website.
heartbeat_interval_seconds = 30 # reduce this speed for production
db_presence_update_interval_seconds = 5 * 60

# when determining if a user is considered offline, we check if they have updated their presence state within an
# expected amount of time (ie. heartbeat_interval_seconds), however, due to the way that javascript works this heartbeat
# is not guaranteed to happen exactly every heartbeat_interval_seconds, but may take a few additional seconds. The
# following variable compensates for this uncertainty.
leeway_seconds_for_determining_timeout = 5


channel_duration_minutes = 60 # This will break if it is ever set to more than 60


# If data is being relayed through the turn server, then we timeout after this number of minutes
turn_relay_timeout_minutes = 60

# Define what locales we support, eg 'en_US', 'es', 'es_ES', etc.)
supported_locales = ('en', 'es')