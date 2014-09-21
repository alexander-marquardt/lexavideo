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
    def get(self, roomName=None):
        roomName = roomName.decode('utf8') 
        if roomName:
            logging.info('Query for room name: ' + roomName)
            room_obj = room_module.Room.get_by_id(roomName)
            
            if room_obj:
                response_dict = {
                    'roomName' : roomName,
                    'numInRoom' : room_obj.numInRoom,
                }
                logging.info('Found room: ' + repr(room_obj))
                
            else:
                response_dict = { 
                    'roomName' : roomName,                   
                    'numInRoom' : 0
                }
                logging.info('No room: ' + repr(room_obj))
                

            http_helpers.set_http_ok_json_response(self.response, response_dict)
        
        else: 
            room_query = models.Room.query()
            rooms_list = []
            
            for room_obj in room_query:
                room_dict =room_obj.to_dict()
                room_dict['roomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            http_helpers.set_http_ok_json_response(self.response, rooms_list )


    @handle_exceptions        
    def post(self, roomName):
        room_dict = json.loads(self.request.body)
            
        # Need to get the URL encoded data from utf8. Note that json encoded data appers to already be decoded. 
        roomName = roomName.decode('utf8') 
        assert(room_dict['roomName'] == roomName)
        del room_dict['roomName']
        
        
        # Make sure that the room name is valid before continuing. These errors should be extremely rare since these values are 
        # already formatted to be within bounds and characters checked by the client-side javascript. 
        if not constants.valid_room_name_regex_compiled.match(roomName):
            raise Exception('Room name regexp did not match')
        if len(roomName) > constants.room_max_chars or len(roomName) < constants.room_min_chars:
            raise Exception('Room name length of %s is out of range' % len(roomName))
            
        
        def create_room_transaction(roomName, roomDict):
            # Run the room creation in a transaction so that the first person that creates a room is the 'owner'
            # and so that each room is only created once. 
            
            room_obj = room_module.Room.get_by_id(roomName)
            
            if not room_obj:
                room_obj = room_module.Room(id=roomName, **room_dict)
                room_obj.put()   
                http_helpers.set_http_ok_json_response(self.response, {'status' : 'roomCreated'})
            else:
                http_helpers.set_http_ok_json_response(self.response, {'status' : 'roomExistsAlreadyNotCreated'})
            
            
        try:
            ndb.transaction(lambda:create_room_transaction(roomName, room_dict))   
        except datastore_errors.TransactionFailedError:
            # Provide feedback to the user to indicate that the room was not created
            http_helpers.set_http_ok_json_response(self.response, {'status' : 'datastoreErrorUnableToCreateRoom'})

            
    @handle_exceptions
    def delete(self, product_id):
        logging.info('Called with DELETE')
                
    @handle_exceptions
    def put(self):  
        logging.info('Called wilth PUT')
        
