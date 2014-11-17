/**
 * Created by alexandermarquardt on 2014-09-04.
 */



'use strict';

var lxSelectVideoTypePreferenceServices = angular.module('lxVideoNegotiation.services', []);


lxSelectVideoTypePreferenceServices.factory('lxVideoSettingsNegotiationService',
    function(
        $animate,
        $log,
        lxCallService,
        lxMessageService,
        lxStreamService,
        lxWebRtcSessionService)
    {

    var setVideoSignalingStatusForUserFeedback = function(videoSignalingObject, newValue) {

        // if the user has not yet given access to their local stream, then this is the feedback message
        // that they will be shown.
        if (!lxStreamService.localStream) {
            videoSignalingObject.videoSignalingStatusForUserFeedback = 'mustEnableVideoToStartTransmission';
        }

        // if there is no remote user in the room, then indicate that they are not connected to anyone right now
        else if (!videoSignalingObject.remoteUserId) {
            videoSignalingObject.videoSignalingStatusForUserFeedback = 'localUserIsAlone';
        }

        // else if the remote user has not yet given access to their camera and microphone, we show the local
        // user a message indicating that we are still waiting for the remote user to permit access.
        else if (!videoSignalingObject.remoteIsSendingVideoType) {
            videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasNotEnabledVideoYet';
        }

        // if the user has already given access to their local stream, then we can show them the
        // feedback that has been requested.
        else {
            videoSignalingObject.videoSignalingStatusForUserFeedback = newValue;
        }
    };

    var watchRemoteVideoSignalingStatus = function(scope) {
        return function() {
            var returnVal = scope.videoSignalingObject.remoteVideoSignalingStatus.requestAcceptOrDenyVideoType + ' ' +
                scope.videoSignalingObject.remoteVideoSignalingStatus.videoType;
            //$log.debug('returnVal is "' + returnVal +'"');
            return returnVal;
        };
    };

    var self =  {

        negotiateVideoType :  {
            /* Requests and sets up the type of video that will be transmitted between the two users */

            sendRequestForVideoType : function (videoType) {
                lxMessageService.sendMessage('videoSettings', {requestAcceptOrDenyVideoType: 'requestVideoType', videoType: videoType});
            },

            sendAcceptanceOfVideoType : function(videoType) {
                // send a message to the remote user to indicate that the local user has accepted their offer to
                // change the current video settings (ie. from asciiVideo to hdVideo).
                lxMessageService.sendMessage('videoSettings', {requestAcceptOrDenyVideoType: 'acceptVideoType', videoType: videoType});
            },

            sendDenyOfVideoType : function(videoType) {
                // send a message to the remote user to indicate that local user has denied their offer to change the
                // current video settings.
                lxMessageService.sendMessage('videoSettings', {requestAcceptOrDenyVideoType: 'denyVideoType', videoType: videoType});
            }
        },

        startVideoType: (function() {

            var localMicrophoneIsMutedPreviousSelection = null;

            return function(scope, videoType) {

                if (videoType === 'HD Video') {
                    // once lxCallService has made a successful connection (onRemoteStreamAdded callback is executed),
                    // then localIsSendingVideoType will be updated
                    lxCallService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);


                    // If we have previously switched to non-HD video transmission, then we explicitly disabled
                    // the microphone (see below). Therefore, when we switch back to HD mode, we set the microphone
                    // mute to the value that the user had previously selected.
                    if (localMicrophoneIsMutedPreviousSelection !== null) {
                        // set the local microphone to the value that it had before switching to non-HD video
                        lxCallService.setMicrophoneMute(scope.localVideoObject, localMicrophoneIsMutedPreviousSelection);
                    }
                    // Note: scope.videoSignalingObject.localIsSendingVideoType will be set to 'HD Video' once the
                    // stream is being sent - this happens in the onRemoteStreamAdded callback.

                    // Note: HD Video videoSignalingStatusForUserFeedback messages are cleared inside the onRemoteStreamAdded callback
                }
                else if (videoType === 'ASCII Video') {
                    // Switch to ASCII video type, and stop  the HD video stream.
                    scope.videoSignalingObject.localIsSendingVideoType = videoType;

                    // kill the webRtc session. Ascii video should start to be transmitted in both directions.
                    lxWebRtcSessionService.stop();

                    // mute the audio - this should technically not be necessary, but for some reason during a firefox to chrome session
                    // the audio continues to transmit even though the rtcSession was stopped.
                    localMicrophoneIsMutedPreviousSelection = scope.localVideoObject.isMicrophoneMuted;
                    lxCallService.setMicrophoneMute(scope.localVideoObject, true);
                }
                else {
                    $log.error('Unknown video type received: ' + videoType);
                }
            };
        })(),

        /*
         This function will monitor the type of video that the local user and that the remote user have
         selected for sending between them. This requires some message exchanges before the video type will
         be finalized.
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
                        setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, null);
                    }
                }
            });

            scope.$watch('videoSignalingObject.remoteIsSendingVideoType', function(remoteIsSendingVideoType) {

                if (remoteIsSendingVideoType === null) {
                    setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, 'remoteHasNotEnabledVideoYet');
                }
                else {
                    // if videoSignalingStatusForUserFeedback is 'remoteHasSetVideoToAscii' leave the message up
                    // until it fades away on its own (it has a timer associated with it).
                    if (scope.videoSignalingObject.videoSignalingStatusForUserFeedback !== 'remoteHasSetVideoToAscii') {
                        setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, null);
                    }
                }
            });

            // Monitor localIsNegotiatingForVideoType for changes, and if it changes then initiate an exchange with the remote
            // peer to star to exchange the newly selected video type.
            scope.$watch('videoSignalingObject.localIsNegotiatingForVideoType', function(localIsNegotiatingForVideoType) {

                // if the user has not explicitly requested a modification to the video type by pressing on one of the
                // buttons, then localIsNegotiatingForVideoType should be null and this code should not be executed.
                if (localIsNegotiatingForVideoType !== null) {

                    // Check if there is a remote user in the room
                    if (scope.videoSignalingObject.remoteUserId) {

                        if (localIsNegotiatingForVideoType === 'HD Video' || localIsNegotiatingForVideoType === 'ASCII Video') {

                            // remove the user feedback indicating that we are waiting for the remote user
                            // to accept HD video
                            setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, 'waitingForRemoteToAcceptVideoType: ' + localIsNegotiatingForVideoType);

                            // No need to re-negotiate the videoType, since we have just set it back to a previous value due to
                            // a remote denial for a proposed new videoType.
                            self.negotiateVideoType.sendRequestForVideoType(scope.videoSignalingObject.localIsNegotiatingForVideoType);

                        }
                        else {
                            $log.error('Unknown videoType: ' + localIsNegotiatingForVideoType);
                        }
                    }

                    // The current user is alone in the room
                    else {

                        setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, null);

                        // Send an 'accept' of the selected videoType to the server -- this will cause the room
                        // to update it's value stored for 'currently_selected_video_type'. Future joiners to
                        // the room will have their videoType initialized to this value.
                        self.negotiateVideoType.sendAcceptanceOfVideoType(localIsNegotiatingForVideoType);


                        // set localIsSendingVideoType to localIsNegotiatingForVideoType so that they will be shown the
                        // correct video windows.
                        scope.videoSignalingObject.localIsSendingVideoType = localIsNegotiatingForVideoType;
                    }
                }
            });


            // Monitor remoteUserId to track if the remote user is currently in the room, or out of it
            scope.$watch('videoSignalingObject.remoteUserId', function(newRemoteUserId) {

                if (newRemoteUserId === null) {


                    // remote user is not connected, so set the signaling status to null
                    scope.videoSignalingObject.remoteVideoSignalingStatus.requestAcceptOrDenyVideoType = null;
                    scope.videoSignalingObject.remoteVideoSignalingStatus.videoType = null;

                    // remote user is not connected, so set the sending videoType to null
                    scope.videoSignalingObject.remoteIsSendingVideoType = null;
                }

                setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, null);

            });

            // This watcher will monitor for remote requests to change the current video format, and will either
            // respond directly, or modify a variable that will trigger another watcher that will request user
            // feedback on how to respond. More details in the comments below.
            scope.$watch(watchRemoteVideoSignalingStatus(scope), function() {

                var remoteSignalingStatus = scope.videoSignalingObject.remoteVideoSignalingStatus;
                var localHasSelectedVideoType = scope.videoSignalingObject.localHasSelectedVideoType;

                // check if the remote user has requested a new videoType.
                if (remoteSignalingStatus.requestAcceptOrDenyVideoType === 'requestVideoType') {

                    // If the local user has not yet given access to their camera, then automatically accept the
                    // video type proposed by the remote user
                    if (scope.videoSignalingObject.localUserAccessCameraAndMicrophoneStatus !== 'allowAccess') {

                        // set the locally selected videoType to whatever the remote user has requested.
                        localHasSelectedVideoType = remoteSignalingStatus.videoType;
                        scope.videoSignalingObject.localHasSelectedVideoType = localHasSelectedVideoType;

                        // The local user has not pressed the videoType button, and we have just finished
                        // accepting the new videoType, set localIsNegotiatingForVideoType to null.
                        scope.videoSignalingObject.localIsNegotiatingForVideoType = null;
                    }


                    var haveAutomaticallyAcceptedAsciiVideo = false;
                    // If the remote user has proposed to exchange ASCII Video, then automatically accept it.
                    // By setting the value of localHasSelectedVideoType, this will trigger the code block
                    // below that detects if the local client has selected the same videoType as the remote client.
                    if (remoteSignalingStatus.videoType === 'ASCII Video') {
                        localHasSelectedVideoType = 'ASCII Video';
                        scope.videoSignalingObject.localHasSelectedVideoType = localHasSelectedVideoType;
                        haveAutomaticallyAcceptedAsciiVideo = true;
                    }


                    // if the remote user has requested the videoType that the local user has already selected then
                    // automatically accept the switch to the new videoType
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {

                        self.negotiateVideoType.sendAcceptanceOfVideoType(remoteSignalingStatus.videoType);
                        $log.debug('Automatically accepting video type ' + remoteSignalingStatus.videoType + ' since it was already selected locally. ');

                        self.startVideoType(scope, localHasSelectedVideoType);

                        // If this is being executed as a result of the client automatically accepting the switch
                        // to Ascii video, then the user should be informed of what has just happened.
                        if (haveAutomaticallyAcceptedAsciiVideo) {
                            setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, 'remoteHasSetVideoToAscii');
                        }
                        // Otherwise, clear the user feedback in the video window since the client has switched to the
                        // videoType that the user has selected -- they don't need any extra feedback.
                        else {
                            setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, null);
                        }
                    }

                    // else the remote user has requested a different videoType than what the local user has currently selected
                    // Ask the local user if they want to switch to the new type.
                    else {

                        // remote user has requested that the local user send a video type that is different from
                        // what the local user is currently sending.
                        $log.debug('Remote user has requested ' + remoteSignalingStatus.videoType);


                        // We prompt the local user to see if they agree to transmit the new videoType.
                        // This prompting is triggered by the change in
                        // videoSignalingStatusForUserFeedback and is handled in the directive code.
                        if (remoteSignalingStatus.videoType === 'HD Video' || remoteSignalingStatus.videoType === 'ASCII Video') {
                            setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, 'remoteHasRequestedVideoType: ' + remoteSignalingStatus.videoType);
                        }

                        else {
                            $log.log('Error: unknown remoteSignalingStatus.videoType: ' + remoteSignalingStatus.videoType);
                        }
                    }

                }

                else if (remoteSignalingStatus.requestAcceptOrDenyVideoType === 'denyVideoType') {

                    $log.debug('Remote user has denied ' + remoteSignalingStatus.videoType);
                    setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, 'remoteHasDeniedRequestToExchangeFormat: ' + remoteSignalingStatus.videoType);

                    // since the request to transmit a new format was denied, change the localHasSelectedVideoType back
                    // to the type that is currently/previously being sent - this will change the button that the user
                    // has clicked on back to it's previous state.
                    scope.videoSignalingObject.localHasSelectedVideoType = scope.videoSignalingObject.localIsSendingVideoType;

                    // we have finished with the current request, and are no longer requesting a new videoType.
                    scope.videoSignalingObject.localIsNegotiatingForVideoType = null;
                }

                else if (remoteSignalingStatus.requestAcceptOrDenyVideoType === 'acceptVideoType') {
                    // remote user has sent an acceptance of the requested videoType

                    // ensure that the videoType that the remote user has accepted matches the value that has been
                    // selected by the local user.
                    $log.debug('Remote user has accepted ' + remoteSignalingStatus.videoType);
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {

                        self.startVideoType(scope, localHasSelectedVideoType);

                        // we have finished with the current request, and are no longer requesting a new videoType.
                        scope.videoSignalingObject.localIsNegotiatingForVideoType = null;

                    } else {
                        setVideoSignalingStatusForUserFeedback(scope.videoSignalingObject, 'conflictingVideoTypes');
                        $log.warn('videoType mismatch.');
                    }
                }

                // Set the remoteSignalingStatus properties to null, so that this watch will be triggered
                // when the remote user sends us a new request, even if this is the same request that they previously
                // sent to us.
                // Note: if we do not reset these values , then future requests that are the same as the most recent request
                // will not trigger execution of this watch function, which means that the local user would not see any new
                // requests that are the same as a previous request that they have already responded to.
                scope.videoSignalingObject.remoteVideoSignalingStatus.requestAcceptOrDenyVideoType = null;

            });
        }
    };
    return self;
});