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

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxShowMiniVideoElementDirective',
    function(
        $compile,
        lxAdapterService,
        lxVideoElems
        )
    {
        return {
            restrict : 'A',
            transclude: true,
            template: '<div ng-transclude></div>',
            link: function(scope, elem) {

                var clientId = scope.clientId;

                if (clientId === 'localVideoElement') {
                    elem.append(lxVideoElems.localVideoObject.localMiniVideoElem);
                    lxAdapterService.reattachMediaStream(lxVideoElems.localVideoObject.localMiniVideoElem, lxVideoElems.localVideoObject.localMiniVideoElem);
                }
                // otherwise this is a remote video element.
                else {
                    var remoteVideoObject = lxVideoElems.remoteVideoElementsDict[clientId];
                    elem.append(remoteVideoObject.remoteMiniVideoElem);
                    lxAdapterService.reattachMediaStream(remoteVideoObject.remoteMiniVideoElem, remoteVideoObject.remoteMiniVideoElem);
                }
            }
        };
    }
);


videoAppDirectives.directive('lxMainVideoElementDirective',
    function(
        lxAdapterService,
        lxPeerService,
        lxStreamService,
        lxVideoElems
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {
                var html = '<video class="cl-video cl-video-sizing" autoplay="autoplay" muted="true"></video>';
                var videoElem = angular.element(html);
                var domVideoElem = videoElem[0];
                elem.append(videoElem);

                scope.$watch(
                    function() {
                        var videoStreamActive;
                        var selectedVideoElementClientId = scope.videoDisplaySelection.currentlySelectedVideoElementClientId;
                        if (selectedVideoElementClientId === 'localVideoElement') {
                            videoStreamActive = !!lxStreamService.localStream;
                        }
                        else {
                            videoStreamActive = !!lxPeerService.remoteStream[selectedVideoElementClientId];
                        }
                        return selectedVideoElementClientId + videoStreamActive.toString();
                    },

                    function() {
                        var selectedVideoElementClientId = scope.videoDisplaySelection.currentlySelectedVideoElementClientId;

                        if (selectedVideoElementClientId === 'localVideoElement') {
                            lxAdapterService.reattachMediaStream(domVideoElem, lxVideoElems.localVideoObject.localMiniVideoElem);
                        } else {
                            var remoteVideoObject = lxVideoElems.remoteVideoElementsDict[selectedVideoElementClientId];
                            lxAdapterService.reattachMediaStream(domVideoElem, remoteVideoObject.remoteMiniVideoElem);
                        }
                    }
                );
            }
        };
    }
);





