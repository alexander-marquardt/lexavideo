'use strict';

/* global $ */

angular.module('lxBasicFunctionality.services', [])

.factory('lxJs',
function($log) {

    return {
        assert: function (condition, message) {
            if (!condition) {
                message = message || 'Assertion failed';
                if (typeof Error !== 'undefined') {
                    throw new Error(message);
                }
                throw message; // Fallback
            }
        },

        removeItemFromList: function(itemToRemove, listToModify) {

            if ($.inArray(itemToRemove, listToModify) !== -1) {
                var idx = listToModify.indexOf(itemToRemove);
                listToModify.splice(idx, 1);
            }
        }
    };
});
