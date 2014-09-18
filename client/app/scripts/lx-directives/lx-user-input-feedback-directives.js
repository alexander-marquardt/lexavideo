
'use strict';

angular.module('lxUserInputFeedback.directives', [])

    .directive('checkForUniqueRoomName', function($parse, lxHandleRoomService) {

        var maxOccupancy = 2;

        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, ctrl) {

                var inputElement = angular.element(elem)[0];

                scope.$watch(function() {
                        // We watch the input element directly because the ngModel is only set when all validity
                        // conditions are met -- but this would not allow us to reset the validRoom variable
                        // if the user hits the backspace key resulting in a room name that is too short
                        // after previously entering in an invalid room name.
                        return inputElement.value
                    },
                    function(newRoomName) {
                        var roomObj = null;

                        ctrl.$setValidity('validRoom', true);
                        ctrl.roomNotFullMessage = '';
                        ctrl.roomIsEmptyMessage = '';

                        if (ctrl.$valid) {
                            if (newRoomName) {
                                roomObj = lxHandleRoomService.getRoom(newRoomName);
                            }

                            roomObj && roomObj.$promise.then(function(data) {
                                if (data.numInRoom >= maxOccupancy) {
                                    ctrl.$setValidity('validRoom', false);
                                } else {
                                    ctrl.$setValidity('validRoom', true);
                                }

                                if (data.numInRoom === 0) {
                                   ctrl.roomIsEmptyMessage = 'Room is available!'
                                }
                                else if (data.numInRoom > 0 && data.numInRoom < maxOccupancy) {
                                    var msg = newRoomName + ' has ' + data.numInRoom + ' occupant';
                                    var plural = newRoomName + 's';
                                    ctrl.roomNotFullMessage =  data.numInRoom === 1 ? msg : plural;
                                }



                            }, function() {
                                throw new Error('Unknown server error');
                            })
                        }
                    }
                );
            }
        }
    });

