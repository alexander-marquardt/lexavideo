
import json
import logging

from google.appengine.api import channel

from video_src import models

def handle_message(room_obj, user_id, message):
    # This function passes a message from one user in a given "room" to the other user in the same room.
    # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
    # as for passing video and other information from one user to the other. 

    message_obj = json.loads(message)
    message = message.decode("utf-8")
    other_user_id = room_obj.get_other_user_id(user_id)
    room_name = room_obj.room_name

    message_type = message_obj['messageType']
    message_payload = message_obj['messagePayload']

    if message_type == 'sdp' and message_payload['type'] == 'bye':
        # This would remove the other_user in loopback test too.
        # So check its availability before forwarding Bye message.
        room_obj.remove_user(user_id)
        logging.info('User %d ' % user_id + ' quit from room ' + room_name)
        logging.info('Room ' + room_name + ' has state ' + repr(room_obj))

    if message_type == 'videoSettings':
        logging.info('***** videoSettings message received: ' + repr(message_payload))


    if other_user_id and room_obj.has_user(other_user_id):
        if message_type == 'sdp' and message_payload['type'] == 'offer':
            # This is just for debugging
            logging.info('sdp offer. Payload: %s' % repr(message_payload))

        if message_type == 'sdp' and message_payload['type'] == 'offer' and other_user_id == user_id:
            # Special case the loopback scenario.
            #message = make_loopback_answer(message)
            pass

        on_message(room_obj, other_user_id, message)

    else:
        logging.warning('Cannot deliver message from user: %s to other_user: %s since they are not in the room: %s' % (user_id, other_user_id, room_name))
        # For unittest
        #on_message(room, user, message)

    
def delete_saved_messages(client_id):
    messages =models.Message.get_saved_messages(client_id)
    for message in messages:
        message.key.delete()
        logging.info('Deleted the saved message for ' + client_id)    


def send_saved_messages(client_id):
    messages = models.Message.get_saved_messages(client_id)
    for message in messages:
        channel.send_message(client_id, message.msg)
        logging.info('Delivered saved message to ' + client_id)
        message.delete()
        
def on_message(room_obj, to_user_id, message):
    to_client_id = room_obj.make_client_id(to_user_id)
    if room_obj.is_connected(to_user_id):
        channel.send_message(to_client_id, message)
        logging.info('Delivered message to user %d' % to_user_id)
    else:
        new_message = models.Message(client_id = to_client_id, msg = message)
        new_message.put()
        #logging.info('Saved message for user ' + user)


