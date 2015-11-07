/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/

'use strict';

/* global $ */

angular.module('lxChatbox.directives', [])

.directive('lxSetChatPanelMessageVisibilityDirective',

    function(

        ) {


        return {
            restrict: 'A',
            link: function (scope, elem) {

                scope.$watch(function() {
                        var returnVal =
                        scope.chatboxPanelElementObject.videoIsFocused.toString() +
                        scope.chatboxPanelElementObject.showFullChatHistory.toString() +
                        scope.videoStateInfoObject.numOpenVideoExchanges.toString();
                        return returnVal;
                },
                function() {

                    var showFullHistoryCssClass = 'cl-chat-panel-show-full-chat-history';
                    var showPartialHistoryCssClass = 'cl-chat-panel-show-partial-chat-history';

                    elem.removeClass(showFullHistoryCssClass);
                    elem.removeClass(showPartialHistoryCssClass);

                    // Figures out which css class to apply to the chat panel, based on the users current activity.
                    if (scope.chatboxPanelElementObject.showFullChatHistory || scope.videoStateInfoObject.numOpenVideoExchanges === 0) {
                        elem.addClass(showFullHistoryCssClass);
                    }
                    else if (!scope.chatboxPanelElementObject.videoIsFocused) {
                        elem.addClass(showPartialHistoryCssClass);
                    }
                });
            }
        };
    })


/* We want the user to be able to click / select text in the chat bubbles without the event bubbling up
   to outer layers, as this would cause the video to immediately be shown and the chat messages to be hidden.
     */
.directive('lxHandleMouseEventsInChatPanel',

    function(
            $log
        ) {
        return {
            restrict: 'A',
            link: function (scope, elem) {

                var handler = function(event) {
                   var $target = $(event.target);
                    $log.log($target.attr('class'));
                    if ($target.hasClass('cl-bubble') || $target.hasClass('cl-chat-message-time')) {
                        $log.debug('bubble event detected');
                        event.stopPropagation();
                    }
                    else {
                        scope.$apply(function() {
                            scope.chatboxPanelElementObject.videoIsFocused = true;
                        });
                    }
                };
                // 1) catch mousedown/touchstart events so that the ng-swipe events are not triggered if the user is trying to
                // copy text from the chat bubble.
                // 2) catch click events so that if user clicks on the chat bubble, that we don't treat it as a click
                // on the video element.
                var events = 'mousedown.lxHandleMouseEventsInChatPanel  touchstart.lxHandleMouseEventsInChatPanel click.lxHandleMouseEventsInChatPanel';
                elem.on(events, handler);

                scope.$on('$destroy', function() {
                    elem.off(events, handler);
                });
            }
        };
    })

.directive('lxShowChatMessagesDirective',

    function(
        $compile,
        $log,
        $timeout,
        gettextCatalog,
        lxShowNumMessagesService,
        lxSoundService,
        lxTimeService,
        lxWindowFocus
        ) {



        return {
            restrict: 'A',
            link: function (scope, elem) {

                var timeString;
                var chatRoomId = scope.roomOccupancyObject.chatRoomId;
                var channelDeadMsgPayload;


                var addMessageToDisplay = function(messagePayload, bubbleSide, transmittedSuccessBoolean) {
                    // message: The text that will be displayed to the user
                    // bubbleSide: 'left' (message sent) or 'right' (message received)
                    // transmittedSuccessBoolean: true or false. true if message sent/received correctly, false otherwise.

                    var messageDivId;

                    var defaultNumMessagesToShow = 3;
                    var maxOpacity = 0.75;
                    var messageElement;
                    for (var idx=defaultNumMessagesToShow; idx > 0; idx--) {
                        messageDivId = 'id-most-recent-message-div-' + idx;

                        // Find previous element that has the id, and if it exists, then remove the old ID
                        // and give it a new one that is one numer higher
                        messageElement = elem.find('#' + messageDivId);
                        if (messageElement.length > 0) {

                            // Check if this message will be pushed out of the current "default" messages displayed
                            if (idx === defaultNumMessagesToShow) {
                                messageElement.removeAttr('id');
                                messageElement.css('display', 'none');
                            }

                            // This message is already in the display, but we need to give it a new id and
                            // to change it's opacity to a lower value than what it previously had.
                            else {
                                var NewId = 'id-most-recent-message-div-' + (idx + 1);
                                messageElement.attr('id', NewId);
                                messageElement.css('opacity', maxOpacity *  (1 - (idx / defaultNumMessagesToShow)));
                            }
                        }
                    }

                    // create a new message element
                    messageDivId = 'id-most-recent-message-div-1';
                    messageElement = angular.element('<div  class="row cl-chat-row cl-chat-message-div">');
                    messageElement.attr('id', messageDivId);
                    messageElement.css('opacity', maxOpacity);


                    var bubbleErrorClass = '';
                    if (!transmittedSuccessBoolean) {
                        bubbleErrorClass = 'cl-bubble-error';
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
//                    var messageIdHtml = 'id="id-msg-' + messagePayload.messageUniqueId + '"';
                    timeString = lxTimeService.getTimeString();

                    messageElement.append(angular.element('<div class="col-xs-12">')
                            .append(angular.element('<div class="cl-bubble cl-bubble-' + bubbleSide + ' ' + bubbleErrorClass + '"><i></i>')
                                .append(messagePayload.messageString)
                                .append(angular.element('<span class="cl-chat-message-time">')
                                    .append('&nbsp;&nbsp;' + timeString + '&nbsp;&nbsp;' + messagePayload.senderNameAsWritten)
                            )
                        )
                    );

                    elem.append(messageElement);
//                    $timeout(function() {
//                        // only if this message is not waiting for an ack should we show it immediately. Otherwise,
//                        // we should wait for the ack signal, which comes in the form of a messageUniqueId value.
//                        if (! ('messageUniqueId' in messagePayload)) {
//                            outerElement.addClass('cl-show-new-chat-bubble-element');
//                        }
//
//                    });
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
                        scope.sendMessagePayload.senderNameAsWritten = scope.lxMainCtrlDataObj.usernameAsWritten;
                        addMessageToDisplay(scope.sendMessagePayload, 'right', scope.sendMessagePayload.transmittedToServer);
                    }
                });

                scope.$watch(function(scope){
                    return scope.receivedChatMessageObject[chatRoomId].receivedMessageTime;
                }, function() {
                    if (scope.receivedChatMessageObject[chatRoomId].messageString) {

                        addMessageToDisplay(scope.receivedChatMessageObject[chatRoomId], 'left', true);

                        // The following code will keep track of "un-noticed" messages that the user has received.
                        // All messages received while the user is not "focused" on the input element of the associated
                        // chat panel are considered un-noticed.
                        if (scope.chatPanelDict[chatRoomId].chatRoomNameNormalized !== scope.chatRoomDisplayObject.chatRoomNameNormalizedFromUrl ||
                            scope.chatboxPanelElementObject.videoIsFocused ||
                            !lxWindowFocus.windowIsFocusedFn()) {

                            scope.chatPanelDict[chatRoomId].numMessagesSinceLastTimeBottomOfPanelWasViewed ++;
                            scope.trackUnseenMessageCountObject.unseenMessageCount++;
                        }

                        lxShowNumMessagesService.showNumMessagesInDocumentTitle(scope.trackUnseenMessageCountObject);

                    }
                });

                scope.$watch('channelObject.channelIsAlive', function(channelIsAlive, previousChannelIsAlive) {

                    if (channelIsAlive === false) {
                        channelDeadMsgPayload = {
                            senderNameAsWritten: 'ChatSurfing Admin',
                            messageString: gettextCatalog.getString(
                                'Internet/Server error. ' +
                                'Your connection to ChatSurfing is not functioning correctly. ' +
                                'Messages sent to you while your connection is down are ' +
                                'permanently lost.'),
                            messageUniqueId: 'Not set',
                            transmittedToServer: false
                        };
                        addMessageToDisplay(channelDeadMsgPayload, 'left', channelDeadMsgPayload.transmittedToServer);
                    }

                    if (previousChannelIsAlive === false && channelIsAlive) {
                        channelDeadMsgPayload = {
                            senderNameAsWritten: 'ChatSurfing Admin',
                            messageString: gettextCatalog.getString('Your connection to ChatSurfing appears to be working again'),
                            messageUniqueId: 'Not set',
                            transmittedToServer: true
                        };
                        addMessageToDisplay(channelDeadMsgPayload, 'left', channelDeadMsgPayload.transmittedToServer);
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