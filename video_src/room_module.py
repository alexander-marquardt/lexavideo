
import json
import logging
import webapp2

from google.appengine.ext import ndb

from video_src import http_helpers
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

    # room_members_ids contains ids of all users currently in a chat room.
    room_members_ids = ndb.IntegerProperty(repeated=True)

    # track if the users in the room have a channel open (channel api). This array should be stored in parallel
    # to the room_members_keys array.
    room_members_channel_open = ndb.BooleanProperty(repeated = True)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)

    # When a user first joins the room, this will be the type of video that they will display. If a user is alone
    # in a room and changes their video type, then the next person to join will automatically have that video type
    # selected as well.
    room_video_type = ndb.StringProperty(default = 'HD Video')

        # As each user enables video, their user ID will be added to this array (which should never have more
    # than two ids given the current video standard). If a user stops their video or leaves a room, then
    # their id will be removed from this array.
    # When the second user activates their video, then the WebRTC signalling will start between the two users.
    video_enabled_ids = ndb.IntegerProperty(repeated=True)


    def __str__(self):
        result = '['
        if self.room_members_ids:
            for i in range(len(self.room_members_ids)):
                result += "%d-%r" % (self.room_members_ids[i], self.room_members_channel_open[i])
        result += ']'
        return result


    def add_user_id_to_video_enabled_ids(self, user_id):

        try:
            self.video_enabled_ids.index(user_id)
        except:
            # if an exception is generated, then the from_user_id is not in the list of ids, and should be added
            self.video_enabled_ids.append(user_id)
            self.put()



    def remove_user_id_from_video_enabled_ids(self, user_id):
        try:
            self.video_enabled_ids.remove(user_id)
            self.put()
        except:
            # exception means that the value was not found in the list. We therefore don't need to remove anything
            # from the list.
            pass


    def make_client_id(self, user_id):
        # client id is the room id + / + user id
        return str(self.key.id()) + '/' + str(user_id)


    def remove_user(self, user_id):
        # messaging.delete_saved_messages(self.make_client_id(user_id))

        idx = None
        try:
            # if the user_id is not in the list, an exception will be raised
            idx = self.room_members_ids.index(user_id)
        except:
            logging.error("user_id %d not found in room - why is it being removed?" % user_id)

        if idx != None:
            del self.room_members_ids[idx]
            del self.room_members_channel_open[idx]
            self.put()




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


    def has_user(self, user_id):
        if user_id in self.room_members_ids:
            return True
        else:
            return False


    def add_user_to_room(self, user_id):

        # If user is already in the room, then just return without doing anything
        if user_id in self.room_members_ids:
            return

        # Add the user to the room
        self.room_members_ids.append(user_id)
        self.room_members_channel_open.append(False)

        self.put()


    def set_connected(self, user_id):

        idx = self.room_members_ids.index(user_id)
        self.room_members_channel_open[idx] = True

        self.put()


    def is_connected(self, user_id):

        idx = self.room_members_ids.index(user_id)
        return self.room_members_channel_open[idx]


    def connect_user_to_room(self, user_id):

        # Check if room has user_id in case that disconnect message comes before
        # connect message with unknown reason, observed with local AppEngine SDK.
        if self.has_user(user_id):
            self.set_connected(user_id)
            logging.info('User %d' % user_id + ' connected to room ' + self.room_name)
            logging.info('RoomInfo ' + self.room_name + ' has state ' + str(self))


        else:
            logging.warning('Unexpected Connect Message to room %d' % room_obj.room_name + 'by user %d' % user_id)



class MessagePage(webapp2.RequestHandler):

    @handle_exceptions
    def post(self):
        message = self.request.body
        room_id = int(self.request.get('r'))
        user_id = int(self.request.get('u'))
        room_obj = RoomInfo.get_by_id(room_id)

        try:
            try:
                if room_obj:
                    messaging.handle_message(room_obj, user_id, message)
                else:
                    logging.error('Unknown room_id %d' % room_id)
                    raise Exception('unknownRoomId')

            except Exception as e:

                status_string = e.message

                # if 'otherUserNotInRoom' then we will give the user feedback indicating that they are alone in the room
                # and that is why their message was not delivered. This is not a serious error, and so we only log
                # it with a warning message and return a http 403 code.
                if status_string == 'otherUserNotInRoom':
                     # 403 = Forbidden - request is valid, but server is refusing to respond to it
                    http_status_code = 403
                    logging_function = logging.warning

                # else, we don't know what happened so return a 500 error and log all relevant information
                else:
                    # re-raise the exception so that it will be caught by the following except clause
                    raise

                http_helpers.set_error_json_response_and_write_log(self.response, status_string, logging_function, http_status_code)

        except:
            status_string = 'Unknown server error'
            http_status_code = 500
            logging_function = logging.error

            http_helpers.set_error_json_response_and_write_log(self.response, status_string, logging_function, http_status_code)



def get_room_by_id(room_id):

    room_obj = RoomInfo.get_by_id(room_id)
    if room_obj:
        return room_obj
    else:
        logging.error('Attempt to get room by id failed. Room %d does not exist.' % room_id)
        return None



class ConnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):
        client_id = self.request.get('from')
        room_id, user_id = [int(n) for n in client_id.split('/')]

        # Add user back into room. If they have a channel open to the room then they are by definition in the room
        room_obj = get_room_by_id(room_id)
        if room_obj:
            room_obj.add_user_to_room(user_id)

            # TODO - remove the following line once we have signalling for enabling video working
            room_obj.add_user_id_to_video_enabled_ids(user_id)
            assert(room_obj.has_user(user_id))
            room_obj.connect_user_to_room(user_id)

            messaging.send_room_occupancy_to_room_members(room_obj, user_id)
            messaging.send_room_video_settings_to_room_members(room_obj)

        else:
            logging.error('Invalid room id: %d' % room_id)


class DisconnectPage(webapp2.RequestHandler):
    
    @handle_exceptions
    def post(self):

        client_id = self.request.get('from')
        room_id, user_id = [int(n) for n in client_id.split('/')]

        room_obj = get_room_by_id(room_id)
        if room_obj:
            if room_obj.has_user(user_id):

                # Get the other_user_id before removing the user_id from the room
                other_user_id = room_obj.get_other_user_id(user_id)

                room_obj.remove_user(user_id)
                room_obj.remove_user_id_from_video_enabled_ids(user_id)

                logging.info('User %d' % user_id + ' removed from room %d' % room_id)
                logging.info('Room %d ' % room_id + ' has state ' + str(room_obj))

                # The 'active' user has disconnected from the room, so we want to send an update to the remote
                # user informing them of the new status.
                if other_user_id:
                    messaging.send_room_occupancy_to_room_members(room_obj, other_user_id)
                    messaging.send_room_video_settings_to_room_members(room_obj)

            else:
                logging.error('Room %s (%d) does not have user %d - disconnect failed' % (room_obj.room_name, room_id, user_id))

        else:
            logging.error('Room %d' % room_id + ' does not exist. Cannot disconnect user %d' % user_id)
