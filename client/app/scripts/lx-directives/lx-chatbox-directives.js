/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';



angular.module('lxChatbox.directives', [])

    .directive('lxShowChatMessagesDirective',

    function() {
        return {
            restrict: 'A',
            templateUrl: 'lx-template-cache/wrapped-chat-message.html',
            link: function (scope) {

                // watch to see if the local user has sent a new chat message to the remote user
                scope.$watch('sendMessageString', function(newValue) {
                    scope.chatMessage = newValue;
                });
            }
        };
    }
);