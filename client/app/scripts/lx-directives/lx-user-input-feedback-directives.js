
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
                        // if the user hits the backspace key and enters in a room name that is too short
                        // after previously entering in an invalid room name.
                        return inputElement.value
                    },
                    function(newVal) {
                        var roomObj = null;

                        ctrl.$setValidity('validRoom', true)
                        if (ctrl.$valid) {
                            if (newVal) {
                                roomObj = lxHandleRoomService.getRoom(newVal);
                            }

                            roomObj && roomObj.$promise.then(function(data) {
                                if (data.roomOccupancy == maxOccupancy) {
                                    ctrl.$setValidity('validRoom', false);
                                } else {
                                    ctrl.$setValidity('validRoom', true);
                                }
                                //ctrl.$setValidity('numInRoom', data.roomOccupancy)
                            })
                        } 
                    }
                );
            }
        }
    });

