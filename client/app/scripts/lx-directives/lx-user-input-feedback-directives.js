
'use strict';

/* global loginConstantsEmbeddedInHtml */

angular.module('lxUserInputFeedback.directives', [])

    .directive('checkForRoomOccupancy', function($log, lxHttpHandleRoomService, lxTimerService) {

        var maxOccupancy = loginConstantsEmbeddedInHtml.maxRoomOccupancy;
        var timeSinceLastKeypressBeforeHttpCall = 300; // time in milliseconds
        var delayAction = lxTimerService.getDelayFn();


        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, ctrl) {

                var inputElement = angular.element(elem)[0];


                /*
                 We watch the input element directly as opposed to the ngModel.$modelValue value,
                 because the ngModel value is only updated when all validity
                 conditions are met, which is not sufficient for providing up-to-date and accurate feedback
                 to the user. Eg. monitoring ngModel would not allow us to reset the roomIsFull variable
                 if the user hits the backspace key resulting in an invalid room name that is too short
                 (which therefore  would not update the ngModel value), after previously entering in a
                 valid room name.
                 */
                scope.$watch(function() {

                        return inputElement.value;
                    },


                    /*
                     When the user changes the text input, we provide feedback about the validity of the name that
                     they have selected.
                     */
                    function(newRoomName) {

                        var roomObj = null;


                        /*
                         Set roomIsFull 'isValid' to true (which means that the room is not full)
                         so that the following code will be executed only if none
                         of the other validity checks have failed.
                         Note: there is a confusing naming scheme used for the validity values, and in the html the $error.roomIsFull
                         that is accessed is the negation of the 'isValid' value that is set here (ie. if roomIsFull is
                         set to false, then the $error value will be true, and the user will be shown the message).

                         'roomIsFull' validity value will be set if all other validity checks have passed.
                         This prevents the user from receiving two conflicting feedback messages at the same time in the
                         case that they have entered in a string that is invalid, but that might be an available room.
                         */
                        ctrl.$setValidity('roomIsFull', true);

                        /*
                        Keep track of if the user is still typing or not, and while they are typing we disable the
                        submit button for creating/joining a room.
                        */
                        ctrl.userIsWaitingForRoomStatus = true;
                        ctrl.roomNotFullMessage = '';
                        ctrl.roomIsEmptyMessage = '';

                        if (ctrl.$valid) {
                            if (newRoomName) {

                                // We don't want to submit all characters as the user is typing. Only do the
                                // submit once the user has stopped typing or slowed down. This functionality
                                // is provided by the following wrapper.
                                delayAction(function() {

                                    // This is the GET call to the server that will return the status of the room as
                                    // will be indicated by resolution of the promise on the roomObj.
                                    roomObj = lxHttpHandleRoomService.getRoom(newRoomName);
                                    $log.debug('getRoom called for: ' + newRoomName);

                                    roomObj && roomObj.$promise.then(function(data) {

                                        // Modify validity and feedback only if this is a response to the most recently
                                        // typed roomName. This guards against a slow server response that could be
                                        // out-of-date if the user has typed in a new roomName before receiving the
                                        // response.
                                        if (data.roomName === inputElement.value) {

                                            if (data.numInRoom >= maxOccupancy) {
                                                ctrl.$setValidity('roomIsFull', false);
                                            } else {
                                                ctrl.$setValidity('roomIsFull', true);
                                            }

                                            if (data.numInRoom === 0) {
                                               ctrl.roomIsEmptyMessage = 'Room name is available!';
                                               ctrl.submitButtonText = 'Create!';
                                            }
                                            else if (data.numInRoom > 0 && data.numInRoom < maxOccupancy) {
                                                var msg = data.roomName + ' has ' + data.numInRoom + ' occupant';
                                                var plural = data.roomName + 's';
                                                ctrl.roomNotFullMessage =  data.numInRoom === 1 ? msg : plural;
                                                ctrl.submitButtonText = 'Join!';
                                            }
                                        }
                                        else {
                                            // This will likely occasionally happen, but if it happens too often then it is likely an indication
                                            // that something is going wrong
                                            $log.warn('Warning: room name ' + data.roomName +
                                                ' returned from server does not match most recently typed room name ' + inputElement.value);
                                        }
                                    }, function() {
                                        throw new Error('checkForRoomOccupancy - unknown server error');
                                    })
                                    ['finally'](function () {
                                        ctrl.userIsWaitingForRoomStatus = false;
                                    });  // jshint ignore:line

                                }, timeSinceLastKeypressBeforeHttpCall);
                            }

                        } else {
                            // This basically just acts as a place holder that will never really be clickable.
                            ctrl.submitButtonText = 'Enter!';
                        }
                    }
                );
            }
        };
    });

