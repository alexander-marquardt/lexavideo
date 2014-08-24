'use strict';

var videoAppDirectives = angular.module('videoApp.directives', ['videoApp.services']);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */


videoAppDirectives.directive('lxCallStatusDirective', function(userNotificationService, $compile, callService) {
    return {
        restrict: 'A',
        link: function(scope, elem) {

            // we include doHangup on the scope because some of the getStatus calls can include
            // html that expects a doHangup function to be available.
            scope.doHangup = callService.doHangup(scope.localVideoObject);

            scope.$watch(userNotificationService.getStatus, function (statusHtml) {

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

videoAppDirectives.directive('lxAccessCameraAndMicrophoneDirective', function($timeout, $animate,
                                                                              serverConstantsService, callService, mediaService ) {

    var timerId;

    var askForPermissionToCameraAndMicrophone = function(localVideoElem, videoSignalingObject) {
        if (serverConstantsService.mediaConstraints.audio === false &&
            serverConstantsService.mediaConstraints.video === false) {
            callService.hasAudioOrVideoMediaConstraints = false;
        } else {
            callService.hasAudioOrVideoMediaConstraints = true;
            mediaService.doGetUserMedia(localVideoElem, videoSignalingObject);
        }
    };

    var showArrowPointingToAcceptButton = function(elem, videoSignalingObject) {
        var arrowWrapperClass = '';
        var timeoutInMilliseconds = 0;

        if ($.browser.name === 'chrome') {
            if ($.browser.platform === 'mac') {
                arrowWrapperClass = 'cl-arrow-wrapper-mac-chrome';
            }
            else if ($.browser.desktop) {
                arrowWrapperClass = 'cl-arrow-wrapper-desktop-default-chrome';
            }
        }
        if ($.browser.name === 'mozilla') {
            // treat mozilla the same across all platforms
            arrowWrapperClass = 'cl-arrow-wrapper-mozilla';

            // Since mozilla/firefox has a popup as opposed to a banner, we wait longer before showing the arrow.
            // If the user has accidentally clicked somewhere on the screen, then they need to be directed to the
            // camera icon to the left of where the URL is displayed.
            timeoutInMilliseconds = 15000;
        }

        if (arrowWrapperClass !== '') {
            // only show the arrow if the arrowWrapperClass has been defined -- if it has not been defined, then
            // we have not defined where the arrow should be shown in the current OS/browser, and therefore no
            // arrow should be shown.
            elem.append('<div class="'+ arrowWrapperClass + '"><div class="cl-arrow"><i></i><i></i></div></div>');

            var wrapperElement = angular.element(elem).find('.' + arrowWrapperClass);
            var arrowElement = angular.element(elem).find('.cl-arrow');


            if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'noResponse') {
                var timeoutFn = function() {
                    timerId = $timeout(function() {
                        if (arrowElement.hasClass('cl-show-arrow')) {
                            arrowElement.removeClass('cl-show-arrow');
                            wrapperElement.removeClass('cl-show-arrow');
                            timeoutInMilliseconds = 4000;
                        } else {
                            // the arrow is now shown, leave it there for a while
                            $animate.addClass(arrowElement, 'cl-show-arrow');
                            $animate.addClass(wrapperElement, 'cl-show-arrow');
                            timeoutInMilliseconds = 10000;
                        }
                        timeoutFn();
                    }, timeoutInMilliseconds);
                };
                timeoutFn();
            }
        }
    };

    return {
        restrict: 'A',
        link: function(scope, elem) {
            var videoSignalingObject = scope.videoSignalingObject;
            var localVideoElem = scope.localVideoObject.localVideoElem;
            var arrowElement = angular.element(elem).find('.cl-arrow');


            askForPermissionToCameraAndMicrophone(localVideoElem, videoSignalingObject);
            showArrowPointingToAcceptButton(elem, videoSignalingObject);

            scope.$watch('videoSignalingObject.localUserAccessCameraAndMicrophoneStatus', function() {

                if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'allowAccess') {
                    arrowElement.addClass('ng-hide');
                    $timeout.cancel(timerId);
                }
            });
        }
    };
});

videoAppDirectives.directive('lxVideoSettingsNegotiationDirective', function($animate, $log,
                                                                             negotiateVideoType, callService) {


    var showRequestForHdVideo = function(scope, elem) {
        // if the other user has requested an hdVideo session, the local user must accept before we will
        // send and receive HD video.

        var newVideoType = 'hdVideo';

        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="navbar-text"/>');
        el.html('Stranger has requested to exchange HD video. Do you accept: ');
        var buttonGroup = angular.element('<div class="btn-group"></div>');
        var yesButton = angular.element('<button type="button" class="btn btn-default btn-sm navbar-btn">Yes</button>');
        var noButton = angular.element('<button type="button" class="btn btn-default btn-sm navbar-btn">No</button>');
        buttonGroup.append(yesButton, noButton );
        elem.append(el, buttonGroup);

        yesButton.on('click', function() {


            negotiateVideoType.sendAcceptanceOfVideoType(newVideoType);
            $animate.addClass(elem, 'ng-hide');

            if (newVideoType === 'hdVideo') {
                // Other user has requested hdVideo, and this user has agreed to send it.
                scope.videoSignalingObject.localHasSelectedVideoType = newVideoType;
                callService.maybeStart(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject);
            }
        });

        noButton.on('click', function() {
            negotiateVideoType.sendDenyOfVideoType(newVideoType);
            $animate.addClass(elem, 'ng-hide');
        });
    };

    var  showMessageInVideoWindow = function(scope, elem, message) {
        $animate.removeClass(elem, 'ng-hide');
        elem.html('');
        var el = angular.element('<p class="navbar-text"/>');
        el.html(message);
        elem.append(el);
    };

    return {
        restrict: 'A',
        link : function(scope, elem) {
            scope.$watch('videoSignalingObject.remoteHasRequestedVideoType', function(newVideoType) {
                if (newVideoType === 'hdVideo') {
                    showRequestForHdVideo(scope, elem);
                }
                else if (newVideoType === 'asciiVideo') {
                    // by default, we do not ask for permission to switch to ascii video mode. If one of the users requests
                    // a switch to asciiVideo, then we will tear down the peer connection, and will transmit ascii video in
                    // both directions.
                }
                else {
                    $log.log('Error: unknown videoSignalingObject.remoteHasRequestedVideoType: ' + newVideoType);
                }
            });

            scope.$watch('videoSignalingObject.localHasSelectedVideoType', function(newVideoType) {
                if (newVideoType === 'hdVideo') {
                    var message = 'We are waiting for remote user to accept your request to exchange HD Video ';
                    showMessageInVideoWindow(scope, elem, message);
                }
            });

            scope.$watch('videoSignalingObject.remoteResponseToLocalRequest', function(remoteResponse) {
                var message;
                if (remoteResponse === 'denyVideoType') {
                    message = 'Remote user has denied your request';
                    showMessageInVideoWindow(scope, elem, message);
                    scope.videoSignalingObject.remoteResponseToLocalRequest = 'noResponse'; // reset to default state
                }
                else if (remoteResponse === 'acceptVideoType') {
                    message = 'Remote user has accepted your request. Please wait a moment for the new video format to begin transmission.';
                    showMessageInVideoWindow(scope, elem, message);
                    scope.videoSignalingObject.remoteResponseToLocalRequest = 'noResponse'; // reset to default state
                }
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

    var sessionStatus; // value set in a $watch function that monitors sessionService.getSessionStatus

    return {
        restrict : 'A',
        link: function(scope) {

            var remoteVideoObject = scope.remoteVideoObject;
            var localVideoObject = scope.localVideoObject;
            var videoSignalingObject = scope.videoSignalingObject;


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
                channelService.openChannel(localVideoObject, remoteVideoObject, videoSignalingObject);
                turnService.maybeRequestTurn();

                // rtcInitiator is the 2nd person to join the chatroom, not the creator of the chatroom
                sessionService.signalingReady = globalVarsService.rtcInitiator;


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

            var enablePrincipalVideoWindows = function() {
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
                if (videoSignalingObject.remoteIsSendingVideoType === 'hdVideo' && localVideoObject.miniVideoElemInsideRemoteHd) {
                    adapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteHd, localVideoObject.localVideoElem);
                }
                else if (videoSignalingObject.remoteIsSendingVideoType === 'asciiVideo' && localVideoObject.miniVideoElemInsideRemoteAscii){
                    adapterService.reattachMediaStream(localVideoObject.miniVideoElemInsideRemoteAscii, localVideoObject.localVideoElem);
                } else {
                    $log.log('Error: unknown remoteIsSendingVideoType: ' + videoSignalingObject.remoteIsSendingVideoType);
                }
            };

            var setupForCurrentDisplaySize = function() {

                // TODO - temporary hack until we sort out a better way to determine the "session" status. We cannot
                // depend on the peer connection values, since our session encompases ascii transmission as well..
                // remote the if (true) from the following line once this is fixed.
                if (true || sessionStatus === 'active') {
                    if (viewportSize.getWidth() <= globalVarsService.screenXsMax) {
                        showMiniVideoElems();
                        // we are dealing with a small viewport, and should therefore hide the local video as it is
                        // now embedded in a small window inside the remote video.
                        localVideoObject.localVideoWrapper.style.display = 'none';
                        remoteVideoObject.remoteVideoWrapper.style.display = 'inline';
                    } else {
                        enablePrincipalVideoWindows();
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


            scope.$watch(sessionService.getSessionStatus, function(status) {

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
                    $log.log('Error, unknown status received');
                }


                // If session status changes, then make sure to setup the current view based on the display
                // size and the current connection status.
                setupForCurrentDisplaySize();

            });

            scope.$watch('videoSignalingObject.remoteIsSendingVideoType', function(newValue, oldValue) {
                // the remoteVideo videoType has changed, which means that a new remote video window has been activated.
                // Therefore, we need to make sure that the mini-video window inside the currently displayed remote
                // video window is the only one that is active.
                $log.log('Remote remoteIsSendingVideoType is now: ' + newValue + ' Old value was: ' + oldValue);
                if (viewportSize.getWidth() <= globalVarsService.screenXsMax) {
                    removeMiniVideoElemsSrc();
                    reattachMediaStreamToMiniVideoElems();
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

