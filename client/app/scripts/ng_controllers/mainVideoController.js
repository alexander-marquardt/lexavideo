/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('mainVideoCtrl', function ($scope) {
        this.remoteVideoObject = {
            remoteVideoElem : $('#id-remote-video-element')[0],
            remoteVideoWrapper : $('#id-remote-video-wrapper-div')[0]
        };

        $scope.localVideoObject = this.localVideoObject = {
            localVideoElem :  $('#id-local-video-element')[0],
            localVideoWrapper : $('#id-local-video-wrapper-div')[0],
            miniVideoElem: $('#id-mini-video-element')[0],
            isVideoMuted : false,
            isAudioMuted : false,
            videoType : 'hdVideo'
        };




        $scope.setLocalVideoType = function(videoType) {
            // videoType should be 'hdVideo' or 'asciiVideo'
            $scope.localVideoObject.videoType = videoType;

        };
});
