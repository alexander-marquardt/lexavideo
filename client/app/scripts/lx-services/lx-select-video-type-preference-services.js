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
        lxWebRtcSessionService)
    {



    var setVideoModeToAscii = function(scope) {
        // if the local or remote user sets video to ascii, then we immediately switch to this video type, and stop
        // the HD video stream.
        scope.videoSignalingObject.localIsSendingVideoType = 'ASCII Video';

        // kill the webRtc session. Ascii video should start to be transmitted in both
        // directions.
        lxWebRtcSessionService.stop();
    };


    var watchRemoteVideoSignalingStatus = function(scope) {
        return function() {
            var returnVal = scope.videoSignalingObject.remoteVideoSignalingStatus.settingsType + ' ' +
                scope.videoSignalingObject.remoteVideoSignalingStatus.videoType;
            //$log.debug('returnVal is "' + returnVal +'"');
            return returnVal;
        };
    };

    return {

        negotiateVideoType :  {
            /* Requests and sets up the type of video that will be transmitted between the two users */

            sendRequestForVideoType : function (videoType) {
                lxMessageService.sendMessage('videoSettings', {settingsType: 'requestVideoType', videoType: videoType});
            },

            sendAcceptanceOfVideoType : function(videoType) {
                // send a message to the remote user to indicate that the local user has accepted their offer to
                // change the current video settings (ie. from asciiVideo to hdVideo).
                lxMessageService.sendMessage('videoSettings', {settingsType: 'acceptVideoType', videoType: videoType});
            },

            sendDenyOfVideoType : function(videoType) {
                // send a message to the remote user to indicate that local user has denied their offer to change the
                // current video settings.
                lxMessageService.sendMessage('videoSettings', {settingsType: 'denyVideoType', videoType: videoType});
            }
        },


        /*
         This function will monitor the type of video that the local user and that the remote user have
         selected for sending between them. This requires some message exchanges before the video type will
         be finalized.
         We are more strict about sending hd video than ascii video. If ascii video is selected by one of the
         parties in a video call, then both sides will automatically switch over to ascii video. If they wish
         to switch to HD video, then a request will be sent from one user to the other, and the other user
         will have to agree to send HD video before transmission will begin.
         The messages that will be shown to the users can be seen in lx-video-negotiation-directives.
         */
        watchForVideoSettingsChanges : function(scope) {


            var self  = this;


            // Monitor localHasSelectedVideoType for changes, and if it changes then initiate an exchange with the remote
            // peer to star to exchange the newly selected video type.
            // Note: since we may set the localHasSelectedVideoType value upon accepting a remote request to change the
            // video type, this watch may also be executed for clients that did not explicitly press the button to change
            // the current video type. This may require some attention in the case that a client that has received a request
            // and sent an acceptance of a particular video type, may also then send a duplicate request for that same
            // video type. This duplicate request is harmless and should be ignored by the recipient.
            scope.$watch('videoSignalingObject.localHasSelectedVideoType', function(newVideoType) {


                if (scope.videoSignalingObject.remoteUserId) {
                    if (newVideoType === 'HD Video') {
                        scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAcceptVideoType: ' + newVideoType;
                        self.negotiateVideoType.sendRequestForVideoType(scope.videoSignalingObject.localHasSelectedVideoType);
                    }
                    else if (newVideoType === 'ASCII Video') {

                        if (scope.videoSignalingObject.remoteIsSendingVideoType !== 'ASCII Video') {
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAcceptVideoType: ' + newVideoType;
                            self.negotiateVideoType.sendRequestForVideoType(newVideoType);
                        } else {
                            // since the remote user is already sending asciiVideo, we just accept it.
                            self.negotiateVideoType.sendAcceptanceOfVideoType('ASCII Video');

                            // If the remote user has not denied our request, we can safely remove use feedback. Otherwise
                            // we don't want to remove user feedback that may indicate that the remote user has
                            // denied our request.
                            if (scope.videoSignalingObject.remoteVideoSignalingStatus.settingsType !== 'denyVideoType') {
                                // remove the user feedback indicating that we are waiting for the remote user
                                // to accept HD video
                                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
                            }
                        }
                        setVideoModeToAscii(scope);
                    }
                    else if (newVideoType === null) {
                        // do nothing
                    }
                    else {
                        $log.error('Unknown videoType: ' + newVideoType);
                    }
                }
                else {
                    scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'waitingForRemoteUserToJoin';
                }

                // Set the remoteSignalingStatus properties to null, so that the watchers below are triggered
                // when the remote user responds to our request, even if this is the same response that they
                // previously sent to us.
                // Note: if we do not reset these values , then future requests that are the same as the most recent request
                // will not trigger execution in the watch function.
                scope.videoSignalingObject.remoteVideoSignalingStatus.settingsType = null;
            });

            // This watcher will monitor for remote requests to change the current video format, and will either
            // respond directly, or modify a variable that will trigger another watcher that will request user
            // feedback on how to respond. More details in the comments below.
            scope.$watch(watchRemoteVideoSignalingStatus(scope), function() {


                var remoteSignalingStatus = scope.videoSignalingObject.remoteVideoSignalingStatus;
                var localHasSelectedVideoType = scope.videoSignalingObject.localHasSelectedVideoType;

                if (remoteSignalingStatus.settingsType === 'requestVideoType') {
                    // the remote user has requested a new videoType.

                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {
                        // the remote user has requested the videoType that the local user has already selected.

                        self.negotiateVideoType.sendAcceptanceOfVideoType(remoteSignalingStatus.videoType);
                        $log.debug('Automatically settings video type to ' + remoteSignalingStatus.videoType + 'since it was already selected. ');

                        // Remote and local users have both selected HD Video - so start it up!
                        // Note: this is not necessary for ASCII video since ASCII video is automatically started as
                        // soon as one of the users selects it.
                        if (remoteSignalingStatus.videoType === 'HD Video') {
                            lxCallService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                        }
                    }
                    else {

                        // remote user has requested that the local user send a video type that is different from
                        // what the local user is currently sending.
                        $log.debug('Remote user has requested ' + remoteSignalingStatus.videoType);


                        // if the remote user has requested HD Video, then we will prompt the local user to see if
                        // they agree to transmit HD video. This prompting is triggered by the change in
                        // videoSignalingStatusForUserFeedback and is handled in the directive code.
                        if (remoteSignalingStatus.videoType === 'HD Video') {

                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasRequestedVideoType: ' + 'HD Video';
                        }

                        // by default, we do not ask for permission to switch to ascii video mode. If a remote user requests
                        // a switch to asciiVideo, then we will tear down the peer connection, and will transmit ascii video in
                        // both directions.
                        else if (remoteSignalingStatus.videoType === 'ASCII Video') {

                            self.negotiateVideoType.sendAcceptanceOfVideoType('ASCII Video');
                            scope.videoSignalingObject.localHasSelectedVideoType = 'ASCII Video';
                            scope.videoSignalingObject.remoteIsSendingVideoType = 'ASCII Video';
                            setVideoModeToAscii(scope);

                            // clear the user feedback messages since we are now sending and receiving ascii video.
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
                        }
                        else {
                            $log.log('Error: unknown remoteSignalingStatus.videoType: ' + remoteSignalingStatus.videoType);
                        }

                    }
                }

                else if (remoteSignalingStatus.settingsType === 'denyVideoType') {

                    $log.debug('Remote user has denied ' + remoteSignalingStatus.videoType);
                    scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasDeniedRequestToExchangeFormat: ' + remoteSignalingStatus.videoType;

                    // since the request to transmit a new format was denied, change the localHasSelectedVideoType back
                    // to the type that is currently/previously being sent.
                    scope.videoSignalingObject.localHasSelectedVideoType = scope.videoSignalingObject.localIsSendingVideoType;


                }

                else if (remoteSignalingStatus.settingsType === 'acceptVideoType') {
                    // remote user has sent an acceptance of the requested videoType

                    // ensure that the videoType that the remote user has accepted matches the value that has been
                    // selected by the local user.
                    $log.debug('Remote user has accepted ' + remoteSignalingStatus.videoType);
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {

                        if (remoteSignalingStatus.videoType === 'HD Video') {
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteUserHasAcceptedYourRequestToTransmit: ' + 'HD Video';
                            // Setup the hdVideo to be transmitted via peer-to-peer transmission.
                            lxCallService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                        }

                        else if (remoteSignalingStatus.videoType === 'ASCII Video') {
                            // remote agreed to send asciiVideo, and by design remote browser will have started to send
                            // it immediately at the same time that it has sent the 'acceptVideoType' response. Therefore, we can
                            // set the value on remoteIsSendingVideoType to 'ASCII Video' now.
                            scope.videoSignalingObject.remoteIsSendingVideoType = 'ASCII Video';
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
                        }

                    } else {
                        scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'conflictingVideoTypes';
                        $log.warn('videoType mismatch.');
                    }
                }
            });
        }
    };
});