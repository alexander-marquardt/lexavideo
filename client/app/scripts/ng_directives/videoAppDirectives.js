'use strict';

var videoAppDirectives = angular.module('videoApp.directives', ['videoApp.services']);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */

videoAppDirectives.directive('callStatusDirective', function(userNotificationService, $compile, $sce, callService) {
    return {
        restrict: 'A',
        controller: 'mainVideoCtrl',
        link: function(scope, elem, attrs, vidCtrl) {

            // we include doHangup on the scope because some of the getStatus calls can include
            // html that expects a doHangup function to be available.
            scope.doHangup = callService.doHangup(vidCtrl.localVideoObject);

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

videoAppDirectives.directive('monitorControlKeysDirective', function ($document, $log, infoDivService, callService) {


    return {
        restrict : 'A',
        scope : {},
        controller: 'mainVideoCtrl',
        link: function(scope, elem, attrs, vidCtrl) {

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
                        callService.toggleAudioMute(vidCtrl.localVideoObject);
                        return false;
                    case 69:
                        callService.toggleVideoMute(vidCtrl.localVideoObject);
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


videoAppDirectives.directive('videoContainerDirective', function($window, $log,
                                              globalVarsService, serverConstantsService,
                                              sessionService, userNotificationService,
                                              adapterService, channelService, turnService,
                                              callService, mediaService, messageService) {
    var sessionStatus;

    return {
        restrict : 'A',
        scope : {},
        controller: 'mainVideoCtrl',
        link: function(scope, elem, attrs, vidCtrl) {

            var remoteVideoObject = vidCtrl.remoteVideoObject;
            var localVideoObject = vidCtrl.localVideoObject;
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

            var transitionVideoToWaiting = function() {
                $log.log('\n\n*** Executing transitionVideoToWaiting ***\n\n');
                localVideoObject.miniVideoElem.src = '';
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

            var resizeVideoWindows = function() {

                if (sessionStatus === 'active') {
                    if (viewportSize.getWidth() <= globalVarsService.screenXsMax) {
                        adapterService.reattachMediaStream(localVideoObject.miniVideoElem, localVideoObject.localVideoElem);
                        localVideoObject.miniVideoElem.style.opacity = 1;
                        // we are dealing with a small viewport, and should therefore hide the local video as it is
                        // embedded in a small window inside the remote video.
                        localVideoObject.localVideoWrapper.style.display = 'none';
                        remoteVideoObject.remoteVideoWrapper.style.display = 'inline';
                    } else {
                        enableAllVideoWindows();
                        localVideoObject.miniVideoElem.style.opacity = 0;
                    }
                }
                else {
                    if (viewportSize.getWidth() <= globalVarsService.screenXsMax) {
                        // we are dealing with a small viewport with only a single video window.
                        // Therefore we should show the local video and hide the remote video
                        localVideoObject.localVideoWrapper.style.display = 'inline';
                        remoteVideoObject.remoteVideoWrapper.style.display = 'none';
                        localVideoObject.miniVideoElem.style.opacity = 0;
                    } else {
                        enableAllVideoWindows();
                        localVideoObject.miniVideoElem.style.opacity = 0;
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

            $(window).resize(function() {
                // calling jquery window.resize instead of angular watching for resize on the $window service should be slightly
                // more efficient.
                resizeVideoWindows();
            });
        }
    };
});

