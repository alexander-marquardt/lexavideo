/**
 * Created by alexandermarquardt on 2014-08-27.
 */
'use strict';
/* global $ */

var lxAccessSystemResources = angular.module('lxAccessSystemResources.directives', []);

lxAccessSystemResources.directive('lxAccessCameraAndMicrophoneDirective', function($timeout, $animate,
                                                                              serverConstantsService, callService,
                                                                              mediaService, lxCheckCompatibilityService,
                                                                              lxModalSupportService) {

    var timerId;

    // initially define the watchers as dummy functions, so that they can be "de-registered" even if they were not
    // initially called.
    var watchLocalUserAccessCameraAndMicrophoneStatus1 = function() {},
        watchLocalUserAccessCameraAndMicrophoneStatus2 = function() {},
        watchLocalUserAccessCameraAndMicrophoneStatus3 = function() {};

    var askForPermissionToCameraAndMicrophone = function(localVideoElem, videoSignalingObject) {
        if (serverConstantsService.mediaConstraints.audio === false &&
            serverConstantsService.mediaConstraints.video === false) {
            callService.hasAudioOrVideoMediaConstraints = false;
        } else {
            callService.hasAudioOrVideoMediaConstraints = true;
            mediaService.doGetUserMedia(localVideoElem, videoSignalingObject);
        }
    };

    var showArrowPointingToAcceptButton = function(scope, elem, videoSignalingObject) {
        var arrowWrapperClass = '';
        var timeoutInMilliseconds = 0;
        var wrapperElement;

        if ($.browser.name === 'chrome') {
            if ($.browser.platform === 'mac') {
                arrowWrapperClass = 'cl-arrow-wrapper-mac-chrome';
            }
            else if ($.browser.desktop) {
                arrowWrapperClass = 'cl-arrow-wrapper-desktop-default-chrome';
            }
        }
        if ($.browser.name === 'mozilla') {

            if ($.browser.desktop) {
                // only show the arrow on desktops, since it appears that on mobile devices there is no
                // camera symbol in the URL to point the user to.
                arrowWrapperClass = 'cl-arrow-wrapper-mozilla';
            }

            // Since mozilla/firefox has a popup as opposed to a banner, we wait longer before showing the arrow.
            // If the user has accidentally clicked somewhere on the screen, then they need to be directed to the
            // camera icon to the left of where the URL is displayed.
            timeoutInMilliseconds = 15000;
        }

        if ($.browser.name === 'opera') {
            // no arrow required, since opera has a popup window that is quite obvious and that does not get
            // accidentaly hidden as may happen in firefox.
        }




        if (arrowWrapperClass !== '') {
            // only show the arrow if the arrowWrapperClass has been defined -- if it has not been defined, then
            // no arrow should be shown.
            elem.append('<div class="'+ arrowWrapperClass + '"><span class="icon-lx-arrow-up"></span></div>');

            wrapperElement = angular.element(elem).find('.' + arrowWrapperClass);

            if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'waitingForResponse') {
                var timeoutFn = function() {
                    timerId = $timeout(function() {
                        if (wrapperElement.hasClass('cl-show-arrow')) {
                            wrapperElement.removeClass('cl-show-arrow');
                            timeoutInMilliseconds = 4000;
                        } else {
                            // the arrow is now shown, leave it there for a while
                            $animate.addClass(wrapperElement, 'cl-show-arrow');
                            timeoutInMilliseconds = 10000;
                        }
                        timeoutFn();
                    }, timeoutInMilliseconds);
                };
                timeoutFn();
            }

            watchLocalUserAccessCameraAndMicrophoneStatus1 =
                scope.$watch('videoSignalingObject.localUserAccessCameraAndMicrophoneStatus', function() {
                    if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'denyAccess') {
                        // monitor to see if user denies access to the camera, and if this happens then
                        // move the arrow over to point to the camera icon instead of to the allow button.
                        if ($.browser.name === 'chrome') {
                            if ($.browser.platform === 'mac') {
                                wrapperElement = angular.element(elem).find('.' + arrowWrapperClass);
                                wrapperElement.addClass('camera-access-was-denied');
                            }
                        }
                    }
                });


        }
    };

    var showModalInstructionsForCameraAndMicrophone = function(scope) {

        var currentlyDisplayedModalInstance;

        if (lxCheckCompatibilityService.userDeviceBrowserAndVersionSupported) {
            // If the users's device and browser support webRTC, then show them instructions on how to access their
            // camera and microphone. Otherwise, they should already have been shown instructions from
            // lx-check-compatibility-directives, which would have told them what they need to do to access the site.

            watchLocalUserAccessCameraAndMicrophoneStatus3 =
                scope.$watch('videoSignalingObject.localUserAccessCameraAndMicrophoneStatus', function(newStatus) {
                    try {
                        currentlyDisplayedModalInstance.close();
                    } catch (error) {
                        // do nothing
                    }
                    if ($.browser.name === 'chrome') {
                        if ($.browser.platform === 'mac') {
                            if (newStatus === 'waitingForResponse') {
                                currentlyDisplayedModalInstance = lxModalSupportService.showModalWindow('lx-template-cache/chrome-mac-access-camera-modal.html');
                            }
                            else if (newStatus === 'denyAccess') {
                                currentlyDisplayedModalInstance = lxModalSupportService.showModalWindow('lx-template-cache/chrome-mac-access-camera-previously-denied-modal.html');
                            }
                        }
                        else if ($.browser.desktop) {

                        }
                        else {
                            // should be mobile

                        }
                    }
                    if ($.browser.name === 'mozilla') {

                        if ($.browser.desktop) {

                        }
                    }

                    if ($.browser.name === 'opera') {

                    }
                });
        }
    };

    var removeArrowAndAssociatedWatchers = function(elem, videoSignalingObject) {
        if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'allowAccess') {
            var arrowElement = angular.element(elem).find('.cl-arrow');
            arrowElement.addClass('ng-hide');

            // cancel timer that is no longer required
            $timeout.cancel(timerId);

            // de-register the watchers that are no longer required
            watchLocalUserAccessCameraAndMicrophoneStatus1();
            watchLocalUserAccessCameraAndMicrophoneStatus2();
            watchLocalUserAccessCameraAndMicrophoneStatus3();
        }
    };

    return {
        restrict: 'A',
        link: function(scope, elem) {
            var videoSignalingObject = scope.videoSignalingObject;
            var localVideoElem = scope.localVideoObject.localVideoElem;

            askForPermissionToCameraAndMicrophone(localVideoElem, videoSignalingObject);
            showArrowPointingToAcceptButton(scope, elem, videoSignalingObject);
            showModalInstructionsForCameraAndMicrophone(scope);

            watchLocalUserAccessCameraAndMicrophoneStatus2 =
                scope.$watch('videoSignalingObject.localUserAccessCameraAndMicrophoneStatus', function() {
                    removeArrowAndAssociatedWatchers(elem, videoSignalingObject);
                });
        }
    };
});
