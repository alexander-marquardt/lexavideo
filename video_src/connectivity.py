

import json
import logging
import webapp2

from google.appengine.api import channel
from google.appengine.ext import ndb

from video_src import clients
from video_src import constants
from video_src import http_helpers
from video_src import messaging
from video_src import chat_room_module
from video_src import status_reporting
from video_src import users
from video_src import video_setup

from error_handling import handle_exceptions



# The following class handles when a user explicitly enters into a room by going to a URL for a given room.
class AddClientToRoom(webapp2.RequestHandler):

    @staticmethod
    def add_client_to_room(client_id, room_id, user_id):
        logging.info('add_client_to_room client_id %s added to room_id %s' % (client_id, room_id))
        chat_room_module.ChatRoomModel.txn_add_client_to_room(room_id, client_id)
        chat_room_obj = chat_room_module.ChatRoomModel.txn_add_room_to_user_status_tracker(room_id, user_id)
        messaging.send_room_occupancy_to_room_clients(chat_room_obj)

    # add_client_to_all_users_rooms is useful for cases where the channel has died, and we wish to ensure that the new client_id
    # associated with a user is placed in all of the rooms that the user has open once the client re-joins the room.
    @staticmethod
    def add_client_to_all_users_rooms(client_id, user_id):

        logging.info('add_client_to_all_users_rooms called for user_id %s' % user_id)

        # Add this "client" in to all of the rooms that the "user" currently has open
        user_obj = users.get_user_by_id(user_id)

        if user_obj:
            list_of_open_chat_rooms_keys = user_obj.track_rooms_key.get().list_of_open_chat_rooms_keys

            # Loop over all rooms that the user currently has open.
            for open_room_key in list_of_open_chat_rooms_keys:
                room_id = open_room_key.id()
                chat_room_obj = chat_room_module.ChatRoomModel.get_room_by_id(room_id)
                room_members_client_ids = chat_room_obj.room_members_client_ids

                # Only add the client to the room if the client is not already in the room (Note: this
                # is also verified inside the transaction, but we don't want to tie-up the transaction
                # with un-necessary calls)
                if client_id not in room_members_client_ids:
                    AddClientToRoom.add_client_to_room(client_id, room_id, user_id)

                    message_obj = {
                        'fromClientId': client_id,
                        'chatRoomId': room_id,
                        'messageType': 'clientReAddedToRoomAfterAbsence',
                        'messagePayload': {},
                        }
                    channel.send_message(client_id, json.dumps(message_obj))

        else:
            status_string = 'user_id %s user object not found.' % user_id
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = status_string)



    @handle_exceptions
    def post(self):
        data_object = json.loads(self.request.body)
        user_id = data_object['userId']
        client_id = data_object['clientId']
        room_id = data_object['chatRoomId']

        self.add_client_to_room(client_id, room_id, user_id)


# Receives a "synchronization heartbeat" from the client, which we respond to on the channel.
class SynClientHeartbeat(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message_obj = json.loads(self.request.body)
        client_id = message_obj['clientId']

        # Just send a short simple response so that the client can verify if the channel is up.
        response_message_obj = {
            'fromClientId': client_id, # channel-services expects fromClientId to be specified.
            'messageType': 'synAckHeartBeat' # use handshaking terminology for naming
        }
        logging.info('Heartbeat synchronization received from client_id %s. '
                     'Synchronization acknowledgement returned to same client on channel api' % (client_id))
        channel.send_message(client_id, json.dumps(response_message_obj))


# Receives an acknowledgement to the response that we sent to the client on the channel. If we receive a post
# to this URL, then we know that the channel is currently functioning.
class AckClientHeartbeat(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message_obj = json.loads(self.request.body)
        client_id = message_obj['clientId']
        presence_state_name = message_obj['messagePayload']['presenceStateName']
        user_id, unique_client_postfix = [int(n) for n in client_id.split('|')]

        client_obj = clients.ClientModel.get_by_id(client_id)
        client_obj.store_current_presence_state(presence_state_name)

        logging.info('Heartbeat acknowledgement received from client_id %s with presence %s' % (client_id, presence_state_name))

        # Make sure that this client is a member of all of the rooms that the associated user is a member of
        AddClientToRoom.add_client_to_all_users_rooms(client_id, user_id)

class RequestChannelToken(webapp2.RequestHandler):

    @classmethod
    @ndb.transactional(xg=True)
    def txn_create_new_client_model_and_add_to_track_clients_object(cls, user_id, client_id):
        # Create a new client_model corresponding to the channel that we have just opened for
        # the current user.
        user_obj = users.get_user_by_id(user_id)

        client_model = clients.ClientModel(id=client_id)
        client_model.put()

        track_clients_obj = user_obj.track_clients_key.get()

        if len(track_clients_obj.list_of_client_model_keys) > constants.maximum_number_of_client_connections_per_user:
            raise Exception('User has attempted to exceed the maximum number of clients that are simultaneously allowed per user')

        if client_model.key not in track_clients_obj.list_of_client_model_keys:
            track_clients_obj.list_of_client_model_keys.append(client_model.key)
            track_clients_obj.put()


    @handle_exceptions
    def post(self):
        token_timeout = 24 * 60 - 1  # minutes
        #token_timeout = 1  # minutes
        data_object = json.loads(self.request.body)
        client_id = data_object['clientId']
        user_id = data_object['userId']
        channel_token = channel.create_channel(str(client_id), token_timeout)

        try:
            self.txn_create_new_client_model_and_add_to_track_clients_object(user_id, client_id)
            response_dict = {
                'channelToken': channel_token,
            }
        except:
            response_dict = {
                'channelToken': None,
            }

            status_string = 'serverError'
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = status_string)

        # Finally, send the http response.
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
        # (chat_room_obj, dummy_status_string) = room_module.ChatRoomModel.txn_add_user_to_room(room_id, user_id)
        #
        # send_room_occupancy_to_room_members(chat_room_obj, user_id)
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

        client_obj = clients.ClientModel.get_by_id(client_id)

        if client_obj:
            video_setup.VideoSetup.remove_video_setup_objects_containing_client_id(client_id)


        user_obj = users.UserModel.get_by_id(user_id)
        track_rooms_obj = user_obj.track_rooms_key.get()

        # We only have a single structure for tracking the chat rooms that the user (user_id) currently has open
        # (as opposed to having a structure for each client_id that the user currently has), however,
        # since we synchronize the clients so that the user is in the same rooms on all clients
        # in general we should expect that every room that the user is currently in
        # for any given client, he will also be in that room for all other clients.
        for chat_room_obj_key in track_rooms_obj.list_of_open_chat_rooms_keys:
            chat_room_obj = chat_room_obj_key.get()

            if chat_room_obj.has_client(client_id):

                chat_room_obj = chat_room_module.ChatRoomModel.txn_remove_client_from_room(chat_room_obj.key, user_id, client_id)

                logging.info('Client %s' % client_id + ' removed from room %d state: %s' % (chat_room_obj.key.id(), str(chat_room_obj)))

                # The 'active' user has disconnected from the room, so we want to send an update to the remote
                # user informing them of the new status.
                messaging.send_room_occupancy_to_room_clients(chat_room_obj)

                users.UserModel.txn_delete_client_model_and_remove_from_client_tracker(user_id, client_id)

            else:
                # This is probably not really an error. Change it later once we understand which conditions can trigger
                # this branch to be executed.
                logging.info('Room %s (%d) does not have client %s - probably already removed' % (chat_room_obj.normalized_chat_room_name, chat_room_obj.key.id(), client_id))


class AutoDisconnectClient(DisconnectClient):
    def post(self):
        logging.info('Executing AutoDisconnectClient')
        super(AutoDisconnectClient, self).post()

class ManuallyDisconnectClient(DisconnectClient):
    def post(self):
        logging.info('Executing ManuallyDisconnectClient')
        super(ManuallyDisconnectClient, self).post()