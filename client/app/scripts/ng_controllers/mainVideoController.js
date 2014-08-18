/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('mainVideoCtrl', function ($scope, $log, messageService) {
        
        $scope.remoteVideoObject = this.remoteVideoObject = {
            remoteVideoElem : $('#id-remote-video-element')[0],
            remoteVideoWrapper : $('#id-remote-video-wrapper-div')[0],
            videoType : 'asciiVideo'
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

            if (videoType === 'asciiVideo') {
                messageService.sendMessage('videoStatus', {statusType: 'asciiVideoStatus', streamStatus: 'transmitting'});
                messageService.sendMessage('videoStatus', {statusType: 'hdVideoStatus', streamStatus: 'stopped'});
            }
            else if (videoType === 'hdVideo'){
                messageService.sendMessage('videoStatus', {statusType: 'hdVideoStatus', streamStatus: 'transmitting'});
                messageService.sendMessage('videoStatus', {statusType: 'asciiVideoStatus', streamStatus: 'stopped'});
            } else {
                $log.log('Error: unknown video type received: ' + videoType);
            }
        };
});
