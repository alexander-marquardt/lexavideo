'use strict';

var videoAppDirectives = angular.module('videoApp.directives', ['videoApp.services']);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */

videoAppDirectives.directive('lxCallStatusDirective', function(userNotificationService, $compile, $sce, callService) {
    return {
        restrict: 'A',
        link: function(scope, elem) {

            // we include doHangup on the scope because some of the getStatus calls can include
            // html that expects a doHangup function to be available.
            scope.doHangup = callService.doHangup(scope.localVideoObject);

            scope.$watch(userNotificationService.getStatus, function (statusHtml) {

                var el = angular.element('<navbar class="navbar-text"/>');
                el.append(statusHtml);
                var compileFn = $compile(el);
                compileFn(scope);
                elem.html('');
                elem.append(el);
            });
        }
    };
});

videoAppDirectives.directive('lxMonitorControlKeysDirective', function ($document, $log, infoDivService, callService) {


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
                        callService.toggleAudioMute(scope.localVideoObject);
                        return false;
                    case 69:
                        callService.toggleVideoMute(scope.localVideoObject);
                        return false;
                    case 73:
                        infoDivService.toggleInfoDiv();
                        return false;
                    default:
                        return;
                }
            });
        }
    };
});


videoAppDirectives.directive('lxVideoContainerDirective', function($window, $log,
                                              globalVarsService, serverConstantsService,
                                              sessionService, userNotificationService,
                                              adapterService, channelService, turnService,
                                              callService, mediaService, messageService) {
    var sessionStatus;

    return {
        restrict : 'A',
        link: function(scope) {

            var remoteVideoObject = scope.remoteVideoObject;
            var localVideoObject = scope.localVideoObject;
            var localVideoElem = localVideoObject.localVideoElem;


            (function() {

                var i;
                if (serverConstantsService.errorMessages.length > 0) {
                    for (i = 0; i < serverConstantsService.errorMessages.length; ++i) {
                        $window.alert(serverConstantsService.errorMessages[i]);
                    }
                    return;
                }

                // Send BYE on refreshing(or leaving) a demo page
                // to ensure the room is cleaned for next session.
                $window.onbeforeunload = function() {
                    messageService.sendMessage('sdp', {type: 'bye'});
                };



                $log.log('Initializing; room=' + serverConstantsService.roomKey + '.');

                userNotificationService.resetStatus();
                // NOTE: AppRTCClient.java searches & parses this line; update there when
                // changing here.
                channelService.openChannel(localVideoObject, remoteVideoObject);
                turnService.maybeRequestTurn(localVideoObject, remoteVideoObject);

                // Caller is always ready to create peerConnection.
                // ARM Note: Caller is the 2nd person to join the chatroom, not the creator
                sessionService.signalingReady = globalVarsService.initiator;

                if (serverConstantsService.mediaConstraints.audio === false &&
                    serverConstantsService.mediaConstraints.video === false) {
                    callService.hasAudioOrVideoMediaConstraints = false;
                    callService.maybeStart();
                } else {
                    callService.hasAudioOrVideoMediaConstraints = true;
                    mediaService.doGetUserMedia(localVideoElem, localVideoObject, remoteVideoObject);
                }
            })(); // self calling function


            var transitionVideoToActive = function() {
                $log.log('\n\n*** Executing transitionVideoToActive ***\n\n');
                userNotificationService.setStatus('<input type="button" class="btn btn-default btn-sm navbar-btn" id="hangup" value="Hang up" ng-click="doHangup()" />');
            };

            var removeMiniVideoElemsSrc = function() {
                if (localVideoObject.miniVideoElemInsideRemoteHd) {localVideoObject.miniVideoElemInsideRemoteHd.src = '';}
                if (localVideoObject.miniVideoElemInsideRemoteAscii) {localVideoObject.miniVideoElemInsideRemoteAscii.src = '';}
            };

            var transitionVideoToWaiting = function() {
                $log.log('\n\n*** Executing transitionVideoToWaiting ***\n\n');
                removeMiniVideoElemsSrc();
                userNotificationService.resetStatus();
            };

            var transitionVideoToDone = function() {
                $log.log('\n\n*** Executing transitionVideoToDone ***\n\n');
                userNotificationService.setStatus('You have left the call. <a class="navbar-link" href=' + serverConstantsService.roomLink + '>Click here</a> to rejoin.');
            };

            var enableAllVideoWindows = function() {
                // if it is a wider screen, then show both windows
                localVideoObject.localVideoWrapper.style.display = 'inline';
                remoteVideoObject.remoteVideoWrapper.style.display = 'inline';
            };

            var hideMiniVideoElems = function() {
                if (localVideoObject.miniVideoElemInsideRemoteHd) {localVideoObject.miniVideoElemInsideRemoteHd.style.opacity = 0;}
                if (localVideoObject.miniVideoElemInsideRemoteAscii) {localVideoObject.miniVideoElemInsideRemoteAscii.style.opacity = 0;}
                removeMiniVideoElemsSrc();
            };

            var showMiniVideoElems = function() {
                if (localVideoObject.miniVideoElemInsideRemoteHd) {localVideoObject.miniVideoElemInsideRemoteHd.style.opacity = 1;}
                if (localVideoObject.miniVideoElemInsideRemoteAscii) {localVideoObject.miniVideoElemInsideRemoteAscii.style.opacity = 1;}
                reattachMediaStreamToMiniVideoElems();
            };

            var reattachMediaStreamToMiniVideoElems = function() {
                if (remoteVideoObject.videoType === 'hdVideo' && localVideoObject.miniVideoElemInsideRemoteHd) {
                    adapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteHd, localVideoObject.localVideoElem);
                }
                else if (remoteVideoObject.videoType === 'asciiVideo' && localVideoObject.miniVideoElemInsideRemoteAscii){
                    adapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteAscii, localVideoObject.localVideoElem);
                } else {
                    $log.log('Error: unknown videoType: ' + remoteVideoObject.videoType);
                }
            };

            var resizeVideoWindows = function() {

                if (sessionStatus === 'active') {
                    if (viewportSize.getWidth() <= globalVarsService.screenXsMax) {
                        showMiniVideoElems();
                        // we are dealing with a small viewport, and should therefore hide the local video as it is
                        // now embedded in a small window inside the remote video.
                        localVideoObject.localVideoWrapper.style.display = 'none';
                        remoteVideoObject.remoteVideoWrapper.style.display = 'inline';
                    } else {
                        enableAllVideoWindows();
                        hideMiniVideoElems();
                    }
                }
                else {
                    if (viewportSize.getWidth() <= globalVarsService.screenXsMax) {
                        // we are dealing with a small viewport with only a single video window.
                        // Therefore we should show the local video and hide the remote video
                        localVideoObject.localVideoWrapper.style.display = 'inline';
                        remoteVideoObject.remoteVideoWrapper.style.display = 'none';
                        hideMiniVideoElems();
                    } else {
                        enableAllVideoWindows();
                        hideMiniVideoElems();
                    }
                }

            };
/*
            scope.enterFullScreen = function () {
                // This will probably fail on non-Chrome browsers -- investigate if extra code is needed.
                elem[0].webkitRequestFullScreen();
            };*/


            scope.$watch(sessionService.getSessionStatus, function(status) {
                // If session status changes, then resize the video (the remote video
                // might have different dimensions than the local video)
                if (status === 'initializing') {
                   $log.log('sessionStatus is set to "initializing"');
                } else if (status === 'active') {
                    transitionVideoToActive();
                } else if (status === 'waiting') {
                    transitionVideoToWaiting();
                } else if (status === 'done') {
                    transitionVideoToDone();
                } else {
                    $log.log('Error, unknown status received');
                }

                sessionStatus = status;
                resizeVideoWindows();

            });

            function watchRemoteVideoType() {
                return scope.remoteVideoObject.videoType;
            }

            scope.$watch(watchRemoteVideoType, function(newValue, oldValue) {
                $log.log('Remote videoType is now: ' + newValue + ' Old value was: ' + oldValue);
                if (viewportSize.getWidth() > globalVarsService.screenXsMax) {
                    reattachMediaStreamToMiniVideoElems();
                }
            });

            $(window).resize(function() {
                // calling jquery window.resize instead of angular watching for resize on the $window service should be slightly
                // more efficient.
                resizeVideoWindows();
            });
        }
    };
});

videoAppDirectives.directive('lxMiniVideoTemplateDirective', function($log) {
    return {
        restrict : 'A',
        templateUrl: 'mini-video-template.html', // this is defined in angular's "template cache"
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
