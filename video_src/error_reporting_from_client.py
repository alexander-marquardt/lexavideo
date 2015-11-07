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

import webapp2, logging, json

from video_src import constants
from video_src import http_helpers

from video_src.error_handling import handle_exceptions


class FormatInfo(webapp2.RequestHandler):
    
    def format_main_response(self, logging_fn):
        content = json.loads(self.request.body)       
        str_list = ['\n\n\n\n\n' + constants.long_star_separator]

        if logging_fn == logging.error:
            str_list.append('********* Javascript Browser Error *********')
        elif logging_fn == logging.info:
            str_list.append('Javascript Browser Info')
        else:
            raise Exception('Unknown logging_fn: %s' % logging_fn)

        for key, value in content.iteritems():
            string = key + ': ' + str(value)
            string = string.replace('\\t', '\t')
            string = string.replace('\\n', '\n')
            str_list.extend(string.split('\n'))
                
        if 'logMessage' in content:
            # Show the main error message at the very top so that it appears in the log summary on the server.
            str_list.insert(0, str(content['logMessage']))
        elif 'infoUrl' in content:
            str_list.insert(0, str(content['infoUrl']))
        else:
            str_list.insert(0, '\n')
            
            
        str_list.append(constants.long_star_separator)
        return '\n'.join(str_list) + '\n\n\n\n\n'

    def post(self, logging_fn):

        client_error_string = self.format_main_response(logging_fn)
        logging_fn(client_error_string)
        http_helpers.set_http_ok_json_response(self.response, {})


class LogClientError(FormatInfo):

    @handle_exceptions
    def post(self): 
        super(LogClientError, self).post(logging.error)

class LogClientInfo(FormatInfo):

    @handle_exceptions
    def post(self):
        super(LogClientInfo, self).post(logging.info)


