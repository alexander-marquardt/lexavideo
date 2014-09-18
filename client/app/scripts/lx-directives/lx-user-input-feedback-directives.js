
'use strict';

angular.module('lxUserInputFeedback.directives', [])

    .directive('ensureUnique', function(lxHandleRoomService) {

        var maxOccupancy = 2;

        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, ctrl) {

                    scope.$watch(attrs.ngModel, function(newVal) {
                        var roomObj = null;
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
                    });
            }
        }
    });