/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/

'use strict';

/* global $ */

var lxErrorHandlingServices = angular.module('lxErrorHandling.services', []);


lxErrorHandlingServices.factory('lxServerLoggingService', function(
    $window
    ) {

    /* Logs an error to the server. This is executed by intercepting a call to $log.error.
     */
    function ajaxPost(serviceUrl, data) {
        // Log information to the server. Do not use angular to POST since angular
        // could itself be hosed.

        console.log('Logging to server URL '+ serviceUrl + '\n' + JSON.stringify(data));
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