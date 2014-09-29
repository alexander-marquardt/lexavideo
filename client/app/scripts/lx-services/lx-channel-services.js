'use strict';

angular.module('lxChannel.services', [])


    .service('channelMessageService', function() {
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

    .service('channelServiceSupport', function() {
        this.channelReady = false;
        this.socket = null;
    })

    .factory('channelService',
    function($log,
             $timeout,
             $rootScope,
             lxUseChatRoomConstantsService,
             callService,
             webRtcSessionService,
             channelServiceSupport,
             lxUseChatRoomVarsService,
             channelMessageService) {

        /*
         Provides functionality for opening up and handling callbacks from the Google App-engine "Channel API".
         */

        var onChannelOpened = function() {
            return function () {
                $log.log('Channel opened.');
                channelServiceSupport.channelReady = true;
            };
        };

        var onChannelMessage = function(self, localVideoObject, remoteVideoObject, videoSignalingObject) {
            return function(message) {

                $rootScope.$apply(function() {
                    var messageObject = JSON.parse(message.data);

                    switch (messageObject.messageType) {
                        case 'sdp':
                            //$log.debug('S->C: ' + message.data);

                            var sdpObject = messageObject.messagePayload;
                            // Since the turn response is async and also GAE might disorder the
                            // Message delivery due to possible datastore query at server side,
                            // So callee needs to cache messages before peerConnection is created.
                            if (!lxUseChatRoomVarsService.rtcInitiator && !webRtcSessionService.started) {
                                if (sdpObject.type === 'offer') {
                                    // Add offer to the beginning of msgQueue, since we can't handle
                                    // Early candidates before offer at present.
                                    channelMessageService.unshift(sdpObject);
                                    // Callee creates PeerConnection
                                    // ARM Note: Callee is the person who created the chatroom and is waiting for someone to join
                                    // On the other hand, caller is the person who calls the callee, and is currently the second
                                    // person to join the chatroom.
                                    webRtcSessionService.signalingReady = true;
                                    $log.debug('webRtcSessionService.signalingReady = true');

                                    // We may have been waiting for signalingReady to be true to attempt to start the peer-to-peer video
                                    // call because this user is not the rtcInitiator.
                                    if (videoSignalingObject.localHasSelectedVideoType === 'HD Video') {
                                        // We only transmit video if the local user has authorized it as indicated by this if statement.
                                        callService.maybeStart(localVideoObject, remoteVideoObject, videoSignalingObject);
                                    }
                                } else {
                                    channelMessageService.push(sdpObject);
                                }
                            } else {
                                webRtcSessionService.processSignalingMessage(sdpObject, localVideoObject, remoteVideoObject);
                            }
                            break;

                        case 'videoStream':
                            if (messageObject.messagePayload.streamType === 'ASCII Video') {
                                self.asciiVideoObject.videoFrameUpdated = true;
                                self.asciiVideoObject.compressedVideoFrame = messageObject.messagePayload.compressedVideoString;
                            }
                            else {
                                $log.log('Error: unknown video type received: ' + messageObject.messagePayload.streamType);
                            }
                            break;

                        case 'videoSettings':
                            // message received that indicates a modification to the current video transmission configuration

                            videoSignalingObject.remoteVideoSignalingStatus.settingsType = messageObject.messagePayload.settingsType;
                            videoSignalingObject.remoteVideoSignalingStatus.videoType = messageObject.messagePayload.videoType;
                            break;

                        case 'roomStatus':
                            // status of who is currently in the room.
                            $log.debug('Room status received: ' + JSON.stringify(messageObject.messagePayload));
                            break;

                        default:
                            $log.error('Error: Unkonwn messageType received on Channel: ' + JSON.stringify(messageObject));
                    }
                });

            };
        };

        var onChannelError = function() {
            $log.error('*** Channel error. ***');
            // channelServiceSupport.channelReady = false;
        };

        var onChannelClosed = function() {
            $log.warn('*** Channel closed. ***');
            channelServiceSupport.channelReady = false;
        };

        var handler = function(self, localVideoObject, remoteVideoObject, videoSignalingObject) {
            return {
                'onopen': onChannelOpened(),
                'onmessage': onChannelMessage(self, localVideoObject, remoteVideoObject, videoSignalingObject),
                'onerror': onChannelError,
                'onclose': onChannelClosed
            };
        };

        return {
            openChannel: function(localVideoObject, remoteVideoObject, videoSignalingObject, channelToken) {
                $log.info('*** Opening channel. ***');
                try {
                    var channel = new goog.appengine.Channel(channelToken);
                    channelServiceSupport.socket = channel.open(handler(this, localVideoObject, remoteVideoObject, videoSignalingObject));
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

