#!/usr/bin/python2.4


import json
import logging
import re
import threading
import webapp2

from google.appengine.api import channel
from google.appengine.api import datastore_errors
from google.appengine.ext import ndb

import vidsetup

from video_src import constants
from video_src import http_helpers
from video_src import room_module
from video_src import status_reporting
from video_src import utils


from video_src.error_handling import handle_exceptions


class HandleRooms(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, room_name_from_url=None):
        room_name_from_url = room_name_from_url.decode('utf8')
        room_name = room_name_from_url.lower()

        if room_name:
            logging.info('Query for room name: ' + room_name)
            room_obj = room_module.RoomInfo.get_by_id(room_name)

            if room_obj:
                response_dict = {
                    'roomName': room_name,
                    'numInRoom': room_obj.num_in_room,
                }
                logging.info('Found room: ' + repr(room_obj))

            else:
                response_dict = {
                    'roomName': room_name,
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
                room_name_added = True
            else:
                room_name_added = False

            return room_name_added

        try:
            room_name_added = create_room_name_transaction(room_name)
            if not room_name_added:
                http_helpers.set_http_ok_json_response(self.response, {'status': 'roomExistsAlreadyNotCreated'})
                return

        except:
            # Provide feedback to the user to indicate that the room was not created
            http_helpers.set_http_ok_json_response(self.response, {'status': 'datastoreErrorUnableToCreateRoom'})
            return


        # The following get is only used for verifying that the code is functioning correctly.
        room_obj = room_module.RoomInfo.query(room_module.RoomInfo.room_name == room_name).get()
        if room_obj:
            raise Exception('Room name %s already has a room object created, '
            'but there was not a value stored in the RoomName structure' % room_name)

        if room_name_added:
            # The RoomName has been added to the roomName structure. Now create a new Room object
            # for the new room.
            @ndb.transactional
            def create_room_transaction(room_dict):
                room_obj = room_module.RoomInfo(**room_dict)
                room_obj.put()

            create_room_transaction(room_dict)
            http_helpers.set_http_ok_json_response(self.response, {'status': 'roomCreated'})



    @handle_exceptions
    def delete(self, room_name_from_url):
        logging.info('Called with DELETE')

    @handle_exceptions
    def put(self, room_name_from_url):
        logging.info('Called wilth PUT')

