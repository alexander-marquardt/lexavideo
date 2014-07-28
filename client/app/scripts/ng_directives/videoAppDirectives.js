'use strict';

var videoAppDirectives = angular.module('videoApp.directives', ['videoApp.services']);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

videoAppDirectives.directive('callStatusDirective', function(userNotificationService, $compile, $sce, callService) {
    return {
        restrict: 'A',
        controller: 'mainVideoCtrl',
        link: function(scope, elem, attrs, vidCtrl) {

            // we include doHangup on the scope because some of the getStatus calls can include
            // html that expects a doHangup function to be available.
            scope.doHangup = callService.doHangup(vidCtrl.localVideoObject);

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


videoAppDirectives.directive('videoContainerDirective', function($window, $log, $timeout,
                                              globalVarsService, constantsService,
                                              sessionService, userNotificationService,
                                              adapterService, channelService, turnService,
                                              callService, messageService) {
    return {
        restrict : 'A',
        scope : {},
        controller: 'mainVideoCtrl',
        link: function(scope, elem, attrs, vidCtrl) {

            var remoteVideoObject = vidCtrl.remoteVideoObject;
            var localVideoObject = vidCtrl.localVideoObject;

            var cardElemDiv = $('#card-elem')[0];
            var localVideoDiv = $('#local-video')[0];



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
                channelService.openChannel(localVideoObject, remoteVideoObject);
                turnService.maybeRequestTurn(localVideoObject, remoteVideoObject);

                // Caller is always ready to create peerConnection.
                // ARM Note: Caller is the 2nd person to join the chatroom, not the creator
                sessionService.signalingReady = globalVarsService.initiator;

                if (constantsService.mediaConstraints.audio === false &&
                    constantsService.mediaConstraints.video === false) {
                    callService.hasAudioOrVideoMediaConstraints = false;
                    callService.maybeStart();
                } else {
                    callService.hasAudioOrVideoMediaConstraints = true;
                    callService.doGetUserMedia(localVideoDiv, localVideoObject, remoteVideoObject);
                }
            }


            var transitionVideoToActive = function() {
                $log.log('\n\n*** Executing transitionVideoToActive ***\n\n');
                userNotificationService.setStatus('<input type="button" id="hangup" value="Hang up" ng-click="doHangup()" />');
            };

            var transitionVideoToWaiting = function() {
                $log.log('\n\n*** Executing transitionVideoToWaiting ***\n\n');
                cardElemDiv.style.webkitTransform = 'rotateY(0deg)';
                userNotificationService.resetStatus();
            };


            var transitionVideoToDone = function() {
                $log.log('\n\n*** Executing transitionVideoToDone ***\n\n');                
                userNotificationService.setStatus('You have left the call. <a href=' + constantsService.roomLink + '>Click here</a> to rejoin.');
            };


            var setVideoContainerDimensions = function(){

                // Set the video winddow size and location.

                var videoAspectRatio = 2 * 1280 / 720;

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

videoAppDirectives.directive('asciiVideoContainerDirective', function($timeout, $interval, $log, callService) {

    var localCanvas = $('#local-ascii-canvas')[0];
    var localCanvasContext = localCanvas.getContext('2d');
    var videoElement = document.createElement('video');

    return {
        restrict: 'A',
        scope: {},
        link: function() {

            function waitForLocalStream() {
                var videoStream = callService.getLocalStream();

                if (videoStream) {

                    videoElement.setAttribute('width', 400);
                    videoElement.setAttribute('height', 400);


                    if (videoElement.mozSrcObject !== undefined) { // hack for Firefox < 19
                        videoElement.mozSrcObject = videoStream;
                    } else {
                        videoElement.src = (window.URL && window.URL.createObjectURL(videoStream)) || videoStream;
                    }


                    videoElement.play();
                    $interval(function() {
                        try {
                            localCanvasContext.drawImage(videoStream, 0, 0 , 400, 400);
                        } catch (e) {
                            $log.log('Error drawing image in canvas' + e);
                        }
                    }, Math.round(1000 / 30));
                } else {
                    $timeout(waitForLocalStream, 200);
                }
            }

            waitForLocalStream();
        }
    };
});