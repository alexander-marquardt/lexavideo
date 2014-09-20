#!/usr/bin/python2.4
#
# Copyright 2011 Google Inc. All Rights Reserved.

"""WebRTC Demo

This module demonstrates the WebRTC API by implementing a simple video chat app.
"""
import vidsetup

import cgi
import logging
import os
import random
import re
import json
import jinja2
import webapp2
import threading
from google.appengine.api import channel
from google.appengine.ext import ndb

from video_src import error_reporting_from_client, constants
from video_src import models, room_module, http_helpers, status_reporting, rest_functionality
from video_src.error_handling import handle_exceptions


# We "hack" the directory that jinja looks for the template files so that it is always pointing to
# the correct location, irregardless of if we are in the debug or production build. 
# StrictUndefined means that jinja will raise an error if a template variable is used but has 
# not been defined - this is important for us because we may accidentaly attempt to use an angular template
# variable inside of jinja code, and this will notify us of the error.
jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__) + "/" + vidsetup.BASE_STATIC_DIR),
    undefined=jinja2.StrictUndefined)



# Lock for syncing DB operation in concurrent requests handling.
# TODO(brave): keeping working on improving performance with thread syncing.
# One possible method for near future is to reduce the message caching.
LOCK = threading.RLock()

def generate_random(length):
    word = ''
    for _ in range(length):
        word += random.choice('0123456789')
    return word

def sanitize(key):
    return re.sub('[^a-zA-Z0-9\-]', '-', key)

def is_chrome_for_android(user_agent):
    return 'Android' in user_agent and 'Chrome' in user_agent

def get_default_stun_server():
    # others you can try: stun.services.mozilla.com, stunserver.org
    return 'stun.l.google.com:19302'

def get_preferred_audio_receive_codec():
    return 'opus/48000'

def get_preferred_audio_send_codec(user_agent):
    # Empty string means no preference.
    preferred_audio_send_codec = ''
    # Prefer to send ISAC on Chrome for Android.
    if is_chrome_for_android(user_agent):
        preferred_audio_send_codec = 'ISAC/16000'
    return preferred_audio_send_codec

# HD is on by default for desktop Chrome, but not Android or Firefox (yet)
def get_hd_default(user_agent):
    if 'Android' in user_agent or not 'Chrome' in user_agent:
        return 'false'
    return 'true'

def make_pc_config(stun_server, turn_server, ts_pwd, ice_transports):
    config = {}
    servers = []
    if stun_server:
        stun_config = 'stun:{}'.format(stun_server)
        servers.append({'urls':stun_config})
    if turn_server:
        turn_config = 'turn:{}'.format(turn_server)
        servers.append({'urls':turn_config, 'credential':ts_pwd})
    config['iceServers'] = servers
    if ice_transports:
        config['iceTransports'] = ice_transports
    return config


def create_channel(room, user, duration_minutes):
    clientId = room.make_client_id(user)
    return channel.create_channel(clientId, duration_minutes)


def make_loopback_answer(message):
    message = message.replace("\"offer\"", "\"answer\"")
    message = message.replace("a=ice-options:google-ice\\r\\n", "")
    return message


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


def send_saved_messages(clientId):
    messages = models.Message.get_saved_messages(clientId)
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

def add_media_track_constraint(track_constraints, constraint_string):
    tokens = constraint_string.split(':')
    mandatory = True
    if len(tokens) == 2:
        # If specified, e.g. mandatory:minHeight=720, set mandatory appropriately.
        mandatory = (tokens[0] == 'mandatory')
    else:
        # Otherwise, default to mandatory, except for goog constraints, which
        # won't work in other browsers.
        mandatory = not tokens[0].startswith('goog')

    tokens = tokens[-1].split('=')
    if len(tokens) == 2:
        if mandatory:
            track_constraints['mandatory'][tokens[0]] = tokens[1]
        else:
            track_constraints['optional'].append({tokens[0]: tokens[1]})
    else:
        logging.error('Ignoring malformed constraint: ' + constraint_string)

def make_media_track_constraints(constraints_string):
    if not constraints_string or constraints_string.lower() == 'true':
        track_constraints = True
    elif constraints_string.lower() == 'false':
        track_constraints = False
    else:
        track_constraints = {'mandatory': {}, 'optional': []}
        for constraint_string in constraints_string.split(','):
            add_media_track_constraint(track_constraints, constraint_string)

    return track_constraints

def make_media_stream_constraints(audio, video):
    stream_constraints = (
        {'audio': make_media_track_constraints(audio),
         'video': make_media_track_constraints(video)})
    logging.info('Applying media constraints: ' + str(stream_constraints))
    return stream_constraints

def maybe_add_constraint(constraints, param, constraint):
    if (param.lower() == 'true'):
        constraints['optional'].append({constraint: True})
    elif (param.lower() == 'false'):
        constraints['optional'].append({constraint: False})

    return constraints

def make_pc_constraints(dtls, dscp, ipv6, opusfec):
    constraints = { 'optional': [] }
    # Force on the new BWE in Chrome 35 and later.
    # TODO(juberti): Remove once Chrome 36 is stable.
    constraints['optional'].append({'googImprovedWifiBwe': True})
    maybe_add_constraint(constraints, dtls, 'DtlsSrtpKeyAgreement')
    maybe_add_constraint(constraints, dscp, 'googDscp')
    maybe_add_constraint(constraints, ipv6, 'googIPv6')
    maybe_add_constraint(constraints, opusfec, 'googOpusFec')

    return constraints

def make_offer_constraints():
    constraints = { 'mandatory': {}, 'optional': [] }
    return constraints

def append_url_arguments(request, link):
    for argument in request.arguments():
        if argument != 'r':
            link += ('&' + cgi.escape(argument, True) + '=' +
                     cgi.escape(request.get(argument), True))
    return link

def write_response(response, response_type, target_page, params):
    if response_type == 'json':
        content = json.dumps(params)
    else:
        template = jinja_environment.get_template(target_page)
        content = template.render(params)
    response.out.write(content)



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
                           'roomCreator' : room.room_creator,
                           'roomJoiner'  : room.room_joiner,
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



def get_video_params(roomName, user_agent):
    """ Returns a json object that contains the video parameters that will be used for setting up the webRtc communications and display"""
    
    
    try:
        # Append strings to this list to have them thrown up in message boxes. This
        # will also cause the app to fail.
        error_status = None;
        # Get the base url without arguments.
        stun_server = get_default_stun_server()
    
        
        # Use "audio" and "video" to set the media stream constraints. Defined here:
        # http://goo.gl/V7cZg
        #
        # "true" and "false" are recognized and interpreted as bools, for example:
        #   "?audio=true&video=false" (Start an audio-only call.)
        #   "?audio=false" (Start a video-only call.)
        # If unspecified, the stream constraint defaults to True.
        #
        # To specify media track constraints, pass in a comma-separated list of
        # key/value pairs, separated by a "=". Examples:
        #   "?audio=googEchoCancellation=false,googAutoGainControl=true"
        #   (Disable echo cancellation and enable gain control.)
        #
        #   "?video=minWidth=1280,minHeight=720,googNoiseReduction=true"
        #   (Set the minimum resolution to 1280x720 and enable noise reduction.)
        #
        # Keys starting with "goog" will be added to the "optional" key; all others
        # will be added to the "mandatory" key.
        # To override this default behavior, add a "mandatory" or "optional" prefix
        # to each key, e.g.
        #   "?video=optional:minWidth=1280,optional:minHeight=720,
        #           mandatory:googNoiseReduction=true"
        #   (Try to do 1280x720, but be willing to live with less; enable
        #    noise reduction or die trying.)
        #
        # The audio keys are defined here: talk/app/webrtc/localaudiosource.cc
        # The video keys are defined here: talk/app/webrtc/videosource.cc
    
        
        # ARM - hack - set video to '' because using the above settings seems to cause firefox to
        # set the local video to a strange aspect ratio that is too tall. This happens only
        # after the non-firefox user leaves a call, and then rejoins it.
        video = ''
        
        
    
        audio_send_codec = get_preferred_audio_send_codec(user_agent)    
        audio_receive_codec = get_preferred_audio_receive_codec()
        
        # Set stereo to false by default.
        stereo = 'false'
        
        # Read url params audio send bitrate (asbr) & audio receive bitrate (arbr)
        asbr = ''
        arbr = ''
        
        # Read url params video send bitrate (vsbr) & video receive bitrate (vrbr)
        vsbr = ''
        vrbr = ''
        
        # Read url params for the initial video send bitrate (vsibr)
        vsibr = ''
        
        # Options for making pcConstraints
        dtls = ''
        dscp = ''
        ipv6 = ''
        opusfec = ''
        
        # Stereoscopic rendering.  Expects remote video to be a side-by-side view of
        # two cameras' captures, which will each be fed to one eye.
        ssr = ''
        
        # Avoid pulling down vr.js (>25KB, minified) if not needed.
        include_vr_js = ''
        if ssr == 'true':
            include_vr_js = ('<script src="/js/vr.js"></script>\n' +
                             '<script src="/js/stereoscopic.js"></script>')
        
        # Disable pinch-zoom scaling since we manage video real-estate explicitly
        # (via full-screen) and don't want devicePixelRatios changing dynamically.
        meta_viewport = ''
        if is_chrome_for_android(user_agent):
            meta_viewport = ('<meta name="viewport" content="width=device-width, ' +
                             'user-scalable=no, initial-scale=1, maximum-scale=1">')
        
        debug = vidsetup.DEBUG_BUILD
        if debug == 'loopback':
            # Set dtls to false as DTLS does not work for loopback.
            dtls = 'false'
        
        # token_timeout for channel creation, default 30min, max 1 days, min 3min.
        token_timeout =  1440 #1440 minutes is 1 day. 
        
        #unittest = self.request.get('unittest')
        #if unittest:
            ## Always create a new room for the unit tests.
            #roomName = generate_random(8)
        
        roomName = roomName
        
        
        logging.info('Preparing to add user to room ' + roomName)
        user = None
        initiator = 0
        
        if roomName:
            room_link = "/" + roomName 
            with LOCK:
                room = room_module.Room.get_by_id(roomName)
                if not room and debug != "full":
                    # New room.
                    user = generate_random(8)
                    room = room_module.Room(id = roomName)
                    room.add_user(user)
                    logging.info('First user ' + user + ' added to room ' + roomName)
                    if debug != 'loopback':
                        initiator = 0
                    else:
                        room.add_user(user)
                        initiator = 1
                elif room and room.get_occupancy() == 1 and debug != 'full':
                    # 1 occupant.
                    user = generate_random(8)
                    room.add_user(user)
                    logging.info('Second user ' + user + ' added to room ' + roomName)                    
                    initiator = 1
                else:
                    # 2 occupants (full).
                    logging.warning('Room ' + roomName + ' is full')
                    
                    params = {
                        'errorStatus': 'roomIsFull',
                        'roomName': roomName,
                        'roomLink': room_link,
                    }                
                    return json.dumps(params)
        
            
            logging.info('Room ' + roomName + ' has state ' + str(room))
        
    
            turn_url = 'https://computeengineondemand.appspot.com/'
            turn_url = turn_url + 'turn?' + 'username=' + user + '&key=4080218913'
        

            token = create_channel(room, user, token_timeout)
        
        else :
            token = ''
            turn_url = ''
            room_link = ''
        
        # TODO - look at the original apprtc code to see if these values should be set.
        audio = None
        video = None
        turn_server = None
        ts_pwd = None
        ice_transports = None
        pc_config = make_pc_config(stun_server, turn_server, ts_pwd, ice_transports)
        pc_constraints = make_pc_constraints(dtls, dscp, ipv6, opusfec)
        offer_constraints = make_offer_constraints()
        media_constraints = make_media_stream_constraints(audio, video)            
        
        params = {
            'errorStatus': error_status,
            'channelToken': token,
            'myUsername': user,
            'roomName': roomName,
            'roomLink': room_link,
            'rtcInitiator': initiator,
            'pcConfig': pc_config,
            'pcConstraints': pc_constraints,
            'offerConstraints': offer_constraints,
            'mediaConstraints': media_constraints,
            'turnUrl': turn_url,
            'stereo': stereo,
            'audioRecvBitrate': arbr,
            'audioSendBitrate': asbr,
            'videoRecvBitrate': vrbr,
            'videoSendBitrate': vsbr,
            'videoSendInitialBitrate': vsibr,
            'audioSendCodec': audio_send_codec,
            'audioReceiveCodec': audio_receive_codec,
            'stereoscopic': ssr,
            'includeVrJs': include_vr_js,
            'metaViewport': meta_viewport,
            'debugBuildEnabled' : vidsetup.DEBUG_BUILD,
        }        
        return json.dumps(params)
    except:
        error_status = 'serverError'
        status_reporting.log_call_stack_and_traceback(logging.error, extra_info = error_status) 
        return json.dumps({'errorStatus': error_status}) 

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




class GetView(webapp2.RequestHandler):
    """ Render whatever template the client has requested """
    
    @handle_exceptions
    def get(self, current_template):   
        response_type = 'jinja'
        params = {}
        target_page = current_template
        write_response(self.response, response_type, target_page, params)


class GetVideoChatMain(webapp2.RequestHandler):
    
    @handle_exceptions
    def get(self, current_template, roomName):   
        user_agent = self.request.headers['User-Agent']
        
        # copy the json parameters into a jinja variable
        server_video_params_json = get_video_params(roomName, user_agent)
        params = {'serverVideoParamsJson' : server_video_params_json}    
        
        # update the self.response with the current view
        template = jinja_environment.get_template(current_template)
        content = template.render(params)
        self.response.out.write(content)


class GetVideoChatWelcome(webapp2.RequestHandler):
    """ Render whatever template the client has requested """
    
    @handle_exceptions
    def get(self, current_template):   
        response_type = 'jinja'
        params = {
            'serverLoginParamsJson' : json.dumps(
                {'minRoomChars' : constants.ROOM_MIN_CHARS,
                 'maxRoomChars' : constants.ROOM_MAX_CHARS,
                 'maxRoomOccupancy' : constants.ROOM_MAX_OCCUPANCY,
                 'roomNameInvalidCharsForRegex' : constants.ROOM_NAME_INVALID_CHARS_FOR_REGEX,
                 })
            }

        target_page = current_template
        write_response(self.response, response_type, target_page, params)


class MainPage(webapp2.RequestHandler):
    """The main UI page, renders the 'index.html' template."""
    
    @handle_exceptions
    def get(self):
        target_page = 'index.html'
        response_type = 'jinja';
        params = {
            'ENABLE_LIVE_RELOAD' : vidsetup.ENABLE_LIVE_RELOAD,
        }

        write_response(self.response, response_type, target_page, params)        
        


app = webapp2.WSGIApplication([
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-video-chat-main.html>/<roomName:.+>', GetVideoChatMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-welcome.html>', GetVideoChatWelcome),
    webapp2.Route(r'/_lx<current_template:/lx-templates/.+>', GetView),
    webapp2.Route(r'/_lx/handle_room/<roomName:.+>', rest_functionality.HandleRooms),
    (r'/_lx/message', MessagePage),
    (r'/_lx/log_error', error_reporting_from_client.LogClientError),
    (r'/_ah/channel/connected/', ConnectPage),
    (r'/_ah/channel/disconnected/', DisconnectPage),
    (r'/.*', MainPage),
    (r'/', MainPage),
    ], debug=True)



app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500