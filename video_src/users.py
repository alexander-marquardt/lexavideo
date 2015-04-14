
import logging
import time

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


# ClientModel is complementary to UserModel. Each user will only have a single associated UserModel
# but they will have a unique ClientModel object for each unique browser window/channel that they
# connect to the website with.
# Each client model object will be keyed by a unique id that will follow the following format
# str(user_id) + '|' + str(current_time_in_ms)
class ClientModel(ndb.Model):
    # These should be periodically cleared out of the database - use creation_date to find and remove
    # old/expired client models.
    # Note: if these are cleared out, they should also be removed from UserTrackClientsModel's client_models_list_of_keys.
    creation_date = ndb.DateTimeProperty(auto_now_add=True)


# This model is used for keeping track of which clients (browser window) the user currently has open. Each
# client will be added to the list_of_client_model_keys when it is opened, and will be removed either when
# the user disconnects the page or if that fails, it will be cleared out periodically.
# Note: we have intentionally placed this information outside of the UserModel so that we can modify it
# with a lower probability of transaction collisions.
class UserTrackClientsModel(ndb.Model):
    list_of_client_model_keys = ndb.KeyProperty(kind='ClientModel', repeated=True)


# Track information about what the user is doing right now. For example, what
# rooms are they participating in.
class UserTrackRoomsModel(ndb.Model):
    # Track the chats that the user is currently participating in.
    list_of_open_chat_rooms_keys = ndb.KeyProperty(kind='ChatRoomModel', repeated=True)


# UserModel is accessed from the webapp2 auth module, and is accessed/included with the following
# statements that appear inside the config object that is passed to the wsgi application handler.
#     'webapp2_extras.auth': {
#        'user_model': 'video_src.UserModel',
#    },
#
# This model inherits from the webapp2 models.User and so has additional properties and methods that are
# not shown here.
class UserModel(webapp2_extras.appengine.auth.models.User):

    unique_model = UniqueUserModel

    # This may look strange, but unless the user specifically enters in a user name, then
    # we will assign the entity key as the username. This guarantees that each user name is
    # unique, while being easy to implement.
    user_name = ndb.StringProperty(default=None)

    # We will assign new user entities to each person who visits the page, but only some of these users
    # will actually create a permanent account by registering and by creating their own user name.
    # Other users will be cleared out of the database periodically, and the following flag wehn combined
    # with the creation_date of the user object will allow us to determine which users to remove.
    user_is_registered = ndb.BooleanProperty(default=False)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    # track each "client" (unique browser window) that the user currently has open
    track_clients_key = ndb.KeyProperty(kind='UserTrackClientsModel')

    # Track information about the user activity/status of the user
    track_rooms_key = ndb.KeyProperty(kind='UserTrackRoomsModel')

    """
    Each user can have multiple "clients" (one for each browser/window), and each client can (in the future) have
    multiple rooms open at once. This structure will track which rooms are open by which client, and should
    be removed when the user closes the "client window" or alternatively should be periodically cleared out of the
    database.
    """
    @classmethod
    @ndb.transactional(xg=True)
    def txn_delete_client_model_and_remove_from_client_tracker(cls, user_id, client_id):

        client_obj = ClientModel.get_by_id(client_id)
        client_key = client_obj.key
        client_obj.key.delete()

        user_obj = cls.get_by_id(user_id)
        track_clients_obj = user_obj.track_clients_key.get()
        track_clients_obj.list_of_client_model_keys.remove(client_key)
        track_clients_obj.put



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

    client_tracker = UserTrackClientsModel()
    client_tracker.put()

    user_status_tracker = UserTrackRoomsModel()
    user_status_tracker.put()

    new_user_obj = UserModel()
    new_user_obj.track_clients_key = client_tracker.key
    new_user_obj.track_rooms_key = user_status_tracker.key

    # use the key as the user_name until they decide to create their own user_name.
    new_user_name = "Not set"
    new_user_obj.user_name = str(new_user_name)
    new_user_obj.put()

    logging.info('new user object with user_id %s written' % new_user_obj.key.id())
    return new_user_obj

def get_user_by_name(user_name):
    # queries database for user and returns the user object
    user_obj = UserModel.query(UserModel.user_name == user_name).get()
    return user_obj

def get_user_by_id(user_id):
    user_obj = UserModel.get_by_id(user_id)
    return user_obj

def delete_user_by_id(user_id):
    # removes  particular user from the database
    user_obj = UserModel.get_by_id(user_id)
    user_obj.key.delete()
