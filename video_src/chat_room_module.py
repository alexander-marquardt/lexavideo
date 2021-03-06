# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


import copy
import json
import logging
import pickle
import webapp2
import webapp2_extras.appengine.auth.models

from google.appengine.ext import ndb

from video_src import clients
from video_src import constants
from video_src import http_helpers
from video_src.memcache_wrapper import memcache
from video_src import status_reporting
from video_src import utils

from video_src.error_handling import handle_exceptions

from request_handler_custom.base_handler import BaseHandlerUserVerified

DICT_OF_CLIENT_OBJECTS_MEMCACHE_PREFIX = 'dict_of_client_objects-'
DICT_OF_CLIENT_OBJECTS_MEMCACHE_EXPIRY_IN_SECONDS = 5

class UniqueChatRoomName(webapp2_extras.appengine.auth.models.Unique):pass



class ChatRoomModel(ndb.Model):
    """
    ChatRoomModel will contain data about which users are currently in a given chat room
    Tracks all the data necessary for keeping track of room names and occupancy etc.
    """

    unique_chat_room_name_normalized_model = UniqueChatRoomName

    room_creator_user_key = ndb.KeyProperty(kind='UserModel')

    # This is the lower case room name - ie. user wrote 'Alex', but it will be stored as 'alex'
    chat_room_name_normalized = ndb.StringProperty(default = None)

    # The following is used for showing/remembering the room nam as it was written i.e.
    # if the room creator wrote 'aLeX', it will be stored here as 'aLeX'
    chat_room_name_as_written = ndb.StringProperty(default = None)

    # room_members_client_ids contains ids of all users currently in a chat room.
    room_members_client_ids = ndb.StringProperty(repeated=True)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    @classmethod
    def get_unique_chat_room_name_normalized_model_key_string(cls, chat_room_name_normalized):
        return '%s.%s:%s' % (cls.__name__, 'chat_room_name_normalized', chat_room_name_normalized)


    @classmethod
    def check_if_room_name_is_unique(cls, chat_room_name_normalized):
        key_string = cls.get_unique_chat_room_name_normalized_model_key_string(chat_room_name_normalized)
        is_unique = cls.unique_chat_room_name_normalized_model.create(key_string)
        return is_unique


    @classmethod
    def get_chat_room_by_name(cls, chat_room_name_normalized):
        chat_room_obj = cls.query(cls.chat_room_name_normalized == chat_room_name_normalized).get()
        if not chat_room_obj:
            raise Exception('chat_room_name_normalized %s does not exist in the ChatRoomModel data structure' % chat_room_name_normalized)

        return chat_room_obj

    # The ChatRoomName has been added to the chatRoomName structure. Now create a new Room object
    # for the new room.
    @classmethod
    def create_or_get_room(cls, chat_room_name_normalized, room_dict, room_creator_user_key):

        # make a copy of room_dict, so that our modifications don't accidentally change it for other functions
        chat_room_obj_dict = copy.copy(room_dict)

        room_name_is_unique = cls.check_if_room_name_is_unique(chat_room_name_normalized)

        if room_name_is_unique:

            # remove 'user_id' from the room_dict since it will not be stored on the chat_room_obj as 'user_id'
            del chat_room_obj_dict['user_id']

            chat_room_obj_dict['room_creator_user_key'] = room_creator_user_key
            chat_room_obj = cls(**chat_room_obj_dict)
            chat_room_obj.put()
        else:
            chat_room_obj = cls.get_chat_room_by_name(chat_room_name_normalized)

        return chat_room_obj

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



    @ndb.transactional
    def txn_remove_client_from_room(self, client_id):

        room_key = self.key
        logging.info('Removing client %s from room %s ' % (client_id, room_key))

        # First, we remove the "client" from the room
        chat_room_obj = room_key.get()
        try:
            # if the client_id is not in the list, an exception will be raised
            chat_room_obj.room_members_client_ids.remove(client_id)
        except:
            logging.error("client_id %s not found in room - why is it being removed?" % client_id)

        chat_room_obj.put()

        return chat_room_obj




    @classmethod
    def get_room_by_id(cls, room_id):

        chat_room_obj = ChatRoomModel.get_by_id(room_id)
        if not chat_room_obj:
            logging.error('Attempt to get room by id failed. Room %d does not exist.' % room_id)

        return chat_room_obj



    # The following function adds a given user to a chat room. Since multiple clients may be attempting to enter
    # the room at the same time, it is ran in a transaction to prevent conflicts.
    @ndb.transactional
    def txn_add_client_to_room(self, client_id):

        room_key = self.key
        new_client_has_been_added = False

        logging.info('Adding client %s to room %s ' % (client_id, room_key))
        chat_room_obj = room_key.get()


        if chat_room_obj:

            try:
                # If user is not already in the room, then add them
                if not client_id in chat_room_obj.room_members_client_ids:
                    chat_room_obj.room_members_client_ids.append(client_id)
                    chat_room_obj.put()
                    logging.info('Client %s has joined room %s ' % (client_id, room_key))
                    new_client_has_been_added = True
                else:
                    logging.info('Client %s was already in room %s ' % (client_id, room_key))

            # If the user cannot be added to the room, then an exception will be generated - let the client
            # know that the server had a problem.
            except:
                status_reporting.log_call_stack_and_traceback(logging.error)
                raise Exception('Error adding client %s to room %s' % (client_id, room_key))

        else:
            error_message = 'Invalid room id: %s' % room_key
            logging.error(error_message)
            raise Exception(error_message)

        return (new_client_has_been_added, chat_room_obj)





    def get_dict_of_client_objects(self, recompute_members_from_scratch):
        """
         Get a list of objects corresponding to each client that is in the chat room.

         Parameters:
         recompute_members_from_scratch -- if this is true, then we will not attempt to pull the dictionary from memcache.
             We should set this to True in cases where we know that the list of room members has changed, and needs to
             be updated from the database. 
         """

        dict_of_client_objects_memcache_key = DICT_OF_CLIENT_OBJECTS_MEMCACHE_PREFIX + str(self.key.id())

        if not recompute_members_from_scratch:
            serialized_dict_of_client_objects = memcache.get(dict_of_client_objects_memcache_key)
        else:
            serialized_dict_of_client_objects = None


        # If we successfully pulled the dictionary out of memcache, then we return the value we pulled
        if serialized_dict_of_client_objects:
            # logging.debug('Pulled serialized_dict_of_client_objects from memcache')
            dict_of_client_objects = pickle.loads(serialized_dict_of_client_objects)
            return dict_of_client_objects

        else:
            # logging.debug('Computing dict_of_client_objects')
            dict_of_client_objects = {}
            for client_id in self.room_members_client_ids:

                try:
                    client_obj = clients.ClientModel.get_by_id(id=client_id)
                    # logging.debug('Getting presence state for client_obj %s' % client_obj)
                    presence_state_name = client_obj.get_current_presence_state()
                except:
                    # We were not able to get a client object corresponding to the client_id, therefore
                    # it may have been removed from the database already. In this case, make sure that the
                    # client is also removed from the room by setting them to offline.
                    presence_state_name = 'PRESENCE_OFFLINE'

                # If client is OFFLINE, then don't include them in dict_of_client_objects *and* also remove the client
                # from the room (if they later start their heartbeat, then they will be added back to the room)
                if presence_state_name == 'PRESENCE_OFFLINE':
                    logging.warning('*** Removing client_id %s from room %s due to PRESENCE_OFFLINE.' % (client_id, self.key.id()))
                    self.txn_remove_client_from_room(client_id)

                # Client is not PRESENCE_OFFLINE, include them in dict_of_client_objects
                else:
                    # Send relevant data to the client, which includes the client_id, username, and presence state.
                    user_obj = client_obj.user_obj_key.get()
                    dict_of_client_objects[client_id] =  {
                        'usernameNormalized': user_obj.username_normalized,
                        'usernameAsWritten': user_obj.username_as_written,
                        'presenceStateName': presence_state_name
                        }

            # Store the dictionary to memcache
            serialized_dict_of_client_objects = pickle.dumps(dict_of_client_objects, constants.pickle_protocol)
            memcache.set(dict_of_client_objects_memcache_key, serialized_dict_of_client_objects, DICT_OF_CLIENT_OBJECTS_MEMCACHE_EXPIRY_IN_SECONDS)

            return dict_of_client_objects



class CheckIfChatRoomExists(webapp2.RequestHandler):
    @handle_exceptions
    def get(self, chat_room_name_from_url=None):
        chat_room_name_from_url = chat_room_name_from_url.decode('utf8')
        chat_room_name_normalized = chat_room_name_from_url.lower()

        if chat_room_name_normalized:
            logging.info('Query for room name: ' + chat_room_name_normalized)
            chat_room_obj = ChatRoomModel.query(ChatRoomModel.chat_room_name_normalized == chat_room_name_normalized).get()

            if chat_room_obj:
                response_dict = {
                    'chatRoomName': chat_room_name_normalized,
                    'roomIsRegistered': True,
                    'numInRoom': chat_room_obj.get_occupancy(),
                }
                logging.info('Found room: ' + repr(chat_room_obj))

            else:
                response_dict = {
                    'chatRoomName': chat_room_name_normalized,
                    'roomIsRegistered' : False,
                    'numInRoom': 0
                }
                logging.info('Room name is available: ' + chat_room_name_normalized)

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        else:
            err_status = 'ErrorChatRoomNameRequired'
            # log this error for further analysis
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_status)
            http_helpers.set_http_error_json_response(self.response, err_status)

class CreateNewRoomIfDoesNotExist(BaseHandlerUserVerified):
    @handle_exceptions
    def post(self):
        try:
            room_dict = json.loads(self.request.body)

            # Need to get the URL encoded data from utf8. Note that json encoded data appears to already be decoded.

            # Convert camel case keys to underscore (standard python) keys
            room_dict = utils.convert_dict(room_dict, utils.camel_to_underscore)

            chat_room_name_as_written = room_dict['chat_room_name_as_written']
            chat_room_name_normalized = chat_room_name_as_written.lower()
            room_dict['chat_room_name_normalized'] = chat_room_name_normalized


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
            user_id = int(room_dict['user_id'])

            assert self.session.user_id == user_id

            # If this is a new room, then the room_creator_user_key will be stored in the room
            # object as the "creator" of the room
            room_creator_user_key = ndb.Key('UserModel', user_id)
            chat_room_obj = ChatRoomModel.create_or_get_room(chat_room_name_normalized, room_dict,
                                                            room_creator_user_key)

            response_dict['chatRoomNameNormalized'] = chat_room_name_normalized
            response_dict['chatRoomId'] = chat_room_obj.key.id()
            response_dict['statusString'] = 'roomJoined'

            http_helpers.set_http_ok_json_response(self.response, response_dict)

        except:
            # Unknown exception - provide feedback to the user to indicate that the room was not created or entered into
            err_status = 'ErrorUnableToCreateOrEnterRoom'
            # log this error for further analysis
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = err_status)
            http_helpers.set_http_ok_json_response(self.response, {'statusString': err_status})
