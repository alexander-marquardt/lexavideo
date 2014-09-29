
import json
import logging
import webapp2

from google.appengine.ext import ndb

from video_src import messaging
from video_src import models

from video_src.error_handling import handle_exceptions


class RoomName(ndb.Model):
    # This is a class that will be keyed by the room name, and that we use for guaranteeing
    # that each room name is unique. Once a room name has been determined to be unique, then
    # we will write the Room object (below)
    creation_date = ndb.DateTimeProperty(auto_now_add=True)
    pass

# RoomInfo will contain data about which users are currently communicating with each other.
class RoomInfo(ndb.Model):
    """All the data necessary for keeping track of room names and occupancy etc. """

    # This is the lower case room name - ie. user wrote 'Alex', but it will be stored as 'alex'
    room_name = ndb.StringProperty(default = None)

    # The following is used for showing/remembering the room nam as it was written i.e.
    # if the user wrote 'aLeX', it will be stored here as 'aLeX'
    room_name_as_written = ndb.StringProperty(default = None)
    
    # track the users that have joined into a room (ie. opened the URL to join a room)
    room_creator_key = ndb.KeyProperty(kind = models.UserModel)
    room_joiner_key = ndb.KeyProperty(kind = models.UserModel)
    
    # track if the users in the room have a channel open (channel api)
    room_creator_channel_open = ndb.BooleanProperty(default=False)
    room_joiner_channel_open = ndb.BooleanProperty(default=False)
    

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    def __str__(self):
        result = '['
        if self.room_creator_key:
            result += "%d-%r" % (self.room_creator_key.id(), self.room_creator_channel_open)
        if self.room_joiner_key:
            result += ", %d-%r" % (self.room_joiner_key.id(), self.room_joiner_channel_open)
        result += ']'
        return result


    def make_client_id(self, user_id):
        return str(self.key.id()) + '/' + str(user_id)

    def is_room_creator(self, user_id):
        if self.room_creator_key and user_id == self.room_creator_key.id():
            return True
        else:
            return False

    def is_room_joiner(self, user_id):
        if self.room_joiner_key and user_id == self.room_joiner_key.id():
            return True
        else:
            return False


    def remove_user(self, user_id):
        messaging.delete_saved_messages(self.make_client_id(user_id))
        if self.is_room_joiner(user_id):
            self.room_joiner_key = None
            self.room_joiner_channel_open = False
        if self.is_room_creator(user_id):
            if self.room_joiner_key:
                self.room_creator_key = self.room_joiner_key
                self.room_creator_channel_open = self.room_joiner_channel_open
                self.room_joiner_key = None
                self.room_joiner_channel_open = False
            else:
                self.room_creator_key = None
                self.room_creator_channel_open = False
        if self.get_occupancy() > 0:
            self.put()
        else:
            self.key.delete()
        

    def get_occupancy(self):
        occupancy = 0
        if self.room_creator_key:
            occupancy += 1
        if self.room_joiner_key:
            occupancy += 1
        return occupancy


    def get_other_user(self, user_id):
        if self.is_room_creator(user_id):
            return self.room_joiner_key.id() if self.room_joiner_key else None
        elif self.is_room_joiner(user_id):
            return self.room_creator_key.id() if self.room_creator_key else None
        else:
            return None


    def has_user(self, user_id):
        return (user_id and (self.is_room_creator(user_id) or self.is_room_joiner(user_id)))


    def add_user(self, user_key):
        if not self.room_creator_key:
            self.room_creator_key = user_key
        elif not self.room_joiner_key:
            self.room_joiner_key = user_key
        else:
            raise RuntimeError('room is full')
        
        self.put()


    def set_connected(self, user_id):
        if self.is_room_creator(user_id):
            self.room_creator_channel_open = True
        if self.is_room_joiner(user_id):
            self.room_joiner_channel_open = True

        self.put()


    def is_connected(self, user_id):
        if self.is_room_creator(user_id):
            return self.room_creator_channel_open
        if self.is_room_joiner(user_id):
            return self.room_joiner_channel_open


def connect_user_to_room(room_id, active_user_id):

    room_obj = RoomInfo.get_by_id(room_id)

    # Check if room has active_user in case that disconnect message comes before
    # connect message with unknown reason, observed with local AppEngine SDK.
    if room_obj and room_obj.has_user(active_user_id):
        room_obj.set_connected(active_user_id)
        logging.info('User %d' % active_user_id + ' connected to room ' + room_obj.room_name)
        logging.info('RoomInfo ' + room_obj.room_name + ' has state ' + str(room_obj))
        
        other_user = room_obj.get_other_user(active_user_id)
        
        message_obj = {'messageType' : 'roomStatus', 
                       'messagePayload': {
                           'roomName' : room_obj.room_name,
                           'roomCreatorId' : room_obj.room_creator_key.id() if room_obj.room_creator_key else None,
                           'roomJoinerId'  : room_obj.room_joiner_key.id() if room_obj.room_joiner_key else None,
                       }    
                       }
    
        if (other_user):
            # If there is another user already in the room, then the other user should be the creator of the room. 
            # By design, if the creator of a room leaves the room, it should be vacated.
            if(not room_obj.is_room_creator(other_user)):
                logging.error('Other user should be creator if room already exists - should investigate what is happeneing')

            # send a message to the other user (the room creator) that someone has just joined the room
            logging.debug('Sending message to other_user: %s' % repr(message_obj))
            messaging.on_message(room_obj, other_user, json.dumps(message_obj))
            
        # Send a message to the active_user, indicating the "roomStatus"
        logging.debug('Sending message to active_user: %s' % repr(message_obj))
        messaging.on_message(room_obj, active_user_id, json.dumps(message_obj))
        
    else:
        logging.warning('Unexpected Connect Message to room %d' % room_id + 'by user %d' % active_user_id)
        
    return room_obj


class ConnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        key = self.request.get('from')
        # the following list comprehension returns integer values that make up the client_id
        room_id, user_id = [int(n) for n in key.split('/')]

        room = connect_user_to_room(room_id, user_id)
        if room and room.has_user(user_id):
            messaging.send_saved_messages(room.make_client_id(user_id))


class DisconnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):

        key = self.request.get('from')
        room_id, user_id = key.split('/')

        room_obj = RoomInfo.get_by_id(room_id)
        if room_obj and room_obj.has_user(user_id):
            other_user_id = room_obj.get_other_user(user_id)
            room_obj.remove_user(user_id)
            logging.info('User %d' % user_id + ' removed from room %d' % room_id)
            logging.info('Room %d ' % room_id + ' has state ' + str(room_obj))
            if other_user_id and other_user_id != user_id:

                message_object = {"messageType": "sdp",
                                                    "messagePayload" : {
                                                        "type" : "bye"
                                                    }}

                messaging.on_message(room_obj, other_user_id, json.dumps(message_object))

                logging.info('Sent BYE to ' + other_user_id)

        logging.warning('User %d' % user_id + ' disconnected from room %d' % room_id)
        

class MessagePage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        message = self.request.body
        room_id = int(self.request.get('r'))
        user_id = int(self.request.get('u'))
        room_obj = RoomInfo.get_by_id(room_id)
        if room_obj:
                messaging.handle_message(room_obj, user_id, message)
        else:
            logging.error('Unknown room_id %d' % room_id)