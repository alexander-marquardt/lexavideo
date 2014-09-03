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
                scope.videoSignalingObject.localHasSelectedVideoType = newVideoType;
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
        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="navbar-text"/>');
        el.html(message);
        elem.append(el);
    };

    return {
        restrict: 'A',
        link : function(scope, elem) {
            scope.$watch('videoSignalingObject.remoteHasRequestedVideoType', function(newVideoType) {
                if (newVideoType === 'hdVideo') {
                    showRequestForHdVideo(scope, elem);
                }
                else if (newVideoType === 'asciiVideo') {
                    // by default, we do not ask for permission to switch to ascii video mode. If one of the users requests
                    // a switch to asciiVideo, then we will tear down the peer connection, and will transmit ascii video in
                    // both directions.
                }
                else {
                    $log.log('Error: unknown videoSignalingObject.remoteHasRequestedVideoType: ' + newVideoType);
                }
            });

            scope.$watch('videoSignalingObject.localHasSelectedVideoType', function(newVideoType) {
                if (newVideoType === 'hdVideo') {
                    var message = 'We are waiting for remote user to accept your request to exchange HD Video ';
                    showMessageInVideoWindow(scope, elem, message);
                }
                if (newVideoType === 'asciiVideo') {
                    // if the user sets video to ascii, then we immediately switch to this video type, and stop
                    // the HD video stream.
                    scope.videoSignalingObject.localIsSendingVideoType = 'asciiVideo';
                    // kill the webRtc session. Ascii video should start to be transmitted in both
                    // directions.
                    webRtcSessionService.stop();
                }
            });

            scope.$watch('videoSignalingObject.remoteResponseToLocalRequest', function(remoteResponse) {
                var message;
                if (remoteResponse === 'denyVideoType') {
                    message = 'Remote user has denied your request';
                    showMessageInVideoWindow(scope, elem, message);
                    scope.videoSignalingObject.remoteResponseToLocalRequest = 'waitingForResponse'; // reset to default state
                }
                else if (remoteResponse === 'acceptVideoType') {
                    message = 'Remote user has accepted your request. Please wait a moment for the new video format to begin transmission.';
                    showMessageInVideoWindow(scope, elem, message);
                    scope.videoSignalingObject.remoteResponseToLocalRequest = 'waitingForResponse'; // reset to default state
                }
            });
        }
    };
});