'use strict';

var videoAppServices = angular.module('lxVideoSetup.services', []);


// define externally defined variables so that jshint doesn't give warnings
/* global goog */

/* The following globally defined functions come from adapter.js, which is a "shim" to make sure that
   webRTC works in both Chrome and Firefox. */
/* global createIceServers */
/* global getUserMedia */
/* global RTCPeerConnection */
/* global RTCSessionDescription */
/* global RTCIceCandidate */
/* global attachMediaStream */
/* global reattachMediaStream */




videoAppServices.service('adapterService', function ($log) {
    /* simple wrapper for global functions contained in adapter.js. This will make it
       easier to do unit testing in the future.
     */
    try {
        this.createIceServers = createIceServers;
        this.RTCPeerConnection = RTCPeerConnection;
        this.RTCSessionDescription = RTCSessionDescription;
        this.getUserMedia = getUserMedia;
        this.attachMediaStream = attachMediaStream;
        this.reattachMediaStream = reattachMediaStream;
        this.RTCIceCandidate = RTCIceCandidate;
    }
    catch(e) {
        e.message = '\n\tError in adapterService\n\t' + e.message;
        $log.error(e);
    }
});

videoAppServices.service('channelMessageService', function() {
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
});

videoAppServices.service('channelServiceSupport', function() {
    this.channelReady = false;
    this.socket = null;
});

videoAppServices.factory('channelService', function($log, $timeout, $rootScope, serverChatRoomConstantsService,
                                                    callService, webRtcSessionService, userNotificationService,
                                                    channelServiceSupport, globalVarsService, channelMessageService) {

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
                        //$log.log('S->C: ' + message.data);

                        var sdpObject = messageObject.messagePayload;
                        // Since the turn response is async and also GAE might disorder the
                        // Message delivery due to possible datastore query at server side,
                        // So callee needs to cache messages before peerConnection is created.
                        if (!globalVarsService.rtcInitiator && !webRtcSessionService.started) {
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

                                // We may have been waiting for singalingReady to be true to begin the peer-to-peer video
                                // call (as is the case if this user is not the rtcInitiator).
                                // If this is the case, then we can now try to start the peer-to-peer transmission.
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
        userNotificationService.messageError('Channel error.');
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
        openChannel: function(localVideoObject, remoteVideoObject, videoSignalingObject) {
            $log.info('*** Opening channel. ***');
            try {
                var channel = new goog.appengine.Channel(serverChatRoomConstantsService.channelToken);
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


videoAppServices.service('turnServiceSupport', function () {
    // This function tracks some variables that are needed by multiple services, where one of the services has
    // a dependency on the other one.
    // In order to prevent circular dependencies, this variable needs to be in its own service, even though
    // it could logically fit into the turnService service.

    // Note that this is called as a service vs. a factory, which means that it will be invoked with the "new" keyword.
    // Therefore, we have direct access to the "this" for the turnServiceSupport object.
    this.turnDone = false;

});


videoAppServices.factory('turnService', function($log, $http, peerService, callService, turnServiceSupport, userNotificationService,
                                         serverChatRoomConstantsService, globalVarsService, adapterService) {


    var onTurnResult = function(response) {

        try {
            var turnServer = response.data;
            // Create turnUris using the polyfill (adapter.js).
            var iceServers = adapterService.createIceServers(turnServer.uris,
                turnServer.username,
                turnServer.password);
            if (iceServers !== null) {
                globalVarsService.pcConfig.iceServers = globalVarsService.pcConfig.iceServers.concat(iceServers);
            }
            $log.log('Got pcConfig.iceServers:' + globalVarsService.pcConfig.iceServers + '\n');
        } catch(e) {
            e.message = '\n\tError in onTurnResult\n\t' + e.message;
            $log.error(e);
        }
    };

    var onTurnError = function() {

        userNotificationService.messageError('No TURN server; unlikely that media will traverse networks.  ' +
            'If this persists please report it to ' +
            'info@lexabit.com');
    };


    var afterTurnRequest = function() {
        return function () {
            // Even if TURN request failed, continue the call with default STUN.
            turnServiceSupport.turnDone = true;
        };
    };

    return {

        maybeRequestTurn : function() {
            // Allow to skip turn by passing ts=false to apprtc.
            if (serverChatRoomConstantsService.turnUrl === '') {
                turnServiceSupport.turnDone = true;
                return;
            }

            for (var i = 0, len = globalVarsService.pcConfig.iceServers.length; i < len; i++) {
                if (globalVarsService.pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
                    turnServiceSupport.turnDone = true;
                    return;
                }
            }

            var currentDomain = document.domain;
            if (currentDomain.search('localhost') === -1 &&
                currentDomain.search('apprtc') === -1) {
                // Not authorized domain. Try with default STUN instead.
                turnServiceSupport.turnDone = true;
                return;
            }

            // No TURN server. Get one from computeengineondemand.appspot.com.
            $http.get(serverChatRoomConstantsService.turnUrl).then(onTurnResult, onTurnError).then(afterTurnRequest());
        }
    };
});


videoAppServices.factory('messageService', function($http, $log, serverChatRoomConstantsService) {

    /*
    Functionality for posting messages to the server.
     */
    return {
        sendMessage : function(messageType, messagePayload) {
            /*
            messageType: string indicating if this is a Signaling message or some other kind of message
                         that is being sent over the Appengine Channel API.
                         Allowed values:
                         'sdp' - setting up peer to peer connection
                         'video' - sending video/images through the server
                         'chat' - chat messages sent through the server
            messagePayload: an object containing data that will be send from one peer to another through the server.
                     Note: this data will be serialized automatically by AngularJS into a JSON object/string.
             */

            var messageObject = {
                'messageType': messageType,
                'messagePayload': messagePayload
            };

            // $log.log('C->S: ' + msgString);
            // NOTE: AppRTCClient.java searches & parses this line; update there when
            // changing here.
            var path = '/_lx/message?r=' + serverChatRoomConstantsService.roomName + '&u=' + serverChatRoomConstantsService.myUsername;

            $http.post(path, messageObject).then(
                function(/*response*/) {
                    //$log.log('Post success. Got response status: ' + response.statusText);
                },
                function(/*response*/) {
                    //$log.log('Post error. Got response status: ' + response.statusText);
                }
            );
        }
    };
});

videoAppServices.service('iceService', function($log, messageService, userNotificationService) {
    /*
    ICE = Interactive Connectivity Establishment.
    This service provides ICE methods that are used when setting up a peer connection.
     */

    var gatheredIceCandidateTypes = { Local: {}, Remote: {} };

    // self is necessary because some functions are called as methods of other objects which lose the
    // referencd to "this".
    var self = this;


    var updateLog = function() {
//        var contents = 'Gathered ICE Candidates\n';
//        for (var endpoint in gatheredIceCandidateTypes) {
//            contents += endpoint + ':\n';
//            for (var type in gatheredIceCandidateTypes[endpoint]) {
//                contents += '  ' + type + '\n';
//            }
//        }
//        $log.info(contents);
    };

    this.iceCandidateType = function(candidateSDP) {
        if (candidateSDP.indexOf('typ relay ') >= 0) {
            return 'TURN';
        }
        if (candidateSDP.indexOf('typ srflx ') >= 0) {
            return 'STUN';
        }
        if (candidateSDP.indexOf('typ host ') >= 0) {
            return 'HOST';
        }
        return 'UNKNOWN';
    };

    this.noteIceCandidate = function(location, type) {
        if (gatheredIceCandidateTypes[location][type]) {
            return;
        }
        gatheredIceCandidateTypes[location][type] = 1;
        updateLog();
    };
    this.onIceCandidate = function(event) {
        if (event.candidate) {
            messageService.sendMessage('sdp', {type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate});
            self.noteIceCandidate('Local', self.iceCandidateType(event.candidate.candidate));
        } else {
            $log.log('End of candidates.');
        }
    };

    this.onAddIceCandidateSuccess = function() {
        $log.log('AddIceCandidate success.');
    };

    this.onAddIceCandidateError = function(error) {
        userNotificationService.messageError('Failed to add Ice Candidate: ' + error.toString());
    };
});

videoAppServices.service('sessionDescriptionService', function(globalVarsService, codecsService,
                                                               messageService, serverChatRoomConstantsService,
                                                               adapterService, userNotificationService,
                                                               peerService,
                                                               $log, $timeout) {

    var self = this;
    var sessionStatus = 'initializing'; // "initializing", "waiting", "active", or "done"

    var onSetSessionDescriptionSuccess = function() {
        $log.log('Set session description success.');
    };

    var mergeConstraints = function(cons1, cons2) {
        var merged = cons1;
        for (var name in cons2.mandatory) {
            merged.mandatory[name] = cons2.mandatory[name];
        }
        merged.optional.concat(cons2.optional);
        return merged;
    };

    var onCreateSessionDescriptionError = function(error) {
        userNotificationService.messageError('Failed to create session description: ' + error.toString());
    };

    var onSetSessionDescriptionError = function(error) {
        userNotificationService.messageError('Failed to set session description: ' + error.toString());
    };
    
    var setLocalAndSendMessage = function(pc) {
        return function(sessionDescription) {
            sessionDescription.sdp = codecsService.maybePreferAudioReceiveCodec(sessionDescription.sdp);
            sessionDescription.sdp = codecsService.maybeSetAudioReceiveBitRate(sessionDescription.sdp);
            sessionDescription.sdp = codecsService.maybeSetVideoReceiveBitRate(sessionDescription.sdp);

            pc.setLocalDescription(sessionDescription,
                onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
            messageService.sendMessage('sdp', sessionDescription);
        };
    };

    var waitForRemoteVideo = function(localVideoObject, remoteVideoObject) {
        var innerWaitForRemoteVideo = function() {

            var videoTracks = peerService.remoteStream.getVideoTracks();
            if (videoTracks.length === 0 || remoteVideoObject.remoteVideoElem.currentTime > 0) {
                self.transitionSessionStatus('active');
            } else {
                $timeout(innerWaitForRemoteVideo, 100);
            }
        };
        innerWaitForRemoteVideo();
    };

    var publicMethods =  {
        getSessionStatus : function() {
            return sessionStatus;
        },

        transitionSessionStatus : function(status) {
            $timeout(function() {
                sessionStatus = status;
            });
        },

        doAnswer : function() {
            $log.log('Sending answer to peer.');
            peerService.pc.createAnswer(setLocalAndSendMessage(peerService.pc),
                onCreateSessionDescriptionError, globalVarsService.sdpConstraints);
        },

        doCall : function() {
            var constraints = mergeConstraints(serverChatRoomConstantsService.offerConstraints, globalVarsService.sdpConstraints);
            $log.log('Sending offer to peer, with constraints: \n' +
                '  \'' + JSON.stringify(constraints) + '\'.');
            peerService.pc.createOffer(setLocalAndSendMessage(peerService.pc),
                onCreateSessionDescriptionError, constraints);
        },

        setRemote : function(message, localVideoObject, remoteVideoObject) {
            var onSetRemoteDescriptionSuccess = function(){
                $log.log('Set remote session description success.');
                // By now all addstream events for the setRemoteDescription have fired.
                // So we can know if the peer is sending any stream or is only receiving.
                if (peerService.remoteStream) {
                    waitForRemoteVideo(localVideoObject, remoteVideoObject);
                } else {
                    $log.log('Not receiving any stream.');
                    self.transitionSessionStatus('active');
                }
            };

            // Set Opus in Stereo, if stereo enabled.
            if (serverChatRoomConstantsService.stereo) {
                message.sdp = codecsService.addStereo(message.sdp);
            }
            message.sdp = codecsService.maybePreferAudioSendCodec(message.sdp);
            message.sdp = codecsService.maybeSetAudioSendBitRate(message.sdp);
            message.sdp = codecsService.maybeSetVideoSendBitRate(message.sdp);
            message.sdp = codecsService.maybeSetVideoSendInitialBitRate(message.sdp);

            peerService.pc.setRemoteDescription(new adapterService.RTCSessionDescription(message),
                onSetRemoteDescriptionSuccess, onSetSessionDescriptionError);
        }
    };

    angular.extend(self, publicMethods);
});

videoAppServices.service('webRtcSessionService', function($log, $window, $rootScope, $timeout,
                                            messageService, userNotificationService,
                                            codecsService, globalVarsService, sessionDescriptionService,
                                            serverChatRoomConstantsService, iceService, peerService,
                                            channelMessageService, adapterService) {

    var self = this;

    var onRemoteHangup = function(self, localVideoObject) {
        $log.log('Session terminated.');
        globalVarsService.rtcInitiator = 0;
        sessionDescriptionService.transitionSessionStatus('waiting');
        self.stop(self, localVideoObject);
    };

    var publicMethods = {

        started : false,
        signalingReady : false,


        stop : function() {
            self.started = false;
            self.signalingReady = globalVarsService.rtcInitiator;
            if (peerService.pc) {
                peerService.pc.close();
            }
            peerService.pc = null;
            peerService.remoteStream = null;
            channelMessageService.clearQueue();
        },

        processSignalingMessage : function( message, localVideoObject, remoteVideoObject) {
            if (!self.started) {
                userNotificationService.messageError('peerConnection has not been created yet!');
                return;
            }

            if (message.type === 'offer') {
                sessionDescriptionService.setRemote(message, localVideoObject, remoteVideoObject);
                sessionDescriptionService.doAnswer();

            } else if (message.type === 'answer') {
                sessionDescriptionService.setRemote(message, localVideoObject, remoteVideoObject);
            } else if (message.type === 'candidate') {
                var candidate = new adapterService.RTCIceCandidate({sdpMLineIndex: message.label,
                    candidate: message.candidate});
                iceService.noteIceCandidate('Remote', iceService.iceCandidateType(message.candidate));
                peerService.pc.addIceCandidate(candidate,
                    iceService.onAddIceCandidateSuccess, iceService.onAddIceCandidateError);
            } else if (message.type === 'bye') {
                onRemoteHangup(this, localVideoObject);
            }
        }
    };

    angular.extend(self, publicMethods);
});

videoAppServices.factory('peerService', function($log, userNotificationService,
                                         iceService, globalVarsService, serverChatRoomConstantsService,
                                         adapterService) {


    var pcStatus = function (self) {
        var contents = '';
        if (self.pc) {
            contents += 'Gathering: ' + self.pc.iceGatheringState + '\n';
            contents += 'PC State:\n';
            contents += 'Signaling: ' + self.pc.signalingState + '\n';
            contents += 'ICE: ' + self.pc.iceConnectionState + '\n';
        }
        return contents;
    };

    var onRemoteStreamAdded = function(self, localVideoObject, remoteVideoObject, videoSignalingObject) {
        return function(mediaStreamEvent) {
            $log.log('Remote stream added.');
            adapterService.attachMediaStream(remoteVideoObject.remoteVideoElem, mediaStreamEvent.stream);
            self.remoteStream = mediaStreamEvent.stream;

            videoSignalingObject.videoSignalingStatusForUserFeedback = null; // clear feedback messages
            videoSignalingObject.localIsSendingVideoType = 'HD Video';
            videoSignalingObject.remoteIsSendingVideoType = 'HD Video';
        };
    };


    var onRemoteStreamRemoved = function() {
        $log.info('Remote stream removed.');
    };

    var onSignalingStateChanged = function(self){
        return function() {
            $log.info(pcStatus(self));
        };
    };

    var onIceConnectionStateChanged = function(self) {
        return function() {
            $log.info(pcStatus(self));
        };
    };



    /* Externally visible variables and methods */
    return {
        pc : null,
        remoteStream : null,
        createPeerConnection : function(localVideoObject, remoteVideoObject, videoSignalingObject) {
            try {
                // Create an RTCPeerConnection via the polyfill (adapter.js).
                this.pc = new adapterService.RTCPeerConnection(globalVarsService.pcConfig, serverChatRoomConstantsService.pcConstraints);
                this.pc.onicecandidate = iceService.onIceCandidate;
                $log.log('Created RTCPeerConnnection with:\n' +
                    '  config: \'' + JSON.stringify(globalVarsService.pcConfig) + '\';\n' +
                    '  constraints: \'' + JSON.stringify(serverChatRoomConstantsService.pcConstraints) + '\'.');
            } catch (e) {
                e.message = '\n\tFailed to create PeerConnection\n\t' + e.message;
                $log.error(e);
                return;
            }
            this.pc.onaddstream = onRemoteStreamAdded(this, localVideoObject, remoteVideoObject, videoSignalingObject);
            this.pc.onremovestream = onRemoteStreamRemoved;
            this.pc.onsignalingstatechange = onSignalingStateChanged(this);
            this.pc.oniceconnectionstatechange = onIceConnectionStateChanged(this);
        },
        removeLocalVideoStream : function(/*localStream*/) {
            if (this.pc) {
                $log.error('This functionality is not supported by Firefox as of Aug 18 2014, and therefore should not be used.');
                //this.pc.removeStream(localStream);
            }
        },
        addLocalVideoStream : function(localStream) {

            if (this.pc) {
                this.pc.addStream(localStream);
            } else {
                $log.error('Error: no peer connection has been established, and therefore we cannot add the stream to it.');
            }
        }
    };
});


videoAppServices.service('streamService', function() {

    this.localStream = null;

});

videoAppServices.factory('mediaService', function($log,$timeout, serverChatRoomConstantsService, adapterService, userNotificationService,
                          callService, streamService) {


    var onUserMediaSuccess = function(localVideoObject, videoSignalingObject) {
        return function(stream) {
            $log.log('User has granted access to local media.');
            // Call the polyfill wrapper to attach the media stream to this element.
            adapterService.attachMediaStream(localVideoObject.localVideoElem, stream);
            localVideoObject.localVideoElem.style.opacity = 1;
            streamService.localStream = stream;
            $timeout(function() {
                videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'allowAccess';
            });
        };
    };

    var onUserMediaError = function(videoSignalingObject) {
        return function(error) {
           $log.warn('Failed to get access to local media. Error code was ' +
                error.code + '. Continuing without sending a stream.');

            $timeout(function() {
                callService.hasAudioOrVideoMediaConstraints = false;
                videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'denyAccess';
            });
        };
    };

    return {


        doGetUserMedia  : function(localVideoObject, videoSignalingObject) {
            // Call into getUserMedia via the polyfill (adapter.js).
            try {
                adapterService.getUserMedia(serverChatRoomConstantsService.mediaConstraints,
                    onUserMediaSuccess(localVideoObject, videoSignalingObject),
                    onUserMediaError(videoSignalingObject));
                $log.log('Requested access to local media with mediaConstraints:\n' +
                    '  \'' + JSON.stringify(serverChatRoomConstantsService.mediaConstraints) + '\'');
                videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'waitingForResponse';

            } catch (e) {
                e.message = '\n\tError in doGetUserMedia\n\t' + e.message;
                $log.error(e);
                videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'denyAccess';
            }
        }
    };
});

videoAppServices.factory('callService', function($log, turnServiceSupport, peerService, webRtcSessionService, channelServiceSupport,
                                         userNotificationService, serverChatRoomConstantsService, globalVarsService, channelMessageService,
                                         streamService, sessionDescriptionService) {



    var calleeStart = function(localVideoObject, remoteVideoObject) {
        // Callee starts to process cached offer and other messages.
        while (channelMessageService.getQueueLength() > 0) {
            webRtcSessionService.processSignalingMessage(channelMessageService.shift(), localVideoObject, remoteVideoObject);
        }
    };



    return {
        hasAudioOrVideoMediaConstraints : false,


        maybeStart : function(localVideoObject, remoteVideoObject, videoSignalingObject) {


            if (!webRtcSessionService.started && webRtcSessionService.signalingReady && channelServiceSupport.channelReady &&
                turnServiceSupport.turnDone && (streamService.localStream || !this.hasAudioOrVideoMediaConstraints)) {

                userNotificationService.setStatus('Connecting...');
                $log.log('Creating PeerConnection.');

                peerService.createPeerConnection(localVideoObject, remoteVideoObject, videoSignalingObject);

                if (this.hasAudioOrVideoMediaConstraints) {
                    $log.log('Adding local stream.');
                    peerService.addLocalVideoStream(streamService.localStream);
                } else {
                    $log.log('Not sending any stream.');
                }
                webRtcSessionService.started = true;

                if (globalVarsService.rtcInitiator) {
                    sessionDescriptionService.doCall();
                }
                else {
                    calleeStart(localVideoObject, remoteVideoObject);
                }
            } else {
                $log.debug('Not ready to start webRtc services.');
                if (webRtcSessionService.started) {
                    $log.debug('Because webRtcSessionService.started is true');
                }
                if (!webRtcSessionService.signalingReady) {
                    $log.debug('Because webRtcSessionService.signalingReady is false');
                }
                if (!channelServiceSupport.channelReady) {
                    $log.debug('Because channelServiceSupport.channelReady is false');
                }
                if (!turnServiceSupport.turnDone) {
                    $log.debug('Because turnServiceSupport.turnDone is false');
                }
                if (!streamService.localStream) {
                    $log.debug('Because streamService.localStream is false');
                }
            }
        },

        doHangup : function(localVideoObject) {
            return function() {
                $log.log('*** Hanging up. ***');
                sessionDescriptionService.transitionSessionStatus('done');
                streamService.localStream.stop();
                webRtcSessionService.stop();
                this.unMuteAudioAndVideo(localVideoObject);
                // will trigger BYE from server
                channelServiceSupport.socket.close();
            };
        },




        setVideoMute : function(localVideoObject, newIsMutedValue) {

            var i;
            var videoTracks = streamService.localStream.getVideoTracks();

            localVideoObject.isVideoMuted = newIsMutedValue;

            if (videoTracks.length === 0) {
                $log.log('No local video available.');
                return;
            }

            if (!localVideoObject.isVideoMuted) {
                for (i = 0; i < videoTracks.length; i++) {
                    videoTracks[i].enabled = true;
                }
                $log.log('Video unmuted.');
            } else {
                for (i = 0; i < videoTracks.length; i++) {
                    videoTracks[i].enabled = false;
                }
                $log.log('Video muted.');
            }
        },

        setAudioMute : function(localVideoObject, newIsMutedValue) {
            var i;
            // Call the getAudioTracks method via adapter.js.
            var audioTracks = streamService.localStream.getAudioTracks();

            localVideoObject.isAudioMuted = newIsMutedValue;

            if (audioTracks.length === 0) {
                $log.log('No local audio available.');
                return;
            }

            if (!localVideoObject.isAudioMuted) {
                for (i = 0; i < audioTracks.length; i++) {
                    audioTracks[i].enabled = true;
                }
                $log.log('Audio unmuted.');
            } else {
                for (i = 0; i < audioTracks.length; i++){
                    audioTracks[i].enabled = false;
                }
                $log.log('Audio muted.');
            }
        },

        unMuteAudioAndVideo : function (localVideoObject) {
            this.setVideoMute(localVideoObject, false);
            this.setAudioMute(localVideoObject, false);
        }
    };
});


videoAppServices.factory('userNotificationService', function($log, $timeout, serverChatRoomConstantsService, globalVarsService) {
    var currentState = 'Unknown state'; // this should never be displayed
    return {
        setStatus: function(state) {

            // use r to ensure that $apply is called after the current digest cycle.
            $timeout(function() {
                currentState = state;
            });
        },
        getStatus: function() {
            return currentState;
        },
        messageError : function(msg) {
            $log.error(msg);

        },
        resetStatus : function() {
          if (!globalVarsService.rtcInitiator) {
              this.setStatus('Waiting for someone to join:  <a lass="navbar-link" href=' + serverChatRoomConstantsService.roomLink + '>' + serverChatRoomConstantsService.roomLink + '</a>');
          } else {
              this.setStatus('Initializing...');
          }
        }
    };
});

videoAppServices.factory('codecsService', function($log, serverChatRoomConstantsService, userNotificationService){

    // Strip CN from sdp before CN constraints is ready.
    var removeCN = function(sdpLines, mLineIndex) {
      var mLineElements = sdpLines[mLineIndex].split(' ');
      // Scan from end for the convenience of removing an item.
      for (var i = sdpLines.length-1; i >= 0; i--) {
        var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
        if (payload) {
          var cnPos = mLineElements.indexOf(payload);
          if (cnPos !== -1) {
            // Remove CN payload from m line.
            mLineElements.splice(cnPos, 1);
          }
          // Remove CN line in sdp
          sdpLines.splice(i, 1);
        }
      }

      sdpLines[mLineIndex] = mLineElements.join(' ');
      return sdpLines;
    };


    var extractSdp = function(sdpLine, pattern) {
        var result = sdpLine.match(pattern);
        return (result && result.length === 2)? result[1]: null;
    };

    // Set the selected codec to the first in m line.
    var setDefaultCodec = function(mLine, payload) {
        var elements = mLine.split(' ');
        var newLine = [];
        var index = 0;
        for (var i = 0; i < elements.length; i++) {
            if (index === 3) { // Format of media starts from the fourth.
                newLine[index++] = payload; // Put target payload to the first.
            }
            if (elements[i] !== payload) {
                newLine[index++] = elements[i];
            }
        }
        return newLine.join(' ');
    };


    // Find the line in sdpLines that starts with |prefix|, and, if specified,
    // contains |substr| (case-insensitive search).
    function findLine(sdpLines, prefix, substr) {
        return findLineInRange(sdpLines, 0, -1, prefix, substr);
    }

    // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
    // and, if specified, contains |substr| (case-insensitive search).
    function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
        var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
        for (var i = startLine; i < realEndLine; ++i) {
            if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr ||
                    sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                    return i;
                }
            }
        }
        return null;
    }


    // Set |codec| as the default audio codec if it's present.
    // The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
    var preferAudioCodec = function(sdp, codec) {
        var fields = codec.split('/');
        if (fields.length !== 2) {
            $log.log('Invalid codec setting: ' + codec);
            return sdp;
        }
        var name = fields[0];
        var rate = fields[1];
        var sdpLines = sdp.split('\r\n');
        var mLineIndex = null;
        var i;

        // Search for m line.
        for (i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search('m=audio') !== -1) {
                mLineIndex = i;
                break;
            }
        }
        if (mLineIndex === null) {
            return sdp;
        }

        // If the codec is available, set it as the default in m line.
        for (i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].search(name + '/' + rate) !== -1) {
                var regexp = new RegExp(':(\\d+) ' + name + '\\/' + rate, 'i');
                var payload = extractSdp(sdpLines[i], regexp);
                if (payload) {
                    sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
                        payload);
                }
                break;
            }
        }

        // Remove CN in m line and sdp.
        sdpLines = removeCN(sdpLines, mLineIndex);

        sdp = sdpLines.join('\r\n');
        return sdp;
    };


    // Adds a b=AS:bitrate line to the m=mediaType section.
    var preferBitRate = function(sdp, bitrate, mediaType) {
        var sdpLines = sdp.split('\r\n');

        // Find m line for the given mediaType.
        var mLineIndex = findLine(sdpLines, 'm=', mediaType);
        if (mLineIndex === null) {
            userNotificationService.messageError('Failed to add bandwidth line to sdp, as no m-line found');
            return sdp;
        }

        // Find next m-line if any.
        var nextMLineIndex = findLineInRange(sdpLines, mLineIndex + 1, -1, 'm=');
        if (nextMLineIndex === null) {
            nextMLineIndex = sdpLines.length;
        }

        // Find c-line corresponding to the m-line.
        var cLineIndex = findLineInRange(sdpLines, mLineIndex + 1, nextMLineIndex,
            'c=');
        if (cLineIndex === null) {
            userNotificationService.messageError('Failed to add bandwidth line to sdp, as no c-line found');
            return sdp;
        }

        // Check if bandwidth line already exists between c-line and next m-line.
        var bLineIndex = findLineInRange(sdpLines, cLineIndex + 1, nextMLineIndex,
            'b=AS');
        if (bLineIndex) {
            sdpLines.splice(bLineIndex, 1);
        }

        // Create the b (bandwidth) sdp line.
        var bwLine = 'b=AS:' + bitrate;
        // As per RFC 4566, the b line should follow after c-line.
        sdpLines.splice(cLineIndex + 1, 0, bwLine);
        sdp = sdpLines.join('\r\n');
        return sdp;
    };

    // Gets the codec payload type from an a=rtpmap:X line.
    function getCodecPayloadType(sdpLine) {
        var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
        var result = sdpLine.match(pattern);
        return (result && result.length === 2) ? result[1] : null;
    }

    return {

        // Adds an a=fmtp: x-google-min-bitrate=kbps line, if serverChatRoomConstantsService.videoSendInitialBitrate
        // is specified. We'll also add a x-google-min-bitrate value, since the max
        // must be >= the min.
        maybeSetVideoSendInitialBitRate : function(sdp) {
            if (!serverChatRoomConstantsService.videoSendInitialBitrate) {
                return sdp;
            }

            // Validate the initial bitrate value.
            var maxBitrate = serverChatRoomConstantsService.videoSendInitialBitrate;
            if (serverChatRoomConstantsService.videoSendBitrate) {
                if (serverChatRoomConstantsService.videoSendInitialBitrate > serverChatRoomConstantsService.videoSendBitrate) {
                    userNotificationService.messageError('Clamping initial bitrate to max bitrate of ' +
                        serverChatRoomConstantsService.videoSendBitrate + ' kbps.');
                    serverChatRoomConstantsService.videoSendInitialBitrate = serverChatRoomConstantsService.videoSendBitrate;
                }
                maxBitrate = serverChatRoomConstantsService.videoSendBitrate;
            }

            var sdpLines = sdp.split('\r\n');

            // Search for m line.
            var mLineIndex = findLine(sdpLines, 'm=', 'video');
            if (mLineIndex === null) {
                userNotificationService.messageError('Failed to find video m-line');
                return sdp;
            }

            var vp8RtpmapIndex = findLine(sdpLines, 'a=rtpmap', 'VP8/90000');
            var vp8Payload = getCodecPayloadType(sdpLines[vp8RtpmapIndex]);
            var vp8Fmtp = 'a=fmtp:' + vp8Payload + ' x-google-min-bitrate=' +
                serverChatRoomConstantsService.videoSendInitialBitrate.toString() + '; x-google-max-bitrate=' +
                maxBitrate.toString();
            sdpLines.splice(vp8RtpmapIndex + 1, 0, vp8Fmtp);
            return sdpLines.join('\r\n');
        },

        maybeSetAudioSendBitRate : function(sdp) {
            if (!serverChatRoomConstantsService.audioSendBitrate) {
                return sdp;
            }
            $log.log('Prefer audio send bitrate: ' + serverChatRoomConstantsService.audioSendBitrate);
            return preferBitRate(sdp, serverChatRoomConstantsService.audioSendBitrate, 'audio');
        },

        maybeSetAudioReceiveBitRate : function (sdp) {
            if (!serverChatRoomConstantsService.audioRecvBitrate) {
                return sdp;
            }
            $log.log('Prefer audio receive bitrate: ' + serverChatRoomConstantsService.audioRecvBitrate);
            return preferBitRate(sdp, serverChatRoomConstantsService.audioRecvBitrate, 'audio');
        },


        maybeSetVideoSendBitRate : function (sdp) {
            if (!serverChatRoomConstantsService.videoSendBitrate) {
                return sdp;
            }
            $log.log('Prefer video send bitrate: ' + serverChatRoomConstantsService.videoSendBitrate);
            return preferBitRate(sdp, serverChatRoomConstantsService.videoSendBitrate, 'video');
        },

        maybeSetVideoReceiveBitRate : function(sdp) {
            if (!serverChatRoomConstantsService.videoRecvBitrate) {
                return sdp;
            }
            $log.log('Prefer video receive bitrate: ' + serverChatRoomConstantsService.videoRecvBitrate);
            return preferBitRate(sdp, serverChatRoomConstantsService.videoRecvBitrate, 'video');
        },

        
        maybePreferAudioSendCodec : function(sdp) {
            if (serverChatRoomConstantsService.audioSendCodec === '') {
                $log.log('No preference on audio send codec.');
                return sdp;
            }
            $log.log('Prefer audio send codec: ' + serverChatRoomConstantsService.audioSendCodec);
            return preferAudioCodec(sdp, serverChatRoomConstantsService.audioSendCodec);
        },

        maybePreferAudioReceiveCodec : function(sdp) {
            if (serverChatRoomConstantsService.audioReceiveCodec === '') {
                $log.log('No preference on audio receive codec.');
                return sdp;
            }
            $log.log('Prefer audio receive codec: ' + serverChatRoomConstantsService.audioReceiveCodec);
            return preferAudioCodec(sdp, serverChatRoomConstantsService.audioReceiveCodec);
        },

        // Set Opus in stereo if stereo is enabled.
        addStereo : function(sdp) {
            var sdpLines = sdp.split('\r\n');
            var opusPayload = null;
            var i;

            // Find opus payload.
            for (i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('opus/48000') !== -1) {
                    opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
                    break;
                }
            }

            var fmtpLineIndex = null;
            // Find the payload in fmtp line.
            for (i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('a=fmtp') !== -1) {
                    var payload = extractSdp(sdpLines[i], /a=fmtp:(\d+)/ );
                    if (payload === opusPayload) {
                        fmtpLineIndex = i;
                        break;
                    }
                }
            }
            // No fmtp line found.
            if (fmtpLineIndex === null) {
                return sdp;
            }

            // Append stereo=1 to fmtp line.
            sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat(' stereo=1');

            sdp = sdpLines.join('\r\n');
            return sdp;
        }
    };

});



