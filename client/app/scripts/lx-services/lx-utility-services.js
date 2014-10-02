'use strict';

angular.module('lxUtility.services', [])
    .factory('lxTimerService', function() {

        return {
            getDelayFn : function() {
                // Returns a function that wraps a callback inside a timeout. This can be used
                // for ensuring that an action is only executed after a certain amount of time has passed
                // since the last call to the callback function.
                var timer = null;
                return function(callback, delayMs){
                    clearTimeout (timer);
                    timer = setTimeout(callback, delayMs);
                };
            }
        };
    });


