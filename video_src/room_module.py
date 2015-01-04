
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

    unique_chat_room_name_model = UniqueChatRoomName

    room_creator_user_key = ndb.KeyProperty(kind='UserModel')

    # This is the lower case room name - ie. user wrote 'Alex', but it will be stored as 'alex'
    chat_room_name = ndb.StringProperty(default = None)

    # The following is used for showing/remembering the room nam as it was written i.e.
    # if the user wrote 'aLeX', it will be stored here as 'aLeX'
    chat_room_name_as_written = ndb.StringProperty(default = None)

    # room_members_client_ids contains ids of all users currently in a chat room.
    room_members_client_ids = ndb.StringProperty(repeated=True)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    # As each user enables video, their user ID will be added to this array (which should never have more
    # than two ids given the current video standard). If a user stops their video or leaves a room, then
    # their id will be removed from this array.
    # When the second user activates their video, then the WebRTC signalling will start between the two users.
    video_elements_enabled_client_ids = ndb.StringProperty(repeated=True)

    @classmethod
    def get_unique_chat_room_name_model_key_string(cls, chat_room_name):
        return '%s.%s:%s' % (cls.__name__, 'chat_room_name', chat_room_name)


    @classmethod
    def check_if_room_name_is_unique(cls, chat_room_name):
        key_string = cls.get_unique_chat_room_name_model_key_string(chat_room_name)
        is_unique = cls.unique_chat_room_name_model.create(key_string)
        return is_unique


    # The ChatRoomName has been added to the chatRoomName structure. Now create a new Room object
    # for the new room.
    @classmethod
    def create_or_get_room(cls, chat_room_name, room_dict, room_creator_user_key):

        # make a copy of room_dict, so that our modifications don't accidentally change it for other functions
        room_info_obj_dict = copy.copy(room_dict)

        room_name_is_unique = cls.check_if_room_name_is_unique(chat_room_name)

        if room_name_is_unique:

            # remove 'user_id' from the room_dict since it will not be stored on the room_info_obj as 'user_id'
            del room_info_obj_dict['user_id']

            room_info_obj_dict['room_creator_user_key'] = room_creator_user_key
            room_info_obj = cls(**room_info_obj_dict)
            room_info_obj.put()
        else:
            room_info_obj = cls.query(cls.chat_room_name == chat_room_name).get()
            if not room_info_obj:
                raise Exception('chat_room_name %s does not exist in the ChatRoomInfo data structure' % chat_room_name)

        return room_info_obj

    def __str__(self):
        result = '['
        if self.room_members_client_ids:
            result += "room_members_client_ids: "
            for i in range(len(self.room_members_client_ids)):
                result += "%s " % (self.room_members_client_ids[i])

            result += " video_elements_enabled_client_ids: "
            for i in range(len(self.video_elements_enabled_client_ids)):
                result += "%s " % (self.video_elements_enabled_client_ids[i])

        result += ']'
        return result


    def make_client_id(self, user_id):
        # client id is the room id + / + user id
        return str(self.key.id()) + '/' + str(user_id)


    def get_occupancy(self):
        return len(self.room_members_client_ids)

    def get_list_of_other_client_ids(self, client_id):
        list_of_client_ids = list(self.room_members_client_ids)
        list_of_client_ids.remove(client_id)
        return list_of_client_ids


    def has_client(self, client_id):
        if client_id in self.room_members_client_ids:
            return True
        else:
            return False


    @classmethod
    @ndb.transactional
    def txn_add_user_id_to_video_elements_enabled_client_ids(cls, room_info_obj_key, client_id):

        room_info_obj = room_info_obj_key.get()

        if client_id in room_info_obj.video_elements_enabled_client_ids:
            logging.info('Not added to video_enalbed_ids. client %s to %s' %(client_id, room_info_obj))
        else:
            logging.info('Adding video_enabled_ids. client %s to %s' %(client_id, room_info_obj))
            room_info_obj.video_elements_enabled_client_ids.append(client_id)
            room_info_obj.put()

        return room_info_obj

    @classmethod
    @ndb.transactional
    def txn_remove_user_id_from_video_elements_enabled_client_ids(cls, room_info_obj_key, client_id):

        room_info_obj = room_info_obj_key.get()

        if client_id in room_info_obj.video_elements_enabled_client_ids:
            room_info_obj.video_elements_enabled_client_ids.remove(client_id)
            room_info_obj.put()

        return room_info_obj



    @classmethod
    @ndb.transactional(xg=True)
    def txn_remove_client_from_room(cls, room_key, client_id):

        logging.info('Removing client %s from room %s ' % (client_id, room_key))

        room_info_obj = room_key.get()
        try:
            # if the user_id is not in the list, an exception will be raised
            room_info_obj.room_members_client_ids.remove(client_id)
        except:
            logging.error("client_id %s not found in room - why is it being removed?" % client_id)

        if client_id in room_info_obj.video_elements_enabled_client_ids:
            room_info_obj.video_elements_enabled_client_ids.remove(client_id)

        room_info_obj.put()


        client_model_obj = users.ClientModel.get_by_id(client_id)

        if (room_info_obj.key in client_model_obj.list_of_open_rooms_keys):
            client_model_obj.list_of_open_rooms_keys.remove(room_info_obj.key)
            client_model_obj.put()


        return room_info_obj


    @classmethod
    def get_room_by_id(cls, room_id):

        room_info_obj = ChatRoomInfo.get_by_id(room_id)
        if not room_info_obj:
            logging.error('Attempt to get room by id failed. Room %d does not exist.' % room_id)

        return room_info_obj



    # The following function adds a given user to a chat room.
    # This is done in a transaction to ensure that after two users are in a room, that no
    # more users will be added.
    @classmethod
    @ndb.transactional(xg=True)
    def txn_add_client_to_room(cls, room_id, client_id, user_id):

        logging.info('Attempting to add client %s to room %d ' % (client_id, room_id))
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

                status_string = 'roomJoined'


            # If the user cannot be added to the room, then an exception will be generated - let the client
            # know that the server had a problem.
            except:
                status_string = 'serverError'
                status_reporting.log_call_stack_and_traceback(logging.error, extra_info = status_string)

        else:
            status_string = 'serverError'
            logging.error('Invalid room id: %d' % room_id)

        # Now we need to add the room to the client model (ie. track which rooms the user has open in the current
        # browser "client" window)
        client_model_obj = users.ClientModel.get_by_id(client_id)
        client_model_obj.list_of_open_rooms_keys.append(room_info_obj.key)
        client_model_obj.put()


        # Notice that we pass back room_info_obj - this is necessary because we have pulled out a "new" copy from
        # the database and may have updated it. We want any enclosing functions to use the updated version.
        return room_info_obj, status_string



class HandleEnterIntoRoom(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, chat_room_name_from_url=None):
        chat_room_name_from_url = chat_room_name_from_url.decode('utf8')
        chat_room_name = chat_room_name_from_url.lower()

        if chat_room_name:
            logging.info('Query for room name: ' + chat_room_name)
            room_info_obj = ChatRoomInfo.query(ChatRoomInfo.chat_room_name == chat_room_name).get()

            if room_info_obj:
                response_dict = {
                    'chatRoomName': chat_room_name,
                    'roomIsRegistered': True,
                    'numInRoom': room_info_obj.get_occupancy(),
                }
                logging.info('Found room: ' + repr(room_info_obj))

            else:
                response_dict = {
                    'chatRoomName': chat_room_name,
                    'roomIsRegistered' : False,
                    'numInRoom': 0
                }
                logging.info('Room name is available: ' + chat_room_name)

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            room_query = ChatRoomInfo.query()
            rooms_list = []

            for room_obj in room_query:
                room_dict = room_obj.to_dict()
                room_dict['chatRoomName'] = room_obj.key.id()
                rooms_list.append(room_dict)

            http_helpers.set_http_ok_json_response(self.response, rooms_list)

    @handle_exceptions
    def post(self, chat_room_name_from_url):
        try:
            room_dict = json.loads(self.request.body)

            # Need to get the URL encoded data from utf8. Note that json encoded data appears to already be decoded.
            chat_room_name_from_url = chat_room_name_from_url.decode('utf8')
            room_dict = utils.convert_dict(room_dict, utils.camel_to_underscore)

            assert (room_dict['chat_room_name'] == chat_room_name_from_url)
            room_dict['chat_room_name_as_written'] = room_dict['chat_room_name']
            chat_room_name = chat_room_name_from_url.lower()
            room_dict['chat_room_name'] = chat_room_name


            # Make sure that the room name is valid before continuing.
            # These errors should be rare since these values are
            # already formatted to be within bounds and characters checked by the client-side javascript.
            # Only if the user has somehow bypassed the javascript checks should we receive values that don't
            # conform to the constraints that we have placed.
            if not constants.valid_chat_room_name_regex_compiled.match(chat_room_name):
                raise Exception('Room name regexp did not match')
            if len(chat_room_name) > constants.room_max_chars or len(chat_room_name) < constants.room_min_chars:
                raise Exception('Room name length of %s is out of range' % len(chat_room_name))

            response_dict = {}
            user_id = long(room_dict['user_id'])

            room_creator_user_key = ndb.Key('UserModel', user_id)
            room_info_obj = ChatRoomInfo.create_or_get_room(chat_room_name, room_dict,
                                                                        room_creator_user_key)

            token_timeout = 240  # minutes
            # client_id = room_info_obj.make_client_id(user_id)
            # channel_token = channel.create_channel(client_id, token_timeout)
            # response_dict['clientId'] = client_id
            # response_dict['channelToken'] = channel_token
            response_dict['roomId'] = room_info_obj.key.id()
            response_dict['statusString'] = 'roomJoined'

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        except:
            # Unknown exception - provide feedback to the user to indicate that the room was not created or entered into
            err_status = 'ErrorUnableToCreateOrEnterRoom'
            # log this error for further analysis
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_status)
            http_helpers.set_http_ok_json_response(self.response, {'statusString': err_status})
