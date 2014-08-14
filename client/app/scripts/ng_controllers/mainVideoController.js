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
            remoteVideoWrapper : $('#id-remote-video-wrapper-div')[0],

            // miniVideoElem is (somewhat arbitrarily) placed inside remoteVideoObject because it is
            // physically embedded in the remote video in the html.
            // The miniVideoElem will be used for showing local video on xs displays.
            miniVideoElem: $('#id-mini-video-element')[0]


        };

        this.localVideoObject = {
            localVideoElem :  $('#id-local-video-element')[0],
            localVideoWrapper : $('#id-local-video-wrapper-div')[0],
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
