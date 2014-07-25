'use strict';

var videoAppDirectives = angular.module('videoApp.directives', ['videoApp.services']);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

videoAppDirectives.directive('callStatusDirective', function(userNotificationService, $compile, $sce, callService) {
    return {
        restrict: 'AE',
        link: function(scope, elem) {

            // we include doHangup on the scope because some of the getStatus calls can include
            // html that expects a doHangup function to be available.
            scope.doHangup = callService.doHangup;

            scope.$watch(userNotificationService.getStatus, function (statusHtml) {

                var el = angular.element('<span/>');
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
        restrict : 'AE',
        link: function() {
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
                        callService.toggleAudioMute();
                        return false;
                    case 69:
                        callService.toggleVideoMute();
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


videoAppDirectives.directive('videoContainerDirective', function($window, $log, $timeout,
                                              globalVarsService, constantsService,
                                              sessionService, userNotificationService,
                                              adapterService, channelService, turnService,
                                              callService, messageService) {
    return {
        restrict : 'AE',
        link: function(scope, elem) {

            var cardElemDiv = $('#card-elem')[0];
            var localVideoDiv = $('#local-video')[0];
            var miniVideoDiv = $('#mini-video')[0];

            var remoteVideoObject = {
                 remoteVideoDiv : $('#remote-video')[0]
            };


            function initializeVideoCallSetup() {

                var i;
                if (constantsService.errorMessages.length > 0) {
                    for (i = 0; i < constantsService.errorMessages.length; ++i) {
                        $window.alert(constantsService.errorMessages[i]);
                    }
                    return;
                }

                // Send BYE on refreshing(or leaving) a demo page
                // to ensure the room is cleaned for next session.
                $window.onbeforeunload = function() {
                    messageService.sendMessage({type: 'bye'});
                };



                $log.log('Initializing; room=' + constantsService.roomKey + '.');

                userNotificationService.resetStatus();
                // NOTE: AppRTCClient.java searches & parses this line; update there when
                // changing here.
                channelService.openChannel(remoteVideoObject);
                turnService.maybeRequestTurn(remoteVideoObject);

                // Caller is always ready to create peerConnection.
                // ARM Note: Caller is the 2nd person to join the chatroom, not the creator
                globalVarsService.signalingReady = globalVarsService.initiator;

                if (constantsService.mediaConstraints.audio === false &&
                    constantsService.mediaConstraints.video === false) {
                    callService.hasLocalStream = false;
                    callService.maybeStart();
                } else {
                    callService.hasLocalStream = true;
                    callService.doGetUserMedia(localVideoDiv, remoteVideoObject);
                }
            }


            var transitionVideoToActive = function() {
                $log.log('\n\n*** Executing transitionVideoToActive ***\n\n');
                adapterService.reattachMediaStream(miniVideoDiv, localVideoDiv);
                remoteVideoObject.remoteVideoDiv.style.opacity = 1;
                cardElemDiv.style.webkitTransform = 'rotateY(180deg)';
                $timeout(function() { localVideoDiv.src = ''; }, 500);
                $timeout(function() { miniVideoDiv.style.opacity = 1; }, 1000);
                userNotificationService.setStatus('<input type=\'button\' id=\'hangup\' value=\'Hang up\' ng-click=\'doHangup()\' />');
            };

            var transitionVideoToWaiting = function() {
                $log.log('\n\n*** Executing transitionVideoToWaiting ***\n\n');
                cardElemDiv.style.webkitTransform = 'rotateY(0deg)';
                $timeout(function() {
                    localVideoDiv.src = miniVideoDiv.src;
                    miniVideoDiv.src = '';
                    remoteVideoObject.remoteVideoDiv.src = '';
                }, 500);
                miniVideoDiv.style.opacity = 0;
                remoteVideoObject.remoteVideoDiv.style.opacity = 0;

                userNotificationService.resetStatus();
            };


            var transitionVideoToDone = function() {
                $log.log('\n\n*** Executing transitionVideoToDone ***\n\n');                
                localVideoDiv.style.opacity = 0;
                remoteVideoObject.remoteVideoDiv.style.opacity = 0;
                miniVideoDiv.style.opacity = 0;

              userNotificationService.setStatus('You have left the call. <a href=' + constantsService.roomLink + '>Click here</a> to rejoin.');
            };


            var setVideoContainerDimensions = function(){

                // Set the video winddow size and location.

                var videoAspectRatio;
                if (remoteVideoObject.remoteVideoDiv.style.opacity === '1') {
                    videoAspectRatio = remoteVideoObject.remoteVideoDiv.videoWidth/remoteVideoObject.remoteVideoDiv.videoHeight;
                } else if (localVideoDiv.style.opacity === '1') {
                    videoAspectRatio = localVideoDiv.videoWidth/localVideoDiv.videoHeight;
                } else {
                    return;
                }

                var innerHeight = $window.innerHeight - $('#id-vidochat-logo').height() - $('#footer').height();
                var innerWidth = $window.innerWidth;

                var innerAspectRatio = innerWidth/innerHeight;
                var videoHeight, videoWidth;

                if (innerAspectRatio <= videoAspectRatio) {
                    // the video needs to be have height reduced to keep aspect ratio and stay inside window
                    videoWidth = innerWidth;
                    videoHeight = innerWidth / videoAspectRatio;
                }
                else {
                    // the video needs to have the width reduce to keep aspect ratio and stay inside window
                    videoHeight = innerHeight;
                    videoWidth = innerHeight * videoAspectRatio;
                }

                elem.width(videoWidth + 'px');
                elem.height(videoHeight + 'px');
                //                elem.prop.left = (innerWidth - videoWidth) / 2 + 'px';
                //                elem.prop.top = 0 + 'px';
            };
/*
            scope.enterFullScreen = function () {
                // This will probably fail on non-Chrome browsers -- investigate if extra code is needed.
                elem[0].webkitRequestFullScreen();
            };*/


            initializeVideoCallSetup();



            angular.element($window).on('resize', function() {
                // if the window is resized, then resize the video.
                setVideoContainerDimensions();
            });

            scope.$watch(sessionService.getSessionStatus, function(status) {
                // If session status changes, then resize the video (the remote video
                // might have different dimensions than the local video)
                setVideoContainerDimensions();
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

            });

            localVideoDiv.addEventListener('loadedmetadata', function(){
                // once the metadata is loaded, the dimensions of the video are known.
                setVideoContainerDimensions();
            });

        }
    };
});

