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

import logging, json
from video_src import status_reporting


def set_http_json_response(response,  response_dict, http_status_code):
    response.headers['Content-Type'] = 'application/json'
    response.clear()
    response.write(json.dumps(response_dict))
    response.set_status(http_status_code)    


def set_http_ok_json_response(response, response_dict, http_status_code = 200):
    set_http_json_response(response, response_dict , http_status_code)    
    
    
def set_http_error_json_response(response, status_string, http_status_code=400):
    response_content = {
        'statusString' : status_string
    }    
    set_http_json_response(response, response_content, http_status_code)
    

def set_error_json_response_and_write_log(response, status_string, logging_function, http_status_code, request=None):
    status_reporting.log_call_stack_and_traceback(logging_function, extra_info = status_string, request=request)
    set_http_error_json_response(response, status_string , http_status_code)


def handle_404(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_error_json_response_and_write_log(response,  'handle_404 - Page not found: %s' % request.path, logging.error, 404)


def handle_500(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_error_json_response_and_write_log(response, 'handle_500 - Server error occured. Path: %s' % request.path, logging.error, 500)
        

