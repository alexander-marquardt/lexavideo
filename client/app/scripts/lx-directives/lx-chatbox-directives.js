/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';



angular.module('lxChatbox.directives', [])

    .directive('lxShowChatMessagesDirective',

    function(
        $compile,
        $timeout,
        lxTimeService
        ) {

        var flashChatboxNotificationTime = 500; //ms

        return {
            restrict: 'A',
            link: function (scope, elem) {

                var chatPanelBody = angular.element(elem).parent();
                var chatPanelHeadingElement = chatPanelBody.prev();
                var chatPanel = chatPanelBody.parent();

                var addMessageToDisplay = function(message, isSenderOrReceiver) {

                    var timeString = lxTimeService.getTimeString();

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

                    // The following code will "flash" the chat panel heading when the user is not looking at the bottom
                    // of their chat messages - this should help them notice when new messages have been received.
                    if (!scope.chatPanelIsGlued) {
                        chatPanelHeadingElement.addClass('cl-flash-chat-heading');
                        chatPanel.addClass('cl-primary-color-glow');

                        $timeout(function() {
                            chatPanelHeadingElement.removeClass('cl-flash-chat-heading');
                            chatPanel.removeClass('cl-primary-color-glow');
                        }, flashChatboxNotificationTime);
                    }

                    var outerElement = angular.element('<div class="cl-fade-in-chat-bubble-element">');
                    var messageElement = angular.element('<div  class="row cl-chat-row">');

                    messageElement.append(angular.element('<div class="col-xs-12 chat-body">')
                            .append(angular.element('<div class="bubble bubble-' + bubbleSide + '"><i></i>')
                                .append(message)
                                .append(angular.element('<span class="cl-chat-time-display">')
                                    .append('&nbsp;&nbsp;' + timeString)
                            )
                        )
                    );
                    outerElement.append(messageElement);

                    var compiledElement = $compile(outerElement)(scope);
                    elem.append(compiledElement);
                    $timeout(function() {
                        outerElement.addClass('cl-show-new-chat-bubble-element');

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