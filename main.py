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
import re
import json
import jinja2
import webapp2

from google.appengine.ext import ndb

from video_src import constants
from video_src import error_reporting_from_client
from video_src import http_helpers
from video_src import messaging
from video_src import models
from video_src import rest_functionality
from video_src import room_module
from video_src import status_reporting
from video_src import webrtc_setup

from video_src.error_handling import handle_exceptions



# We "hack" the directory that jinja looks for the template files so that it is always pointing to
# the correct location, irregardless of if we are in the debug or production build. 
# StrictUndefined means that jinja will raise an error if a template variable is used but has 
# not been defined - this is important for us because we may accidentaly attempt to use an angular template
# variable inside of jinja code, and this will notify us of the error.
jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__) + "/" + vidsetup.BASE_STATIC_DIR),
    undefined=jinja2.StrictUndefined)


def write_response(response, response_type, target_page, params):
    if response_type == 'json':
        content = json.dumps(params)
    else:
        template = jinja_environment.get_template(target_page)
        content = template.render(params)
    response.out.write(content)



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
        server_video_params_json = webrtc_setup.get_video_params(roomName, user_agent)
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
    (r'/_lx/message', room_module.MessagePage),
    (r'/_lx/log_error', error_reporting_from_client.LogClientError),
    (r'/_ah/channel/connected/',  room_module.ConnectPage),
    (r'/_ah/channel/disconnected/',  room_module.DisconnectPage),
    (r'/.*', MainPage),
    (r'/', MainPage),
    ], debug=True)



app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500