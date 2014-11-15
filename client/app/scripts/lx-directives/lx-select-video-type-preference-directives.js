/**
 * Created by alexandermarquardt on 2014-09-03.
 */

'use strict';

var lxSelectVideoTypePreferenceDirectives = angular.module('lxVideoNegotiation.directives', []);


lxSelectVideoTypePreferenceDirectives.directive('lxVideoSettingsNegotiationDirective',
    function(
        $animate,
        $compile,
        $log,
        $timeout,
        lxCallService,
        lxVideoSettingsNegotiationService) {


    var messageFadeTimerId = null;


    var cancelFadeTimer = function() {
        // Cancel any existing timers to prevent messages from fading away when they should not
        if (messageFadeTimerId) {
            $timeout.cancel(messageFadeTimerId);
            messageFadeTimerId = null;
        }
    };

    var  showMessageInVideoWindow = function(scope, elem, message, fadeAwayTime) {
        elem.find('.navbar-text').remove(); // just in case there is already text there, remove the previous element
        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="navbar-text"/>');
        el.html(message);
        var compiledEl = $compile(el)(scope);
        elem.append(compiledEl);

        cancelFadeTimer();

        if (fadeAwayTime !== undefined) {
            // Make the message disappear after a certain amount of time in ms. Otherwise it will
            // stay until it is removed.
            messageFadeTimerId = $timeout(function() {
                $animate.addClass(elem, 'ng-hide');
            }, fadeAwayTime);
        }
    };

    var removeMessageInVideoWindow = function(scope, elem) {
        $animate.addClass(elem, 'ng-hide');
        elem.find('.navbar-text').remove();
    };


    var showRequestForChangeVideoType = function(scope, elem, videoType) {
        // if the other user has requested an hdVideo session, the local user must accept before we will
        // send and receive HD video.


        // make sure that there are no timers set that would fade-away the request/information displayed that is
        // prompting the user to accept/deny a change to the video format.
        cancelFadeTimer();

        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="navbar-text"/>');
        el.html('Stranger has requested to exchange ' + videoType + '. Do you accept? ');
        var buttonGroup = angular.element('<div class="btn-group"></div>');
        var yesButton = angular.element('<button type="button" class="btn btn-default btn-sm navbar-btn">Yes</button>');
        var noButton = angular.element('<button type="button" class="btn btn-default btn-sm navbar-btn">No</button>');
        buttonGroup.append(yesButton, noButton );
        elem.append(el, buttonGroup);

        yesButton.on('click', function() {
            $log.debug('Change video type accepted');

            var message;

            scope.$apply(function() {
                lxVideoSettingsNegotiationService.negotiateVideoType.sendAcceptanceOfVideoType(videoType);
                $animate.addClass(elem, 'ng-hide'); // this class is added so that when we show the element, it will fade in.

                // Other user has requested videoType video, and this user has agreed to send it.
                message = 'We are now setting up the communications for transmitting ' + videoType;
                showMessageInVideoWindow(scope, elem, message);

                // by changing localHasSelectedVideoType, we will change the video selection button to the new
                // videoType
                scope.videoSignalingObject.localHasSelectedVideoType = videoType;

                // The local user has not actually requested any videoType - he is only responding to the remote request.
                // We do not want to execute watchers or change user feedback messages based on the new videoType.
                scope.videoSignalingObject.localIsNegotiatingForVideoType = null;

                lxVideoSettingsNegotiationService.startVideoType(scope, videoType);

            });
        });

        noButton.on('click', function() {
            $log.debug('Change video type denied');

            scope.$apply(function() {
                lxVideoSettingsNegotiationService.negotiateVideoType.sendDenyOfVideoType(videoType);
                $animate.addClass(elem, 'ng-hide');

                // Set the remoteSignalingStatus properties to null, in case the remote user tries to make the same request again.
                // Note: if we do not reset these values , then future requests that are the same as the most recent request
                // will not trigger execution in the watch function.
                scope.videoSignalingObject.remoteVideoSignalingStatus.settingsType = null;
                scope.videoSignalingObject.remoteVideoSignalingStatus.videoType = null;

                // Also set the videoSignalingStatusForUserFeedback so that the user will be shown the prompt if
                // the same (denied) request is made again.
                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = null;
            });
        });
    };

    var getVideoSignalingStatusForUserFeedback = function(scope) {
        return function(){
            //$log.debug('videoSignalingStatusForUserFeedback is: ' + scope.videoSignalingObject.videoSignalingStatusForUserFeedback);
            return scope.videoSignalingObject.videoSignalingStatusForUserFeedback;
        };
    };


    return {
        restrict: 'A',
        template: '<nav class="navbar navbar-inverse navbar-fixed-top cl-navbar-video-overlay cl-show-hide-fade ng-hide" ></nav>',
        link : function(scope, elem) {
            var message;
            var navelem = angular.element(elem).find('nav.navbar');

            scope.$watch(getVideoSignalingStatusForUserFeedback(scope), function(newValue) {

                var remoteSignalingStatus = scope.videoSignalingObject.remoteVideoSignalingStatus;
                var localIsNegotiatingForVideoType = scope.videoSignalingObject.localIsNegotiatingForVideoType;

                switch(newValue) {

                    case 'localUserIsAlone':
                        message = 'There is no one else in this chat room right now';
                        showMessageInVideoWindow(scope, navelem, message);
                        break;

                    case 'remoteHasRequestedVideoType: ' + remoteSignalingStatus.videoType:
                        // message here is just for  $log.debug called after the end of this switch block
                        message = 'received remoteHasRequestedVideoType: ' + remoteSignalingStatus.videoType;
                        showRequestForChangeVideoType(scope, navelem, remoteSignalingStatus.videoType);
                        break;

                    case 'waitingForRemoteToAcceptVideoType: ' +  localIsNegotiatingForVideoType:
                        message = 'We are waiting for remote user to accept your request to exchange ' + localIsNegotiatingForVideoType;
                        showMessageInVideoWindow(scope, navelem, message, 8000);
                        break;

                    case 'remoteHasSetVideoToAscii':
                        message = 'Remote user has switched to ASCII Video mode';
                        showMessageInVideoWindow(scope, navelem, message, 6000);
                        break;

                    case 'remoteHasDeniedRequestToExchangeFormat: ' + remoteSignalingStatus.videoType:
                        message = 'Remote user has denied your request to exchange ' + remoteSignalingStatus.videoType;
                        showMessageInVideoWindow(scope, navelem, message, 4000);
                        break;

                    case 'remoteUserHasAcceptedYourRequestToTransmit: ' + remoteSignalingStatus.videoType:
                        message = 'Remote user has accepted your request to transmit ' + remoteSignalingStatus.videoType +
                                ' . Please wait a moment for the new video format to begin transmission.';
                        showMessageInVideoWindow(scope, navelem, message);
                        break;

                    case 'conflictingVideoTypes':
                        message = 'It appears that you have requested to use ' + localIsNegotiatingForVideoType +
                                                    ' but the remote user has accepted ' + remoteSignalingStatus.videoType +
                                                    '. We were unable to change the video format. Please try again.';
                        showMessageInVideoWindow(scope, navelem, message);
                        break;

                    case 'mustEnableVideoToStartTransmission':
                        message = 'You must give access to your camera before we can setup a video conversation. ' +
                        'Click <a href="#" ng-click="showCameraAndMicrophoneInstructions()">here</a> for more details';
                        showMessageInVideoWindow(scope, navelem, message);
                        break;

                    case 'remoteHasNotEnabledVideoYet':
                        message = 'We are waiting for remote user to give access to their camera and microphone';
                        showMessageInVideoWindow(scope, navelem, message);
                        break;

                    case null:
                        message = 'null videoSignalingStatusForUserFeedback received - removing message in video window';
                        removeMessageInVideoWindow(scope, navelem);
                        break;

                    default:
                        message = 'Unknown videoWindowSignalingMessage value: ' + newValue;
                        $log.error(message);
                }

                $log.debug(message);
            });
        }
    };
});