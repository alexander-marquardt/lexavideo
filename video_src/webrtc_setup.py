
import json
import logging
import random
import vidsetup

from video_src import messaging
from video_src import room_module
from video_src import status_reporting

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





def make_loopback_answer(message):
    message = message.replace("\"offer\"", "\"answer\"")
    message = message.replace("a=ice-options:google-ice\\r\\n", "")
    return message




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




def get_video_params_json(user_agent):
    """ Returns a json object that contains the video parameters that will be used for setting up the webRtc communications and display"""
    
    
    try:

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


        # Options for making pcConstraints
        dtls = ''
        dscp = ''
        ipv6 = ''
        opusfec = ''
        

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



        # TODO - look at the original apprtc code to see if these values should be set.
        turn_server = None
        ts_pwd = None
        ice_transports = None
        pc_config = make_pc_config(stun_server, turn_server, ts_pwd, ice_transports)
        pc_constraints = make_pc_constraints(dtls, dscp, ipv6, opusfec)
        offer_constraints = make_offer_constraints()

        server_video_params = {
            'pcConfig': pc_config,
            'pcConstraints': pc_constraints,
            'offerConstraints': offer_constraints,
            'audioSendCodec': audio_send_codec,
            'audioReceiveCodec': audio_receive_codec,
            'metaViewport': meta_viewport,
        }
        return json.dumps(server_video_params)
    except:
        error_status = 'serverError'
        status_reporting.log_call_stack_and_traceback(logging.error, extra_info = error_status) 
        return json.dumps({'errorStatus': error_status}) 


