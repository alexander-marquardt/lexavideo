import logging
from google.appengine.ext import ndb
from video_src import models

# Room will contain data about which users are currently communicating with each other.
class Room(ndb.Model):
    """All the data we store for a room"""
    
    # track the users that have joined into a room (ie. opened the URL to join a room)
    room_creator = ndb.StringProperty(default = None)
    room_joiner = ndb.StringProperty(default = None)
    
    # track if the users in the room have a channel open (channel api)
    room_creator_connected = ndb.BooleanProperty(default=False)
    room_joiner_connected = ndb.BooleanProperty(default=False)

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
        
    def delete_saved_messages(self, client_id):
        messages = models.Message.get_saved_messages(client_id)
        for message in messages:
            message.key.delete()
            logging.info('Deleted the saved message for ' + client_id)        
            
            
    def remove_user(self, user):
        self.delete_saved_messages(self.make_client_id(user))
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