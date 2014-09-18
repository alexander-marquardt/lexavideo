
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
                    function(newVal) {
                        var roomObj = null;

                        ctrl.$setValidity('validRoom', true);
                        ctrl.roomIsWaitingForJoiners = false;
                        if (ctrl.$valid) {
                            if (newVal) {
                                roomObj = lxHandleRoomService.getRoom(newVal);
                            }

                            roomObj && roomObj.$promise.then(function(data) {
                                if (data.numInRoom >= maxOccupancy) {
                                    ctrl.$setValidity('validRoom', false);
                                } else {
                                    ctrl.$setValidity('validRoom', true);
                                }
                                ctrl.roomIsWaitingForJoiners = (data.numInRoom > 0 && data.numInRoom < maxOccupancy);
                                ctrl.numInRoom = data.numInRoom;
                            }, function() {
                                throw new Error('Unknown server error');
                            })
                        }
                    }
                );
            }
        }
    });

