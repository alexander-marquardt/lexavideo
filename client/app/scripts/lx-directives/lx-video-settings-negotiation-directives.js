/**
 * Created by alexandermarquardt on 2014-09-03.
 */

'use strict';

var lxSelectVideoTypePreferenceDirectives = angular.module('lxVideoNegotiation.directives', []);


var  showMessageInVideoWindow = function(scope, overlayElem, message, $compile) {
    overlayElem.removeClass('ng-hide');
    overlayElem.html('');
    var el = angular.element('<p class="cl-video-overlay-text"/>');
    el.html(message);
    var compiledEl = $compile(el)(scope);
    overlayElem.append(compiledEl);
};

var hideMessageInVideoWindow = function(scope, overlayElem) {
    overlayElem.addClass('ng-hide');
};


lxSelectVideoTypePreferenceDirectives.directive('lxDisplayRemoteVideoStatus',
    function(
        $compile,
        $log,
        lxPeerService
    ) {

    return {
        restrict: 'A',
        template: '<div class="cl-video-overlay cl-show-hide-fade ng-hide" ></div>',
        link : function(scope, elem) {
            var message;
            var overlayElem = angular.element(elem).find('div.cl-video-overlay');

            function checkIfRemoteStreamActive() {
                return !!lxPeerService.remoteStream[scope.remoteClientId];
            }

            scope.$watch(checkIfRemoteStreamActive, function(remoteStreamIsActive) {
                if (remoteStreamIsActive) {
                    hideMessageInVideoWindow(scope, overlayElem);
                }
            });

            // If the remote user hangs up, the remoteVideoEnabledSetting will be received before the
            // remoteStreamIsActive status is updated. Therefore we need to check both in order to ensure
            // that user feedback is accurate.
            function checkForChangeInRemoteStreamOrRemoteVideoEnabledSetting() {
                return scope.videoExchangeObject.remoteVideoEnabledSetting + checkIfRemoteStreamActive().toString();
            }

            scope.$watch(checkForChangeInRemoteStreamOrRemoteVideoEnabledSetting, function(newVal) {

                if (!checkIfRemoteStreamActive()) {
                    var remoteVideoSetting = scope.videoExchangeObject.remoteVideoEnabledSetting;
                    switch (remoteVideoSetting) {
                        case 'waitingForEnableVideoExchangePermission':
                            message = 'We are waiting for the remote user to agree to exchange video';
                            showMessageInVideoWindow(scope, overlayElem, message, $compile);
                            break;

                        case 'doNotEnableVideoExchange':
                            message = 'Remote user has denied your request to exchange video';
                            showMessageInVideoWindow(scope, overlayElem, message, $compile);
                            break;

                        case 'enableVideoExchange':
                            message = 'Attempting to establish video connection';
                            showMessageInVideoWindow(scope, overlayElem, message, $compile);
                            break;

                            $log.debug(message);
                    }
                }
            });
        }
    };
});

lxSelectVideoTypePreferenceDirectives.directive('lxDisplayLocalVideoStatus',
    function(
        lxStreamService,
        $compile
    ) {

    return {
        restrict: 'A',
        template: '<div class="cl-video-overlay cl-show-hide-fade ng-hide" ></div>',
        link: function (scope, elem) {
            var message;
            var overlayElem = angular.element(elem).find('div.cl-video-overlay');

            var watchLocalStream = function() {
                return !!lxStreamService.localStream
            };

            scope.$watch(watchLocalStream, function(localStream) {
                if (!localStream) {
                    message = '<a href="" ng-click="showCameraAndMicrophoneInstructions()">' +
                        'Click here</a> to to activate video. ';
                    showMessageInVideoWindow(scope, overlayElem, message, $compile);
                } else {
                    hideMessageInVideoWindow(scope, elem);
                }
            });
        }
    }
});
