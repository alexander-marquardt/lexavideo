/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/

'use strict';
/* global $ */

angular.module('lxAccessSystemResources.services', [])


    .factory('lxAccessCameraAndMicrophoneService',
    function($timeout,
             $animate,
             $log,
             $modalStack,
             lxVideoParamsService,
             lxCallService,
             lxMediaService,
             lxCheckCompatibilityService,
             lxModalSupportService) {

        var showArrowTimerId = null;
        var currentModalInstance = null;

        // initially define the watchers as dummy functions, so that they can be "de-registered" even if they were not
        // initially called.
        var watchLocalUserAccessCameraAndMicrophoneStatus = null,
            watchWhichModalIsOpen = null;


        var askForPermissionToCameraAndMicrophone = function(scope, remoteClientId) {
            if (lxVideoParamsService.mediaConstraints.audio === false &&
                lxVideoParamsService.mediaConstraints.video === false) {
                lxCallService.hasAudioOrVideoMediaConstraints = false;
            } else {
                lxCallService.hasAudioOrVideoMediaConstraints = true;
                lxMediaService.doGetUserMedia(scope, remoteClientId);
            }
        };

        var showArrowPointingToWhereUserShouldLook = function(scope, videoSignalingObject) {
            var arrowClass = '';
            var timeoutInMilliseconds = 0;
            var arrowElem = null;

            if ($.browser.name === 'mozilla') {

                if ($.browser.desktop) {
                    // only show the arrow on desktops, since it appears that on mobile devices there is no
                    // camera symbol inf the URL to point the user to.
                    if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'waitingForResponse') {
                        // Only show the arrow if we are waiting for a response. If the camera was previously denied
                        // then firefox does not show the camera icon and therefore there is nothing to point to.
                        arrowClass = 'cl-arrow-mozilla';
                    }
                }
            }

            if ($.browser.name === 'opera') {
                if ($.browser.desktop) {
                    if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'denyAccess') {
                        // point the arrow to the camera symbol.
                        arrowClass = 'cl-arrow-opera';
                    }
                }
            }

            // only show the arrow if the arrowClass has been defined -- if it has not been defined, then
            // no arrow should be shown.
            if (arrowClass !== '') {

                arrowElem = angular.element('<div class="cl-arrow"><span class="icon-lx-arrow-up"></span></div>');
                $('body').append(arrowElem);
                arrowElem.addClass(arrowClass);

                if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus !== 'allowAccess') {

                    if (showArrowTimerId) {
                        $log.debug('removing old arrow timer');
                        // a previous timer was running, so we remove it.
                        $timeout.cancel(showArrowTimerId);
                        showArrowTimerId = null;
                    }

                    $log.debug('starting arrow timer');
                    var timeoutFn = function() {
                        showArrowTimerId = $timeout(function() {
                            if (arrowElem.hasClass('cl-show-arrow')) {
                                arrowElem.removeClass('cl-show-arrow');
                                timeoutInMilliseconds = 3000;
                            } else {
                                // the arrow is now shown, display it for a while
                                arrowElem.addClass('cl-show-arrow');
                                timeoutInMilliseconds = 15000;
                            }
                            timeoutFn();
                        }, timeoutInMilliseconds);
                    };
                    timeoutFn();
                }
            } else {
                // remove the arrow since none should be shown for the current device/browser.
                removeArrowAndAssociatedWatchers(arrowElem);
            }

            return arrowElem;
        };



        var showNewModalAndCloseOldModal = function(scope, htmlTemplate,  windowClass, modalSize) {

            lxModalSupportService.closeModal(currentModalInstance); // remove most recent modal box
            $log.log('showing modal for '+ htmlTemplate);
            currentModalInstance = lxModalSupportService.showCameraAndMicrophoneModal(scope, htmlTemplate, windowClass, modalSize);
        };


        var showChromeModalPromptForCameraAndMicrophone = function(scope, cameraAccessStatus) {

            var windowClass = '';
            var modalSize = '';

            if (cameraAccessStatus === 'denyAccess') {
                if ($.browser.desktop) {
                    windowClass = 'cl-modal-override-position-lower';
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/chrome-desktop-and-mac-access-camera-previously-denied-modal.html',
                        windowClass, modalSize);
                }
                else {
                    // it is a mobile device
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/chrome-mobile-access-camera-previously-denied-modal.html',
                        windowClass, modalSize);
                }
            }
            else  if (cameraAccessStatus === 'waitingForResponse') {
                if ($.browser.platform === 'mac') {
                    windowClass = 'cl-modal-override-position-lower';
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/chrome-mac-access-camera-modal.html',
                        windowClass, modalSize);
                }
                else if ($.browser.desktop) {
                    // windows/linux desktop devices. Chrome appears to have the same layout in both.
                    windowClass = 'cl-modal-override-position-lower';
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/chrome-desktop-access-camera-modal.html',
                        windowClass, modalSize);
                }
                else {
                    // it is a mobile device
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/chrome-mobile-access-camera-modal.html',
                        windowClass, modalSize);
                }
            }
        };

        var showMozillaModalPromptForCameraAndMicrophone = function(scope, cameraAccessStatus) {

            var windowClass = '';
            var modalSize = '';

            $log.log('mozilla cameraAccessStatus is ' + cameraAccessStatus);
            if (cameraAccessStatus === 'denyAccess') {
                if ($.browser.desktop) {
                    // If access has been denied, then the user will not be shown the firefox builtin Camera popup prompt.
                    // In this case they must right-click on the desktop and modify the permissions manually.
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/mozilla-desktop-access-camera-previously-denied-modal.html',
                        windowClass, modalSize);
                }
                else {
                    // it is a mobile device. Firefox mobile just needs to be reloaded to show the camera prompt
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/mozilla-mobile-access-camera-previously-denied-modal.html',
                        windowClass, modalSize);            }
            }

            else  if (cameraAccessStatus === 'waitingForResponse') {
                if ($.browser.desktop) {
                    windowClass = 'cl-modal-override-position-lower';
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/mozilla-desktop-access-camera-modal.html',
                        windowClass, modalSize);
                } else {
                    // mobile device
                    // Don't show any modal in this case, since the Firefox popup is very obvious and impossible to miss.
                }

            }

        };

        var showOperaModalPromptForCameraAndMicrophone = function(scope, cameraAccessStatus) {
            var windowClass = '';
            var modalSize = '';

            if (cameraAccessStatus === 'denyAccess') {
                windowClass = 'cl-modal-override-position-lower';
                if ($.browser.desktop) {
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/opera-desktop-access-camera-previously-denied-modal.html',
                        windowClass, modalSize);
                }
                else {
                    // mobile device
                    showNewModalAndCloseOldModal(scope,
                        'lx-template-cache/opera-mobile-access-camera-previously-denied-modal.html',
                        windowClass, modalSize);
                }
            }
            else  if (cameraAccessStatus === 'waitingForResponse') {
                if ($.browser.desktop) {
                    // don't show a modal since the opera popup is obvious on its own.
                } else {
                    // mobile device - no modal needs to be shown since the opera popup is obvious.
                }
            }
        };


        var showModalInstructionsForCameraAndMicrophone = function(scope, videoSignalingObject) {

            var  cameraAccessStatus = videoSignalingObject.localUserAccessCameraAndMicrophoneStatus;


            if ($.browser.name === 'chrome') {
                showChromeModalPromptForCameraAndMicrophone (scope, cameraAccessStatus);
            }
            if ($.browser.name === 'mozilla') {
                showMozillaModalPromptForCameraAndMicrophone (scope, cameraAccessStatus);
            }
            if ($.browser.name === 'opera') {
                showOperaModalPromptForCameraAndMicrophone (scope, cameraAccessStatus);
            }

        };


        var removeArrowAndAssociatedWatchers = function(arrowElem) {
            $log.log('removing arrow and watchers');

            if (arrowElem !== null) {
                arrowElem.remove();
            }
            // cancel timer that is no longer required
            if (showArrowTimerId) {
                $log.debug('canceling old arrow timer');
                $timeout.cancel(showArrowTimerId);
                showArrowTimerId = null;
            }
        };

        var removeModalWatcher = function() {
            // de-register the watchers that are no longer required
            if (watchLocalUserAccessCameraAndMicrophoneStatus) {watchLocalUserAccessCameraAndMicrophoneStatus();}
            if (watchWhichModalIsOpen) {watchWhichModalIsOpen();}
        };

        var getWhichModalIsShown = function(scope) {
            return function() {
                // returns the modal that was most recently opened. The last element of the array
                // will always be the most recent, even if we asynchronously close
                // an existing modal, and open a new modal at the same time (since the previously existing modal
                // would appear earlier in the array than the new modal).
                var arr = scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown;
                var len = arr.length;
                if (len > 0) {
                    //$log.info('getWhichModalIsShown is: ' + arr[len-1]);
                    return arr[len-1];
                } else {
                    return null;
                }

            };
        };

        var watchCameraStatus = function(scope) {
            return function () {
                return scope.videoSignalingObject.localUserAccessCameraAndMicrophoneStatus;
            };
        };

        return {
            showModalsAndArrowsForGrantingCameraAndMicrophoneAccess: function(scope) {
                var videoSignalingObject = scope.videoSignalingObject;

                removeModalWatcher();

                // If the users's device and browser support webRTC, then show them instructions on how to access their
                // camera and microphone. Otherwise, they should already have been shown instructions from
                // lx-check-compatibility-directives, which would have told them what they need to do to access the site.
                if (lxCheckCompatibilityService.userDeviceBrowserAndVersionSupported) {

                    var arrowElem = null;

                    askForPermissionToCameraAndMicrophone(scope);

                    watchWhichModalIsOpen =
                        scope.$watch(getWhichModalIsShown(scope), function (whichModalIsOpen) {
                            // keep an eye on which modal is currently open, and if it changes then we will
                            // modify the notification arrow to point to the correct location, or to be removed if
                            // it is no longer needed.

                            if (whichModalIsOpen !== null) {
                                $log.log('showing arrow pointing to accept button. whichModalIsOpen is: ' + whichModalIsOpen);
                                arrowElem = showArrowPointingToWhereUserShouldLook(scope, videoSignalingObject);
                            } else {
                                // no dialog is shown, so no arrow needs to be shown either.
                                removeArrowAndAssociatedWatchers(arrowElem);
                            }
                        });

                    watchLocalUserAccessCameraAndMicrophoneStatus =
                        scope.$watch(watchCameraStatus(scope), function(cameraStatus, previousCameraStatus) {
                            $log.info('cameraStatus is: ' + cameraStatus + ' previousCameraStatus: ' + previousCameraStatus);
                            removeArrowAndAssociatedWatchers(arrowElem);

                            if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus === 'allowAccess') {
                                removeModalWatcher();
                                lxModalSupportService.closeModal(currentModalInstance); // remove most recent modal box
                            }
                            else {
                                // We are waiting for camera access. Since the cameraStatus has changed, we need to show a new modal.
                                showModalInstructionsForCameraAndMicrophone(scope,
                                    videoSignalingObject);
                            }
                        });
                }
            }
        };
    })
    .factory('lxCheckIfSystemSupportsWebRtcService',
    function(
        $templateCache,
        $modal,
        $log,
        lxCheckCompatibilityService,
        lxModalSupportService) {


        return {
            checkBrowserVersionToSeeIfGetUserMediaSupported: function () {

                var isSupported = true;

                if (lxCheckCompatibilityService.isIosDevice) {
                  if (!lxCheckCompatibilityService.isIosAndBrowserSupported) {
                    lxModalSupportService.showStandardModalWindowFromTemplateUrl('lx-template-cache/ios-browser-is-not-supported-modal.html');
                    isSupported = false;
                  }
                }
                else if (!lxCheckCompatibilityService.isSupportedBrowser) {
                    lxModalSupportService.showStandardModalWindowFromTemplateUrl('lx-template-cache/browser-is-not-supported-modal.html');
                    isSupported = false;
                }
                else if (!lxCheckCompatibilityService.browserVersionIsSupported) {
                    lxModalSupportService.showStandardModalWindowFromTemplateUrl('lx-template-cache/browser-version-is-not-supported-modal.html');
                    isSupported = false;
                }
                return isSupported;
            }
        };
    });
