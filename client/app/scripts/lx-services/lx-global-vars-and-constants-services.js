'use strict';

/* global $ */

angular.module('lxGlobalVarsAndConstants.services', [])


    /*
     This services provides access to variables that are used by multiple services, and that don't
     fit easily into any of the currently defined services. These variables may be accessed and
     modified directly from anywhere that is wrapped inside of the lx-use-chatroom-controller.
     */
    .factory('lxUseChatRoomVarsService', function () {

        var screenXsMax = $('#id-dummy-xs-div').width();
        var self =  {

            pcConfig : null,

            // Set up audio and video regardless of what devices are present.
            sdpConstraints : {'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true }
            },

            // the following value should match the value defined in bootstrap for $screen-xs-max. This will be
            // used for enabling and disabling the remote/local video windows on small devices for which only one
            // or the other will be shown.
            screenXsMax : screenXsMax,

            // Update the globalvars with constants that have been loaded from the server
            doUpdate: function(pcConfig) {
                self.pcConfig = pcConfig;
            }
        };
        return self;
    })

    .factory('lxVideoParamsService', function() {

        function getPreferredAudioSendCodec() {
            // Empty string means no preference.
            var preferredAudioSendCodec = '';
            // Prefer to send ISAC on Chrome for Android.
            if ($.browser.chrome && $.browser.android) {
                preferredAudioSendCodec = 'ISAC/16000';
            }
            return preferredAudioSendCodec;
        }

        return {
            'audioReceiveCodec': 'opus/48000',
            'audioSendCodec': getPreferredAudioSendCodec()

        }
    })

    .factory('lxAppWideConstantsService', function() {
        // constants that are loaded in the main page, and that will be used by all views.
        return {
            /* this object will be loaded with variables from server once lxVideoChatAppViewCtrl is executed
             */
        };
    })

    .factory('lxAppWideVarsService', function() {
        /* Provides variables that will be used across different views.
         */
        return {

        };
    })

    .factory('lxUseChatRoomConstantsService', function() {
        /* Provides constant values that are sent from the server to the client when the page is loaded.
         */

        return {
            /* This object will be loaded with a bunch of variables from server once the lxChatRoomOuterCtrl is loaded.

            eg will contain:
            chatRoomName: ..,
            pcConfig: ...
            etc.
            (Look at the server code to see which variables will be embedded - these are currently passed in through videoConstantsEmbeddedInHtml)

            TODO - Eventually, constants that are still loaded from the server should be moved into this factory.
             */

            mediaConstraints: {
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
