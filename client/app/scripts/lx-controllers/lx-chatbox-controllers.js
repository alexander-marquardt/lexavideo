/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';


angular.module('lxChatbox.controllers', [])

    .controller('lxChatboxMainCtrl',
    function (
        $log,
        $scope,
        lxMessageService
        ) {

        // Note: inputMessageString is updated with each keyboard keypress. Therefore, this value is only used
        //       during input entry. Once the user has pressed "send", then we store the value from inputMessageString
        //       into sendMessageString, so that it can trigger watch events.
        $scope.inputMessageString = '';
        $scope.sendMessageString = '';

        $scope.maxMsgLength = 1000;

        $scope.sendChatMessageFn = function() {

            var chatMessage = $scope.inputMessageString ;

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