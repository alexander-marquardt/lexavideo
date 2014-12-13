
import copy
import logging

from google.appengine.ext import ndb
from video_src import models

class RoomAlreadyExistsException(Exception): pass

class ChatRoomName(ndb.Model):
    # This is a class that will be keyed by the room name, and that we use for guaranteeing
    # that each room name is unique. Once a room name has been determined to be unique, then
    # we will write the Room object (below)
    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    # Each ChatRoomName object is tightly associated with a ChatRoomInfo object.
    # room_info_key keeps track of which object is associated with this name.
    room_info_key = ndb.KeyProperty(kind='ChatRoomInfo')

    @classmethod
    def get_room_by_name(cls, chat_room_name):
        chat_room_name_obj_key = ndb.Key('ChatRoomName', chat_room_name)
        chat_room_name_obj = chat_room_name_obj_key.get()
        return chat_room_name_obj

    # creates an object that is keyed by the chat_room_name.
    # This is used for guaranteeing uniqueness of each room name. If a room matching chat_room_name has already
    # been created then an exception will be raised, and the client will be notified that they have to select
    # a different room name. This should be rare since the name that they submit has already been "pre-checked"
    # while they were typing it into the input box.
    @classmethod
    @ndb.transactional(xg=True)
    def txn_create_room_by_name(cls, chat_room_name, room_dict, room_creator_user_key):

        chat_room_name_obj = cls.get_room_by_name(chat_room_name)
        if chat_room_name_obj:
            raise RoomAlreadyExistsException('Room %s already exists.' % chat_room_name)

        # No exception - this is a new room name
        chat_room_name_obj = cls(id=chat_room_name)
        room_info_obj = ChatRoomInfo.txn_create_room(room_dict, chat_room_name_obj.key, room_creator_user_key)
        chat_room_name_obj.room_info_key = room_info_obj.key
        chat_room_name_obj.put()

        return chat_room_name_obj, room_info_obj



# ChatRoomInfo will contain data about which users are currently in a given chat room
class ChatRoomInfo(ndb.Model):
    """All the data necessary for keeping track of room names and occupancy etc. """
    
    room_creator_user_key = ndb.KeyProperty(kind='UserModel')

    # For convenience, provide a link back to the ChatRoomName object that is associated with the current object.
    chat_room_name_obj_key = ndb.KeyProperty(kind='ChatRoomName')

    # This is the lower case room name - ie. user wrote 'Alex', but it will be stored as 'alex'
    chat_room_name = ndb.StringProperty(default = None)

    # The following is used for showing/remembering the room nam as it was written i.e.
    # if the user wrote 'aLeX', it will be stored here as 'aLeX'
    chat_room_name_as_written = ndb.StringProperty(default = None)

    # room_members_ids contains ids of all users currently in a chat room.
    room_members_ids = ndb.IntegerProperty(repeated=True)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    # As each user enables video, their user ID will be added to this array (which should never have more
    # than two ids given the current video standard). If a user stops their video or leaves a room, then
    # their id will be removed from this array.
    # When the second user activates their video, then the WebRTC signalling will start between the two users.
    video_elements_enabled_user_ids = ndb.IntegerProperty(repeated=True)


    # The ChatRoomName has been added to the chatRoomName structure. Now create a new Room object
    # for the new room.
    @classmethod
    @ndb.transactional
    def txn_create_room(cls, room_dict, chat_room_name_obj_key, room_creator_user_key):

        # make a copy of room_dict, so that our modifications don't accidentally change it for other functions
        room_info_obj_dict = copy.copy(room_dict)

        # remove 'user_id' from the room_dict since it will not be stored on the room_info_obj as 'user_id'
        del room_info_obj_dict['user_id']

        room_info_obj_dict['chat_room_name_obj_key'] = chat_room_name_obj_key
        room_info_obj_dict['room_creator_user_key'] = room_creator_user_key
        room_info_obj = cls(**room_info_obj_dict)
        room_info_obj.put()
        return room_info_obj

    def __str__(self):
        result = '['
        if self.room_members_ids:
            result += "room_members_ids: "
            for i in range(len(self.room_members_ids)):
                result += "%d " % (self.room_members_ids[i])

            result += " video_elements_enabled_user_ids: "
            for i in range(len(self.video_elements_enabled_user_ids)):
                result += "%d " % (self.video_elements_enabled_user_ids[i])

        result += ']'
        return result


    def make_client_id(self, user_id):
        # client id is the room id + / + user id
        return str(self.key.id()) + '/' + str(user_id)


    def get_occupancy(self):
        return len(self.room_members_ids)

    def get_other_user_id(self, user_id):
        # Currently this function is written based on the assumption that there is a maximum of two users in a room.
        # If this assumption is not true in the future, then we would have to pass back a list of "other users"
        occupancy = self.get_occupancy()
        if occupancy == 0:
            raise Exception('This function should not be called on an empty room')
        elif occupancy == 1:
            # only one user in the room means that there is no "other user"
            return None
        elif occupancy == 2:
            for i in range(len(self.room_members_ids)):
                if self.room_members_ids[i] !=  user_id:
                    return self.room_members_ids[i]
        else: # occupancy > 2:
            raise Exception('Room should not have more than two people in it')

    def has_user(room_info_obj, user_id):
        if user_id in room_info_obj.room_members_ids:
            return True
        else:
            return False


def get_room_by_id(room_id):

    room_info_obj = ChatRoomInfo.get_by_id(room_id)
    if not room_info_obj:
        logging.error('Attempt to get room by id failed. Room %d does not exist.' % room_id)

    return room_info_obj

@ndb.transactional
def txn_add_user_id_to_video_elements_enabled_user_ids(room_id, user_id):

    room_info_obj =  get_room_by_id(room_id)

    if user_id in room_info_obj.video_elements_enabled_user_ids:
        logging.info('Not added to video_enalbed_ids. user %d to %s' %(user_id, room_info_obj))
    else:
        logging.info('Adding video_enalbed_ids. user %d to %s' %(user_id, room_info_obj))
        room_info_obj.video_elements_enabled_user_ids.append(user_id)
        room_info_obj.put()

    return room_info_obj

@ndb.transactional
def txn_remove_user_id_from_video_elements_enabled_user_ids(room_id, user_id):

    room_info_obj = get_room_by_id(room_id)

    if user_id in room_info_obj.video_elements_enabled_user_ids:
        room_info_obj.video_elements_enabled_user_ids.remove(user_id)
        room_info_obj.put()

    return room_info_obj

@ndb.transactional
def txn_remove_user_from_room(room_id, user_id):

    logging.info('Removing user %d from room %d ' % (user_id, room_id))

    room_info_obj = get_room_by_id(room_id)
    try:
        # if the user_id is not in the list, an exception will be raised
        room_info_obj.room_members_ids.remove(user_id)
    except:
        logging.error("user_id %d not found in room - why is it being removed?" % user_id)

    if user_id in room_info_obj.video_elements_enabled_user_ids:
        room_info_obj.video_elements_enabled_user_ids.remove(user_id)

    room_info_obj.put()
    return room_info_obj


# The following function adds a given user to a chat room.
# This is done in a transaction to ensure that after two users are in a room, that no
# more users will be added.
@ndb.transactional
def txn_add_user_to_room(room_id, user_id):

    logging.info('Attempting to add user %d to room %d ' % (user_id, room_id))
    room_info_obj = get_room_by_id(room_id)
    status_string = None

    if room_info_obj:

        occupancy = room_info_obj.get_occupancy()


        if room_info_obj.has_user(user_id):
            # do nothing as this user is already in the room - report status as "roomJoined"
            # so javascript does not have to deal with a special case.
            status_string = 'roomJoined'
            logging.info('Room already has user %d - not added' % user_id)

        # Room is full - return a roomIsFull status
        elif occupancy >= 2:
            logging.warning('Room ' + room_info_obj.chat_room_name + ' is full')
            status_string = 'roomIsFull'

        # This is a new user joining the room
        else:

            try:
                # If user is not already in the room, then add them
                if not user_id in room_info_obj.room_members_ids:
                    room_info_obj.room_members_ids.append(user_id)
                    room_info_obj.put()

                status_string = 'roomJoined'


            # If the user cannot be added to the room, then an exception will be generated - let the client
            # know that the server had a problem.
            except:
               status_string = 'serverError'

    else:
         logging.error('Invalid room id: %d' % room_id)

    # Notice that we pass back room_info_obj - this is necessary because we have pulled out a "new" copy from
    # the database and may have updated it. We want any enclosing functions to use the updated version.
    return room_info_obj, status_string


