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
            remoteVideoWrapper : $('#id-remote-video-wrapper-div')[0],
            requestedVideoType : 'asciiVideo', // Will be changed when the remote user has requested to modify the current video type.
            receivingVideoType : 'asciiVideo'  // The type of video that is being received from the remote User. This
                                               // will be updated after the local user has agreed to accept the new video type and once
                                               // the local user starts to receive a video stream from the remote user (ie. when
                                               // peerService.onRemoteStreamAdded is called)
        };

        $scope.localVideoObject = {
            localVideoElem :  $('#id-local-video-element')[0],
            localVideoWrapper : $('#id-local-video-wrapper-div')[0],
            miniVideoElemInsideRemoteHd: undefined, //'To be set in miniVideoTemplateDirective',
            miniVideoElemInsideRemoteAscii: undefined, // 'To be set in miniVideoTemplateDirective',
            isVideoMuted : false,
            isAudioMuted : false,
            selectedVideoType : 'asciiVideo', // this reflects the value of the video selection button that is currently selected
            sendingVideoType : 'asciiVideo'   // will be updated after the remote user has agreed to exchange the new video type and once
                                              // the video transmission has started (ie. when peerService.addLocalVideoStream is executed)
        };

        $scope.setLocalVideoType = function(selectedVideoType) {
            // videoType should be 'hdVideo' or 'asciiVideo'
            $scope.localVideoObject.selectedVideoType = selectedVideoType;
            negotiateVideoType.sendRequestForVideoType(selectedVideoType);
        };
});
