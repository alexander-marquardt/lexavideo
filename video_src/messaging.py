
import json
import logging
import webapp2

from google.appengine.api import channel

from video_src import room_module
from video_src import http_helpers


from error_handling import handle_exceptions

# Do not place @handle_exceptions here -- exceptions should be dealt with by the functions that call this function
def handle_message(room_info_obj, from_client_id, message_obj):
    # This function passes a message from one user in a given "room" to the other user in the same room.
    # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
    # as for passing video and other information from one user to the other. 

    # If to_client_id is "All", then the message will be sent to all room members, otherwise it will be sent
    # only to the indicated client.
    to_client_id = message_obj['toClientId']

    if to_client_id == 'All':
        to_client_ids_list = room_info_obj.get_list_of_other_client_ids(from_client_id)
    else:
        to_client_ids_list = [to_client_id]

    chat_room_name = room_info_obj.chat_room_name

    message_type = message_obj['messageType']
    message_payload = message_obj['messagePayload']

    if message_type == 'videoCameraStatusMsg':

        logging.info('user %s videoElementsEnabledAndCameraAccessRequested is: %s ' %
                     (from_client_id, message_payload['videoElementsEnabledAndCameraAccessRequested']))

        assert(to_client_id != 'All')

        if message_payload['videoElementsEnabledAndCameraAccessRequested'] == 'activateVideo':
            room_module.ChatRoomInfo.txn_add_user_id_to_video_elements_enabled_client_ids(from_client_id, to_client_id )
            send_video_call_settings_to_participants(from_client_id, to_client_ids_list[0])
        else:
            room_module.ChatRoomInfo.txn_remove_user_id_from_video_elements_enabled_client_ids(from_client_id, to_client_id )


    if message_type == 'sdp':
        assert(to_client_id != 'All')

        if message_payload['type'] == 'bye':
            room_info_obj.txn_remove_user_id_from_video_elements_enabled_client_ids(from_client_id, to_client_id )
            logging.info('Client %s ' % from_client_id + ' quit from room ' + chat_room_name)
            logging.info('Room ' + chat_room_name + ' has state ' + repr(room_info_obj))


    for to_client_id in to_client_ids_list:
        if to_client_id and room_info_obj.has_client(to_client_id):
            if message_type == 'sdp' and message_payload['type'] == 'offer':
                # This is just for debugging
                logging.info('sdp offer. Payload: %s' % repr(message_payload))

            on_message(room_info_obj, to_client_id, json.dumps(message_obj))

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

        logging.info('Sending roomOccupancy to %s: %s' % (client_id, json.dumps(message_obj)))
        on_message(room_info_obj, client_id, json.dumps(message_obj))

# Sends information about video settings, and which client should be designated as the 'rtcInitiator'
@handle_exceptions
def send_video_call_settings_to_participants(from_client_id, to_client_id):

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
            channel.send_message(client_id, json.dumps(message_obj))
            is_initiator = not is_initiator




class MessagePage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message = self.request.body
        message_obj = json.loads(message)

        room_id = int(self.request.get('r'))
        from_client_id = message_obj['fromClientId']
        room_info_obj = room_module.ChatRoomInfo.get_by_id(room_id)

        try:
            try:
                if room_info_obj:
                    handle_message(room_info_obj, from_client_id, message_obj)
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


