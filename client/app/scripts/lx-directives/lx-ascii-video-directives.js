/**
 * Created by alexandermarquardt on 2014-07-28.
 */

'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global LZString */

var asciiVideoDirectives = angular.module('lxAsciiVideo.directives', []);




asciiVideoDirectives.directive('lxGenerateAsciiVideoDirective',
    function(
        $interval,
        $log,
        lxStreamService,
        lxMessageService,
        lxDelayActionService,
        lxUseChatRoomConstantsService,
        lxUseChatRoomVarsService,
        lxAppWideConstantsService) {

    var canvasOptions = {
        width : 160,
        height : 120,
        fps: 2  // this value is over-written for debugging in the link function below.
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


    var onFrame = function(canvas, $asciiDrawingTextElement, remoteUserId) {

        asciiFromCanvas(canvas, {
            contrast: 128,
            callback: function(asciiString) {
                $asciiDrawingTextElement.html(asciiString);
                var compressedString = LZString.compressToUTF16(asciiString);

                // check if the remote user is connected before sending the ascii image to the server
                if (remoteUserId) {
                     // send the compressed string to the remote user (through the server)
                    lxMessageService.sendMessage('videoStream', {streamType: 'ASCII Video', compressedVideoString: compressedString});
                }
            }
        });
    };

    return {
        restrict: 'A',
        link: function(scope, elem) {

            var frameInterval;
            var getStreamTimeout;

            var videoElement = scope.localVideoObject.localHdVideoElem;
            var $localAsciiDrawingTextElement = angular.element(elem).find('.cl-ascii-container').find('.cl-ascii-drawing-text');

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
                        onFrame(localCanvas, $localAsciiDrawingTextElement, scope.videoSignalingObject.remoteUserId);
                    }
                } catch (e) {
                    $log.error('Error drawing image in canvas' + e);
                }
            };

            function cancelLocalAsciiVideoTimers() {
                clearInterval(frameInterval);
                clearTimeout(getStreamTimeout);
            }

            function getAsciiVideoFromLocalStream() {

                // cancel existing intervals and timers - they will be re-started by the code below.
                cancelLocalAsciiVideoTimers();


                // Wait for the localStream to be setup before attempting to create ascii video from it.
                if (lxStreamService.localStream) {

                    // Since we can have multiple declarations of this directive (lxGenerateAsciiVideoDirective) on a single
                    // page (for example, one for the mini video window, and one for the normal video size), for efficiency,
                    // we need to make sure that we only generate and display ascii text from the currently displayed ascii
                    // video window. The following check makes sure that this is the case.
                    if (elem.is(':visible')) {
                        getImageFromVideo(); // get the image without waiting for the first interval's delay
                        frameInterval = setInterval(function () {
                            getImageFromVideo();
                        }, Math.round(1000 / canvasOptions.fps));
                    }
                }
                else {
                    getStreamTimeout = setTimeout(getAsciiVideoFromLocalStream, 200);
                }
            }

            function watchForResize() {

                var delayAction = lxDelayActionService.getDelayFn();
                var timeToPassSinceLastCall = 500; //ms

                $(window).on('resize.watchForAsciiResize', function() {
                    // Wait until the user has finished resizing the window before we call
                    // sendAsciiVideoFromAppropriateWindow. Also, note that this is passed as a callback, and
                    // therefore the function is passed without '()'
                    delayAction(getAsciiVideoFromLocalStream, timeToPassSinceLastCall);
                });
            }

            function removeWatchForResize() {
                $(window).off('resize.watchForAsciiResize');
            }

            scope.$watch('videoSignalingObject.localIsSendingVideoType', function(newValue) {
                if (newValue === 'ASCII Video') {
                    getAsciiVideoFromLocalStream();
                    watchForResize();
                } else {
                    // stop asciiVideo
                    cancelLocalAsciiVideoTimers();
                    removeWatchForResize();
                }
            });


        }
    };
});


asciiVideoDirectives.directive('lxDrawRemoteAsciiVideoDirective', function(lxChannelService) {


    return {
            restrict: 'A',
            link: function(scope, elem) {

                // Note the use of "first()" on the following find. This is necessary because we have mini-elements embedded
                // that also contain cl-ascii-container and cl-ascii-drawing-text.
                var $remoteAsciiDrawingTextElement = angular.element(elem).find('.cl-ascii-container').find('.cl-ascii-drawing-text').first();

                scope.$watch(lxChannelService.getAsciiVideoFrameUpdated(lxChannelService), function() {

                    lxChannelService.asciiVideoObject.videoFrameUpdated = false;
                    //
                    var asciiString = LZString.decompressFromUTF16(lxChannelService.asciiVideoObject.compressedVideoFrame);
                    $remoteAsciiDrawingTextElement.html(asciiString);
                });

                // monitor to see if remote user stops sending, and if they do then remove the currently displayed
                // image.
                scope.$watch('videoSignalingObject.remoteIsSendingVideoType', function(remoteIsSendingVideoType) {
                    if (remoteIsSendingVideoType === null) {
                        // remote is not transmitting, so hide the ascii video element
                        $remoteAsciiDrawingTextElement.addClass('cl-transparent');
                    } else {
                        $remoteAsciiDrawingTextElement.removeClass('cl-transparent');
                    }
                });

                scope.remoteVideoObject.remoteAsciiVideoElem = angular.element(elem).find('.cl-ascii-container')[0];
            }
    };

});