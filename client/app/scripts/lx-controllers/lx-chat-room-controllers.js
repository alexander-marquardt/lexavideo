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
        lxInitializeRoomService
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
                $scope.trackUnseenMessageCountObject.unseenMessageCount -= $scope.chatPanelDict[data.roomId].numMessagesSinceLastTimeBottomOfPanelWasViewed;
            }

            $scope.chatPanelDict[data.roomId] = {
                chatPanelIsGlued: true,
                numMessagesSinceLastTimeBottomOfPanelWasViewed: 0,
                chatPanelIsCurrentlyVisible: true
            };

            $scope.chatRoomDisplayObject.chatPanelObject = $scope.chatPanelDict[data.roomId];

            // Add the normalizedRoomName to normalizedRoomNamesList, but only if it is not already there.
            if ($.inArray(data.normalizedChatRoomName, $scope.normalizedRoomNamesList) === -1) {
                $scope.normalizedRoomNamesList.push(data.normalizedChatRoomName);
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
                                                           remoteClientId, resetRemoteVideoEnabledSetting) {

            /* localVideoEnabledSetting: [see createVideoExchangeSettingsObject for options]
               resetRemoteVideoEnabledSetting: boolean - if true, will reset the remoteVideoEnabledSetting value to the
               'waitingForPermissionToEnableVideoExchange'
             */

            /* If the "partial" notification menu is shown, then treat the click as an indication that the user wants
               to see the entire notification menu.
             */
            if ($scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention) {
                return;
            }


            $log.log('Executing showVideoElementsAndStartVideoFn');
            lxJs.assert(remoteClientId, 'remoteClientId is not set');

            var isANewRequest = false;
            var previousLocalVideoEnabledSetting = null;
            if (!(remoteClientId in $scope.videoExchangeObjectsDict)) {
                $log.info('showVideoElementsAndStartVideoFn creating new videoExchangeObjectsDict entry for remote client ' + remoteClientId);
                $scope.videoExchangeObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject();
                $scope.videoStateInfoObject.numVideoSessionsOpenOnLocalClient += 1;
                isANewRequest = true;
            }
            else {
                previousLocalVideoEnabledSetting = $scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting;
            }

            if (resetRemoteVideoEnabledSetting) {
                $scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting = 'waitingForPermissionToEnableVideoExchange';
            }

            $scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting = localVideoEnabledSetting;

            if ((localVideoEnabledSetting === 'requestVideoExchange' || localVideoEnabledSetting === 'acceptVideoExchange') &&
                !(previousLocalVideoEnabledSetting === 'requestVideoExchange' || previousLocalVideoEnabledSetting === 'acceptVideoExchange')) {

                $scope.videoStateInfoObject.numOpenVideoExchanges ++;
            }


            // check if user has either accepted or denied a pending request
            if (previousLocalVideoEnabledSetting === 'waitingForPermissionToEnableVideoExchange' &&
                localVideoEnabledSetting !== 'waitingForPermissionToEnableVideoExchange') {
                $scope.videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers--;
            }

            lxAccessVideoElementsAndAccessCameraService.sendStatusOfVideoElementsEnabled(
                $scope,
                localVideoEnabledSetting,
                remoteClientId);

            // If the user previously enabled video exchange with this client, and now is "hangupVideoExchange" for a new video
            // connection, then they have hung up the connection to the remote user.
            if ((previousLocalVideoEnabledSetting === 'requestVideoExchange' || previousLocalVideoEnabledSetting === 'acceptVideoExchange')
                && localVideoEnabledSetting === 'hangupVideoExchange') {

                lxCallService.doHangup(remoteClientId, $scope.videoStateInfoObject.numOpenVideoExchanges);
                $scope.videoStateInfoObject.numOpenVideoExchanges --;
                delete $scope.remoteVideoObjectsDict[remoteClientId] ;
                delete $scope.videoExchangeObjectsDict[remoteClientId];
            }

            lxJs.assert($scope.videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers >= 0, 'Negative numVideoRequestsPendingFromRemoteUsers');
            lxJs.assert($scope.videoStateInfoObject.numOpenVideoExchanges >= 0, 'Negative numOpenVideoExchanges');
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

        $scope.toggleWebcamMute = function() {
            lxCallService.toggleWebcamMute($scope.localVideoObject);
        };

        $scope.toggleMicrophoneMute = function() {
            lxCallService.toggleMicrophoneMute($scope.localVideoObject);
        };

        $scope.toggleAudioMute = function(remoteClientId) {
            lxCallService.toggleAudioMute($scope.remoteVideoObjectsDict[remoteClientId]);
        };

        $scope.myUsername = lxVideoParamsService.myUsername;
    });