
import copy
import json
import logging
import webapp2
import webapp2_extras.appengine.auth.models

from google.appengine.ext import ndb

from video_src import constants
from video_src import http_helpers
from video_src import status_reporting
from video_src import users
from video_src import utils

from video_src.error_handling import handle_exceptions


class UniqueChatRoomName(webapp2_extras.appengine.auth.models.Unique):pass



# ChatRoomInfo will contain data about which users are currently in a given chat room
class ChatRoomInfo(ndb.Model):
    """All the data necessary for keeping track of room names and occupancy etc. """

    unique_normalized_chat_room_name_model = UniqueChatRoomName

    room_creator_user_key = ndb.KeyProperty(kind='UserModel')

    # This is the lower case room name - ie. user wrote 'Alex', but it will be stored as 'alex'
    normalized_chat_room_name = ndb.StringProperty(default = None)

    # The following is used for showing/remembering the room nam as it was written i.e.
    # if the room creator wrote 'aLeX', it will be stored here as 'aLeX'
    chat_room_name_as_written = ndb.StringProperty(default = None)

    # room_members_client_ids contains ids of all users currently in a chat room.
    room_members_client_ids = ndb.StringProperty(repeated=True)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    @classmethod
    def get_unique_normalized_chat_room_name_model_key_string(cls, normalized_chat_room_name):
        return '%s.%s:%s' % (cls.__name__, 'normalized_chat_room_name', normalized_chat_room_name)


    @classmethod
    def check_if_room_name_is_unique(cls, normalized_chat_room_name):
        key_string = cls.get_unique_normalized_chat_room_name_model_key_string(normalized_chat_room_name)
        is_unique = cls.unique_normalized_chat_room_name_model.create(key_string)
        return is_unique


    # The ChatRoomName has been added to the chatRoomName structure. Now create a new Room object
    # for the new room.
    @classmethod
    def create_or_get_room(cls, normalized_chat_room_name, room_dict, room_creator_user_key):

        # make a copy of room_dict, so that our modifications don't accidentally change it for other functions
        room_info_obj_dict = copy.copy(room_dict)

        room_name_is_unique = cls.check_if_room_name_is_unique(normalized_chat_room_name)

        if room_name_is_unique:

            # remove 'user_id' from the room_dict since it will not be stored on the room_info_obj as 'user_id'
            del room_info_obj_dict['user_id']

            room_info_obj_dict['room_creator_user_key'] = room_creator_user_key
            room_info_obj = cls(**room_info_obj_dict)
            room_info_obj.put()
        else:
            room_info_obj = cls.query(cls.normalized_chat_room_name == normalized_chat_room_name).get()
            if not room_info_obj:
                raise Exception('normalized_chat_room_name %s does not exist in the ChatRoomInfo data structure' % normalized_chat_room_name)

        return room_info_obj

    def __str__(self):
        result = '['
        if self.room_members_client_ids:
            result += "room_members_client_ids: "
            for i in range(len(self.room_members_client_ids)):
                result += "%s " % (self.room_members_client_ids[i])

        result += ']'
        return result


    def make_client_id(self, user_id):
        # client id is the room id + / + user id
        return str(self.key.id()) + '/' + str(user_id)


    def get_occupancy(self):
        return len(self.room_members_client_ids)


    def get_list_of_other_client_ids(self, client_id):
        list_of_client_ids = list(self.room_members_client_ids)
        try:
            list_of_client_ids.remove(client_id)
        except:
            raise Exception('client_id %s is not a member of room_id %s and therefore cannot send a message to the room' % (client_id, self.key.id()))

        return list_of_client_ids


    def has_client(self, client_id):
        if client_id in self.room_members_client_ids:
            return True
        else:
            return False



    @classmethod
    @ndb.transactional(xg=True)
    def txn_remove_client_from_room(cls, room_key, user_id, client_id):

        logging.info('Removing client %s from room %s ' % (client_id, room_key))

        # First, we remove the "client" from the room
        room_info_obj = room_key.get()
        try:
            # if the client_id is not in the list, an exception will be raised
            room_info_obj.room_members_client_ids.remove(client_id)
        except:
            logging.error("client_id %s not found in room - why is it being removed?" % client_id)
        room_info_obj.put()

        return room_info_obj




    @classmethod
    def get_room_by_id(cls, room_id):

        room_info_obj = ChatRoomInfo.get_by_id(room_id)
        if not room_info_obj:
            logging.error('Attempt to get room by id failed. Room %d does not exist.' % room_id)

        return room_info_obj



    # The following function adds a given user to a chat room. Since multiple clients may be attempting to enter
    # the room at the same time, it is ran in a transaction to prevent conflicts.
    @classmethod
    @ndb.transactional
    def txn_add_client_to_room(cls, room_id, client_id):

        logging.info('Adding client %s to room %d ' % (client_id, room_id))
        room_info_obj = cls.get_room_by_id(room_id)


        if room_info_obj:

            try:
                # If user is not already in the room, then add them
                if not client_id in room_info_obj.room_members_client_ids:
                    room_info_obj.room_members_client_ids.append(client_id)
                    room_info_obj.put()
                    logging.info('Client %s has joined room %d ' % (client_id, room_id))

                else:
                    logging.info('Client %s was already in room %d ' % (client_id, room_id))

            # If the user cannot be added to the room, then an exception will be generated - let the client
            # know that the server had a problem.
            except:
                status_reporting.log_call_stack_and_traceback(logging.error)
                raise Exception('Error adding client %s to room %s' % (client_id, room_id))

        else:
            error_message = 'Invalid room id: %d' % room_id
            logging.error(error_message)
            raise Exception(error_message)


    @classmethod
    @ndb.transactional(xg=True)
    def txn_add_room_to_user_status_tracker(cls, room_id, user_id):

        # Now we need to add the room to the user status tracker model (ie. track which rooms the user currently has open)
        logging.info('Adding room %s to user_status_tracker for user %s' % (room_id, user_id))

        room_info_obj = cls.get_room_by_id(room_id)

        user_obj = users.UserModel.get_by_id(user_id)
        user_status_tracker_obj = user_obj.user_status_tracker_key.get()
        if user_id not in user_status_tracker_obj.list_of_open_rooms_keys:
            user_status_tracker_obj.list_of_open_rooms_keys.append(room_info_obj.key)
            user_status_tracker_obj.put()


        # Notice that we pass back room_info_obj - this is necessary because we have pulled out a "new" copy from
        # the database and may have updated it. We want any enclosing functions to use the updated version.
        return room_info_obj



class CheckIfChatRoomExists(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, chat_room_name_from_url=None):
        chat_room_name_from_url = chat_room_name_from_url.decode('utf8')
        normalized_chat_room_name = chat_room_name_from_url.lower()

        if normalized_chat_room_name:
            logging.info('Query for room name: ' + normalized_chat_room_name)
            room_info_obj = ChatRoomInfo.query(ChatRoomInfo.normalized_chat_room_name == normalized_chat_room_name).get()

            if room_info_obj:
                response_dict = {
                    'chatRoomName': normalized_chat_room_name,
                    'roomIsRegistered': True,
                    'numInRoom': room_info_obj.get_occupancy(),
                }
                logging.info('Found room: ' + repr(room_info_obj))

            else:
                response_dict = {
                    'chatRoomName': normalized_chat_room_name,
                    'roomIsRegistered' : False,
                    'numInRoom': 0
                }
                logging.info('Room name is available: ' + normalized_chat_room_name)

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            room_query = ChatRoomInfo.query()
            rooms_list = []

            for room_obj in room_query:
                room_dict = room_obj.to_dict()
                room_dict['chatRoomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            http_helpers.set_http_ok_json_response(self.response, rooms_list)
            
class EnterIntoRoom(webapp2.RequestHandler):
    @handle_exceptions
    def post(self):
        try:
            room_dict = json.loads(self.request.body)

            # Need to get the URL encoded data from utf8. Note that json encoded data appears to already be decoded.

            # Convert camel case keys to underscore (standard python) keys
            room_dict = utils.convert_dict(room_dict, utils.camel_to_underscore)

            chat_room_name_as_written = room_dict['chat_room_name_as_written']
            normalized_chat_room_name = chat_room_name_as_written.lower()
            room_dict['normalized_chat_room_name'] = normalized_chat_room_name


            # Make sure that the room name is valid before continuing.
            # These errors should be rare since these values are
            # already formatted to be within bounds and characters checked by the client-side javascript.
            # Only if the user has somehow bypassed the javascript checks should we receive values that don't
            # conform to the constraints that we have placed.
            if not constants.valid_chat_room_name_regex_compiled.match(chat_room_name_as_written):
                raise Exception('Room name regexp did not match')
            if len(chat_room_name_as_written) > constants.room_max_chars or len(chat_room_name_as_written) < constants.room_min_chars:
                raise Exception('Room name length of %s is out of range' % len(chat_room_name_as_written))

            response_dict = {}
            user_id = long(room_dict['user_id'])

            # If this is a new room, then the room_creator_user_key will be stored in the room
            # object as the "creator" of the room
            room_creator_user_key = ndb.Key('UserModel', user_id)
            room_info_obj = ChatRoomInfo.create_or_get_room(normalized_chat_room_name, room_dict,
                                                            room_creator_user_key)

            response_dict['normalizedChatRoomName'] = normalized_chat_room_name
            response_dict['chatRoomId'] = room_info_obj.key.id()
            response_dict['statusString'] = 'roomJoined'

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        except:
            # Unknown exception - provide feedback to the user to indicate that the room was not created or entered into
            err_status = 'ErrorUnableToCreateOrEnterRoom'
            # log this error for further analysis
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_status)
            http_helpers.set_http_ok_json_response(self.response, {'statusString': err_status})
