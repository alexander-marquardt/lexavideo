import logging
from google.appengine.ext import ndb
from video_src import models

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
        
    def delete_saved_messages(self, clientId):
        messages = models.Message.get_saved_messages(clientId)
        for message in messages:
            message.key.delete()
            logging.info('Deleted the saved message for ' + clientId)        
            
            
    def remove_user(self, user):
        self.delete_saved_messages(self.make_client_id(user))
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