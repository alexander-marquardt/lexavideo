

import json
import logging
import webapp2

from google.appengine.api import channel
from google.appengine.ext import ndb

from video_src import constants
from video_src import http_helpers
from video_src import messaging
from video_src import room_module
from video_src import status_reporting
from video_src import users
from video_src import video_setup

from error_handling import handle_exceptions



class ClientHeartbeat(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        data_object = json.loads(self.request.body)
        client_id = data_object['clientId']

        client_model = users.ClientModel(id=str(client_id))

        # room_info_obj = room_module.ChatRoomInfo.get_room_by_id(room_id)
        #
        # # check if the user is already in the room, and add them if they are not in the room. Otherwise,
        # # no action is necessary.
        # if not room_info_obj.has_user(user_id):
        #     (room_info_obj, dummy_status_string) = room_module.ChatRoomInfo.txn_add_user_to_room(room_id, user_id)
        #
        #     # Update the other members of the room so they know that this user has joined the room.
        #     send_room_occupancy_to_room_members(room_info_obj, user_id)



class AddClientToRoom(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        data_object = json.loads(self.request.body)
        user_id = data_object['userId']
        client_id = data_object['clientId']
        room_id = data_object['roomId']

        (room_info_obj, dummy_status_string) = room_module.ChatRoomInfo.txn_add_client_to_room(room_id, client_id, user_id)
        messaging.send_room_occupancy_to_room_clients(room_info_obj)



class RequestChannelToken(webapp2.RequestHandler):

    @classmethod
    @ndb.transactional(xg=True)
    def txn_create_new_client_model_and_add_to_user_object(cls, user_id, client_id):
        # Create a new client_model corresponding to the channel that we have just opened for
        # the current user.
        user_obj = users.get_user_by_id(user_id)

        client_model = users.ClientModel(id=client_id)
        client_model.put()

        client_tracker_obj = user_obj.client_tracker_key.get()

        if len(client_tracker_obj.list_of_client_model_keys) > constants.maximum_number_of_client_connections_per_user:
            raise Exception('User has attempted to exceed the maximum number of clients that are simultaneously allowed per user')

        client_tracker_obj.list_of_client_model_keys.append(client_model.key)
        client_tracker_obj.put()


    @handle_exceptions
    def post(self):
        token_timeout = 300  # minutes
        data_object = json.loads(self.request.body)
        client_id = data_object['clientId']
        user_id = data_object['userId']
        channel_token = channel.create_channel(str(client_id), token_timeout)

        try:
            self.txn_create_new_client_model_and_add_to_user_object(user_id, client_id)

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
            for room_info_obj_key in client_obj.list_of_open_rooms_keys:

                video_setup.VideoSetup.remove_video_setup_objects_containing_client_id(client_id)

                room_info_obj = room_info_obj_key.get()

                if room_info_obj.has_client(client_id):

                    room_info_obj = room_module.ChatRoomInfo.txn_remove_client_from_room(room_info_obj.key, client_id)

                    logging.info('Client %s' % client_id + ' removed from room %d state: %s' % (room_info_obj.key.id(), str(room_info_obj)))

                    # The 'active' user has disconnected from the room, so we want to send an update to the remote
                    # user informing them of the new status.
                    messaging.send_room_occupancy_to_room_clients(room_info_obj)

                    users.UserModel.txn_delete_client_model_and_remove_from_client_tracker(user_id, client_id)

                else:
                    logging.error('Room %s (%d) does not have client %s - disconnect failed' % (room_info_obj.chat_room_name, room_info_obj.key.id(), client_id))
