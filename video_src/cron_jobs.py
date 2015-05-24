
import datetime
import logging
import time
import webapp2

from google.appengine.ext import ndb
from google.appengine.api import taskqueue

from video_src import http_helpers
from video_src import clients
from video_src import users
from request_handler_custom import token_sessions
from video_src.error_handling import handle_exceptions

NUM_OBJECTS_TO_REMOVE_AT_A_TIME = 100


class CleanupExpiredClients(webapp2.RequestHandler):
    # For registered users, their userobject will never be cleared out of the database. Therefore, we need
    # to periodically search for client models that the user has used in the past, and clear these out.

    def cleanup_expired_clients(self):

        expire_models_last_used_date = datetime.datetime.utcnow() - datetime.timedelta(days=60)
        q = clients.ClientModel.query(clients.ClientModel.last_db_write < expire_models_last_used_date)
        client_obj_keys = q.fetch(NUM_OBJECTS_TO_REMOVE_AT_A_TIME, keys_only=True)

        num_client_objects = len(client_obj_keys)
        ndb.delete_multi(client_obj_keys)
        logging.info('Cleaned up %d expired clients' % num_client_objects)
        return num_client_objects


    @handle_exceptions
    def get(self):
        num_clients_removed = self.cleanup_expired_clients()
        if num_clients_removed >= NUM_OBJECTS_TO_REMOVE_AT_A_TIME:
            time.sleep(5.0) # just in case it takes a few milliseconds for the DB to get updated
            taskqueue.add(queue_name = 'cleanup-sessions-queue', url='/_lx/admin/cleanup_expired_clients/')

        http_helpers.set_http_ok_json_response(self.response, {'CleanupExpiredClients': 'OK'})


class CleanupExpiredUsers(webapp2.RequestHandler):

    def cleanup_expired_clients(self, user_obj_key):
        # When a user object is eliminated, we also remove all of the clients models that were created
        # by that user.

        # expire_models_last_used_date = datetime.datetime.utcnow() - datetime.timedelta(minutes=31)
        q = clients.ClientModel.query(clients.ClientModel.user_obj_key == user_obj_key)
        client_obj_keys = q.fetch(NUM_OBJECTS_TO_REMOVE_AT_A_TIME, keys_only=True)

        num_client_objects = len(client_obj_keys)
        ndb.delete_multi(client_obj_keys)
        logging.info('Cleaned up %d expired clients associated with user %s' % (num_client_objects, user_obj_key.id()))
        return num_client_objects

    def cleanup_expired_auth_ids(self, auth_id_key_name):
        auth_id_obj = users.UniqueUserModel.get_by_id(auth_id_key_name)
        if auth_id_obj:
            auth_id_obj.key.delete()
            logging.info('Cleaned up expired auth_id %s' % auth_id_key_name)
        else:
            logging.warning('Unable to remove auth_id %s' % auth_id_key_name)

    def cleanup_expired_users(self):
        q = users.UserModel.query(users.UserModel.expiration_datetime < datetime.datetime.now())
        user_object_keys = q.fetch(NUM_OBJECTS_TO_REMOVE_AT_A_TIME, keys_only=True)

        for key in user_object_keys:
            self.cleanup_expired_clients(key)
            user_obj = key.get()
            for auth_id in user_obj.auth_ids:
                auth_id_key_name = '%s.auth_id:%s' % (user_obj.__class__.__name__, auth_id)
                self.cleanup_expired_auth_ids(auth_id_key_name)

        num_user_objects = len(user_object_keys)
        ndb.delete_multi(user_object_keys)
        logging.info('Cron: Cleaned up %d expired users' % num_user_objects)
        return num_user_objects

    @handle_exceptions
    def get(self):
        num_user_objects_removed = self.cleanup_expired_users()
        if num_user_objects_removed >= NUM_OBJECTS_TO_REMOVE_AT_A_TIME:
            time.sleep(5.0) # just in case it takes a few milliseconds for the DB to get updated
            taskqueue.add(queue_name = 'cleanup-sessions-queue', url='/_lx/admin/cleanup_expired_users/')

        http_helpers.set_http_ok_json_response(self.response, {'CleanupExpiredUsers': 'OK'})


class CleanupExpiredSessions(webapp2.RequestHandler):

    def cleanup_expired_sessions(self):
        session_keys = token_sessions.TokenSessionModel.query(token_sessions.TokenSessionModel.token_expiration_datetime < datetime.datetime.now())\
            .fetch(NUM_OBJECTS_TO_REMOVE_AT_A_TIME, keys_only=True)
        num_sessions = len(session_keys)
        ndb.delete_multi(session_keys)
        logging.info('Cron: Cleaned up %d expired sessions' % num_sessions)
        return num_sessions

    @handle_exceptions
    def get(self):
        num_sessions_removed = self.cleanup_expired_sessions()
        if num_sessions_removed >= NUM_OBJECTS_TO_REMOVE_AT_A_TIME:
            time.sleep(5.0) # just in case it takes a few milliseconds for the DB to get updated
            taskqueue.add(queue_name = 'cleanup-sessions-queue', url='/_lx/admin/cleanup_expired_sessions/')

        http_helpers.set_http_ok_json_response(self.response, {'CleanupExpiredSessions': 'OK'})

