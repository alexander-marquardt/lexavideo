/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('mainVideoCtrl', function ($scope) {
        this.remoteVideoObject = {
            remoteVideoElem : $('#remote-video-element')[0]
        };

        this.localVideoObject = {
            isVideoMuted : false,
            isAudioMuted : false
        };

        $scope.asciiVideoObject = {
            compressedVideoFrame : null,
            videoFrameUpdated : false
        };
});
