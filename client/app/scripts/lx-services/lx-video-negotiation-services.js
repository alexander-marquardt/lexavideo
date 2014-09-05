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
        scope.videoSignalingObject.localIsSendingVideoType = 'asciiVideo';

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
            scope.videoSignalingStatusForUserFeedback = null;
            scope.$watch('videoSignalingObject.localHasSelectedVideoType', function(newVideoType) {
                if (newVideoType === 'hdVideo') {
                    scope.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAcceptVideoType';
                    callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                    negotiateVideoType.sendRequestForVideoType(scope.videoSignalingObject.localHasSelectedVideoType);
                }
                else if (newVideoType === 'asciiVideo') {

                    if (scope.videoSignalingObject.remoteIsSendingVideoType !== 'asciiVideo') {
                        scope.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAcceptVideoType';
                        negotiateVideoType.sendRequestForVideoType(newVideoType);
                    } else {
                        // since the remote user is already sending asciiVideo, we just accept it.
                        negotiateVideoType.sendAcceptanceOfVideoType('asciiVideo');
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
                scope.videoSignalingStatusForUserFeedback = null;

                if (remoteSignalingStatus.settingsType === 'requestVideoType') {
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {
                        // the remote user has requested the videoType that the local user has already selected.
                        // No user prompting is required to set the videoType.
                        negotiateVideoType.sendAcceptanceOfVideoType(localHasSelectedVideoType);
                        scope.videoSignalingStatusForUserFeedback = null;
                    }
                    else {
                        if (remoteSignalingStatus.videoType === 'hdVideo') {
                            scope.videoSignalingStatusForUserFeedback = 'showRequestForHdVideo';
                        }
                        else if (remoteSignalingStatus.videoType === 'asciiVideo') {
                            // by default, we do not ask for permission to switch to ascii video mode. If a remote user requests
                            // a switch to asciiVideo, then we will tear down the peer connection, and will transmit ascii video in
                            // both directions.
                            scope.videoSignalingObject.localHasSelectedVideoType = 'asciiVideo';
                            // By design remote immediately begins sending asciiVideo once they have requested it.
                            scope.videoSignalingObject.remoteIsSendingVideoType = 'asciiVideo';
                            scope.videoSignalingStatusForUserFeedback = null;
                        }
                        else {
                            $log.log('Error: unknown remoteSignalingStatus.videoType: ' + remoteSignalingStatus.videoType);
                        }
                    }
                }

                else if (remoteSignalingStatus.settingsType === 'denyVideoType') {
                    scope.videoSignalingStatusForUserFeedback = 'remoteHasDeniedRequestToExchangeFormat';
                    scope.videoSignalingObject.remoteResponseToLocalRequest = 'waitingForResponse'; // reset to default state
                }

                else if (remoteSignalingStatus.settingsType === 'acceptVideoType') {
                    // remote user has sent an acceptance of the requested videoType

                    // ensure that the videoType that the remote user has accepted matches the value that has been
                    // selected by the local user.
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {

                        if (localHasSelectedVideoType === 'hdVideo') {
                            scope.videoSignalingStatusForUserFeedback = 'remoteUserHasAcceptedYourRequestToTransmit';
                            // Setup the hdVideo to be transmitted via peer-to-peer transmission.
                            callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                        }

                        else if (localHasSelectedVideoType === 'asciiVideo') {
                            // remote agreed to send asciiVideo, and by design will have started to send it immediately at
                            // the same time that it has send the 'acceptVideoType' response. Therefore, we can
                            // set the value on remoteIsSendingVideoType to 'asciiVideo' now.

                            scope.videoSignalingObject.remoteIsSendingVideoType = 'asciiVideo';
                            scope.videoSignalingStatusForUserFeedback = null;
                        }

                    } else {
                        scope.videoSignalingStatusForUserFeedback = 'conflictingVideoTypes';
                        $log.error('videoType mismatch.');
                    }
                }
            });
        }
    };
});