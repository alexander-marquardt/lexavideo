'use strict';

var webRtcServices = angular.module('lxVideoSetup.services', []);



/* The following globally defined functions come from adapter.js, which is a "shim" to make sure that
   webRTC works in both Chrome and Firefox. */
/* global webrtcDetectedBrowser */
/* global getUserMedia */
/* global RTCPeerConnection */
/* global RTCSessionDescription */
/* global RTCIceCandidate */
/* global attachMediaStream */
/* global reattachMediaStream */

// The following flag is only used for debugging, and should never be true for a production build
var force_video_through_turn = false;


webRtcServices.service('lxAdapterService', function ($log) {
    /* simple wrapper for global functions contained in adapter.js. This will make it
       easier to do unit testing in the future.
     */
    try {
        this.webrtcDetectedBrowser = webrtcDetectedBrowser;

        // only setup the remaining variables if we know that the adapter service has set them up.
        // If webrtcDetectedBrowser is null, then many of the following variables have not been initialized
        // and should not be accessed.
        if (webrtcDetectedBrowser) {
            this.createIceServers = window.createIceServers;
            this.RTCPeerConnection = RTCPeerConnection;
            this.RTCSessionDescription = RTCSessionDescription;
            this.getUserMedia = getUserMedia;
            this.attachMediaStream = attachMediaStream;
            this.reattachMediaStream = reattachMediaStream;
            this.RTCIceCandidate = RTCIceCandidate;
        }
        else {
            this.reattachMediaStream = function() {
                $log.warn('reattachMediaStream called on an unsupported browser');
            };
        }
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
        lxCheckCompatibilityService,
        lxJs,
        lxPeerService,
        lxTurnSupportService,
        lxVideoParamsService)
    {


        var onTurnResult = function(response) {

            try {
                var turnServer = response.data;
                // Create turnUris using the polyfill (adapter.js).
                var iceServers = lxAdapterService.createIceServers(turnServer.uris,
                    turnServer.username,
                    turnServer.password);
                if (iceServers !== null) {
                    lxVideoParamsService.pcConfig.iceServers = lxVideoParamsService.pcConfig.iceServers.concat(iceServers);
                }
                $log.log('Got pcConfig.iceServers:' + angular.toJson(lxVideoParamsService.pcConfig.iceServers) + '\n');
            } catch(e) {
                e.message = '\n\tError in onTurnResult\n\t' + e.message;
                $log.error(e);
            }
        };

        var onTurnError = function() {

            $log.error('Error getting TURN server; unlikely that media will traverse networks.');
        };


        var afterTurnRequest = function(scope, remoteClientId) {
            return function () {
                // Even if TURN request failed, continue the call with default STUN.
                lxTurnSupportService.turnDone = true;

                // We may have been waiting for a turn server to start the call.
                lxJs.assert(remoteClientId);
                lxCallService.maybeStart(scope, remoteClientId);
            };
        };

        return {

            // Note, in the future if this is slowing down the start of the video, then we could
            // pre-fetch the turn server and credentials rather than waiting for the user to request
            // the video before getting the data.
            maybeRequestTurn : function(scope, clientId, remoteClientId) {

                // If the broswer supports WebRTC, then setup a turn server
                if (lxCheckCompatibilityService.userDeviceBrowserAndVersionSupported) {

                    // Get a turn server with credentials
                    lxTurnSupportService.turnDone = false;
                    var turnUrl = '/_lx/turn/request_rest_credentials/';
                    var postData = {
                        'clientId': clientId
                    };
                    $http({
                        url: turnUrl,
                        method: 'POST',
                        data: postData
                    }).then(onTurnResult, onTurnError).then(afterTurnRequest(scope, remoteClientId));
                }

                // otherwise, the browser does not support WebRtc - we do not try to setup video
                else {
                    $log.warn('This browser does not support WebRTC - we cannot setup a video connection');
                }

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
    // reference to "this".
    var self = this;

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

    this.onIceCandidate = function(clientId, remoteClientId) {
        return function(event) {
            if (event.candidate) {

                if (force_video_through_turn && self.iceCandidateType(event.candidate.candidate) !== 'TURN') {
                    $log.error('We are forcing all video through the turn server. This should only be done for debugging.');
                    return;
                }

                lxMessageService.sendMessageToClientFn('sdp', {type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate},
                    clientId,
                    remoteClientId);

                $log.log('Local ICE Candidate: ' + self.iceCandidateType(event.candidate.candidate) +
                    ' ' + angular.toJson(event.candidate));
            } else {
                $log.log('End of candidates.');
            }
        };
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
        lxChatRoomVarsService,
        lxVideoParamsService)
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

        var setLocalAndSendMessage = function(pc, clientId, remoteClientId) {
            return function(sessionDescription) {
                sessionDescription.sdp = lxCodecsService.maybePreferAudioReceiveCodec(sessionDescription.sdp);
                sessionDescription.sdp = lxCodecsService.maybeSetAudioReceiveBitRate(sessionDescription.sdp);
                sessionDescription.sdp = lxCodecsService.maybeSetVideoReceiveBitRate(sessionDescription.sdp);

                pc.setLocalDescription(sessionDescription,
                    onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
                lxMessageService.sendMessageToClientFn('sdp', sessionDescription, clientId, remoteClientId);
            };
        };

        var waitForRemoteVideo = function(remoteVideoObject, remoteClientId) {
            var innerWaitForRemoteVideo = function() {

                var videoTracks = lxPeerService.remoteStream[remoteClientId].getVideoTracks();
                if (!(videoTracks.length === 0 || remoteVideoObject.remoteMiniVideoElem.currentTime > 0)) {
                    $timeout(innerWaitForRemoteVideo, 100);
                }
            };
            innerWaitForRemoteVideo();
        };

        var self =  {

            doAnswer : function(clientId, remoteClientId) {
                $log.log('Sending answer to peer.');
                lxPeerService.pc[remoteClientId].createAnswer(setLocalAndSendMessage(lxPeerService.pc[remoteClientId], clientId, remoteClientId),
                    onCreateSessionDescriptionError, lxChatRoomVarsService.sdpConstraints);
            },

            doCall : function(clientId, remoteClientId) {
                var constraints = mergeConstraints(lxVideoParamsService.offerConstraints, lxChatRoomVarsService.sdpConstraints);
                $log.log('Sending offer to peer, with constraints: \n' +
                    '  \'' + JSON.stringify(constraints) + '\'.');
                lxPeerService.pc[remoteClientId].createOffer(setLocalAndSendMessage(lxPeerService.pc[remoteClientId], clientId, remoteClientId),
                    onCreateSessionDescriptionError, constraints);
            },

            setRemote : function(message, localVideoObject, remoteVideoObject, remoteClientId) {
                var onSetRemoteDescriptionSuccess = function(){
                    $log.log('Set remote session description success.');
                    // By now all addstream events for the setRemoteDescription have fired.
                    // So we can know if the peer is sending any stream or is only receiving.
                    if (lxPeerService.remoteStream[remoteClientId]) {
                        waitForRemoteVideo(remoteVideoObject, remoteClientId);
                    } else {
                        $log.log('Not receiving any stream.');
                    }
                };

                // Set Opus in Stereo, if stereo enabled.
                if (lxVideoParamsService.stereo) {
                    message.sdp = lxCodecsService.addStereo(message.sdp);
                }
                message.sdp = lxCodecsService.maybePreferAudioSendCodec(message.sdp);
                message.sdp = lxCodecsService.maybeSetAudioSendBitRate(message.sdp);
                message.sdp = lxCodecsService.maybeSetVideoSendBitRate(message.sdp);
                message.sdp = lxCodecsService.maybeSetVideoSendInitialBitRate(message.sdp);

                lxPeerService.pc[remoteClientId].setRemoteDescription(new lxAdapterService.RTCSessionDescription(message),
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
        lxChatRoomVarsService,
        lxSessionDescriptionService,
        lxIceService,
        lxPeerService,
        lxChannelMessageService,
        lxAdapterService) {


    var onRemoteHangup = function(self, localVideoObject) {
        $log.log('Session terminated.');
        self.stop(self, localVideoObject);
    };

    var self = {

        // For each remote client, track if we have started the webRtc session. Will have an entry
        // for each remoteClientId (eg. webRtcSessionStarted[remoteClientId])
        webRtcSessionStarted : {},
        // initial value for signalingReady will be set in lxChannelMessageService->onChannelMessage. It
        // will be a dictionary containing a value for each remoteClientId (eg signalingReady[remoteClientId])
        signalingReady : {},


        stop: function(remoteClientId) {
            self.webRtcSessionStarted[remoteClientId] = false;
            self.signalingReady[remoteClientId] = false;
            if (lxPeerService.pc[remoteClientId]) {
                lxPeerService.pc[remoteClientId].close();
            }
            delete lxPeerService.pc[remoteClientId];
            delete lxPeerService.remoteStream[remoteClientId];
            lxChannelMessageService.clearQueue(remoteClientId);
        },

        processSignalingMessage: function( message, localVideoObject, remoteVideoObject, clientId, remoteClientId) {

            // Note: this function is called for both the rtcInitiator and the non-rtcInitiator. For this reason
            // it deals with the message types that may be received by either end of call setup.

            if (!self.webRtcSessionStarted[remoteClientId]) {
                $log.warn('peerConnection has not been created yet!');
                return;
            }

            if (message.type === 'offer') {
                lxSessionDescriptionService.setRemote(message, localVideoObject, remoteVideoObject, remoteClientId);
                lxSessionDescriptionService.doAnswer(clientId, remoteClientId);

            } else if (message.type === 'answer') {
                lxSessionDescriptionService.setRemote(message, localVideoObject, remoteVideoObject, remoteClientId);
            } else if (message.type === 'candidate') {
                var candidate = new lxAdapterService.RTCIceCandidate({sdpMLineIndex: message.label,
                    candidate: message.candidate});
                $log.log('Remote ICE Candidate: ' + lxIceService.iceCandidateType(message.candidate) +
                    ' ' + angular.toJson(message));

                lxPeerService.pc[remoteClientId].addIceCandidate(candidate,
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
        lxChatRoomVarsService,
        lxIceService,
        lxJs,
        lxTurnSupportService,
        lxVideoParamsService)
    {


        var pcStatus = function (pc) {
            var contents = '';
            if (pc) {
                contents += 'Gathering: ' + pc.iceGatheringState + '\n';
                contents += 'PC State:\n';
                contents += 'Signaling: ' + pc.signalingState + '\n';
                contents += 'ICE: ' + pc.iceConnectionState + '\n';
            }
            return contents;
        };

        var onRemoteStreamAdded = function(remoteVideoObject, videoSignalingObject, remoteClientId) {
            return function(mediaStreamEvent) {
                $log.log('Remote stream added.');
                $log.log('* remoteVideoObject.remoteMiniVideoElem.src before: ' + remoteVideoObject.remoteMiniVideoElem.src);
                lxAdapterService.attachMediaStream(remoteVideoObject.remoteMiniVideoElem, mediaStreamEvent.stream);

                $log.log('* remoteVideoObject.remoteMiniVideoElem.src after: ' + remoteVideoObject.remoteMiniVideoElem.src);

                self.remoteStream[remoteClientId] = mediaStreamEvent.stream;
            };
        };


        var onRemoteStreamRemoved = function(remoteClientId) {
            return function() {
                self.remoteStream[remoteClientId] = null;
                $log.info('Remote stream removed.');
            };
        };

        var onSignalingStateChanged = function(pc){
            return function() {
                $log.info('onSignalingStateChanged');
                $log.info(pcStatus(pc));
            };
        };

        var onIceConnectionStateChanged = function(pc) {
            return function() {
                $log.info('onIceConnectionStateChanged');
                $log.info(pcStatus(pc));
            };
        };



        /* Externally visible variables and methods */
        var self =  {
            pc : {},
            remoteStream : {},
            createPeerConnection : function(remoteVideoObject, videoSignalingObject, clientId, remoteClientId) {

                $log.log('**************** createPeerConnection ************');
                try {
                    lxJs.assert(clientId, 'clientId is not set');
                    lxJs.assert(remoteClientId, 'remoteClientId is not set');
                    lxJs.assert(lxTurnSupportService.turnDone, 'turn has not been setup');

                    // Create an RTCPeerConnection via the polyfill (adapter.js).
                    self.pc[remoteClientId] = new lxAdapterService.RTCPeerConnection(lxVideoParamsService.pcConfig, lxVideoParamsService.pcConstraints);
                    self.pc[remoteClientId].onicecandidate = lxIceService.onIceCandidate(clientId, remoteClientId);
                    $log.log('Created RTCPeerConnnection to client:\'' + remoteClientId + '\' with:\n' +
                        '  config: \'' + JSON.stringify(lxVideoParamsService.pcConfig) + '\';\n' +
                        '  constraints: \'' + JSON.stringify(lxVideoParamsService.pcConstraints) + '\'.');
                } catch (e) {
                    e.message = '\n\tFailed to create PeerConnection\n\t' + e.message;
                    $log.error(e);
                    return;
                }


                self.pc[remoteClientId].onaddstream = onRemoteStreamAdded(remoteVideoObject, videoSignalingObject, remoteClientId);
                self.pc[remoteClientId].onremovestream = onRemoteStreamRemoved(remoteClientId);
                self.pc[remoteClientId].onsignalingstatechange = onSignalingStateChanged(self.pc[remoteClientId]);
                self.pc[remoteClientId].oniceconnectionstatechange = onIceConnectionStateChanged(self.pc[remoteClientId]);
            },
            removeLocalVideoStream : function(/*localStream*/) {
                $log.error('This functionality is not supported by Firefox as of Aug 18 2014, and therefore should not be used.');
                //self.pc.removeStream(localStream);
            },
            addLocalVideoStream : function(localStream, remoteClientId) {

                if (self.pc[remoteClientId]) {
                    self.pc[remoteClientId].addStream(localStream);
                } else {
                    $log.error('Error: no peer connection has been established, and therefore we cannot add the stream to it.');
                }
            }
        };
        return self;
    }
);


webRtcServices.factory('lxStreamService', function() {

    var self = {
        localStream: null,
        getLocalStream: function() {
            return self.localStream;
        },
        getLocalStreamBoolean: function() {
            return !!self.localStream;
        }

    };

    return self;
});

webRtcServices.factory('lxMediaService',
    function(
        $log,
        $rootScope,
        $timeout,

        lxAdapterService,
        lxCallService,
        lxVideoParamsService,
        lxStreamService)
    {


        // This is a callback function that is executed after the user has given access to their camera and microphone.
        var onUserMediaSuccess = function(scope) {

            var localVideoObject = scope.localVideoObject;
            var videoSignalingObject = scope.videoSignalingObject;

            return function(stream) {
                $log.log('User has granted access to local media.');
                // Call the polyfill wrapper to attach the media stream to this element.
                lxAdapterService.attachMediaStream(localVideoObject.localMiniVideoElem, stream);

                videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'allowAccess';

                // show the most recently added video element (even if it is not receiving video yet). In the case that
                // we are waiting for video to start, the local user will see a message indicating the status of the
                // video signalling.
                scope.videoDisplaySelection.currentlySelectedVideoElementClientId = scope.videoStateInfoObject.currentOpenVideoSessionsList[0];

                lxStreamService.localStream = stream;

                // since microphone and/or webcam may have been muted before localStream was set, we now make sure that
                // the audioTracks settings for the current audio/video stream reflect the current value.
                lxCallService.setMicrophoneMute(localVideoObject, localVideoObject.isMicrophoneMuted);
                lxCallService.setWebcamMute(localVideoObject, localVideoObject.isWebcamMuted);

                for (var remoteClientId in scope.videoExchangeObjectsDict) {
                    if (scope.videoExchangeObjectsDict.hasOwnProperty(remoteClientId)) {
                        // we might have been waiting for access to the media stream to start the call.
                        lxCallService.maybeStart(scope, remoteClientId);
                    }
                }

                // Since onUserMediaSuccess is asynchronously called, we manually call a $apply
                // on the rootScope, so that angular watchers will re-evaluate to see if the above
                // values have been updated.
                $rootScope.$apply();
            };
        };

        // Return a function that is triggered if there is a problem when accessing the users camera and microphone.
        var onUserMediaError = function(videoSignalingObject) {
            return function(e) {

                // For some reason, we cannot override e.message when error is an object with NavigatorUserMediaError
                // as a prototype. So make a copy of the error object, and use that instead.

                var newError = {};
                angular.extend(newError, e);
                var message = '\n\tFailed to get access to local media. Error was ' +
                    e.toString() + angular.toJson(e) + '. Continuing without sending a stream.\n\t';
                newError.message = message + e.message;
                $log.error(newError);

                $timeout(function() {
                    lxCallService.hasAudioOrVideoMediaConstraints = false;
                    videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'denyAccess';
                });
            };
        };

        return {


            doGetUserMedia  : function(scope) {

                var videoSignalingObject = scope.videoSignalingObject;

                // Call into getUserMedia via the polyfill (adapter.js).
                try {

                    // if we have already made a request to access the camera, then don't make another one while we are
                    // still waiting for the response -- this would cause multiple "Allow" buttons to be stacked on each
                    // other in the containing browser.
                    if (videoSignalingObject.localUserAccessCameraAndMicrophoneStatus !== 'waitingForResponse') {
                        lxAdapterService.getUserMedia(lxVideoParamsService.mediaConstraints,
                            onUserMediaSuccess(scope),
                            onUserMediaError(videoSignalingObject));
                        $log.debug('Requested access to local media with mediaConstraints:\n' +
                            '  \'' + JSON.stringify(lxVideoParamsService.mediaConstraints) + '\'');
                        videoSignalingObject.localUserAccessCameraAndMicrophoneStatus = 'waitingForResponse';
                    } 

                    else {
                        $log.debug('getUserMedia request has already been made, and so we are not making a new call to getUserMedia');
                    }

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
        lxVideoParamsService,
        lxChatRoomVarsService,
        lxChannelMessageService,
        lxStreamService,
        lxSessionDescriptionService)
    {



        var calleeStart = function(localVideoObject, remoteVideoObject, clientId, remoteClientId) {
            // Callee starts to process cached offer and other messages.
            while (lxChannelMessageService.getQueueLength(remoteClientId) > 0 ) {
                lxWebRtcSessionService.processSignalingMessage(lxChannelMessageService.shift(remoteClientId), localVideoObject,
                    remoteVideoObject, clientId, remoteClientId);
            }
        };



        var self = {
            hasAudioOrVideoMediaConstraints : false,


            maybeStart : function(scope, remoteClientId) {

                $log.log('************ Entering maybeStart *************');

                var localVideoObject = scope.localVideoObject;
                var remoteVideoObject = scope.remoteVideoElementsDict[remoteClientId];
                var videoSignalingObject = scope.videoSignalingObject;
                var clientId = scope.lxMainCtrlDataObj.clientId;

                if (!lxWebRtcSessionService.webRtcSessionStarted[remoteClientId] && lxWebRtcSessionService.signalingReady[remoteClientId] && scope.channelObject.channelIsAlive &&
                    lxTurnSupportService.turnDone && (lxStreamService.localStream || !self.hasAudioOrVideoMediaConstraints)) {

                    $log.debug('Starting webRtc services!!');

                    lxPeerService.createPeerConnection(remoteVideoObject,
                        videoSignalingObject, clientId, remoteClientId);

                    if (self.hasAudioOrVideoMediaConstraints) {
                        $log.log('Adding local stream.');
                        lxPeerService.addLocalVideoStream(lxStreamService.localStream, remoteClientId);
                    } else {
                        $log.log('Not sending any stream.');
                    }

                    lxWebRtcSessionService.webRtcSessionStarted[remoteClientId] = true;

                    if (scope.videoExchangeObjectsDict[remoteClientId].rtcInitiator) {
                        $log.log('Executing doCall()');
                        lxSessionDescriptionService.doCall(clientId, remoteClientId);
                    }
                    else {
                        $log.log('Executing calleeStart()');
                        calleeStart(localVideoObject, remoteVideoObject, clientId, remoteClientId);
                    }

                } else {
                    // By construction, this branch should not be executed since all of the pre-requisites for setting
                    // up a call should have been previously met.
                    $log.debug('Not ready to start webRtc services.');
                    if (lxWebRtcSessionService.webRtcSessionStarted[remoteClientId]) {
                        $log.debug('Because lxWebRtcSessionService.webRtcSessionStarted[remoteClientId] is true for remoteClientId: ' + remoteClientId);
                    }
                    if (!lxWebRtcSessionService.signalingReady[remoteClientId]) {
                        $log.debug('Because lxWebRtcSessionService.signalingReady[remoteClientId is false for remoteClientId: ' + remoteClientId);
                    }
                    if (!scope.channelObject.channelIsAlive) {
                        $log.debug('Because scope.channelObject.channelIsAlive is false');
                    }

                    if (!lxTurnSupportService.turnDone) {
                        $log.debug('Because lxTurnSupportService.turnDone is false');
                    }
                    if (!lxStreamService.localStream) {
                        $log.debug('Because lxStreamService.localStream is false');
                    }
                }

            },

            doHangup : function(remoteClientId, numOpenVideoExchanges) {
                $log.log('Hanging up client ID: ' + remoteClientId);
                // Also, once stopped, if the user starts a new video, then we will have to call
                // getUserMedia again.
                if (numOpenVideoExchanges === 0 && lxStreamService.localStream) {
                    lxStreamService.localStream.stop();
                    lxStreamService.localStream = null;
                }
                lxWebRtcSessionService.stop(remoteClientId);

            },

            setWebcamMute : function(localVideoObject, newIsMutedValue) {

                var i;

                localVideoObject.isWebcamMuted = newIsMutedValue;

                // localStream might not be available if the user has not yet clicked on "Allow" for accessing
                // their camera and microphone. If this is the case, then we don't try to modify the stream
                // right now. This function should be called again once the stream is added which will then
                // ensure that the videoTracks reflect the value that the user has selected.
                if (lxStreamService.localStream) {
                    var videoTracks = lxStreamService.localStream.getVideoTracks();

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
                }
            },

            toggleWebcamMute : function(localVideoObject) {
                self.setWebcamMute(localVideoObject, !localVideoObject.isWebcamMuted);
            },

            setMicrophoneMute : function(localVideoObject, newIsMutedValue) {
                var i;

                localVideoObject.isMicrophoneMuted = newIsMutedValue;

                // localStream might not be available if the user has not yet clicked on "Allow" for accessing
                // their camera and microphone.
                if (lxStreamService.localStream) {

                    // Call the getAudioTracks method via adapter.js.
                    var audioTracks = lxStreamService.localStream.getAudioTracks();

                    if (audioTracks.length === 0) {
                        $log.log('No local audio available.');
                        return;
                    }

                    // if microphone is not muted
                    if (!localVideoObject.isMicrophoneMuted) {
                        for (i = 0; i < audioTracks.length; i++) {
                            audioTracks[i].enabled = true;
                        }
                        $log.log('Audio unmuted.');
                    }

                    // else microphone is muted
                    else {
                        for (i = 0; i < audioTracks.length; i++) {
                            audioTracks[i].enabled = false;
                        }
                        $log.log('Audio muted.');
                    }
                }
            },

            toggleMicrophoneMute: function(localVideoObject) {
                self.setMicrophoneMute(localVideoObject, !localVideoObject.isMicrophoneMuted);
            },

            setAudioMute: function(remoteVideoObject, newIsMutedValue) {
                remoteVideoObject.isAudioMuted = newIsMutedValue;
                remoteVideoObject.remoteMiniVideoElem.muted = remoteVideoObject.isAudioMuted;
            },

            toggleAudioMute: function(remoteVideoObject) {
                self.setAudioMute(remoteVideoObject, !remoteVideoObject.isAudioMuted);
            }
        };
        return self;
    }
);

