/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global videoConstantsEmbeddedInHtml */

angular.module('lxUseChatRoom.controllers', [])


    .controller('lxChatRoomOuterCtrl',
    function($scope,
             lxAccessVideoElementsAndAccessCameraService,
             lxAppWideConstantsService,
             lxCallService,
             lxInitializeRoomService,
             lxMessageService,
             lxUseChatRoomConstantsService,
             lxUseChatRoomVarsService,
             lxWebRtcSessionService) {

        // Copy all of the values that were embedded in the html into the lxUseChatRoomConstantsService.
        // Do this before everything else, as many other functions require that this structure be setup!!
        angular.extend(lxUseChatRoomConstantsService, videoConstantsEmbeddedInHtml);
        // update the global vars that depend on lxUseChatRoomConstantsService
        lxUseChatRoomVarsService.doUpdate(lxUseChatRoomConstantsService.pcConfig);

        $scope.debugBuildEnabled = lxAppWideConstantsService.debugBuildEnabled;

        $scope.lxChatRoomOuterCtrl = {

            userSuccessfullyEnteredRoom: false,
            channelToken: null,
            clientId: null
        };


        $scope.roomOccupancyObject = {
            // Once the remote user has joined the room, this will be modified to reflect their userId
            remoteUserId: null,
            remoteUserName: null,

            userName: lxAppWideConstantsService.userName,
            userId: lxAppWideConstantsService.userId,
            roomName: lxUseChatRoomConstantsService.roomName
        };

        lxInitializeRoomService.addUserToRoomAndSetupChannel().then(function(data) {

            $scope.lxChatRoomOuterCtrl.userSuccessfullyEnteredRoom  = true;
            $scope.lxChatRoomOuterCtrl.channelToken = data.channelToken;
            $scope.lxChatRoomOuterCtrl.clientId = data.clientId;

            $scope.roomOccupancyObject.roomId = lxUseChatRoomVarsService.roomId = data.roomId;

        }, function(reason) {
            // This message should never be seen by the user since if the promise is rejected, they should already
            // have been redirected back to the landing page. However, it may be useful for future debugging, and
            // so we leave it.
            $scope.lxChatRoomOuterCtrl.userSuccessfullyEnteredRoom  = reason;
        });

        $scope.videoCameraStatusObject = {

            // Note: the following values are "requests" for camera access, because they only enable the display
            // of the video elements and show the access prompt that the user must click on before actual camera
            // "access" is given. After this, there is a browser prompt that the user will have to accept in order
            // to access their camera and microphone.

            // localVideoActivationStatus and
            // remoteVideoActivationStatus can be the following values:
            //    'waitingForActivateVideo': user has not made any request for a video exchange
            //    'activateVideo': user has activated video elements
            //    'doNotActivateVideo': user has denied activation of video elements
            localVideoActivationStatus: 'waitingForActivateVideo',

            remoteVideoActivationStatus: 'waitingForActivateVideo'
        };



        $scope.showVideoElementsAndStartVideoFn = function(localVideoActivationStatus, queryForRemoteVideoElementsEnabled) {

            $scope.videoCameraStatusObject.localVideoActivationStatus = localVideoActivationStatus;

            lxAccessVideoElementsAndAccessCameraService.sendStatusOfVideoElementsEnabled(
                $scope,
                localVideoActivationStatus,
                queryForRemoteVideoElementsEnabled);

            // If this has been called with localVideoElementsEnabled === 'doNotActivateVideo', then the user has either
            // (1) hung-up/stopped the call, or (2) denied to setup video elements. In the case 1, the
            // call must be hung up. In case 2, the call does not need to be hung up, but for simplicity
            // we also hangup the call for this case.
            if (localVideoActivationStatus === 'doNotActivateVideo' || localVideoActivationStatus === 'waitingForActivateVideo') {
//                lxCallService.doHangup();
                lxWebRtcSessionService.stop();
                $scope.videoTypeSignalingObject.localHasSelectedVideoType = 'HD Video';
                $scope.videoTypeSignalingObject.localIsNegotiatingForVideoType = null;
                $scope.videoTypeSignalingObject.localIsSendingVideoType = null;
            }

            else if (localVideoActivationStatus === 'activateVideo') {
                $scope.videoTypeSignalingObject.localIsNegotiatingForVideoType = $scope.videoTypeSignalingObject.localHasSelectedVideoType;
            }

            else {
                $log.error('Unknown localVideoActivationStatus: ' + localVideoActivationStatus);
            }
        };

        $scope.receivedChatMessageObject = {
            messageString: undefined,

           // receivedMessageTime is updated every time the user sends a message - this is necessary because
            // if we just watch receivedMessageString for changes to trigger sending of the message, then the user will not be
            // able to send the same message twice.
            receivedMessageTime: 0
        };

        // ackChatMessageObject holds the acknowledgement that the remote client has received a message that
        // was sent from the local user
        $scope.ackChatMessageObject = {
            ackMessageUniqueId: null
        };


        // The following declarations should only be used inside the lxMainVideoCtrl, however we need to declare them
        // here because information received on the channel needs to be written into these objects.
        $scope.videoTypeSignalingObject = {
            /*
            We currently only modify the video stream transmission to hdVideo if both the local and remote users
            agree to exchange hdVideo. Therefore, it is necessary to do some handshaking before enabling hdVideo.
            The variables in this object keep track of the handshaking and current video transmission status.
             */

            // localHasSelectedVideoType this reflects the value of the video selection button that the user has
            // clicked on. This is used for highlighting the button that the user has currently selected.
            localHasSelectedVideoType: 'HD Video',  // null, 'ASCII Video', 'HD Video'.

            // localIsNegotiatingForVideoType is almost the same as localHasSelectedVideoType and when the user initially
            // presses the videoType button, both values will be set to the same value.
            // However, localIsNegotiatingForVideoType is the value that will
            // be watched for changes and that is monitored throughout the video-type-preference code. The difference between
            // localIsNegotiatingForVideoType and localHasSelectedVideoType is that localIsNegotiatingForVideoType (this
            // variable) will not be updated based on feedback from from the remote user such as rejection of a request,
            // while localHasSelectedVideoType will always be updated to reflect the most up-to-date status of the
            // signaling between the local and remote user. This is necessary to prevent our watchers from executing
            // after receiving a rejection of a request to modify the videoType from a remote client.
            localIsNegotiatingForVideoType: null,

            // localIsSendingVideoType will be updated after the remote user has agreed to exchange the new video type and once
            // the video transmission has started (ie. when lxPeerService.addLocalVideoStream is executed)
            localIsSendingVideoType: null,  // null, 'ASCII Video', 'HD Video'

            localUserAccessCameraAndMicrophoneStatus: 'requestNotMade', // 'requestNotMade', 'waitingForResponse', 'allowAccess', 'denyAccess'


            // if the local user requests the remote user to change the video type, we track the remote response
            // so that we can give the local user feedback.
            // The value will be set in onChannelMessage.
            remoteVideoSignalingStatus: {
                requestAcceptOrDenyVideoType: null,  // will be set to null, 'requestVideoType', 'acceptVideoType', or 'denyVideoType'
                videoType: null      // null, 'ASCII Video', 'HD Video'
            },

             /* remoteIsSendingVideoType: The type of video that is being received from the remote User.
             In the case of hdVideo, this will be updated  once the local user starts to receive a video stream from the remote user
             (ie. when lxPeerService.onRemoteStreamAdded is called). In the case of asciiVideo, this will be updated once
             we have received confirmation from the remote user.
             */
            remoteIsSendingVideoType: null,


            // videoSignalingStatusForUserFeedback indicates what message/status the user should be shown about
            // the current video type requested/allowed/waiting for/etc.
            videoSignalingStatusForUserFeedback: null,

            // The following is a flag that is used for debugging - will over-ride ng-show directives on the video
            // windows to show any window that has this flag on it when it is set to true.
            debugShowAllVideoWindows: true
        };

        $scope.remoteVideoObject = {
            remoteHdVideoElem: undefined, // set in lxVideoElementDirective
            remoteVideoWrapper: undefined, // set in lxHdVideoWrapperDirective
            remoteAsciiVideoElem: undefined // set in lxDrawRemoteAsciiVideoDirective
        };

        $scope.localVideoObject = {
            localHdVideoElem:  undefined,  // set in lxVideoElementDirective
            localVideoWrapper: undefined, // set in lxVideoWrapperDirective
            miniVideoElemInsideRemoteVideoWindow: undefined, //To be set in lxMiniVideoTemplateDirective to .cl-mini-video-element in HD element
            isWebcamMuted: false,
            isMicrophoneMuted: false
        };
    })

    .controller('lxMainVideoCtrl',
    function (
        $scope,
        lxAccessCameraAndMicrophoneService,
        lxCallService,
        lxCheckIfSystemSupportsWebRtcService,
        lxUseChatRoomConstantsService) {

        $scope.accessCameraAndMicrophoneObject = {
            // modalIsShown will contain the templateUrl for each modal that is currently open. Note that while only
            // a single modal should be shown at once, due to the asynchronous callback nature of the .close() function,
            // we cannot guarantee that the current modal is closed before a new one is opened.
            // This variable should be used as follows:
            // accessCameraAndMicrophoneObject.modalsCurrentlyShown[modal-index#] = templateUrl (where template Url is unique
            // for each modal).
            modalsCurrentlyShown: []
        };

        // setLocalVideoType is called directly from the html, and so it must be placed on the $scope.
        $scope.setLocalVideoType = function(localHasSelectedVideoType) {
            // videoType should be 'HD Video' or 'ASCII Video'

            // videoTypeSignalingObject.localHasSelectedVideoType reflects the value of the video selection button that
            // is shown to the user. This value may be changed by the local user pressing on the button, or it may
            // be changed if the local user has requested to exchange a given videoType (ie. HD Video), but the remote user
            // has rejected this request -- in this case, the button will be switched back to its previous value without
            // the local user actually pressing the button.
            $scope.videoTypeSignalingObject.localHasSelectedVideoType = localHasSelectedVideoType;

            // The videoTypeSignalingObject.localIsNegotiatingForVideoType is used for triggering watches that execute
            // when the user switches to a new video type. Note: unlike the above value, this value is set to null
            // if the remote user rejects a request to change the video format. This null value indicates that
            // that inner watch functionality should not execute again, until the value is set to non-null, which
            // only occurs when the local user actually presses the button to select a new videoType.
            $scope.videoTypeSignalingObject.localIsNegotiatingForVideoType = localHasSelectedVideoType;
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

        $scope.toggleAudioMute = function() {
            lxCallService.toggleAudioMute($scope.remoteVideoObject);
        };

        $scope.doHangup = function() {
            lxCallService.doHangup();
        };

        $scope.myUsername = lxUseChatRoomConstantsService.myUsername;
    });