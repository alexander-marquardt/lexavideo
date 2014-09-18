
'use strict';

angular.module('lxUserInputFeedback.directives', [])


.directive('lxPushInputValuesToScope', function($log) {

        var watchChildElemValue = function(childElem) {
            return function() {
                return childElem.value;
            }
        }

    return {
        restrict: 'A',
        link : function(scope, elem) {

            var inputElems = angular.element(elem).find('input');

            angular.forEach(inputElems, function(childElem) {

                $log.debug('input name: ' + childElem.name )

                var ngModelName = childElem.attributes['ng-model'].value;
                scope.$watch(watchChildElemValue(childElem), function(newVal) {
                    var child = childElem;
                    $log.debug('New value: ' + newVal);
                })
            })
        }
    }
});

