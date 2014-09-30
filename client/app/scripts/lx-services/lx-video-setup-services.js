'use strict';

var videoAppServices = angular.module('lxVideoSetup.services', []);



/* The following globally defined functions come from adapter.js, which is a "shim" to make sure that
   webRTC works in both Chrome and Firefox. */
/* global createIceServers */
/* global getUserMedia */
/* global RTCPeerConnection */
/* global RTCSessionDescription */
/* global RTCIceCandidate */
/* global attachMediaStream */
/* global reattachMediaStream */




videoAppServices.service('lxAdapterService', function ($log) {
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
        e.message = '\n\tError in lxAdapterService\n\t' + e.message;
        $log.error(e);
    }
});


videoAppServices.service('lxTurnSupportService', function () {
    // This function tracks some variables that are needed by multiple services, where one of the services has
    // a dependency on the other one.
    // In order to prevent circular dependencies, this variable needs to be in its own service, even though
    // it could logically fit into the lxTurnService service.

    // Note that this is called as a service vs. a factory, which means that it will be invoked with the "new" keyword.
    // Therefore, we have direct access to the "this" for the lxTurnSupportService object.
    this.turnDone = false;

});


videoAppServices.factory('lxTurnService',
    function(
        $log,
        $http,

        lxAdapterService,
        lxAppWideConstantsService,
        lxCallService,
        lxPeerService,
        lxTurnSupportService,
        lxUseChatRoomConstantsService,
        lxUseChatRoomVarsService)
    {


        var onTurnResult = function(response) {

            try {
                var turnServer = response.data;
                // Create turnUris using the polyfill (adapter.js).
                var iceServers = lxAdapterService.createIceServers(turnServer.uris,
                    turnServer.username,
                    turnServer.password);
                if (iceServers !== null) {
                    lxUseChatRoomVarsService.pcConfig.iceServers = lxUseChatRoomVarsService.pcConfig.iceServers.concat(iceServers);
                }
                $log.log('Got pcConfig.iceServers:' + lxUseChatRoomVarsService.pcConfig.iceServers + '\n');
            } catch(e) {
                e.message = '\n\tError in onTurnResult\n\t' + e.message;
                $log.error(e);
            }
        };

        var onTurnError = function() {

            $log.error('No TURN server; unlikely that media will traverse networks.  ' +
                'If this persists please report it to info@lexabit.com');
        };


        var afterTurnRequest = function() {
            return function () {
                // Even if TURN request failed, continue the call with default STUN.
                lxTurnSupportService.turnDone = true;
            };
        };

        return {

            maybeRequestTurn : function() {

                var turnUrl = 'https://computeengineondemand.appspot.com/' + 'turn?' + 'username=' +
                    lxAppWideConstantsService.userName + '&key=4080218913';


                for (var i = 0, len = lxUseChatRoomVarsService.pcConfig.iceServers.length; i < len; i++) {
                    if (lxUseChatRoomVarsService.pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
                        lxTurnSupportService.turnDone = true;
                        return;
                    }
                }

                var currentDomain = document.domain;
                if (currentDomain.search('localhost') === -1 &&
                    currentDomain.search('apprtc') === -1) {
                    // Not authorized domain. Try with default STUN instead.
                    lxTurnSupportService.turnDone = true;
                    return;
                }

                // No TURN server. Get one from computeengineondemand.appspot.com.
                $http.get(turnUrl).then(onTurnResult, onTurnError).then(afterTurnRequest());
            }
        };
    }
);


videoAppServices.factory('lxMessageService',
    function(
        $http,
        $log,
        lxUseChatRoomVarsService,
        lxUseChatRoomConstantsService,
        lxAppWideConstantsService)
    {

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

                $log.debug('C->S: ' + angular.toJson(messagePayload));
                // NOTE: AppRTCClient.java searches & parses this line; update there when
                // changing here.
                var path = '/_lx/message?r=' + lxUseChatRoomVarsService.roomId + '&u=' + lxAppWideConstantsService.userName;

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
    }
);

videoAppServices.service('lxIceService', function($log, lxMessageService) {
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
            lxMessageService.sendMessage('sdp', {type: 'candidate',
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
        $log.error('Failed to add Ice Candidate: ' + error.toString());
    };
});

videoAppServices.service('lxSessionDescriptionService',
    function(
        $log,
        $timeout,

        lxAdapterService,
        lxCodecsService,
        lxMessageService,
        lxPeerService,
        lxUseChatRoomConstantsService,
        lxUseChatRoomVarsService)
    {

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
            $log.error('Failed to create session description: ' + error.toString());
        };

        var onSetSessionDescriptionError = function(error) {
            $log.error('Failed to set session description: ' + error.toString());
        };

        var setLocalAndSendMessage = function(pc) {
            return function(sessionDescription) {
                sessionDescription.sdp = lxCodecsService.maybePreferAudioReceiveCodec(sessionDescription.sdp);
                sessionDescription.sdp = lxCodecsService.maybeSetAudioReceiveBitRate(sessionDescription.sdp);
                sessionDescription.sdp = lxCodecsService.maybeSetVideoReceiveBitRate(sessionDescription.sdp);

                pc.setLocalDescription(sessionDescription,
                    onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
                lxMessageService.sendMessage('sdp', sessionDescription);
            };
        };

        var waitForRemoteVideo = function(localVideoObject, remoteVideoObject) {
            var innerWaitForRemoteVideo = function() {

                var videoTracks = lxPeerService.remoteStream.getVideoTracks();
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
                lxPeerService.pc.createAnswer(setLocalAndSendMessage(lxPeerService.pc),
                    onCreateSessionDescriptionError, lxUseChatRoomVarsService.sdpConstraints);
            },

            doCall : function() {
                var constraints = mergeConstraints(lxUseChatRoomConstantsService.offerConstraints, lxUseChatRoomVarsService.sdpConstraints);
                $log.log('Sending offer to peer, with constraints: \n' +
                    '  \'' + JSON.stringify(constraints) + '\'.');
                lxPeerService.pc.createOffer(setLocalAndSendMessage(lxPeerService.pc),
                    onCreateSessionDescriptionError, constraints);
            },

            setRemote : function(message, localVideoObject, remoteVideoObject) {
                var onSetRemoteDescriptionSuccess = function(){
                    $log.log('Set remote session description success.');
                    // By now all addstream events for the setRemoteDescription have fired.
                    // So we can know if the peer is sending any stream or is only receiving.
                    if (lxPeerService.remoteStream) {
                        waitForRemoteVideo(localVideoObject, remoteVideoObject);
                    } else {
                        $log.log('Not receiving any stream.');
                        self.transitionSessionStatus('active');
                    }
                };

                // Set Opus in Stereo, if stereo enabled.
                if (lxUseChatRoomConstantsService.stereo) {
                    message.sdp = lxCodecsService.addStereo(message.sdp);
                }
                message.sdp = lxCodecsService.maybePreferAudioSendCodec(message.sdp);
                message.sdp = lxCodecsService.maybeSetAudioSendBitRate(message.sdp);
                message.sdp = lxCodecsService.maybeSetVideoSendBitRate(message.sdp);
                message.sdp = lxCodecsService.maybeSetVideoSendInitialBitRate(message.sdp);

                lxPeerService.pc.setRemoteDescription(new lxAdapterService.RTCSessionDescription(message),
                    onSetRemoteDescriptionSuccess, onSetSessionDescriptionError);
            }
        };

        angular.extend(self, publicMethods);
    }
);

videoAppServices.service('lxWebRtcSessionService',
    function(
        $log,
        $window,
        $rootScope,
        $timeout,
        lxMessageService,
        lxCodecsService,
        lxUseChatRoomVarsService,
        lxSessionDescriptionService,
        lxUseChatRoomConstantsService,
        lxIceService,
        lxPeerService,
        lxChannelMessageService,
        lxChannelSupportService,
        lxAdapterService) {


    var onRemoteHangup = function(self, localVideoObject) {
        $log.log('Session terminated.');
        lxSessionDescriptionService.transitionSessionStatus('waiting');
        self.stop(self, localVideoObject);
    };

    var self = {

        started : false,
        // initial value for signalingReady will be set in lxInitializeChannelAndTurnDirective
        signalingReady : null,


        stop : function() {
            self.started = false;
            // If this user is rtcInitiator, then its signaling is ready. Otherwise wait for other 'offer' from
            // the other client.
            self.signalingReady = lxChannelSupportService.rtcInitiator;
            if (lxPeerService.pc) {
                lxPeerService.pc.close();
            }
            lxPeerService.pc = null;
            lxPeerService.remoteStream = null;
            lxChannelMessageService.clearQueue();
        },

        processSignalingMessage : function( message, localVideoObject, remoteVideoObject) {
            if (!self.started) {
                $log.error('peerConnection has not been created yet!');
                return;
            }

            if (message.type === 'offer') {
                lxSessionDescriptionService.setRemote(message, localVideoObject, remoteVideoObject);
                lxSessionDescriptionService.doAnswer();

            } else if (message.type === 'answer') {
                lxSessionDescriptionService.setRemote(message, localVideoObject, remoteVideoObject);
            } else if (message.type === 'candidate') {
                var candidate = new lxAdapterService.RTCIceCandidate({sdpMLineIndex: message.label,
                    candidate: message.candidate});
                lxIceService.noteIceCandidate('Remote', lxIceService.iceCandidateType(message.candidate));
                lxPeerService.pc.addIceCandidate(candidate,
                    lxIceService.onAddIceCandidateSuccess, lxIceService.onAddIceCandidateError);
            } else if (message.type === 'bye') {
                onRemoteHangup(this, localVideoObject);
            }
        }
    };

    return self;
});

videoAppServices.factory('lxPeerService',
    function(
        $log,

        lxAdapterService,
        lxIceService,
        lxUseChatRoomVarsService,
        lxUseChatRoomConstantsService)
    {


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
                lxAdapterService.attachMediaStream(remoteVideoObject.remoteVideoElem, mediaStreamEvent.stream);
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
                    this.pc = new lxAdapterService.RTCPeerConnection(lxUseChatRoomVarsService.pcConfig, lxUseChatRoomConstantsService.pcConstraints);
                    this.pc.onicecandidate = lxIceService.onIceCandidate;
                    $log.log('Created RTCPeerConnnection with:\n' +
                        '  config: \'' + JSON.stringify(lxUseChatRoomVarsService.pcConfig) + '\';\n' +
                        '  constraints: \'' + JSON.stringify(lxUseChatRoomConstantsService.pcConstraints) + '\'.');
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
    }
);


videoAppServices.service('lxStreamService', function() {

    this.localStream = null;

});

videoAppServices.factory('lxMediaService',
    function(
        $log,
        $timeout,

        lxAdapterService,
        lxCallService,
        lxUseChatRoomConstantsService,
        lxStreamService)
    {


        var onUserMediaSuccess = function(localVideoObject, remoteVideoObject, videoSignalingObject) {
            return function(stream) {
                $log.log('User has granted access to local media.');
                // Call the polyfill wrapper to attach the media stream to this element.
                lxAdapterService.attachMediaStream(localVideoObject.localVideoElem, stream);
                localVideoObject.localVideoElem.style.opacity = 1;
                lxStreamService.localStream = stream;
                $timeout(function() {
                    videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'allowAccess';
                });
                lxCallService.maybeStart(localVideoObject, remoteVideoObject, videoSignalingObject);
            };
        };

        var onUserMediaError = function(videoSignalingObject) {
            return function(error) {
                $log.warn('Failed to get access to local media. Error code was ' +
                    error.code + '. Continuing without sending a stream.');

                $timeout(function() {
                    lxCallService.hasAudioOrVideoMediaConstraints = false;
                    videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'denyAccess';
                });
            };
        };

        return {


            doGetUserMedia  : function(localVideoObject, remoteVideoObject, videoSignalingObject) {
                // Call into getUserMedia via the polyfill (adapter.js).
                try {
                    lxAdapterService.getUserMedia(lxUseChatRoomConstantsService.mediaConstraints,
                        onUserMediaSuccess(localVideoObject, remoteVideoObject, videoSignalingObject),
                        onUserMediaError(videoSignalingObject));
                    $log.log('Requested access to local media with mediaConstraints:\n' +
                        '  \'' + JSON.stringify(lxUseChatRoomConstantsService.mediaConstraints) + '\'');
                    videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'waitingForResponse';

                } catch (e) {
                    e.message = '\n\tError in doGetUserMedia\n\t' + e.message;
                    $log.error(e);
                    videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'denyAccess';
                }
            }
        };
    }
);

videoAppServices.factory('lxCallService',
    function(
        $log,
        lxTurnSupportService,
        lxPeerService,
        lxWebRtcSessionService,
        lxChannelSupportService,
        lxUseChatRoomConstantsService,
        lxUseChatRoomVarsService,
        lxChannelMessageService,
        lxStreamService,
        lxSessionDescriptionService)
    {



        var calleeStart = function(localVideoObject, remoteVideoObject) {
            // Callee starts to process cached offer and other messages.
            while (lxChannelMessageService.getQueueLength() > 0) {
                lxWebRtcSessionService.processSignalingMessage(lxChannelMessageService.shift(), localVideoObject, remoteVideoObject);
            }
        };



        var self = {
            hasAudioOrVideoMediaConstraints : false,


            maybeStart : function(localVideoObject, remoteVideoObject, videoSignalingObject) {


                if (!lxWebRtcSessionService.started && lxWebRtcSessionService.signalingReady && lxChannelSupportService.channelReady &&
                    lxTurnSupportService.turnDone && (lxStreamService.localStream || !self.hasAudioOrVideoMediaConstraints)) {

                    $log.log('Connecting...Creating PeerConnection.');

                    lxPeerService.createPeerConnection(localVideoObject, remoteVideoObject, videoSignalingObject);

                    if (self.hasAudioOrVideoMediaConstraints) {
                        $log.log('Adding local stream.');
                        lxPeerService.addLocalVideoStream(lxStreamService.localStream);
                    } else {
                        $log.log('Not sending any stream.');
                    }
                    lxWebRtcSessionService.started = true;

                    if (lxChannelSupportService.rtcInitiator) {
                        $log.log('Executing doCall()');
                        lxSessionDescriptionService.doCall();
                    }
                    else {
                        $log.log('Executing caleeStart()');
                        calleeStart(localVideoObject, remoteVideoObject);
                    }
                } else {
                    // By construction, this branch should not be executed since all of the pre-requisites for setting
                    // up a call should have been previously met.
                    $log.debug('Not ready to start webRtc services.');
                    if (lxWebRtcSessionService.started) {
                        $log.debug('Because lxWebRtcSessionService.started is true');
                    }
                    if (!lxWebRtcSessionService.signalingReady) {
                        $log.debug('Because lxWebRtcSessionService.signalingReady is false');
                    }
                    if (!lxChannelSupportService.channelReady) {
                        $log.debug('Because lxChannelSupportService.channelReady is false');
                    }
                    if (!lxTurnSupportService.turnDone) {
                        $log.debug('Because lxTurnSupportService.turnDone is false');
                    }
                    if (!lxStreamService.localStream) {
                        $log.debug('Because lxStreamService.localStream is false');
                    }
                }
            },

            doHangup : function(localVideoObject) {
                return function() {
                    $log.log('*** Hanging up. ***');
                    lxSessionDescriptionService.transitionSessionStatus('done');
                    lxStreamService.localStream.stop();
                    lxWebRtcSessionService.stop();
                    self.unMuteAudioAndVideo(localVideoObject);
                    // will trigger BYE from server
                    lxChannelSupportService.socket.close();
                };
            },

            setVideoMute : function(localVideoObject, newIsMutedValue) {

                var i;
                var videoTracks = lxStreamService.localStream.getVideoTracks();

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
                var audioTracks = lxStreamService.localStream.getAudioTracks();

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
                self.setVideoMute(localVideoObject, false);
                self.setAudioMute(localVideoObject, false);
            }
        };
        return self;
    }
);


videoAppServices.factory('lxUserNotificationService',
    function(
        $log,
        $timeout,
        lxUseChatRoomConstantsService,
        lxChannelSupportService)
    {
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
                if (!lxChannelSupportService.rtcInitiator) {
                    this.setStatus('Waiting for someone to join:  <a lass="navbar-link" href=' + lxUseChatRoomConstantsService.roomLink + '>' + lxUseChatRoomConstantsService.roomLink + '</a>');
                } else {
                    this.setStatus('Initializing...');
                }
            }
        };
    }
);

videoAppServices.factory('lxCodecsService',
    function(
        $log,
        lxUseChatRoomConstantsService)
    {

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
                $log.error('Failed to add bandwidth line to sdp, as no m-line found');
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
                $log.error('Failed to add bandwidth line to sdp, as no c-line found');
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

            // Adds an a=fmtp: x-google-min-bitrate=kbps line, if lxUseChatRoomConstantsService.videoSendInitialBitrate
            // is specified. We'll also add a x-google-min-bitrate value, since the max
            // must be >= the min.
            maybeSetVideoSendInitialBitRate : function(sdp) {
                if (!lxUseChatRoomConstantsService.videoSendInitialBitrate) {
                    return sdp;
                }

                // Validate the initial bitrate value.
                var maxBitrate = lxUseChatRoomConstantsService.videoSendInitialBitrate;
                if (lxUseChatRoomConstantsService.videoSendBitrate) {
                    if (lxUseChatRoomConstantsService.videoSendInitialBitrate > lxUseChatRoomConstantsService.videoSendBitrate) {
                        $log.error('Clamping initial bitrate to max bitrate of ' +
                            lxUseChatRoomConstantsService.videoSendBitrate + ' kbps.');
                        lxUseChatRoomConstantsService.videoSendInitialBitrate = lxUseChatRoomConstantsService.videoSendBitrate;
                    }
                    maxBitrate = lxUseChatRoomConstantsService.videoSendBitrate;
                }

                var sdpLines = sdp.split('\r\n');

                // Search for m line.
                var mLineIndex = findLine(sdpLines, 'm=', 'video');
                if (mLineIndex === null) {
                    $log.error('Failed to find video m-line');
                    return sdp;
                }

                var vp8RtpmapIndex = findLine(sdpLines, 'a=rtpmap', 'VP8/90000');
                var vp8Payload = getCodecPayloadType(sdpLines[vp8RtpmapIndex]);
                var vp8Fmtp = 'a=fmtp:' + vp8Payload + ' x-google-min-bitrate=' +
                    lxUseChatRoomConstantsService.videoSendInitialBitrate.toString() + '; x-google-max-bitrate=' +
                    maxBitrate.toString();
                sdpLines.splice(vp8RtpmapIndex + 1, 0, vp8Fmtp);
                return sdpLines.join('\r\n');
            },

            maybeSetAudioSendBitRate : function(sdp) {
                if (!lxUseChatRoomConstantsService.audioSendBitrate) {
                    return sdp;
                }
                $log.log('Prefer audio send bitrate: ' + lxUseChatRoomConstantsService.audioSendBitrate);
                return preferBitRate(sdp, lxUseChatRoomConstantsService.audioSendBitrate, 'audio');
            },

            maybeSetAudioReceiveBitRate : function (sdp) {
                if (!lxUseChatRoomConstantsService.audioRecvBitrate) {
                    return sdp;
                }
                $log.log('Prefer audio receive bitrate: ' + lxUseChatRoomConstantsService.audioRecvBitrate);
                return preferBitRate(sdp, lxUseChatRoomConstantsService.audioRecvBitrate, 'audio');
            },


            maybeSetVideoSendBitRate : function (sdp) {
                if (!lxUseChatRoomConstantsService.videoSendBitrate) {
                    return sdp;
                }
                $log.log('Prefer video send bitrate: ' + lxUseChatRoomConstantsService.videoSendBitrate);
                return preferBitRate(sdp, lxUseChatRoomConstantsService.videoSendBitrate, 'video');
            },

            maybeSetVideoReceiveBitRate : function(sdp) {
                if (!lxUseChatRoomConstantsService.videoRecvBitrate) {
                    return sdp;
                }
                $log.log('Prefer video receive bitrate: ' + lxUseChatRoomConstantsService.videoRecvBitrate);
                return preferBitRate(sdp, lxUseChatRoomConstantsService.videoRecvBitrate, 'video');
            },


            maybePreferAudioSendCodec : function(sdp) {
                if (lxUseChatRoomConstantsService.audioSendCodec === '') {
                    $log.log('No preference on audio send codec.');
                    return sdp;
                }
                $log.log('Prefer audio send codec: ' + lxUseChatRoomConstantsService.audioSendCodec);
                return preferAudioCodec(sdp, lxUseChatRoomConstantsService.audioSendCodec);
            },

            maybePreferAudioReceiveCodec : function(sdp) {
                if (lxUseChatRoomConstantsService.audioReceiveCodec === '') {
                    $log.log('No preference on audio receive codec.');
                    return sdp;
                }
                $log.log('Prefer audio receive codec: ' + lxUseChatRoomConstantsService.audioReceiveCodec);
                return preferAudioCodec(sdp, lxUseChatRoomConstantsService.audioReceiveCodec);
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

    }
);



