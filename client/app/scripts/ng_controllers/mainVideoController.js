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



        $scope.activeDivs = {
            showLocalHdVideo : true,
            showLocalAsciiVideo : false
        };

        // TODO - combine these booleans into a string that indicates current video to show.
        $scope.localHdVideoOn = function() {
            $scope.activeDivs.showLocalHdVideo = true;
            $scope.activeDivs.showLocalAsciiVideo = false;
        };

        $scope.localAsciiVideoOn = function() {
            $scope.activeDivs.showLocalHdVideo = false;
            $scope.activeDivs.showLocalAsciiVideo = true;
        };
});
