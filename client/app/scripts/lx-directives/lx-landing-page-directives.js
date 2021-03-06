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

angular.module('lxLandingPage.directives', [])

    .directive('lxShowInstructionsModalOnClickDirective',
    function(
        lxModalSupportService
        ){
        return {
            restrict: 'A',
            link: function(scope, elem, attrs) {

                var handler = function(event) {
                    lxModalSupportService.showStandardModalWindowFromTemplateUrl('lx-how-to-use-chatsurfing-template-cache.html');
                };

                elem.on('click', handler);

                scope.$on('$destroy', function() {
                    elem.off('click', handler);
                });
            }
        }
    })

    .directive('checkForRoomOccupancyDirective',
    function(
        $log,
        gettextCatalog,
        lxHttpHandleRoomService,
        lxLandingPageConstantsService,
        lxDelayActionService) {

        var timeSinceLastKeypressBeforeHttpCall = 300; // time in milliseconds
        var delayAction = lxDelayActionService.getDelayFn();


        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, ctrl) {

                var inputElement = angular.element(elem)[0];

                /*
                 We watch the input element directly as opposed to the ngModel.$modelValue value,
                 because the ngModel value is only updated when all validity
                 conditions are met, which is not sufficient for providing up-to-date and accurate feedback
                 to the user. Eg. monitoring ngModel would not allow us to reset the roomNumOccupantsMessage variable
                 if the user hits the backspace key resulting in an invalid room name that is too short
                 (which therefore  would not update the ngModel value), after previously entering in a
                 valid room name.

                 */
                scope.$watch(

                    // Define the function that returns the value that is being watched for changes
                    function() {

                        return inputElement.value;
                    },


                    /*
                     When the user changes the text input, we provide feedback about the validity of the name that
                     they have selected by checking if the name is available etc. This requires ajax calls to the
                     server.
                     */
                    function() {

                        var checkIfRoomExistsPromise = null;

                        /*
                         Note: there is a confusing naming scheme used for the validity values, and in the html the $error.checkForRoomOccupancyIsOk
                         that is accessed is the negation of the 'isValid' value that is set here (ie. if checkForRoomOccupancyIsOk is
                         set to false, then the $error value will be true, and the user will be shown the error message).
                         */
                        ctrl.$setValidity('checkForRoomOccupancyIsOk', true);

                        /*
                        Keep track of if the user is still typing or not, and while they are typing we disable the
                        submit button for creating/joining a room.
                        */
                        ctrl.userIsWaitingForRoomStatus = true;
                        ctrl.roomNumOccupantsMessage = '';
                        ctrl.roomIsEmptyMessage = '';
                        ctrl.inputCssClass = '';

                        if (ctrl.$valid) {
                            if (inputElement.value) {

                                // We don't want to submit all characters as the user is typing. Only do the
                                // submit once the user has stopped typing or slowed down. This functionality
                                // is provided by the following wrapper.
                                delayAction(function() {

                                    // This is the GET call to the server that will return the status of the room as
                                    // will be indicated by resolution of getRoomPromise.
                                    checkIfRoomExistsPromise = lxHttpHandleRoomService.checkIfRoomExists(inputElement.value);
                                    $log.debug('checkIfRoomExists called for: ' + inputElement.value);

                                    checkIfRoomExistsPromise.then(function(response) {

                                        // Modify validity and feedback only if this is a response to the most recently
                                        // typed chatRoomName. This guards against a slow server response that could be
                                        // out-of-date if the user has typed in a new chatRoomName before receiving the
                                        // response.
                                        if (response.data.chatRoomName === inputElement.value.toLowerCase()) {

                                            if (response.data.roomIsRegistered === false || response.data.numInRoom === 0) {
                                                ctrl.roomIsEmptyMessage = gettextCatalog.getString('Chat room name is available!');
                                                ctrl.submitButtonText = gettextCatalog.getString('Create!');
                                                ctrl.inputCssClass = 'cl-valid-input-glow';
                                            }
                                            else {
                                                var msg = 'Chat ' + response.data.chatRoomName + ' has ' + response.data.numInRoom + ' occupant';
                                                var plural = msg + 's';
                                                ctrl.roomNumOccupantsMessage = response.data.numInRoom === 1 ? msg : plural;
                                                ctrl.submitButtonText = gettextCatalog.getString('Join!');
                                                ctrl.inputCssClass = 'cl-warning-input-glow'
                                            }
                                        }
                                        else {
                                            // This will likely occasionally happen, but if it happens too often then it is likely an indication
                                            // that something is going wrong. This can occur because of server delay in responding
                                            // to recent requests. It is not serious and can be ignored.
                                            $log.warn('Warning: chat room name ' + response.data.chatRoomName +
                                                ' returned from server does not match most recently typed room name ' + inputElement.value);
                                        }

                                    }, function(response) {
                                        ctrl.$setValidity('checkForRoomOccupancyIsOk', false);
                                        $log.error('checkForRoomOccupancy - Error: ' + response.statusText);
                                    })
                                    ['finally'](function () {
                                        ctrl.userIsWaitingForRoomStatus = false;
                                    });  // jshint ignore:line

                                }, timeSinceLastKeypressBeforeHttpCall);
                            }

                        } else {
                            // This basically just acts as a place holder that will never really be clickable.
                            ctrl.submitButtonText = gettextCatalog.getString('Enter!');
                            if (ctrl.$dirty ) {
                                ctrl.inputCssClass = 'cl-invalid-input-glow';
                            }
                        }
                    }
                );
            }
        };
    });