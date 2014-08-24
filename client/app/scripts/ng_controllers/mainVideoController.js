/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('mainVideoCtrl', function ($scope, negotiateVideoType) {

        $scope.remoteVideoObject = {
            remoteVideoElem : $('#id-remote-video-element')[0],
            remoteVideoWrapper : $('#id-remote-video-wrapper-div')[0]

        };

        $scope.localVideoObject = {
            localVideoElem :  $('#id-local-video-element')[0],
            localVideoWrapper : $('#id-local-video-wrapper-div')[0],
            miniVideoElemInsideRemoteHd: undefined, //'To be set in miniVideoTemplateDirective',
            miniVideoElemInsideRemoteAscii: undefined, // 'To be set in miniVideoTemplateDirective',
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
            localHasSelectedVideoType : 'asciiVideo',

            // localIsSendingVideoType will be updated after the remote user has agreed to exchange the new video type and once
            // the video transmission has started (ie. when peerService.addLocalVideoStream is executed)
            localIsSendingVideoType : 'asciiVideo',

            localUserAccessCameraAndMicrophoneStatus : 'noResponse', // 'noResponse', 'allowAccess', 'denyAccess'
            remoteUserHasTurnedOnCamera : false,
            remoteUserHasJoinedRoom : false,

            // if the local user requests the remote user to change the video type, we track the remote response
            // so that we can give the local user feedback.
            remoteResponseToLocalRequest: 'noResponse', //  'noResponse', 'denyVideoType' or 'acceptVideoType'

            // remoteHasRequestedVideoType will be changed when the remote user has requested to modify the current video type.
            remoteHasRequestedVideoType : 'asciiVideo',
            /*
             remoteIsSendingVideoType: The type of video that is being received from the remote User. This
             will be updated  once the local user starts to receive a video stream from the remote user (ie. when
             peerService.onRemoteStreamAdded is called)
             */
            remoteIsSendingVideoType : 'asciiVideo'
        };

        $scope.setLocalVideoType = function(localHasSelectedVideoType) {
            // videoType should be 'hdVideo' or 'asciiVideo'
            $scope.videoSignalingObject.localHasSelectedVideoType = localHasSelectedVideoType;
            negotiateVideoType.sendRequestForVideoType(localHasSelectedVideoType);
        };
});
