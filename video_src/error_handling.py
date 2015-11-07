# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
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


from video_src import http_helpers, status_reporting
import logging, functools, inspect

import webapp2


def handle_exceptions(func):
    # decorator for catching errors in functions.
    # Use by inserting @handle_exceptions before function or method definition
    
    # wrap a method inside a try/except block
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:
            status_string = "serverError"
            request = None
            
            # Check if this is a method on a RequestHandler object, and if so we also write
            # out an error to the http response. 
            # Note: this code is only executed if an error occurs, and therefore we don't worry
            # about the extra "cost" of executing the code below since it should be rarely executed. 
            arg_spec = inspect.getargspec(func)
            if arg_spec.args and arg_spec.args[0] == 'self':
                # if the first parameter is 'self' then it is likely that this is a method on an object
                self = args[0]
                if hasattr(self, '__class__'):
                    # if self has an attrute '__class__' this self is likely a parameter on a method object 
                    # as opposed to a parameter on a function
                    cls = self.__class__
                    if issubclass(cls, webapp2.RequestHandler):
                        # if cls is a subclass of RequestHander, then we are pretty sure that the user is generating http on the 
                        # self.response object
                        if hasattr(self, 'response'):
                            # If self has a 'response' attribute, then write out the error_status to self.response.
                            request = self.request
                            logging.debug('executing set_http_error_json_response self.response=%s and status_string=%s' %
                                         (repr(self.response), status_string))
                            http_helpers.set_http_error_json_response(self.response, status_string, 500)  

            # Log the error to the server, along with stack trace and debugging information
            logging.debug('executing log_call_stack_and_traceback with extra_info = %s' % status_string)
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = status_string, request = request) 

    return wrapper

