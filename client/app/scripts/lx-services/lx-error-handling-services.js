
'use strict';

/* global $ */

var lxErrorHandlingServices = angular.module('lxErrorHandling.services', []);


lxErrorHandlingServices.factory('errorLogService', function($window) {

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
        logErrorToServer : function(errorObjectOrMessage, extraInfo) {

            // if this is called in response to an exception, then the first parameter is an object,
            // otherwise it is just an error message.

            var data;
            var serviceUrl = '/_lx/log_error';

            try {
                var browserInfo = $.browser;

                // This is the custom error content you send to server side
                if (errorObjectOrMessage.message) {
                    data = angular.toJson({
                        errorMessage: errorObjectOrMessage.message,
                        errorUrl: $window.location.href,
                        stackTrace: errorObjectOrMessage.stack,
                        extraInfo: extraInfo,
                        browserInfo: browserInfo
                    });
                } else {
                    data = angular.toJson({
                        errorMessage: errorObjectOrMessage,
                        errorUrl: $window.location.href,
                        browserInfo: browserInfo
                    });
                }

                ajaxPost(serviceUrl, data);

            } catch (e) {
                console.log('Error in logErrorToServer: ' + e.message);
                try {
                    data = angular.toJson({errorMessage: 'Serious error!!! logErrorToServer has an internal error.'});
                    ajaxPost(serviceUrl, data);
                } catch (e) {
                    console.log('Error in the error handler!!!');
                }
            }
        }
    };
});