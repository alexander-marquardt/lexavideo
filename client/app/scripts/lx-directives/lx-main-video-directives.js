'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */




videoAppDirectives.directive('lxMonitorControlKeysDirective', function ($document, $log, lxCallService) {


    return {
        restrict : 'A',
        link: function(scope) {

            // Mac: hotkey is Command.
            // Non-Mac: hotkey is Control.
            // <hotkey>-D: toggle audio mute.
            // <hotkey>-E: toggle video mute.
            // <hotkey>-I: toggle Info box.
            // Return false to screen out original Chrome shortcuts.
            $document.on('keydown', function(event) {
                $log.log('Key pressed ' + event.keyCode);
                var hotkey = event.ctrlKey;
                if (navigator.appVersion.indexOf('Mac') !== -1) {
                    hotkey = event.metaKey;
                }
                if (!hotkey) {
                    return;
                }
                switch (event.keyCode) {
                    case 68:
                        lxCallService.setMicrophoneMute(scope.localVideoObject, !scope.localVideoObject.isMicrophoneMuted);
                        return false;
                    case 69:
                        lxCallService.setWebcamMute(scope.localVideoObject, !scope.localVideoObject.isWebcamMuted);
                        return false;
                    default:
                        return;
                }
            });
        }
    };
});


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
            var videoSignalingObject = scope.videoSignalingObject;

            var $miniVideoDiv = angular.element(elem).find('#id-mini-video-div');

            var removeMiniVideoElemsSrc = function() {
                $log.debug('removeMiniVideoElemsSrc');
                if (localVideoObject.miniVideoElemInsideRemoteVideoWindow && localVideoObject.miniVideoElemInsideRemoteVideoWindow.src) {
                    lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteVideoWindow.src , '');
                }
            };

            var enablePrincipalVideoWindows = function() {
                $log.debug('enablePrincipalVideoWindows');
                // if it is a wider screen, then show both windows
                localVideoObject.localHdVideoWrapper.style.display = 'inline-block';
                remoteVideoObject.remoteHdVideoWrapper.style.display = 'inline-block';
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
                    if (videoSignalingObject.remoteIsSendingVideoType !== null) {
                        lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteVideoWindow, localVideoObject.localHdVideoElem);
                    }

                    else  {
                        $log.warn('Warning: cannot attach media stream when remoteIsSendingVideoType is null');
                    }
                }
            };


            var setupForCurrentDisplaySize = function() {
                $log.debug('setupForCurrentDisplaySize');


                // the localHdVideoWrapper and remoteHdVideoWrapper are set by a directive that
                // sits directly on the wrapper element. This if makes sure that they are initialized
                // before attempting to modify the styles on these elements.
                if (localVideoObject.localHdVideoWrapper && remoteVideoObject.remoteHdVideoWrapper) {


                    // Check if this is a XS device, and if so, then embed local video inside the remote.
                    if (viewportSize.getWidth() <= lxUseChatRoomVarsService.screenXsMax) {

                        // If this is an active HD session on a small screen, then we display the remote video with a local
                        // video embedded inside of a mini-video element. Alternatively, if the remote user is sending
                        // ASCII video, then we show the local video embedded inside of the ASCII video element.
                        if ( videoSignalingObject.remoteIsSendingVideoType !== null) {
                            showMiniVideoElems();
                            localVideoObject.localHdVideoWrapper.style.display = 'none';
                            remoteVideoObject.remoteHdVideoWrapper.style.display = 'inline-block';

//                            // attach the mini-video window to the HD Video wrapper
                            var miniVideoDiv = $miniVideoDiv.detach();
                            if ( videoSignalingObject.remoteIsSendingVideoType === 'HD Video') {
                                angular.element(remoteVideoObject.remoteHdVideoElem).parent().prepend(miniVideoDiv);
                            }
                            else if (videoSignalingObject.remoteIsSendingVideoType === 'ASCII Video') {
                                angular.element(remoteVideoObject.remoteAsciiVideoElem).parent().prepend(miniVideoDiv);
                            }
                            else {
                                throw new Error('Unknown videoype: ' + videoSignalingObject.remoteIsSendingVideoType);
                            }
                            // The following line is necessary or else Firefox video will freeze after detaching the
                            // and re-attaching the video element.
                            reattachMediaStreamToMiniVideoElems();

                        } else {
                            // XS screen without a remote signal, therefore we should show the local video and hide the remote video
                            localVideoObject.localHdVideoWrapper.style.display = 'inline-block';
                            remoteVideoObject.remoteHdVideoWrapper.style.display = 'none';
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




            scope.$watch('videoSignalingObject.remoteIsSendingVideoType', function(newRemoteIsSendingVideoType, oldRemoteIsSendingVideoType) {
                // the remoteVideo videoType has changed, which means that a new remote video window has been activated.
                // We need to make sure that correct windows aer enabled for the current videoType..
                $log.info('Remote remoteIsSendingVideoType is now: ' + newRemoteIsSendingVideoType + ' Old value was: ' + oldRemoteIsSendingVideoType);
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

videoAppDirectives.directive('lxVideoElementDirective', function($compile, $log) {
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
                scope.$watch('videoSignalingObject.remoteIsSendingVideoType', function(remoteIsSendingVideoType) {
                    if (remoteIsSendingVideoType === null) {
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
});

videoAppDirectives.directive('lxVideoWrapperDirective', function($log) {
    return {
        restrict : 'A',
        link: function(scope, elem, attrs) {
            if (attrs.videoWindow === 'local' ) {
                scope.localVideoObject.localHdVideoWrapper = elem[0];
            }
            else if (attrs.videoWindow === 'remote' ) {
                scope.remoteVideoObject.remoteHdVideoWrapper = elem[0];
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

