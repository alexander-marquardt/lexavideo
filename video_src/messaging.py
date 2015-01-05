
import json
import logging
import webapp2

from google.appengine.api import channel
from google.appengine.ext import ndb

from video_src import constants
from video_src import room_module
from video_src import http_helpers
from video_src import status_reporting
from video_src import users

from error_handling import handle_exceptions

# Do not place @handle_exceptions here -- exceptions should be dealt with by the functions that call this function
def handle_message(room_info_obj, from_client_id, message):
    # This function passes a message from one user in a given "room" to the other user in the same room.
    # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
    # as for passing video and other information from one user to the other. 

    message_obj = json.loads(message)
    message = message.decode("utf-8")
    to_client_ids_list = room_info_obj.get_list_of_other_client_ids(from_client_id)
    chat_room_name = room_info_obj.chat_room_name

    message_type = message_obj['messageType']
    message_payload = message_obj['messagePayload']



    if message_type == 'videoCameraStatusMsg':

        logging.info('user %s videoElementsEnabledAndCameraAccessRequested is: %s ' %
                     (from_client_id, message_payload['videoElementsEnabledAndCameraAccessRequested']))

        if message_payload['videoElementsEnabledAndCameraAccessRequested'] == 'activateVideo':
            # TODO - this is a hack -- need to pass in to_client_id directly - just setup like this for temporary development and testing
            vid_setup_obj = room_module.ChatRoomInfo.txn_add_user_id_to_video_elements_enabled_client_ids(from_client_id, to_client_ids_list[0], )
            send_room_video_settings_to_room_members(from_client_id, to_client_ids_list[0])
        else:
            vid_setup_obj = room_module.ChatRoomInfo.txn_remove_user_id_from_video_elements_enabled_client_ids(from_client_id, to_client_ids_list[0], )


    if message_type == 'sdp':
        if message_payload['type'] == 'bye':
            vid_setup_obj = room_info_obj.txn_remove_user_id_from_video_elements_enabled_client_ids(from_client_id, to_client_ids_list[0], )
            logging.info('Client %s ' % from_client_id + ' quit from room ' + chat_room_name)
            logging.info('Room ' + chat_room_name + ' has state ' + repr(room_info_obj))


    for to_client_id in to_client_ids_list:
        if to_client_id and room_info_obj.has_client(to_client_id):
            if message_type == 'sdp' and message_payload['type'] == 'offer':
                # This is just for debugging
                logging.info('sdp offer. Payload: %s' % repr(message_payload))

            if message_type == 'sdp' and message_payload['type'] == 'offer' and to_client_id == from_client_id:
                pass

            on_message(room_info_obj, to_client_id, message)

        else:
            raise Exception('otherUserNotInRoom')



# def delete_saved_messages(client_id):
#     messages =models.Message.get_saved_messages(client_id)
#     for message in messages:
#         message.key.delete()
#         logging.info('Deleted the saved message for ' + client_id)


# def send_saved_messages(client_id):
#     messages = models.Message.get_saved_messages(client_id)
#     for message in messages:
#         channel.send_message(client_id, message.msg)
#         logging.info('Delivered saved message to ' + client_id)
#         message.key.delete()

@handle_exceptions
def on_message(room_info_obj, to_client_id, message):

    if room_info_obj.has_client(to_client_id):
        channel.send_message(to_client_id, message)
        #logging.info('Delivered message to user %d' % to_user_id)
    else:
        # new_message = models.Message(client_id = to_client_id, msg = message)
        # new_message.put()
        logging.error('Unable to deliver message to user ' + to_client_id + ' since they are not connected to the room.')
        raise Exception('otherUserChannelNotConnected')


# Sends information about who is in the room
@handle_exceptions
def send_room_occupancy_to_room_clients(room_info_obj):
    # This is called when a user either connects or disconnects from a room. It sends information
    # to room members indicating the status of who is in the room.

    message_obj = {'messageType': 'roomOccupancyMsg',
                   'messagePayload': {},
                   }

    # Javascript needs to know which users are in this room.
    # first we must create a list that contains information of all users that are in the current room.
    list_of_js_client_objects = []
    for client_id in room_info_obj.room_members_client_ids:

    # We only send relevant data to the client,
    # which includes the user_id (which is the database key) and the user_name.
        js_user_obj = {
            'userName': client_id,
            'clientId': client_id
        }

        list_of_js_client_objects.append(js_user_obj)

    # send list_of_js_user_objects to every user in the room
    for i in range(len(room_info_obj.room_members_client_ids)):
        client_id = room_info_obj.room_members_client_ids[i]
        message_obj['messagePayload']['listOfClientObjects'] = list_of_js_client_objects
        on_message(room_info_obj, client_id, json.dumps(message_obj))





# Sends information about video settings, and which client should be designated as the 'rtcInitiator'
@handle_exceptions
def send_room_video_settings_to_room_members(from_client_id, to_client_id):

    vid_setup_id = room_module.VideoSetup.get_vid_setup_id_for_client_id_pair(from_client_id, to_client_id)
    vid_setup_obj = room_module.VideoSetup.get_by_id(vid_setup_id)

    count_of_clients_exchanging_video = len(vid_setup_obj.video_elements_enabled_client_ids)

    # Check if there are two people in the room that have enabled video, and if so send
    # a message to each of them to start the webRtc negotiation.
    assert(count_of_clients_exchanging_video <= 2)

    # Once both clients have agreed to send video to each other, then we send the signaling to them
    # to re-start the video setup.
    if count_of_clients_exchanging_video == 2:

        is_initiator = False

        for client_id in vid_setup_obj.video_elements_enabled_client_ids:

            # The second person to connect will be the 'rtcInitiator'.
            # By sending this 'rtcInitiator' value to the clients, this will re-initiate
            # the code for setting up a peer-to-peer rtc session. Therefore, this should only be sent
            # once per session, unless the users become disconnected and need to re-connect.
            message_obj = {'messageType': 'roomInitialVideoSettingsMsg',
                           'messagePayload': {'rtcInitiator': is_initiator},
                           }

            logging.info('Sending client %s room status %s' % (client_id, json.dumps(message_obj)))
            channel.send_message(to_client_id, json.dumps(message_obj))
            is_initiator = not is_initiator




class MessagePage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message = self.request.body
        room_id = int(self.request.get('r'))
        client_id = self.request.get('c')
        room_info_obj = room_module.ChatRoomInfo.get_by_id(room_id)

        try:
            try:
                if room_info_obj:
                    handle_message(room_info_obj, client_id, message)
                else:
                    logging.error('Unknown room_id %d' % room_id)
                    raise Exception('unknownRoomId')

            except Exception as e:

                status_string = e.message

                # if 'otherUserNotInRoom' then we will give the user feedback indicating that they are alone in the room
                # and that is why their message was not delivered. This is not a serious error, and so we only log
                # it with a warning message and return a http 403 code.
                if status_string == 'otherUserNotInRoom':
                     # 403 = Forbidden - request is valid, but server is refusing to respond to it
                    http_status_code = 403
                    logging_function = logging.warning

                # else, we don't know what happened so return a 500 error and log all relevant information
                else:
                    # re-raise the exception so that it will be caught by the following except clause
                    raise

                http_helpers.set_error_json_response_and_write_log(self.response, status_string, logging_function, http_status_code)

        except:
            status_string = 'Unknown server error'
            http_status_code = 500
            logging_function = logging.error

            http_helpers.set_error_json_response_and_write_log(self.response, status_string, logging_function,
                                                               http_status_code, self.request)



class UserHeartbeat(webapp2.RequestHandler):

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



class ConnectPage(webapp2.RequestHandler):

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



class AddClientToRoom(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        data_object = json.loads(self.request.body)
        user_id = data_object['userId']
        client_id = data_object['clientId']
        room_id = data_object['roomId']

        (room_info_obj, dummy_status_string) = room_module.ChatRoomInfo.txn_add_client_to_room(room_id, client_id, user_id)
        send_room_occupancy_to_room_clients(room_info_obj)



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


"""
DisconnectPage will be called when the channel dies (for example if the user leaves the page),
and for immediate execution when a user unloads a page in their browser,
we also manually call this disconnect with an onbeforeunload event handler
in the javascript code.
Therefore, it is possible and even likely that this call will be called multiple
times when a user leaves a page - this should therefore idempotent.
"""
class DisconnectPage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):

        client_id = self.request.get('from')
        user_id, unique_client_postfix = [int(n) for n in client_id.split('|')]

        client_obj = users.ClientModel.get_by_id(client_id)

        if client_obj:
            for room_info_obj_key in client_obj.list_of_open_rooms_keys:

                room_module.ChatRoomInfo.remove_video_setup_objects_containing_client_id(client_id)

                room_info_obj = room_info_obj_key.get()

                if room_info_obj.has_client(client_id):

                    room_info_obj = room_module.ChatRoomInfo.txn_remove_client_from_room(room_info_obj.key, client_id)

                    logging.info('Client %s' % client_id + ' removed from room %d state: %s' % (room_info_obj.key.id(), str(room_info_obj)))

                    # The 'active' user has disconnected from the room, so we want to send an update to the remote
                    # user informing them of the new status.
                    send_room_occupancy_to_room_clients(room_info_obj)

                    users.UserModel.txn_delete_client_model_and_remove_from_client_tracker(user_id, client_id)

                else:
                    logging.error('Room %s (%d) does not have client %s - disconnect failed' % (room_info_obj.chat_room_name, room_info_obj.key.id(), client_id))
