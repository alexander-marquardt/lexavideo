/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
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

