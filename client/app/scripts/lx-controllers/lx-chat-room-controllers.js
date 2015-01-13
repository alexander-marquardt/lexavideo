/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

angular.module('lxUseChatRoom.controllers', [])


    .controller('lxChatRoomCtrl',
    function($scope,
             $location,
             $log,
             $timeout,
             $window,
             lxAccessVideoElementsAndAccessCameraService,
             lxAppWideConstantsService,
             lxCallService,
             lxCreateChatRoomObjectsService,
             lxChannelService,
             lxChannelSupportService,
             lxChatRoomVarsService,
             lxHttpChannelService,
             lxInitializeRoomService
             ) {


        var uniqueIdentifier = (new Date()).getTime();
        var clientId = lxAppWideConstantsService.userId + '|' + uniqueIdentifier;

        $scope.debugBuildEnabled = lxAppWideConstantsService.debugBuildEnabled;

        $scope.lxChatRoomCtrl = {

            userSuccessfullyEnteredRoom: false,
            channelToken: null,
            clientId: null
        };


        $scope.roomOccupancyObject = {
            // This will be updated to reflect the status sent from the server.
            listOfClientObjects: [],

            userName: lxAppWideConstantsService.userName,
            userId: lxAppWideConstantsService.userId,
            chatRoomName: $location.path().replace(/\//, ''),
            roomId: null
        };

        lxHttpChannelService.requestChannelToken(clientId, lxAppWideConstantsService.userId).then(function(response) {
            $scope.lxChatRoomCtrl.channelToken = response.data.channelToken;
            $scope.lxChatRoomCtrl.clientId = clientId;

            lxChannelService.openChannel($scope);

            $window.onbeforeunload = function () {
                $log.debug('Manually disconnecting channel on window unload event.');
                lxHttpChannelService.manuallyDisconnectChannel($scope.lxChatRoomCtrl.clientId);
            };

            // Periodically update the room so that the server knows if the user is currently in the room.
            // lxChannelService.startClientHeartbeat($scope.lxChatRoomCtrl.clientId);

        }, function() {
            $scope.lxChatRoomCtrl.channelToken = 'Failed to get channelToken';
            $scope.lxChatRoomCtrl.clientId = 'Failed to get clientId';
        });

        var addClientToRoomWhenChannelReady = function(roomOccupancyObject) {
            var innerWaitForChannelReady = function() {
                if (!lxChannelSupportService.channelReady) {
                    $timeout(innerWaitForChannelReady, 100);
                } else {
                    // Add the user to the room, now that the channel is open
                    lxHttpChannelService.addClientToRoom($scope.lxChatRoomCtrl.clientId,
                        roomOccupancyObject.userId, roomOccupancyObject.roomId);
                }
            };
            innerWaitForChannelReady();
        };

        lxInitializeRoomService.addUserToRoom($scope).then(function(data) {

            $scope.lxChatRoomCtrl.userSuccessfullyEnteredRoom  = true;

            // The following two lines need to be removed once we have the channelToken passed through the
//            // "requestChannelToken" function above
//            $scope.lxChatRoomCtrl.channelToken = data.channelToken;
//            $scope.lxChatRoomCtrl.clientId = data.clientId;

            $scope.roomOccupancyObject.roomId = lxChatRoomVarsService.roomId = data.roomId;

            addClientToRoomWhenChannelReady($scope.roomOccupancyObject);

        }, function(errorEnteringIntoRoomInfoObj) {

            $scope.lxChatRoomCtrl.userSuccessfullyEnteredRoom  = false;

            // The following sets an error on a global object that will be picked up by the javascript
            // when the user is sent back to the main landing page, at which point the user will
            // be shown a message indicating that there was an error, and another chance to go into
            // a different room.
            $scope.mainGlobalControllerObj.errorEnteringIntoRoomInfoObj = errorEnteringIntoRoomInfoObj;
            $location.path('/');
        });

        // remoteVideoObject will be populated with calls to lxCreateChatRoomObjectsService.createRemoteVideoObject
        // There will be one object for each remote client that the local user is exchanging video with.
        $scope.remoteVideoObjectsDict = {};

        $scope.localVideoObject = {
            localHdVideoElem:  undefined,  // set in lxVideoElementDirective
            localVideoWrapper: undefined, // set in lxVideoWrapperDirective
            isWebcamMuted: false,
            isMicrophoneMuted: false
        };

        // videoExchangeObjectsDict will be populated with calls to
        // lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject(), and there will be one key
        // for each remote client that the local user is exchanging video settings with.
        $scope.videoExchangeObjectsDict = {};

        $scope.videoStateInfoObject = {
            // we keep track of the number of times that the local user has enabled video exchanges. When this
            // number is zero, we do not show any video boxes, and when it is one or more, we show video.
            localVideoIsEnabledCount : 0
        };

        $scope.showVideoElementsAndStartVideoFn = function(localVideoEnabledSetting,
                                                           queryForRemoteVideoElementsEnabled,
                                                           remoteClientId) {

            if (!(remoteClientId in $scope.videoExchangeObjectsDict)) {
                $log.info('showVideoElementsAndStartVideoFn creating new videoExchangeObjectsDict entry for client ' + remoteClientId);
                $scope.videoExchangeObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject();
            }
            $scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting = localVideoEnabledSetting;
            $scope.videoStateInfoObject.localVideoIsEnabledCount += 1;

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

        $scope.receivedChatMessageObject = {
            messageString: undefined,

           // receivedMessageTime is updated every time the user sends a message - this is necessary because
            // if we just watch receivedMessageString for changes to trigger sending of the message, then the user will not be
            // able to send the same message twice.
            receivedMessageTime: 0
        };

//        // ackChatMessageObject holds the acknowledgement that the remote client has received a message that
//        // was sent from the local user
//        $scope.ackChatMessageObject = {
//            ackMessageUniqueId: null
//        };


        // The following declarations should only be used inside the lxMainVideoCtrl, however we need to declare them
        // here because information received on the channel needs to be written into these objects.
        $scope.videoSignalingObject = {

            localUserAccessCameraAndMicrophoneStatus: 'requestNotMade', // 'requestNotMade', 'waitingForResponse', 'allowAccess', 'denyAccess'

            // videoSignalingStatusForUserFeedback indicates what message/status the user should be shown about
            // the current video type requested/allowed/waiting for/etc.
            videoSignalingStatusForUserFeedback: null,

            // The following is a flag that is used for debugging - will over-ride ng-show directives on the video
            // windows to show any window that has this flag on it when it is set to true.
            debugShowAllVideoWindows: false
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