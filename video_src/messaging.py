
import json
import logging
import webapp2

from google.appengine.api import channel

from video_src import room_module
from video_src import http_helpers
from video_src import users

from error_handling import handle_exceptions

# Do not place @handle_exceptions here -- exceptions should be dealt with by the functions that call this function
def handle_message(room_info_obj, from_user_id, message):
    # This function passes a message from one user in a given "room" to the other user in the same room.
    # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
    # as for passing video and other information from one user to the other. 

    message_obj = json.loads(message)
    message = message.decode("utf-8")
    to_user_ids = room_info_obj.get_other_user_ids(from_user_id)
    chat_room_name = room_info_obj.chat_room_name

    message_type = message_obj['messageType']
    message_payload = message_obj['messagePayload']

    if message_type == 'videoCameraStatusMsg':

        logging.info('user %s videoElementsEnabledAndCameraAccessRequested is: %s ' %
                     (from_user_id, message_payload['videoElementsEnabledAndCameraAccessRequested']))

        if message_payload['videoElementsEnabledAndCameraAccessRequested'] == 'activateVideo':

            room_info_obj = room_module.ChatRoomInfo.txn_add_user_id_to_video_elements_enabled_user_ids(room_info_obj.key, from_user_id)
            send_room_video_settings_to_room_members(room_info_obj)
        else:
            room_info_obj = room_module.ChatRoomInfo.txn_remove_user_id_from_video_elements_enabled_user_ids(room_info_obj.key, from_user_id)


    if message_type == 'sdp':
        if message_payload['type'] == 'bye':
            # This would remove the other_user in loopback test too.
            # So check its availability before forwarding Bye message.
            room_info_obj.remove_user(from_user_id)
            logging.info('User %d ' % from_user_id + ' quit from room ' + chat_room_name)
            logging.info('Room ' + chat_room_name + ' has state ' + repr(room_info_obj))


    # TODO - THIS WILL BREAK WHEN THERE ARE MORE THAN 2 USERS IN A ROOM - NEEDS URGENT FIX - FOR SDP MESSAGES
    # PASS IN THE SPECIFIC "to_user" that the message is intended for.
    logging.error('Fix the code - it is broken')
    for to_user_id in to_user_ids:
        if message_type == 'sdp' and message_payload['type'] == 'offer':
            # This is just for debugging
            logging.info('sdp offer. Payload: %s' % repr(message_payload))

        if message_type == 'sdp' and message_payload['type'] == 'offer' and to_user_id == from_user_id:
            # Special case the loopback scenario.
            #message = make_loopback_answer(message)
            pass

        on_message(room_info_obj, to_user_id, message)

    else:
        raise Exception('otherUserNotInRoom')





@handle_exceptions
def on_message(room_info_obj, to_user_id, message):

    if room_info_obj.has_user(to_user_id):
        channel.send_message(str(to_user_id), message)
        #logging.info('Delivered message to user %d' % to_user_id)
    else:
        # new_message.put()
        logging.error('Unable to deliver message to user ' + to_user_id + ' since they are not connected to the room.')
        raise Exception('otherUserChannelNotConnected')


# Sends information about who is in the room
@handle_exceptions
def send_room_occupancy_to_room_members(room_info_obj, user_id):
    # This is called when a user either connects or disconnects from a room. It sends information
    # to room members indicating the status of who is in the room.

    message_obj = {'messageType': 'roomOccupancyMsg',
                   'messagePayload': {},
                   }

    # Javascript needs to know which users are in this room.
    # first we must create a list that contains information of all users that are in the current room.
    list_of_js_user_objects = []
    for i in range(len(room_info_obj.room_members_ids)):
        user_id = room_info_obj.room_members_ids[i]
        user_obj = users.UserModel.get_by_id(user_id)
        user_name = user_obj.user_name

    # We only send relevant data to the client,
    # which includes the user_id (which is the database key) and the user_name.
        js_user_obj = {
            'userName': user_name,
            'userId': user_id
        }

        list_of_js_user_objects.append(js_user_obj)

    # send list_of_js_user_objects to every user in the room
    for i in range(len(room_info_obj.room_members_ids)):
        user_id = room_info_obj.room_members_ids[i]
        message_obj['messagePayload']['listOfUserObjects'] = list_of_js_user_objects
        on_message(room_info_obj, user_id, json.dumps(message_obj))





# Sends information about video settings, and which client should be designated as the 'rtcInitiator'
@handle_exceptions
def send_room_video_settings_to_room_members(room_info_obj):


    video_elements_enabled_user_ids = room_info_obj.video_elements_enabled_user_ids

    # Check if there are two people in the room that have enabled video, and if so send
    # a message to each of them to start the webRtc negotiation.
    length_of_video_elements_enabled_user_ids = len(video_elements_enabled_user_ids)
    assert(length_of_video_elements_enabled_user_ids <= 2)

    is_initiator = False
    if length_of_video_elements_enabled_user_ids == 2:
        logging.info('Sending room video settings for room %s' % room_info_obj)

        for user_id in video_elements_enabled_user_ids:

            # The second person to connect will be the 'rtcInitiator'.
            # By sending this 'rtcInitiator' value to the clients, this will re-initiate
            # the code for setting up a peer-to-peer rtc session. Therefore, this should only be sent
            # once per session, unless the users become disconnected and need to re-connect.
            message_obj = {'messageType': 'roomInitialVideoSettingsMsg',
                           'messagePayload': {'rtcInitiator': is_initiator},
                           }

            logging.info('Sending user %d room status %s' % (user_id, json.dumps(message_obj)))
            on_message(room_info_obj, user_id, json.dumps(message_obj))
            is_initiator = not is_initiator

    else:
        logging.warning('Not sending room video settings since only one user has enabled video. Room object: %s' % room_info_obj)



class MessagePage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message = self.request.body
        room_id = int(self.request.get('r'))
        user_id = int(self.request.get('u'))
        room_info_obj = room_module.ChatRoomInfo.get_by_id(room_id)

        try:
            try:
                if room_info_obj:
                    handle_message(room_info_obj, user_id, message)
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

            http_helpers.set_error_json_response_and_write_log(self.response, status_string, logging_function, http_status_code)



class UserHeartbeat(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        data_object = json.loads(self.request.body)
        user_id = data_object['userId']
        room_id = data_object['roomId']

        room_info_obj = room_module.ChatRoomInfo.get_room_by_id(room_id)

        # check if the user is already in the room, and add them if they are not in the room. Otherwise,
        # no action is necessary.
        if not room_info_obj.has_user(user_id):
            (room_info_obj, dummy_status_string) = room_module.ChatRoomInfo.txn_add_user_to_room(room_id, user_id)

            # Update the other members of the room so they know that this user has joined the room.
            send_room_occupancy_to_room_members(room_info_obj, user_id)



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


class OpenChannel(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        token_timeout = 300  # minutes
        data_object = json.loads(self.request.body)
        channel_token = channel.create_channel(str(data_object['userId']), token_timeout)

        response_dict = {
            'channelToken': channel_token
        }

        http_helpers.set_http_ok_json_response(self.response, response_dict)


class DisconnectPage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):

        user_id = int(self.request.get('from'))

        # Remove the room from the user object
        user_obj = users.get_user_by_id(user_id)

        if user_obj:
            rooms_currently_open_object = user_obj.rooms_currently_open_object_key.get()

            for room_info_obj_key in rooms_currently_open_object.list_of_open_rooms_keys:
                room_info_obj = room_info_obj_key.get()

                if room_info_obj.has_user(user_id):

                    # Get the other_user_id before removing the user_id from the room
                    other_user_ids = room_info_obj.get_other_user_ids(user_id)

                    room_info_obj = room_module.ChatRoomInfo.txn_remove_user_from_room(room_info_obj.key, user_id)

                    logging.info('User %d' % user_id + ' removed from room  %s' % (str(room_info_obj)))

                    # The 'active' user has disconnected from the room, so we want to send an update to the remote
                    # user informing them of the new status.
                    for other_user_id in other_user_ids:
                        send_room_occupancy_to_room_members(room_info_obj, other_user_id)

                else:
                    logging.error('Room %s does not have user %d - disconnect failed' % (room_info_obj.chat_room_name, user_id))

        else:
            logging.error('User associated with id %s not found.' % user_id)

