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
            requestedVideoType : 'asciiVideo', // Will be updated when the other user has requested to modify the current video type
            receivingVideoType : 'asciiVideo'  // Will be updated once the local user has agreed to modify the current video type and once
                                               // the video exchange for the new format is correctly setup and running.

        };

        $scope.localVideoObject = {
            localVideoElem :  $('#id-local-video-element')[0],
            localVideoWrapper : $('#id-local-video-wrapper-div')[0],
            miniVideoElemInsideRemoteHd: undefined, //'To be set in miniVideoTemplateDirective',
            miniVideoElemInsideRemoteAscii: undefined, // 'To be set in miniVideoTemplateDirective',
            isVideoMuted : false,
            isAudioMuted : false,
            selectedVideoType : 'asciiVideo', // this is determined by the video selection button that is currently selected
            sendingVideoType : 'asciiVideo'   // will be updated once the remote user has agreed to modify the current video type and once
                                              // the video exchange for the new format is correctly setup and running.
        };

        $scope.setLocalVideoType = function(selectedVideoType) {
            // videoType should be 'hdVideo' or 'asciiVideo'
            $scope.localVideoObject.selectedVideoType = selectedVideoType;
            negotiateVideoType.sendRequestForVideoType(selectedVideoType);
        };
});
