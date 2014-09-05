/**
 * Created by alexandermarquardt on 2014-09-03.
 */

'use strict';

var lxVideoTypeNegotiationDirectives = angular.module('lxVideoTypeNegotiation.directives', []);


lxVideoTypeNegotiationDirectives.directive('lxVideoSettingsNegotiationDirective', function($animate, $log, callService,
                                                                                           negotiateVideoType) {


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
            var message;

            scope.$apply(function() {
                negotiateVideoType.sendAcceptanceOfVideoType(newVideoType);
                $animate.addClass(elem, 'ng-hide'); // this class is added so that when we show the element, it will fade in.

                if (newVideoType === 'hdVideo') {
                    // Other user has requested hdVideo, and this user has agreed to send it.
                    message = 'We are now setting up the communications for transmitting HD video';
                    showMessageInVideoWindow(scope, elem, message);
                    scope.videoSignalingObject.localHasSelectedVideoType = 'hdVideo';
                    callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
                }
            });
        });

        noButton.on('click', function() {
            scope.$apply(function() {
                negotiateVideoType.sendDenyOfVideoType(newVideoType);
                $animate.addClass(elem, 'ng-hide');
            });
        });
    };

    var getVideoSignalingStatusForUserFeedback = function(scope) {
        return function(){
            $log.debug('videoSignalingStatusForUserFeedback is: ' + scope.videoSignalingStatusForUserFeedback);
            return scope.videoSignalingStatusForUserFeedback;
        };
    };


    return {
        restrict: 'A',
        link : function(scope, elem) {
            var message;

            scope.$watch(getVideoSignalingStatusForUserFeedback(scope), function(newValue) {

                var remoteSignalingStatus = scope.videoSignalingObject.remoteVideoSignalingStatus;
                var localHasSelectedVideoType = scope.videoSignalingObject.localHasSelectedVideoType;

                switch(newValue) {
                    case 'remoteHasRequestedVideoType: ' + 'hdVideo':
                        showRequestForHdVideo(scope, elem);
                        break;

                    case 'waitingForRemoteToAcceptVideoType: ' + localHasSelectedVideoType:
                        message = 'We are waiting for remote user to accept your request to exchange ' + localHasSelectedVideoType;
                        showMessageInVideoWindow(scope, elem, message);
                        break;

                    case 'remoteHasDeniedRequestToExchangeFormat':
                        message = 'Remote user has denied your request to exchange ' + remoteSignalingStatus.videoType;
                        showMessageInVideoWindow(scope, elem, message);
                        break;

                    case 'remoteUserHasAcceptedYourRequestToTransmit':
                        message = 'Remote user has accepted your request to transmit ' + remoteSignalingStatus.videoType +
                                ' . Please wait a moment for the new video format to begin transmission.';
                        showMessageInVideoWindow(scope, elem, message);
                        break;

                    case 'conflictingVideoTypes':
                        message = 'It appears that you have requested to use ' + localHasSelectedVideoType +
                                                    ' but the remote user has accepted ' + remoteSignalingStatus.videoType +
                                                    '. We were unable to change the video format. Please try again.';
                        showMessageInVideoWindow(scope, elem, message);
                        break;

                    case null:
                        removeMessageInVideoWindow(scope, elem);
                        break;

                    default:
                        $log.error('Unknown videoWindowSignalingMessage value: ' + newValue);
                }
            });
        }
    };
});