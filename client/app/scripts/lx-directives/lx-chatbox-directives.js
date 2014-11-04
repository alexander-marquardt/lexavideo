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

                var numMessagesReceivedSinceWindowLastActive = 0;
                var chatPanelBody = angular.element(elem).parent();
                var chatPanelHeadingElement = chatPanelBody.prev();
                var chatPanel = chatPanelBody.parent();

                var addMessageToDisplay = function(message, bubbleSide, transmittedSuccessBoolean) {
                    // message: The text that will be displayed to the user
                    // bubbleSide: 'left' (message sent) or 'right' (message received)
                    // transmittedSuccessBoolean: true or false. true if message sent/received correctly, false otherwise.

                    var timeString = lxTimeService.getTimeString();


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
                    var bubbleErrorClass = '';
                    if (!transmittedSuccessBoolean) {
                        bubbleErrorClass = 'bubble-error';
                    }

                    messageElement.append(angular.element('<div class="col-xs-12 chat-body">')
                            .append(angular.element('<div class="bubble bubble-' + bubbleSide + ' ' + bubbleErrorClass + '"><i></i>')
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
                scope.$watch('sendMessageStringTime', function() {
                    if (scope.sendMessageString) {
                        addMessageToDisplay(scope.sendMessageString, 'left', true);
                    }
                });

                scope.$watch('sendMessageStringFailedTime', function() {
                    if (scope.sendMessageFailedString) {
                        addMessageToDisplay(scope.sendMessageFailedString, 'left', false);
                    }
                });

                var window_focus;

                $(window).focus(function() {
                    window_focus = true;
                    numMessagesReceivedSinceWindowLastActive = 0;
                    document.title = $('#id-document-title-div').text();
                }).blur(function() {
                    window_focus = false;
                });


                scope.$watch('chatMessageObject.receivedMessageStringTime', function(newValue) {
                    if (scope.chatMessageObject.receivedMessageString) {
                        addMessageToDisplay(scope.chatMessageObject.receivedMessageString, 'right', true);
                        numMessagesReceivedSinceWindowLastActive ++;

                        if (!window_focus) {
                            document.title = '(' + numMessagesReceivedSinceWindowLastActive + ') ' + $('#id-document-title-div').text();
                        }
                    }
                });
            }
        };
    }
);