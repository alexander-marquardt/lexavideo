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



        $scope.showVideoElementsAndStartVideoFn = function(localVideoEnabledSetting,
                                                           queryForRemoteVideoElementsEnabled,
                                                           remoteClientId) {

            /* localVideoEnabledSetting: [see createVideoExchangeSettingsObject for options]
             queryForRemoteVideoElementsEnabled: If the client is initiating a request to start video, then we want
             to know if the remote user has accepted the request. However, if the client is responding then we don't
             want to request the remote user (who is the original initiator of the video exchange) to tell us if they
             have accepted to transmit video (and doing so would cause circular requests).
             */
            lxJs.assert(remoteClientId, 'remoteClientId is not set');

            if (!(remoteClientId in $scope.videoExchangeObjectsDict)) {
                $log.info('showVideoElementsAndStartVideoFn creating new videoExchangeObjectsDict entry for remote client ' + remoteClientId);
                $scope.videoExchangeObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject();
                $scope.videoStateInfoObject.numVideoSessionsOpenOnLocalClient += 1;

            }

            if (localVideoEnabledSetting === 'enableVideoExchange') {
                $scope.videoStateInfoObject.localCurrentOpenVideoExchanges += 1;
            }

            // if the remoteVideoEnabledSetting is 'enableVideoExchange', then the local user is either accepting
            // or denying the remote request. In either case, we decrement the counter that tracks numer
            // of pending remote requests.
            if ($scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting === 'enableVideoExchange') {
                $scope.videoStateInfoObject.numVideoSessionsRequestedByRemoteClientNotYetActive--;
            }

            $scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting = localVideoEnabledSetting;

            lxAccessVideoElementsAndAccessCameraService.sendStatusOfVideoElementsEnabled(
                $scope,
                localVideoEnabledSetting,
                queryForRemoteVideoElementsEnabled,
                remoteClientId);

            // If this has been called with localVideoElementsEnabled === 'doNotEnableVideoExchange', then the user has either
            // (1) hung-up/stopped the call, or (2) denied to setup video elements. In the case 1, the
            // call must be hung up. In case 2, the call does not need to be hung up, but for simplicity
            // we also hangup the call for this case.
            if (localVideoEnabledSetting === 'doNotEnableVideoExchange' || localVideoEnabledSetting === 'waitingForEnableVideoExchangePermission') {
                lxCallService.doHangup(remoteClientId);
            }
        };



//        // ackChatMessageObject holds the acknowledgement that the remote client has received a message that
//        // was sent from the local user
//        $scope.ackChatMessageObject = {
//            ackMessageUniqueId: null
//        };

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