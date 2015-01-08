'use strict';

angular.module('lxBasicFunctionality.services', [])

.factory('lxJs',
function() {

    return {
        assert: function (condition, message) {
            if (!condition) {
                message = message || 'Assertion failed';
                if (typeof Error !== 'undefined') {
                    throw new Error(message);
                }
                throw message; // Fallback
            }
        }
    };
});
