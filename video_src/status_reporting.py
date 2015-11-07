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

import sys
import StringIO
import traceback

from video_src import constants

def log_call_stack_and_traceback(logging_function, *args, **kwargs):
    """
    Signal handler to log an exception or error condition for which we want further details
    in the log files. 
    logging_function should be one of the logging.* (ie. logging.error) functions
    """
    
    # get the exception -- however, we also use this function for general error logging
    # and therefore exc_info might return (None, None, None). 
    excinfo = sys.exc_info()
    cls, err = excinfo[:2]
    
    extra_info = ''
    
    if 'stack_limit' in kwargs:
        stack_limit = kwargs['stack_limit']
    else: 
        stack_limit = 5


    # Note that we do not place stars before the initial log output. This is because we want to see the
    # message in the server logs summary on the appengine online logs.
    if err:
        exception_name = cls.__name__
        reason_for_logging = '%s: %s\n%s\n' % (exception_name, err, constants.long_star_separator)
        traceback_info = constants.star_separator + '\nTraceback: ' + \
                         ''.join(traceback.format_exception(*excinfo)) + '\n'
               
    else: 
        reason_for_logging = 'No exception has occured\n' + constants.long_star_separator
        traceback_info = ''


    if 'extra_info' in kwargs:
        extra_info += '\n%s' % kwargs['extra_info'] + '\n'
       
    # we don't need to include the current 'log_call_stack_and_traceback' function in the stack trace. 
    start_frame = sys._getframe(1)
    
    call_stack_info_file = StringIO.StringIO()
    traceback.print_stack(start_frame, limit=stack_limit, file = call_stack_info_file)
    call_stack_info = constants.star_separator + '\nCall Stack: ' + call_stack_info_file.getvalue() + '\n'
    call_stack_info_file.close()

        
    # Check if request information is passed in
    if 'request' in kwargs and kwargs['request'] != None:
        try:
            request = kwargs['request']
            repr_request = constants.star_separator + \
                '\nRequest that triggered traceback and call stack display:\n' +\
                '\tPath: ' + request.path + '\n' + \
                '\tURL: ' + request.url + '\n' + \
                '\tRemote address: ' + request.remote_addr + '\n' + \
                '\tQuery string: ' + request.query_string + '\n' + \
                '\tHeaders: ' + repr(request.headers) + '\n' + \
                '\tBody: ' + request.body + '\n'
        except:
            repr_request = constants.star_separator + '\nlog_call_stack_and_traceback error: "request" not available.\n'
    else:
        repr_request = ''


    end_of_error = constants.star_separator + '\nEnd of error feedback\n' + constants.long_star_separator + '\n\n\n'
    msg = '\n\n\n\n\n' + reason_for_logging + extra_info + traceback_info +call_stack_info + repr_request + end_of_error
    
    logging_function(msg)


