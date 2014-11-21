
import json
import logging
import webapp2

from google.appengine.api import channel

from video_src import room_module
from video_src import models
from video_src import http_helpers
from error_handling import handle_exceptions

# Do not place @handle_exceptions here -- exceptions should be dealt with by the functions that call this function
def handle_message(room_obj, from_user_id, message):
    # This function passes a message from one user in a given "room" to the other user in the same room.
    # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
    # as for passing video and other information from one user to the other. 

    message_obj = json.loads(message)
    message = message.decode("utf-8")
    to_user_id = room_obj.get_other_user_id(from_user_id)
    room_name = room_obj.room_name

    message_type = message_obj['messageType']
    message_payload = message_obj['messagePayload']

    if message_type == 'startVideoCamera':
        room_obj = room_module.txn_add_user_id_to_video_enabled_ids(room_obj.key.id(), from_user_id)
        send_room_video_settings_to_room_members(room_obj)
        # return now, since startVideo is a message intended for the server and should not reach the other client
        return

    if message_type == 'sdp':
        if message_payload['type'] == 'bye':
            # This would remove the other_user in loopback test too.
            # So check its availability before forwarding Bye message.
            room_obj.remove_user(from_user_id)
            logging.info('User %d ' % from_user_id + ' quit from room ' + room_name)
            logging.info('Room ' + room_name + ' has state ' + repr(room_obj))

    if message_type == 'videoSettings':
        if message_payload['requestAcceptOrDenyVideoType'] == 'acceptVideoType':
            # If the user is sending an 'acceptVideoType' message, then both parties have agreed to the new video
            # format, and this is now the new default format for the current room.
            room_obj.room_video_type = message_payload['videoType']
            room_obj.put()

        logging.info('videoSettings message received: ' + repr(message_payload))




    if to_user_id and room_obj.has_user(to_user_id):
        if message_type == 'sdp' and message_payload['type'] == 'offer':
            # This is just for debugging
            logging.info('sdp offer. Payload: %s' % repr(message_payload))

        if message_type == 'sdp' and message_payload['type'] == 'offer' and to_user_id == from_user_id:
            # Special case the loopback scenario.
            #message = make_loopback_answer(message)
            pass

        on_message(room_obj, to_user_id, message)

    else:
        logging.warning('Cannot deliver message type: %s from user: %s to other_user: %s since they are not in the room: %s' % (
            message_type, from_user_id, to_user_id, room_name))
        raise Exception('otherUserNotInRoom')
        # For unittest
        #on_message(room, user, message)


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
def on_message(room_obj, to_user_id, message):
    to_client_id = room_obj.make_client_id(to_user_id)

    if room_obj.has_user(to_user_id):
        channel.send_message(to_client_id, message)
        #logging.info('Delivered message to user %d' % to_user_id)
    else:
        # new_message = models.Message(client_id = to_client_id, msg = message)
        # new_message.put()
        logging.error('Unable to deliver message to user ' + to_client_id + ' since they are not connected to the room.')
        raise Exception('otherUserChannelNotConnected')


# Sends information about who is in the room, and which client should be designated as the 'rtcInitiator'
@handle_exceptions
def send_room_occupancy_to_room_members(room_obj, user_id):
    # This is called when a user either connects or disconnects from a room. It sends information
    # to room members indicating the status of who is in the room.

    other_user_id = room_obj.get_other_user_id(user_id)
    other_user_name = None

    message_obj = {'messageType': 'roomOccupancy',
                   'messagePayload': {},
                   }
    user_obj = models.UserModel.get_by_id(user_id)
    user_name = user_obj.user_name

    # If there is already a user in the room, then they will be notified that a new user has just joined the room.
    # Note that since we are sending the occupancy to the "other" user, we send the active users name and id
    if other_user_id:
        message_obj['messagePayload']['remoteUserName'] = user_name
        message_obj['messagePayload']['remoteUserId'] = user_id
        logging.info('Sending user %d room status %s' % (other_user_id, json.dumps(message_obj)))
        on_message(room_obj, other_user_id, json.dumps(message_obj))

        other_user_obj = models.UserModel.get_by_id(other_user_id)
        other_user_name = other_user_obj.user_name


    # Send a message to the active client, indicating the room occupancy. Note that since we are sending occupancy
    # to the "active" usr, we send the "other" user name and id
    message_obj['messagePayload']['remoteUserName'] = other_user_name
    message_obj['messagePayload']['remoteUserId'] = other_user_id
    logging.info('Sending user %d room status %s' % (user_id, json.dumps(message_obj)))
    on_message(room_obj, user_id, json.dumps(message_obj))



@handle_exceptions
def send_room_video_settings_to_room_members(room_obj):


    video_enabled_ids = room_obj.video_enabled_ids

    # Check if there are two people in the room that have enabled video, and if so send
    # a message to each of them to start the webRtc negotiation.
    length_of_video_enabled_ids = len(video_enabled_ids)
    assert(length_of_video_enabled_ids <= 2)

    is_initiator = False
    if length_of_video_enabled_ids == 2:
        logging.info('Sending room video settings for room %s' % room_obj)

        for user_id in video_enabled_ids:
            message_obj = {'messageType': 'roomInitialVideoSettings',
                   'messagePayload': {
                       'roomVideoType': room_obj.room_video_type,
                       },
                   }


            # send a message to the other user (the client already in the room) that someone has just joined the room
            logging.debug('Sending message to other_user: %s' % repr(message_obj))

            # If there is already another user in the room, then the second person to connect will be the
            # 'rtcInitiator'. By sending this 'rtcInitiator' value to the clients, this will re-initiate
            # the code for setting up a peer-to-peer rtc session. Therefore, this should only be sent
            # once per session, unless the users become disconnected and need to re-connect.
            message_obj['messagePayload']['rtcInitiator'] = is_initiator
            logging.info('Sending user %d room status %s' % (user_id, json.dumps(message_obj)))
            on_message(room_obj, user_id, json.dumps(message_obj))
            is_initiator = not is_initiator

    else:
        logging.warning('Not sending room video settings since only one user has enabled video. Room object: %s' % room_obj)



class MessagePage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message = self.request.body
        room_id = int(self.request.get('r'))
        user_id = int(self.request.get('u'))
        room_obj = room_module.RoomInfo.get_by_id(room_id)

        try:
            try:
                if room_obj:
                    handle_message(room_obj, user_id, message)
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



class ConnectPage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        client_id = self.request.get('from')
        room_id, user_id = [int(n) for n in client_id.split('/')]

        # Add user to the room. If they have a channel open to the room then they are by definition in the room
        # This is necessary for the dev server, since the channel disconnects each time that the
        # client-side javascript is paused. Therefore, it is quite helpful to automatically put the user back in the
        # room if the user still has a channel open and wishes to connect to the current room.
        (room_obj, dummy_status_string) = room_module.txn_add_user_to_room(room_id, user_id)

        send_room_occupancy_to_room_members(room_obj, user_id)




class DisconnectPage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):

        client_id = self.request.get('from')
        room_id, user_id = [int(n) for n in client_id.split('/')]

        room_obj = room_module.get_room_by_id(room_id)
        if room_obj:
            if room_obj.has_user(user_id):

                # Get the other_user_id before removing the user_id from the room
                other_user_id = room_obj.get_other_user_id(user_id)

                room_obj = room_module.txn_remove_user_from_room(room_id, user_id)


                logging.info('User %d' % user_id + ' removed from room %d state: %s' % (room_id, str(room_obj)))

                # The 'active' user has disconnected from the room, so we want to send an update to the remote
                # user informing them of the new status.
                if other_user_id:
                    send_room_occupancy_to_room_members(room_obj, other_user_id)

            else:
                logging.error('Room %s (%d) does not have user %d - disconnect failed' % (room_obj.room_name, room_id, user_id))

        else:
            logging.error('Room %d' % room_id + ' does not exist. Cannot disconnect user %d' % user_id)
