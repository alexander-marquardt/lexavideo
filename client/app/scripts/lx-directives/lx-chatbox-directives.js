/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';



angular.module('lxChatbox.directives', [])

    .directive('lxShowChatMessagesDirective',

    function(
        $compile,
        $timeout
        ) {
        return {
            restrict: 'A',
            link: function (scope, elem) {



                var addMessageToDisplay = function(message, isSenderOrReceiver) {

                    var bubbleSide;
                    if (isSenderOrReceiver === 'sender') {
                        bubbleSide = 'left';
                    }
                    else if (isSenderOrReceiver === 'receiver') {
                        bubbleSide = 'right';
                    }
                    else {
                        throw new Error('Unknown isSenderOrReceiver value of: ' + isSenderOrReceiver);
                    }

                    var outerElement = angular.element('<div class="cl-fade-in-element">');
                    var messageElement = angular.element('<div  class="row cl-chat-row">');



                    messageElement.append(angular.element('<div class="col-xs-12 chat-body">')
                            .append(angular.element('<div class="bubble bubble-' + bubbleSide + '"><i></i>')
                                .append(message)
                                .append(angular.element('<small class="text-muted cl-chat-time-display">&nbsp;<span class="icon-lx-time">')
                                    .append('time')
                            )
                        )
                    );
                    outerElement.append(messageElement);

                    var compiledElement = $compile(outerElement)(scope);
                    elem.append(compiledElement);
                    $timeout(function() {
                        outerElement.addClass('cl-show-element');
                    });
                };

                // watch to see if the local user has sent a new chat message to the remote user
                scope.$watch('sendMessageString', function(newValue) {
                    if (newValue) {
                        addMessageToDisplay(newValue, 'sender');
                    }
                });

                scope.$watch('chatMessageObject.chatMessage', function(newValue) {
                    if (newValue) {
                        addMessageToDisplay(newValue, 'receiver');
                    }
                });
            }
        };
    }
);