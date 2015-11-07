/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/

'use strict';
angular.module('LxVideo.controllers', [])

.controller('LxVideoMainController',
    function(
        $scope,
        lxPeerService,
        lxStreamService
        ) {

        $scope.$watch(function() {
            return !!lxPeerService.remoteStream[$scope.videoDisplaySelection.currentlySelectedVideoElementClientId];
        }, function(newVal) {
            $scope.remoteStreamIsActive = newVal;
        });
        $scope.$watch(lxStreamService.getLocalStreamBoolean, function(newVal) {
            $scope.localStreamIsActive = newVal;
        });
    })

.controller('LxMiniVideoRepeatController', function(
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
                outerList.push(innerList);
            }

            $scope.miniVideoElementsWrappedForRepeat = outerList;
        }

        $scope.$watch(function(){
            return $scope.videoStateInfoObject.currentOpenVideoSessionsList.length;
        }, updateMiniVideoElementsWrappedForRepeat);
    });


