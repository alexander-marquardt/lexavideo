#!/usr/bin/python2.4


import json
import logging

import webapp2

from google.appengine.ext import ndb
from google.appengine.api import channel


from video_src import constants
from video_src import http_helpers
from video_src import models
from video_src import room_module
from video_src import status_reporting
from video_src import utils


from video_src.error_handling import handle_exceptions


class HandleEnterIntoRoom(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, room_name_from_url=None):
        room_name_from_url = room_name_from_url.decode('utf8')
        room_name = room_name_from_url.lower()

        if room_name:
            logging.info('Query for room name: ' + room_name)
            room_obj = room_module.ChatRoomInfo.query(room_module.ChatRoomInfo.room_name == room_name).get()

            if room_obj:
                response_dict = {
                    'roomName': room_name,
                    'roomIsRegistered' : True,
                    'numInRoom': room_obj.get_occupancy(),
                }
                logging.info('Found room: ' + repr(room_obj))

            else:
                response_dict = {
                    'roomName': room_name,
                    'roomIsRegistered' : False,
                    'numInRoom': 0
                }
                logging.info('Room name is available: ' + repr(room_obj))

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            room_query = room_module.ChatRoomInfo.query()
            rooms_list = []

            for room_obj in room_query:
                room_dict = room_obj.to_dict()
                room_dict['roomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            http_helpers.set_http_ok_json_response(self.response, rooms_list)


    def post(self, room_name_from_url):
        try:
            room_dict = json.loads(self.request.body)

            # Need to get the URL encoded data from utf8. Note that json encoded data appears to already be decoded.
            room_name_from_url = room_name_from_url.decode('utf8')
            room_dict = utils.convert_dict(room_dict, utils.camel_to_underscore)

            assert (room_dict['room_name'] == room_name_from_url)
            room_dict['room_name_as_written'] = room_dict['room_name']
            room_name = room_name_from_url.lower()
            room_dict['room_name'] = room_name


            # Make sure that the room name is valid before continuing.
            # These errors should be rare since these values are
            # already formatted to be within bounds and characters checked by the client-side javascript.
            # Only if the user has somehow bypassed the javascript checks should we receive values that don't
            # conform to the constraints that we have placed.
            if not constants.valid_room_name_regex_compiled.match(room_name):
                raise Exception('Room name regexp did not match')
            if len(room_name) > constants.room_max_chars or len(room_name) < constants.room_min_chars:
                raise Exception('Room name length of %s is out of range' % len(room_name))

            response_dict = {}
            user_id = long(room_dict['user_id'])


            try:
                # if the ChatRoomName keyed by room_name cannot be created, then a RoomAlreadyExistsException
                # will be raised, and execution will be transferred to the exception handling block which
                # deals with the case that the room already exists.
                room_creator_user_key = ndb.Key('UserModel', user_id)
                (room_name_obj, room_info_obj) = room_module.ChatRoomName.txn_create_room_by_name(room_name, room_dict, room_creator_user_key)

                # If no exception was raised, then this is a newly created room.
                response_dict['statusString'] = 'roomCreated'

            except room_module.RoomAlreadyExistsException:
                # This room has previously been created - look it up and get it (if it doesn't exist this is
                # a fairly serious error as a room should be created every time that a new ChatRoomName object is
                # created)
                room_info_obj = room_module.ChatRoomInfo.query(room_module.ChatRoomInfo.room_name == room_name).get()
                if not room_info_obj:
                    raise Exception('room_name %s does not exist in the ChatRoomInfo data structure' % room_name)

            except:
                raise

            # Now add the user to the room (even if they created the room, they have not yet been added)
            (room_info_obj, response_dict['statusString']) = room_module.txn_add_user_to_room(room_info_obj.key.id(), user_id)

            token_timeout =  240 # minutes
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
