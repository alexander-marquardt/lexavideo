/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';

/* global $ */

angular.module('lxChatbox.directives', [])

.directive('lxShowChatMessagesDirective',

    function(
        $compile,
        $log,
        $timeout,
        lxSoundService,
        lxTimeService
        ) {

        var numMessagesIsShownToggle = true;
        var timerId;

        // function that stops the title from flashing the number of new messages, and that adjusts
        // the number of unseen messages to reflect that the user has just clicked on a chat panel whose messages
        // have now been "seen" and are therefore removed from the count.
        var stopFlashingTitleAndAdjustCount = function(scope, chatRoomId) {

            if (scope.chatPanelDict[chatRoomId].chatPanelIsCurrentlyVisible) {

                if (scope.chatPanelDict[chatRoomId].chatPanelIsGlued) {
                    scope.trackUnseenMessageCountObject.unseenMessageCount -= scope.chatPanelDict[chatRoomId].numMessagesSinceLastTimeBottomOfPanelWasViewed;
                    scope.chatPanelDict[chatRoomId].numMessagesSinceLastTimeBottomOfPanelWasViewed = 0;
                }
            }

            // remove blinking of the number of messages
            $timeout.cancel(timerId);
            document.title = $('#id-document-title-div').text();
            numMessagesIsShownToggle = true;
        };



        // Displays the number of messages received in the document title , and flashes the
        // number of messages to get the users attention.
        var showNumMessagesInDocumentTitle = function(trackUnseenMessageCountObject) {

            // show the number of messages in the document title.
            document.title = '(' + trackUnseenMessageCountObject.unseenMessageCount + ') ' + $('#id-document-title-div').text();

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
                        if (trackUnseenMessageCountObject.unseenMessageCount) {
                            if (numMessagesIsShownToggle) {
                                document.title = $('#id-document-title-div').text();
                            } else {
                                document.title = '(' + trackUnseenMessageCountObject.unseenMessageCount + ') ' + $('#id-document-title-div').text();
                            }
                        }
                        numMessagesIsShownToggle = !numMessagesIsShownToggle;
                        // after initial wait, start flashing every X seconds.
                        timeoutDelay = 1000;

                        timeoutFn();
                    }, timeoutDelay);
                };
                timeoutFn();
            }
        };


        return {
            restrict: 'A',
            link: function (scope, elem) {

                var timeString;
                var chatRoomId = scope.roomOccupancyObject.chatRoomId;


                var addMessageToDisplay = function(messagePayload, bubbleSide, transmittedSuccessBoolean) {
                    // message: The text that will be displayed to the user
                    // bubbleSide: 'left' (message sent) or 'right' (message received)
                    // transmittedSuccessBoolean: true or false. true if message sent/received correctly, false otherwise.



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
                        addMessageToDisplay(scope.sendMessagePayload, 'right', scope.sendMessagePayload.transmittedToServer);

                    }
                });

                scope.$watch(function(scope){
                    return scope.receivedChatMessageObject[chatRoomId].receivedMessageTime;
                }, function() {
                    if (scope.receivedChatMessageObject[chatRoomId].messageString) {

                        addMessageToDisplay(scope.receivedChatMessageObject[chatRoomId], 'left', true);

                        // The following code will keep track of "un-noticed" messages that the user has received
                        if (!scope.chatPanelDict[chatRoomId].chatPanelIsGlued || !scope.chatPanelDict[chatRoomId].chatPanelIsCurrentlyVisible ||
                            !scope.windowWatcher.isFocused) {
                            scope.chatPanelDict[chatRoomId].numMessagesSinceLastTimeBottomOfPanelWasViewed ++;
                            scope.trackUnseenMessageCountObject.unseenMessageCount++;
                        }

                        showNumMessagesInDocumentTitle(scope.trackUnseenMessageCountObject);

                    }
                });

//                scope.$watch('ackChatMessageObject.ackMessageUniqueId', function(ackMessageUniqueId) {
//                    if (ackMessageUniqueId) {
//                        updateMessageWithAcknowledgement(ackMessageUniqueId);
//                    }
//                });

                scope.$watch('windowWatcher.isFocused', function() {
                    stopFlashingTitleAndAdjustCount(scope, chatRoomId);
                    $log.log('chatPanelDict:' + angular.toJson(scope.chatPanelDict));
                    showNumMessagesInDocumentTitle(scope.trackUnseenMessageCountObject)
                });
            }
        };
    }
);