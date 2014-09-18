#!/usr/bin/python2.4
#

import vidsetup

import cgi
import logging
import os
import random
import re
import json
import jinja2
import webapp2
import threading
from google.appengine.api import channel
from google.appengine.ext import ndb

from video_src import status_reporting, http_helpers, room_module
from video_src.error_handling import handle_exceptions

def set_response_to_json(response, dict_to_jsonify):
    # simple helper function to set response output to a json version of the dict_to_jsonify that is passed in.
    response.headers['Content-Type'] = 'application/json'  
    response.out.write(json.dumps(dict_to_jsonify))   
    
        
class HandleRooms(webapp2.RequestHandler):

    @handle_exceptions
    def get(self, roomName=None):
        roomName = roomName.decode('utf8') 
        if roomName:
            logging.info('Query for room name: ' + roomName)
            room_obj = room_module.Room.get_by_id(roomName)
            
            if room_obj:
                response_obj = {
                    'roomOccupancy' : room_obj.roomOccupancy,
                }
                logging.info('Found room: ' + repr(room_obj))
                
            else:
                response_obj = {'roomOccupancy' : 0}
                logging.info('No room: ' + repr(room_obj))
                

            set_response_to_json(self.response, response_obj)
        
        else: 
            room_query = models.Room.query()
            rooms_list = []
            
            for room_obj in room_query:
                room_dict =room_obj.to_dict()
                room_dict['roomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            set_response_to_json(self.response, rooms_list)


    @handle_exceptions        
    def post(self, roomName):
        room_dict = json.loads(self.request.body)
            
        # Need to get the URL encoded data back to utf8. Note that json encoded data is already in utf8 so nothing needs to be done
        roomName = roomName.decode('utf8') 
        logging.info('roomName after decode: %s' % roomName)
        
        assert(room_dict['roomName'] == roomName)
        del room_dict['roomName']
        room_obj = room_module.Room.get_by_id(roomName)
        
        if room_obj:
            # update an existing item:
            room_obj.populate(**room_dict)
        else:
            room_obj = room_module.Room(id=roomName, **room_dict)
            
        room_obj.put()   
        set_response_to_json(self.response, room_obj.to_dict())

            
    @handle_exceptions
    def delete(self, product_id):
        
        product_id = int(product_id)
        if product_id:
            product_for_sale = models.ProductForSale.get_by_id(product_id)
            if product_for_sale:
                product_for_sale.key.delete()
                set_response_to_json(self.response, {'status' : "OK", 'message' : "deleted id %d" % product_id})
            else:
                set_response_to_json(self.response, {'status' : "Warning", 'message' : "not found id %d" % product_id})
                
    @handle_exceptions
    def put(self):  
        logging.info("Called wilth PUT")
        
