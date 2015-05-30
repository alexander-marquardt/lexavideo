'use strict';

/* global goog */

angular.module('lxChannel.services', [])


    .service('lxChannelMessageService', function() {
        var msgQueue = {};

        function makeSureQueueExists(remoteClientId) {
            if (!(remoteClientId in msgQueue)) {
                    msgQueue[remoteClientId] = [];
            }
        }

        return {
            clearQueue : function(remoteClientId) {
                makeSureQueueExists(remoteClientId);
                msgQueue[remoteClientId].length = 0;
            },
            unshift : function(remoteClientId, msg) {
                // adds the msg to the beginning of the array.
                makeSureQueueExists(remoteClientId);
                return msgQueue[remoteClientId].unshift(msg);
            },
            push: function(remoteClientId, msg) {
                makeSureQueueExists(remoteClientId);
                // adds the msg to the end of the array.
                return msgQueue[remoteClientId].push(msg);
            },
            shift : function(remoteClientId) {
                makeSureQueueExists(remoteClientId);
                // pull the first element out of the array and return it.
                return msgQueue[remoteClientId].shift();
            },
            getQueueLength : function(remoteClientId) {
                makeSureQueueExists(remoteClientId);
                return msgQueue[remoteClientId].length;
            }
        };
    })

    .factory('lxChannelService',
    function($log,
             $timeout,
             $rootScope,
             $window,
             lxAccessVideoElementsAndAccessCameraService,
             lxAppWideConstantsService,
             lxCallService,
             lxChannelMessageService,
             lxChatRoomMembersService,
             lxCreateChatRoomObjectsService,
             lxHttpChannelService,
             lxJavascriptConstants,
             lxJs,
             lxMessageService,
             lxServerLoggingService,
             lxWebRtcSessionService

             ) {

        /*
         lxChannelService provides functionality for opening up and handling callbacks from the Google App-engine "Channel API".
         */

        var sendHeartbeatTimerId = null;
        var reInitializeChannelTimerId = null;


        var onChannelMessage = function(scope) {
            return function(message) {

                var localVideoObject = scope.localVideoObject;

                $rootScope.$apply(function() {
                    var messageObject = JSON.parse(message.data);
                    var remoteClientId = messageObject.fromClientId;
                    var remoteVideoObject = scope.remoteVideoElementsDict[remoteClientId];
                    var chatRoomId = null;
                    var receivedChatMessageObject;
                    var remoteUsernameAsWritten;

                    lxJs.assert(remoteClientId, 'remoteClientId is not set');

                    switch (messageObject.messageType) {
                        case 'sdp':
                            //$log.debug('S->C: ' + message.data);

                            var sdpObject = messageObject.messagePayload;


                            if (!(scope.videoExchangeObjectsDict[remoteClientId] && scope.videoExchangeObjectsDict[remoteClientId].rtcInitiator) &&
                                !lxWebRtcSessionService.webRtcSessionStarted[remoteClientId]) {
                                // Callee is the client that is *not* the rtcInitiator (the rtcInitiator calls
                                // the callee). The callee will only start negotiating video connection if they
                                // receive an "offer" from the caller.

                                if (sdpObject.type === 'offer') {
                                    // Add offer to the beginning of msgQueue, since we can't handle
                                    // Early candidates before offer at present.
                                    lxChannelMessageService.unshift(remoteClientId, sdpObject);

                                    lxWebRtcSessionService.signalingReady[remoteClientId] = true;
                                    $log.debug('lxWebRtcSessionService.signalingReady = true');

                                    // We may have been waiting for signalingReady to be true to attempt to start the peer-to-peer video
                                    // call because this user is not the rtcInitiator.
                                    lxCallService.maybeStart(scope, remoteClientId);
                                }

                                // Since the turn response is async and also GAE might disorder the
                                // Message delivery due to possible datastore query at server side,
                                // So callee needs to cache messages before peerConnection is created.
                                else {
                                    lxChannelMessageService.push(remoteClientId, sdpObject);
                                }
                            } else {
                                lxWebRtcSessionService.processSignalingMessage(sdpObject, localVideoObject,
                                    remoteVideoObject, scope.lxMainCtrlDataObj.clientId, remoteClientId);
                            }
                            break;




                        case 'roomOccupancyMsg':
                            var chatRoomNameNormalized = messageObject.messagePayload.chatRoomNameNormalized;
                            var chatRoomNameAsWritten = messageObject.messagePayload.chatRoomNameAsWritten;
                            chatRoomId = messageObject.messagePayload.chatRoomId;
                            var roomOccupancyDict = scope.roomOccupancyDict;
                            roomOccupancyDict[chatRoomNameNormalized] = {};

                            roomOccupancyDict[chatRoomNameNormalized].chatRoomNameAsWritten = chatRoomNameAsWritten;
                            roomOccupancyDict[chatRoomNameNormalized].chatRoomId = chatRoomId;

                            // status of who is currently in the room.
                            $log.debug('Room status received: ' + JSON.stringify(messageObject.messagePayload));
                            roomOccupancyDict[chatRoomNameNormalized].dictOfClientObjects = messageObject.messagePayload.dictOfClientObjects;

                            // copy the dictOfClientObjects into a listOfClientObjects, which is more convenient
                            // for some functions.
                            roomOccupancyDict[chatRoomNameNormalized].listOfClientObjects = [];
                            angular.forEach(roomOccupancyDict[chatRoomNameNormalized].dictOfClientObjects, function(clientObject, clientId) {
                                // manually add the clientId into the clientObject
                                clientObject.clientId = clientId;
                                roomOccupancyDict[chatRoomNameNormalized].listOfClientObjects.push(clientObject);
                            });

                            lxChatRoomMembersService.handleChatRoomIdFromServerUpdate(scope, chatRoomId, chatRoomNameNormalized);

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
                                lxWebRtcSessionService.stop(remoteClientId);

                                // Update the value of rtcInitiator that will be accessed throughout the code.
                                scope.videoExchangeObjectsDict[remoteClientId].rtcInitiator = messageObject.messagePayload.rtcInitiator;

                                // signalingReady will initially be set to be true if this is
                                // the rtcInitiator, or false otherwise. In the case that this value is initially false, it will be set to
                                // true once this client has received an sdp 'offer' from the other client.
                                // Note: rtcInitiator is the 2nd client to start their video
                                lxWebRtcSessionService.signalingReady[remoteClientId] = messageObject.messagePayload.rtcInitiator;

                                // when the server sends an rtcInitiator setting, this means that we are re-starting
                                // the rtc negotiation and peer setup etc. from scratch. Set the following to false
                                // so that the code inside maybeStart will execute all of the initializations that
                                // are required for a new peer session.
                                lxWebRtcSessionService.webRtcSessionStarted[remoteClientId] = false;

                                lxCallService.maybeStart(scope, remoteClientId);

                            }
                            break;

                        case 'chatTextMsg':
                            chatRoomId = messageObject.chatRoomId;
                            receivedChatMessageObject = scope.receivedChatMessageObject[chatRoomId];

                            receivedChatMessageObject.messageString = messageObject.messagePayload.messageString;
                            receivedChatMessageObject.senderNameAsWritten = messageObject.fromUsernameAsWritten;
                            // receivedMessageTime is used for triggering the watcher
                            receivedChatMessageObject.receivedMessageTime = new Date().getTime();
                            break;

                        case 'clientReAddedToRoomAfterAbsence':
                            chatRoomId = messageObject.chatRoomId;
                            receivedChatMessageObject = scope.receivedChatMessageObject[chatRoomId];
                            receivedChatMessageObject.senderNameAsWritten = 'ChatSurfing Admin';
                            receivedChatMessageObject.messageString =
                                'It appears that you have been disconnected and re-connected to ChatSurfing. ' +
                                'Messages sent to your currently open chat rooms while you were absent will not be ' +
                                'delivered to you.';
                            // receivedMessageTime is used for triggering the watcher
                            receivedChatMessageObject.receivedMessageTime = new Date().getTime();

                            break;

                        case 'synAckHeartBeat':
                            lxJs.assert(remoteClientId === scope.lxMainCtrlDataObj.clientId, 'clientId mismatch');
                            $log.log('Received heartbeat syn acknowledgement: ' + JSON.stringify(messageObject));
                            scope.channelObject.channelIsAlive = true;
                            $timeout.cancel(reInitializeChannelTimerId);
                            lxHttpChannelService.sendAckHeartbeatToServer(scope.lxMainCtrlDataObj.clientId,
                                scope.presenceStatus, scope.chatRoomDisplayObject.chatRoomId);
                            break;

                        case 'videoExchangeStatusMsg':
                            remoteUsernameAsWritten = messageObject.fromUsernameAsWritten;

                            if (!(remoteClientId in scope.videoExchangeObjectsDict)) {
                                $log.info('videoExchangeStatusMsg causing creation of new videoExchangeObjectsDict entry for client ' + remoteClientId);
                                scope.videoExchangeObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject();
                            }

                            var remoteVideoEnabledSetting = messageObject.messagePayload.videoElementsEnabledAndCameraAccessRequested;
                            scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting = remoteVideoEnabledSetting;
                            scope.videoStateInfoObject.currentOpenVideoSessionsUserNamesDict[remoteClientId] = remoteUsernameAsWritten;

                            // If the remote user has hung-up then stop the remote stream
                            if (remoteVideoEnabledSetting === 'hangupVideoExchange') {
                                lxWebRtcSessionService.stop(remoteClientId);

                                // If remote user hangs up before the local user has responded to the remote request,
                                // then we need to remove the remoteClient from videoExchangeObjectsDict. This is a
                                // special case, because if the user had already acknowledged the remote request, then
                                // he would either have a video session open, or alternatively have denied and already removed
                                // the remote client from videoExchangeObjectsDict.
                                if (scope.videoExchangeObjectsDict[remoteClientId].localVideoEnabledSetting === 'waitingForPermissionToEnableVideoExchange') {
                                    delete scope.videoExchangeObjectsDict[remoteClientId];
                                    delete scope.videoStateInfoObject.currentOpenVideoSessionsUserNamesDict[remoteClientId];
                                }
                            }

                            // If the remote user has sent a request to exchange video and we are not already
                            // exchanging video with them, then we add the clientId to the pending list.
                            if (remoteVideoEnabledSetting === 'doVideoExchange') {
                                // Check if remoteClientId is not already in currentOpenVideoSessionsList
                                if (scope.videoStateInfoObject.currentOpenVideoSessionsList.indexOf(remoteClientId) === -1) {
                                    // if remoteClientId is not already in pendingRequestsForVideoSessionsList
                                    if (scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.indexOf(remoteClientId === -1)) {
                                        scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.push(remoteClientId);
                                    }
                                }
                            }

                            // if remote user has sent status that is *not* 'doVideoExchange', then the remote
                            // user should *not* appear in pendingRequestsForVideoSessionsList
                            if (remoteVideoEnabledSetting !== 'doVideoExchange') {
                                var indexOfRemoteId = scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.indexOf(remoteClientId);
                                if (indexOfRemoteId >= 0) {
                                    scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.splice(indexOfRemoteId, 1);
                                }
                            }

                            scope.videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers = scope.videoStateInfoObject.pendingRequestsForVideoSessionsList.length;
                            scope.videoStateInfoObject.numOpenVideoExchanges = scope.videoStateInfoObject.currentOpenVideoSessionsList.length;

                            break;

                        default:
                            $log.error('Error: Unkonwn messageType received on Channel: ' + JSON.stringify(messageObject));
                    }
                });

            };
        };

        var onChannelOpened = function(scope) {
            return function () {
                $log.log('Channel opened.');
                scope.channelObject.channelIsAlive = true;
                lxHttpChannelService.tellServerClientChannelOpened(scope.lxMainCtrlDataObj.clientId);

                // Heartbeat updates the server so that it knows that the current user is still connected.
                // It also initiates a handshake that results in the server being updated with the client's
                // presenceStatus.
                startSendingHeartbeat(scope);
            };
        };

        var onChannelError = function(scope) {
            return function() {
                $log.error('*** Channel error. ***');
                scope.channelObject.channelIsAlive = false;
            };
        };

        var onChannelClosed = function(scope) {
            return function() {
                $log.warn('*** Channel closed. ***');
                scope.channelObject.channelIsAlive = false;
            };
        };

        var handler = function(scope) {
            return {
                'onopen': onChannelOpened(scope),
                'onmessage': onChannelMessage(scope),
                'onerror': onChannelError(scope),
                'onclose': onChannelClosed(scope)
            };
        };
        var openChannel = function(scope) {

            $log.info('*** Opening channel. ***');
            try {
                var channel = new goog.appengine.Channel(scope.channelObject.channelToken);
                scope.channelObject.socket = channel.open(handler(scope));
            } catch(e) {
                e.message = '\n\tError in openChannel\n\t' + e.message;
                $log.error(e);
                scope.channelObject.channelIsAlive = false;
            }
        };



        // Send periodic updates to the server so that the server can track the presence status of each user.
        // Also, each time the server receives a heartbeat, it will respond with an acknowledgement on the channel,
        // and if this is not received within an expected "response time", then the channel is assumed to have failed
        // and will be re initialized.
        var startSendingHeartbeat = function(scope) {

            // In case this function is called multiple times, we want to make sure that previous heartbeat timers
            // are cancelled before starting a new timer.
            self.stopSendingHeartbeat();

            lxHttpChannelService.sendSynHeartbeatToServer(scope.lxMainCtrlDataObj.clientId);
            var timeoutFn = function () {
                sendHeartbeatTimerId = $timeout(function () {

                    // If there is no clientId assigned, then don't continue pinging the server.
                    if (scope.lxMainCtrlDataObj.clientId) {
                        lxHttpChannelService.sendSynHeartbeatToServer(scope.lxMainCtrlDataObj.clientId);
                        timeoutFn();

                        // reInitializeChannelTimerId will be cancelled if a 'heartBeatMsg' is received on the chanel
                        // within msToWaitForHeartbeatResponse milliseconds.
                        // This means that reInitializeChannelIfResponseNotReceived will
                        // only be executed if the channel is down, or if the channel takes an unexpectedly long
                        // time to reply to the heartbeat that this client has sent to the server.
                        reInitializeChannelTimerId = $timeout(function () {
                            reInitializeChannelIfResponseNotReceived(scope);
                        }, lxJavascriptConstants.msToWaitForHeartbeatResponse);
                    }
                    else {
                        self.stopHeartbeatAndCloseSocket(scope.channelObject);
                    }
                }, lxAppWideConstantsService.heartbeatIntervalMilliseconds);
            };
            timeoutFn();
        };

        // If we have not received a response on the channel within a few seconds of sending the heartbeat to the
        // server, then we assume that the channel has died, and that a new one is needed.
        var reInitializeChannelIfResponseNotReceived = function(scope) {
            if (scope.lxMainCtrlDataObj.clientId) {
                $log.error('Heartbeat not received within ' + lxJavascriptConstants.msToWaitForHeartbeatResponse +
                    ' ms. Re-initializing channel. clientId: ' + scope.lxMainCtrlDataObj.clientId);
                self.initializeChannel(scope);
            }
            else {
                self.stopHeartbeatAndCloseSocket(scope.channelObject);
            }
        };


        var self = {
            initializeChannel: function(scope) {
                lxServerLoggingService.logInformationToServer('initializeChannel executing for client: ' +
                    scope.lxMainCtrlDataObj.clientId, '/_lx/log_info');

                if (scope.lxMainCtrlDataObj.clientId) {
                    lxHttpChannelService.requestChannelToken(scope.lxMainCtrlDataObj.clientId, scope.lxMainCtrlDataObj.userId).then(function (response) {
                        scope.channelObject.channelToken = response.data.channelToken;

                        openChannel(scope);

                        $window.onbeforeunload = function () {
                            $log.debug('Manually disconnecting channel on window unload event.');
                            lxHttpChannelService.manuallyDisconnectChannel(scope.lxMainCtrlDataObj.clientId, scope.channelObject);
                        };


                    }, function () {
                        scope.channelObject.channelToken = 'Failed to get channelToken';
                        scope.channelObject.channelIsAlive = false;
                    });
                }
                else {
                    scope.channelObject.channelToken = 'Cannot channelToken for undefined clientId';
                    scope.channelObject.channelIsAlive = false;
                }
            },
            // Stop sending heartbeats to the server. Intended to be called before
            // starting a new heartbeat, so that we don't have multiple timer loops
            // running at the same time.
            stopSendingHeartbeat : function() {
                lxServerLoggingService.logInformationToServer('stopSendingHeartbeat executing', '/_lx/log_info');
                $timeout.cancel(sendHeartbeatTimerId);
                sendHeartbeatTimerId = null;
            },

            stopHeartbeatAndCloseSocket: function(channelObject) {
                // stop the heartbeat, since the clientId is not set, it is guaranteed to generate an error
                // when posted to the server. Watchers in other parts of our code will notice that clientId is
                // not set, and will try to get a new clientId.

                $log.warn('Stopping heartbeat and closing socket.');
                self.stopSendingHeartbeat();
                channelObject.socket.close();
            }
        };

        return self;
    });

