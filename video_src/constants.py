# -*- coding: utf-8 -*- 

ROOM_MIN_CHARS = 3
ROOM_MAX_CHARS = 80
ROOM_MAX_OCCUPANCY = 2

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
ROOM_NAME_INVALID_CHARS_FOR_REGEX = r'$&+,/:;=?@"<>#%{}|\\^~\[\]\/\s\*\''