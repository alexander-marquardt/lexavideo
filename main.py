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
from google.appengine.ext import db

from video_src import models, room_module, http_helpers, status_reporting


# We "hack" the directory that jinja looks for the template files so that it is always pointing to
# the correct location, irregardless of if we are in the debug or production build. 
jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__) + "/" + vidsetup.BASE_STATIC_DIR))



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

def get_default_stun_server(user_agent):
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
    client_id = room.make_client_id(user)
    return channel.create_channel(client_id, duration_minutes)

def make_loopback_answer(message):
    message = message.replace("\"offer\"", "\"answer\"")
    message = message.replace("a=ice-options:google-ice\\r\\n", "")
    return message



def handle_message(room, user, message):
    # This function passes a message from one user in a given "room" to the other user in the same room.
    # It is used for exchanging sdp (session description protocol) data for setting up sessions, as well
    # as for passing video and other information from one user to the other. 

    try:
        message_obj = json.loads(message)
        message = message.decode("utf-8")
        other_user = room.get_other_user(user)
        room_key = room.key.id()

        message_type = message_obj['messageType']
        message_payload = message_obj['messagePayload']

        if message_type == 'sdp' and message_payload['type'] == 'bye':
            # This would remove the other_user in loopback test too.
            # So check its availability before forwarding Bye message.
            room.remove_user(user)
            logging.info('User ' + user + ' quit from room ' + room_key)
            logging.info('Room ' + room_key + ' has state ' + str(room))

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
            logging.warning('Cannot deliver message from user: %s to other_user: %s since they are not in the room: %s' % (user, other_user, room_key))
            # For unittest
            #on_message(room, user, message)
            pass

    except:
        status_reporting.log_call_stack_and_traceback(logging.error)
        
    




def send_saved_messages(client_id):
    messages = models.Message.get_saved_messages(client_id)
    for message in messages:
        channel.send_message(client_id, message.msg)
        logging.info('Delivered saved message to ' + client_id)
        message.delete()
        

def on_message(room, user, message):
    client_id = room.make_client_id(user)
    if room.is_connected(user):
        channel.send_message(client_id, message)
        logging.info('Delivered message to user ' + user)
    else:
        new_message = models.Message(client_id = client_id, msg = message)
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



@db.transactional
def connect_user_to_room(room_key, active_user):
    room = room_module.Room.get_by_id(room_key)
    # Check if room has active_user in case that disconnect message comes before
    # connect message with unknown reason, observed with local AppEngine SDK.
    if room and room.has_user(active_user):
        room.set_connected(active_user)
        logging.info('User ' + active_user + ' connected to room ' + room_key)
        logging.info('Room ' + room_key + ' has state ' + str(room))
        
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
        logging.warning('Unexpected Connect Message to room ' + room_key + 'by user ' + active_user)

        
    return room

class ConnectPage(webapp2.RequestHandler):
    def post(self):
        key = self.request.get('from')
        room_key, user = key.split('/')
        with LOCK:
            room = connect_user_to_room(room_key, user)
            if room and room.has_user(user):
                send_saved_messages(room.make_client_id(user))

class DisconnectPage(webapp2.RequestHandler):
    def post(self):
        # temporarily disable disconnect -- this will be replaced with a custom disconnect call from the javascript as opposed to monitoring 
        # the channel stauts.
        pass    

        #key = self.request.get('from')
        #room_key, user = key.split('/')
        #with LOCK:
            #room = Room.get_by_id(room_key)
            #if room and room.has_user(user):
                #other_user = room.get_other_user(user)
                #room.remove_user(user)
                #logging.info('User ' + user + ' removed from room ' + room_key)
                #logging.info('Room ' + room_key + ' has state ' + str(room))
                #if other_user and other_user != user:

                    #message_object = {"messageType": "sdp",
                                                        #"messagePayload" : {
                                                            #"type" : "bye"
                                                        #}}
                    #channel.send_message(make_client_id(room, other_user),
                                                                #json.dumps(message_object))
                    #logging.info('Sent BYE to ' + other_user)
        #logging.warning('User ' + user + ' disconnected from room ' + room_key)


class MessagePage(webapp2.RequestHandler):
    def post(self):
        message = self.request.body
        room_key = self.request.get('r')
        user = self.request.get('u')
        with LOCK:
            room = room_module.Room.get_by_id(room_key)
            if room:
                handle_message(room, user, message)
            else:
                logging.warning('Unknown room ' + room_key)


class GetVideoParams(webapp2.RequestHandler):
    """The main UI page, renders the 'index.html' template."""
    def get(self):
        """Renders the main page. When this page is shown, we create a new
        channel to push asynchronous updates to the client."""

        # Append strings to this list to have them thrown up in message boxes. This
        # will also cause the app to fail.
        error_messages = []
        # Get the base url without arguments.
        base_url = self.request.path_url
        user_agent = self.request.headers['User-Agent']
        room_key = sanitize(self.request.get('r'))
        response_type = self.request.get('t')
        stun_server = self.request.get('ss')
        if not stun_server:
            stun_server = get_default_stun_server(user_agent)
        turn_server = self.request.get('ts')
        ts_pwd = self.request.get('tp')
        ice_transports = self.request.get('it')

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
        audio = self.request.get('audio')
        video = self.request.get('video')

        # The hd parameter is a shorthand to determine whether to open the
        # camera at 720p. If no value is provided, use a platform-specific default.
        # When defaulting to HD, use optional constraints, in case the camera
        # doesn't actually support HD modes.
        hd = self.request.get('hd').lower()
        if hd and video:
            message = 'The "hd" parameter has overridden video=' + video
            logging.error(message)
            error_messages.append(message)
        if hd == 'true':
            video = 'mandatory:minWidth=1280,mandatory:minHeight=720'
        elif not hd and not video and get_hd_default(user_agent) == 'true':
            video = 'optional:minWidth=1280,optional:minHeight=720'

        # ARM - hack - set video to '' because using the above settings seems to cause firefox to
        # set the local video to a strange aspect ratio that is too tall. This happens only
        # after the non-firefox user leaves a call, and then rejoins it.
        video = ''

        if self.request.get('minre') or self.request.get('maxre'):
            message = ('The "minre" and "maxre" parameters are no longer supported. '
                       'Use "video" instead.')
            logging.error(message)
            error_messages.append(message)

        audio_send_codec = self.request.get('asc', default_value = '')
        if not audio_send_codec:
            audio_send_codec = get_preferred_audio_send_codec(user_agent)

        audio_receive_codec = self.request.get('arc', default_value = '')
        if not audio_receive_codec:
            audio_receive_codec = get_preferred_audio_receive_codec()

        # Set stereo to false by default.
        stereo = self.request.get('stereo', default_value = 'false')

        # Read url params audio send bitrate (asbr) & audio receive bitrate (arbr)
        asbr = self.request.get('asbr', default_value = '')
        arbr = self.request.get('arbr', default_value = '')

        # Read url params video send bitrate (vsbr) & video receive bitrate (vrbr)
        vsbr = self.request.get('vsbr', default_value = '')
        vrbr = self.request.get('vrbr', default_value = '')

        # Read url params for the initial video send bitrate (vsibr)
        vsibr = self.request.get('vsibr', default_value = '')

        # Options for making pcConstraints
        dtls = self.request.get('dtls')
        dscp = self.request.get('dscp')
        ipv6 = self.request.get('ipv6')
        opusfec = self.request.get('opusfec')

        # Stereoscopic rendering.  Expects remote video to be a side-by-side view of
        # two cameras' captures, which will each be fed to one eye.
        ssr = self.request.get('ssr')
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

        debug = self.request.get('debug')
        if debug == 'loopback':
            # Set dtls to false as DTLS does not work for loopback.
            dtls = 'false'

        # token_timeout for channel creation, default 30min, max 1 days, min 3min.
        token_timeout = self.request.get_range('tt',
                                               min_value = 3,
                                               max_value = 1440,
                                               default = 30)

        #unittest = self.request.get('unittest')
        #if unittest:
            ## Always create a new room for the unit tests.
            #room_key = generate_random(8)

        #if not room_key:
            #room_key = generate_random(8)
            #redirect = '/?r=' + room_key
            #redirect = append_url_arguments(self.request, redirect)
            #self.redirect(redirect)
            #logging.info('Redirecting visitor to base URL to ' + redirect)
            #return

        logging.info('Preparing to add user to room ' + room_key)
        user = None
        initiator = 0
        
        if room_key:
            with LOCK:
                room = room_module.Room.get_by_id(room_key)
                if not room and debug != "full":
                    # New room.
                    user = generate_random(8)
                    room = room_module.Room(id = room_key)
                    room.add_user(user)
                    if debug != 'loopback':
                        initiator = 0
                    else:
                        room.add_user(user)
                        initiator = 1
                elif room and room.get_occupancy() == 1 and debug != 'full':
                    # 1 occupant.
                    user = generate_random(8)
                    room.add_user(user)
                    initiator = 1
                else:
                    # 2 occupants (full).
                    params = {
                        'error': 'full',
                        'error_messages': ['The room is full.'],
                        'room_key': room_key
                    }
                    write_response(self.response, response_type, 'full.html', params)
                    logging.info('Room ' + room_key + ' is full')
                    return
    
            logging.info('User ' + user + ' added to room ' + room_key)
            logging.info('Room ' + room_key + ' has state ' + str(room))

            if turn_server == 'false':
                turn_server = None
                turn_url = ''
            else:
                turn_url = 'https://computeengineondemand.appspot.com/'
                turn_url = turn_url + 'turn?' + 'username=' + user + '&key=4080218913'

                
            room_link = base_url + '?r=' + room_key
            room_link = append_url_arguments(self.request, room_link)
            token = create_channel(room, user, token_timeout)

        else :
            token = ''
            turn_url = ''
            room_link = ''

        
        pc_config = make_pc_config(stun_server, turn_server, ts_pwd, ice_transports)
        pc_constraints = make_pc_constraints(dtls, dscp, ipv6, opusfec)
        offer_constraints = make_offer_constraints()
        media_constraints = make_media_stream_constraints(audio, video)            

        params = {
            'errorMessages': error_messages,
            'channelToken': token,
            'myUsername': user,
            'roomKey': room_key,
            'roomLink': room_link,
            'rtcInitiator': initiator,
            'pcConfig': json.dumps(pc_config),
            'pcConstraints': json.dumps(pc_constraints),
            'offerConstraints': json.dumps(offer_constraints),
            'mediaConstraints': json.dumps(media_constraints),
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
        }
        
        response_type = 'json'
        target_page = None
        write_response(self.response, response_type, target_page, params)        


class GetView(webapp2.RequestHandler):
    """ Render whatever template the client has requested """
    def get(self, current_view):   
        response_type = 'jinja'
        params = {
            'ENABLE_LIVE_RELOAD' : vidsetup.ENABLE_LIVE_RELOAD,
            'DEBUG_BUILD' : vidsetup.DEBUG_BUILD,
            }
        target_page = current_view
        write_response(self.response, response_type, target_page, params)


class MainPage(webapp2.RequestHandler):
    """The main UI page, renders the 'index.html' template."""
    def get(self):
        target_page = 'index.html'
        response_type = 'jinja';
        params = {}
        write_response(self.response, response_type, target_page, params)        
        

app = webapp2.WSGIApplication([
    webapp2.Route(r'/_jx<current_view:/lx-templates/.+>', GetView),
    (r'/json/get_video_params', GetVideoParams),
    (r'/message', MessagePage),
    (r'/_ah/channel/connected/', ConnectPage),
    (r'/_ah/channel/disconnected/', DisconnectPage),
    (r'/.*', MainPage),
    (r'/', MainPage),
    ], debug=True)



app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500