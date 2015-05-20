
import logging
import time

import webapp2_extras.appengine.auth.models
from webapp2_extras import security

from google.appengine.ext import ndb

from video_src import constants
from video_src import clients


# UniqueUserModel is used for ensuring that UserModel "auth_id" is unique. It also
# keeps track of any other properties that are specified as requiring a unique value
# (perhaps email address or something like that) -- see auth.models.create_user to understand
# how to pass in additional properties that must have unique values.
# Note: we have overloaded the webapp2 version of Unique so that UserModel will be given it's own kind in the
# datastore. 
class UniqueUserModel(webapp2_extras.appengine.auth.models.Unique): pass


# UserModel is accessed from the webapp2 auth module, and is accessed/included with the following
# statements that appear inside the config object that is passed to the wsgi application handler.
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
    registered_user = ndb.BooleanProperty(default=False)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    """
    Each user can have multiple "clients" (one for each browser/window), and each client can (in the future) have
    multiple rooms open at once. This structure will track which rooms are open by which client, and should
    be periodically cleared out of the database.
    """
    @classmethod
    @ndb.transactional
    def txn_delete_client_model(cls, client_id):

        client_obj = clients.ClientModel.get_by_id(client_id)
        client_obj.key.delete()


    # Some of this code is from: http://blog.abahgat.com/2013/01/07/user-authentication-with-webapp2-on-google-app-engine/
    """
    Sets the password for the current user

    :param raw_password:
        The raw password which will be hashed and stored
    """
    def set_password(self, raw_password):
        self.password = security.generate_password_hash(raw_password, method='sha512', pepper=constants.password_pepper)


    """
    Return a user object based on a user ID and token.

    :param user_id:
        The user_id of the requesting user.
    :param token:
        The token string to be verified.
    :returns:
        A tuple ``(User, timestamp)``, with a user object and
        the token timestamp, or ``(None, None)`` if both were not found.
    """
    @classmethod
    def get_by_auth_token(cls, user_id, token, subject='auth'):

        token_key = cls.token_model.get_key(user_id, subject, token)
        user_key = ndb.Key(cls, user_id)
        # Use get_multi() to save a RPC call.
        valid_token, user = ndb.get_multi([token_key, user_key])
        if valid_token and user:
            timestamp = int(time.mktime(valid_token.created.timetuple()))
            return user, timestamp

        return None, None

@ndb.transactional(xg=True)
def txn_create_new_user():

    new_user_obj = UserModel()
    # use the key as the username until they decide to create their own username.
    new_username = "Not set"
    new_user_obj.username = str(new_username)
    new_user_obj.put()

    logging.info('new user object with user_id %s written' % new_user_obj.key.id())
    return new_user_obj

def get_user_by_name(username):
    # queries database for user and returns the user object
    user_obj = UserModel.query(UserModel.username == username).get()
    return user_obj

def get_user_by_id(user_id):
    user_obj = UserModel.get_by_id(user_id)
    return user_obj

def delete_user_by_id(user_id):
    # removes  particular user from the database
    user_obj = UserModel.get_by_id(user_id)
    user_obj.key.delete()

