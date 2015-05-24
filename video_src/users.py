
import time
import datetime

import webapp2_extras.appengine.auth.models
from webapp2_extras import security

from google.appengine.ext import ndb

from video_src import constants


# UniqueUserModel is used for ensuring that UserModel "auth_id" is unique. It also
# keeps track of any other properties that are specified as requiring a unique value
# (perhaps email address or something like that) -- see auth.models.create_user to understand
# how to pass in additional properties that must have unique values.
# Note: we have overloaded the webapp2 version of Unique so that UserModel will be given it's own kind in the
# datastore. 
class UniqueUserModel(webapp2_extras.appengine.auth.models.Unique): pass


# UserModel is accessed from the webapp2 auth module, and is accessed/included with the following
# statements that appear inside the config object that is passed to the wsgi application handler in main.py.
#     'webapp2_extras.auth': {
#        'user_model': 'video_src.UserModel',
#    },
#
# This model inherits from the webapp2 models.User and so has additional properties and methods that are
# not shown here. See the webapp2 models.User to better understand the functionality that this class
# inherits.
class UserModel(webapp2_extras.appengine.auth.models.User):

    unique_model = UniqueUserModel

    # Store the username as the user originall wrote it.
    username_as_written = ndb.StringProperty(default=None)

    # Store the "normalized" (all lowercase) username. This will be used for string comparisons
    # when searching for usernames.
    username_normalized = ndb.StringProperty(default=None)

    # We will assign new user entities to each person who visits the page, but only some of these users
    # will actually create a permanent account by registering and by creating their own user name.
    # Other users will be cleared out of the database periodically, and the following flag when combined
    # with the creation_date of the user object will allow us to determine which users to remove.
    registered_user_bool = ndb.BooleanProperty(default=False)

    creation_datetime = ndb.DateTimeProperty(auto_now_add=True)

    # For non-registered users, we will clear-out their UserModel after it is expired. This will be done fairly
    # quickly so that we can re-allocate their name once they are no longer logged in with it. Additionally,
    # this will allow them to come back on another day, and reuse the same name that they previously used, as long
    # as it has not been taken by someone else.
    # This expiry date should be synchronized with their session expiry so that they are logged out at the same
    # time that their user object expires.
    # Once a user is registered, set the value of this to None, so that it is obvious that it should not be accessed.
    expiration_datetime = ndb.DateTimeProperty()

    @ndb.transactional
    def txn_update_expiration_datetime(self, new_expiration_datetime):
        user_key = self.key
        user_obj = user_key.get()
        user_obj.expiration_datetime=new_expiration_datetime
        user_obj.put()
        return user_obj

    def get_token_expiration_datetime(self):
        # Get the token_expiration_datetime based on if the user is registered or not.
        if self.registered_user_bool:
            token_expiration_datetime = datetime.datetime.utcnow() + datetime.timedelta(days = constants.registered_user_token_session_expiry_days)
        else:
            token_expiration_datetime = datetime.datetime.utcnow() + datetime.timedelta(minutes = constants.unregistered_user_token_session_expiry_minutes)

        return token_expiration_datetime

    # Some of this code is from: http://blog.abahgat.com/2013/01/07/user-authentication-with-webapp2-on-google-app-engine/
    """
    Sets the password for the current user

    :param raw_password:
        The raw password which will be hashed and stored
    """
    def set_password(self, raw_password):
        self.password = security.generate_password_hash(raw_password, method='sha512', pepper=constants.password_pepper)

