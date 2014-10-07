'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */



videoAppDirectives.directive('lxCallStatusDirective', function(lxUserNotificationService, $compile, lxCallService) {
    return {
        restrict: 'A',
        link: function(scope, elem) {

            // we include doHangup on the scope because some of the getStatus calls can include
            // html that expects a doHangup function to be available.
            scope.doHangup = lxCallService.doHangup(scope.localVideoObject);

            scope.$watch(lxUserNotificationService.getStatus, function (statusHtml) {

                var el = angular.element('<p class="navbar-text"/>');
                el.append(statusHtml);
                var compileFn = $compile(el);
                compileFn(scope);
                elem.html('');
                elem.append(el);
            });
        }
    };
});




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
                        lxCallService.setAudioMute(scope.localVideoObject, !scope.localVideoObject.isAudioMuted);
                        return false;
                    case 69:
                        lxCallService.setVideoMute(scope.localVideoObject, !scope.localVideoObject.isVideoMuted);
                        return false;
                    default:
                        return;
                }
            });
        }
    };
});


videoAppDirectives.directive('lxVideoContainerDirective', function($window, $log,
                                              lxUseChatRoomVarsService, lxUseChatRoomConstantsService,
                                              lxWebRtcSessionService, lxUserNotificationService,
                                              lxAdapterService, lxChannelService, lxTurnService,
                                              lxCallService, lxMediaService, lxSessionDescriptionService) {

    var sessionStatus; // value set in a $watch function that monitors lxSessionDescriptionService.getSessionStatus

    return {
        restrict : 'A',
        link: function(scope) {

            var remoteVideoObject = scope.remoteVideoObject;
            var localVideoObject = scope.localVideoObject;
            var videoSignalingObject = scope.videoSignalingObject;




            var transitionVideoToActive = function() {
                $log.debug('\n\ntransitionVideoToActive\n\n');
                lxUserNotificationService.setStatus('<input type="button" class="btn btn-default btn-sm navbar-btn" id="hangup" value="Hang up" ng-click="doHangup()" />');
            };

            var removeMiniVideoElemsSrc = function() {
                $log.debug('removeMiniVideoElemsSrc');
                if (localVideoObject.miniVideoElemInsideRemoteHd && localVideoObject.miniVideoElemInsideRemoteHd.src) {
                    lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteHd.src , '');
                }
                if (localVideoObject.miniVideoElemInsideRemoteAscii && localVideoObject.miniVideoElemInsideRemoteAscii.src) {
                    lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteAscii.src, '');
                }
            };

            var transitionVideoToWaiting = function() {
                $log.log('\n\nExecuting transitionVideoToWaiting\n\n');
                removeMiniVideoElemsSrc();
                lxUserNotificationService.resetStatus();
            };

            var transitionVideoToDone = function() {
                $log.log('\n\nExecuting transitionVideoToDone\n\n');
                lxUserNotificationService.setStatus('You have left the call. <a class="navbar-link" href=' + lxUseChatRoomConstantsService.roomLink + '>Click here</a> to rejoin.');
            };

            var enablePrincipalVideoWindows = function() {
                $log.debug('enablePrincipalVideoWindows');
                // if it is a wider screen, then show both windows
                localVideoObject.localVideoWrapper.style.display = 'inline';
                remoteVideoObject.remoteVideoWrapper.style.display = 'inline';
            };

            var hideMiniVideoElems = function() {
                $log.debug('hideMiniVideoElems');
                if (localVideoObject.miniVideoElemInsideRemoteHd) {localVideoObject.miniVideoElemInsideRemoteHd.style.opacity = 0;}
                if (localVideoObject.miniVideoElemInsideRemoteAscii) {localVideoObject.miniVideoElemInsideRemoteAscii.style.opacity = 0;}
                removeMiniVideoElemsSrc();
            };

            var showMiniVideoElems = function() {
                $log.debug('showMiniVideoElems');
                if (localVideoObject.miniVideoElemInsideRemoteHd) {localVideoObject.miniVideoElemInsideRemoteHd.style.opacity = 1;}
                if (localVideoObject.miniVideoElemInsideRemoteAscii) {localVideoObject.miniVideoElemInsideRemoteAscii.style.opacity = 1;}
                reattachMediaStreamToMiniVideoElems();
            };

            var reattachMediaStreamToMiniVideoElems = function() {
                $log.debug('reattachMediaStreamToMiniVideoElems');
                if (!localVideoObject.miniVideoElemInsideRemoteHd || !localVideoObject.miniVideoElemInsideRemoteAscii) {
                    $log.error('Error: miniVideoElements not set');
                } else {
                    if (videoSignalingObject.remoteIsSendingVideoType === 'HD Video') {
                        lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteHd, localVideoObject.localVideoElem);
                    }
                    else if (videoSignalingObject.remoteIsSendingVideoType === 'ASCII Video'){
                        lxAdapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteAscii, localVideoObject.localVideoElem);
                    }
                    else if (videoSignalingObject.remoteIsSendingVideoType === null) {
                        $log.warn('Warning: cannot attach media stream when remoteIsSendingVideoType is null');
                    }
                    else {
                        $log.error('Error: unknown remoteIsSendingVideoType: ' + videoSignalingObject.remoteIsSendingVideoType);
                    }
                }
            };

            var setupXsScreenWhenNoRemote = function() {
                // XS screen without a remote signal, therefore we should show the local video and hide the remote video
                localVideoObject.localVideoWrapper.style.display = 'inline';
                remoteVideoObject.remoteVideoWrapper.style.display = 'none';
                hideMiniVideoElems();
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
                        // video embedded inside of a mini-video element. Alternatively, if the remote user is sending
                        // ASCII video, then we show the local video embedded inside of the ASCII video element.
                        if (sessionStatus === 'active' || videoSignalingObject.remoteIsSendingVideoType === 'ASCII Video') {
                            showMiniVideoElems();
                            localVideoObject.localVideoWrapper.style.display = 'none';
                            remoteVideoObject.remoteVideoWrapper.style.display = 'inline';
                        } else {
                            setupXsScreenWhenNoRemote();
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


            scope.$watch(lxSessionDescriptionService.getSessionStatus, function(status) {

                // get a local copy of the current session status, and take appropriate action.
                sessionStatus = status;
                if (status === 'initializing') {
                   $log.log('sessionStatus is set to "initializing"');
                } else if (status === 'active') {
                    transitionVideoToActive();
                } else if (status === 'waiting') {
                    transitionVideoToWaiting();
                } else if (status === 'done') {
                    transitionVideoToDone();
                } else {
                    $log.error('Error: unknown status received');
                }


                // If session status changes, then make sure to setup the current view based on the display
                // size and the current connection status.
                setupForCurrentDisplaySize();

            });

            scope.$watch('videoSignalingObject.remoteIsSendingVideoType', function(newRemoteIsSendingVideoType, oldRemoteIsSendingVideoType) {
                // the remoteVideo videoType has changed, which means that a new remote video window has been activated.
                // Therefore, we need to make sure that the mini-video window inside the currently displayed remote
                // video window is the only one that is active.
                $log.info('Remote remoteIsSendingVideoType is now: ' + newRemoteIsSendingVideoType + ' Old value was: ' + oldRemoteIsSendingVideoType);

                // check if this is an XS device
                if (viewportSize.getWidth() <= lxUseChatRoomVarsService.screenXsMax) {
                    if (newRemoteIsSendingVideoType !== null) {
                        setupForCurrentDisplaySize();
                    }
                    else {
                        setupXsScreenWhenNoRemote();
                    }
                }

                // this is larger than an XS device
                else {
                    // we can do the "normal" setup since this is normal display size.
                    setupForCurrentDisplaySize();
                }
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
                scope.localVideoObject.localVideoElem = e[0];
            }
            else if (attrs.videoWindow === 'remote' ) {
                e = angular.element('<video class="cl-video-sizing" autoplay="autoplay"></video>');
                scope.remoteVideoObject.remoteVideoElem = e[0];
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

videoAppDirectives.directive('lxMiniVideoTemplateDirective', function($log) {
    return {
        restrict : 'A',
        templateUrl: 'lx-template-cache/mini-video-template.html',
        link: function(scope, elem) {
            if (angular.element(elem).parents('#id-remote-hd-video-wrapper-div').length === 1) {
                scope.localVideoObject.miniVideoElemInsideRemoteHd = angular.element(elem).find('.cl-mini-video-element')[0];
            }
            else if (angular.element(elem).parents('#id-remote-ascii-video-wrapper-div').length === 1) {
                scope.localVideoObject.miniVideoElemInsideRemoteAscii = angular.element(elem).find('.cl-mini-video-element')[0];
            }
            else {
                $log.log('Error: directive lx-mini-video-template-directive must be inside either ' +
                    'id-remote-hd-video-wrapper-div, or id-remote-ascii-video-wrapper-div');
            }
        }
    };
});

