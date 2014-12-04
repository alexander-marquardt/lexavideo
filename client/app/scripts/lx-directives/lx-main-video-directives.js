'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */


videoAppDirectives.directive('lxVideoContainerDirective',
    function($window,
             $log,
             lxUseChatRoomVarsService,
             lxUseChatRoomConstantsService,
             lxAdapterService) {


    return {
        restrict : 'A',
        link: function(scope, elem) {

            var remoteVideoObject = scope.remoteVideoObject;
            var localVideoObject = scope.localVideoObject;
            var videoTypeSignalingObject = scope.videoTypeSignalingObject;
            var videoCameraStatusObject = scope.videoCameraStatusObject;

            var $miniVideoDiv = angular.element(elem).find('#id-mini-video-div');

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
                    if (videoCameraStatusObject.remoteVideoActivationStatus === 'activateVideo') {
                        lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteVideoWindow, localVideoObject.localHdVideoElem);
                    }
                }
            };


            var setupForCurrentDisplaySize = function() {
                $log.debug('setupForCurrentDisplaySize');


                // the localVideoWrapper and remoteVideoWrapper are set by a directive that
                // sits directly on the wrapper element. This if makes sure that they are initialized
                // before attempting to modify the styles on these elements.
                if (localVideoObject.localVideoWrapper && remoteVideoObject.remoteVideoWrapper) {


                    // Check if this is a XS device, and if so, then embed local video inside the remote.
                    if (viewportSize.getWidth() <= lxUseChatRoomVarsService.screenXsMax) {

                        // If this is an active HD session on a small screen, then we display the remote video with a local
                        // video embedded inside of a mini-video element.
                        if ( videoCameraStatusObject.remoteVideoActivationStatus === 'activateVideo') {
                            showMiniVideoElems();
                            localVideoObject.localVideoWrapper.style.display = 'none';
                            remoteVideoObject.remoteVideoWrapper.style.display = 'inline-block';

//                            // attach the mini-video window to the HD Video wrapper
                            var miniVideoDiv = $miniVideoDiv.detach();
                            angular.element(remoteVideoObject.remoteHdVideoElem).parent().prepend(miniVideoDiv);

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




            scope.$watch('videoCameraStatusObject.remoteVideoActivationStatus', function(newRemoteActivationStatus, oldRemoteActivationStatus) {
                // the remoteVideo videoType has changed, which means that a new remote video window has been activated.
                // We need to make sure that correct windows aer enabled for the current videoType..
                $log.info('Remote remoteVideoActivationStatus is now: ' + newRemoteActivationStatus + ' Old value was: ' + oldRemoteActivationStatus);
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
        $log
        )
    {
        return {
            restrict : 'A',
            link: function(scope, elem, attrs) {
                var e;

                if (attrs.videoWindow === 'local' ) {
                    e = angular.element('<video class="cl-video-sizing" autoplay="autoplay" muted="true"></video>');
                    scope.localVideoObject.localHdVideoElem = e[0];
                }
                else if (attrs.videoWindow === 'remote' ) {
                    e = angular.element('<video class="cl-video-sizing" autoplay="autoplay"></video>');
                    scope.remoteVideoObject.remoteHdVideoElem = e[0];

                    // Watch to see if the remote video is not transmitting, and if it stops then hide the video element.
                    // This is done so that the user will not see a frozen image from the last frame tha the remote user
                    // transmitted.
                    scope.$watch('videoCameraStatusObject.remoteVideoActivationStatus', function(remoteVideoActivationStatus) {
                        if (remoteVideoActivationStatus !== 'activateVideo') {
                            // remote is not transmitting, so hide the video element
                            e.addClass('cl-transparent');
                        } else {
                            e.removeClass('cl-transparent');
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
            }
            else {
                $log.error('Attribute must be "local" or "remote"');
            }
        }
    };
});

videoAppDirectives.directive('lxMiniVideoTemplateDirective',
    function() {
        return {
            restrict : 'A',
            templateUrl: 'lx-template-cache/mini-video-template.html',
            link: function(scope, elem) {
                scope.localVideoObject.miniVideoElemInsideRemoteVideoWindow = angular.element(elem).find('.cl-mini-video-element')[0];
            }
        };
    });

