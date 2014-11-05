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

                var window_focus;
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


                // function that removes the message counter from the document title, and resets the
                // message counter back to zero.
                var resetDocumentTitleToDefault = function() {
                    numMessagesReceivedSinceWindowLastActive = 0;
                    document.title = $('#id-document-title-div').text();
                    // remove blinking of the number of messages
                    $timeout.cancel(timerId);
                };


                // self-executing function that monitors the window to see if it has focus, and set the window_focus
                // variable appropriately
                (function setWindowFocus() {
                    $(window).focus(function() {
                        window_focus = true;
                        resetDocumentTitleToDefault();
                    }).blur(function() {
                        window_focus = false;
                    });
                })();


                // Displays the number of messages received in the document title , and flashes the
                // number of messages to get the users attention.
                var showNumMessagesInDocumentTitle = function() {
                    var numMessagesIsShownToggle = true;
                    // if the user is not looking at the current window, then show them how many messages
                    // they have missed while they were not paying attention.
                    if (!window_focus) {
                        document.title = '(' + numMessagesReceivedSinceWindowLastActive + ') ' + $('#id-document-title-div').text();

                        if (timerId) {
                            // a previous timer was running, so we remove it.
                            $timeout.cancel(timerId);
                        }

                        // don't start flashing until 10 seconds have passed.
                        var timeoutDelay = 10000;
                        // the following timer is used for switching between the title with and without the number of
                        // new messages included in the title.
                        var timeoutFn = function () {
                            timerId = $timeout(function () {
                                if (numMessagesIsShownToggle) {
                                    document.title = $('#id-document-title-div').text();

                                } else {
                                    // the arrow is now shown, display it for a while
                                    document.title = '(' + numMessagesReceivedSinceWindowLastActive + ') ' + $('#id-document-title-div').text();
                                }
                                numMessagesIsShownToggle = !numMessagesIsShownToggle;
                                // after initial wait, start flashing every 2 seconds.
                                timeoutDelay = 1000;

                                timeoutFn();
                            }, timeoutDelay);
                        };
                        timeoutFn();
                    }
                    // otherwise the user is currently looking at the window, and so we make sure that the
                    // display does not show number of messages and that the timer and counter are reset.
                    else {
                        resetDocumentTitleToDefault();
                    }
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

                var timerId;




                scope.$watch('chatMessageObject.receivedMessageStringTime', function(newValue) {
                    if (scope.chatMessageObject.receivedMessageString) {
                        addMessageToDisplay(scope.chatMessageObject.receivedMessageString, 'right', true);
                        numMessagesReceivedSinceWindowLastActive++;
                        showNumMessagesInDocumentTitle();
                    }
                });
            }
        };
    }
);