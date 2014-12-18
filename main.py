#!/usr/bin/python2.4
#
# Copyright 2011 Google Inc. All Rights Reserved.

"""
Main URL hander for Videochat Applications written by Alexander Marquardt - code started in summer of 2014. 
"""

import webapp2
import vidsetup

from video_src import error_reporting_from_client
from video_src import rest_functionality
from video_src import login_and_sessions
from video_src import messaging
from video_src import views

import gaesessions

app = webapp2.WSGIApplication([
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-chat-room-main.html>/<chat_room_name_from_url:.+>', views.UserChatRoomMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-landing-page-main.html>', views.LandingPageMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/.+>', views.GetView),
    webapp2.Route(r'/_lx/handle_room/<chat_room_name_from_url:.+>', rest_functionality.HandleEnterIntoRoom),
    webapp2.Route(r'/_lx/message', messaging.MessagePage),
    webapp2.Route(r'/_lx/log_error', error_reporting_from_client.LogClientError),
    webapp2.Route(r'/_lx/channel/manual_disconnect/', messaging.DisconnectPage),
    webapp2.Route(r'/_lx/admin/cleanup_sessions', gaesessions.SessionAdmin, handler_method='cleanup_sessions'),
    webapp2.Route(r'/_ah/channel/connected/',  messaging.ConnectPage),
    webapp2.Route(r'/_ah/channel/disconnected/',  messaging.DisconnectPage),

    webapp2.Route(r'/temp-login', login_and_sessions.CreateTemporaryUserHandler, name='temp-login'),

    webapp2.Route(r'/', views.MainPage, name='main'),
    webapp2.Route(r'/.*', views.MainPage),
    ], debug=vidsetup.DEBUG_BUILD, config=login_and_sessions.config)


from video_src import http_helpers
app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500