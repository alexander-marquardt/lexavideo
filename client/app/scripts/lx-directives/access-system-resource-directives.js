/**
 * Created by alexandermarquardt on 2014-08-27.
 */
'use strict';
/* global $ */

var lxAccessSystemResources = angular.module('lxAccessSystemResources.directives', []);

lxAccessSystemResources.directive('lxAccessCameraAndMicrophoneDirective', function($timeout, $animate, $log,
                                                                              serverConstantsService, callService,
                                                                              mediaService, lxCheckCompatibilityService,
                                                                              lxModalSupportService) {

    var timerId;

    // initially define the watchers as dummy functions, so that they can be "de-registered" even if they were not
    // initially called.
    var watchLocalUserAccessCameraAndMicrophoneStatus = function() {},
        watchWhichModalIsOpen = function() {};


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
        var arrowElement;

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
                if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'waitingForResponse') {
                    // Only show the arrow if we are waiting for a response. If the camera was previously denied
                    // then firefox does not show the camera icon and therefore there is nothing to point to.
                    arrowWrapperClass = 'cl-arrow-wrapper-mozilla';
                }

                else {
                    arrowWrapperClass = ''; // redundant, but leave here for informational purposes.
                }

            }
        }

        if ($.browser.name === 'opera') {
            // no arrow required, since opera has a popup window that is quite obvious and that does not get
            // accidentaly hidden as may happen in firefox.
        }

        if (arrowWrapperClass !== '') {
            // only show the arrow if the arrowWrapperClass has been defined -- if it has not been defined, then
            // no arrow should be shown.
            arrowElement = angular.element(elem).find('.cl-arrow');
            arrowElement.removeClass('ng-hide');
            arrowElement.addClass(arrowWrapperClass);


            if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'denyAccess') {
                arrowElement.addClass('camera-access-was-denied');
            }

            if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus !== 'allowAccess') {

                $log.log('starting arrow timer')
                var timeoutFn = function() {
                    timerId = $timeout(function() {
                        if (arrowElement.hasClass('cl-show-arrow')) {
                            arrowElement.removeClass('cl-show-arrow');
                            timeoutInMilliseconds = 3000;
                        } else {
                            // the arrow is now shown, leave it there for a while
                            $animate.addClass(arrowElement, 'cl-show-arrow');
                            timeoutInMilliseconds = 15000;
                        }
                        timeoutFn();
                    }, timeoutInMilliseconds);
                };
                timeoutFn();
            }
        }
    };

    var showNewModalAndCloseOldModal = function(scope, elem, htmlTemplate, currentlyDisplayedModalInstance, windowClass) {


        if (currentlyDisplayedModalInstance) {
            // if there is already a modal open, close it so that we don't have them stacking on top of each other.
            currentlyDisplayedModalInstance.close();
        }

        $log.log('showing modal for '+ htmlTemplate);
        currentlyDisplayedModalInstance =  lxModalSupportService.showCameraAndMicrophoneModalWindow(scope, htmlTemplate, windowClass);
        return currentlyDisplayedModalInstance;
    };


    var showModalInstructionsForCameraAndMicrophone = function(scope, elem, videoSignalingObject, currentlyDisplayedModalInstance) {

        var windowClass = '';
        var  cameraAccessStatus = videoSignalingObject.localUserAccessCameraAndMicrophoneStatus;

        if (cameraAccessStatus === 'allowAccess') {
            currentlyDisplayedModalInstance.close();
        }


        if ($.browser.name === 'chrome') {
            if (cameraAccessStatus === 'denyAccess') {
                if ($.browser.desktop) {
                    currentlyDisplayedModalInstance = showNewModalAndCloseOldModal(scope, elem,
                        'lx-template-cache/chrome-desktop-access-camera-previously-denied-modal.html',
                        currentlyDisplayedModalInstance, windowClass);
                }
                else {
                    // mobile device
                }
            }
            else  if (cameraAccessStatus === 'waitingForResponse') {
                if ($.browser.platform === 'mac') {
                    currentlyDisplayedModalInstance = showNewModalAndCloseOldModal(scope, elem,
                        'lx-template-cache/chrome-mac-access-camera-modal.html',
                        currentlyDisplayedModalInstance, windowClass);
                }
                else if ($.browser.desktop) {
                    // windows/linux desktop devices. Chrome appears to have the same layout in both.
                    currentlyDisplayedModalInstance = showNewModalAndCloseOldModal(scope, elem,
                        'lx-template-cache/chrome-desktop-access-camera-modal.html',
                        currentlyDisplayedModalInstance, windowClass);
                }
                else {
                    // should be mobile
                }
            }
        }
        if ($.browser.name === 'mozilla') {
            $log.log('mozilla cameraAccessStatus is ' + cameraAccessStatus);
            if (cameraAccessStatus === 'denyAccess') {
                // If access has been denied, then the user will not be shown the firefox Camera popup prompt.
                // In this case they must right-click on the desktop and modify the permissions manually.
                windowClass = '';
                currentlyDisplayedModalInstance = showNewModalAndCloseOldModal(scope, elem,
                    'lx-template-cache/mozilla-desktop-access-camera-previously-denied-modal.html',
                    currentlyDisplayedModalInstance, windowClass);
            }

            else  if (cameraAccessStatus === 'waitingForResponse') {
                if ($.browser.desktop) {
                    windowClass = 'cl-firefox-camera-access-modal-override';
                    currentlyDisplayedModalInstance = showNewModalAndCloseOldModal(scope, elem,
                        'lx-template-cache/mozilla-desktop-access-camera-modal.html',
                        currentlyDisplayedModalInstance, windowClass);
                }
            }
        }

        if ($.browser.name === 'opera') {

        }

        return currentlyDisplayedModalInstance;
    };


    var removeArrowAndAssociatedWatchers = function(elem) {
        var arrowElement = angular.element(elem).find('.cl-arrow');
        arrowElement.addClass('ng-hide');
        // cancel timer that is no longer required
        $log.log('removing arrow and watchers');
        $timeout.cancel(timerId);
    };

    var removeModalWatcher = function() {
    // de-register the watchers that are no longer required
        watchLocalUserAccessCameraAndMicrophoneStatus();
        watchWhichModalIsOpen();
    };

    var getWhichModalIsShown = function(scope) {
        return function() {
            var arr = scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown;
            var len = arr.length;
            if (len > 0) {
                return arr[len-1];
            } else {
                return null;
            }

        };
    };

    var watchCameraStatus = function(scope) {
        return function () {
            var status = scope.videoSignalingObject.localUserAccessCameraAndMicrophoneStatus;
            return status;
        }
    };

    return {
        restrict: 'A',
        link: function(scope, elem) {
            var currentlyDisplayedModalInstance;
            var videoSignalingObject = scope.videoSignalingObject;
            var localVideoElem = scope.localVideoObject.localVideoElem;

            if (lxCheckCompatibilityService.userDeviceBrowserAndVersionSupported) {
                // If the users's device and browser support webRTC, then show them instructions on how to access their
                // camera and microphone. Otherwise, they should already have been shown instructions from
                // lx-check-compatibility-directives, which would have told them what they need to do to access the site.
                askForPermissionToCameraAndMicrophone(localVideoElem, videoSignalingObject);

                elem.append('<div class="ng-hide cl-arrow"><span class="icon-lx-arrow-up"></span></div>');

                watchWhichModalIsOpen =
                    scope.$watch(getWhichModalIsShown(scope), function(whichModalIsOpen) {
                        removeArrowAndAssociatedWatchers(elem);

                        if (whichModalIsOpen !== null) {
                            $log.log('showing arrow pointing to accept button. whichModalIsOpen is: ' + whichModalIsOpen);
                            showArrowPointingToAcceptButton(scope, elem, videoSignalingObject);
                        }
                    });

                watchLocalUserAccessCameraAndMicrophoneStatus =
                    scope.$watch(watchCameraStatus(scope), function() {
                        if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'allowAccess') {
                            // access has been given, no need to show arrows pointing to camera icons and allow buttons
                            removeArrowAndAssociatedWatchers(elem);
                            removeModalWatcher();
                        }
                        else {
                            // we are still waiting for access. Since the status has changed, the modal
                            // content will have changed as well, which means that we need to who a new modal.
                            currentlyDisplayedModalInstance = showModalInstructionsForCameraAndMicrophone(scope, elem,
                                videoSignalingObject, currentlyDisplayedModalInstance);
                        }
                    });

                currentlyDisplayedModalInstance = showModalInstructionsForCameraAndMicrophone(scope, elem,
                    videoSignalingObject, currentlyDisplayedModalInstance);

            }
        }
    };
});
