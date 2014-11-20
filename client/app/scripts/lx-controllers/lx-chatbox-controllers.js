/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';


angular.module('lxChatbox.controllers', [])

    .controller('lxChatboxMainCtrl',
    function (
        $anchorScroll,
        $location,
        $log,
        $scope,
        lxMessageService
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


        // initially keep the chat panel glued so that the most recent messages are shown.
        $scope.chatPanelIsGlued = true;

        // userHasClickedInChatPanelInput is used to give the user more flashes/sounds if they have not yet
        // clicked in the chat panel input.
        $scope.userHasAlreadyClickedInChatPanel = false;

        $scope.sendChatMessageFn = function() {

            var messageType = 'chatMessage';

            $scope.sendMessagePayload = {
                messageString: $scope.inputMessageString,

                // The following ID is unique because the user will never be physically able to send more than 1 message per millisecond
                messageUniqueId:  new Date().getTime()
            };

            var sendMessagePromise = lxMessageService.sendMessage(messageType, $scope.sendMessagePayload);
            sendMessagePromise.then(

                // message was successfully delivered to the server
                function() {
                    // clear the input box
                    $scope.inputMessageString = '';

                },

                // message was not delivered to the server
                function(response) {



                    if (response.data.statusString === 'otherUserNotInRoom') {
                        $scope.sendMessagePayload.messageString = '<span class="cl-text-danger "><b>Unable to deliver message.<br>There are no other users in this chat.</b></span><br> ' + $scope.inputMessageString;
                    } else {
                        $scope.sendMessagePayload.messageString = '<span class="cl-text-danger "><b>Server error. Message not delivered</b></span><br> ' + $scope.inputMessageString;
                    }
                }
            )['finally'](function () {
                // once the promise is resolved, update the sendMessageTime which will trigger some watchers
                $scope.sendMessageTime = new Date().getTime()
            });
        };
    }
);