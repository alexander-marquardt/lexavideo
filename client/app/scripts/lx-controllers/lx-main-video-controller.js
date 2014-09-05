/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('lxMainVideoCtrl', function ($scope, negotiateVideoType, serverConstantsService) {

        $scope.accessCameraAndMicrophoneObject = {
            // modalIsShown will contain the templateUrl for each modal that is currently open. Note that while only
            // a single modal should be shown at once, due to the asynchronous callback nature of the .close() function,
            // we cannot guarantee that the current modal is closed before a new one is opened.
            // This variable should be used as follows:
            // accessCameraAndMicrophoneObject.modalsCurrentlyShown[modal-index#] = templateUrl (where template Url is unique
            // for each modal).
            modalsCurrentlyShown : []
        };

        $scope.remoteVideoObject = {
            remoteVideoElem : $('#id-remote-video-element')[0],
            remoteVideoWrapper : $('#id-remote-video-wrapper-div')[0]

        };

        $scope.localVideoObject = {
            localVideoElem :  $('#id-local-video-element')[0],
            localVideoWrapper : $('#id-local-video-wrapper-div')[0],
            miniVideoElemInsideRemoteHd: undefined, //'To be set in miniVideoTemplateDirective' to .cl-mini-video-element in HD element
            miniVideoElemInsideRemoteAscii: undefined, // 'To be set in miniVideoTemplateDirective' to .cl-mini-video-element in Ascii element
            isVideoMuted : false,
            isAudioMuted : false
        };

        $scope.videoSignalingObject = {
            /*
            We currently only modify the video stream transmission to hdVideo if both the local and remote users
            agree to exchange hdVideo. Therefore, it is necessary to do some handshaking before enabling hdVideo.
            The variables in this object keep track of the handshaking and current video transmission status.
             */

            // localHasSelectedVideoType this reflects the value of the video selection button that is currently selected
            localHasSelectedVideoType : null,  // 'null, 'asciiVideo', 'hdVideo'

            // localIsSendingVideoType will be updated after the remote user has agreed to exchange the new video type and once
            // the video transmission has started (ie. when peerService.addLocalVideoStream is executed)
            // However, in the special case that the user has set 'localHasSelectedVideoType' to ascii, then we immediately
            // set the value of localIsSendingVideoType to 'asciiVideo'.
            localIsSendingVideoType : null,  // null, 'asciiVideo', 'hdVideo'

            localUserAccessCameraAndMicrophoneStatus : 'requestNotMade', // 'requestNotMade', 'waitingForResponse', 'allowAccess', 'denyAccess'
            remoteUserHasTurnedOnCamera : false,
            remoteUserHasJoinedRoom : false,

            // if the local user requests the remote user to change the video type, we track the remote response
            // so that we can give the local user feedback.


            remoteVideoSignalingStatus : {
                settingsType: null,  // will be set to null, 'requestVideoType', 'acceptVideoType', or 'denyVideoType'
                videoType: null      // null, 'asciiVideo', 'hdVideo'
            },

             /* remoteIsSendingVideoType: The type of video that is being received from the remote User.
             In the case of hdVideo, this will be updated  once the local user starts to receive a video stream from the remote user
             (ie. when peerService.onRemoteStreamAdded is called). In the case of asciiVideo, this will be updated once
             we have received confirmation from the remote user.
             */
            remoteIsSendingVideoType : null,


            // videoSignalingStatusForUserFeedback indicates what message/status the user should be shown about
            // the current video type requested/allowed/waiting for/etc.
            videoSignalingStatusForUserFeedback : null

        };

        $scope.setLocalVideoType = function(localHasSelectedVideoType) {
            // videoType should be 'hdVideo' or 'asciiVideo'
            $scope.videoSignalingObject.localHasSelectedVideoType = localHasSelectedVideoType;
        };

        $scope.myUsername = serverConstantsService.myUsername;
        $scope.debugBuildEnabled = serverConstantsService.debugBuildEnabled;
    })
    .controller('lxVideoNegotiationCtrl', function ($scope, lxVideoSettingsNegotiationService) {
        // This controller is used for wrapping around the lxVideoSettingsNegotiationDirective which may appear
        // in several locations. By wrapping these invocations, we allow common code that is used by multiple
        // copies of the directive to be easily invoked only a single time.
        lxVideoSettingsNegotiationService.watchForVideoSettingsChanges ($scope);
    });