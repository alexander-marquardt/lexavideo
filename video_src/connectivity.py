

import json
import logging
import webapp2

from google.appengine.api import channel
from google.appengine.ext import ndb
from google.appengine.api import taskqueue

from video_src import constants
from video_src import http_helpers
from video_src import messaging
from video_src import chat_room_module
from video_src import status_reporting
from video_src import users
from video_src import video_setup

from error_handling import handle_exceptions



class ClientHeartbeat(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message_obj = json.loads(self.request.body)
        to_client_id = from_client_id = message_obj['fromClientId']
        presence_state = message_obj['messagePayload']['presenceState']

        # Just send a short simple response so that the client can verify if the channel is up.
        response_message_obj = {
            'fromClientId': from_client_id,
            'messageType': 'heartBeatMsg'
        }
        channel.send_message(to_client_id, json.dumps(response_message_obj))

        logging.info('heartbeat of %s received from client_id %s and returned to same client on channel api' % (presence_state, from_client_id))

        # room_info_obj = room_module.ChatRoomInfo.get_room_by_id(room_id)
        #
        # # check if the user is already in the room, and add them if they are not in the room. Otherwise,
        # # no action is necessary.
        # if not room_info_obj.has_user(user_id):
        #     (room_info_obj, dummy_status_string) = room_module.ChatRoomInfo.txn_add_user_to_room(room_id, user_id)
        #
        #     # Update the other members of the room so they know that this user has joined the room.
        #     send_room_occupancy_to_room_members(room_info_obj, user_id)



# The following class handles when a user explicitly enters into a room by going to a URL for a given room.
class AddClientToRoom(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        data_object = json.loads(self.request.body)
        user_id = data_object['userId']
        client_id = data_object['clientId']
        room_id = data_object['roomId']

        logging.info('AddClientToRoom user_id %s added to room_id %s' % (user_id, room_id))
        (room_info_obj, dummy_status_string) = chat_room_module.ChatRoomInfo.txn_add_client_to_room(room_id, client_id, user_id)
        messaging.send_room_occupancy_to_room_clients(room_info_obj)

# The following class defines a handler that is called from the taskqueue, and that updates the rooms to include
# the client_id. Ensures that every client for a given user will have the same rooms open.
# Also is useful for cases where the channel has died, and we wish to ensure that the new client_id
# is placed in all of the rooms that the user has open.
class AddClientToUsersRooms(webapp2.RequestHandler):
    def post(self):

        user_id = self.request.get('user_id')
        client_id = self.request.get('client_id')

        logging.info('AddClientToUsersRooms called for user_id %s' % user_id)

        # Add this "client" in to all of the rooms that the "user" currently has open
        user_obj = users.get_user_by_id(user_id)

        if user_obj:
            list_of_open_rooms_keys = user_obj.user_status_tracker_key.get().list_of_open_rooms_keys
            for open_room_key in list_of_open_rooms_keys:
                room_id = open_room_key.id()

                logging.info('adding client_id %s to room_id %s' % (client_id, room_id))
                (room_info_obj, dummy_status_string) =  chat_room_module.ChatRoomInfo.txn_add_client_to_room(room_id, client_id, user_id)
                messaging.send_room_occupancy_to_room_clients(room_info_obj)
        else:
            # The following happens on the development server. Related to task queue executing before the user object
            # is recognized as being written to the database. Probably will not happen in production.
            logging.warning('user_id %s user object not found.' % user_id)

class RequestChannelToken(webapp2.RequestHandler):

    @classmethod
    @ndb.transactional(xg=True)
    def txn_create_new_client_model_and_add_to_client_tracker_object(cls, user_id, client_id):
        # Create a new client_model corresponding to the channel that we have just opened for
        # the current user.
        user_obj = users.get_user_by_id(user_id)

        client_model = users.ClientModel(id=client_id)
        client_model.put()

        client_tracker_obj = user_obj.client_tracker_key.get()

        if len(client_tracker_obj.list_of_client_model_keys) > constants.maximum_number_of_client_connections_per_user:
            raise Exception('User has attempted to exceed the maximum number of clients that are simultaneously allowed per user')

        if client_model.key not in client_tracker_obj.list_of_client_model_keys:
            client_tracker_obj.list_of_client_model_keys.append(client_model.key)
            client_tracker_obj.put()


    @handle_exceptions
    def post(self):
        token_timeout = 24 * 60 - 1  # minutes
        #token_timeout = 1  # minutes
        data_object = json.loads(self.request.body)
        client_id = data_object['clientId']
        user_id = data_object['userId']
        channel_token = channel.create_channel(str(client_id), token_timeout)

        try:
            self.txn_create_new_client_model_and_add_to_client_tracker_object(user_id, client_id)
            taskqueue.add(url="/taskqueue/add_client_to_users_rooms",
                          params={'client_id': client_id, 'user_id': user_id},
                          retry_options=taskqueue.TaskRetryOptions(task_retry_limit=1, task_age_limit=1))

            response_dict = {
                'channelToken': channel_token,
            }
        except:
            response_dict = {
                'channelToken': None,
            }

            status_string = 'serverError'
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = status_string)

        http_helpers.set_http_ok_json_response(self.response, response_dict)



class ConnectClient(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        # client_id = self.request.get('from')
        # room_id, user_id = [int(n) for n in client_id.split('/')]
        #
        # # Add user to the room. If they have a channel open to the room then they are by definition in the room
        # # This is necessary for the dev server, since the channel disconnects each time that the
        # # client-side javascript is paused. Therefore, it is quite helpful to automatically put the user back in the
        # # room if the user still has a channel open and wishes to connect to the current room.
        # (room_info_obj, dummy_status_string) = room_module.ChatRoomInfo.txn_add_user_to_room(room_id, user_id)
        #
        # send_room_occupancy_to_room_members(room_info_obj, user_id)
        pass




"""
DisconnectClient will be called when the channel dies (for example if the user leaves the page),
and for immediate execution when a user unloads a page in their browser,
we also manually call this disconnect with an onbeforeunload event handler
in the javascript code.
Therefore, it is possible and even likely that this call will be called multiple
times when a user leaves a page - this should therefore idempotent.
"""
class DisconnectClient(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):

        client_id = self.request.get('from')
        user_id, unique_client_postfix = [int(n) for n in client_id.split('|')]

        client_obj = users.ClientModel.get_by_id(client_id)

        if client_obj:
            video_setup.VideoSetup.remove_video_setup_objects_containing_client_id(client_id)


        user_obj = users.UserModel.get_by_id(user_id)
        user_status_tracker_obj = user_obj.user_status_tracker_key.get()

        # We only have a single structure for tracking the chat rooms that the user (user_id) currently has open
        # (as opposed to having a structure for each client_id that the user currently has), however,
        # since we synchronize the clients so that the user is in the same rooms on all clients
        # in general we should expect that every room that the user is currently in
        # for any given client, he will also be in that room for all other clients.
        for room_info_obj_key in user_status_tracker_obj.list_of_open_rooms_keys:
            room_info_obj = room_info_obj_key.get()

            if room_info_obj.has_client(client_id):

                room_info_obj = chat_room_module.ChatRoomInfo.txn_remove_client_from_room(room_info_obj.key, user_id, client_id)

                logging.info('Client %s' % client_id + ' removed from room %d state: %s' % (room_info_obj.key.id(), str(room_info_obj)))

                # The 'active' user has disconnected from the room, so we want to send an update to the remote
                # user informing them of the new status.
                messaging.send_room_occupancy_to_room_clients(room_info_obj)

                users.UserModel.txn_delete_client_model_and_remove_from_client_tracker(user_id, client_id)

            else:
                # This is probably not really an error. Change it later once we understand which conditions can trigger
                # this branch to be executed.
                logging.info('Room %s (%d) does not have client %s - probably already removed' % (room_info_obj.normalized_chat_room_name, room_info_obj.key.id(), client_id))


class AutoDisconnectClient(DisconnectClient):
    def post(self):
        logging.info('Executing AutoDisconnectClient')
        super(AutoDisconnectClient, self).post()

class ManuallyDisconnectClient(DisconnectClient):
    def post(self):
        logging.info('Executing ManuallyDisconnectClient')
        super(ManuallyDisconnectClient, self).post()