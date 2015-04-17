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
                if (!(remoteClientId in scope.remoteHdVideoElementsDict)) {
                    e = angular.element('<video class="cl-video cl-video-sizing cl-show-hide-fade" autoplay="autoplay"></video>');
                    scope.remoteHdVideoElementsDict[remoteClientId] = lxCreateChatRoomObjectsService.createRemoteVideoElementsObject(e[0]);
                    elem.append(e);
                }
            }
        };
    }
);

videoAppDirectives.directive('lxRemoteSmallVideoElementDirective',
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
                if (!(remoteClientId in scope.remoteHdVideoElementsDict)) {
                    e = angular.element('<video class="cl-video cl-video-sizing cl-show-hide-fade" autoplay="autoplay"></video>');
                    scope.remoteSmallVideoElementsDict[remoteClientId] = e[0];
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
                e = angular.element('<video class="cl-video cl-show-hide-fade" autoplay="autoplay" muted="true"></video>');
                scope.localVideoObject.localHdVideoElem = e[0];

                elem.append(e);
            }
        };
    }
);


videoAppDirectives.directive('lxLocalSmallVideoElementDirective',
    function( )
    {
        return {
            restrict : 'A',
            link: function(scope, elem) {
                var e;
                e = angular.element('<video class="cl-video cl-show-hide-fade" autoplay="autoplay" muted="true"></video>');
                scope.localVideoObject.localSmallVideoElem = e[0];

                elem.append(e);
            }
        };
    }
);