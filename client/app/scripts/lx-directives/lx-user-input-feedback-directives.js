
'use strict';

angular.module('lxUserInputFeedback.directives', [])


.directive('lxMonitorFormInputsForErrors', function($log) {

    var highlightInput = function(inputElement) {

        var cssClass;
        if (inputElement.$invalid  && inputElement.$dirty ) {
            cssClass = 'cl-invalid-input-glow';
        }
        else if (inputElement.$valid && inputElement.$dirty) {
            cssClass = 'cl-valid-input-glow';
        }
        else {
            cssClass = '';
        }
        return cssClass;
    };

    return {
        restrict: 'A',
        link : function(scope, elem) {

            var inputElems = angular.element(elem).find('input');

            angular.forEach(inputElems, function(childElem) {
                var cssClass = highlightInput(childElem);
                $log.debug('input name: ' + childElem.name + 'class: ' + cssClass)

                var ngModelName = childElem.attributes['ng-model'].value;
                scope.$watch(childElem.value, function(newVal) {
                    var child = childElem;
                    $log.debug('New value: ' + newVal);
                })
            })
        }
    }
});

