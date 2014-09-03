/**
 * Created by alexandermarquardt on 2014-09-03.
 */

'use strict';

var lxVideoTypeNegotiationDirectives = angular.module('lxVideoTypeNegotiation.directives', []);


lxVideoTypeNegotiationDirectives.directive('lxVideoSettingsNegotiationDirective', function($animate, $log,
                                                                             negotiateVideoType, callService,
                                                                             webRtcSessionService) {


    var showRequestForHdVideo = function(scope, elem) {
        // if the other user has requested an hdVideo session, the local user must accept before we will
        // send and receive HD video.

        var newVideoType = 'hdVideo';

        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="navbar-text"/>');
        el.html('Stranger has requested to exchange HD video. Do you accept: ');
        var buttonGroup = angular.element('<div class="btn-group"></div>');
        var yesButton = angular.element('<button type="button" class="btn btn-default btn-sm navbar-btn">Yes</button>');
        var noButton = angular.element('<button type="button" class="btn btn-default btn-sm navbar-btn">No</button>');
        buttonGroup.append(yesButton, noButton );
        elem.append(el, buttonGroup);

        yesButton.on('click', function() {


            negotiateVideoType.sendAcceptanceOfVideoType(newVideoType);
            $animate.addClass(elem, 'ng-hide');

            if (newVideoType === 'hdVideo') {
                // Other user has requested hdVideo, and this user has agreed to send it.
                scope.videoSignalingObject.localHasSelectedVideoType = 'hdVideo';
                callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
            }
            scope.$apply();
        });

        noButton.on('click', function() {
            negotiateVideoType.sendDenyOfVideoType(newVideoType);
            $animate.addClass(elem, 'ng-hide');
            scope.$apply();
        });
    };

    var  showMessageInVideoWindow = function(scope, elem, message) {
        elem.find('.navbar-text').remove(); // just in case there is already text there, remove the previous element
        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="navbar-text"/>');
        el.html(message);
        elem.append(el);
    };

    var removeMessageInVideoWindow = function(scope, elem) {
        $animate.addClass(elem, 'ng-hide');
        elem.find('.navbar-text').remove();
    };


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
            $log.info('returnVal is "' + returnVal +'"');
            return returnVal;
        };
    };
    
    return {
        restrict: 'A',
        link : function(scope, elem) {
            var message;
            scope.$watch('videoSignalingObject.localHasSelectedVideoType', function(newVideoType) {
                if (newVideoType === 'hdVideo') {
                    message = 'We are waiting for remote user to accept your request to exchange HD Video ';
                    showMessageInVideoWindow(scope, elem, message);
                    callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                }
                else if (newVideoType === 'asciiVideo') {
                    message = 'We are waiting for remote user to accept your request to exchange Ascii Video ';
                    showMessageInVideoWindow(scope, elem, message);
                    negotiateVideoType.sendRequestForVideoType(newVideoType);
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
                var message;
                
                if (remoteSignalingStatus.settingsType === 'requestVideoType') {
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {
                        // the remote user has requested the videoType that the local user has already selected.
                        // No user prompting is required to set the videoType.
                        negotiateVideoType.sendAcceptanceOfVideoType(localHasSelectedVideoType);
                    }
                    else {
                        if (remoteSignalingStatus.videoType === 'hdVideo') {
                            showRequestForHdVideo(scope, elem);
                        }
                        else if (remoteSignalingStatus.videoType === 'asciiVideo') {
                            // by default, we do not ask for permission to switch to ascii video mode. If a remote user requests
                            // a switch to asciiVideo, then we will tear down the peer connection, and will transmit ascii video in
                            // both directions.
                            negotiateVideoType.sendAcceptanceOfVideoType(remoteSignalingStatus.videoType);
                            setVideoModeToAscii(scope);
                        }
                        else {
                            $log.log('Error: unknown remoteSignalingStatus.videoType: ' + remoteSignalingStatus.videoType);
                        }
                    }
                }
                    
                else if (remoteSignalingStatus.settingsType === 'denyVideoType') {
                    message = 'Remote user has denied your request to exchange ' + remoteSignalingStatus.videoType;
                    showMessageInVideoWindow(scope, elem, message);
                    scope.videoSignalingObject.remoteResponseToLocalRequest = 'waitingForResponse'; // reset to default state
                }
                
                else if (remoteSignalingStatus.settingsType === 'acceptVideoType') {
                    // remote user has sent an acceptance of the requested videoType

                    // ensure that the videoType that the remote user has accepted matches the value that has been
                    // selected by the local user.
                    if (remoteSignalingStatus.videoType === localHasSelectedVideoType) {


                        if (localHasSelectedVideoType === 'hdVideo') {
                            message = 'Remote user has accepted your request to transmit ' + remoteSignalingStatus.videoType +
                                ' . Please wait a moment for the new video format to begin transmission.';
                            // Setup the hdVideo to be transmitted via peer-to-peer transmission.
                            callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                            showMessageInVideoWindow(scope, elem, message);
                        }

                        else if (localHasSelectedVideoType === 'asciiVideo') {
                            // remote agreed to send asciiVideo, and by design will have started to send it immediately at
                            // the same time that it has send the 'acceptVideoType' response. Therefore, we can
                            // set the value on remoteIsSendingVideoType to 'asciiVideo' now.
                            setVideoModeToAscii(scope);
                            scope.videoSignalingObject.remoteIsSendingVideoType = 'asciiVideo';

                        }

                    } else {
                        message = 'It appears that you have requested to use ' + localHasSelectedVideoType +
                            ' but the remote user has accepted ' + remoteSignalingStatus.videoType +
                            '. We were unable to change the video format. Please try again.';
                        $log.error('videoType mismatch.');
                        showMessageInVideoWindow(scope, elem, message);

                    }
                }
            });

            scope.$watch('remoteIsSendingVideoType', function(newVideoType) {
                if (newVideoType === scope.localHasSelectedVideoType === scope.localIsSendingVideoType) {
                    // if the sending and receiving videoType are the same and are what was requested,
                    // then no more feedback is required.
                    removeMessageInVideoWindow(scope, elem);
                }
            });
        }
    };
});