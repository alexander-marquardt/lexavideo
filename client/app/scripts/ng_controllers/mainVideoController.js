/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

angular.module('videoApp')
    .controller('mainVideoCtrl', function ($scope) {
        $scope.remoteVideoObject = {
            remoteVideoDiv : $('#remote-video')[0],
            videoTracks: null
        };

        $scope.color = {col: '#333'};

});
