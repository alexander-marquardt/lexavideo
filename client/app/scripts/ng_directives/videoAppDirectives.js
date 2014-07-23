'use strict';

var videoAppDirectives = angular.module('videoApp.directives', []);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

videoAppDirectives.directive('callStatus', function(userNotificationService, $compile, $sce, callService) {
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

videoAppDirectives.directive('monitorControlKeys', function ($document, $log, infoDivService, callService) {


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


videoAppDirectives.directive('videoContainer', function($window, $log, $timeout,
                                              globalVarsService, constantsService,
                                              sessionService, userNotificationService,
                                              adapterService) {
    return {
        restrict : 'AE',
        link: function(scope, elem) {

            var transitionVideoToActive = function() {
                adapterService.reattachMediaStream(globalVarsService.miniVideoDiv, globalVarsService.localVideoDiv);
                globalVarsService.remoteVideoDiv.style.opacity = 1;
                globalVarsService.cardElemDiv.style.webkitTransform = 'rotateY(180deg)';
                $timeout(function() { globalVarsService.localVideoDiv.src = ''; }, 500);
                $timeout(function() { globalVarsService.miniVideoDiv.style.opacity = 1; }, 1000);
                userNotificationService.setStatus('<input type=\'button\' id=\'hangup\' value=\'Hang up\' ng-click=\'doHangup()\' />');
            };

            var transitionVideoToWaiting = function() {
                globalVarsService.cardElemDiv.style.webkitTransform = 'rotateY(0deg)';
                $timeout(function() {
                    globalVarsService.localVideoDiv.src = globalVarsService.miniVideoDiv.src;
                    globalVarsService.miniVideoDiv.src = '';
                    globalVarsService.remoteVideoDiv.src = '';
                }, 500);
                globalVarsService.miniVideoDiv.style.opacity = 0;
                globalVarsService.remoteVideoDiv.style.opacity = 0;

                userNotificationService.resetStatus();
            };


            var transitionVideoToDone = function() {
                globalVarsService.localVideoDiv.style.opacity = 0;
                globalVarsService.remoteVideoDiv.style.opacity = 0;
                globalVarsService.miniVideoDiv.style.opacity = 0;

              userNotificationService.setStatus('You have left the call. <a href=' + constantsService.roomLink + '>Click here</a> to rejoin.');
            };


            var setVideoContainerDimensions = function(){

                // Set the video winddow size and location.

                var videoAspectRatio;
                if (globalVarsService.remoteVideoDiv.style.opacity === '1') {
                    videoAspectRatio = globalVarsService.remoteVideoDiv.videoWidth/globalVarsService.remoteVideoDiv.videoHeight;
                } else if (globalVarsService.localVideoDiv.style.opacity === '1') {
                    videoAspectRatio = globalVarsService.localVideoDiv.videoWidth/globalVarsService.localVideoDiv.videoHeight;
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

            angular.element($window).on('resize', function() {
                // if the window is resized, then resize the video.
                setVideoContainerDimensions();
            });

            scope.$watch(sessionService.getSessionStatus, function(status) {
                // If session status changes, then resize the video (the remote video
                // might have different dimensions than the local video)
                setVideoContainerDimensions();
                if (status === 'active') {
                    transitionVideoToActive();
                } else if (status === 'waiting') {
                    transitionVideoToWaiting();
                } else if (status === 'done') {
                    transitionVideoToDone();
                } else {
                    $log.log('Error, unknown status received');
                }

            });

            globalVarsService.localVideoDiv.addEventListener('loadedmetadata', function(){
                // once the metadata is loaded, the dimensions of the video are known.
                setVideoContainerDimensions();
            });

        }
    };
});

