
'use strict';

angular.module('lxUserInputFeedback.directives', [])

    .directive('ensureUnique', function($http) {
        return {
            require: 'ngModel',
            link: function() {

            }
        }
    });