'use strict';

angular.module('lxCommon.services', [])
    .factory('lxTimerService', function() {

        return {
            getDelayFn : function() {
                // Returns a function that wraps a callback inside a timeout
                var timer = null;
                return function(callback, delay_ms){
                    clearTimeout (timer);
                    timer = setTimeout(callback, delay_ms);
                };
            }
        }
    });


