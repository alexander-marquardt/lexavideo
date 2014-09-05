/**
 * Created by alexandermarquardt on 2014-09-04.
 */



'use strict';

var lxVideoTypeNegotiationServices = angular.module('lxVideoSettingsNegotiation.services', []);


lxVideoTypeNegotiationServices.factory('lxVideoSettingsNegotiationService', function($animate, $log,
                                                                             negotiateVideoType, callService,
                                                                             webRtcSessionService) {




    var setVideoModeToAscii = function(scope) {
        // if the local or remote user sets video to ascii, then we immediately switch to this video type, and stop
        // the HD video stream.
        scope.videoSignalingObject.localIsSendingVideoType = 'ASCII Video';

        // kill the webRtc session. Ascii video should start to be transmitted in both
        // directions.
        webRtcSessionService.stop(webRtcSessionService);
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
        watchForVideoSettingsChanges : function(scope) {
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

            scope.$watch('videoSignalingObject.localHasSelectedVideoType', function(newVideoType) {
                var remoteSignalingStatus = scope.videoSignalingObject.remoteVideoSignalingStatus;

                // When we accept a remote request to change the video type, we also update the localHasSelectedVideoType
                // value. In this case however, we don't want to modify user feedback messages and to send more signaling
                // to initiate a connection, since all of this was already done by the browser that initiated
                // the change in video settings.
                // However, in the case that the user has pressed the button to change the video type, then we want to
                // execute all signaling and write appropriate user messages. The following 'if' statement takes care
                // of these two different conditions.
                if (scope.videoSignalingObject.localHasSelectedVideoType !== scope.videoSignalingObject.localHasAgreedToRemoteRequestForVideoType) {

                    if (newVideoType === 'HD Video') {
                        scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAcceptVideoType: ' + newVideoType;
                        negotiateVideoType.sendRequestForVideoType(scope.videoSignalingObject.localHasSelectedVideoType);
                    }
                    else if (newVideoType === 'ASCII Video') {

                        if (scope.videoSignalingObject.remoteIsSendingVideoType !== 'ASCII Video') {
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAcceptVideoType: ' + newVideoType;
                            negotiateVideoType.sendRequestForVideoType(newVideoType);
                        } else {
                            // since the remote user is already sending asciiVideo, we just accept it.
                            negotiateVideoType.sendAcceptanceOfVideoType('ASCII Video');
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
            });

            scope.$watch(watchRemoteVideoSignalingStatus(scope), function() {

                // This watcher will monitor for remote requests to change the current video format, and will either
                // respond directly, or modify a variable that will trigger another watcher that will request user
                // feedback on how to respond. More details in the comments below.

                var remoteSignalingStatus = scope.videoSignalingObject.remoteVideoSignalingStatus;
                var localHasSelectedVideoType = scope.videoSignalingObject.localHasSelectedVideoType;
                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;

                if (remoteSignalingStatus.settingsType === 'requestVideoType') {
                    // the remote user has requested a new videoType.

                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {
                        // the remote user has requested the videoType that the local user has already selected.
                        // No user prompting is required to set the videoType.

                        negotiateVideoType.sendAcceptanceOfVideoType(remoteSignalingStatus.videoType);
                        scope.videoSignalingObject.localHasAgreedToRemoteRequestForVideoType == remoteSignalingStatus.videoType;
                        scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
                        $log.debug('Automatically settings video type to ' + remoteSignalingStatus.videoType + 'since it was already selected. ')
                    }
                    else {

                        // remote user has requested that the local user send a video type that is different from
                        // what the local user is currently sending.
                        $log.debug('Remote user has requested ' + remoteSignalingStatus.videoType);
                        if (remoteSignalingStatus.videoType === 'HD Video') {
                            // if the remote user has requested HD Video, then we will prompt the local user to see if
                            // they agree to transmit HD video. This prompting is triggered by the change in
                            // videoSignalingStatusForUserFeedback and is handled in the directive code.
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasRequestedVideoType: ' + remoteSignalingStatus.videoType;
                        }
                        else if (remoteSignalingStatus.videoType === 'ASCII Video') {
                            // by default, we do not ask for permission to switch to ascii video mode. If a remote user requests
                            // a switch to asciiVideo, then we will tear down the peer connection, and will transmit ascii video in
                            // both directions.
                            negotiateVideoType.sendAcceptanceOfVideoType('ASCII Video');
                            scope.videoSignalingObject.localHasAgreedToRemoteRequestForVideoType = 'ASCII Video';
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
                    scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasDeniedRequestToExchangeFormat';

                    // since the request to transmit a new format was denied, change the localHasSelectedVideoType back
                    // to the type that is currently/previously being sent.
                    scope.videoSignalingObject.localHasSelectedVideoType = scope.videoSignalingObject.localIsSendingVideoType;

                    scope.videoSignalingObject.localHasAgreedToRemoteRequestForVideoType = null;

                    // Set the remoteSignalingStatus properties to null, in case the remote user denies the same request again.
                    // Note: if we do not reset these values , then future requests that are the same as the most recent request
                    // will not trigger execution in the watch function.
                    remoteSignalingStatus.settingsType = null;
                    remoteSignalingStatus.videoType = null;
                }

                else if (remoteSignalingStatus.settingsType === 'acceptVideoType') {
                    // remote user has sent an acceptance of the requested videoType

                    // ensure that the videoType that the remote user has accepted matches the value that has been
                    // selected by the local user.
                    $log.debug('Remote user has accepted ' + remoteSignalingStatus.videoType);
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {

                        if (remoteSignalingStatus.videoType === 'HD Video') {
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteUserHasAcceptedYourRequestToTransmit';
                            // Setup the hdVideo to be transmitted via peer-to-peer transmission.
                            callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                        }

                        else if (remoteSignalingStatus.videoType === 'ASCII Video') {
                            // remote agreed to send asciiVideo, and by design will have started to send it immediately at
                            // the same time that it has sent the 'acceptVideoType' response. Therefore, we can
                            // set the value on remoteIsSendingVideoType to 'ASCII Video' now.
                            scope.videoSignalingObject.remoteIsSendingVideoType = 'ASCII Video';
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
                        }

                    } else {
                        scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'conflictingVideoTypes';
                        $log.error('videoType mismatch.');
                    }
                }
            });
        }
    };
});