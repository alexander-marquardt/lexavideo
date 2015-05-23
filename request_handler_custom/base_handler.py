# Much of this code is originally from:
# http://blog.abahgat.com/2013/01/07/user-authentication-with-webapp2-on-google-app-engine/

import logging
import datetime
import webapp2
from webapp2_extras import auth

from . import token_sessions
from video_src import users
from video_src import constants

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

class EmptyObject(object):
    pass

class BaseHandler(webapp2.RequestHandler):

    def __init__(self, request, response):
        self.session = EmptyObject()
        webapp2.RequestHandler.__init__(self, request, response)

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
        user_id = self.session.user_id
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

        # Get the "now" before the session, so that in the case that the session is not expired,
        # "now" is always <= session expiry. If we were to get "now" after getting the token
        # then this inequality might not be valid in rare cases where the token has just expired
        # within the past few milliseconds.
        now = datetime.datetime.now()

        token_payload, token_session_obj = token_sessions.get_jwt_token_payload_and_token_session_obj(authorization_header)

        if token_payload and token_session_obj:
            # This session is still valid. Continue processing.
            self.session.user_id = token_payload['userId']
            self.session.username_as_written = token_payload['usernameAsWritten']
            logging.info('***** Session data: %s' % self.session)

            user_id = self.session.user_id
            user_obj = users.UserModel.get_by_id(user_id)
            assert(user_obj)

            session_expiry = token_session_obj.token_expiration_datetime

            # The session should not already be expired
            assert(session_expiry >= now)
            if (session_expiry - now <
                    datetime.timedelta(seconds = constants.seconds_before_expiration_to_refresh_token)):
                # The session will expire soon. However, because the client is still connected to the server
                # we grant them an extension on their session.
                token_session_obj.token_expiration_datetime = user_obj.get_token_expiration_datetime()
                logging.warn('**** Session expiration date is being reset to %s' % token_session_obj.token_expiration_datetime)
                token_session_obj.put()

                if not user_obj.registered_user_bool:
                    # only update the token_expiration_datetime on the userobject in the case that this is a non-registered
                    # user. For registered users, this value is irrelevant and should be set to None, as the
                    # user object will never expire (however, note that tokens for registered users will still
                    # have expiry dates).
                    user_obj.txn_update_expiration_datetime(token_session_obj.token_expiration_datetime)


            # Dispatch the request.
            webapp2.RequestHandler.dispatch(self)

        else:
            # This token is expired or invalid. User access denied.
            # Send unauthorized 401 code as an error response.
            logging.info('Invalid or expired token. Request denied. Header: %s' % authorization_header)
            webapp2.RequestHandler.error(self, 401)


