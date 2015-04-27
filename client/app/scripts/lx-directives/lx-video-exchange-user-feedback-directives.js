/**
 * Created by alexandermarquardt on 2014-09-03.
 */

'use strict';

var lxSelectVideoTypePreferenceDirectives = angular.module('lxVideoExchangeUserFeedback.directives', []);


var  showMessageInVideoWindow = function(scope, overlayElem, message, $compile) {
    overlayElem.removeClass('ng-hide');
    overlayElem.html('');
    var el = angular.element('<span/>');
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
        link : function(scope, elem, attrs) {
            var message;
            var overlayElem = elem;

            var selectedVideoElement = attrs.selectedVideoElement;


            // If the remote user hangs up, the remoteVideoEnabledSetting will be received before the
            // remoteStreamIsActive status is updated. Therefore we need to check both in order to ensure
            // that user feedback is accurate.
            function checkForChangeInRemoteStreamOrRemoteVideoEnabledSetting() {
                try {
                    return scope.videoExchangeObjectsDict[selectedVideoElement].remoteVideoEnabledSetting + (!!lxPeerService.remoteStream[selectedVideoElement]).toString();
                }
                catch(err) {
                    return null;
                }
            }

            scope.$watch(checkForChangeInRemoteStreamOrRemoteVideoEnabledSetting, function(returnVal) {

                if (returnVal !== null) {
                    var remoteStreamIsActive = !!lxPeerService.remoteStream[selectedVideoElement];

                    // hide any messages so we are at at known default state.
                    hideMessageInVideoWindow(scope, overlayElem);

                    var remoteVideoSetting = scope.videoExchangeObjectsDict[selectedVideoElement].remoteVideoEnabledSetting;
                    if (!remoteStreamIsActive) {
                        switch (remoteVideoSetting) {
                            case 'waitingForPermissionToEnableVideoExchange':
                                message = 'Waiting for remote user to agree to exchange video';
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;

                            case 'denyVideoExchange':
                                message = 'Remote user has denied your request to exchange video';
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;

                            case 'hangupVideoExchange':
                                message = 'Remote user has closed this video exchange';
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;

                            case 'doVideoExchange':
                                message = 'Establishing video connection';
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;
                        }
                    }
                }
            });

            function getIceConnectionState() {
                try {
                    return lxPeerService.pc[selectedVideoElement].iceConnectionState;
                }

                // This error can occur right after the user enables their video elements, but before they
                // have setup the peer connection.
                catch(err) {
                    return null;
                }
            }

            // We watch the ICE connection state for 'disconnected' value, since this is the best way to see
            // if the remote user has lost their connection/closed browser/etc.
            scope.$watch(getIceConnectionState, function(iceConnectionState) {

                if (iceConnectionState === 'disconnected') {
                    hideMessageInVideoWindow(scope, overlayElem);
                    message = 'The video connection has been lost';
                    showMessageInVideoWindow(scope, overlayElem, message, $compile);
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
        link: function (scope, elem) {
            var message;
            var overlayElem = elem;

            var watchLocalStream = function() {
                return !!lxStreamService.localStream;
            };

            scope.$watch(watchLocalStream, function(localStream) {
                if (!localStream) {
                    message = '<a href="" ng-click="showCameraAndMicrophoneInstructions()">' +
                        'Click here</a> to to activate video. ';
                    showMessageInVideoWindow(scope, overlayElem, message, $compile);
                } else {
                    hideMessageInVideoWindow(scope, overlayElem);
                }
            });
        }
    };
});
