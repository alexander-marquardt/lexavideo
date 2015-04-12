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

    .service('lxChannelSupportService', function() {
        this.channelReady = false;
        this.socket = null;
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
             lxChannelSupportService,
             lxCreateChatRoomObjectsService,
             lxHttpChannelService,
             lxJs,
             lxMessageService,
             lxWebRtcSessionService

             ) {

        /*
         lxChannelService provides functionality for opening up and handling callbacks from the Google App-engine "Channel API".
         */

        var sendHeartbeatTimerId = null;
        var reInitializeChannelTimerId = null;
        var msToWaitForHeartbeatResponse = 3000; // X milliseconds

        var onChannelOpened = function() {
            return function () {
                $log.log('Channel opened.');
                lxChannelSupportService.channelReady = true;
            };
        };

        var onChannelMessage = function(scope) {
            return function(message) {

                var localVideoObject = scope.localVideoObject;

                $rootScope.$apply(function() {
                    var messageObject = JSON.parse(message.data);
                    var remoteClientId = messageObject.fromClientId;
                    var remoteVideoObject = scope.remoteVideoElementsDict[remoteClientId];
                    var chatRoomId = null;

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
                                    remoteVideoObject, scope.lxMainViewCtrl.clientId, remoteClientId);
                            }
                            break;




                        case 'roomOccupancyMsg':
                            var normalizedChatRoomName = messageObject.messagePayload.normalizedChatRoomName;
                            var chatRoomNameAsWritten = messageObject.messagePayload.chatRoomNameAsWritten;
                            chatRoomId = messageObject.messagePayload.chatRoomId;
                            var roomOccupancyDict = scope.roomOccupancyDict;
                            roomOccupancyDict[normalizedChatRoomName] = {};

                            roomOccupancyDict[normalizedChatRoomName].chatRoomNameAsWritten = chatRoomNameAsWritten;
                            roomOccupancyDict[normalizedChatRoomName].chatRoomId = chatRoomId;

                            // status of who is currently in the room.
                            $log.debug('Room status received: ' + JSON.stringify(messageObject.messagePayload));
                            roomOccupancyDict[normalizedChatRoomName].dictOfClientObjects = messageObject.messagePayload.dictOfClientObjects;

                            // copy the dictOfClientObjects into a listOfClientObjects, which is more convenient
                            // for some functions.
                            roomOccupancyDict[normalizedChatRoomName].listOfClientObjects = [];
                            angular.forEach(roomOccupancyDict[normalizedChatRoomName].dictOfClientObjects, function(clientObject, clientId) {
                                // manually add the clientId into the clientObject
                                clientObject.clientId = clientId;
                                roomOccupancyDict[normalizedChatRoomName].listOfClientObjects.push(clientObject);
                            });

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
                            chatRoomId = messageObject.roomId;
                            var receivedChatMessageObject = scope.receivedChatMessageObject[chatRoomId];

                            receivedChatMessageObject.messageString = messageObject.messagePayload.messageString;
                            // receivedMessageTime is used for triggering the watcher
                            receivedChatMessageObject.receivedMessageTime = new Date().getTime();
                            break;

                        case 'heartBeatMsg':
                            $log.log('Received heartbeat: ' + JSON.stringify(messageObject));
                            $timeout.cancel(reInitializeChannelTimerId);
                            break;

                        case 'videoExchangeStatusMsg':

                            if (!(remoteClientId in scope.videoExchangeObjectsDict)) {
                                $log.info('videoExchangeStatusMsg causing creation of new videoExchangeObjectsDict entry for client ' + remoteClientId);
                                scope.videoExchangeObjectsDict[remoteClientId] = lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject();
                            }

                            var remoteVideoEnabledSetting = messageObject.messagePayload.videoElementsEnabledAndCameraAccessRequested;
                            scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting = remoteVideoEnabledSetting;

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

        var onChannelError = function() {
            $log.error('*** Channel error. ***');
            // lxChannelSupportService.channelReady = false;
        };

        var onChannelClosed = function() {
            $log.warn('*** Channel closed. ***');
            lxChannelSupportService.channelReady = false;
        };

        var handler = function(scope) {
            return {
                'onopen': onChannelOpened(),
                'onmessage': onChannelMessage(scope),
                'onerror': onChannelError,
                'onclose': onChannelClosed
            };
        };
        var openChannel = function(scope) {

            $log.info('*** Opening channel. ***');
            try {
                var channel = new goog.appengine.Channel(scope.lxMainViewCtrl.channelToken);
                lxChannelSupportService.socket = channel.open(handler(scope));

            } catch(e) {
                e.message = '\n\tError in openChannel\n\t' + e.message;
                $log.error(e);
            }
        };

        // Stop sending heartbeats to the server. Intended to be called before
        // starting a new heartbeat, so that we don't have multiple timer loops
        // running at the same time.
        var stopSendingHeartbeat = function() {
            $timeout.cancel(sendHeartbeatTimerId);
            sendHeartbeatTimerId = null;
        };

        // Send periodic updates to the server so that the server can track the presence status of each user.
        // Also, each time the server receives a heartbeat, it will respond with an acknowledgement on the channel,
        // and if this is not received within an expected "response time", then the channel is assumed to have failed
        // and will be re initialized.
        var startSendingHeartbeat = function(scope, clientId, presenceStatus) {
            lxHttpChannelService.sendClientHeartbeat(clientId, presenceStatus);
            var timeoutFn = function() {
                sendHeartbeatTimerId = $timeout(function() {
                    lxHttpChannelService.sendClientHeartbeat(clientId, presenceStatus);
                    timeoutFn();

                    reInitializeChannelTimerId = $timeout(function() {
                        reInitializeChannelIfResponseNotReceived(scope, clientId);
                    }, msToWaitForHeartbeatResponse);

                }, lxAppWideConstantsService.heartbeatIntervalMilliseconds);
            };
            timeoutFn();
        };

        // If we have not received a response on the channel within a few seconds of sending the heartbeat to the
        // server, then we assume that the channel has died, and that a new one is needed.
        var reInitializeChannelIfResponseNotReceived = function(scope, clientId) {
            $log.error('Heartbeat not received within ' + msToWaitForHeartbeatResponse + ' ms. Re-initializing channel.');
            self.initializeChannel(scope, clientId);
        };


        var self = {
            initializeChannel: function(scope, clientId) {
                lxHttpChannelService.requestChannelToken(clientId, lxAppWideConstantsService.userId).then(function (response) {
                    scope.lxMainViewCtrl.channelToken = response.data.channelToken;

                    openChannel(scope);

                    $window.onbeforeunload = function () {
                        $log.debug('Manually disconnecting channel on window unload event.');
                        lxHttpChannelService.manuallyDisconnectChannel(scope.lxMainViewCtrl.clientId);
                    };

                    // Heartbeat updates the server so that it knows that the current user is still connected.
                    stopSendingHeartbeat();
                    startSendingHeartbeat(scope, clientId, scope.presenceStatus);

                }, function () {
                    scope.lxMainViewCtrl.channelToken = 'Failed to get channelToken';
                    scope.lxMainViewCtrl.clientId = 'Failed to get clientId';
                });
            }
        };

        return self;
    });

