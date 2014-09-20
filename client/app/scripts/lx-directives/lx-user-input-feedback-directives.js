
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

                scope.$watch(function() {
                        // We watch the input element directly because the ngModel is only set when all validity
                        // conditions are met -- but this would not allow us to reset the roomIsFull variable
                        // if the user hits the backspace key resulting in a room name that is too short
                        // after previously entering in an invalid room name.
                        return inputElement.value;
                    },
                    function(newRoomName) {
                        /* When the user changes the text input, we provide feedback about the validity of the name that
                           they have selected.

                           Note: in the code below, the 'roomNotFullMessage' and 'roomIsEmptyMessage' are set in a manner
                           that minimizes UI flashing that could be caused if we were to reset these values on each
                           execution of this code.
                         */
                        var roomObj = null;



                        // Set roomIsFull 'isValid' to true so that the following code will be executed only if none
                        // of the other validity checks have failed.
                        // Note: there is a confusing naming scheme used for the validity values, and in the html the $error.roomIsFull
                        // that is accessed is the negation of the 'isValid' value that is set here (ie. if roomIsFull is
                        // set to false, then the $error value will be true, and the user will be shown the message).
                        //
                        // 'roomIsFull' validity value will be set if all other validity checks have passed.
                        // This prevents the user from receiving two conflicting feedback messages at the same time in the
                        // case that they have entered in a string that is invalid, but that might be an available room.
                        ctrl.$setValidity('roomIsFull', true);

                        // Keep track of if the user is still typing or not, and while they are typing we disable the
                        // submit button for creating/joining a room
                        ctrl.userIsWaitingForRoomStatus = true;

                        if (ctrl.$valid) {
                            if (newRoomName) {
                                delayAction(function() {


                                    // We don't want to submit all characters as the user is typing. Only do the
                                    // Http GET if the user has stopped typing or slowed down.
                                    roomObj = lxHttpHandleRoomService.getRoom(newRoomName);
                                    $log.debug('getRoom called for: ' + newRoomName);

                                    roomObj && roomObj.$promise.then(function(data) {
                                        if (data.numInRoom >= maxOccupancy) {
                                            ctrl.$setValidity('roomIsFull', false);
                                        } else {
                                            ctrl.$setValidity('roomIsFull', true);
                                        }

                                        if (data.numInRoom === 0) {
                                           ctrl.roomIsEmptyMessage = 'Room is available!';
                                           ctrl.roomNotFullMessage = '';
                                           ctrl.submitButtonText = 'Create!';
                                        }
                                        else if (data.numInRoom > 0 && data.numInRoom < maxOccupancy) {
                                            var msg = newRoomName + ' has ' + data.numInRoom + ' occupant';
                                            var plural = newRoomName + 's';
                                            ctrl.roomNotFullMessage =  data.numInRoom === 1 ? msg : plural;
                                            ctrl.roomIsEmptyMessage = '';
                                            ctrl.submitButtonText = 'Join!';
                                        } else {
                                            ctrl.roomNotFullMessage = '';
                                            ctrl.roomIsEmptyMessage = '';
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
                            ctrl.roomNotFullMessage = '';
                            ctrl.roomIsEmptyMessage = '';
                            ctrl.submitButtonText = 'Enter!';
                        }
                    }
                );
            }
        };
    });

