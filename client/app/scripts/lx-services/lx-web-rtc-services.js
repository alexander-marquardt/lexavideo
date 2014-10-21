'use strict';

var webRtcServices = angular.module('lxVideoSetup.services', []);



/* The following globally defined functions come from adapter.js, which is a "shim" to make sure that
   webRTC works in both Chrome and Firefox. */
/* global createIceServers */
/* global getUserMedia */
/* global RTCPeerConnection */
/* global RTCSessionDescription */
/* global RTCIceCandidate */
/* global attachMediaStream */
/* global reattachMediaStream */




webRtcServices.service('lxAdapterService', function ($log) {
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


webRtcServices.service('lxTurnSupportService', function () {
    // This function tracks some variables that are needed by multiple services, where one of the services has
    // a dependency on the other one.
    // In order to prevent circular dependencies, this variable needs to be in its own service, even though
    // it could logically fit into the lxTurnService service.

    // Note that this is called as a service vs. a factory, which means that it will be invoked with the "new" keyword.
    // Therefore, we have direct access to the "this" for the lxTurnSupportService object.
    this.turnDone = false;

});


webRtcServices.factory('lxTurnService',
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

            $log.error('No TURN server; unlikely that media will traverse networks.');
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



webRtcServices.service('lxIceService', function($log, lxMessageService) {
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
        $log.error('Failed to add Ice Candidate: ' + angular.toJson(error));
    };
});

webRtcServices.factory('lxSessionDescriptionService',
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
                if (!(videoTracks.length === 0 || remoteVideoObject.remoteHdVideoElem.currentTime > 0)) {
                    $timeout(innerWaitForRemoteVideo, 100);
                }
            };
            innerWaitForRemoteVideo();
        };

        var self =  {

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
        return self;
    }
);

webRtcServices.service('lxWebRtcSessionService',
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
        self.stop(self, localVideoObject);
    };

    var self = {

        started : false,
        // initial value for signalingReady will be set in lxChannelMessageService->onChannelMessage
        signalingReady : null,


        stop: function() {
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

        processSignalingMessage: function( message, localVideoObject, remoteVideoObject) {
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

webRtcServices.factory('lxPeerService',
    function(
        $log,

        lxAdapterService,
        lxIceService,
        lxUseChatRoomVarsService,
        lxUseChatRoomConstantsService)
    {


        var pcStatus = function () {
            var contents = '';
            if (self.pc) {
                contents += 'Gathering: ' + self.pc.iceGatheringState + '\n';
                contents += 'PC State:\n';
                contents += 'Signaling: ' + self.pc.signalingState + '\n';
                contents += 'ICE: ' + self.pc.iceConnectionState + '\n';
            }
            return contents;
        };

        var onRemoteStreamAdded = function(localVideoObject, remoteVideoObject, videoSignalingObject) {
            return function(mediaStreamEvent) {
                $log.log('Remote stream added.');
                lxAdapterService.attachMediaStream(remoteVideoObject.remoteHdVideoElem, mediaStreamEvent.stream);
                self.remoteStream = mediaStreamEvent.stream;

                videoSignalingObject.videoSignalingStatusForUserFeedback = null; // clear feedback messages
                videoSignalingObject.localIsSendingVideoType = 'HD Video';
                videoSignalingObject.remoteIsSendingVideoType = 'HD Video';
            };
        };


        var onRemoteStreamRemoved = function() {
            $log.info('Remote stream removed.');
        };

        var onSignalingStateChanged = function(){
            return function() {
                $log.info(pcStatus());
            };
        };

        var onIceConnectionStateChanged = function() {
            return function() {
                $log.info(pcStatus());
            };
        };



        /* Externally visible variables and methods */
        var self =  {
            pc : null,
            remoteStream : null,
            createPeerConnection : function(localVideoObject, remoteVideoObject, videoSignalingObject) {
                try {
                    // Create an RTCPeerConnection via the polyfill (adapter.js).
                    self.pc = new lxAdapterService.RTCPeerConnection(lxUseChatRoomVarsService.pcConfig, lxUseChatRoomConstantsService.pcConstraints);
                    self.pc.onicecandidate = lxIceService.onIceCandidate;
                    $log.log('Created RTCPeerConnnection with:\n' +
                        '  config: \'' + JSON.stringify(lxUseChatRoomVarsService.pcConfig) + '\';\n' +
                        '  constraints: \'' + JSON.stringify(lxUseChatRoomConstantsService.pcConstraints) + '\'.');
                } catch (e) {
                    e.message = '\n\tFailed to create PeerConnection\n\t' + e.message;
                    $log.error(e);
                    return;
                }
                self.pc.onaddstream = onRemoteStreamAdded(localVideoObject, remoteVideoObject, videoSignalingObject);
                self.pc.onremovestream = onRemoteStreamRemoved;
                self.pc.onsignalingstatechange = onSignalingStateChanged();
                self.pc.oniceconnectionstatechange = onIceConnectionStateChanged();
            },
            removeLocalVideoStream : function(/*localStream*/) {
                if (self.pc) {
                    $log.error('This functionality is not supported by Firefox as of Aug 18 2014, and therefore should not be used.');
                    //self.pc.removeStream(localStream);
                }
            },
            addLocalVideoStream : function(localStream) {

                if (self.pc) {
                    self.pc.addStream(localStream);
                } else {
                    $log.error('Error: no peer connection has been established, and therefore we cannot add the stream to it.');
                }
            }
        };
        return self;
    }
);


webRtcServices.service('lxStreamService', function() {

    this.localStream = null;

});

webRtcServices.factory('lxMediaService',
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
                lxAdapterService.attachMediaStream(localVideoObject.localHdVideoElem, stream);
                localVideoObject.localHdVideoElem.style.opacity = 1;
                lxStreamService.localStream = stream;
                $timeout(function() {
                    videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'allowAccess';
                });

                // we might have been waiting for access to the media stream to start the call.
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

webRtcServices.factory('lxCallService',
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



        var calleeStart = function(localVideoObject, remoteVideoObject, videoSignalingObject) {
            // Callee starts to process cached offer and other messages.
            while (lxChannelMessageService.getQueueLength() > 0 && videoSignalingObject.localHasSelectedVideoType === 'HD Video') {
                lxWebRtcSessionService.processSignalingMessage(lxChannelMessageService.shift(), localVideoObject, remoteVideoObject);
            }
        };



        var self = {
            hasAudioOrVideoMediaConstraints : false,


            maybeStart : function(localVideoObject, remoteVideoObject, videoSignalingObject) {

                // Only transmit HD video if the local user has authorized it by selecting the HD Video button,
                // or by leaving the default as HD Video.
                if (videoSignalingObject.localHasSelectedVideoType === 'HD Video') {

                    if (!lxWebRtcSessionService.started && lxWebRtcSessionService.signalingReady && lxChannelSupportService.channelReady &&
                        lxTurnSupportService.turnDone && (lxStreamService.localStream || !self.hasAudioOrVideoMediaConstraints)) {

                        $log.debug('Starting webRtc services!!');

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
                            $log.log('Executing calleeStart()');
                            calleeStart(localVideoObject, remoteVideoObject, videoSignalingObject);
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
                }
            },

            doHangup : function() {
                $log.log('*** Hanging up. ***');
                lxStreamService.localStream.stop();
                lxWebRtcSessionService.stop();
                // will trigger BYE from server
                lxChannelSupportService.socket.close();
            },

            setWebcamMute : function(localVideoObject, newIsMutedValue) {

                var i;
                var videoTracks = lxStreamService.localStream.getVideoTracks();

                localVideoObject.isWebcamMuted = newIsMutedValue;

                if (videoTracks.length === 0) {
                    $log.log('No local video available.');
                    return;
                }

                if (!localVideoObject.isWebcamMuted) {
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

            toggleWebcamMute : function(localVideoObject) {
                self.setWebcamMute(localVideoObject, !localVideoObject.isWebcamMuted);
            },

            setMicrophoneMute : function(localVideoObject, newIsMutedValue) {
                var i;
                // Call the getAudioTracks method via adapter.js.
                var audioTracks = lxStreamService.localStream.getAudioTracks();

                localVideoObject.isMicrophoneMuted = newIsMutedValue;

                if (audioTracks.length === 0) {
                    $log.log('No local audio available.');
                    return;
                }

                if (!localVideoObject.isMicrophoneMuted) {
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

            toggleMicrophoneMute: function(localVideoObject) {
                self.setMicrophoneMute(localVideoObject, !localVideoObject.isMicrophoneMuted);
            },

            toggleAudioMute: function(remoteVideoObject) {
                remoteVideoObject.remoteHdVideoElem.muted = !remoteVideoObject.remoteHdVideoElem.muted;
            }
        };
        return self;
    }
);

