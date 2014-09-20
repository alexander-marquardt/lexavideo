
import json
import webapp2
import logging

from google.appengine.ext import ndb
from google.appengine.api import channel

from video_src import room_module

from video_src.error_handling import handle_exceptions

# Lock for syncing DB operation in concurrent requests handling.
# TODO(brave): keeping working on improving performance with thread syncing.
# One possible method for near future is to reduce the message caching.
import threading
LOCK = threading.RLock()

class Message(ndb.Model):
    clientId = ndb.StringProperty()
    msg = ndb.TextProperty()

    @classmethod
    def get_saved_messages(cls, clientId):
        return cls.gql("WHERE clientId = :id", id=clientId)

def handle_message(room, user, message):
    # This function passes a message from one user in a given "room" to the other user in the same room.
    # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
    # as for passing video and other information from one user to the other. 

    message_obj = json.loads(message)
    message = message.decode("utf-8")
    other_user = room.get_other_user(user)
    roomName = room.key.id()

    message_type = message_obj['messageType']
    message_payload = message_obj['messagePayload']

    if message_type == 'sdp' and message_payload['type'] == 'bye':
        # This would remove the other_user in loopback test too.
        # So check its availability before forwarding Bye message.
        room.remove_user(user)
        logging.info('User ' + user + ' quit from room ' + roomName)
        logging.info('Room ' + roomName + ' has state ' + str(room))

    if message_type == 'videoSettings':
        logging.info('***** videoSettings message received: ' + repr(message_payload))


    if other_user and room.has_user(other_user):
        if message_type == 'sdp' and message_payload['type'] == 'offer':
            # This is just for debugging
            logging.info('sdp offer. Payload: %s' % repr(message_payload))

        if message_type == 'sdp' and message_payload['type'] == 'offer' and other_user == user:
            # Special case the loopback scenario.
            #message = make_loopback_answer(message)
            pass

        on_message(room, other_user, message)

    else:
        logging.warning('Cannot deliver message from user: %s to other_user: %s since they are not in the room: %s' % (user, other_user, roomName))
        # For unittest
        #on_message(room, user, message)

    
def delete_saved_messages(self, clientId):
    messages = messaging.Message.get_saved_messages(clientId)
    for message in messages:
        message.key.delete()
        logging.info('Deleted the saved message for ' + clientId)    


@ndb.transactional
def connect_user_to_room(roomName, active_user):
    room = room_module.Room.get_by_id(roomName)
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
            on_message(room, other_user, json.dumps(message_obj))  
            
        # Send a message to the active_user, indicating the "roomStatus"
        logging.debug('Sending message to active_user: %s' % repr(message_obj))
        on_message(room, active_user, json.dumps(message_obj))        
        
    else:
        logging.warning('Unexpected Connect Message to room ' + roomName + 'by user ' + active_user)
        
    return room


def send_saved_messages(clientId):
    messages = Message.get_saved_messages(clientId)
    for message in messages:
        channel.send_message(clientId, message.msg)
        logging.info('Delivered saved message to ' + clientId)
        message.delete()
        
def on_message(room, user, message):
    clientId = room.make_client_id(user)
    if room.is_connected(user):
        channel.send_message(clientId, message)
        logging.info('Delivered message to user ' + user)
    else:
        new_message = models.Message(clientId = clientId, msg = message)
        new_message.put()
        #logging.info('Saved message for user ' + user)
        
        
def create_channel(room, user, duration_minutes):
    clientId = room.make_client_id(user)
    return channel.create_channel(clientId, duration_minutes)        




class ConnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        key = self.request.get('from')
        roomName, user = key.split('/')
        with LOCK:
            room = connect_user_to_room(roomName, user)
            if room and room.has_user(user):
                send_saved_messages(room.make_client_id(user))

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
            room = room_module.Room.get_by_id(roomName)
            if room:
                handle_message(room, user, message)
            else:
                logging.warning('Unknown room ' + roomName)