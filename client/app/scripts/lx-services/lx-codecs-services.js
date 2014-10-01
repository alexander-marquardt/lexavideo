'use strict';

angular.module('lxCodecs.services', [])

    .factory('lxCodecsService',
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

