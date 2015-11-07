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


angular.module('LxChatPanel.controllers', [])

    // Note: each panel has it's own LxChatPanelController.
    .controller('LxChatPanelController',
    function (
        $anchorScroll,
        $location,
        $log,
        $scope,
        lxChatRoomMembersService,
        lxHttpChannelService,
        lxMessageService,
        lxShowNumMessagesService
        ) {

        // Note: inputMessageString is updated with each keyboard keypress. Therefore, this value is only used
        //       during input entry. Once the user has pressed "send", then we store the value from inputMessageString
        //       into sendMessageString, so that it can trigger watch events.
        $scope.inputMessageString = '';
        $scope.sendMessageString = '';
        $scope.sendMessageFailedString = '';

        // sendMessageTimeSent is updated every time the user sends a message - this is necessary because
        // if we just watch sendMessageString for changes to trigger sending of the message, then the user will not be
        // able to send the same message twice.
        $scope.sendMessageStringTime = 0;
        $scope.sendMessageTimeFailed = 0;

        $scope.maxMsgLength = 5000;

        $scope.sendMessageFormScope = {};
        $scope.sendMessagePayload = {};

        $scope.removeClientFromRoomInterfaceFn = function(chatRoomNameNormalized) {
            lxChatRoomMembersService.removeClientFromRoom($scope, chatRoomNameNormalized);
        };

        /* sendChatMessageFn:
         *      Sends a chat message to other users.
         * toClientId:
         *      either the specific Id of the client that this message should be sent to, or
         *      the keyword: "sendMsgToEveryoneInTheChatRoom"
         */
        $scope.sendChatMessageFn = function(chatRoomId) {

            var messageType = 'chatTextMsg';

            $scope.sendMessagePayload = {
                messageString: $scope.sendMessageFormScope.inputMessageString,

                // The following ID is unique because the user will never be physically able to send more than 1 message per millisecond
                messageUniqueId:  new Date().getTime(),

                transmittedToServer: null
            };

            var sendMessagePromise = lxMessageService.broadcastMessageToRoomFn(
                messageType, $scope.sendMessagePayload, $scope.lxMainCtrlDataObj.clientId, chatRoomId);

            sendMessagePromise.then(

                // message was successfully delivered to the server
                function() {
                    // clear the input box
                    $scope.sendMessageFormScope.inputMessageString = '';
                    $scope.sendMessagePayload.transmittedToServer = true;
                },

                // message was not delivered to the server
                function() {

                    $scope.sendMessagePayload.transmittedToServer = false;
                    $scope.sendMessagePayload.messageString = '<span class="cl-text-danger "><b>Server error. Message not delivered</b></span><br> ' + $scope.sendMessageFormScope.inputMessageString;

                    // There is some kind of error with connectivity, perhaps the user was not recognized as being in the room that they
                    // have sent a message to. Send a heartbeat to the server to try to update the server so it knows that this
                    // client is now active. This should help the client on the next attempt to send a message, if they
                    // are able to get connectivity back.
                    lxHttpChannelService.sendSynHeartbeatToServer($scope.lxMainCtrlDataObj.clientId);
                }
            )['finally'](function () {
                // once the promise is resolved, update the sendMessageTime which will trigger some watchers.
                $scope.sendMessageTime = new Date().getTime();
            });
        };

        $scope.gluePanel = function() {
            lxShowNumMessagesService.subtractNumMessagesSeen($scope.trackUnseenMessageCountObject, $scope.chatPanelDict[$scope.roomOccupancyObject.chatRoomId]);
            $scope.chatPanelDict[$scope.roomOccupancyObject.chatRoomId].chatPanelIsGlued = true;
        };

        $scope.$watch(function(scope) {
            return scope.chatPanelDict[scope.roomOccupancyObject.chatRoomId].chatPanelIsGlued;
        }, function(chatPanelIsGlued) {
            if (chatPanelIsGlued) {
                lxShowNumMessagesService.subtractNumMessagesSeen($scope.trackUnseenMessageCountObject,
                    $scope.chatPanelDict[$scope.roomOccupancyObject.chatRoomId]);
            }
        });
    });
