/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('mainVideoCtrl', function () {
        this.remoteVideoObject = {
            remoteVideoDiv : $('#remote-video')[0]
        };

        this.localVideoObject = {
            videoTracks: null,
            isVideoMuted : false,
            isAudioMuted : false
        };
});
