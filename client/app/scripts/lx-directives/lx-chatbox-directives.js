/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';

angular.module('lxChatbox.directives', [])

.directive('lxShowChatMessagesDirective',

    function(
        $compile,
        $log,
        $timeout,
        lxShowNumMessagesService,
        lxSoundService,
        lxTimeService
        ) {



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
//                    var messageIdHtml = 'id="id-msg-' + messagePayload.messageUniqueId + '"';
                    timeString = lxTimeService.getTimeString();

                    messageElement.append(angular.element('<div class="col-xs-12 chat-body">')
                            .append(angular.element('<div class="bubble bubble-' + bubbleSide + ' ' + bubbleErrorClass + '"><i></i>')
//                                .append(angular.element('<div ' + messageIdHtml + '>')
                                    .append(messagePayload.messageString)
                                    .append(angular.element('<span class="cl-chat-time-display">')
                                        .append('&nbsp;&nbsp;' + timeString)
//                                )
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
                            !scope.presenceStatus.ACTIVE.isCurrentState) {

                            scope.chatPanelDict[chatRoomId].numMessagesSinceLastTimeBottomOfPanelWasViewed ++;
                            scope.trackUnseenMessageCountObject.unseenMessageCount++;
                        }

                        lxShowNumMessagesService.showNumMessagesInDocumentTitle(scope.trackUnseenMessageCountObject,
                                                                                scope.presenceStatus.ACTIVE.isCurrentState);

                    }
                });

                scope.$watch('channelObject.channelIsAlive', function(channelIsAlive, previousChannelIsAlive) {

                    if (channelIsAlive === false) {
                        var channelDeadMsgPayload = {
                            messageString: 'Internet/Server error. ' +
                                'Your connection to ChatSurfing is not functioning correctly. ' +
                                'Messages sent to you while your connection is down are ' +
                                'permanently lost.',
                            messageUniqueId: 'Not set',
                            transmittedToServer: false
                        };
                        addMessageToDisplay(channelDeadMsgPayload, 'left', channelDeadMsgPayload.transmittedToServer);
                    }

                    if (previousChannelIsAlive === false && channelIsAlive) {
                        var channelDeadMsgPayload = {
                            messageString: 'Your connection to ChatSurfing appears to be working again',
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