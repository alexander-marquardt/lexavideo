'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxMiniVideoElementDirective',
    function(
        $log,
        lxCallService,
        lxCreateChatRoomObjectsService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem, attrs) {
                var e;
                var clientId = attrs.lxMiniVideoElementDirective;

                if (clientId !== 'localVideoElement') {
                    // only create the video element if it doesn't already exist.
                    if (!(clientId in scope.remoteMiniVideoElementsDict)) {
                        e = angular.element('<video class="cl-video cl-mini-video-sizing" autoplay="autoplay"></video>');
                        scope.remoteMiniVideoElementsDict[clientId] = lxCreateChatRoomObjectsService.createRemoteVideoElementsObject(e[0]);
                        elem.append(e);
                    }
                }

                // Else, this is the local video element
                else {
                    if (!scope.localVideoObject.localSmallVideoElem) {
                        e = angular.element('<video class="cl-video cl-mini-video-sizing" autoplay="autoplay" muted="true"></video>');
                        scope.localVideoObject.localSmallVideoElem = e[0];
                        elem.append(e);
                    }
                }
            }
        };
    }
);


videoAppDirectives.directive('lxDisplayVideoElementDirective',
    function(
        $log,
        lxAdapterService,
        lxPeerService,
        lxStreamService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem, attrs) {

                scope.$watch(function() {
                    return attrs.selectedVideoElement;
                }, function() {
                    var e;
                    var selectedVideoElement = attrs.selectedVideoElement;

                    elem.empty();

                    e = angular.element('<video class="cl-video cl-video-sizing" autoplay="autoplay" muted="true"></video>');
                    if (selectedVideoElement !== 'localVideoElement') {
                        lxAdapterService.attachMediaStream(e[0], lxPeerService.remoteStream[selectedVideoElement]);
                        elem.append(e);
                    }
                    else {
                        lxAdapterService.attachMediaStream(e[0], lxStreamService.localStream);
                        elem.append(e);
                    }
                });
            }
        };
    }
);





