/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';


angular.module('lxChatbox.controllers', [])

    .controller('lxChatboxMainCtrl',
    function (
        $scope,
        lxMessageService
        ) {
        $scope.msgObj = {};

        $scope.maxMsgLength = 10;

        $scope.sendMsg = function(msgObj) {

            var chatMessage = msgObj.messageString;
            var messageType = 'chatMessage';

            lxMessageService.sendMessage(messageType, chatMessage);

        }
    }
);