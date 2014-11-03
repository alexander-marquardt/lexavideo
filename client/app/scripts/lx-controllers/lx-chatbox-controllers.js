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

        // sendMessageStringToggle is toggled every time the user sends a message - this is necessary because
        // if we just watch sendMessageString for changes to trigger sending of the message, then the user will not be
        // able to send the same message twice.
        $scope.sendMessageStringToggle = false;

        $scope.maxMsgLength = 5000;

        $scope.sendChatMessageFn = function() {

            var chatMessage = $scope.inputMessageString ;
            $scope.sendMessageStringToggle = !$scope.sendMessageStringToggle;

            $scope.sendMessageString = chatMessage;
            var messageType = 'chatMessage';
            var sendMessagePromise = lxMessageService.sendMessage(messageType, chatMessage);

            sendMessagePromise.then(

                // message was successfully delivered to the server
                function() {
                    $log.debug(messageType + ' sendMessage success.');

                },

                // message was not delivered to the server
                function() {
                    $log.debug(messageType + ' sendMessage FAILURE.');
                }
            );

            // clear the input box
            $scope.inputMessageString = '';

        };
    }
);