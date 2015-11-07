/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/
'use strict';

/* global $ */

angular.module('lxGlobalVarsAndConstants.services', [])

    .factory('lxJavascriptConstants', function () {

        var self =  {

            // Define the maximum amount of time that the channel has to respond to a heartbeat message, before
            // we decide that the channel is down and needs to be re-initialized.
            msToWaitForHeartbeatResponse: 7500
        };
        return self;
    })

    /*
     This services provides access to variables that are used by multiple services, and that don't
     fit easily into any of the currently defined services. These variables may be accessed and
     modified directly from anywhere that is wrapped inside of the lx-use-chatroom-controller.
     */
    .factory('lxChatRoomVarsService', function () {

        var self =  {

            // Set up audio and video regardless of what devices are present.
            sdpConstraints : {'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true }
            }
        };
        return self;
    })

    /*
    lxVideoParamsService defines settings that are required for setting up the video codecs and connectivity between
    the peers. Most of these settings are taken from the original apprtc.py file provided by google. Please see that
    file for a more in-depth description of what is going on.
     */
    .factory('lxVideoParamsService', function() {

        var stunServer = 'stun.l.google.com:19302';

        // If we set the turnServer here, then turn servers will not be retrieved when maybeRequestTurn
        // is executed.
        var turnServer = null;
        var tsPwd = null;

        var iceTransports = null;


        function getPreferredAudioSendCodec() {
            // Empty string means no preference.
            var preferredAudioSendCodec = '';
            // Prefer to send ISAC on Chrome for Android.
            if ($.browser.chrome && $.browser.android) {
                preferredAudioSendCodec = 'ISAC/16000';
            }
            return preferredAudioSendCodec;
        }

        function getDefaultStunServer() {
            // others you can try: stun.services.mozilla.com, stunserver.org
            return stunServer;
        }


        function makePcConfig(turnServer, tsPwd, iceTransports) {

            var stunServer = getDefaultStunServer();
            var config = {};
            var servers = [];

            if (stunServer) {
                var stunConfig = 'stun:' + stunServer;
                servers.push({'urls': stunConfig});
            }

            if (turnServer) {
                var turnConfig = 'turn:' + turnServer;
                servers.push({'urls': [turnConfig], 'credential': tsPwd});
            }

            config.iceServers = servers;

            if (iceTransports) {
                config.iceTransports = iceTransports;
            }

            return config;
        }

        function makePcConstraints() {
            var constraints = { 'optional': [] };
            constraints.optional.push({'googImprovedWifiBwe': true});
            return constraints;
        }

        return {
            'audioReceiveCodec': 'opus/48000',
            'audioSendCodec': getPreferredAudioSendCodec(),
            'offerConstraints': { 'mandatory': {}, 'optional': [] },
            'pcConfig': makePcConfig(turnServer, tsPwd, iceTransports),
            'pcConstraints': makePcConstraints(),
            'mediaConstraints': {
                'video': {
                    'mandatory': {

                    },

                    // Note: place 'goog' constraints in the optional section, as they will not work in other browsers.
                    // Also, have a look at the apprtc code (server side) to see how they setup these constraints.
                    'optional': []
                },

                'audio' : {
                    mandatory: {

                    },
                    optional: []
                }
            },
            'videoSendInitialBitrate': '',
            'audioRecvBitrate': '',
            'audioSendBitrate': '',
            'videoRecvBitrate': '',
            'videoSendBitrate': '',
            'stereoscopic': '',
            'stereo': false
        };
    })

    .factory('lxAppWideConstantsService', function() {
        // constants that are loaded in the main page, and that will be used by all views.
        return {
            /* this object will be loaded with variables from server once LxMainController is executed
             */
        };
    })

    .factory('lxAppWideVarsService', function() {
        /* Provides variables that will be used across different views.
         */
        return {

        };
    })

    .factory('lxLandingPageConstantsService', function() {
        /* Provides constant values that are sent from the server to the client when the page is loaded.
         */

        return {
            /* This object will be loaded with a bunch of variables from server once the  is loaded.

            eg will contain:
            minRoomChars: ...,
            maxRoomChars: ...,
            etc.
            (Look at the server code to see which variables will be embedded)
             */
        };
    });
