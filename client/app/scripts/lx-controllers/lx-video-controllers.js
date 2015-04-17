'use strict';
angular.module('lxVideo.controllers', [])

.controller('lxVideoWrapperCtrl',
    function(
        $scope,
        lxPeerService
        ) {

        $scope.videoExchangeDisplayOverlayTrackerObject = {
            currentlyShown: false
        };

        $scope.$watch(function() {
            return !!lxPeerService.remoteStream[$scope.remoteClientId];
        }, function(newVal) {
            $scope.remoteStreamActive = newVal;
        });

    });

