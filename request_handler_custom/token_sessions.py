__author__ = 'alexandermarquardt'

import datetime
import logging
import time

from google.appengine.ext import ndb

import jwt

from video_src import constants
from video_src import status_reporting


# Keep track of all session tokens that have been issued. We use the key of each TokenSessionModel object
# as a unique identifier that is passed to the client in the payload as a "jti" (JWT ID) value .
# If we wish to revoke access for
# a particular user, we can search the database for all tokens that contain the user_id and remove
# the associated TokenSessionModel object.
class TokenSessionModel(ndb.Model):

    # Track the user_id so that if necessary we can query the database and remove all tokens associated
    # with a given user.
    user_id = ndb.IntegerProperty()

    # Tokens will have an expiry date after which time they are no longer valid. Even though this is also passed
    # to the client, it is necessary to track this value on the server so that we can run cron jobs to
    # clear out expired tokens.
    token_expiry = ndb.DateTimeProperty()


def generate_jwt_token(user_obj):

    user_id = user_obj.key.id()

    token_session_obj = TokenSessionModel()
    token_session_obj.user_id = user_id
    token_session_obj.token_expiry = datetime.datetime.now() + datetime.timedelta(days = constants.token_session_expiry_days)
    token_session_obj.put()

    token_payload = {
        'userId': user_obj.key.id(),
        'usernameAsWritten': user_obj.username_as_written,
        'exp': int(time.mktime((token_session_obj.token_expiry).timetuple())),
        'jti': token_session_obj.key.id(), # jti (JWT ID) is a unique identifier for the token
    }
    jwt_token = jwt.encode(token_payload, constants.secret_key, algorithm='HS256')

    return jwt_token


def get_jwt_token_payload(authorization_header):

    if authorization_header:
        (bearer_txt, split_char, token_string) = authorization_header.partition(' ')

        try:
            try:
                tmp_payload = jwt.decode(token_string, constants.secret_key)

                token_session_id = tmp_payload['jti']
                token_session_obj = TokenSessionModel.get_by_id(token_session_id)

                if (token_session_obj):
                    # This token is stored in the database, and is still valid
                    token_payload = tmp_payload
                else:
                    raise LookupError('Session not found in the database: %s' % tmp_payload)

            except jwt.ExpiredSignatureError:
                tmp_payload = jwt.decode(token_string, constants.secret_key, {'verify_exp': False})
                logging.warning('Token for user_id %s has expired' % tmp_payload['user_id'])
                token_payload = {}

        except:
            # For some reason this token has triggered an error - may require more investigation
            extra_info = "token_string: %s" % token_string
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info=extra_info)
            token_payload = {}
    else:
        token_payload = {}

    return token_payload