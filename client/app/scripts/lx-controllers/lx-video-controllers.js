'use strict';
angular.module('lxVideo.controllers', [])

.controller('lxMainVideoWrapperCtrl',
    function(
        $scope,
        lxPeerService,
        lxStreamService
        ) {

        $scope.$watch(function() {
            return !!lxPeerService.remoteStream[$scope.videoDisplaySelection.currentlySelectedVideoElementId];
        }, function(newVal) {
            $scope.remoteStreamIsActive = newVal;
        });
        $scope.$watch(lxStreamService.getLocalStreamBoolean, function(newVal) {
            $scope.localStreamIsActive = newVal;
        });
    })

.controller('lxMiniVideoRepeatWrapper', function(
        $scope
        ) {

        function updateMiniVideoElementsWrappedForRepeat() {
            var maxNumMiniVideoElementsToShow = 3;
            var arrayOfMiniVideoElementsIdentifiers = ['localVideoElement'].concat($scope.videoStateInfoObject.currentOpenVideoSessionsList);
            var outerList = [];
            for (var i = 0; i < arrayOfMiniVideoElementsIdentifiers.length; i += maxNumMiniVideoElementsToShow) {
                var innerList = [];
                for (var j = 0; j < maxNumMiniVideoElementsToShow; j++) {
                    var idx = i + j;
                    if (arrayOfMiniVideoElementsIdentifiers[idx] !== undefined) {
                        innerList.push(arrayOfMiniVideoElementsIdentifiers[idx]);
                    }
                    else {
                        break;
                    }
                }
                outerList.push(innerList)
            }

            $scope.miniVideoElementsWrappedForRepeat = outerList;
        }

        $scope.$watch(function(){
            return $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;
        }, updateMiniVideoElementsWrappedForRepeat);
    });


