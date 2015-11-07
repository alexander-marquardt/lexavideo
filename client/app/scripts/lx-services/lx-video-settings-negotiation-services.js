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

var lxSelectVideoTypePreferenceServices = angular.module('lxVideoNegotiation.services', []);


lxSelectVideoTypePreferenceServices.factory('lxAccessVideoElementsAndAccessCameraService',
    function(
        lxMessageService,
        lxJs
    ) {

        return {
            sendStatusOfVideoElementsEnabled: function(scope, localVideoElementsEnabled, toClientId) {

                /* localClientIsInitiatingVideoInformationExchange: If the client is initiating a request to start video, then we want
                 to know if the remote user has accepted the request. However, if the client is responding to
                 a remote request to start a video exchange, then we don't
                 want to request the remote user (who is the original initiator of the video exchange) to tell us if they
                 have accepted to transmit video, as doing so would cause circular requests and responses.
                 */

                lxJs.assert(toClientId, 'toClientId is not set');

                var messagePayload = {videoElementsEnabledAndCameraAccessRequested: localVideoElementsEnabled};
                lxMessageService.sendMessageToClientFn(
                    'videoExchangeStatusMsg',
                    messagePayload,
                    scope.lxMainCtrlDataObj.clientId,
                    toClientId
                );
            }
        };
    }
);