'use strict';

var videoApp = angular.module('videoApp', ['videoApp.mainConstants']);

// define externally defined variables so that jshint doesn't give warnings
/* global alert */
/* global roomKey */
/* global mediaConstraints */
/* global initiator */
/* global goog */
/* global turnUrl */
/* global pcConfig */
/* global createIceServers */
/* global getUserMedia */
/* global roomLink */
/* global RTCPeerConnection */
/* global pcConstraints */
/* global channelToken */
/* global offerConstraints */
/* global RTCSessionDescription */
/* global stereo */
/* global me */
/* global RTCIceCandidate */
/* global attachMediaStream */
/* global reattachMediaStream */
/* global audioSendCodec */
/* global audioReceiveCodec */


/* exported initiator */
/* exported initialize */

// define variables
var localVideo;
var miniVideo;
var remoteVideo;
var videoTracks;
var hasLocalStream;
var localStream;
var remoteStream;
var pc;
var socket;
var xmlhttp;
var started = false;
var channelReady = false;
var signalingReady = false;
var msgQueue = [];

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
                      'OfferToReceiveAudio': true,
                      'OfferToReceiveVideo': true }};

var isVideoMuted = false;
var isAudioMuted = false;
// Types of gathered ICE Candidates.
var gatheredIceCandidateTypes = { Local: {}, Remote: {} };
var cardElem;

videoApp
    .run(function($log, errorMessagesConstant, channelService, turnService, peerService, callService, userNotificationService, mediaService, messageService) {
        var i;
        if (errorMessagesConstant.length > 0) {
            for (i = 0; i < errorMessagesConstant.length; ++i) {
                window.alert(errorMessagesConstant[i]);
            }
            return;
        }

        $log.log('Initializing; room=' + roomKey + '.');
        cardElem = document.getElementById('card');
        localVideo = document.getElementById('localVideo');
        // Reset localVideo display to center.
        localVideo.addEventListener('loadedmetadata', function(){
            window.onresize();});
        miniVideo = document.getElementById('miniVideo');
        remoteVideo = document.getElementById('remoteVideo');
        userNotificationService.resetStatus();
        // NOTE: AppRTCClient.java searches & parses this line; update there when
        // changing here.
        channelService.openChannel();
        turnService.maybeRequestTurn();

        // Caller is always ready to create peerConnection.
        // ARM Note: Caller is the 2nd person to join the chatroom, not the creator
        signalingReady = initiator;

        if (mediaConstraints.audio === false &&
            mediaConstraints.video === false) {
            hasLocalStream = false;
            callService.maybeStart();
        } else {
            hasLocalStream = true;
            mediaService.doGetUserMedia();
        }


        // Send BYE on refreshing(or leaving) a demo page
        // to ensure the room is cleaned for next session.
        window.onbeforeunload = function() {
            messageService.sendMessage({type: 'bye'});
        };


    });



videoApp.factory('channelService', function($log, callService, signallingService, userNotificationService) {

    var onChannelOpened = function() {
      console.log('Channel opened.');
      channelReady = true;
      callService.maybeStart();
    };

    var onChannelMessage = function(message) {
      console.log('S->C: ' + message.data);
      var msg = JSON.parse(message.data);
      // Since the turn response is async and also GAE might disorder the
      // Message delivery due to possible datastore query at server side,
      // So callee needs to cache messages before peerConnection is created.
      if (!initiator && !started) {
        if (msg.type === 'offer') {
          // Add offer to the beginning of msgQueue, since we can't handle
          // Early candidates before offer at present.
          msgQueue.unshift(msg);
          // Callee creates PeerConnection
          // ARM Note: Callee is the person who created the chatroom and is waiting for someone to join
          signalingReady = true;
          callService.maybeStart();
        } else {
          msgQueue.push(msg);
        }
      } else {
        signallingService.processSignalingMessage(msg);
      }
    };

    var onChannelError = function() {
        userNotificationService.messageError('Channel error.');
    };

    var onChannelClosed = function() {
      console.log('Channel closed.');
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
            var channel = new goog.appengine.Channel(channelToken);
            socket = channel.open(handler);
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


videoApp.factory('turnService', function($log, peerService, callService, turnServiceSupport, userNotificationService) {

    return {

        maybeRequestTurn : function() {
            // Allow to skip turn by passing ts=false to apprtc.
            if (turnUrl === '') {
                turnServiceSupport.turnDone = true;
                return;
            }

            for (var i = 0, len = pcConfig.iceServers.length; i < len; i++) {
                if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
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
            xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = this.onTurnResult;
            xmlhttp.open('GET', turnUrl, true);
            xmlhttp.send();
        },
        onTurnResult : function() {
          if (xmlhttp.readyState !== 4) {
            return;
          }

          if (xmlhttp.status === 200) {
            var turnServer = JSON.parse(xmlhttp.responseText);
            // Create turnUris using the polyfill (adapter.js).
            var iceServers = createIceServers(turnServer.uris,
                                              turnServer.username,
                                              turnServer.password);
            if (iceServers !== null) {
              pcConfig.iceServers = pcConfig.iceServers.concat(iceServers);
            }
            $log.log('Got pcConfig.iceServers:' + pcConfig.iceServers + '\n');
          } else {
              userNotificationService.messageError('No TURN server; unlikely that media will traverse networks.  ' +
                         'If this persists please report it to ' +
                         'info@lexabit.com');
          }
          // If TURN request failed, continue the call with default STUN.
          turnServiceSupport.turnDone = true;
          callService.maybeStart();
        }
    };
});


videoApp.factory('messageService', function() {

    return {
        sendMessage : function(message) {
            var msgString = JSON.stringify(message);
            console.log('C->S: ' + msgString);
            // NOTE: AppRTCClient.java searches & parses this line; update there when
            // changing here.
            var path = '/message?r=' + roomKey + '&u=' + me;
            var xhr = new XMLHttpRequest();
            xhr.open('POST', path, true);
            xhr.send(msgString);
        }
    };
});


videoApp.factory('signallingService', function($log, messageService, userNotificationService,
                                               codecsService, infoDivService) {


    var onSetSessionDescriptionError = function(error) {
        userNotificationService.messageError('Failed to set session description: ' + error.toString());
    };

    var onSetSessionDescriptionSuccess = function() {
        $log.log('Set session description success.');
    };

    var onCreateSessionDescriptionError = function(error) {
        userNotificationService.messageError('Failed to create session description: ' + error.toString());
    };

    var waitForRemoteVideo = function() {
      // Call the getVideoTracks method via adapter.js.
      videoTracks = remoteStream.getVideoTracks();
      if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
        transitionToActive();
      } else {
        setTimeout(waitForRemoteVideo, 100);
      }
    };

    var transitionToActive = function() {
      reattachMediaStream(miniVideo, localVideo);
      remoteVideo.style.opacity = 1;
      cardElem.style.webkitTransform = 'rotateY(180deg)';
      setTimeout(function() { localVideo.src = ''; }, 500);
      setTimeout(function() { miniVideo.style.opacity = 1; }, 1000);
      // Reset window display according to the asperio of remote video.
      window.onresize();
      userNotificationService.setStatus('<input type=\'button\' id=\'hangup\' value=\'Hang up\' ng-click=\'doHangup()\' />');
    };


    var setRemote = function(message) {
        var onSetRemoteDescriptionSuccess = function(){
            $log.log('Set remote session description success.');
            // By now all addstream events for the setRemoteDescription have fired.
            // So we can know if the peer is sending any stream or is only receiving.
            if (remoteStream) {
                waitForRemoteVideo();
            } else {
                console.log('Not receiving any stream.');
                transitionToActive();
            }
        };

        // Set Opus in Stereo, if stereo enabled.
        if (stereo) {
            message.sdp = codecsService.addStereo(message.sdp);
        }
        message.sdp = codecsService.maybePreferAudioSendCodec(message.sdp);
        pc.setRemoteDescription(new RTCSessionDescription(message),
            onSetRemoteDescriptionSuccess, onSetSessionDescriptionError);
    };

    var onAddIceCandidateSuccess = function() {
        $log.log('AddIceCandidate success.');
    };

    var onAddIceCandidateError = function(error) {
        userNotificationService.messageError('Failed to add Ice Candidate: ' + error.toString());
    };

    var iceCandidateType = function(candidateSDP) {
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

    var transitionToWaiting = function() {
        cardElem.style.webkitTransform = 'rotateY(0deg)';
        setTimeout(function() {
            localVideo.src = miniVideo.src;
            miniVideo.src = '';
            remoteVideo.src = '';
        }, 500);
        miniVideo.style.opacity = 0;
        remoteVideo.style.opacity = 0;

        userNotificationService.resetStatus();
    };


    var onRemoteHangup = function() {
        $log.log('Session terminated.');
        initiator = 0;   // jshint ignore:line
        transitionToWaiting();
        this.stop();
    };

    var noteIceCandidate = function(location, type) {
        if (gatheredIceCandidateTypes[location][type]) {
            return;
        }
        gatheredIceCandidateTypes[location][type] = 1;
        infoDivService.updateInfoDiv();
    };

    var doAnswer = function() {
        $log.log('Sending answer to peer.');
        pc.createAnswer(this.setLocalAndSendMessage,
            onCreateSessionDescriptionError, sdpConstraints);
    };


    return {

        stop : function() {
            started = false;
            signalingReady = false;
            isAudioMuted = false;
            isVideoMuted = false;
            pc.close();
            pc = null;
            remoteStream = null;
            msgQueue.length = 0;
        },


        setLocalAndSendMessage : function(sessionDescription) {
            sessionDescription.sdp = codecsService.maybePreferAudioReceiveCodec(sessionDescription.sdp);
            pc.setLocalDescription(sessionDescription,
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
                doAnswer();

            } else if (message.type === 'answer') {
                setRemote(message);
            } else if (message.type === 'candidate') {
                var candidate = new RTCIceCandidate({sdpMLineIndex: message.label,
                    candidate: message.candidate});
                noteIceCandidate('Remote', iceCandidateType(message.candidate));
                pc.addIceCandidate(candidate,
                    onAddIceCandidateSuccess, onAddIceCandidateError);
            } else if (message.type === 'bye') {
                onRemoteHangup();
            }
        },

        onIceCandidate : function(event) {
            if (event.candidate) {
                messageService.sendMessage({type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate});
                noteIceCandidate('Local', iceCandidateType(event.candidate.candidate));
            } else {
                $log.log('End of candidates.');
            }
        }
    };
});

videoApp.factory('peerService', function($log, userNotificationService, signallingService, infoDivService) {



    var onRemoteStreamAdded = function(event) {
        $log.log('Remote stream added.');
        attachMediaStream(remoteVideo, event.stream);
        remoteStream = event.stream;
    };

    var onRemoteStreamRemoved = function() {
        $log.log('Remote stream removed.');
    };

    var onSignalingStateChanged = function() {
        infoDivService.updateInfoDiv();
    };

    var onIceConnectionStateChanged = function() {
        infoDivService.updateInfoDiv();
    };

    return {



        createPeerConnection : function() {
          try {
            // Create an RTCPeerConnection via the polyfill (adapter.js).
            pc = new RTCPeerConnection(pcConfig, pcConstraints);
            pc.onicecandidate = signallingService.onIceCandidate;
            console.log('Created RTCPeerConnnection with:\n' +
                        '  config: \'' + JSON.stringify(pcConfig) + '\';\n' +
                        '  constraints: \'' + JSON.stringify(pcConstraints) + '\'.');
          } catch (e) {
              userNotificationService.messageError('Failed to create PeerConnection, exception: ' + e.message);
            alert('Cannot create RTCPeerConnection object; ' +
                  'WebRTC is not supported by this browser.');
            return;
          }
          pc.onaddstream = onRemoteStreamAdded;
          pc.onremovestream = onRemoteStreamRemoved;
          pc.onsignalingstatechange = onSignalingStateChanged;
          pc.oniceconnectionstatechange = onIceConnectionStateChanged;
        }
    };
});

videoApp.factory('callService', function($log, turnServiceSupport, peerService, signallingService, userNotificationService) {





    var mergeConstraints = function(cons1, cons2) {
        var merged = cons1;
        for (var name in cons2.mandatory) {
            merged.mandatory[name] = cons2.mandatory[name];
        }
        merged.optional.concat(cons2.optional);
        return merged;
    };

    var doCall = function() {
        var constraints = mergeConstraints(offerConstraints, sdpConstraints);
        $log.log('Sending offer to peer, with constraints: \n' +
            '  \'' + JSON.stringify(constraints) + '\'.');
        pc.createOffer(signallingService.setLocalAndSendMessage,
            signallingService.onCreateSessionDescriptionError, constraints);
    };

    var calleeStart = function() {
        // Callee starts to process cached offer and other messages.
        while (msgQueue.length > 0) {
            signallingService.processSignalingMessage(msgQueue.shift());
        }
    };

    var transitionToDone = function() {
      localVideo.style.opacity = 0;
      remoteVideo.style.opacity = 0;
      miniVideo.style.opacity = 0;

      userNotificationService.setStatus('You have left the call. <a href=' + roomLink + '>Click here</a> to rejoin.');
    };

    return {
        maybeStart : function() {

            var turnDone = turnServiceSupport.turnDone;

            if (!started && signalingReady && channelReady && turnDone &&
                (localStream || !hasLocalStream)) {
                userNotificationService.setStatus('Connecting...');
                $log.log('Creating PeerConnection.');
                peerService.createPeerConnection();

                if (hasLocalStream) {
                    $log.log('Adding local stream.');
                    pc.addStream(localStream);
                } else {
                    $log.log('Not sending any stream.');
                }
                started = true;

                if (initiator) {
                    doCall();
                }
                else {
                    calleeStart();
                }
            }
        },


        doHangup : function() {
             console.log('Hanging up.');
             transitionToDone();
             localStream.stop();
             signallingService.stop();
             // will trigger BYE from server
             socket.close();
        }
    };
});





videoApp.factory('mediaService', function(callService, userNotificationService) {

    var onUserMediaSuccess = function(stream) {
        console.log('User has granted access to local media.');
        // Call the polyfill wrapper to attach the media stream to this element.
        attachMediaStream(localVideo, stream);
        localVideo.style.opacity = 1;
        localStream = stream;
        // Caller creates PeerConnection.
        callService.maybeStart();
    };

    var onUserMediaError = function(error) {
        userNotificationService.messageError('Failed to get access to local media. Error code was ' +
            error.code + '. Continuing without sending a stream.');
        alert('Failed to get access to local media. Error code was ' +
            error.code + '. Continuing without sending a stream.');

        hasLocalStream = false;
        callService.maybeStart();
    };



    return  {
        doGetUserMedia  : function() {
            // Call into getUserMedia via the polyfill (adapter.js).
            try {
                getUserMedia(mediaConstraints, onUserMediaSuccess,
                    onUserMediaError);
                console.log('Requested access to local media with mediaConstraints:\n' +
                    '  \'' + JSON.stringify(mediaConstraints) + '\'');
            } catch (e) {
                alert('getUserMedia() failed. Is this a WebRTC capable browser?');
                userNotificationService.messageError('getUserMedia failed with exception: ' + e.message);
            }
        }
    };
});


videoApp.factory('userNotificationService', function($timeout, infoDivService) {
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
            console.log(msg);
            infoDivService.pushInfoDivErrors(msg);
            infoDivService.updateInfoDiv();
        },
        resetStatus : function() {
          if (!initiator) {
              this.setStatus('Waiting for someone to join:  <a href=' + roomLink + '>' + roomLink + '</a>');
          } else {
              this.setStatus('Initializing...');
          }
        }
    };
});

videoApp.factory('codecsService', function(){

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
            console.log('Invalid codec setting: ' + codec);
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
            if (audioSendCodec === '') {
                console.log('No preference on audio send codec.');
                return sdp;
            }
            console.log('Prefer audio send codec: ' + audioSendCodec);
            return preferAudioCodec(sdp, audioSendCodec);
        },

        maybePreferAudioReceiveCodec : function(sdp) {
            if (audioReceiveCodec === '') {
                console.log('No preference on audio receive codec.');
                return sdp;
            }
            console.log('Prefer audio receive codec: ' + audioReceiveCodec);
            return preferAudioCodec(sdp, audioReceiveCodec);
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


videoApp.service('infoDivService', function () {


    var infoDivErrors = [];

    var getInfoDiv = function() {
        return document.getElementById('infoDiv');
    };

    var showInfoDiv = function() {
         var div = getInfoDiv();
         div.style.display = 'block';
     };

    return {

        pushInfoDivErrors : function(msg) {
            infoDivErrors.push(msg);
        },

        toggleInfoDiv : function() {
            var div = getInfoDiv();
            if (div.style.display === 'block') {
                div.style.display = 'none';
            } else {
                showInfoDiv();
            }
        },

        updateInfoDiv : function() {
            var contents = '<pre>Gathered ICE Candidates\n';
            for (var endpoint in gatheredIceCandidateTypes) {
                contents += endpoint + ':\n';
                for (var type in gatheredIceCandidateTypes[endpoint]) {
                    contents += '  ' + type + '\n';
                }
            }
            if (pc) {
                contents += 'Gathering: ' + pc.iceGatheringState + '\n';
                contents += '</pre>\n';
                contents += '<pre>PC State:\n';
                contents += 'Signaling: ' + pc.signalingState + '\n';
                contents += 'ICE: ' + pc.iceConnectionState + '\n';
            }
            var div = getInfoDiv();
            div.innerHTML = contents + '</pre>';

            for (var msg in infoDivErrors) {
                div.innerHTML += '<p style="background-color: red; color: yellow;">' +
                    infoDivErrors[msg] + '</p>';
            }
            if (infoDivErrors.length) {
                showInfoDiv();
            }
        }
    };
});


videoApp.directive('currentState', function(userNotificationService, $compile, $sce, callService) {
    return {
        restrict: 'AE',
        scope: false, // set to false so that directive scope is used for transcluded expressions
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

videoApp.directive('monitorControlKeys', function ($document, $log, infoDivService) {

    var toggleVideoMute = function() {
        // Call the getVideoTracks method via adapter.js.
        var i;
        videoTracks = localStream.getVideoTracks();

        if (videoTracks.length === 0) {
            console.log('No local video available.');
            return;
        }

        if (isVideoMuted) {
            for (i = 0; i < videoTracks.length; i++) {
                videoTracks[i].enabled = true;
            }
            console.log('Video unmuted.');
        } else {
            for (i = 0; i < videoTracks.length; i++) {
                videoTracks[i].enabled = false;
            }
            console.log('Video muted.');
        }

        isVideoMuted = !isVideoMuted;
    };

    var toggleAudioMute = function() {
        var i;
        // Call the getAudioTracks method via adapter.js.
        var audioTracks = localStream.getAudioTracks();

        if (audioTracks.length === 0) {
            console.log('No local audio available.');
            return;
        }

        if (isAudioMuted) {
            for (i = 0; i < audioTracks.length; i++) {
                audioTracks[i].enabled = true;
            }
            console.log('Audio unmuted.');
        } else {
            for (i = 0; i < audioTracks.length; i++){
                audioTracks[i].enabled = false;
            }
            console.log('Audio muted.');
        }

        isAudioMuted = !isAudioMuted;
    };

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
                        toggleAudioMute();
                        return false;
                    case 69:
                        toggleVideoMute();
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


videoApp.directive('videoContainer', function($window) {
    return {
        restrict : 'AE',
        link: function(scope, elem) {

            scope.enterFullScreen = function () {
                container.webkitRequestFullScreen();
            };

            // Set the video diplaying in the center of window.
            $window.onresize = function(){
                var videoAspectRatio;
                if (remoteVideo.style.opacity === '1') {
                    videoAspectRatio = remoteVideo.videoWidth/remoteVideo.videoHeight;
                } else if (localVideo.style.opacity === '1') {
                    videoAspectRatio = localVideo.videoWidth/localVideo.videoHeight;
                } else {
                    return;
                }

                var innerHeight = $window.innerHeight;
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

                elem.prop.width = videoWidth + 'px';
                elem.prop.height = videoHeight + 'px';
                elem.prop.left = (innerWidth - videoWidth) / 2 + 'px';
                elem.prop.top = 0 + 'px';
            };
        }
    };
});



