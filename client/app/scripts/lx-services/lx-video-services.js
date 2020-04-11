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

angular.module('lxVideo.services', [])


.factory('lxVideoElems', function( ){

    var localVideoObject = {
      localMiniVideoElem: null,
      localBigVideoElem: null,
      isWebcamMuted: false,
      isMicrophoneMuted: false
    };

    // remoteVideoElementsDict will be populated with calls to lxCreateChatRoomObjectsService.createRemoteVideoElementsObject
    // There will be one object for each remote client that the local user is exchanging video with.
    // remoteVideoElementsDict[remoteClientId] = {
    //    remoteMiniVideoElem: the dom element that will display the miniature version of the remote video,
    //    isAudioMuted: boolean
    // }
    var remoteVideoElementsDict = {};

    return {
      localVideoObject: localVideoObject,
      remoteVideoElementsDict: remoteVideoElementsDict
    }

})

.factory('lxVideoService', function(
        $log,
        lxAccessVideoElementsAndAccessCameraService,
        lxCallService,
        lxCreateChatRoomObjectsService,
        lxJs,
        lxTurnService,
        lxVideoElems
        ) {



    function createMiniVideoElement($scope, remoteClientId) {

        var miniVideoElem;



        // This function is called each time
        if (lxVideoElems.localVideoObject.localMiniVideoElem) {
            miniVideoElem = angular.element('<video class="cl-video cl-mini-video-sizing" autoplay="autoplay" muted="true"></video>');
            lxVideoElems.localVideoObject.localMiniVideoElem = miniVideoElem[0];

        }

        if (!(remoteClientId in lxVideoElems.remoteVideoElementsDict)) {
            miniVideoElem = angular.element('<video class="cl-video cl-mini-video-sizing" autoplay="autoplay"></video>');
            lxVideoElems.remoteVideoElementsDict[remoteClientId] = lxCreateChatRoomObjectsService.createRemoteVideoElementsObject(
                miniVideoElem[0]);
        }
    }

    return {
        showVideoElementsAndStartVideoFn: function (
            $scope,
            localVideoEnabledSetting,
            clientId,
            remoteClientId) {

            /* localVideoEnabledSetting: [see createVideoExchangeSettingsObject for options]
             */

            if (localVideoEnabledSetting !== 'hangupVideoExchange' && localVideoEnabledSetting !== 'denyVideoExchange') {
                // Get the turn credentials
                try {
                    lxTurnService.maybeRequestTurn($scope, clientId, remoteClientId);
                }
                catch (e) {
                    e.message = '\n\tError in lxInitializeTurnDirective\n\t' + e.message;
                    $log.error(e);
                    return false;
                }
            }

            createMiniVideoElement($scope, remoteClientId);

            lxJs.assert(remoteClientId, 'remoteClientId is not set');

            if (!(remoteClientId in $scope.videoExchangeObjectsDict)) {
                $log.info('showVideoElementsAndStartVideoFn creating new videoExchangeObjectsDict entry for remote client ' + remoteClientId);
                $scope.videoExchangeObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject();
            }

            $scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting = localVideoEnabledSetting;


            // Add remoteClientId to list of *currently open* list if it is not already there (Note: we
            // will even add 'hangup' and 'deny' settings here, as they will be removed by code below)
            var indexOfRemoteIdOpenSessions = $scope.videoStateInfoObject.currentOpenVideoSessionsList.indexOf(remoteClientId);
            if (indexOfRemoteIdOpenSessions === -1) {
                // "push" to the front of the array, so that most recent additions appear first in the video section
                $scope.videoStateInfoObject.currentOpenVideoSessionsList.unshift(remoteClientId);
                $scope.videoDisplaySelection.currentlySelectedVideoElementClientId = remoteClientId;

            }

            // Remove remoteClientId from *pending* requests if it is there
            var indexOfRemoteIdRequestPending = $scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.indexOf(remoteClientId);
            if (indexOfRemoteIdRequestPending >= 0) {
                $scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.splice(indexOfRemoteIdRequestPending, 1);
            }

            lxAccessVideoElementsAndAccessCameraService.sendStatusOfVideoElementsEnabled(
                $scope,
                localVideoEnabledSetting,
                remoteClientId);

            // If the remote user previously hung-up or denied our request, and we are calling them again, then we
            // update the status of the remote user to indicate that we are now waiting for them to give permission
            // to our request to exhcange video.
            var remoteVideoEnabledSetting = $scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting;
            if (localVideoEnabledSetting === 'doVideoExchange') {
                if (remoteVideoEnabledSetting === 'hangupVideoExchange' || remoteVideoEnabledSetting === 'denyVideoExchange') {
                    $scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting = 'waitingForPermissionToEnableVideoExchange';
                }
            }

            // If the user hangs up or denies, then remove the references to the remote user
            if (localVideoEnabledSetting === 'hangupVideoExchange' || localVideoEnabledSetting === 'denyVideoExchange') {

                // remove client from *currently open* list (it should be there by construction as we have just added it if it wasn't)
                indexOfRemoteIdOpenSessions = $scope.videoStateInfoObject.currentOpenVideoSessionsList.indexOf(remoteClientId);
                $scope.videoStateInfoObject.currentOpenVideoSessionsList.splice(indexOfRemoteIdOpenSessions, 1);

                // we just removed the remoteClientId from currentOpenVideoSessionsList, therefore
                // we need to decide which video element to display. We select the local video element, since we know
                // that it will always exist, and any selection is somewhat arbitrary so this is as good as any.
                $scope.videoDisplaySelection.currentlySelectedVideoElementClientId = 'localVideoElement';

                var numOpenVideoExchanges = $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;

                lxCallService.doHangup(remoteClientId, numOpenVideoExchanges);
                delete lxVideoElems.remoteVideoElementsDict[remoteClientId];
                delete $scope.videoExchangeObjectsDict[remoteClientId];
                delete $scope.videoStateInfoObject.currentOpenVideoSessionsUserNamesDict[remoteClientId];
            }

            $scope.videoStateInfoObject.numOpenVideoExchanges = $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;
            $scope.videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers = $scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.length;
        }
    };
});
