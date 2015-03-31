'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxRemoteVideoElementDirective',
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
                if (!(remoteClientId in scope.remoteVideoObjectsDict)) {
                    e = angular.element('<video class="cl-video-sizing cl-show-hide-fade" autoplay="autoplay"></video>');
                    scope.remoteVideoObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createRemoteVideoObject(e[0]);
                    elem.append(e);
                }
            }
        };
    }
);

videoAppDirectives.directive('lxLocalVideoElementDirective',
    function( )
    {
        return {
            restrict : 'A',
            link: function(scope, elem) {
                var e;
                e = angular.element('<video class="cl-show-hide-fade" autoplay="autoplay" muted="true"></video>');
                scope.localVideoObject.localHdVideoElem = e[0];

                elem.append(e);
            }
        };
    }
);