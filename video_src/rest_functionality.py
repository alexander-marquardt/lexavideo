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
            room_obj = room_module.RoomInfo.query(room_module.RoomInfo.room_name == room_name).get()

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
            room_query = room_module.RoomInfo.query()
            rooms_list = []

            for room_obj in room_query:
                room_dict = room_obj.to_dict()
                room_dict['roomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            http_helpers.set_http_ok_json_response(self.response, rooms_list)


    @handle_exceptions
    def post(self, room_name_from_url):
        room_dict = json.loads(self.request.body)

        # Need to get the URL encoded data from utf8. Note that json encoded data appears to already be decoded.
        room_name_from_url = room_name_from_url.decode('utf8')
        room_dict = utils.convert_dict(room_dict, utils.camel_to_underscore)

        assert (room_dict['room_name'] == room_name_from_url)
        room_dict['room_name_as_written'] = room_dict['room_name']
        room_name = room_name_from_url.lower()
        room_dict['room_name'] = room_name


        # Make sure that the room name is valid before continuing.
        # These errors should be extremely rare since these values are
        # already formatted to be within bounds and characters checked by the client-side javascript. 
        if not constants.valid_room_name_regex_compiled.match(room_name):
            raise Exception('Room name regexp did not match')
        if len(room_name) > constants.room_max_chars or len(room_name) < constants.room_min_chars:
            raise Exception('Room name length of %s is out of range' % len(room_name))


        # creates an object that is keyed by the room_name. This is used for guaranteeing uniqueness
        # of each room name.
        @ndb.transactional
        def create_room_name_transaction(room_name):

            room_name_obj = room_module.RoomName.get_by_id(room_name)
            if not room_name_obj:
                # This is a new room name
                room_name_obj = room_module.RoomName(id=room_name)
                room_name_obj.put()

        try:
            create_room_name_transaction(room_name)
        except:
            # Provide feedback to the user to indicate that the room was not created
            err_status = 'ErrorUnableToCreateRoomNameObject'
            http_helpers.set_http_ok_json_response(self.response, {'statusString': err_status})
            # log this error for further analysis
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_status)

        current_user_id = room_dict['user_id']

        response_dict = {}

        room_obj = room_module.RoomInfo.query(room_module.RoomInfo.room_name == room_name).get()
        if room_obj:
            # The room has already been created - try to add this user to the room.
            # Check to make sure that they have not already been added before adding.

            occupancy = room_obj.get_occupancy()

            if current_user_id in room_obj.room_members_ids:
                # do nothing as this user is already in the room - report status as "roomJoined"
                # so javascript does not have to deal with a special case.
                response_dict = {'statusString': 'roomJoined'}

            elif occupancy == 2:
                # Room is full - return an error
                logging.warning('Room ' + room_name + ' is full')
                response_dict['statusString'] = 'roomIsFull'

            else:
                # This is a new user joining the room
                room_module.add_user_to_room_transaction(current_user_id)
                response_dict['statusString'] = 'roomJoined'

        else:
            # remove 'user_id' from the room_dict since it is not stored on the room_obj.
            user_id = room_dict['user_id']
            del room_dict['user_id']

            # This is a newly created room. Therefore we should add the current user to room_members_ids.
            room_dict['room_members_ids'] = [user_id,]

            # The RoomName has been added to the roomName structure. Now create a new Room object
            # for the new room.
            @ndb.transactional
            def create_room_transaction(room_dict):
                room_obj = room_module.RoomInfo(**room_dict)
                room_obj.put()
                return room_obj

            room_obj = create_room_transaction(room_dict)
            response_dict['statusString'] = 'roomCreated'

        token_timeout =  240 # minutes
        client_id = room_obj.make_client_id(current_user_id)
        channel_token = channel.create_channel(client_id, token_timeout)
        response_dict['clientId'] = client_id
        response_dict['channelToken'] = channel_token
        response_dict['roomId'] = room_obj.key.id()

        http_helpers.set_http_ok_json_response(self.response, response_dict)

