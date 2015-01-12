'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings

videoAppDirectives.directive('lxLocalVideoElementDirective',
    function( )
    {
        return {
            restrict : 'A',
            link: function(scope, elem) {
                var e;
                e = angular.element('<video class="cl-video-sizing cl-show-hide-fade" autoplay="autoplay" muted="true"></video>');
                scope.localVideoObject.localHdVideoElem = e[0];

                elem.append(e);
            }
        };
    }
);

videoAppDirectives.directive('lxRemoteVideoElementDirective',
    function(
        lxCallService
        )
    {
        return {
            restrict : 'A',
            link: function(scope, elem) {
                var e;

                e = angular.element('<video class="cl-video-sizing cl-show-hide-fade" autoplay="autoplay"></video>');
                scope.remoteVideoObject.remoteHdVideoElem = e[0];

                // each time that this function is executed, a new pointer to the remoteHdVideoElem is obtained,
                // and the previous "muted" value is lost - therefore we reset it here.
                lxCallService.setAudioMute(scope.remoteVideoObject, scope.remoteVideoObject.isAudioMuted);

                elem.append(e);
            }
        };
    }
);

videoAppDirectives.directive('lxVideoWrapperDirective', function($log) {
    return {
        restrict : 'A',
        link: function(scope, elem, attrs) {
            if (attrs.videoWindow === 'local' ) {
                scope.localVideoObject.localVideoWrapper = elem[0];
            }
            else if (attrs.videoWindow === 'remote' ) {
                scope.remoteVideoObject.remoteVideoWrapper = elem[0];
            }
            else {
                $log.error('Attribute must be "local" or "remote"');
            }
        }
    };
});
