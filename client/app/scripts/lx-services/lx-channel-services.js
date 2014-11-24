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
             lxCallService,
             lxChannelMessageService,
             lxChannelSupportService,
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
                var videoSignalingObject = scope.videoTypeSignalingObject;

                $rootScope.$apply(function() {
                    var messageObject = JSON.parse(message.data);

                    switch (messageObject.messageType) {
                        case 'sdp':
                            //$log.debug('S->C: ' + message.data);

                            var sdpObject = messageObject.messagePayload;
                            // Since the turn response is async and also GAE might disorder the
                            // Message delivery due to possible datastore query at server side,
                            // So callee needs to cache messages before peerConnection is created.
                            if (!lxChannelSupportService.rtcInitiator && !lxWebRtcSessionService.started) {
                                if (sdpObject.type === 'offer') {
                                    // Add offer to the beginning of msgQueue, since we can't handle
                                    // Early candidates before offer at present.
                                    lxChannelMessageService.unshift(sdpObject);
                                    // Callee creates PeerConnection
                                    // Note: Callee is the person who created the chatroom and is waiting for someone to join
                                    // On the other hand, caller is the person who calls the callee, and is currently the second
                                    // person to join the chatroom.
                                    lxWebRtcSessionService.signalingReady = true;
                                    $log.debug('lxWebRtcSessionService.signalingReady = true');

                                    // We may have been waiting for signalingReady to be true to attempt to start the peer-to-peer video
                                    // call because this user is not the rtcInitiator.
                                    lxCallService.maybeStart(localVideoObject, remoteVideoObject, videoSignalingObject);

                                } else {
                                    lxChannelMessageService.push(sdpObject);
                                }
                            } else {
                                lxWebRtcSessionService.processSignalingMessage(sdpObject, localVideoObject, remoteVideoObject);
                            }
                            break;

                        case 'videoStream':
                            if (messageObject.messagePayload.streamType === 'ASCII Video') {
                                self.asciiVideoObject.videoFrameUpdated = true;
                                self.asciiVideoObject.compressedVideoFrame = messageObject.messagePayload.compressedVideoString;


                                // Only update the remoteIsSendingVideoType if the local user has selected/accepted this type.
                                // This check is necessary because an ASCII Video frame may be received after the
                                // remote user has already started transmitting HD Video. If we do not include this
                                // check, then the act of receiving an ASCII video frame would incorrectly switch the
                                // remoteIsSendingVideoType to ASCII Video.
                                if (videoSignalingObject.localHasSelectedVideoType === 'ASCII Video') {
                                    videoSignalingObject.remoteIsSendingVideoType = 'ASCII Video';
                                }
                            }
                            else {
                                $log.log('Error: unknown video type received: ' + messageObject.messagePayload.streamType);
                            }
                            break;

                        case 'videoSettings':
                            // message received that indicates a modification to the current video transmission configuration

                            videoSignalingObject.remoteVideoSignalingStatus.requestAcceptOrDenyVideoType = messageObject.messagePayload.requestAcceptOrDenyVideoType;
                            videoSignalingObject.remoteVideoSignalingStatus.videoType = messageObject.messagePayload.videoType;
                            $log.debug('received remote video type of: ' + messageObject.messagePayload.videoType);
                            break;


                        case 'roomOccupancy':
                            var roomOccupancyObject = scope.roomOccupancyObject;

                            // status of who is currently in the room.
                            $log.debug('Room status received: ' + JSON.stringify(messageObject.messagePayload));

                            if ('remoteUserId' in messageObject.messagePayload) {
                                // Get the remoteUserId from the message payload - note that if there is no remote
                                // user currently in the room, then this value will be null.
                                roomOccupancyObject.remoteUserId = messageObject.messagePayload.remoteUserId;
                                roomOccupancyObject.remoteUserName = messageObject.messagePayload.remoteUserName;
                            }
                            else {
                                $log.error('remoteUserId not received in roomStatus messagePayload');
                            }
                            break;

                        case 'roomInitialVideoSettings':

                            // roomInitialVideoSettings can force the local user into a videoType selection - this is intended for when
                            // the user joins an existing room that the other user has already set to a particular
                            // videoType.
                            videoSignalingObject.localHasSelectedVideoType = messageObject.messagePayload.roomVideoType;
                            videoSignalingObject.localIsNegotiatingForVideoType =  messageObject.messagePayload.roomVideoType;

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
                                // Note: rtcInitiator is the 2nd person to join the chat room, not the creator of the chat room
                                lxWebRtcSessionService.signalingReady = lxChannelSupportService.rtcInitiator;

                                // when the server sends an rtcInitiator setting, this means that we are re-starting
                                // the rtc negotiation and peer setup etc. from scratch. Set the following to false
                                // so that the code inside maybeStart will execute all of the initializations that
                                // are required for a new peer session.
                                lxWebRtcSessionService.started = false;

                                lxCallService.maybeStart(localVideoObject, remoteVideoObject, videoSignalingObject);

                            }
                            break;

                        case 'chatMessage':
                            var receivedChatMessageObject = scope.receivedChatMessageObject;

                            receivedChatMessageObject.messageString = messageObject.messagePayload.messageString;
                            // receivedMessageStringToggle is used for triggering the watcher
                            receivedChatMessageObject.receivedMessageTime = new Date().getTime();

                            // acknowledge receipt of the message
                            lxMessageService.sendMessage('ackChatMessage', {'ackMessageUniqueId': messageObject.messagePayload.messageUniqueId});
                            break;


                        // If client receives ackChatMessage, it means that the message (as indicated by ackMessageUniqueId)
                        // that was sent to the remote user has been successfully received.
                        case 'ackChatMessage':
                            scope.ackChatMessageObject.ackMessageUniqueId = messageObject.messagePayload.ackMessageUniqueId;
                            break;

                        case 'videoCameraStatus':
                            scope.videoCameraStatusObject.remoteHasEnabledVideoElementsAndRequestedCameraAccess = +
                                   messageObject.messagePayload.videoElementsEnabledAndCameraAccessRequested;

                            // if remote has sent a message with their EnabledVideoElements.. status, then if they
                            // have requested video, and the local user has not enabled video, then we will show
                            // the local user a prompt for them to enable their video.
                            if (scope.videoCameraStatusObject.remoteHasEnabledVideoElementsAndRequestedCameraAccess &&
                                !scope.videoCameraStatusObject.localHasEnabledVideoElementsAndRequestedCameraAccess) {

                                scope.videoCameraStatusObject.waitingFoLocalToRespondToRemoteRequest = true;
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
                    var channel = new goog.appengine.Channel(scope.lxChatRoomOuterCtrl.channelToken);
                    lxChannelSupportService.socket = channel.open(handler(this, scope));
                } catch(e) {
                    e.message = '\n\tError in openChannel\n\t' + e.message;
                    $log.error(e);
                }
            },
            asciiVideoObject : {
                compressedVideoFrame : null,
                videoFrameUpdated : false
            },
            getAsciiVideoFrameUpdated : function(self) {
                return function() {
                    return self.asciiVideoObject.videoFrameUpdated;
                };
            }
        };
    });

