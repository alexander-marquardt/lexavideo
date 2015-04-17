'use strict';
angular.module('lxVideo.controllers', [])

.controller('lxRemoteVideoWrapperCtrl',
    function(
        $scope,
        lxPeerService
        ) {

        $scope.$watch(function() {
            return !!lxPeerService.remoteStream[$scope.remoteClientId];
        }, function(newVal) {
            $scope.remoteStreamIsActive = newVal;
        });

    })

.controller('lxLocalVideoWrapperCtrl',
    function(
        $scope,
        lxStreamService
        ) {

        $scope.$watch(lxStreamService.getLocalStreamBoolean, function(newVal) {
            $scope.localStreamIsActive = newVal;
        });
    });