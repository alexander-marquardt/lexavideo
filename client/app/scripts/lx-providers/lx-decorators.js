

'use strict';

angular.module('videoApp')

    .config(function($provide){

        /* This decorator will intercept all $log calls, and replace them with customized logging. This is primarily
           Intended for capturing error events and sending these events to the server.
         */
        $provide.decorator('$log',['$delegate', 'lxServerLoggingService', function($delegate, lxServerLoggingService){

            var newLog = {};

            // copy existing log functions into the newLog object
            angular.extend(newLog, $delegate);

            newLog.error = function(){
                //  This call overrides $log.error
                $delegate.error.apply(null, arguments);

                var args = Array.prototype.slice.call(arguments);
                args.push('/_lx/log_error');
                // Execute function to log the error to the server
                lxServerLoggingService.logInformationToServer.apply(null, args);
            };

            return newLog;
        }]);
    });

