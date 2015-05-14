
# Much of this code is originally from:
# http://blog.abahgat.com/2013/01/07/user-authentication-with-webapp2-on-google-app-engine/


import jinja2
import json
import logging
import webapp2

from webapp2_extras.auth import InvalidAuthIdError
from webapp2_extras.auth import InvalidPasswordError


import vidsetup

from video_src import http_helpers
from video_src import users

from request_handler_custom import token_sessions
from request_handler_custom.base_handler import BaseHandler
from request_handler_custom.base_handler import user_required

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(vidsetup.BASE_STATIC_DIR),
    undefined=jinja2.StrictUndefined)

class SignupHandler(BaseHandler):
    def get(self):
        self.render_template('signup.html')

    def post(self):
        user_name = self.request.get('user_name')
        email = self.request.get('email')
        name = self.request.get('name')
        password = self.request.get('password')
        last_name = self.request.get('lastname')

        unique_properties = ['email_address']
        user_data = self.user_model.create_user(user_name,
                                                unique_properties,
                                                email_address=email, name=name, password_raw=password,
                                                last_name=last_name, verified=False)
        if not user_data[0]: #user_data is a tuple
            self.display_message('Unable to create user for email %s because of \
        duplicate keys %s' % (user_name, user_data[1]))
            return

        user = user_data[1]
        user_id = user.get_id()

        token = self.user_model.create_signup_token(user_id)

        verification_url = self.uri_for('verification', type='v', user_id=user_id,
                                        signup_token=token, _full=True)

        msg = 'Send an email to user in order to verify their address. \
          They will be able to do so by visiting <a href="{url}">{url}</a>'

        self.display_message(msg.format(url=verification_url))

class ForgotPasswordHandler(BaseHandler):
    def get(self):
        self._serve_page()

    def post(self):
        user_name = self.request.get('user_name')

        user = self.user_model.get_by_auth_id(user_name)
        if not user:
            logging.info('Could not find any user entry for user_name %s', user_name)
            self._serve_page(not_found=True)
            return

        user_id = user.get_id()
        token = self.user_model.create_signup_token(user_id)

        verification_url = self.uri_for('verification', type='p', user_id=user_id,
                                        signup_token=token, _full=True)

        msg = 'Send an email to user in order to reset their password. \
          They will be able to do so by visiting <a href="{url}">{url}</a>'

        self.display_message(msg.format(url=verification_url))

    def _serve_page(self, not_found=False):
        user_name = self.request.get('user_name')
        params = {
            'user_name': user_name,
            'not_found': not_found
        }
        self.render_template('forgot.html', params)


class VerificationHandler(BaseHandler):
    def get(self, *args, **kwargs):
        user = None
        user_id = kwargs['user_id']
        signup_token = kwargs['signup_token']
        verification_type = kwargs['type']

        # it should be something more concise like
        # self.auth.get_user_by_token(user_id, signup_token)
        # unfortunately the auth interface does not (yet) allow to manipulate
        # signup tokens concisely
        user, ts = self.user_model.get_by_auth_token(int(user_id), signup_token,
                                                     'signup')

        if not user:
            logging.info('Could not find any user with id "%s" signup token "%s"',
                         user_id, signup_token)
            self.abort(404)

        # store user data in the session
        self.auth.set_session(self.auth.store.user_to_dict(user), remember=True)

        if verification_type == 'v':
            # remove signup token, we don't want users to come back with an old link
            self.user_model.delete_signup_token(user.get_id(), signup_token)

            if not user.verified:
                user.verified = True
                user.put()

            self.display_message('User email address has been verified.')
            return
        elif verification_type == 'p':
            # supply user to the page
            params = {
                'user': user,
                'token': signup_token
            }
            self.render_template('resetpassword.html', params)
        else:
            logging.info('verification type not supported')
            self.abort(404)

class SetPasswordHandler(BaseHandler):

    @user_required
    def post(self):
        password = self.request.get('password')
        old_token = self.request.get('t')

        if not password or password != self.request.get('confirm_password'):
            self.display_message('passwords do not match')
            return

        user = self.user
        user.set_password(password)
        user.put()

        # remove signup token, we don't want users to come back with an old link
        self.user_model.delete_signup_token(user.get_id(), old_token)

        self.display_message('Password updated')

class LoginHandler(BaseHandler):
    def get(self):
        self._serve_page()

    def post(self):
        username = self.request.get('username')
        password = self.request.get('password')
        try:
            u = self.auth.get_user_by_password(username, password, remember=True,
                                               save_session=True)
            self.redirect(self.uri_for('home'))
        except (InvalidAuthIdError, InvalidPasswordError) as e:
            logging.info('Login failed for user %s because of %s', username, type(e))
            self._serve_page(True)

    def _serve_page(self, failed=False):
        username = self.request.get('username')
        params = {
            'username': username,
            'failed': failed
        }
        self.render_template('login.html', params)



class TempLogin(webapp2.RequestHandler):

    def post(self):

        data_object = json.loads(self.request.body)

        user_name = data_object['user_name']

        # The following line creates the user object and the first parameter will be stored as
        # an auth_id (we currently pass in user_name as auth_id), and we also pass in user_name so that we can easily
        # display the user_name that will be displayed to other users (we can't rely on auth_id because it is a list
        # containing various logins that the user may wish to use - such as email address, user name, perhaps
        # a facebook login token, etc.

        # Not necessary to include user_name in the unique_properties, since it will be included
        # in the "auth_id" in the create_user function, which will ensure that it is unique.
        unique_properties = None
        user_created_bool, user_obj = users.UserModel.create_user(user_name, unique_properties, user_name=user_name)

        if user_created_bool:
            logging.info('New user object created. user_id: %d' % user_obj.key.id())
            # close any active session the user has since he is trying to login
            # if self.session.is_active():
            #     self.session.terminate()
            #
            # # Writing a value to the session causes a new session to be created.
            # self.session['user_id'] = user_obj.key.id()
            #
            # self.redirect(self.uri_for('main'))
            jwt_token = token_sessions.generate_jwt_token(user_obj)
            response_dict = {
                'token': jwt_token,
            }
            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            err_msg = 'Failed to create user_name %s', user_name
            logging.info(err_msg)
            http_helpers.set_http_error_json_response(self.response, err_msg, http_status_code=401)




class LogoutHandler(BaseHandler):
    def get(self):
        self.auth.unset_session()
        self.redirect(self.uri_for('home'))

class AuthenticatedHandler(BaseHandler):
    @user_required
    def get(self):
        self.render_template('authenticated.html')


