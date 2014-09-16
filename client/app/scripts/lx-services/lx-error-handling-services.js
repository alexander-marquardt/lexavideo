
/* global $ */

var lxErrorHandlingServices = angular.module('lxErrorHandling.services', []);


lxErrorHandlingServices.factory('errorLogService', function($window) {

    /* Logs an error to the server. This is executed by intercepting a call to $log.error.
     */
    function ajaxPost(serviceUrl, data) {
        // Log information to the server. Do not use angular to POST since angular
        // could itself be hosed.
        $.ajax({
            type: "POST",
            url: serviceUrl,
            contentType: "application/json",
            data: data
        });
    }

    return {
        logErrorToServer : function(errorObject, extraInfo) {

            // Read from configuration
            var data;
            var serviceUrl = "/_lx/log_error";

            try {
                var browserInfo = $.browser;

                // This is the custom error content you send to server side
                data = angular.toJson({
                    errorMessage: errorObject.message,
                    errorUrl: $window.location.href,
                    stackTrace: errorObject.stack,
                    extraInfo: extraInfo,
                    browserInfo: browserInfo
                });

                ajaxPost(serviceUrl, data);

            } catch (e) {
                console.log('Error in logErrorToServer: ' + e);
                try {
                    data = angular.toJson({errorMessage: 'Serious error!!! logErrorToServer has an internal error.'});
                    ajaxPost(serviceUrl, data);
                } catch (e) {
                    console.log("Error in the error handler!!!");
                }
            }
        }
    }
});