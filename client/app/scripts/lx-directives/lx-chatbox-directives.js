/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';

/* global $ */

angular.module('lxChatbox.directives', [])

.directive('lxShowChatMessagesDirective',

    function(
        $compile,
        $timeout,
        lxSoundService,
        lxTimeService
        ) {

        var flashChatboxNotificationTime = 500; //ms
        var windowFocus = true;
        var numMessagesReceivedSinceLastWindowFocus = 0;
        var numMessagesIsShownToggle = true;
        var timerId;

        // function that removes the message counter from the document title, and resets the
        // message counter back to zero.
        var resetDocumentTitleToDefault = function() {
            numMessagesReceivedSinceLastWindowFocus = 0;
            document.title = $('#id-document-title-div').text();
            // remove blinking of the number of messages
            $timeout.cancel(timerId);
        };

        // self-executing function that monitors the window to see if it has focus, and set the windowFocus
        // variable appropriately
        (function setWindowFocus() {
            $(window).focus(function() {
                windowFocus = true;
                resetDocumentTitleToDefault();
            }).blur(function() {
                windowFocus = false;
            });
        })();


        var playSoundOnMessage = function() {
            if (lxSoundService.canPlayMp3) {
                var sound = new Audio('/sounds/croak.mp3');
                sound.volume = 0.3;
                sound.play();
            }
        };

        // Displays the number of messages received in the document title , and flashes the
        // number of messages to get the users attention.
        var showNumMessagesInDocumentTitle = function() {

            // show the number of messages in the document title.
            document.title = '(' + numMessagesReceivedSinceLastWindowFocus + ') ' + $('#id-document-title-div').text();

            // The remainder of this code deals with making the number of messages flash in the document title.
            // First, check to see if the title is already flashing by seeing if timerId has been set. If it is already
            // flashing, then don't start any new timer-loops.
            if (!timerId) {
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
                            document.title = '(' + numMessagesReceivedSinceLastWindowFocus + ') ' + $('#id-document-title-div').text();
                        }
                        numMessagesIsShownToggle = !numMessagesIsShownToggle;
                        // after initial wait, start flashing every 2 seconds.
                        timeoutDelay = 1000;

                        timeoutFn();
                    }, timeoutDelay);
                };
                timeoutFn();
            }
        };

        // Add classes that will make the chat panel "flash". Note that timeouts are necessary because
        // css transitions work depending on the transition class being defined on the element before
        // the actual transition event occurs.
        var flashChatPanel = function(chatPanel, chatPanelHeadingElement) {
            chatPanelHeadingElement.addClass('cl-flash-chat-heading');
            chatPanel.addClass('cl-chatbox-glow');
            $timeout(function() {
                chatPanelHeadingElement.removeClass('cl-flash-chat-heading');
                chatPanel.removeClass('cl-chatbox-glow');
            }, flashChatboxNotificationTime);

        };

        return {
            restrict: 'A',
            link: function (scope, elem) {

                var timeString;
                var chatPanelBody = angular.element(elem).parent();
                var chatPanelHeadingElement = chatPanelBody.prev();
                var chatPanel = chatPanelBody.parent();

                var addMessageToDisplay = function(messagePayload, bubbleSide, transmittedSuccessBoolean) {
                    // message: The text that will be displayed to the user
                    // bubbleSide: 'left' (message sent) or 'right' (message received)
                    // transmittedSuccessBoolean: true or false. true if message sent/received correctly, false otherwise.



                    // The following code will "flash" the chat panel heading when the user is not looking at the bottom
                    // of their chat messages, or when the current window does not have focus or when the user has not
                    // yet noticed the chat panel messages (as indicated by them not having yet clicked anywhere in
                    // the chat panel)
                    // This should help them notice when new messages have been received.
                    if (!scope.chatPanelIsGlued || !windowFocus || !scope.userHasAlreadyClickedInChatPanel) {
                        flashChatPanel(chatPanel, chatPanelHeadingElement);
                        playSoundOnMessage();
                    }

                    var outerElement = angular.element('<div class="cl-fade-in-chat-bubble-element">');
                    var messageElement = angular.element('<div  class="row cl-chat-row">');
                    var bubbleErrorClass = '';
                    if (!transmittedSuccessBoolean) {
                        bubbleErrorClass = 'bubble-error';
                    }


//                    // The messageIdHtml is used for finding this message when an acknowledgement is received from
//                    // the remote client. Note that the ack will be the messageUniqueId, which allows us to precisely
//                    // locate the associated element..
//                    var messageIdHtml = '';
//                    if ('messageUniqueId' in messagePayload) {
//                        messageIdHtml = 'id="id-msg-' + messagePayload.messageUniqueId + '"';
//                        // show a clock icon, that indicates that the message has not been delivered yet - this will
//                        // later be replaced by the time if the message is delivered.
//                        timeString = '<span class="icon-lx-time">&nbsp;</span>';
//                    }
//
//                    // This message doesn't have a unique Id, and so will not receive an acknowledgement - so we show
//                    // the current time - this will be the case for received messages.
//                    else {
//                        timeString = lxTimeService.getTimeString();
//                    }
                    var messageIdHtml = 'id="id-msg-' + messagePayload.messageUniqueId + '"';
                    timeString = lxTimeService.getTimeString();

                    messageElement.append(angular.element('<div class="col-xs-12 chat-body">')
                            .append(angular.element('<div class="bubble bubble-' + bubbleSide + ' ' + bubbleErrorClass + '"><i></i>')
                                .append(angular.element('<div ' + messageIdHtml + '>')
                                    .append(messagePayload.messageString)
                                    .append(angular.element('<span class="cl-chat-time-display">')
                                        .append('&nbsp;&nbsp;' + timeString)
                                )
                            )
                        )
                    );
                    outerElement.append(messageElement);

                    elem.append(outerElement);
//                    $timeout(function() {
//                        // only if this message is not waiting for an ack should we show it immediately. Otherwise,
//                        // we should wait for the ack signal, which comes in the form of a messageUniqueId value.
//                        if (! ('messageUniqueId' in messagePayload)) {
//                            outerElement.addClass('cl-show-new-chat-bubble-element');
//                        }
//
//                    });
                    $timeout(function() {
                        outerElement.addClass('cl-show-new-chat-bubble-element');
                    });
                };

                // Find the message that has been acknowledged, and update it to show the time instead of the clock
                // icon
//                var updateMessageWithAcknowledgement = function(ackMessageUniqueId) {
//                    var timeString = lxTimeService.getTimeString();
//                    var msgElem = chatPanelBody.find('#id-msg-' + ackMessageUniqueId);
//                    var timeSpanElem = msgElem.find('.cl-chat-time-display');
//                    timeSpanElem.html('&nbsp;&nbsp;' + timeString + ' <span class="icon-lx-check-mark"></span>');
//
//                    var outerElement = msgElem.parents('.cl-fade-in-chat-bubble-element');
//                    outerElement.addClass('cl-show-new-chat-bubble-element');
//                };

                // watch to see if the local user has sent a new chat message to the remote user
                scope.$watch('sendMessageTime', function() {
                    if (scope.sendMessagePayload.messageString) {
                        addMessageToDisplay(scope.sendMessagePayload, 'left', scope.sendMessagePayload.transmittedToServer);
                    }
                });

                scope.$watch('receivedChatMessageObject.receivedMessageTime', function() {
                    if (scope.receivedChatMessageObject.messageString) {
                        addMessageToDisplay(scope.receivedChatMessageObject, 'right', true);
                        // if the user is not looking at the current window, then show them how many messages
                        // they have missed while they were not paying attention.
                        if (!windowFocus) {
                            numMessagesReceivedSinceLastWindowFocus++;
                            showNumMessagesInDocumentTitle();

                        } else {
                            numMessagesReceivedSinceLastWindowFocus = 0;
                        }
                    }
                });

//                scope.$watch('ackChatMessageObject.ackMessageUniqueId', function(ackMessageUniqueId) {
//                    if (ackMessageUniqueId) {
//                        updateMessageWithAcknowledgement(ackMessageUniqueId);
//                    }
//                });
            }
        };
    }
);