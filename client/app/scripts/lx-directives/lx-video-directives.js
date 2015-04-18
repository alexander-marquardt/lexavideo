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


videoAppDirectives.directive('lxDisplayRemoteVideoElementDirective',
    function(
        $log,
        lxAdapterService,
        lxPeerService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem, attrs) {
                var e;
                var remoteClientId = attrs.remoteClientId;

                e = angular.element('<video class="cl-video cl-video-sizing" autoplay="autoplay" muted="true"></video>');
                lxAdapterService.attachMediaStream(e[0], lxPeerService.remoteStream[remoteClientId]);
                elem.replaceWith(e);
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


videoAppDirectives.directive('lxDisplayLocalVideoElementDirective',
    function(
        $compile,
        lxAdapterService,
        lxStreamService)
    {
        return {
            restrict : 'A',
            link: function(scope, elem) {


                var e = angular.element('<video class="cl-video cl-video-sizing" autoplay="autoplay" muted="true"></video>');
                lxAdapterService.attachMediaStream(e[0], lxStreamService.localStream);
                elem.replaceWith(e);
            }
        };
    }
);
