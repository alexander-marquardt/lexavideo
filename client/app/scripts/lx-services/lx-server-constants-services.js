'use strict';

angular.module('lxServerConstants.services', [])
    .factory('serverConstantsService', function() {
            /* Provides constant values that are sent from the server to the client when the page is loaded.
               Once these values are set, they should not need to be changed.
             */
        return {
            errorMessages : [],
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
            debugBuildEnabled : null
        }
    });
