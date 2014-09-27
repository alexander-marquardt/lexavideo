#!/usr/bin/python2.4
#
# Copyright 2011 Google Inc. All Rights Reserved.

"""
Main URL hander for Videochat Applications written by Alexander Marquardt - code started in summer of 2014. 
"""

import webapp2

from video_src import error_reporting_from_client
from video_src import rest_functionality
from video_src import room_module
from video_src import views


app = webapp2.WSGIApplication([
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-use-chat-room-main.html>/<room_name_from_url:.+>', views.UserChatRoomMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-landing-page-main.html>/<redirect_after_error:error>/<bad_room_name:.+>/<error_string:.+>', views.LandingPageMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-landing-page-main.html>', views.LandingPageMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/.+>', views.GetView),
    webapp2.Route(r'/_lx/handle_room/<room_name_from_url:.+>', rest_functionality.HandleEnterIntoRoom),
    (r'/_lx/message', room_module.MessagePage),
    (r'/_lx/log_error', error_reporting_from_client.LogClientError),
    (r'/_ah/channel/connected/',  room_module.ConnectPage),
    (r'/_ah/channel/disconnected/',  room_module.DisconnectPage),
    (r'/.*', views.MainPage),
    (r'/', views.MainPage),
    ], debug=True)






from video_src import http_helpers
app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500