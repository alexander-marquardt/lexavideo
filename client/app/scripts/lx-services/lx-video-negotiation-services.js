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
            });

            scope.$watch(watchRemoteVideoSignalingStatus(scope), function() {

                var remoteSignalingStatus = scope.videoSignalingObject.remoteVideoSignalingStatus;
                var localHasSelectedVideoType = scope.videoSignalingObject.localHasSelectedVideoType;
                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;

                if (remoteSignalingStatus.settingsType === 'requestVideoType') {

                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {

                        // the remote user has requested the videoType that the local user has already selected.
                        // No user prompting is required to set the videoType.

                        negotiateVideoType.sendAcceptanceOfVideoType(localHasSelectedVideoType);
                        scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
                    }
                    else {

                        // remote user has requested that the local user send a video type that is different from
                        // what they are currently sending.

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
                            scope.videoSignalingObject.localHasSelectedVideoType = 'ASCII Video';
                            // By design remote immediately begins sending asciiVideo once they have requested it.
                            scope.videoSignalingObject.remoteIsSendingVideoType = 'ASCII Video';
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
                        }
                        else {
                            $log.log('Error: unknown remoteSignalingStatus.videoType: ' + remoteSignalingStatus.videoType);
                        }
                    }
                }

                else if (remoteSignalingStatus.settingsType === 'denyVideoType') {
                    scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasDeniedRequestToExchangeFormat';

                    // since the request to transmit a new format was denied, change the localHasSelectedVideoType back
                    // to the type that is currently being sent.
                    scope.videoSignalingObject.localHasSelectedVideoType = scope.videoSignalingObject.localIsSendingVideoType
                }

                else if (remoteSignalingStatus.settingsType === 'acceptVideoType') {
                    // remote user has sent an acceptance of the requested videoType

                    // ensure that the videoType that the remote user has accepted matches the value that has been
                    // selected by the local user.
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {

                        if (localHasSelectedVideoType === 'HD Video') {
                            scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteUserHasAcceptedYourRequestToTransmit';
                            // Setup the hdVideo to be transmitted via peer-to-peer transmission.
                            callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                        }

                        else if (localHasSelectedVideoType === 'ASCII Video') {
                            // remote agreed to send asciiVideo, and by design will have started to send it immediately at
                            // the same time that it has send the 'acceptVideoType' response. Therefore, we can
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