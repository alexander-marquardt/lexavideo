
"""
This module tracks the presence state of each user. States that may be sent from the client
are ACTIVE, IDLE, and AWAY. Additionally, if the client does not send a presence state within
a certain amount of time (a value that is 1.5 * heartbeatIntervalSeconds), then the user is
determined to be OFFLINE.
"""

from google.appengine.ext import ndb


# ClientModel is complementary to UserModel. Each user will only have a single associated UserModel
# but they will have a unique ClientModel object for each unique browser window/channel that they
# connect to the website with.
# Each client model object will be keyed by a unique id that will follow the following format
# str(user_id) + '|' + str(current_time_in_ms)
class ClientModel(ndb.Model):
    # These should be periodically cleared out of the database - use last_write to find and remove
    # old/expired client models.
    # Note: if these are cleared out, they should also be removed from UserTrackClientsModel's client_models_list_of_keys.
    last_write = ndb.DateTimeProperty(auto_now=True)

    # most_recent_presence_state should be ACTIVE, IDLE, AWAY, or OFFLINE
    most_recent_presence_state = ndb.StringProperty(default='OFFLINE')


    def store_current_presence_state(self):
        pass

    def get_current_presence_state(self):
        pass

