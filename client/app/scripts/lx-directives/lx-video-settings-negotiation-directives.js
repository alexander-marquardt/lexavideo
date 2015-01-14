/**
 * Created by alexandermarquardt on 2014-09-03.
 */

'use strict';

var lxSelectVideoTypePreferenceDirectives = angular.module('lxVideoNegotiation.directives', []);


lxSelectVideoTypePreferenceDirectives.directive('lxVideoSettingsNegotiationDirective',
    function(
        $animate,
        $compile,
        $log
    ) {


    var  showMessageInVideoWindow = function(scope, elem, message) {
        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="cl-video-overlay-text"/>');
        el.html(message);
        var compiledEl = $compile(el)(scope);
        elem.append(compiledEl);
    };

    var removeMessageInVideoWindow = function(scope, elem) {
        $animate.addClass(elem, 'ng-hide');
    };


    var getVideoSignalingStatusForUserFeedback = function(scope) {
        return function(){
            //$log.debug('videoSignalingStatusForUserFeedback is: ' + scope.videoSignalingObject.videoSignalingStatusForUserFeedback);
            return scope.videoSignalingObject.videoSignalingStatusForUserFeedback;
        };
    };


    return {
        restrict: 'A',
        template: '<div class="cl-video-overlay cl-show-hide-fade ng-hide" ></nav>',
        link : function(scope, elem) {
            var message;
            var overlayElem = angular.element(elem).find('div.cl-video-overlay');

            scope.$watch(getVideoSignalingStatusForUserFeedback(scope), function(newValue) {

                switch(newValue) {

                    case 'localUserIsAlone':
                        message = 'There is no one else in this chat room right now';
                        showMessageInVideoWindow(scope, overlayElem, message);
                        break;

                    case 'waitingForRemoteToAgreeToExchangeVideo':
                        message = 'We are waiting for the remote user to agree to exchange video';
                        showMessageInVideoWindow(scope, overlayElem, message);
                        break;

                    case 'remoteHasDeniedToExchangeVideo':
                        message = 'Remote user has denied your request to exchange video';
                        showMessageInVideoWindow(scope, overlayElem, message);
                        break;


                    case 'mustEnableVideoToStartTransmission':
                        message = 'You must give access to your camera before we can setup a video conversation. ' +
                        'Click <a href="" ng-click="showCameraAndMicrophoneInstructions()">here</a> for more details';
                        showMessageInVideoWindow(scope, overlayElem, message);
                        break;

                    case 'remoteHasNotEnabledVideoYet':
                        message = 'We are waiting for remote user to give access to their camera and microphone';
                        showMessageInVideoWindow(scope, overlayElem, message);
                        break;

                    case null:
                        message = 'null videoSignalingStatusForUserFeedback received - removing message in video window';
                        removeMessageInVideoWindow(scope, overlayElem);
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