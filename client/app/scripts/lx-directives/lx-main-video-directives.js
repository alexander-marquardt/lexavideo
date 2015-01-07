'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */


videoAppDirectives.directive('lxVideoContainerDirective',
    function($window,
             $log,
             lxChatRoomVarsService,
             lxAdapterService) {


    return {
        restrict : 'A',
        link: function(scope) {

            var remoteVideoObject = scope.remoteVideoObject;
            var localVideoObject = scope.localVideoObject;
            var videoExchangeSettingsObject = scope.videoExchangeSettingsObject;


            var removeMiniVideoElemsSrc = function() {
                $log.debug('removeMiniVideoElemsSrc');
                if (localVideoObject.miniVideoElemInsideRemoteVideoWindow && localVideoObject.miniVideoElemInsideRemoteVideoWindow.src) {
                    lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteVideoWindow , '');
                }
            };

            var enablePrincipalVideoWindows = function() {
                $log.debug('enablePrincipalVideoWindows');
                // if it is a wider screen, then show both windows
                localVideoObject.localVideoWrapper.style.display = 'inline-block';
                remoteVideoObject.remoteVideoWrapper.style.display = 'inline-block';
            };

            var hideMiniVideoElems = function() {
                $log.debug('hideMiniVideoElems');
                if (localVideoObject.miniVideoElemInsideRemoteVideoWindow) {
                    localVideoObject.miniVideoElemInsideRemoteVideoWindow.style.opacity = 0;
                }
                removeMiniVideoElemsSrc();
            };

            var showMiniVideoElems = function() {
                $log.debug('showMiniVideoElems');
                if (localVideoObject.miniVideoElemInsideRemoteVideoWindow) {
                    localVideoObject.miniVideoElemInsideRemoteVideoWindow.style.opacity = 1;
                }
                reattachMediaStreamToMiniVideoElems();
            };

            var reattachMediaStreamToMiniVideoElems = function() {
                $log.debug('reattachMediaStreamToMiniVideoElems');
                if (!localVideoObject.miniVideoElemInsideRemoteVideoWindow) {
                    $log.error('Error: miniVideoElements not set');
                } else {
                    lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteVideoWindow, localVideoObject.localHdVideoElem);
                }
            };


            var setupForCurrentDisplaySize = function() {
                $log.debug('setupForCurrentDisplaySize');


                // the localVideoWrapper and remoteVideoWrapper are set by a directive that
                // sits directly on the wrapper element. This if makes sure that they are initialized
                // before attempting to modify the styles on these elements.
                if (localVideoObject.localVideoWrapper && remoteVideoObject.remoteVideoWrapper) {


                    // Check if this is a XS device, and if so, then embed local video inside the remote.
                    if (viewportSize.getWidth() <= lxChatRoomVarsService.screenXsMax) {

                        // If this is an active HD session on a small screen, then we display the remote video with a local
                        // video embedded inside of a mini-video element.
                        if ( videoExchangeSettingsObject.remoteVideoEnabledSetting === 'enableVideoExchange') {
                            showMiniVideoElems();
                            localVideoObject.localVideoWrapper.style.display = 'none';
                            remoteVideoObject.remoteVideoWrapper.style.display = 'inline-block';

                            // The following line is necessary or else Firefox video will freeze after detaching the
                            // and re-attaching the video element.
                            reattachMediaStreamToMiniVideoElems();

                        } else {
                            // XS screen without a remote signal, therefore we should show the local video and hide the remote video
                            localVideoObject.localVideoWrapper.style.display = 'inline-block';
                            remoteVideoObject.remoteVideoWrapper.style.display = 'none';
                            hideMiniVideoElems();
                        }
                    }

                    // This is not an XS device - this is a normal display
                    else {
                        enablePrincipalVideoWindows();
                        hideMiniVideoElems();
                    }
                }
            };
/*
            scope.enterFullScreen = function () {
                // This will probably fail on non-Chrome browsers -- investigate if extra code is needed.
                elem[0].webkitRequestFullScreen();
            };*/




            scope.$watch('videoExchangeSettingsObject.remoteVideoEnabledSetting', function(newRemoteActivationStatus, oldRemoteActivationStatus) {
                // the remoteVideo videoType has changed, which means that a new remote video window has been activated.
                // We need to make sure that correct windows aer enabled for the current videoType..
                $log.info('Remote remoteVideoEnabledSetting is now: ' + newRemoteActivationStatus + ' Old value was: ' + oldRemoteActivationStatus);
                setupForCurrentDisplaySize();
            });

            $(window).resize(function() {
                // calling jquery window.resize instead of angular watching for resize on the $window service should be slightly
                // more efficient.
                setupForCurrentDisplaySize();
            });
        }
    };
});

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

                    // Watch to see if the remote video is not transmitting, and if it stops then hide the video element.
                    // This is done so that the user will not see a frozen image from the last frame tha the remote user
                    // transmitted.
                    // Note, we check videoSignalingStatusForUserFeedback because it will only be null when
                    // video transmission has begun.
                    scope.$watch('videoSignalingObject.videoSignalingStatusForUserFeedback', function(videoSignalingStatusForUserFeedback) {
                        if (videoSignalingStatusForUserFeedback !== null) {
                            // remote is not transmitting, so hide the video element
                            e.addClass('cl-hide');
                        } else {
                            e.removeClass('cl-hide');
                        }
                    });
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
