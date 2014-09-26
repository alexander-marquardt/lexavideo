
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
    room_creator = ndb.StringProperty(default = None)
    room_joiner = ndb.StringProperty(default = None)
    
    # track if the users in the room have a channel open (channel api)
    room_creator_connected = ndb.BooleanProperty(default=False)
    room_joiner_connected = ndb.BooleanProperty(default=False)
    
    num_in_room = ndb.IntegerProperty(default=0)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    def __str__(self):
        result = '['
        if self.room_creator:
            result += "%s-%r" % (self.room_creator, self.room_creator_connected)
        if self.room_joiner:
            result += ", %s-%r" % (self.room_joiner, self.room_joiner_connected)
        result += ']'
        return result


    def make_client_id(self, user):
        return self.key.id() + '/' + user


    def remove_user(self, user):
        messaging.delete_saved_messages(self.make_client_id(user))
        if user == self.room_joiner:
            self.room_joiner = None
            self.room_joiner_connected = False
        if user == self.room_creator:
            if self.room_joiner:
                self.room_creator = self.room_joiner
                self.room_creator_connected = self.room_joiner_connected
                self.room_joiner = None
                self.room_joiner_connected = False
            else:
                self.room_creator = None
                self.room_creator_connected = False
        if self.get_occupancy() > 0:
            self.put()
        else:
            self.key.delete()
        

    def get_occupancy(self):
        occupancy = 0
        if self.room_creator:
            occupancy += 1
        if self.room_joiner:
            occupancy += 1
        return occupancy


    def get_other_user(self, user):
        if user == self.room_creator:
            return self.room_joiner
        elif user == self.room_joiner:
            return self.room_creator
        else:
            return None


    def has_user(self, user):
        return (user and (user == self.room_creator or user == self.room_joiner))


    def add_user(self, user):
        if not self.room_creator:
            self.room_creator = user
        elif not self.room_joiner:
            self.room_joiner = user
        else:
            raise RuntimeError('room is full')
        
        self.num_in_room = self.get_occupancy()
        self.put()


    def set_connected(self, user):
        if user == self.room_creator:
            self.room_creator_connected = True
        if user == self.room_joiner:
            self.room_joiner_connected = True

        self.put()


    def is_connected(self, user):
        if user == self.room_creator:
            return self.room_creator_connected
        if user == self.room_joiner:
            return self.room_joiner_connected
        
    def user_is_room_creator(self, user):
        return True if user == self.room_creator else False

    def user_is_room_joiner(self, user):
        return True if user == self.room_joiner else False


@ndb.transactional
def connect_user_to_room(room_name, active_user):
    room = RoomInfo.get_by_id(room_name)
    # Check if room has active_user in case that disconnect message comes before
    # connect message with unknown reason, observed with local AppEngine SDK.
    if room and room.has_user(active_user):
        room.set_connected(active_user)
        logging.info('User ' + active_user + ' connected to room ' + room_name)
        logging.info('RoomInfo ' + room_name + ' has state ' + str(room))
        
        other_user = room.get_other_user(active_user);
        
        message_obj = {'messageType' : 'roomStatus', 
                       'messagePayload': {
                           'roomName' : room.key.id(),
                           'room_creator' : room.room_creator,
                           'room_joiner'  : room.room_joiner,
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
        logging.warning('Unexpected Connect Message to room ' + room_name + 'by user ' + active_user)
        
    return room


class ConnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        key = self.request.get('from')
        room_name, user = key.split('/')
        with LOCK:
            room = connect_user_to_room(room_name, user)
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
            #room = RoomInfo.get_by_id(roomName)
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
        room_name = self.request.get('r')
        user = self.request.get('u')
        with LOCK:
            room = RoomInfo.get_by_id(room_name)
            if room:
                messaging.handle_message(room, user, message)
            else:
                logging.warning('Unknown room ' + room_name)