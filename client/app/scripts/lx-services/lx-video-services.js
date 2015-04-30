'use strict';

angular.module('lxVideo.services', [])

.factory('lxVideoService', function(
        $log,
        lxAccessVideoElementsAndAccessCameraService,
        lxCallService,
        lxCreateChatRoomObjectsService,
        lxJs
        ) {

    return {
        showVideoElementsAndStartVideoFn: function ($scope, localVideoEnabledSetting, remoteClientId) {

            /* localVideoEnabledSetting: [see createVideoExchangeSettingsObject for options]
             resetRemoteVideoEnabledSetting: boolean - if true, will reset the remoteVideoEnabledSetting value to the
             'waitingForPermissionToEnableVideoExchange'
             */


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
                $scope.videoDisplaySelection.currentlySelectedVideoElement = remoteClientId;

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
                $scope.videoDisplaySelection.currentlySelectedVideoElement = 'localVideoElement';

                var numOpenVideoExchanges = $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;

                lxCallService.doHangup(remoteClientId, numOpenVideoExchanges);
                delete $scope.remoteMiniVideoElementsDict[remoteClientId];
                delete $scope.videoExchangeObjectsDict[remoteClientId];

            }


            $scope.videoStateInfoObject.numOpenVideoExchanges = $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;
            $scope.videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers = $scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.length;

        }
    }
});
