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

from video_src.error_handling import handle_exceptions


class HandleRooms(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, room_name=None):
        room_name = room_name.decode('utf8')
        if room_name:
            logging.info('Query for room name: ' + room_name)
            room_obj = room_module.Room.get_by_id(room_name)

            if room_obj:
                response_dict = {
                    'roomName': room_name,
                    'numInRoom': room_obj.numInRoom,
                }
                logging.info('Found room: ' + repr(room_obj))

            else:
                response_dict = {
                    'roomName': room_name,
                    'numInRoom': 0
                }
                logging.info('No room: ' + repr(room_obj))

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            room_query = room_module.Room.query()
            rooms_list = []

            for room_obj in room_query:
                room_dict = room_obj.to_dict()
                room_dict['roomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            http_helpers.set_http_ok_json_response(self.response, rooms_list)


    @handle_exceptions
    def post(self, room_name):
        room_dict = json.loads(self.request.body)

        # Need to get the URL encoded data from utf8. Note that json encoded data appers to already be decoded. 
        room_name = room_name.decode('utf8')
        assert (room_dict['roomName'] == room_name)
        del room_dict['roomName']


        # Make sure that the room name is valid before continuing.
        # These errors should be extremely rare since these values are
        # already formatted to be within bounds and characters checked by the client-side javascript. 
        if not constants.valid_room_name_regex_compiled.match(room_name):
            raise Exception('Room name regexp did not match')
        if len(room_name) > constants.room_max_chars or len(room_name) < constants.room_min_chars:
            raise Exception('Room name length of %s is out of range' % len(room_name))


        def create_room_transaction(room_name, room_dict):
            # Run the room creation in a transaction so that the first person that creates a room is the 'owner'
            # and so that each room is only created once. 

            room_obj = room_module.Room.get_by_id(room_name)

            if not room_obj:
                room_obj = room_module.Room(id=room_name, **room_dict)
                room_obj.put()
                http_helpers.set_http_ok_json_response(self.response, {'status': 'roomCreated'})
            else:
                http_helpers.set_http_ok_json_response(self.response, {'status': 'roomExistsAlreadyNotCreated'})


        try:
            ndb.transaction(lambda: create_room_transaction(room_name, room_dict))
        except datastore_errors.TransactionFailedError:
            # Provide feedback to the user to indicate that the room was not created
            http_helpers.set_http_ok_json_response(self.response, {'status': 'datastoreErrorUnableToCreateRoom'})


    @handle_exceptions
    def delete(self, product_id):
        logging.info('Called with DELETE')

    @handle_exceptions
    def put(self):
        logging.info('Called wilth PUT')

