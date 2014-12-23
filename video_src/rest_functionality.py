#!/usr/bin/python2.4


import json
import logging

import webapp2

from google.appengine.ext import ndb
from google.appengine.api import channel


from video_src import constants
from video_src import http_helpers
from video_src import room_module
from video_src import status_reporting
from video_src import utils


from video_src.error_handling import handle_exceptions


class HandleEnterIntoRoom(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, chat_room_name_from_url=None):
        chat_room_name_from_url = chat_room_name_from_url.decode('utf8')
        chat_room_name = chat_room_name_from_url.lower()

        if chat_room_name:
            logging.info('Query for room name: ' + chat_room_name)
            room_info_obj = room_module.ChatRoomInfo.query(room_module.ChatRoomInfo.chat_room_name == chat_room_name).get()

            if room_info_obj:
                response_dict = {
                    'chatRoomName': chat_room_name,
                    'roomIsRegistered': True,
                    'numInRoom': room_info_obj.get_occupancy(),
                }
                logging.info('Found room: ' + repr(room_info_obj))

            else:
                response_dict = {
                    'chatRoomName': chat_room_name,
                    'roomIsRegistered' : False,
                    'numInRoom': 0
                }
                logging.info('Room name is available: ' + chat_room_name)

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            room_query = room_module.ChatRoomInfo.query()
            rooms_list = []

            for room_obj in room_query:
                room_dict = room_obj.to_dict()
                room_dict['chatRoomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            http_helpers.set_http_ok_json_response(self.response, rooms_list)


    def post(self, chat_room_name_from_url):
        try:
            room_dict = json.loads(self.request.body)

            # Need to get the URL encoded data from utf8. Note that json encoded data appears to already be decoded.
            chat_room_name_from_url = chat_room_name_from_url.decode('utf8')
            room_dict = utils.convert_dict(room_dict, utils.camel_to_underscore)

            assert (room_dict['chat_room_name'] == chat_room_name_from_url)
            room_dict['chat_room_name_as_written'] = room_dict['chat_room_name']
            chat_room_name = chat_room_name_from_url.lower()
            room_dict['chat_room_name'] = chat_room_name


            # Make sure that the room name is valid before continuing.
            # These errors should be rare since these values are
            # already formatted to be within bounds and characters checked by the client-side javascript.
            # Only if the user has somehow bypassed the javascript checks should we receive values that don't
            # conform to the constraints that we have placed.
            if not constants.valid_chat_room_name_regex_compiled.match(chat_room_name):
                raise Exception('Room name regexp did not match')
            if len(chat_room_name) > constants.room_max_chars or len(chat_room_name) < constants.room_min_chars:
                raise Exception('Room name length of %s is out of range' % len(chat_room_name))

            response_dict = {}
            user_id = long(room_dict['user_id'])

            room_creator_user_key = ndb.Key('UserModel', user_id)
            room_info_obj = room_module.ChatRoomInfo.create_or_get_room(chat_room_name, room_dict,
                                                                        room_creator_user_key)

            # Now add the user to the room (even if they created the room, they have not yet been added). Notice
            # that we intentionally overwrite room_info_obj with the value returned from this function call, as
            # room_info_obj may be modified by the transaction, and we must have the most up-to-date data.
            (room_info_obj, response_dict['statusString']) = room_module.txn_add_user_to_room(room_info_obj.key.id(), user_id)

            token_timeout = 240  # minutes
            client_id = room_info_obj.make_client_id(user_id)
            channel_token = channel.create_channel(client_id, token_timeout)
            response_dict['clientId'] = client_id
            response_dict['channelToken'] = channel_token
            response_dict['roomId'] = room_info_obj.key.id()

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        except:
            # Unknown exception - provide feedback to the user to indicate that the room was not created or entered into
            err_status = 'ErrorUnableToCreateOrEnterRoom'
            # log this error for further analysis
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_status)
            http_helpers.set_http_ok_json_response(self.response, {'statusString': err_status})
