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

/* global $ */

angular.module('LxChatRoom.controllers', [])

    // *** WARNING ***
    // *** WARNING *** because we are "faking" the chat panel views, LxChatMainController does not wrap the chat panels
    // *** WARNING ***

    .controller('LxChatMainController', function(
        $location,
        $routeParams,
        $log,
        $scope,
        $timeout,
        $window,
        lxAuthenticationHelper,
        lxHttpChannelService,
        lxJs,
        lxChatRoomMembersService
        ) {

        $scope.lxMainCtrlDataObj.currentView = 'LxChatMainView';
        $scope.mainMenuObject.showMainMenu = false;


        var normalizedChatRoomNameFromUrl = $routeParams.chatRoomName.toLowerCase();
        lxChatRoomMembersService.lifoQueueChatRoomNameOnNormalizedOpenRoomNamesList(normalizedChatRoomNameFromUrl, $scope.normalizedOpenRoomNamesList);

        // We need to make sure that clientId is set before we can enter the client into the room.
        // If clientId is set, then we immediately setup everything required for this user to enter the room.
        // If clientId is not currently set, then the watcher in LxMainController will ensure that
        // the client gets correctly added to the room once the clientId is set.
        if ($scope.lxMainCtrlDataObj.clientId) {
            lxChatRoomMembersService.handleChatRoomName($scope, $routeParams.chatRoomName);

        }

    })

    .controller('LxVideoController',
    function (
        $log,
        $scope,
        lxAccessCameraAndMicrophoneService,
        lxCallService,
        lxCheckIfSystemSupportsWebRtcService,
        lxVideoService,
        lxVideoParamsService) {

        $scope.accessCameraAndMicrophoneObject = {
            // modalIsShown will contain the templateUrl for each modal that is currently open. Note that while only
            // a single modal should be shown at once, due to the asynchronous callback nature of the .close() function,
            // we cannot guarantee that the current modal is closed before a new one is opened.
            // This variable should be used as follows:
            // accessCameraAndMicrophoneObject.modalsCurrentlyShown[modal-index#] = templateUrl (where template Url is unique
            // for each modal).
            modalsCurrentlyShown: []
        };


        $scope.showCameraAndMicrophoneInstructions = function() {

            // checkBrowserVersionToSeeIfGetUserMediaSupported will show a modal to the user if their browser/device is
            // not supported. If it is supported, then it will return true and the prompt for access to camera and mic
            // will be presented.
            if (lxCheckIfSystemSupportsWebRtcService.checkBrowserVersionToSeeIfGetUserMediaSupported($scope)) {
                lxAccessCameraAndMicrophoneService.showModalsAndArrowsForGrantingCameraAndMicrophoneAccess($scope);
            }
        };

        $scope.toggleWebcamMuteInterfaceFn = function() {
            lxCallService.toggleWebcamMute($scope.localVideoObject);
        };

        $scope.toggleMicrophoneMuteInterfaceFn = function() {
            lxCallService.toggleMicrophoneMute($scope.localVideoObject);
        };

        $scope.toggleAudioMuteInterfaceFn = function(remoteClientId) {
            lxCallService.toggleAudioMute($scope.remoteVideoElementsDict[remoteClientId]);
        };

        $scope.myUsername = lxVideoParamsService.myUsername;

        $scope.showVideoElementsAndStartVideoFnWrapper = function(localVideoEnabledSetting, remoteClientId) {
            lxVideoService.showVideoElementsAndStartVideoFn(
                $scope, localVideoEnabledSetting, $scope.lxMainCtrlDataObj.clientId, remoteClientId);
        };
    });