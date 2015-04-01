


angular.module('lxDebuggingInfo.controllers', [])

    .controller('lxDebuggingRemoteStreamController', function(
        $scope,
        lxPeerService
        )
    {

        function getRemoteStreamBoolean() {
            return !!lxPeerService.remoteStream[$scope.remoteClientId];
        }
        $scope.$watch(getRemoteStreamBoolean, function(newVal) {
            $scope.remoteStreamActive = newVal;
        })
    });
