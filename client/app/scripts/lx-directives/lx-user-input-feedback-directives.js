
'use strict';

angular.module('lxUserInputFeedback.directives', [])

    .directive('checkForRoomOccupancyDirective',
    function(
        $log,

        lxHttpHandleRoomService,
        lxLandingPageConstantsService,
        lxDelayActionService) {

        var timeSinceLastKeypressBeforeHttpCall = 300; // time in milliseconds
        var delayAction = lxDelayActionService.getDelayFn();


        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, ctrl) {

                // don't move maxOccupancy outside of the link function since it is not set until the
                // program begins execution.
                var maxOccupancy = lxLandingPageConstantsService.maxRoomOccupancy;

                var inputElement = angular.element(elem)[0];


                /*
                 We watch the input element directly as opposed to the ngModel.$modelValue value,
                 because the ngModel value is only updated when all validity
                 conditions are met, which is not sufficient for providing up-to-date and accurate feedback
                 to the user. Eg. monitoring ngModel would not allow us to reset the roomIsFull variable
                 if the user hits the backspace key resulting in an invalid room name that is too short
                 (which therefore  would not update the ngModel value), after previously entering in a
                 valid room name.

                 We also watch triggerGetNewRoom which will be toggled if we need to trigger the function
                 associated with this watcher.
                 */
                scope.$watch(

                    // Define the function that returns the value that is being watched for changes
                    function() {

                        return inputElement.value + scope.roomStatus.triggerGetNewRoom.toString();
                    },


                    /*
                     When the user changes the text input, we provide feedback about the validity of the name that
                     they have selected by checking if the name is available etc. This requires ajax calls to the
                     server.
                     */
                    function() {

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

                        // same logic applies to the networkOrServerError validity flag as to roomIsFull
                        ctrl.$setValidity('networkOrServerError', true);

                        /*
                        Keep track of if the user is still typing or not, and while they are typing we disable the
                        submit button for creating/joining a room.
                        */
                        ctrl.userIsWaitingForRoomStatus = true;
                        ctrl.roomNotFullMessage = '';
                        ctrl.roomIsEmptyMessage = '';

                        if (ctrl.$valid) {
                            if (inputElement.value) {

                                // We don't want to submit all characters as the user is typing. Only do the
                                // submit once the user has stopped typing or slowed down. This functionality
                                // is provided by the following wrapper.
                                delayAction(function() {

                                    // This is the GET call to the server that will return the status of the room as
                                    // will be indicated by resolution of the promise on the roomObj.
                                    roomObj = lxHttpHandleRoomService.getRoom(inputElement.value);
                                    $log.debug('getRoom called for: ' + inputElement.value);

                                    roomObj && roomObj.$promise.then(function(data) {

                                        // Modify validity and feedback only if this is a response to the most recently
                                        // typed chatRoomName. This guards against a slow server response that could be
                                        // out-of-date if the user has typed in a new chatRoomName before receiving the
                                        // response.
                                        if (data.chatRoomName === inputElement.value.toLowerCase()) {

                                            if (data.numInRoom >= maxOccupancy) {
                                                ctrl.$setValidity('roomIsFull', false);
                                            }
                                            else {
                                                ctrl.$setValidity('roomIsFull', true);

                                                if (data.roomIsRegistered === false || data.numInRoom === 0) {
                                                    ctrl.roomIsEmptyMessage = 'Private chat name is available!';
                                                    ctrl.submitButtonText = 'Create!';
                                                }
                                                else {
                                                    var msg = 'Chat ' + data.chatRoomName + ' has ' + data.numInRoom + ' occupant';
                                                    var plural = msg + 's';
                                                    ctrl.roomNotFullMessage = data.numInRoom === 1 ? msg : plural;
                                                    ctrl.submitButtonText = 'Join!';
                                                }
                                            }
                                        }
                                        else {
                                            // This will likely occasionally happen, but if it happens too often then it is likely an indication
                                            // that something is going wrong. This can occur because of server delay in responding
                                            // to recent requests. It is not serious and can be ignored.
                                            $log.warn('Warning: private chat name ' + data.chatRoomName +
                                                ' returned from server does not match most recently typed room name ' + inputElement.value);
                                        }

                                    }, function() {
                                        ctrl.$setValidity('networkOrServerError', false);
                                        $log.error('checkForRoomOccupancy - unknown network or server error');
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