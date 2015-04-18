'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxRemoteMiniVideoElementDirective',
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
                var remoteClientId = attrs.remoteClientId;

                // only
                if (!(remoteClientId in scope.remoteMiniVideoElementsDict)) {
                    e = angular.element('<video class="cl-video" autoplay="autoplay"></video>');
                    scope.remoteMiniVideoElementsDict[remoteClientId] = lxCreateChatRoomObjectsService.createRemoteVideoElementsObject(e[0]);
                    elem.append(e);
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
                    return attrs.selectedVideoElement
                }, function() {
                    var e;
                    var selectedVideoElement = attrs.selectedVideoElement;

                    elem.empty();

                    e = angular.element('<video class="cl-video cl-video-sizing" autoplay="autoplay" muted="true"></video>');
                    if (selectedVideoElement !== 'localVideoIsSelected') {
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




videoAppDirectives.directive('lxLocalMiniVideoElementDirective',
    function( )
    {
        return {
            restrict : 'A',
            link: function(scope, elem) {
                var e;
                e = angular.element('<video class="cl-video" autoplay="autoplay" muted="true"></video>');
                scope.localVideoObject.localSmallVideoElem = e[0];

                elem.append(e);
            }
        };
    }
);
