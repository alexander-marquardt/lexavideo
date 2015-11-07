# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import logging

from google.appengine.api import channel

from video_src import chat_room_module
from video_src import http_helpers
from video_src import video_setup

from request_handler_custom.base_handler import BaseHandlerUserVerified

from error_handling import handle_exceptions



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


# Sends information about who is in the room
@handle_exceptions
def send_room_occupancy_to_clients(chat_room_obj, list_of_clients_to_update, recompute_members_from_scratch):
    # This is called when a user either connects or disconnects from a room. It sends information
    # to room members indicating the status of each client that is a member of the room.

    # Get the list of clients that are currently in the room, as well as any status associated with
    # each of these clients (status such as presence state, and anything else that may come up in the future).
    # The value will be pulled from memcache, except if recompute_members_from_scratch is True
    dict_of_client_objects = chat_room_obj.get_dict_of_client_objects(recompute_members_from_scratch)

    message_obj = {
        'fromClientId': 'msgSentFromServer',
        'messageType': 'roomOccupancyMsg',
        'messagePayload': {
            'chatRoomNameNormalized': chat_room_obj.chat_room_name_normalized,
            'chatRoomNameAsWritten': chat_room_obj.chat_room_name_as_written,
            'chatRoomId': chat_room_obj.key.id(),
            },
        }


    # send list_of_js_user_objects to every user in the room
    for i in range(len(list_of_clients_to_update)):
        client_id = list_of_clients_to_update[i]
        message_obj['messagePayload']['dictOfClientObjects'] = dict_of_client_objects

        logging.info('Sending message to client %s. message_obj %s' % (client_id, json.dumps(message_obj)))
        channel.send_message(client_id, json.dumps(message_obj))

# Sends information about video settings, and which client should be designated as the 'rtcInitiator'
@handle_exceptions
def send_video_call_settings_to_participants(from_client_id, to_client_id):

    vid_setup_id = video_setup.VideoSetup.get_vid_setup_id_for_client_id_pair(from_client_id, to_client_id)
    vid_setup_obj = video_setup.VideoSetup.get_by_id(vid_setup_id)

    count_of_clients_exchanging_video = len(vid_setup_obj.video_elements_enabled_client_ids)

    # Check if there are two people in the room that have enabled video, and if so send
    # a message to each of them to start the webRtc negotiation.
    assert(count_of_clients_exchanging_video <= 2)

    # Once both clients have agreed to send video to each other, then we send the signaling to them
    # to re-start the video setup.
    if count_of_clients_exchanging_video == 2:

        is_initiator = False

        for client_id in vid_setup_obj.video_elements_enabled_client_ids:

            if client_id != from_client_id:
                remote_client_id = from_client_id
            else:
                remote_client_id = to_client_id

            # The second person to connect will be the 'rtcInitiator'.
            # By sending this 'rtcInitiator' value to the clients, this will re-initiate
            # the code for setting up a peer-to-peer rtc session. Therefore, this should only be sent
            # once per session, unless the users become disconnected and need to re-connect.
            message_obj = {'messageType': 'roomInitialVideoSettingsMsg',
                           'fromClientId': remote_client_id,
                           'messagePayload': {'rtcInitiator': is_initiator},
                           }

            logging.info('Sending client %s room status %s' % (client_id, json.dumps(message_obj)))
            channel.send_message(client_id, json.dumps(message_obj))
            is_initiator = not is_initiator




class MessageRoom(BaseHandlerUserVerified):

    # Do not place @handle_exceptions here -- exceptions should be dealt with by the functions that call this function
    def handle_message_room(self, chat_room_obj, from_client_id, message_obj):
        # This function passes a message from one user in a given "room" to the other user in the same room.
        # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
        # as for passing video and other information from one user to the other.

        # If to_client_id is "sendMsgToEveryoneInTheChatRoom", then the message will be sent to all room members, otherwise it will be sent
        # only to the indicated client.
        to_client_ids_list = chat_room_obj.get_list_of_other_client_ids(from_client_id)

        for to_client_id in to_client_ids_list:
            channel.send_message(to_client_id, json.dumps(message_obj))

        http_helpers.set_http_ok_json_response(self.response, {})

    @handle_exceptions
    def post(self):
        message_obj = json.loads(self.request.body)
        from_client_id = message_obj['fromClientId']
        assert(self.session.user_id == int(from_client_id.split('|')[0]))
        room_id = message_obj['chatRoomId']
        message_obj['fromUsernameAsWritten'] = self.session.username_as_written

        try:
            chat_room_obj = chat_room_module.ChatRoomModel.get_by_id(room_id)
            if chat_room_obj:
                self.handle_message_room(chat_room_obj, from_client_id, message_obj)
            else:
                logging.error('Unknown room_id %d' % room_id)
                raise Exception('unknownRoomId')

            http_helpers.set_http_ok_json_response(self.response, {})

        except:
            status_string = 'Server error'
            http_status_code = 500
            logging_function = logging.error

            http_helpers.set_error_json_response_and_write_log(self.response, status_string, logging_function,
                                                               http_status_code, self.request)


class MessageClient(BaseHandlerUserVerified):

    # Do not place @handle_exceptions here -- exceptions should be dealt with by the functions that call this function
    def handle_message_client(self, from_client_id, message_obj):
        # This function passes a message from one user in a given "room" to the other user in the same room.
        # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
        # as for passing video and other information from one user to the other.

        to_client_id = message_obj['toClientId']
        message_type = message_obj['messageType']
        message_payload = message_obj['messagePayload']
        message_obj['fromUsernameAsWritten'] = self.session.username_as_written

        if message_type == 'videoExchangeStatusMsg':

            logging.info('clientId %s videoElementsEnabledAndCameraAccessRequested is: %s ' %
                         (from_client_id, message_payload['videoElementsEnabledAndCameraAccessRequested']))

            if message_payload['videoElementsEnabledAndCameraAccessRequested'] == 'doVideoExchange':

                video_setup.VideoSetup.txn_add_user_id_to_video_elements_enabled_client_ids(from_client_id, to_client_id )
                send_video_call_settings_to_participants(from_client_id, to_client_id)
            else:
                assert message_payload['videoElementsEnabledAndCameraAccessRequested'] == 'hangupVideoExchange' or \
                    message_payload['videoElementsEnabledAndCameraAccessRequested'] == 'denyVideoExchange'

                video_setup.VideoSetup.txn_remove_user_id_from_video_elements_enabled_client_ids(from_client_id, to_client_id )

            if message_type == 'sdp' and message_payload['type'] == 'offer':
                # This is just for debugging
                logging.info('sdp offer. Payload: %s' % repr(message_payload))

        logging.info('\n***\nSending message to client %s: %s\n' % (to_client_id,  json.dumps(message_obj)))
        channel.send_message(to_client_id, json.dumps(message_obj))
        http_helpers.set_http_ok_json_response(self.response, {})

    @handle_exceptions
    def post(self):
        message_obj = json.loads(self.request.body)
        from_client_id = message_obj['fromClientId']
        assert(self.session.user_id == int(from_client_id.split('|')[0]))

        try:
            self.handle_message_client(from_client_id, message_obj)
            http_helpers.set_http_ok_json_response(self.response, {})

        except:
            status_string = 'Unknown server error'
            http_status_code = 500
            logging_function = logging.error

            http_helpers.set_error_json_response_and_write_log(self.response, status_string, logging_function,
                                                               http_status_code, self.request)
