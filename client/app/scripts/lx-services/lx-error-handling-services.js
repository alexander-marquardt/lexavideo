
'use strict';

/* global $ */

var lxErrorHandlingServices = angular.module('lxErrorHandling.services', []);


lxErrorHandlingServices.factory('serverLoggingService', function($window) {

    /* Logs an error to the server. This is executed by intercepting a call to $log.error.
     */
    function ajaxPost(serviceUrl, data) {
        // Log information to the server. Do not use angular to POST since angular
        // could itself be hosed.
        $.ajax({
            type: 'POST',
            url: serviceUrl,
            contentType: 'application/json',
            data: data
        });
    }

    return {
        logInformationToServer : function(infoObjectOrMessage, serviceUrl) {
            // serviceUrl should be either '/_lx/log_error' or '/_lx/log_info'

            // if this is called in response to an exception, then the first parameter is an object,
            // otherwise it is just an error message.

            var data;

            try {
                var browserInfo = $.browser;

                // This is the custom error content you send to server side
                if (infoObjectOrMessage.message) {
                    data = angular.toJson({
                        logMessage: infoObjectOrMessage.message,
                        infoUrl: $window.location.href,
                        stackTrace: infoObjectOrMessage.stack,
                        browserInfo: browserInfo
                    });
                } else {
                    data = angular.toJson({
                        logMessage: infoObjectOrMessage,
                        infoUrl: $window.location.href,
                        browserInfo: browserInfo
                    });
                }

                ajaxPost(serviceUrl, data);

            } catch (e) {
                console.log('Error in logInformationToServer: ' + e.message);
                try {
                    data = angular.toJson({logMessage: 'Serious error!!! logInformationToServer has an internal error.' + e.message});
                    ajaxPost('/_lx/log_error', data);
                } catch (e) {
                    console.log('Error in the error handler!!!');
                }
            }
        }
    };
});