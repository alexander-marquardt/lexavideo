# Much of this code is originally from:
# http://blog.abahgat.com/2013/01/07/user-authentication-with-webapp2-on-google-app-engine/

import logging

import webapp2
from webapp2_extras import auth

from . import token_sessions
from video_src import users

def user_required(handler):
    """
      Decorator that checks if there's a user associated with the current session.
      Will also fail if there's no session present.
    """
    def check_login(self, *args, **kwargs):
        auth = self.auth
        if not auth.get_user_by_session():
            self.redirect(self.uri_for('login'), abort=True)
        else:
            return handler(self, *args, **kwargs)

    return check_login

class BaseHandler(webapp2.RequestHandler):
    @webapp2.cached_property
    def auth(self):
        """Shortcut to access the auth instance as a property."""
        return auth.get_auth()


    @webapp2.cached_property
    def user_obj(self):
        """Shortcut to access the current logged in user.

        Fetches information from the persistence layer and
        returns an instance of the underlying model.

        :returns
          The instance of the user model associated to the logged in user.
        """
        user_id = self.session['user_id']
        user_obj = self.user_model.get_by_id(user_id)
        return user_obj

    @webapp2.cached_property
    def user_model(self):
        """Returns the implementation of the user model.

        It is consistent with config['webapp2_extras.auth']['user_model'], if set.
        """
        return self.auth.store.user_model


    # This inserts the session into the request handler ("self"). Note, we use our own custom token-based
    # sessions instead of webapp2 sessions. In order to access the session, classes must inherit from
    # this class (BaseHandler) instead of the standard webapp2.RequestHandler.
    def dispatch(self):

        authorization_header = self.request.headers.environ.get('HTTP_AUTHORIZATION')
        self.session = token_sessions.get_jwt_token_payload(authorization_header)
        logging.info('***** Session data: %s' % self.session)

        if self.session:
            user_id = self.session['user_id']
            user_obj = users.UserModel.get_by_id(user_id)
            assert(user_obj)
        else:
            # Each user will be assigned a user_obj when they access our website
            raise Exception('no user found. Make sure that the user logs in first')

        # Dispatch the request.
        webapp2.RequestHandler.dispatch(self)


