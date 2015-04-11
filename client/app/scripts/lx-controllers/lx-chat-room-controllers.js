/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

/* global $ */

angular.module('lxUseChatRoom.controllers', [])


    .controller('lxChatViewCtrl', function(
        $location,
        $scope,
        $timeout,
        lxChannelSupportService,
        lxHttpChannelService,
        lxInitializeRoomService,
        lxShowNumMessagesService
        ) {

        $scope.lxChatRoomCtrl = {

            userSuccessfullyEnteredRoom: false,
            channelToken: null,
            clientId: null
        };


        var addClientToRoomWhenChannelReady = function(roomId) {
            var innerWaitForChannelReady = function() {
                if (!lxChannelSupportService.channelReady) {
                    $timeout(innerWaitForChannelReady, 100);
                } else {
                    // Add the user to the room, now that the channel is open
                    lxHttpChannelService.addClientToRoom($scope.lxMainViewCtrl.clientId,
                        $scope.lxMainViewCtrl.userId, roomId);
                }
            };
            innerWaitForChannelReady();
        };


        lxInitializeRoomService.addUserToRoom().then(function(data) {

            $scope.lxChatRoomCtrl.userSuccessfullyEnteredRoom  = true;
            addClientToRoomWhenChannelReady(data.roomId);
            $scope.receivedChatMessageObject[data.roomId] = {};

            // since we are resetting the number of unseen messages for this chat panel, we need to subtract it
            // from the "global" unseenMessageCount before zeroing it.
            if (data.roomId in $scope.chatPanelDict) {
                lxShowNumMessagesService.subtractNumMessagesSeen($scope.trackUnseenMessageCountObject,
                    $scope.chatPanelDict[data.roomId], $scope.presenceStatus.ACTIVE.active);
            }

            $scope.chatPanelDict[data.roomId] = {
                chatPanelIsGlued: true,
                numMessagesSinceLastTimeBottomOfPanelWasViewed: 0,
                chatPanelIsCurrentlyVisible: true
            };

            $scope.chatRoomDisplayObject.chatPanelObject = $scope.chatPanelDict[data.roomId];

            // Add the normalizedRoomName to normalizedOpenRoomNamesList, but only if it is not already there.
            if ($.inArray(data.normalizedChatRoomName, $scope.normalizedOpenRoomNamesList) === -1) {
                $scope.normalizedOpenRoomNamesList.push(data.normalizedChatRoomName);
            }

        }, function(errorEnteringIntoRoomInfoObj) {

            $scope.lxChatRoomCtrl.userSuccessfullyEnteredRoom  = false;

            // The following sets an error on a global object that will be picked up by the javascript
            // when the user is sent back to the main landing page, at which point the user will
            // be shown a message indicating that there was an error, and another chance to go into
            // a different room.
            $scope.mainGlobalControllerObj.errorEnteringIntoRoomInfoObj = errorEnteringIntoRoomInfoObj;
            $location.path('/');
        });

    })

    .controller('lxChatRoomCtrl',
    function($scope,
             $log,
             $timeout,
             $window,
             lxAccessVideoElementsAndAccessCameraService,
             lxAppWideConstantsService,
             lxCallService,
             lxCreateChatRoomObjectsService,
             lxChatRoomVarsService,
             lxJs
             ) {


// TODO - move this function into a service.
        $scope.showVideoElementsAndStartVideoFn = function(localVideoEnabledSetting,
                                                           remoteClientId) {

            /* localVideoEnabledSetting: [see createVideoExchangeSettingsObject for options]
               resetRemoteVideoEnabledSetting: boolean - if true, will reset the remoteVideoEnabledSetting value to the
               'waitingForPermissionToEnableVideoExchange'
             */

            /* If the "partial" notification menu is shown, then treat the click as an indication that the user wants
               to see the entire notification menu. This is done so that if the user clicks on a button that
               is shown in the partial-menu, that the entire menu will be shown instead of acting on the button click.
               (This will likely cause problems with normal video buttons, and should be re-visited)
             */
            if ($scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention) {
                return;
            }


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
            }

            // Remove remoteClientId from *pending* requests if it is there
            var indexOfRemoteIdRequestPending = $scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.indexOf(remoteClientId);
            if (indexOfRemoteIdRequestPending >= 0) {
                $scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.splice(indexOfRemoteIdRequestPending, 1)
            }

            lxAccessVideoElementsAndAccessCameraService.sendStatusOfVideoElementsEnabled(
                $scope,
                localVideoEnabledSetting,
                remoteClientId);

            // If the remote user previously hung-up or denied our request, and we are calling them again, then we
            // update the status of the remote user to indicate that we are now waiting for them to give permission
            // to our request to exhcange video.
            var remoteVideoEnabledSetting =  $scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting;
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

                var numOpenVideoExchanges = $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;

                lxCallService.doHangup(remoteClientId, numOpenVideoExchanges);
                delete $scope.remoteVideoElementsDict[remoteClientId] ;
                delete $scope.videoExchangeObjectsDict[remoteClientId];

            }


            $scope.videoStateInfoObject.numOpenVideoExchanges = $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;
            $scope.videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers = $scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.length;

        };
    })

    .controller('lxMainVideoCtrl',
    function (
        $scope,
        lxAccessCameraAndMicrophoneService,
        lxCallService,
        lxCheckIfSystemSupportsWebRtcService,
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
    });