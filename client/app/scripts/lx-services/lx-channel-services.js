'use strict';

/* global goog */

angular.module('lxChannel.services', [])


    .service('lxChannelMessageService', function() {
        var msgQueue = [];

        return {
            clearQueue : function() {
                msgQueue.length = 0;
            },
            unshift : function(msg) {
                // adds the msg to the beginning of the array.
                return msgQueue.unshift(msg);
            },
            push: function(msg) {
                // adds the msg to the end of the array.
                return msgQueue.push(msg);
            },
            shift : function() {
                // pull the first element out of the array and return it.
                return msgQueue.shift();
            },
            getQueueLength : function() {
                return msgQueue.length;
            }
        };
    })

    .service('lxChannelSupportService', function() {
        this.channelReady = false;
        this.socket = null;
        this.rtcInitiator = undefined;
    })

    .factory('lxChannelService',
    function($log,
             $timeout,
             $rootScope,
             lxAccessVideoElementsAndAccessCameraService,
             lxAppWideConstantsService,
             lxCallService,
             lxChannelMessageService,
             lxChannelSupportService,
             lxCreateChatRoomObjectsService,
             lxHttpChannelService,
             lxMessageService,
             lxWebRtcSessionService

             ) {

        /*
         Provides functionality for opening up and handling callbacks from the Google App-engine "Channel API".
         */

        var onChannelOpened = function() {
            return function () {
                $log.log('Channel opened.');
                lxChannelSupportService.channelReady = true;
            };
        };

        var onChannelMessage = function(self, scope) {
            return function(message) {

                var localVideoObject = scope.localVideoObject;
                var remoteVideoObject = scope.remoteVideoObject;

                $rootScope.$apply(function() {
                    var messageObject = JSON.parse(message.data);
                    var remoteClientId = messageObject.fromClientId;

                    switch (messageObject.messageType) {
                        case 'sdp':
                            //$log.debug('S->C: ' + message.data);

                            var sdpObject = messageObject.messagePayload;

                            if (!lxChannelSupportService.rtcInitiator && !lxWebRtcSessionService.started) {
                                // Callee is the client that is *not* the rtcInitiator (the rtcInitiator calls
                                // the callee). The callee will only start negotiating video connection if they
                                // receive an "offer" from the caller.

                                if (sdpObject.type === 'offer') {
                                    // Add offer to the beginning of msgQueue, since we can't handle
                                    // Early candidates before offer at present.
                                    lxChannelMessageService.unshift(sdpObject);

                                    lxWebRtcSessionService.signalingReady = true;
                                    $log.debug('lxWebRtcSessionService.signalingReady = true');

                                    // We may have been waiting for signalingReady to be true to attempt to start the peer-to-peer video
                                    // call because this user is not the rtcInitiator.
                                    lxCallService.maybeStart(scope, remoteClientId);

                                }

                                // Since the turn response is async and also GAE might disorder the
                                // Message delivery due to possible datastore query at server side,
                                // So callee needs to cache messages before peerConnection is created.
                                else {
                                    lxChannelMessageService.push(sdpObject);
                                }
                            } else {
                                lxWebRtcSessionService.processSignalingMessage(sdpObject, localVideoObject,
                                    remoteVideoObject, scope.lxChatRoomCtrl.clientId);
                            }
                            break;




                        case 'roomOccupancyMsg':
                            var roomOccupancyObject = scope.roomOccupancyObject;

                            // status of who is currently in the room.
                            $log.debug('Room status received: ' + JSON.stringify(messageObject.messagePayload));

                            // Get the remoteUserId from the message payload - note that if there is no remote
                            // user currently in the room, then this value will be null.
                            roomOccupancyObject.listOfClientObjects = messageObject.messagePayload.listOfClientObjects;

//                                if (roomOccupancyObject.remoteUserId) {
//                                    // The following function is executed when remote user joins the room - and makes sure that they
//                                    // and the remote user have enabled video elements or not.
//                                    lxAccessVideoElementsAndAccessCameraService.sendStatusOfVideoElementsEnabled(
//                                        scope,
//                                        scope.videoExchangeSettingsObject.localVideoEnabledSetting,
//                                        true /* queryForRemoteVideoElementsEnabled - ie. ask remote to respond with their status */
//                                    );
//                                }

                            break;

                        case 'roomInitialVideoSettingsMsg':

                            // See server-side code for more info on rtcInitiator. Basically, if rtcInitiator is sent to the
                            // client, it means that we should attempt to initiate a new rtc connection from scratch once
                            // all pre-conditions are in place for setting up. We do it like this to effectively
                            // deal with page reloads, or with someone leaving a room and then another person joining
                            // that same room -- rtcInitiator is dynamically set on the server depending on if the
                            // person is joining a room, or if the person is already in a room.
                            if ('rtcInitiator' in messageObject.messagePayload) {

                                // Kill the current webRtc session - this is probably not strictly necessary, and could be removed
                                // if it is found to cause delays and/or any other problems.
                                lxWebRtcSessionService.stop();

                                // Update the value of rtcInitiator that will be accessed throughout the code.
                                lxChannelSupportService.rtcInitiator = messageObject.messagePayload.rtcInitiator;

                                // signalingReady will initially be set to be true if this is
                                // the rtcInitiator, or false otherwise. In the case that this value is initially false, it will be set to
                                // true once this client has received an sdp 'offer' from the other client.
                                // Note: rtcInitiator is the 2nd person to start their video
                                lxWebRtcSessionService.signalingReady = lxChannelSupportService.rtcInitiator;

                                // when the server sends an rtcInitiator setting, this means that we are re-starting
                                // the rtc negotiation and peer setup etc. from scratch. Set the following to false
                                // so that the code inside maybeStart will execute all of the initializations that
                                // are required for a new peer session.
                                lxWebRtcSessionService.started = false;

                                lxCallService.maybeStart(scope, remoteClientId);

                            }
                            break;

                        case 'chatDataMsg':
                            var receivedChatMessageObject = scope.receivedChatMessageObject;

                            receivedChatMessageObject.messageString = messageObject.messagePayload.messageString;
                            // receivedMessageStringToggle is used for triggering the watcher
                            receivedChatMessageObject.receivedMessageTime = new Date().getTime();

//                            // acknowledge receipt of the message
//                            lxMessageService.sendMessage('ackChatMessage',
//                                {'ackMessageUniqueId': messageObject.messagePayload.messageUniqueId},
//                                scope.lxChatRoomCtrl.clientId);
                            break;


//                        // If client receives ackChatMessage, it means that the message (as indicated by ackMessageUniqueId)
//                        // that was sent to the remote user has been successfully received.
//                        case 'ackChatMessage':
//                            scope.ackChatMessageObject.ackMessageUniqueId = messageObject.messagePayload.ackMessageUniqueId;
//                            break;

                        case 'videoExchangeStatusMsg':

                            if (!(remoteClientId in scope.videoExchangeObjectsDict)) {
                                $log.info('videoExchangeStatusMsg causing creation of new videoExchangeObjectsDict entry for client ' + remoteClientId);
                                scope.videoExchangeObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject();
                            }
                            scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting =
                                   messageObject.messagePayload.videoElementsEnabledAndCameraAccessRequested;

                            // Check if the remote user has requested an update of the local users status
                            if ('queryVideoElementsEnabledAndCameraAccessRequested' in messageObject.messagePayload &&
                                messageObject.messagePayload.queryVideoElementsEnabledAndCameraAccessRequested) {

                                    /* queryForRemoteVideoElementsEnabled is false to prevent endless queries back and forth */
                                    var queryForRemoteVideoElementsEnabled = false;
                                    lxAccessVideoElementsAndAccessCameraService.sendStatusOfVideoElementsEnabled(
                                        scope,
                                        scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting,
                                        queryForRemoteVideoElementsEnabled,
                                        remoteClientId
                                    );

                            }

                            // If the local user has denied video activation (as indicated by localVideoEnabledSetting
                            // of 'doNotEnableVideoExchange'),
                            // then by construction this was triggered by a remoteVideoEnabledSetting of 'enableVideoExchange' .
                            // If the  remote user now has a status other than 'enableVideoExchange' then they are not currently
                            // attempting to exchange video, and the doNotEnableVideoExchange that we previously selected
                            // is no longer applicable (since the remote request is no longer pending)
                            // Reset localVideoEnabledSetting to 'waitingForEnableVideoExchangePermission' so that the remote user will
                            // be able to send a future request to the local user to enable (or deny) access to their video
                            // elements.
                            if (scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting !== 'enableVideoExchange' &&
                                scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting === 'doNotEnableVideoExchange') {

                                scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting = 'waitingForEnableVideoExchangePermission';
                            }

                            break;

                        default:
                            $log.error('Error: Unkonwn messageType received on Channel: ' + JSON.stringify(messageObject));
                    }
                });

            };
        };

        var onChannelError = function() {
            $log.error('*** Channel error. ***');
            // lxChannelSupportService.channelReady = false;
        };

        var onChannelClosed = function() {
            $log.warn('*** Channel closed. ***');
            lxChannelSupportService.channelReady = false;
        };

        var handler = function(self, scope) {
            return {
                'onopen': onChannelOpened(),
                'onmessage': onChannelMessage(self, scope),
                'onerror': onChannelError,
                'onclose': onChannelClosed
            };
        };

        return {
            openChannel: function(scope) {

                $log.info('*** Opening channel. ***');
                try {
                    var channel = new goog.appengine.Channel(scope.lxChatRoomCtrl.channelToken);
                    lxChannelSupportService.socket = channel.open(handler(this, scope));

                } catch(e) {
                    e.message = '\n\tError in openChannel\n\t' + e.message;
                    $log.error(e);
                }
            },

            startClientHeartbeat: function(clientId) {
                lxHttpChannelService.sendClientHeartbeat(clientId);
                var timeoutFn = function() {
                    $timeout(function() {
                        lxHttpChannelService.sendClientHeartbeat(clientId);
                        timeoutFn();
                    }, lxAppWideConstantsService.heartbeatIntervalMilliseconds);
                };
                timeoutFn();
            }
        };
    });

