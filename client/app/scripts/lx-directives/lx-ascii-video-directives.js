/**
 * Created by alexandermarquardt on 2014-07-28.
 */

'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global LZString */
/* global viewportSize */

var asciiVideoDirectives = angular.module('lxAsciiVideo.directives', []);




asciiVideoDirectives.directive('lxGenerateAsciiVideoDirective', function($interval, $log, lxStreamService,
                                                                         lxMessageService, lxUseChatRoomConstantsService,
                                                                         lxUseChatRoomVarsService, lxAppWideConstantsService) {

    var canvasOptions = {
        width : 160,
        height : 120,
        fps: 3  // this value is over-written for debugging in the link function below.
    };



    function asciiFromCanvas(canvas, options) {
        // Original code by Jacob Seidelin (http://www.nihilogic.dk/labs/jsascii/)
        // Heavily modified by Andrei Gheorghe (http://github.com/idevelop)

        var characters = (' .,:;i1tfLCG08@').split('');

        var context = canvas.getContext('2d');
        var canvasWidth = canvas.width;
        var canvasHeight = canvas.height;

        var asciiCharacters = '';

        // calculate contrast factor
        // http://www.dfstudios.co.uk/articles/image-processing-algorithms-part-5/
        var contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));

        var imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);
        for (var y = 0; y < canvasHeight; y += 2) { // every other row because letters are not square
            for (var x = 0; x < canvasWidth; x++) {
                // get each pixel's brightness and output corresponding character

                var offset = (y * canvasWidth + x) * 4;

                var color = getColorAtOffset(imageData.data, offset);

                // increase the contrast of the image so that the ASCII representation looks better
                // http://www.dfstudios.co.uk/articles/image-processing-algorithms-part-5/
                var contrastedColor = {
                    red: bound(Math.floor((color.red - 128) * contrastFactor) + 128, [0, 255]),
                    green: bound(Math.floor((color.green - 128) * contrastFactor) + 128, [0, 255]),
                    blue: bound(Math.floor((color.blue - 128) * contrastFactor) + 128, [0, 255]),
                    alpha: color.alpha
                };

                // calculate pixel brightness
                // http://stackoverflow.com/questions/596216/formula-to-determine-brightness-of-rgb-color
                var brightness = (0.299 * contrastedColor.red + 0.587 * contrastedColor.green + 0.114 * contrastedColor.blue) / 255;

                var character = characters[(characters.length - 1) - Math.round(brightness * (characters.length - 1))];

                asciiCharacters += character;
            }

            asciiCharacters += '\n';
        }

        options.callback(asciiCharacters);
    }

    function getColorAtOffset(data, offset) {
        return {
            red: data[offset],
            green: data[offset + 1],
            blue: data[offset + 2],
            alpha: data[offset + 3]
        };
    }

    function bound(value, interval) {
        return Math.max(interval[0], Math.min(interval[1], value));
    }


    var onFrame = function(canvas, $asciiDrawingTextElement) {

        asciiFromCanvas(canvas, {
            contrast: 128,
            callback: function(asciiString) {
                $asciiDrawingTextElement.html(asciiString);
                var compressedString = LZString.compressToUTF16(asciiString);
                // send the compressed string to the remote user (through the server)
                lxMessageService.sendMessage('videoStream', {streamType: 'ASCII Video', compressedVideoString: compressedString});
            }
        });
    };

    return {
        restrict: 'A',
        link: function(scope, elem) {

            var frameInterval;
            var getStreamTimeout;
            var thisDirectiveIsGeneratingAsciiVideoForTransmission = false; // mostly just used for debugging

            var videoElement = scope.localVideoObject.localVideoElem;
            var $asciiDrawingTextElement = angular.element(elem).find('.cl-ascii-container').find('.cl-ascii-drawing-text');

            var localCanvas = document.createElement('canvas');
            localCanvas.width = canvasOptions.width;
            localCanvas.height = canvasOptions.height;

            var localCanvasContext = localCanvas.getContext('2d');

            if (lxAppWideConstantsService.debugBuildEnabled) {
                // when using the development server, sending too much information over the channel API seems to saturate
                // the server -- slow down the fps for development
                canvasOptions.fps = 0.5;
            }


            var getImageFromVideo = function() {
                try {
                    if (scope.videoSignalingObject.localIsSendingVideoType === 'ASCII Video') {
                        localCanvasContext.drawImage(videoElement, 0, 0 , canvasOptions.width, canvasOptions.height);
                        onFrame(localCanvas, $asciiDrawingTextElement);
                    }
                } catch (e) {
                    $log.error('Error drawing image in canvas' + e);
                }
            };

            function getAsciiVideoFromLocalStream() {

                if (lxStreamService.localStream) {
                    getImageFromVideo(); // get the image without waiting for the first interval's delay
                    frameInterval = setInterval(function() {
                        getImageFromVideo();
                    }, Math.round(1000 / canvasOptions.fps));
                } else {
                    getStreamTimeout = setTimeout(getAsciiVideoFromLocalStream, 200);
                }
            }


            
            function cancelLocalAsciiVideoTimers() {
                clearInterval(frameInterval);
                clearTimeout(getStreamTimeout);
            }
            
            function sendAsciiVideoFromAppropriateWindow() {
                // we are transmitting ASCII video, however we only want to generate/display/transmit ASCII
                // video from a single source no matter how many places this directive might appear. 
                // Therefore, we check to see if this directive is defined on the div that is currently
                // being displayed, and only then will the asciiVideo be generated.

                // Make sure that we don't generate asciiVideo, unless it has specifically been requested.
                if (scope.videoSignalingObject.localIsSendingVideoType === 'ASCII Video') {

                    // cancel existing intervals and timers - they will be re-started by the code below.
                    cancelLocalAsciiVideoTimers();

                    thisDirectiveIsGeneratingAsciiVideoForTransmission = false; // this should only be true for a single directive at a time

                    if (viewportSize.getWidth() > lxUseChatRoomVarsService.screenXsMax) {
                        // This is not an xs display or we have not started a session. Therefore the ascii video should
                        // be generated only if this directive is declared on #id-local-ascii-video-wrapper-div as that
                        // is the div that is currently visible to the user.
                        if (angular.element(elem).attr('id') === 'id-local-ascii-video-wrapper-div') { //id is without "#"
                            getAsciiVideoFromLocalStream();
                            thisDirectiveIsGeneratingAsciiVideoForTransmission = true;
                            $log.log('Getting local ascii video from: ' + angular.element(elem).attr('id'));
                        }
                    } else {
                        // This is an xs display, and therefore we need to look at which remote video type is
                        // currently being displayed (ascii or hd), and then select the correct mini-video window
                        // (remember that the mini-video window is shown inside the currently displayed remote video window).
                        if (scope.videoSignalingObject.remoteIsSendingVideoType === 'HD Video') {
                            if (angular.element(elem).parents('#id-remote-hd-video-wrapper-div').length === 1) {
                                getAsciiVideoFromLocalStream();
                                thisDirectiveIsGeneratingAsciiVideoForTransmission = true;
                                $log.log('Getting local ascii video from mini-video inside hdVideo window');
                            }
                        }
                        if (scope.videoSignalingObject.remoteIsSendingVideoType === 'ASCII Video') {
                            if (angular.element(elem).parents('#id-remote-ascii-video-wrapper-div').length === 1) {
                                getAsciiVideoFromLocalStream();
                                thisDirectiveIsGeneratingAsciiVideoForTransmission = true;
                                $log.log('Getting local ascii video from mini-video inside asciiVideo window');
                            }
                        }
                    }
                }


            }

            scope.$watch('videoSignalingObject.localIsSendingVideoType', function(newValue) {
                if (newValue === 'ASCII Video') {
                    sendAsciiVideoFromAppropriateWindow();
                } else {
                    // stop asciiVideo
                    if (thisDirectiveIsGeneratingAsciiVideoForTransmission) {
                        cancelLocalAsciiVideoTimers();
                        $log.log('Cancelled local ascii video');
                    }
                }
            });

            $(window).resize(function() {
                sendAsciiVideoFromAppropriateWindow();
            });

            scope.$watch('videoSignalingObject.remoteIsSendingVideoType', function() {
                // if the remote remoteIsSendingVideoType has changed, then we need to activate the mini-window that is located
                // inside the currently active remote video window.
                sendAsciiVideoFromAppropriateWindow();
            });
        }
    };
});


asciiVideoDirectives.directive('lxDrawRemoteAsciiVideoDirective', function(lxChannelService) {


    return {
            restrict: 'A',
            link: function(scope, elem) {
                var $asciiDrawingTextElement = angular.element(elem).find('.cl-ascii-container').find('.cl-ascii-drawing-text');

                scope.$watch(lxChannelService.getAsciiVideoFrameUpdated(lxChannelService), function() {

                    lxChannelService.asciiVideoObject.videoFrameUpdated = false;
                    //
                    var asciiString = LZString.decompressFromUTF16(lxChannelService.asciiVideoObject.compressedVideoFrame);
                    $asciiDrawingTextElement.html(asciiString);
                });
            }
    };

});