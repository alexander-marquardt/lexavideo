/**
 * Created by alexandermarquardt on 2014-09-04.
 */



'use strict';

var lxSelectVideoTypePreferenceServices = angular.module('lxVideoNegotiation.services', []);


lxSelectVideoTypePreferenceServices.factory('lxSelectAndNegotiateVideoTypeService',
    function(
        $animate,
        $log,
        lxCallService,
        lxMessageService,
        lxStreamService)
    {

    var setVideoSignalingStatusForUserFeedback = function(scope, newValue) {

        // if the user has not yet given access to their local stream, then this is the feedback message
        // that they will be shown.
        if (!lxStreamService.localStream) {
            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'mustEnableVideoToStartTransmission';
        }

        // if there is no remote user in the room, then indicate that they are not connected to anyone right now
        else if (!scope.roomOccupancyObject.remoteUserId) {
            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'localUserIsAlone';
        }

        else if (scope.videoCameraStatusObject.remoteVideoActivationStatus === 'waitingForActivateVideo') {
            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAgreeToExchangeVideo';
        }

        else if (scope.videoCameraStatusObject.remoteVideoActivationStatus === 'doNotActivateVideo') {
            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasDeniedToExchangeVideo';
        }

        // else if the remote user has not yet given access to their camera and microphone, we show the local
        // user a message indicating that we are still waiting for the remote user to permit access.
        else if (scope.videoCameraStatusObject.remoteVideoActivationStatus !== 'activateVideo' ) {
            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasNotEnabledVideoYet';
        }

        // if the user has already given access to their local stream, then we can show them the
        // feedback that has been requested.
        else {
            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = newValue;
        }
    };


    var self =  {


        /*
         This function will monitor the type of to see if each user has activated their video and if they are
         currently in the room.
         */
        watchForVideoSettingsChanges : function(scope) {

            // Watch to see if the user has given access to their camera/microphone (localStream), and if so
            // make sure that the user feedback is correct, and that the videoSignalingObject is updated to
            // reflect the new value.
            scope.$watch(lxStreamService.getLocalStream, function(localStream) {

                if (localStream) {

                    // If the user was being shown a message telling them to enable their video, then we can now remove
                    // this message.
                    if (scope.videoSignalingObject.videoSignalingStatusForUserFeedback === 'mustEnableVideoToStartTransmission') {
                        setVideoSignalingStatusForUserFeedback(scope, null);
                    }
                }
            });

            // remote user has either entered or left the room.
            scope.$watch('roomOccupancyObject.remoteUserId', function() {
                // call code to generate feedback messages with a null value - this will result in the feedback
                // being updated with one of the message override values defined in setVideoSignalingStatusForUserFeedback,
                // or possibly by clearing the feedback in the case that none of the overrides are triggered.
                setVideoSignalingStatusForUserFeedback(scope, null);
            });

            // Monitor remoteVideoActivationStatus to track if the remote user has activated
            // their video elements and requested access to their camera.
            scope.$watch('videoCameraStatusObject.remoteVideoActivationStatus', function(remoteVideoActivationStatus) {

                if (remoteVideoActivationStatus == 'activateVideo') {
                    // clear feedback messages
                    setVideoSignalingStatusForUserFeedback(scope, null);
                }
            });
        }
    };
    return self;
});

lxSelectVideoTypePreferenceServices.factory('lxAccessVideoElementsAndAccessCameraService',
    function(
        lxMessageService
    ) {

        return {
            sendStatusOfVideoElementsEnabled: function(scope, localVideoElementsEnabled, queryForRemoteVideoElementsEnabled) {

                // Only attempt to send a message if there is another user in the room
                if (scope.roomOccupancyObject.remoteUserId) {
                    lxMessageService.sendMessage('videoCameraStatusMsg',
                        {
                            videoElementsEnabledAndCameraAccessRequested: localVideoElementsEnabled,

                            // The following will result in the remote user sending their status of the video Elements
                            // and camera access (ie. have they started the process to enable them) - currently
                            // we request this information every time that we send the remote user the local status -
                            // this is strictly not necessary, but doesn't cost much and provides some redundancy in
                            // the case of un-delivered messages.
                            queryVideoElementsEnabledAndCameraAccessRequested: queryForRemoteVideoElementsEnabled
                        }
                    );
                }
            }
        }
    }
);