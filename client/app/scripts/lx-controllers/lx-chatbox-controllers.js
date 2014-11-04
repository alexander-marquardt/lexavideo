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

        // sendMessageStringTime is updated every time the user sends a message - this is necessary because
        // if we just watch sendMessageString for changes to trigger sending of the message, then the user will not be
        // able to send the same message twice.
        $scope.sendMessageStringTime = 0;
        $scope.sendMessageStringFailedTime = 0;

        $scope.maxMsgLength = 5000;

        $scope.sendChatMessageFn = function() {

            var chatMessage = $scope.inputMessageString ;
            var messageType = 'chatMessage';
            var sendMessagePromise = lxMessageService.sendMessage(messageType, chatMessage);

            sendMessagePromise.then(

                // message was successfully delivered to the server
                function() {

                    $scope.sendMessageStringTime = new Date().getTime();
                    $scope.sendMessageString = chatMessage;
                    // clear the input box
                    $scope.inputMessageString = '';
                },

                // message was not delivered to the server
                function(response) {
                    $scope.sendMessageStringFailedTime = new Date().getTime();

                    if (response.data.statusString === 'otherUserNotInRoom') {
                        $scope.sendMessageFailedString = '<span class="cl-text-danger "><b>Unable to deliver message.<br>There are no other users in this chat.</b></span><br> ' + chatMessage;
                    } else {
                         $scope.sendMessageFailedString = '<span class="cl-text-danger "><b>Server error. Message not delivered</b></span><br> ' + chatMessage;
                    }
                }
            );



        };
    }
);