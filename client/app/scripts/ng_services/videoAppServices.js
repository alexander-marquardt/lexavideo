'use strict';

var videoAppServices = angular.module('videoApp.services', ['videoApp.mainConstants']);


// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global alert */
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



videoAppServices.factory('globalVarsService', function (constantsService) {
            /* This services provides access to variables that are used by multiple services, and that don't
               fit easily into any of the currently defined services. These variables may be accessed and
               modified directly from anywhere in the code.
             */
    return {

        initiator : constantsService.initiator,
        pcConfig : constantsService.pcConfig,

        // Set up audio and video regardless of what devices are present.
        sdpConstraints : {'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true }}
    };
});


videoAppServices.service('adapterService', function () {
    /* simple wrapper for global functions contained in adapter.js. This will make it
       easier to do unit testing in the future.
     */
    this.createIceServers = createIceServers;
    this.RTCPeerConnection = RTCPeerConnection;
    this.RTCSessionDescription = RTCSessionDescription;
    this.getUserMedia = getUserMedia;
    this.attachMediaStream = attachMediaStream;
    this.reattachMediaStream = reattachMediaStream;
    this.RTCIceCandidate = RTCIceCandidate;
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

videoAppServices.factory('channelService', function($log, constantsService, callService, sessionService, userNotificationService,
                                            channelServiceSupport, globalVarsService, channelMessageService) {

    /*
    Provides functionality for opening up and handling callbacks from the Google App-engine "Channel API".
     */

    var onChannelOpened = function(localVideoObject, remoteVideoObject) {
        return function () {
            $log.log('Channel opened.');
            channelServiceSupport.channelReady = true;
            callService.maybeStart(localVideoObject, remoteVideoObject);
        };
    };

    var onChannelMessage = function(localVideoObject, remoteVideoObject) {
        return function(message) {
            // $log.log('S->C: ' + message.data);
            var msg = JSON.parse(message.data);
            // Since the turn response is async and also GAE might disorder the
            // Message delivery due to possible datastore query at server side,
            // So callee needs to cache messages before peerConnection is created.
            if (!globalVarsService.initiator && !sessionService.started) {
                if (msg.type === 'offer') {
                    // Add offer to the beginning of msgQueue, since we can't handle
                    // Early candidates before offer at present.
                    channelMessageService.unshift(msg);
                    // Callee creates PeerConnection
                    // ARM Note: Callee is the person who created the chatroom and is waiting for someone to join
                    // On the other hand, caller is the person who calls the callee, and is currently the second
                    // person to join the chatroom.
                    sessionService.signalingReady = true;
                    callService.maybeStart(localVideoObject, remoteVideoObject);
                } else {
                    channelMessageService.push(msg);
                }
            } else {
                sessionService.processSignalingMessage(sessionService, msg, localVideoObject, remoteVideoObject);
            }
        };
    };

    var onChannelError = function() {
        userNotificationService.messageError('Channel error.');
        channelServiceSupport.channelReady = false;
    };

    var onChannelClosed = function() {
      $log.log('Channel closed.');
      channelServiceSupport.channelReady = false;
    };

    var handler = function(localVideoObject, remoteVideoObject) {
        return {
            'onopen': onChannelOpened(localVideoObject, remoteVideoObject),
            'onmessage': onChannelMessage(localVideoObject, remoteVideoObject),
            'onerror': onChannelError,
            'onclose': onChannelClosed
        };
    };

    return {
        openChannel: function(localVideoObject, remoteVideoObject) {
            $log.log('Opening channel.');
            var channel = new goog.appengine.Channel(constantsService.channelToken);
            channelServiceSupport.socket = channel.open(handler(localVideoObject, remoteVideoObject));
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
                                         constantsService, globalVarsService, adapterService) {


    var onTurnResult = function(response) {

        var turnServer = response.data;
        // Create turnUris using the polyfill (adapter.js).
        var iceServers = adapterService.createIceServers(turnServer.uris,
            turnServer.username,
            turnServer.password);
        if (iceServers !== null) {
            globalVarsService.pcConfig.iceServers = globalVarsService.pcConfig.iceServers.concat(iceServers);
        }
        $log.log('Got pcConfig.iceServers:' + globalVarsService.pcConfig.iceServers + '\n');
    };

    var onTurnError = function() {

        userNotificationService.messageError('No TURN server; unlikely that media will traverse networks.  ' +
            'If this persists please report it to ' +
            'info@lexabit.com');
    };


    var afterTurnRequest = function(localVideoObject, remoteVideoObject) {
        return function () {
            // Even if TURN request failed, continue the call with default STUN.
            turnServiceSupport.turnDone = true;
            callService.maybeStart(localVideoObject, remoteVideoObject);
        };
    };

    return {

        maybeRequestTurn : function(localVideoObject, remoteVideoObject) {
            // Allow to skip turn by passing ts=false to apprtc.
            if (constantsService.turnUrl === '') {
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
            $http.get(constantsService.turnUrl).then(onTurnResult, onTurnError).then(afterTurnRequest(localVideoObject, remoteVideoObject));
        }
    };
});


videoAppServices.factory('messageService', function($http, $log, constantsService) {

    /*
    Functionality for posting messages to the server.
     */
    return {
        sendMessage : function(message) {
            // $log.log('C->S: ' + msgString);
            // NOTE: AppRTCClient.java searches & parses this line; update there when
            // changing here.
            var path = '/message?r=' + constantsService.roomKey + '&u=' + constantsService.myUsername;

            $http.post(path, message).then(
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

videoAppServices.service('iceService', function($log, messageService, userNotificationService, infoDivService) {
    /*
    ICE = Interactive Connectivity Establishment.
    This service provides ICE methods that are used when setting up a peer connection.
     */

    var gatheredIceCandidateTypes = { Local: {}, Remote: {} };

    // self is necessary because some functions are called as methods of other objects which lose the
    // referencd to "this".
    var self = this;


    var updateInfoDiv = function() {
        var contents = 'Gathered ICE Candidates\n';
        for (var endpoint in gatheredIceCandidateTypes) {
            contents += endpoint + ':\n';
            for (var type in gatheredIceCandidateTypes[endpoint]) {
                contents += '  ' + type + '\n';
            }
        }
        infoDivService.updateIceInfoDiv(contents);
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
        updateInfoDiv();
    };
    this.onIceCandidate = function(event) {
        if (event.candidate) {
            messageService.sendMessage({type: 'candidate',
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


videoAppServices.factory('sessionService', function($log, $window, $rootScope, $timeout,
                                            messageService, userNotificationService,
                                            codecsService, infoDivService, globalVarsService,
                                            constantsService, iceService, peerService,
                                            channelMessageService, adapterService) {

    var sessionStatus = 'initializing'; // "initializing", "waiting", "active", or "done"


    var onSetSessionDescriptionError = function(error) {
        userNotificationService.messageError('Failed to set session description: ' + error.toString());
    };

    var onSetSessionDescriptionSuccess = function() {
        $log.log('Set session description success.');
    };


    var waitForRemoteVideo = function(localVideoObject, remoteVideoObject) {

        var innerWaitForRemoteVideo = function() {
            // Call the getVideoTracks method via adapter.js.
            var videoTracks = peerService.remoteStream.getVideoTracks();
            if (videoTracks.length === 0 || remoteVideoObject.remoteVideoElem.currentTime > 0) {
                transitionSessionStatus('active');
            } else {
                $timeout(innerWaitForRemoteVideo, 100);
            }
        };
        innerWaitForRemoteVideo();
    };

    var transitionSessionStatus = function(status) {
        $timeout(function() {
            sessionStatus = status;
        });
    };

    var setRemote = function(message, localVideoObject, remoteVideoObject) {
        var onSetRemoteDescriptionSuccess = function(){
            $log.log('Set remote session description success.');
            // By now all addstream events for the setRemoteDescription have fired.
            // So we can know if the peer is sending any stream or is only receiving.
            if (peerService.remoteStream) {
                waitForRemoteVideo(localVideoObject, remoteVideoObject);
            } else {
                $log.log('Not receiving any stream.');
                transitionSessionStatus('active');
            }
        };

        // Set Opus in Stereo, if stereo enabled.
        if (constantsService.stereo) {
            message.sdp = codecsService.addStereo(message.sdp);
        }
        message.sdp = codecsService.maybePreferAudioSendCodec(message.sdp);
        message.sdp = codecsService.maybeSetAudioSendBitRate(message.sdp);
        message.sdp = codecsService.maybeSetVideoSendBitRate(message.sdp);
        message.sdp = codecsService.maybeSetVideoSendInitialBitRate(message.sdp);

        peerService.pc.setRemoteDescription(new adapterService.RTCSessionDescription(message),
            onSetRemoteDescriptionSuccess, onSetSessionDescriptionError);
    };

    var onRemoteHangup = function(self, localVideoObject) {
        $log.log('Session terminated.');
        globalVarsService.initiator = 0;
        transitionSessionStatus('waiting');
        self.stop(self, localVideoObject);
    };


    var doAnswer = function(self) {
        $log.log('Sending answer to peer.');
        peerService.pc.createAnswer(self.setLocalAndSendMessage,
            self.onCreateSessionDescriptionError, globalVarsService.sdpConstraints);
    };


    return {

        started : false,
        signalingReady : false,

        getSessionStatus : function() {
            return sessionStatus;
        },

        transitionSessionStatus : function(status) {
            // accessor function to execute the "private" transitionSessionStatus
            transitionSessionStatus(status);
        },

        onCreateSessionDescriptionError : function(error) {
            userNotificationService.messageError('Failed to create session description: ' + error.toString());
        },

        stop : function(self, localVideoObject) {
            self.started = false;
            self.signalingReady = false;
            localVideoObject.isAudioMuted = false;
            localVideoObject.isVideoMuted = false;
            peerService.pc.close();
            peerService.pc = null;
            peerService.remoteStream = null;
            channelMessageService.clearQueue();
        },


        setLocalAndSendMessage : function(sessionDescription) {
            sessionDescription.sdp = codecsService.maybePreferAudioReceiveCodec(sessionDescription.sdp);
            sessionDescription.sdp = codecsService.maybeSetAudioReceiveBitRate(sessionDescription.sdp);
            sessionDescription.sdp = codecsService.maybeSetVideoReceiveBitRate(sessionDescription.sdp);

            peerService.pc.setLocalDescription(sessionDescription,
                onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
            messageService.sendMessage(sessionDescription);
        },



        processSignalingMessage : function(self, message, localVideoObject, remoteVideoObject) {
            if (!self.started) {
                userNotificationService.messageError('peerConnection has not been created yet!');
                return;
            }

            if (message.type === 'offer') {
                setRemote(message, localVideoObject, remoteVideoObject);
                doAnswer(this);

            } else if (message.type === 'answer') {
                setRemote(message, localVideoObject, remoteVideoObject);
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
});

videoAppServices.factory('peerService', function($log, userNotificationService, infoDivService,
                                         iceService, globalVarsService, constantsService,
                                         adapterService) {



    /* "private" methods */
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

    var onRemoteStreamAdded = function(self, localVideoObject, remoteVideoObject) {
        return function(mediaStreamEvent) {
            $log.log('Remote stream added.');
            adapterService.attachMediaStream(remoteVideoObject.remoteVideoElem, mediaStreamEvent.stream);
            self.remoteStream = mediaStreamEvent.stream;
        };
    };


    var onRemoteStreamRemoved = function() {
        $log.log('Remote stream removed.');
    };

    var onSignalingStateChanged = function(self){
        return function() {
            infoDivService.updatePcInfoDiv(pcStatus(self));
        };
    };

    var onIceConnectionStateChanged = function(self) {
        return function() {
            infoDivService.updatePcInfoDiv(pcStatus(self));
        };
    };


    /* Externally visible variables and methods */
    return {
        pc : null,
        remoteStream : null,
        createPeerConnection : function(localVideoObject, remoteVideoObject) {
            try {
                // Create an RTCPeerConnection via the polyfill (adapter.js).
                this.pc = new adapterService.RTCPeerConnection(globalVarsService.pcConfig, constantsService.pcConstraints);
                this.pc.onicecandidate = iceService.onIceCandidate;
                $log.log('Created RTCPeerConnnection with:\n' +
                    '  config: \'' + JSON.stringify(globalVarsService.pcConfig) + '\';\n' +
                    '  constraints: \'' + JSON.stringify(constantsService.pcConstraints) + '\'.');
            } catch (e) {
                userNotificationService.messageError('Failed to create PeerConnection, exception: ' + e.message);
                alert('Cannot create RTCPeerConnection object; ' +
                    'WebRTC is not supported by this browser.');
                return;
            }
            this.pc.onaddstream = onRemoteStreamAdded(this, localVideoObject, remoteVideoObject);
            this.pc.onremovestream = onRemoteStreamRemoved;
            this.pc.onsignalingstatechange = onSignalingStateChanged(this);
            this.pc.oniceconnectionstatechange = onIceConnectionStateChanged(this);
        }
    };
});

videoAppServices.factory('callService', function($log, turnServiceSupport, peerService, sessionService, channelServiceSupport,
                                         userNotificationService, constantsService, globalVarsService, channelMessageService,
                                         adapterService) {


    var localStream;

    var mergeConstraints = function(cons1, cons2) {
        var merged = cons1;
        for (var name in cons2.mandatory) {
            merged.mandatory[name] = cons2.mandatory[name];
        }
        merged.optional.concat(cons2.optional);
        return merged;
    };

    var doCall = function() {
        var constraints = mergeConstraints(constantsService.offerConstraints, globalVarsService.sdpConstraints);
        $log.log('Sending offer to peer, with constraints: \n' +
            '  \'' + JSON.stringify(constraints) + '\'.');
        peerService.pc.createOffer(sessionService.setLocalAndSendMessage,
            sessionService.onCreateSessionDescriptionError, constraints);
    };

    var calleeStart = function(localVideoObject, remoteVideoObject) {
        // Callee starts to process cached offer and other messages.
        while (channelMessageService.getQueueLength() > 0) {
            sessionService.processSignalingMessage(sessionService, channelMessageService.shift(), localVideoObject, remoteVideoObject);
        }
    };


    var onUserMediaSuccess = function(self, localVideoDiv, localVideoObject, remoteVideoObject) {
        return function(stream) {
            $log.log('User has granted access to local media.');
            // Call the polyfill wrapper to attach the media stream to this element.
            adapterService.attachMediaStream(localVideoDiv, stream);
            localVideoDiv.style.opacity = 1;
            localStream = stream;
            // Caller creates PeerConnection.
            self.maybeStart(localVideoObject, remoteVideoObject);
        };
    };

    var onUserMediaError = function(self, localVideoObject, remoteVideoObject) {
        return function(error) {
            userNotificationService.messageError('Failed to get access to local media. Error code was ' +
                error.code + '. Continuing without sending a stream.');
            alert('Failed to get access to local media. Error code was ' +
                error.code + '. Continuing without sending a stream.');

            self.hasAudioOrVideoMediaConstraints = false;
            self.maybeStart(localVideoObject, remoteVideoObject);
        };
    };

    return {
        hasAudioOrVideoMediaConstraints : false,

        getLocalStream : function() {
            return localStream;
        },

        maybeStart : function(localVideoObject, remoteVideoObject) {


            if (!sessionService.started && sessionService.signalingReady && channelServiceSupport.channelReady &&
                turnServiceSupport.turnDone && (localStream || !this.hasAudioOrVideoMediaConstraints)) {

                userNotificationService.setStatus('Connecting...');
                $log.log('Creating PeerConnection.');
                peerService.createPeerConnection(localVideoObject, remoteVideoObject);

                if (this.hasAudioOrVideoMediaConstraints) {
                    $log.log('Adding local stream.');
                    peerService.pc.addStream(localStream);
                } else {
                    $log.log('Not sending any stream.');
                }
                sessionService.started = true;

                if (globalVarsService.initiator) {
                    doCall();
                }
                else {
                    calleeStart(localVideoObject, remoteVideoObject);
                }
            }
        },

        doHangup : function(localVideoObject) {
            return function() {
                $log.log('Hanging up.');
                sessionService.transitionSessionStatus('done');
                localStream.stop();
                sessionService.stop(sessionService, localVideoObject);
                // will trigger BYE from server
                channelServiceSupport.socket.close();
            };
        },

        doGetUserMedia  : function(localVideoDiv, localVideoObject, remoteVideoObject) {
            // Call into getUserMedia via the polyfill (adapter.js).
            try {
                adapterService.getUserMedia(constantsService.mediaConstraints,
                    onUserMediaSuccess(this, localVideoDiv, localVideoObject, remoteVideoObject),
                    onUserMediaError(this, localVideoObject, remoteVideoObject));
                $log.log('Requested access to local media with mediaConstraints:\n' +
                    '  \'' + JSON.stringify(constantsService.mediaConstraints) + '\'');
            } catch (e) {
                alert('getUserMedia() failed. Is this a WebRTC capable browser?');
                userNotificationService.messageError('getUserMedia failed with exception: ' + e.message);
            }
        },


        toggleVideoMute : function(localVideoObject) {
            // Call the getVideoTracks method via adapter.js.
            var i;
            var videoTracks = localStream.getVideoTracks();

            if (videoTracks.length === 0) {
                $log.log('No local video available.');
                return;
            }

            if (localVideoObject.isVideoMuted) {
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

            localVideoObject.isVideoMuted = !localVideoObject.isVideoMuted;
        },

        toggleAudioMute : function(localVideoObject) {
            var i;
            // Call the getAudioTracks method via adapter.js.
            var audioTracks = localStream.getAudioTracks();

            if (audioTracks.length === 0) {
                $log.log('No local audio available.');
                return;
            }

            if (localVideoObject.isAudioMuted) {
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

            localVideoObject.isAudioMuted = !localVideoObject.isAudioMuted;
        }
    };
});


videoAppServices.factory('userNotificationService', function($log, $timeout, infoDivService, constantsService, globalVarsService) {
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
            $log.log(msg);
            infoDivService.pushInfoDivErrors(msg);
            infoDivService.updateErrorsInfoDiv();
        },
        resetStatus : function() {
          if (!globalVarsService.initiator) {
              this.setStatus('Waiting for someone to join:  <a lass="navbar-link" href=' + constantsService.roomLink + '>' + constantsService.roomLink + '</a>');
          } else {
              this.setStatus('Initializing...');
          }
        }
    };
});

videoAppServices.factory('codecsService', function($log, constantsService, userNotificationService){

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

        // Adds an a=fmtp: x-google-min-bitrate=kbps line, if constantsService.videoSendInitialBitrate
        // is specified. We'll also add a x-google-min-bitrate value, since the max
        // must be >= the min.
        maybeSetVideoSendInitialBitRate : function(sdp) {
            if (!constantsService.videoSendInitialBitrate) {
                return sdp;
            }

            // Validate the initial bitrate value.
            var maxBitrate = constantsService.videoSendInitialBitrate;
            if (constantsService.videoSendBitrate) {
                if (constantsService.videoSendInitialBitrate > constantsService.videoSendBitrate) {
                    userNotificationService.messageError('Clamping initial bitrate to max bitrate of ' +
                        constantsService.videoSendBitrate + ' kbps.');
                    constantsService.videoSendInitialBitrate = constantsService.videoSendBitrate;
                }
                maxBitrate = constantsService.videoSendBitrate;
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
                constantsService.videoSendInitialBitrate.toString() + '; x-google-max-bitrate=' +
                maxBitrate.toString();
            sdpLines.splice(vp8RtpmapIndex + 1, 0, vp8Fmtp);
            return sdpLines.join('\r\n');
        },

        maybeSetAudioSendBitRate : function(sdp) {
            if (!constantsService.audioSendBitrate) {
                return sdp;
            }
            $log.log('Prefer audio send bitrate: ' + constantsService.audioSendBitrate);
            return preferBitRate(sdp, constantsService.audioSendBitrate, 'audio');
        },

        maybeSetAudioReceiveBitRate : function (sdp) {
            if (!constantsService.audioRecvBitrate) {
                return sdp;
            }
            $log.log('Prefer audio receive bitrate: ' + constantsService.audioRecvBitrate);
            return preferBitRate(sdp, constantsService.audioRecvBitrate, 'audio');
        },


        maybeSetVideoSendBitRate : function (sdp) {
            if (!constantsService.videoSendBitrate) {
                return sdp;
            }
            $log.log('Prefer video send bitrate: ' + constantsService.videoSendBitrate);
            return preferBitRate(sdp, constantsService.videoSendBitrate, 'video');
        },

        maybeSetVideoReceiveBitRate : function(sdp) {
            if (!constantsService.videoRecvBitrate) {
                return sdp;
            }
            $log.log('Prefer video receive bitrate: ' + constantsService.videoRecvBitrate);
            return preferBitRate(sdp, constantsService.videoRecvBitrate, 'video');
        },

        
        maybePreferAudioSendCodec : function(sdp) {
            if (constantsService.audioSendCodec === '') {
                $log.log('No preference on audio send codec.');
                return sdp;
            }
            $log.log('Prefer audio send codec: ' + constantsService.audioSendCodec);
            return preferAudioCodec(sdp, constantsService.audioSendCodec);
        },

        maybePreferAudioReceiveCodec : function(sdp) {
            if (constantsService.audioReceiveCodec === '') {
                $log.log('No preference on audio receive codec.');
                return sdp;
            }
            $log.log('Prefer audio receive codec: ' + constantsService.audioReceiveCodec);
            return preferAudioCodec(sdp, constantsService.audioReceiveCodec);
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


videoAppServices.service('infoDivService', function ($log) {


    var infoDivErrors = [];
    var div;

    var getInfoDiv = function() {
        return $('#info-div')[0];
    };

    var hideInfoDiv = function() {
        div.style.display = 'none';
        $log.log('Hiding info-div');
    };

    var showInfoDiv = function() {
         div.style.display = 'block';
        $log.log('Showing info-div');
     };

    div = getInfoDiv();

    return {

        pushInfoDivErrors : function(msg) {
            infoDivErrors.push(msg);
        },

        toggleInfoDiv : function() {
            if (div.style.display === 'block') {
                hideInfoDiv();
            } else {
                showInfoDiv();
            }
        },

        updateIceInfoDiv : function(contents) {
            $('#iceInfoDiv').html(contents);
        },

        updatePcInfoDiv : function (contents) {
            $('#pcInfoDiv').html(contents);
        },

        updateErrorsInfoDiv : function () {
            var contents = '';
            for (var msg in infoDivErrors) {
                contents += '<p style="background-color: red; color: yellow;">' +
                    infoDivErrors[msg] + '</p>';
            }
            $('#errorsInfoDiv').html(contents);

            if (infoDivErrors.length) {
                showInfoDiv();
            }
        }
    };
});



