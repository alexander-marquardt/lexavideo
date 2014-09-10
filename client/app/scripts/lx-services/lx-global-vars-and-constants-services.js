'use strict';

/* global $ */

angular.module('lxGlobalVarsAndConstants.services', [])



    .factory('globalVarsService', function () {
        /* This services provides access to variables that are used by multiple services, and that don't
         fit easily into any of the currently defined services. These variables may be accessed and
         modified directly from anywhere in the code.
         */
        var screenXsMax = $('#id-dummy-xs-div').width();
        return {

            // The second person to join a chatroom will be the rtcInitiator. It is done in this manner because
            // the first to join will be ready and waiting before the second person, and therefore it makes sense
            // to have the second person initiate the call to to first person.
            rtcInitiator : null, // set in updateGlobalVarsWithServerConstantsService
            pcConfig : null,

            // Set up audio and video regardless of what devices are present.
            sdpConstraints : {'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true }
            },

            // the following value should match the value defined in bootstrap for $screen-xs-max. This will be
            // used for enabling and disabling the remote/local video windows on small devices for which only one
            // or the other will be shown.
            screenXsMax : screenXsMax
        };
    })

    .factory('serverConstantsService', function($q) {
        /* Provides constant values that are sent from the server to the client when the page is loaded.
         Once these values are set, they should not need to be changed.
         */
        var deferred = $q.defer();

        return {
            errorMessage : null,
            channelToken : null,
            myUsername : null,
            roomKey : null,
            roomLink : null,
            rtcInitiator : null,
            pcConfig : null,
            pcConstraints : null,
            offerConstraints : null,
            mediaConstraints : {audio: null, video:null},
            turnUrl : null,
            stereo : null,
            audioSendBitrate : null,
            audioRecvBitrate : null,
            videoSendBitrate : null,
            videoRecvBitrate : null,
            videoSendInitialBitrate : null,
            stereoscopic : null,
            audioSendCodec : null,
            audioReceiveCodec : null,
            debugBuildEnabled : null,
            constantsAreLoaded : deferred
        };
    })

    .factory('updateGlobalVarsWithServerConstantsService', function(serverConstantsService, globalVarsService) {
        // when we update serverConstantsService, we need to update some of the global Vars
        return {
            doUpdate: function() {
                globalVarsService.rtcInitiator = serverConstantsService.rtcInitiator;
                globalVarsService.pcConfig = serverConstantsService.pcConfig;
            }
        };
    });

