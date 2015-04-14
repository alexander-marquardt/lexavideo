
"""
This module tracks the presence state of each user. States that may be sent from the client
are ACTIVE, IDLE, and AWAY. Additionally, if the client does not send a presence state within
a certain amount of time (a value that is 1.5 * heartbeatIntervalSeconds), then the user is
determined to be OFFLINE.
"""

from google.appengine.ext import ndb


class PresenceTracker(ndb.Model):

    # most_recent_presence_state should be ACTIVE, IDLE, AWAY, or OFFLINE
    most_recent_presence_state = ndb.StringProperty(default='OFFLINE')

    last_write = ndb.DateTimeProperty(auto_now=True)

    def store_current_presence_state(self):
        pass

    def get_current_presence_state(self):
        pass

