
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

    # When a user first joins the room, this will be the type of video that they will display. If a user is alone
    # in a room and changes their video type, then the next person to join will automatically have that video type
    # selected as well.
    currently_selected_video_type = ndb.StringProperty(default = 'HD Video')

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


    def get_other_user_id(self, user_id):
        if self.is_room_creator(user_id):
            return self.room_joiner_key.id() if self.room_joiner_key else None
        elif self.is_room_joiner(user_id):
            return self.room_creator_key.id() if self.room_creator_key else None
        else:
            return None


    def has_user(self, user_id):
        return (user_id and (self.is_room_creator(user_id) or self.is_room_joiner(user_id)))


    def add_user(self, user_key):

        # If user is already in the room, then just return without doing anything
        if user_key == self.room_creator_key or user_key == self.room_joiner_key:
            return

        # Add the user to the room
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



# Sends information about who is in the room, and which client should be designated as the 'rtcInitiator'
def send_room_status_to_room_members(room_obj, user_id):
    # This is called when a user either connects or disconnects from a room. It sends information
    # to room members indicating the status of the room.

    other_user_id = room_obj.get_other_user_id(user_id)
    other_user_name = None

    message_obj = {'messageType': 'roomStatus',
                   'messagePayload': {
                       'roomName': room_obj.room_name,
                       'currentlySelectedVideoType': room_obj.currently_selected_video_type,
                       # 'roomCreatorId' : room_obj.room_creator_key.id() if room_obj.room_creator_key else None,
                       # 'roomJoinerId'  : room_obj.room_joiner_key.id() if room_obj.room_joiner_key else None,
                       },
                   }

    user_obj = models.UserModel.get_by_id(user_id)
    user_name = user_obj.user_name

    if other_user_id:

        other_user_obj = models.UserModel.get_by_id(other_user_id)
        other_user_name = other_user_obj.user_name

        # send a message to the other user (the client already in the room) that someone has just joined the room
        logging.debug('Sending message to other_user: %s' % repr(message_obj))

        # If there is already another user in the room, then the second person to connect will be the
        # 'rtcInitiator'. By sending this 'rtcInitiator' value to the clients, this will re-initiate
        # the code for setting up a peer-to-peer rtc session. Therefore, this should only be sent
        # once per session, unless the users become disconnected and need to re-connect.
        message_obj['messagePayload']['rtcInitiator'] = False
        message_obj['messagePayload']['userId'] = other_user_id
        message_obj['messagePayload']['remoteUserName'] = user_name
        message_obj['messagePayload']['remoteUserId'] = user_id
        logging.info('Sending user %d room status %s' % (other_user_id, json.dumps(message_obj)))
        messaging.on_message(room_obj, other_user_id, json.dumps(message_obj))


    if other_user_id:
        # The current user will be the rtcInitiator since there is already someone in the room.
        message_obj['messagePayload']['rtcInitiator'] = True

    # Send a message to the active client, indicating the room status
    message_obj['messagePayload']['userId'] = user_id
    message_obj['messagePayload']['remoteUserName'] = other_user_name
    message_obj['messagePayload']['remoteUserId'] = other_user_id
    logging.info('Sending user %d room status %s' % (user_id, json.dumps(message_obj)))
    messaging.on_message(room_obj, user_id, json.dumps(message_obj))


def get_room_by_id(room_id):

    room_obj = RoomInfo.get_by_id(room_id)
    if room_obj:
        return room_obj
    else:
        logging.error('Attempt to get room by id failed. Room %d does not exist.' % room_id)
        return None


def connect_user_to_room(room_id, user_id):

    room_obj = RoomInfo.get_by_id(room_id)

    # Check if room has user_id in case that disconnect message comes before
    # connect message with unknown reason, observed with local AppEngine SDK.
    if room_obj and room_obj.has_user(user_id):
        room_obj.set_connected(user_id)
        logging.info('User %d' % user_id + ' connected to room ' + room_obj.room_name)
        logging.info('RoomInfo ' + room_obj.room_name + ' has state ' + str(room_obj))

        send_room_status_to_room_members(room_obj, user_id)

    else:
        logging.warning('Unexpected Connect Message to room %d' % room_id + 'by user %d' % user_id)
        
    return room_obj


class ConnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        client_id = self.request.get('from')
        room_id, user_id = [int(n) for n in client_id.split('/')]

        # Add user back into room. If they have a channel open to the room then they are by definition in the room
        room_obj = get_room_by_id(room_id)
        if room_obj:
            user_key = ndb.Key('UserModel', user_id)
            room_obj.add_user(user_key)
            assert(room_obj.has_user(user_id))
            connect_user_to_room(room_id, user_id)
            messaging.send_saved_messages(room_obj.make_client_id(user_id))
        else:
            logging.error('Invalid room id: %d' % room_id)


class DisconnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):

        client_id = self.request.get('from')
        room_id, user_id = [int(n) for n in client_id.split('/')]

        room_obj = RoomInfo.get_by_id(room_id)
        if room_obj:
            if room_obj.has_user(user_id):

                # Get the other_user_id before removing the user_id from the room
                other_user_id = room_obj.get_other_user_id(user_id)

                room_obj.remove_user(user_id)

                logging.info('User %d' % user_id + ' removed from room %d' % room_id)
                logging.info('Room %d ' % room_id + ' has state ' + str(room_obj))

                # The 'active' user has disconnected from the room, so we want to send an update to the remote
                # user informing them of the new status.
                if other_user_id:
                    send_room_status_to_room_members(room_obj, other_user_id)
            else:
                logging.error('Room %s (%d) does not have user %d - disconnect failed' % (room_obj.room_name, room_id, user_id))

        else:
            logging.error('Room %d' % room_id + ' does not exist. Cannot disconnect user %d' % user_id)
