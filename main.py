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

from video_src import connectivity
from video_src import error_reporting_from_client
from video_src import chat_room_module
from video_src import registration_and_login
from video_src import messaging
from video_src import views

# Note: there is an inconsistency in using trailing slashes due to the fact that the google api uses trailing
# slashes on their channel URLs, but the angular resource api generates URLs that do not contain trailing
# slashes (ie. the handle_room URL below). We have decided to use both styles, as it really doesn't matter much.
app = webapp2.WSGIApplication([
    webapp2.Route(r'/_lx<current_template:/lx-templates/lx-landing-page-main.html>', views.LandingPageMain),
    webapp2.Route(r'/_lx<current_template:/lx-templates/.+>', views.GetView),
    webapp2.Route(r'/_lx/create_new_room_if_does_not_exist/', chat_room_module.CreateNewRoomIfDoesNotExist),
    webapp2.Route(r'/_lx/check_if_chat_room_exists/<chat_room_name_from_url:.+>', chat_room_module.CheckIfChatRoomExists),
    webapp2.Route(r'/_lx/add_client_to_room/', connectivity.AddClientToRoom),
    webapp2.Route(r'/_lx/remove_client_from_room/', connectivity.RemoveClientFromRoom),
    webapp2.Route(r'/_lx/message_room', messaging.MessageRoom),
    webapp2.Route(r'/_lx/message_client', messaging.MessageClient),
    webapp2.Route(r'/_lx/temp_login', registration_and_login.TempLogin),
    webapp2.Route(r'/_lx/log_error', error_reporting_from_client.LogClientError),
    webapp2.Route(r'/_lx/channel/syn_user_heartbeat/', connectivity.SynClientHeartbeat),
    webapp2.Route(r'/_lx/channel/update_client_status_and_request_updated_room_info/', connectivity.UpdateClientStatusAndRequestUpdatedRoomInfo),
    webapp2.Route(r'/_lx/channel/request_channel_token/', connectivity.RequestChannelToken),
    webapp2.Route(r'/_lx/channel/manual_disconnect/', connectivity.ManuallyDisconnectClient),
    webapp2.Route(r'/_ah/channel/connected/',  connectivity.ConnectClient),
    webapp2.Route(r'/_ah/channel/disconnected/',  connectivity.AutoDisconnectClient),

    webapp2.Route(r'/', views.MainPage, name='main'),

    # Don't use webapp2.Route for the following "catch-all" -- for some reason it doesn't work correctly if used
    (r'/.*', views.MainPage),],
    debug=vidsetup.DEBUG_BUILD,
    config = {
        'webapp2_extras.auth': {
            'user_model': 'video_src.users.UserModel',
            },
    }
)


from video_src import http_helpers
app.error_handlers[404] = http_helpers.handle_404
app.error_handlers[500] = http_helpers.handle_500