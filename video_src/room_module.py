
import json
import logging
import webapp2

from google.appengine.ext import ndb

from video_src import messaging

from video_src.error_handling import handle_exceptions

# Lock for syncing DB operation in concurrent requests handling.
# TODO(brave): keeping working on improving performance with thread syncing.
# One possible method for near future is to reduce the message caching.
import threading
LOCK = threading.RLock()



# Room will contain data about which users are currently communicating with each other.
class Room(ndb.Model):
    """All the data we store for a room"""
    
    # track the users that have joined into a room (ie. opened the URL to join a room)
    roomCreator = ndb.StringProperty(default = None)
    roomJoiner = ndb.StringProperty(default = None)
    
    # track if the users in the room have a channel open (channel api)
    roomCreatorConnected = ndb.BooleanProperty(default=False)
    roomJoinerConnected = ndb.BooleanProperty(default=False)
    
    numInRoom = ndb.IntegerProperty(default=0)

    def __str__(self):
        result = '['
        if self.roomCreator:
            result += "%s-%r" % (self.roomCreator, self.roomCreatorConnected)
        if self.roomJoiner:
            result += ", %s-%r" % (self.roomJoiner, self.roomJoinerConnected)
        result += ']'
        return result



    def make_client_id(self, user):
        return self.key.id() + '/' + user        
    
            
            
    def remove_user(self, user):
        messaging.delete_saved_messages(self.make_client_id(user))
        if user == self.roomJoiner:
            self.roomJoiner = None
            self.roomJoinerConnected = False
        if user == self.roomCreator:
            if self.roomJoiner:
                self.roomCreator = self.roomJoiner
                self.roomCreatorConnected = self.roomJoinerConnected
                self.roomJoiner = None
                self.roomJoinerConnected = False
            else:
                self.roomCreator = None
                self.roomCreatorConnected = False
        if self.get_occupancy() > 0:
            self.put()
        else:
            self.key.delete()
        
        



    def get_occupancy(self):
        occupancy = 0
        if self.roomCreator:
            occupancy += 1
        if self.roomJoiner:
            occupancy += 1
        return occupancy

    def get_other_user(self, user):
        if user == self.roomCreator:
            return self.roomJoiner
        elif user == self.roomJoiner:
            return self.roomCreator
        else:
            return None

    def has_user(self, user):
        return (user and (user == self.roomCreator or user == self.roomJoiner))

    def add_user(self, user):
        if not self.roomCreator:
            self.roomCreator = user
        elif not self.roomJoiner:
            self.roomJoiner = user
        else:
            raise RuntimeError('room is full')
        
        self.numInRoom = self.get_occupancy()
        self.put()

    def set_connected(self, user):
        if user == self.roomCreator:
            self.roomCreatorConnected = True
        if user == self.roomJoiner:
            self.roomJoinerConnected = True

        self.put()


    def is_connected(self, user):
        if user == self.roomCreator:
            return self.roomCreatorConnected
        if user == self.roomJoiner:
            return self.roomJoinerConnected
        
    def user_is_room_creator(self, user):
        return True if user == self.roomCreator else False

    def user_is_room_joiner(self, user):
        return True if user == self.roomJoiner else False
    
@ndb.transactional
def connect_user_to_room(roomName, active_user):
    room = Room.get_by_id(roomName)
    # Check if room has active_user in case that disconnect message comes before
    # connect message with unknown reason, observed with local AppEngine SDK.
    if room and room.has_user(active_user):
        room.set_connected(active_user)
        logging.info('User ' + active_user + ' connected to room ' + roomName)
        logging.info('Room ' + roomName + ' has state ' + str(room))
        
        other_user = room.get_other_user(active_user);
        
        message_obj = {'messageType' : 'roomStatus', 
                       'messagePayload': {
                           'roomName' : room.key.id(),
                           'roomCreator' : room.roomCreator,
                           'roomJoiner'  : room.roomJoiner,
                       }    
                       }
    
        if (other_user):
            # If there is another user already in the room, then the other user should be the creator of the room. 
            # By design, if the creator of a room leaves the room, it should be vacated.
            assert(room.user_is_room_creator(other_user))
            # send a message to the other user (the room creator) that someone has just joined the room
            logging.debug('Sending message to other_user: %s' % repr(message_obj))
            messaging.on_message(room, other_user, json.dumps(message_obj))  
            
        # Send a message to the active_user, indicating the "roomStatus"
        logging.debug('Sending message to active_user: %s' % repr(message_obj))
        messaging.on_message(room, active_user, json.dumps(message_obj))        
        
    else:
        logging.warning('Unexpected Connect Message to room ' + roomName + 'by user ' + active_user)
        
    return room

class ConnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        key = self.request.get('from')
        roomName, user = key.split('/')
        with LOCK:
            room = connect_user_to_room(roomName, user)
            if room and room.has_user(user):
                messaging.send_saved_messages(room.make_client_id(user))

class DisconnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        # temporarily disable disconnect -- this will be replaced with a custom disconnect call from the javascript as opposed to monitoring 
        # the channel stauts.
        pass    

        #key = self.request.get('from')
        #roomName, user = key.split('/')
        #with LOCK:
            #room = Room.get_by_id(roomName)
            #if room and room.has_user(user):
                #other_user = room.get_other_user(user)
                #room.remove_user(user)
                #logging.info('User ' + user + ' removed from room ' + roomName)
                #logging.info('Room ' + roomName + ' has state ' + str(room))
                #if other_user and other_user != user:

                    #message_object = {"messageType": "sdp",
                                                        #"messagePayload" : {
                                                            #"type" : "bye"
                                                        #}}
                    #channel.send_message(make_client_id(room, other_user),
                                                                #json.dumps(message_object))
                    #logging.info('Sent BYE to ' + other_user)
        #logging.warning('User ' + user + ' disconnected from room ' + roomName)
        

class MessagePage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        message = self.request.body
        roomName = self.request.get('r')
        user = self.request.get('u')
        with LOCK:
            room = Room.get_by_id(roomName)
            if room:
                messaging.handle_message(room, user, message)
            else:
                logging.warning('Unknown room ' + roomName)  