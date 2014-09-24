'use strict';

angular.module('lxUtility.services', [])
    .factory('lxTimerService', function() {

        return {
            getDelayFn : function() {
                // Returns a function that wraps a callback inside a timeout
                var timer = null;
                return function(callback, delayMs){
                    clearTimeout (timer);
                    timer = setTimeout(callback, delayMs);
                };
            }
        };
    });


