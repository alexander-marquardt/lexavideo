'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings

videoAppDirectives.directive('lxVideoElementDirective',
    function(
        $log,
        lxCallService
        )
    {
        return {
            restrict : 'A',
            link: function(scope, elem, attrs) {
                var e;

                if (attrs.videoWindow === 'local' ) {
                    e = angular.element('<video class="cl-video-sizing cl-show-hide-fade" autoplay="autoplay" muted="true"></video>');
                    scope.localVideoObject.localHdVideoElem = e[0];
                }
                else if (attrs.videoWindow === 'remote' ) {
                    e = angular.element('<video class="cl-video-sizing cl-show-hide-fade" autoplay="autoplay"></video>');
                    scope.remoteVideoObject.remoteHdVideoElem = e[0];

                    // each time that this function is executed, a new pointer to the remoteHdVideoElem is obtained,
                    // and the previous "muted" value is lost - therefore we reset it here.
                    lxCallService.setAudioMute(scope.remoteVideoObject, scope.remoteVideoObject.isAudioMuted);
                }
                else {
                    $log.error('Attribute must be "local" or "remote"');
                }
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

                var clMiniVideoElem = angular.element(elem).find('.cl-mini-video-element');
                scope.localVideoObject.miniVideoElemInsideRemoteVideoWindow = clMiniVideoElem[0];

            }
            else {
                $log.error('Attribute must be "local" or "remote"');
            }
        }
    };
});
