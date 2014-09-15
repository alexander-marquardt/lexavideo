
angular.module('videoApp')

    .config(function($provide){

        /* This decorator will intercept all $log calls, and replace them with customized logging. This is primarily
           Intended for capturing error events and sending these events to the server.
         */
        $provide.decorator('$log',function($delegate){

            var newLog = {};

            // copy existing log functions into the newLog object
            angular.extend(newLog, $delegate);

            newLog.error = function(){
                // override the standard $log.error function with this call
                $delegate.error.apply(null,arguments);
            };

            return newLog;
        });
    });

