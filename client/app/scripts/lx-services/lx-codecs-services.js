/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/
'use strict';

angular.module('lxCodecs.services', [])

    .factory('lxCodecsService',
    function(
        $log,
        lxVideoParamsService)
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

            // Adds an a=fmtp: x-google-min-bitrate=kbps line, if lxVideoParamsService.videoSendInitialBitrate
            // is specified. We'll also add a x-google-min-bitrate value, since the max
            // must be >= the min.
            maybeSetVideoSendInitialBitRate : function(sdp) {
                if (!lxVideoParamsService.videoSendInitialBitrate) {
                    return sdp;
                }

                // Validate the initial bitrate value.
                var maxBitrate = lxVideoParamsService.videoSendInitialBitrate;
                if (lxVideoParamsService.videoSendBitrate) {
                    if (lxVideoParamsService.videoSendInitialBitrate > lxVideoParamsService.videoSendBitrate) {
                        $log.error('Clamping initial bitrate to max bitrate of ' +
                            lxVideoParamsService.videoSendBitrate + ' kbps.');
                        lxVideoParamsService.videoSendInitialBitrate = lxVideoParamsService.videoSendBitrate;
                    }
                    maxBitrate = lxVideoParamsService.videoSendBitrate;
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
                    lxVideoParamsService.videoSendInitialBitrate.toString() + '; x-google-max-bitrate=' +
                    maxBitrate.toString();
                sdpLines.splice(vp8RtpmapIndex + 1, 0, vp8Fmtp);
                return sdpLines.join('\r\n');
            },

            maybeSetAudioSendBitRate : function(sdp) {
                if (!lxVideoParamsService.audioSendBitrate) {
                    return sdp;
                }
                $log.log('Prefer audio send bitrate: ' + lxVideoParamsService.audioSendBitrate);
                return preferBitRate(sdp, lxVideoParamsService.audioSendBitrate, 'audio');
            },

            maybeSetAudioReceiveBitRate : function (sdp) {
                if (!lxVideoParamsService.audioRecvBitrate) {
                    return sdp;
                }
                $log.log('Prefer audio receive bitrate: ' + lxVideoParamsService.audioRecvBitrate);
                return preferBitRate(sdp, lxVideoParamsService.audioRecvBitrate, 'audio');
            },


            maybeSetVideoSendBitRate : function (sdp) {
                if (!lxVideoParamsService.videoSendBitrate) {
                    return sdp;
                }
                $log.log('Prefer video send bitrate: ' + lxVideoParamsService.videoSendBitrate);
                return preferBitRate(sdp, lxVideoParamsService.videoSendBitrate, 'video');
            },

            maybeSetVideoReceiveBitRate : function(sdp) {
                if (!lxVideoParamsService.videoRecvBitrate) {
                    return sdp;
                }
                $log.log('Prefer video receive bitrate: ' + lxVideoParamsService.videoRecvBitrate);
                return preferBitRate(sdp, lxVideoParamsService.videoRecvBitrate, 'video');
            },


            maybePreferAudioSendCodec : function(sdp) {
                if (lxVideoParamsService.audioSendCodec === '') {
                    $log.log('No preference on audio send codec.');
                    return sdp;
                }
                $log.log('Prefer audio send codec: ' + lxVideoParamsService.audioSendCodec);
                return preferAudioCodec(sdp, lxVideoParamsService.audioSendCodec);
            },

            maybePreferAudioReceiveCodec : function(sdp) {
                if (lxVideoParamsService.audioReceiveCodec === '') {
                    $log.log('No preference on audio receive codec.');
                    return sdp;
                }
                $log.log('Prefer audio receive codec: ' + lxVideoParamsService.audioReceiveCodec);
                return preferAudioCodec(sdp, lxVideoParamsService.audioReceiveCodec);
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

