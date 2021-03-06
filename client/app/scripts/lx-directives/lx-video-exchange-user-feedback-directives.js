/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
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
        gettextCatalog,
        lxPeerService
    ) {

    return {
        restrict: 'A',
        link : function(scope, elem, attrs) {
            var message;
            var overlayElem = elem;



            // If the remote user hangs up, the remoteVideoEnabledSetting will be received before the
            // remoteStreamIsActive status is updated. Therefore we need to check both in order to ensure
            // that user feedback is accurate.
            function checkForChangeInRemoteStreamOrRemoteVideoEnabledSetting() {
                var selectedVideoElementClientId = attrs.selectedVideoElementClientId;

                try {
                    return selectedVideoElementClientId + scope.videoExchangeObjectsDict[selectedVideoElementClientId].remoteVideoEnabledSetting +
                        (!!lxPeerService.remoteStream[selectedVideoElementClientId]).toString();
                }
                catch(err) {
                    return null;
                }
            }

            scope.$watch(checkForChangeInRemoteStreamOrRemoteVideoEnabledSetting, function(returnVal) {

                if (returnVal !== null) {
                    var selectedVideoElementClientId = attrs.selectedVideoElementClientId;
                    var remoteStreamIsActive = !!lxPeerService.remoteStream[selectedVideoElementClientId];

                    // hide any messages so we are at at known default state.
                    hideMessageInVideoWindow(scope, overlayElem);

                    var remoteVideoSetting = scope.videoExchangeObjectsDict[selectedVideoElementClientId].remoteVideoEnabledSetting;
                    var remoteUsernameAsWritten = scope.videoStateInfoObject.currentOpenVideoSessionsUserNamesDict[selectedVideoElementClientId];
                    if (!remoteStreamIsActive) {
                        switch (remoteVideoSetting) {
                            case 'waitingForPermissionToEnableVideoExchange':
                                message = gettextCatalog.getString('Waiting for user') + ' ' + remoteUsernameAsWritten + ' ' +
                                    gettextCatalog.getString('to agree to exchange video');
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;

                            case 'denyVideoExchange':
                                message = remoteUsernameAsWritten + ' ' +  gettextCatalog.getString('has denied your request to exchange video');
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;

                            case 'hangupVideoExchange':
                                message = remoteUsernameAsWritten + ' ' + gettextCatalog.getString(
                                      'has closed this video exchange. ' +
                                      'However, a new video session will start immediately if they ' +
                                      'call you again. If you do not want this to happen, you should ' +
                                      'press the hang-up button now.');
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;

                            case 'doVideoExchange':
                                message = gettextCatalog.getString('Establishing video connection with') + ' ' + remoteUsernameAsWritten;
                                showMessageInVideoWindow(scope, overlayElem, message, $compile);
                                break;
                        }
                    }
                }
            });

            function getIceConnectionState() {
                try {
                    var selectedVideoElementClientId = attrs.selectedVideoElementClientId;
                    return lxPeerService.pc[selectedVideoElementClientId].iceConnectionState;
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
                    message = gettextCatalog.getString('The video connection has been lost');
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
