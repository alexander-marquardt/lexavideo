/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('lxMainVideoCtrl', function ($scope, negotiateVideoType) {

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
            localHasSelectedVideoType : 'unsetVideo',  // 'unsetVideo', 'asciiVideo', 'hdVideo'

            // localIsSendingVideoType will be updated after the remote user has agreed to exchange the new video type and once
            // the video transmission has started (ie. when peerService.addLocalVideoStream is executed)
            localIsSendingVideoType : 'unsetVideo',  // 'unsetVideo', 'asciiVideo', 'hdVideo'

            localUserAccessCameraAndMicrophoneStatus : 'requestNotMade', // 'requestNotMade', 'waitingForResponse', 'allowAccess', 'denyAccess'
            remoteUserHasTurnedOnCamera : false,
            remoteUserHasJoinedRoom : false,

            // if the local user requests the remote user to change the video type, we track the remote response
            // so that we can give the local user feedback.
            remoteResponseToLocalRequest: 'requestNotMade', //  'requestNotMade', 'waitingForResponse', 'denyVideoType' or 'acceptVideoType'

            // remoteHasRequestedVideoType will be changed when the remote user has requested to modify the current video type.
            remoteHasRequestedVideoType : 'unsetVideo',  // 'unsetVideo', 'asciiVideo', 'hdVideo'
            /*
             remoteIsSendingVideoType: The type of video that is being received from the remote User. This
             will be updated  once the local user starts to receive a video stream from the remote user (ie. when
             peerService.onRemoteStreamAdded is called)
             */
            remoteIsSendingVideoType : 'unsetVideo'
        };

        $scope.setLocalVideoType = function(localHasSelectedVideoType) {
            // videoType should be 'hdVideo' or 'asciiVideo'
            $scope.videoSignalingObject.localHasSelectedVideoType = localHasSelectedVideoType;
            negotiateVideoType.sendRequestForVideoType(localHasSelectedVideoType);
        };
});
