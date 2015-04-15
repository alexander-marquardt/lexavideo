
"""
This module tracks the presence state of each user. States that may be sent from the client
are ACTIVE, IDLE, and AWAY.

Values that may be returned from this module are ACTIVE, IDLE, AWAY, and OFFLINE(*).

(*) If the client does not send a presence state within
a certain amount of time (eg. a value that is 1.5 * heartbeat_interval_seconds), then the user is
determined to be OFFLINE.
"""

import constants
import datetime
import logging
import pickle

from video_src import status_reporting

from video_src.memcache_wrapper import memcache
from google.appengine.ext import ndb

# For efficiency, we only periodically write the client presence to the database
CLIENT_PRESENCE_MEMCACHE_PREFIX = 'client-presence-'
HEARTBEAT_INTERVAL_TIMEOUT_SECONDS = constants.heartbeat_interval_seconds + constants.leeway_seconds_for_determining_timeout
DATABASE_PRESENCE_UPDATE_INTERVAL_TIMEOUT_SECONDS = constants.db_presence_update_interval_seconds + constants.leeway_seconds_for_determining_timeout

# ClientModel is complementary to UserModel. Each user will only have a single associated UserModel
# but they will have a unique ClientModel object for each unique browser window/channel that they
# connect to the website with.
# Each client model object will be keyed by a unique id that will follow the following format
# str(user_id) + '|' + str(current_time_in_ms)
class ClientModel(ndb.Model):
    # These should be periodically cleared out of the database - use last_write to find and remove
    # old/expired client models.
    # Note: if these are cleared out, they should also be removed from UserTrackClientsModel's client_models_list_of_keys.
    last_db_write = ndb.DateTimeProperty(auto_now=True)

    # most_recent_presence_state should be ACTIVE, IDLE, AWAY, or OFFLINE
    most_recent_presence_state_stored_in_db = ndb.StringProperty(default='ACTIVE')


    def _periodically_store_current_presence_state_to_db(self, presence_state_name):

        if (datetime.datetime.now() - self.last_db_write >
                datetime.timedelta(seconds=constants.db_presence_update_interval_seconds)):

            logging.debug('Storing state %s to database for client_id %s' % (presence_state_name, self.key.id()))
            self.most_recent_presence_state_stored_in_db = presence_state_name
            self.put()


    def _store_current_presence_state_to_memcache(self, presence_state_name):

        client_id = self.key.id()
        client_memcache_key = CLIENT_PRESENCE_MEMCACHE_PREFIX + client_id
        client_memcache_dict = {
            'presence_state_name': presence_state_name,
            'stored_datetime': datetime.datetime.now(),
        }
        logging.debug('Storing presence state %s to memcache key %s' % (presence_state_name, client_memcache_key))
        serialized_dict = pickle.dumps(client_memcache_dict, constants.pickle_protocol)
        memcache.set(client_memcache_key, serialized_dict)


    def _get_current_presence_state_from_memcache(self):
        client_id = self.key.id()
        client_memcache_key = CLIENT_PRESENCE_MEMCACHE_PREFIX + client_id
        serialized_dict = memcache.get(client_memcache_key)
        presence_state_name = None

        if serialized_dict:
            client_memcache_dict = pickle.loads(serialized_dict)
            logging.debug('Pulled presence states %s from memcache key: %s' % (client_memcache_dict['presence_state_name'],
            client_memcache_key))

            # memcache is active, therefore we make sure that the client presence status has been updated recently,
            # otherwise the client will be considered OFFLINE
            if client_memcache_dict['stored_datetime'] + datetime.timedelta(seconds=HEARTBEAT_INTERVAL_TIMEOUT_SECONDS) < datetime.datetime.now():

                logging.debug('Client %s is set to OFFLINE due to timeout' % client_id)
                # Memcache has not been updated within the expected time, therefore the user is considered offline.
                presence_state_name = 'OFFLINE'
            else:
                presence_state_name = client_memcache_dict['presence_state_name']


        return presence_state_name


    # Reading presence from the database should only be done in the case that memcache has failed.
    # This should happen very rarely, and is only a backup.
    # Note that since we write to the database with a much lower frequency than memcache, we must take
    # this into consideration when determining if the client should be considered OFFLINE.
    def _get_current_presence_state_from_database(self):

        try:
            client_id = self.key.id()
            logging.warning('Reading presence state from database for client %s' % self.key.id())

            # Make sure that the value stored in the database was recently written, and if not then
            # the user is considered to be offline
            if (self.last_db_write + datetime.timedelta(seconds=DATABASE_PRESENCE_UPDATE_INTERVAL_TIMEOUT_SECONDS) <
                datetime.datetime.now()):

                logging.debug('Client %s is set to OFFLINE due to timeout' % client_id)
                return 'OFFLINE'

            else:
                return self.most_recent_presence_state_stored_in_db

        except:
            err_message = '_get_current_presence_state_from_database returning OFFLINE due to internal error'
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_message)
            return 'OFFLINE'

    def store_current_presence_state(self, presence_state_name):

        self._periodically_store_current_presence_state_to_db(presence_state_name)
        self._store_current_presence_state_to_memcache(presence_state_name)


    # Get the presence state of the client. Return values
    def get_current_presence_state(self):

        presence_state_name = self._get_current_presence_state_from_memcache()

        # If the presence_state_name is not returned from memcache, then we fallback to checking the last time
        # that it was written to the database.
        if presence_state_name is None:
            presence_state_name = self._get_current_presence_state_from_database()

        assert presence_state_name
        return presence_state_name
