#!/usr/bin/python2.4


import json
import logging

import webapp2

from google.appengine.ext import ndb


from video_src import constants
from video_src import http_helpers
from video_src import messaging
from video_src import models
from video_src import room_module
from video_src import status_reporting
from video_src import utils


from video_src.error_handling import handle_exceptions

class AddUserToRoom(webapp2.RequestHandler):

    @handle_exceptions
    def post(self, room_name_from_url):
        room_dict = json.loads(self.request.body)
        room_name_from_url = room_name_from_url.decode('utf8')
        room_name = room_name_from_url.lower()

        if room_name:

            room = room_module.RoomInfo.get_by_id(room_name)
            if not room and debug != "full":
                # New room.
                user = generate_random(8)
                room = room_module.RoomInfo(id = room_name)
                room.add_user(user)
                logging.info('First user ' + user + ' added to room ' + room_name)
                if debug != 'loopback':
                    initiator = 0
                else:
                    room.add_user(user)
                    initiator = 1
            elif room and room.get_occupancy() == 1 and debug != 'full':
                # 1 occupant.
                user = generate_random(8)
                room.add_user(user)
                logging.info('Second user ' + user + ' added to room ' + room_name)
                initiator = 1
            else:
                # 2 occupants (full).
                logging.warning('Room ' + room_name + ' is full')

                params = {
                    'errorStatus': 'roomIsFull',
                    'roomName': room_name,
                }
                return json.dumps(params)

            logging.info('Room ' + room_name + ' has state ' + str(room))

            # token_timeout for channel creation, default 30min, max 1 days, min 3min.
            token_timeout =  1440 #1440 minutes is 1 day.
            token = messaging.create_channel(room, user, token_timeout)
            turn_url = 'https://computeengineondemand.appspot.com/'
            turn_url = turn_url + 'turn?' + 'username=' + user + '&key=4080218913'

        else :
            token = ''
            turn_url = ''


        # TODO deal with channelToken - needs to be passed to javascript
        'channelToken'# : token
        'turnUrl'# : turn_url,



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


        room_obj = room_module.RoomInfo.query(room_module.RoomInfo.room_name == room_name).get()
        current_user_id = room_dict['user_id']
        current_user_key = models.UserModel.query(models.UserModel.user_id == current_user_id).get(keys_only = True)

        if room_obj:
            # The room has already been created - try to add this user to the room.
            # Check to make sure that they have not already been added before adding.

            occupancy = room_obj.get_occupancy()

            if current_user_key == room_obj.room_creator_key or current_user_key == room_obj.room_joiner_key:
                # do nothing as this user is already in the room - report status as "roomJoined"
                # so javascript does not have to deal with a special case.
                response_dict = {'statusString': 'roomJoined'}

            elif occupancy == 2:
                # Room is full - return an error
                logging.warning('Room ' + room_name + ' is full')
                response_dict = {'statusString': 'roomIsFull'}

            else:
                # This is a new user joining the room
                room_obj.add_user(current_user_key)
                response_dict = {'statusString': 'roomJoined'}

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:

            # This is a newly created room. Therefore we should set the room creator to the user_id that was passed in.
            room_dict['room_creator_key'] = current_user_key
            del room_dict['user_id']

            # The RoomName has been added to the roomName structure. Now create a new Room object
            # for the new room.
            @ndb.transactional
            def create_room_transaction(room_dict):
                room_obj = room_module.RoomInfo(**room_dict)
                room_obj.put()

            create_room_transaction(room_dict)

            http_helpers.set_http_ok_json_response(self.response, {'statusString': 'roomCreated'})

