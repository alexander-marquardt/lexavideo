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

# Much of this code is originally from:
# http://blog.abahgat.com/2013/01/07/user-authentication-with-webapp2-on-google-app-engine/


import datetime
import jinja2
import json
import logging
import webapp2

from video_src import constants
from video_src import status_reporting
from video_src.error_handling import handle_exceptions

# from webapp2_extras.auth import InvalidAuthIdError
# from webapp2_extras.auth import InvalidPasswordError


import build_config

from video_src import http_helpers
from video_src import users

from request_handler_custom import token_sessions
from request_handler_custom.base_handler import BaseHandlerClientVerified
from request_handler_custom.base_handler import user_required

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(build_config.BASE_STATIC_DIR),
    undefined=jinja2.StrictUndefined)



class CheckIfUsernameAvailable(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, username_from_url=None):
        username_from_url = username_from_url.decode('utf8')
        username_normalized = username_from_url.lower()

        if username_normalized:
            logging.info('Query for username: ' + username_normalized)
            user_obj = users.UserModel.query(users.UserModel.username_normalized == username_normalized).get()

            if user_obj:
                response_dict = {
                    'usernameNormalized': username_normalized,
                    'usernameAvailable': False,
                }
                logging.info('Username taken: ' + repr(user_obj))

            else:
                response_dict = {
                    'usernameNormalized': username_normalized,
                    'usernameAvailable': True,
                }
                logging.info('Username is available: ' + username_normalized)

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            err_status = 'ErrorUsernameRequired'
            # log this error for further analysis
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_status)
            http_helpers.set_http_error_json_response(self.response, err_status)


class LoginUser(webapp2.RequestHandler):

    def post(self):

        data_object = json.loads(self.request.body)

        username_as_written = data_object['usernameAsWritten']
        username_normalized = username_as_written.lower()

        auth_id = 'username:' + username_normalized
        # The following line creates the user object and the first parameter will be stored as
        # an auth_id (we currently pass in username as auth_id), and we also pass in username so that we can easily
        # display the username that will be displayed to other users (we can't rely on auth_id because it is a list
        # containing various logins that the user may wish to use - such as email address, user name, perhaps
        # a facebook login token, etc.

        # Not necessary to include username in the unique_properties, since it will be included
        # in the "auth_id" in the create_user function, which will ensure that it is unique.
        unique_properties = None
        expiration_datetime = datetime.datetime.utcnow() + datetime.timedelta(minutes=constants.unregistered_user_token_session_expiry_minutes)
        user_created_bool, user_obj = users.UserModel.create_user(auth_id, unique_properties,
                                                                  username_normalized=username_normalized,
                                                                  username_as_written=username_as_written,
                                                                  registered_user_bool=False,
                                                                  expiration_datetime=expiration_datetime)

        if user_created_bool:
            user_id = user_obj.key.id()
            logging.info('New user object created. user_id: %d' % user_id)
            # close any active session the user has since he is trying to login
            # if self.session.is_active():
            #     self.session.terminate()
            #
            # # Writing a value to the session causes a new session to be created.
            # self.session.user_id = user_obj.key.id()
            #
            # self.redirect(self.uri_for('main'))
            jwt_token = token_sessions.generate_jwt_token(user_obj.key.id(), user_obj.username_as_written, expiration_datetime)
            response_dict = {
                'token': jwt_token,
            }
            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            err_msg = 'Failed to create username %s', username_normalized
            logging.error(err_msg)
            http_helpers.set_http_error_json_response(self.response, err_msg, http_status_code=403)

class LogoutHandler(BaseHandlerClientVerified):
    def get(self):
        self.auth.unset_session()
        self.redirect(self.uri_for('home'))

class AuthenticatedHandler(BaseHandlerClientVerified):
    @user_required
    def get(self):
        self.render_template('authenticated.html')


