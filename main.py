#!/usr/bin/python2.4
#
# Copyright 2011 Google Inc. All Rights Reserved.

"""
Main URL hander for Videochat Applications written by Alexander Marquardt - code started in summer of 2014. 
"""

# Important Note: you must concurrently run "grunt serve" in the "client" directory in order to ensure that css
# and other files are correctly built - *even* on the development server, since we are using sass which requires
# a pre-compilation step.


import webapp2
import vidsetup

from video_src import error_reporting_from_client
from video_src import room_module
from video_src import registration_and_login
from video_src import messaging
from video_src import views

import gaesessions

app = webapp2.WSGIApplication([
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-chat-room-main.html>/<chat_room_name_from_url:.+>', views.UserChatRoomMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-landing-page-main.html>', views.LandingPageMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/.+>', views.GetView),
    webapp2.Route(r'/_lx/handle_room/<chat_room_name_from_url:.+>', room_module.HandleEnterIntoRoom),
    webapp2.Route(r'/_lx/message', messaging.MessagePage),
    webapp2.Route(r'/_lx/log_error', error_reporting_from_client.LogClientError),
    webapp2.Route(r'/_lx/channel/user_heartbeat/', messaging.UserHeartbeat),
    webapp2.Route(r'/_lx/channel/open_channel/', messaging.OpenChannel),
    webapp2.Route(r'/_lx/channel/manual_disconnect/', messaging.DisconnectPage),
    webapp2.Route(r'/_lx/admin/cleanup_sessions', gaesessions.SessionAdmin, handler_method='cleanup_sessions'),
    webapp2.Route(r'/_ah/channel/connected/',  messaging.ConnectPage),
    webapp2.Route(r'/_ah/channel/disconnected/',  messaging.DisconnectPage),

    webapp2.Route(r'/temp-login', registration_and_login.CreateTemporaryUserHandler, name='temp-login'),

    webapp2.Route(r'/', views.MainPage, name='main'),

    # Don't use webapp2.Route for the following "catch-all" -- for some reason it doesn't work correctly if used
    (r'/.*', views.MainPage),
    ], debug=vidsetup.DEBUG_BUILD, config=registration_and_login.config)


from video_src import http_helpers
app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500