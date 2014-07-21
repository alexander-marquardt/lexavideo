'use strict';

var videoApp = angular.module('videoApp', ['videoApp.mainConstants']);

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global alert */
/* global goog */
/* global createIceServers */
/* global getUserMedia */
/* global RTCPeerConnection */
/* global RTCSessionDescription */
/* global RTCIceCandidate */
/* global attachMediaStream */
/* global reattachMediaStream */

// TODO - remove all javascript timers. replace with angular.
// TODO - wrap all adapter.js calls with angular functions


/* exported initialize */

// define variables
var started = false;

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
                      'OfferToReceiveAudio': true,
                      'OfferToReceiveVideo': true }};

var isVideoMuted = false;
var isAudioMuted = false;
// Types of gathered ICE Candidates.
var gatheredIceCandidateTypes = { Local: {}, Remote: {} };
var cardElem;

videoApp.factory('globalVarsService', function (constantsService) {
    return {
        initiator : constantsService.initiator,
        pcConfig : constantsService.pcConfig,
        signalingReady : false,
        videoTracks: null,
        localVideoDiv : $('#localVideo')[0],
        miniVideoDiv : $('#miniVideo')[0],
        remoteVideoDiv : $('#remoteVideo')[0]
    };
});

videoApp
    .run(function($log, constantsService, channelService, turnService, peerService, callService, userNotificationService,
                  messageService, globalVarsService) {
        var i;
        if (constantsService.errorMessages.length > 0) {
            for (i = 0; i < constantsService.errorMessages.length; ++i) {
                window.alert(constantsService.errorMessages[i]);
            }
            return;
        }

        $log.log('Initializing; room=' + constantsService.roomKey + '.');
        cardElem = document.getElementById('card');

        // Reset localVideoDiv display to center.
        globalVarsService.localVideoDiv.addEventListener('loadedmetadata', function(){
            window.onresize();});

        userNotificationService.resetStatus();
        // NOTE: AppRTCClient.java searches & parses this line; update there when
        // changing here.
        channelService.openChannel();
        turnService.maybeRequestTurn();

        // Caller is always ready to create peerConnection.
        // ARM Note: Caller is the 2nd person to join the chatroom, not the creator
        globalVarsService.signalingReady = globalVarsService.initiator;

        if (constantsService.mediaConstraints.audio === false &&
            constantsService.mediaConstraints.video === false) {
            callService.hasLocalStream = false;
            callService.maybeStart();
        } else {
            callService.hasLocalStream = true;
            callService.doGetUserMedia();
        }


        // Send BYE on refreshing(or leaving) a demo page
        // to ensure the room is cleaned for next session.
        window.onbeforeunload = function() {
            messageService.sendMessage({type: 'bye'});
        };


    });


videoApp.service('channelMessageService', function() {
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

videoApp.service('channelServiceSupport', function() {
    this.channelReady = false;
    this.socket = null;
});

videoApp.factory('channelService', function($log, constantsService, callService, sessionService, userNotificationService,
                                            channelServiceSupport, globalVarsService, channelMessageService) {



    var onChannelOpened = function() {
      $log.log('Channel opened.');
      channelServiceSupport.channelReady = true;
      callService.maybeStart();
    };

    var onChannelMessage = function(message) {
        $log.log('S->C: ' + message.data);
        var msg = JSON.parse(message.data);
        // Since the turn response is async and also GAE might disorder the
        // Message delivery due to possible datastore query at server side,
        // So callee needs to cache messages before peerConnection is created.
        if (!globalVarsService.initiator && !started) {
            if (msg.type === 'offer') {
                // Add offer to the beginning of msgQueue, since we can't handle
                // Early candidates before offer at present.
                channelMessageService.unshift(msg);
                // Callee creates PeerConnection
                // ARM Note: Callee is the person who created the chatroom and is waiting for someone to join
                // On the other hand, caller is the person who calls the callee, and is currently the second
                // person to join the chatroom.
                globalVarsService.signalingReady = true;
                callService.maybeStart();
            } else {
                channelMessageService.push(msg);
            }
        } else {
            sessionService.processSignalingMessage(msg);
        }
    };

    var onChannelError = function() {
        userNotificationService.messageError('Channel error.');
        channelServiceSupport.channelReady = false;
    };

    var onChannelClosed = function() {
      $log.log('Channel closed.');
      channelServiceSupport.channelReady = false;
    };

    var handler = {
      'onopen': onChannelOpened,
      'onmessage': onChannelMessage,
      'onerror': onChannelError,
      'onclose': onChannelClosed
    };

    return {
        openChannel: function() {
            $log.log('Opening channel.');
            var channel = new goog.appengine.Channel(constantsService.channelToken);
            channelServiceSupport.socket = channel.open(handler);
        }
    };
});

videoApp.service('turnServiceSupport', function () {
    // This function tracks some variables that are needed by multiple services, where one of the services has
    // a dependency on the other one.
    // In order to prevent circular dependencies, this variable needs to be in its own service, even though
    // it could logically fit into the turnService service.

    // Note that this is called as a service vs. a factory, which means that it will be invoked with the "new" keyword.
    // Therefore, we have direct access to the "this" for the turnServiceSupport object.
    this.turnDone = false;

});


videoApp.factory('turnService', function($log, $http, peerService, callService, turnServiceSupport, userNotificationService,
                                         constantsService, globalVarsService) {


    var onTurnResult = function(response) {

        var turnServer = response.data;
        // Create turnUris using the polyfill (adapter.js).
        var iceServers = createIceServers(turnServer.uris,
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


    var afterTurnRequest = function() {
        // Even if TURN request failed, continue the call with default STUN.
        turnServiceSupport.turnDone = true;
        callService.maybeStart();
    };

    return {

        maybeRequestTurn : function() {
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
            $http.get(constantsService.turnUrl).then(onTurnResult, onTurnError).then(afterTurnRequest);
        }
    };
});


videoApp.factory('messageService', function($http, $log, constantsService) {

    return {
        sendMessage : function(message) {
            var msgString = JSON.stringify(message);
            $log.log('C->S: ' + msgString);
            // NOTE: AppRTCClient.java searches & parses this line; update there when
            // changing here.
            var path = '/message?r=' + constantsService.roomKey + '&u=' + constantsService.myUsername;

            $http.post(path, msgString).then(
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

videoApp.service('iceService', function($log, messageService, userNotificationService, infoDivService) {

    var self = this;

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
        infoDivService.updateIceInfoDiv();
    };
});


videoApp.factory('sessionService', function($log, messageService, userNotificationService,
    codecsService, infoDivService, globalVarsService, constantsService, iceService, peerService,
    channelMessageService) {


    var onSetSessionDescriptionError = function(error) {
        userNotificationService.messageError('Failed to set session description: ' + error.toString());
    };

    var onSetSessionDescriptionSuccess = function() {
        $log.log('Set session description success.');
    };


    var waitForRemoteVideo = function() {
      // Call the getVideoTracks method via adapter.js.
        globalVarsService.videoTracks = peerService.remoteStream.getVideoTracks();
      if (globalVarsService.videoTracks.length === 0 || globalVarsService.remoteVideoDiv.currentTime > 0) {
        transitionToActive();
      } else {
        setTimeout(waitForRemoteVideo, 100);
      }
    };

    var transitionToActive = function() {
      reattachMediaStream(globalVarsService.miniVideoDiv, globalVarsService.localVideoDiv);
        globalVarsService.remoteVideoDiv.style.opacity = 1;
      cardElem.style.webkitTransform = 'rotateY(180deg)';
      setTimeout(function() { globalVarsService.localVideoDiv.src = ''; }, 500);
      setTimeout(function() { globalVarsService.miniVideoDiv.style.opacity = 1; }, 1000);
      // Reset window display according to the asperio of remote video.
      window.onresize();
      userNotificationService.setStatus('<input type=\'button\' id=\'hangup\' value=\'Hang up\' ng-click=\'doHangup()\' />');
    };


    var setRemote = function(message) {
        var onSetRemoteDescriptionSuccess = function(){
            $log.log('Set remote session description success.');
            // By now all addstream events for the setRemoteDescription have fired.
            // So we can know if the peer is sending any stream or is only receiving.
            if (peerService.remoteStream) {
                waitForRemoteVideo();
            } else {
                $log.log('Not receiving any stream.');
                transitionToActive();
            }
        };

        // Set Opus in Stereo, if stereo enabled.
        if (constantsService.stereo) {
            message.sdp = codecsService.addStereo(message.sdp);
        }
        message.sdp = codecsService.maybePreferAudioSendCodec(message.sdp);
        peerService.pc.setRemoteDescription(new RTCSessionDescription(message),
            onSetRemoteDescriptionSuccess, onSetSessionDescriptionError);
    };


    var transitionToWaiting = function() {
        cardElem.style.webkitTransform = 'rotateY(0deg)';
        setTimeout(function() {
            globalVarsService.localVideoDiv.src = globalVarsService.miniVideoDiv.src;
            globalVarsService.miniVideoDiv.src = '';
            globalVarsService.remoteVideoDiv.src = '';
        }, 500);
        globalVarsService.miniVideoDiv.style.opacity = 0;
        globalVarsService.remoteVideoDiv.style.opacity = 0;

        userNotificationService.resetStatus();
    };


    var onRemoteHangup = function(self) {
        $log.log('Session terminated.');
        globalVarsService.initiator = 0;   // jshint ignore:line
        transitionToWaiting();
        self.stop();
    };


    var doAnswer = function(self) {
        $log.log('Sending answer to peer.');
        peerService.pc.createAnswer(self.setLocalAndSendMessage,
            self.onCreateSessionDescriptionError, sdpConstraints);
    };


    return {

        onCreateSessionDescriptionError : function(error) {
            userNotificationService.messageError('Failed to create session description: ' + error.toString());
        },

        stop : function() {
            started = false;
            globalVarsService.signalingReady = false;
            isAudioMuted = false;
            isVideoMuted = false;
            peerService.pc.close();
            peerService.pc = null;
            peerService.remoteStream = null;
            channelMessageService.clearQueue();
        },


        setLocalAndSendMessage : function(sessionDescription) {
            sessionDescription.sdp = codecsService.maybePreferAudioReceiveCodec(sessionDescription.sdp);
            peerService.pc.setLocalDescription(sessionDescription,
                onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
            messageService.sendMessage(sessionDescription);
        },



        processSignalingMessage : function(message) {
            if (!started) {
                userNotificationService.messageError('peerConnection has not been created yet!');
                return;
            }

            if (message.type === 'offer') {
                setRemote(message);
                doAnswer(this);

            } else if (message.type === 'answer') {
                setRemote(message);
            } else if (message.type === 'candidate') {
                var candidate = new RTCIceCandidate({sdpMLineIndex: message.label,
                    candidate: message.candidate});
                iceService.noteIceCandidate('Remote', iceService.iceCandidateType(message.candidate));
                peerService.pc.addIceCandidate(candidate,
                    iceService.onAddIceCandidateSuccess, iceService.onAddIceCandidateError);
            } else if (message.type === 'bye') {
                onRemoteHangup(this);
            }
        }
    };
});

videoApp.factory('peerService', function($log, userNotificationService, infoDivService,
                                         iceService, globalVarsService, constantsService) {



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

    var onRemoteStreamAdded = function(self) {
        return function(mediaStreamEvent) {
            $log.log('Remote stream added.');
            attachMediaStream(globalVarsService.remoteVideoDiv, mediaStreamEvent.stream);
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
        createPeerConnection : function() {
            try {
                // Create an RTCPeerConnection via the polyfill (adapter.js).
                this.pc = new RTCPeerConnection(globalVarsService.pcConfig, constantsService.pcConstraints);
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
            this.pc.onaddstream = onRemoteStreamAdded(this);
            this.pc.onremovestream = onRemoteStreamRemoved;
            this.pc.onsignalingstatechange = onSignalingStateChanged(this);
            this.pc.oniceconnectionstatechange = onIceConnectionStateChanged(this);
        }
    };
});

videoApp.factory('callService', function($log, turnServiceSupport, peerService, sessionService, channelServiceSupport,
                                         userNotificationService, constantsService, globalVarsService, channelMessageService) {


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
        var constraints = mergeConstraints(constantsService.offerConstraints, sdpConstraints);
        $log.log('Sending offer to peer, with constraints: \n' +
            '  \'' + JSON.stringify(constraints) + '\'.');
        peerService.pc.createOffer(sessionService.setLocalAndSendMessage,
            sessionService.onCreateSessionDescriptionError, constraints);
    };

    var calleeStart = function() {
        // Callee starts to process cached offer and other messages.
        while (channelMessageService.getQueueLength() > 0) {
            sessionService.processSignalingMessage(channelMessageService.shift());
        }
    };

    var transitionToDone = function() {
        globalVarsService.localVideoDiv.style.opacity = 0;
        globalVarsService.remoteVideoDiv.style.opacity = 0;
        globalVarsService.miniVideoDiv.style.opacity = 0;

      userNotificationService.setStatus('You have left the call. <a href=' + constantsService.roomLink + '>Click here</a> to rejoin.');
    };

    var onUserMediaSuccess = function(self) {
        return function(stream) {
            $log.log('User has granted access to local media.');
            // Call the polyfill wrapper to attach the media stream to this element.
            attachMediaStream(globalVarsService.localVideoDiv, stream);
            globalVarsService.localVideoDiv.style.opacity = 1;
            localStream = stream;
            // Caller creates PeerConnection.
            self.maybeStart();
        };
    };

    var onUserMediaError = function(self) {
        return function(error) {
            userNotificationService.messageError('Failed to get access to local media. Error code was ' +
                error.code + '. Continuing without sending a stream.');
            alert('Failed to get access to local media. Error code was ' +
                error.code + '. Continuing without sending a stream.');

            self.hasLocalStream = false;
            self.maybeStart();
        };
    };

    return {
        hasLocalStream : false,

        maybeStart : function() {


            if (!started && globalVarsService.signalingReady && channelServiceSupport.channelReady &&
                turnServiceSupport.turnDone && (localStream || !this.hasLocalStream)) {

                userNotificationService.setStatus('Connecting...');
                $log.log('Creating PeerConnection.');
                peerService.createPeerConnection();

                if (this.hasLocalStream) {
                    $log.log('Adding local stream.');
                    peerService.pc.addStream(localStream);
                } else {
                    $log.log('Not sending any stream.');
                }
                started = true;

                if (globalVarsService.initiator) {
                    doCall();
                }
                else {
                    calleeStart();
                }
            }
        },

        doHangup : function() {
             $log.log('Hanging up.');
             transitionToDone();
             localStream.stop();
             sessionService.stop();
             // will trigger BYE from server
            channelServiceSupport.socket.close();
        },

        doGetUserMedia  : function() {
            // Call into getUserMedia via the polyfill (adapter.js).
            try {
                getUserMedia(constantsService.mediaConstraints, onUserMediaSuccess(this),
                    onUserMediaError(this));
                $log.log('Requested access to local media with mediaConstraints:\n' +
                    '  \'' + JSON.stringify(constantsService.mediaConstraints) + '\'');
            } catch (e) {
                alert('getUserMedia() failed. Is this a WebRTC capable browser?');
                userNotificationService.messageError('getUserMedia failed with exception: ' + e.message);
            }
        },


        toggleVideoMute : function() {
            // Call the getVideoTracks method via adapter.js.
            var i;
            globalVarsService.videoTracks = localStream.getVideoTracks();

            if (globalVarsService.videoTracks.length === 0) {
                $log.log('No local video available.');
                return;
            }

            if (isVideoMuted) {
                for (i = 0; i < globalVarsService.videoTracks.length; i++) {
                    globalVarsService.videoTracks[i].enabled = true;
                }
                $log.log('Video unmuted.');
            } else {
                for (i = 0; i < globalVarsService.videoTracks.length; i++) {
                    globalVarsService.videoTracks[i].enabled = false;
                }
                $log.log('Video muted.');
            }

            isVideoMuted = !isVideoMuted;
        },

        toggleAudioMute : function() {
            var i;
            // Call the getAudioTracks method via adapter.js.
            var audioTracks = localStream.getAudioTracks();

            if (audioTracks.length === 0) {
                $log.log('No local audio available.');
                return;
            }

            if (isAudioMuted) {
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

            isAudioMuted = !isAudioMuted;
        }
    };
});


videoApp.factory('userNotificationService', function($log, $timeout, infoDivService, constantsService, globalVarsService) {
    var currentState = 'Unknown state'; // this should never be displayed
    return {
        setStatus: function(state) {

            // use $timeout to ensure that $apply is called after the current digest cycle.
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
              this.setStatus('Waiting for someone to join:  <a href=' + constantsService.roomLink + '>' + constantsService.roomLink + '</a>');
          } else {
              this.setStatus('Initializing...');
          }
        }
    };
});

videoApp.factory('codecsService', function($log, constantsService){

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




    return {

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


videoApp.service('infoDivService', function ($log) {


    var infoDivErrors = [];
    var div;

    var getInfoDiv = function() {
        return $('#infoDiv')[0];
    };

    var hideInfoDiv = function() {
        div.style.display = 'none';
        $log.log('Hiding infoDiv');
    };

    var showInfoDiv = function() {
         div.style.display = 'block';
        $log.log('Showing infoDiv');
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

        updateIceInfoDiv : function() {
            var contents = 'Gathered ICE Candidates\n';
            for (var endpoint in gatheredIceCandidateTypes) {
                contents += endpoint + ':\n';
                for (var type in gatheredIceCandidateTypes[endpoint]) {
                    contents += '  ' + type + '\n';
                }
            }
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


videoApp.directive('callStatus', function(userNotificationService, $compile, $sce, callService) {
    return {
        restrict: 'AE',
        link: function(scope, elem) {

            // we include doHangup on the scope because some of the getStatus calls can include
            // html that expects a doHangup function to be available.
            scope.doHangup = callService.doHangup;

            scope.$watch(userNotificationService.getStatus, function (statusHtml) {

                var el = angular.element('<span/>');
                el.append(statusHtml);
                var compileFn = $compile(el);
                compileFn(scope);
                elem.html('');
                elem.append(el);
            });
        }
    };
});

videoApp.directive('monitorControlKeys', function ($document, $log, infoDivService, callService) {


    return {
        restrict : 'AE',
        link: function() {
            // Mac: hotkey is Command.
            // Non-Mac: hotkey is Control.
            // <hotkey>-D: toggle audio mute.
            // <hotkey>-E: toggle video mute.
            // <hotkey>-I: toggle Info box.
            // Return false to screen out original Chrome shortcuts.
            $document.on('keydown', function(event) {
                $log.log('Key pressed ' + event.keyCode);
                var hotkey = event.ctrlKey;
                if (navigator.appVersion.indexOf('Mac') !== -1) {
                    hotkey = event.metaKey;
                }
                if (!hotkey) {
                    return;
                }
                switch (event.keyCode) {
                    case 68:
                        callService.toggleAudioMute();
                        return false;
                    case 69:
                        callService.toggleVideoMute();
                        return false;
                    case 73:
                        infoDivService.toggleInfoDiv();
                        return false;
                    default:
                        return;
                }
            });
        }
    };
});


videoApp.directive('videoContainer', function($window, globalVarsService) {
    return {
        restrict : 'AE',
        link: function(scope, elem) {
/*
            scope.enterFullScreen = function () {
                // TODO -- this will probably fail on other browsers -- investigate if extra code is needed.
                elem[0].webkitRequestFullScreen();
            };*/

            // Set the video diplaying in the center of window.
            $window.onresize = function(){
                var videoAspectRatio;
                if (globalVarsService.remoteVideoDiv.style.opacity === '1') {
                    videoAspectRatio = globalVarsService.remoteVideoDiv.videoWidth/globalVarsService.remoteVideoDiv.videoHeight;
                } else if (globalVarsService.localVideoDiv.style.opacity === '1') {
                    videoAspectRatio = globalVarsService.localVideoDiv.videoWidth/globalVarsService.localVideoDiv.videoHeight;
                } else {
                    return;
                }

                var innerHeight =$window.innerHeight - $('#id-vidochat-logo').height() - $('#footer').height();
                var innerWidth = $window.innerWidth;

                var innerAspectRatio = innerWidth/innerHeight;
                var videoHeight, videoWidth;

                if (innerAspectRatio <= videoAspectRatio) {
                    // the video needs to be have height reduced to keep aspect ratio and stay inside window
                    videoWidth = innerWidth;
                    videoHeight = innerWidth / videoAspectRatio;
                }
                else {
                    // the video needs to have the width reduce to keep aspect ratio and stay inside window
                    videoHeight = innerHeight;
                    videoWidth = innerHeight * videoAspectRatio;
                }

                elem.width(videoWidth + 'px');
                elem.height(videoHeight + 'px');
//                elem.prop.left = (innerWidth - videoWidth) / 2 + 'px';
//                elem.prop.top = 0 + 'px';
            };
        }
    };
});



