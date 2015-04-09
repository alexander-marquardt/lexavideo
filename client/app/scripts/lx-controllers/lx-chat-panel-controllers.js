/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';


angular.module('lxChatbox.controllers', [])

    .controller('lxChatPanelCtrl',
    function (
        $anchorScroll,
        $location,
        $log,
        $scope,
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


        /* sendChatMessageFn:
         *      Sends a chat message to other users.
         * toClientId:
         *      either the specific Id of the client that this message should be sent to, or
         *      the keyword: "sendMsgToEveryoneInTheChatRoom"
         */
        $scope.sendChatMessageFn = function(roomId) {

            var messageType = 'chatDataMsg';

            $scope.sendMessagePayload = {
                messageString: $scope.sendMessageFormScope.inputMessageString,

                // The following ID is unique because the user will never be physically able to send more than 1 message per millisecond
                messageUniqueId:  new Date().getTime(),

                transmittedToServer: null
            };

            var sendMessagePromise = lxMessageService.broadcastMessageToRoomFn(
                messageType, $scope.sendMessagePayload, $scope.lxMainViewCtrl.clientId, roomId);

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
                lxShowNumMessagesService.subtractNumMessagesSeen($scope.trackUnseenMessageCountObject, $scope.chatPanelDict[$scope.roomOccupancyObject.chatRoomId]);
            }
        });

        $scope.$watch('chatRoomDisplayObject.normalizedChatRoomNameFromUrl', function() {
           if ($scope.normalizedChatRoomName && $scope.chatRoomDisplayObject &&
               $scope.normalizedChatRoomName === $scope.chatRoomDisplayObject.normalizedChatRoomNameFromUrl) {

               $scope.chatPanelDict[$scope.roomOccupancyObject.chatRoomId].chatPanelIsCurrentlyVisible = true;
               $scope.chatRoomDisplayObject.chatPanelObject = $scope.chatPanelDict[$scope.roomOccupancyObject.chatRoomId];
           } else {
               $scope.chatPanelDict[$scope.roomOccupancyObject.chatRoomId].chatPanelIsCurrentlyVisible = false;
           }
        });
    });