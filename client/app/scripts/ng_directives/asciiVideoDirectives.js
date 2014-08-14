/**
 * Created by alexandermarquardt on 2014-07-28.
 */

'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global LZString */

var asciiVideoDirectives = angular.module('asciiVideo.directives', ['videoApp.services']);




asciiVideoDirectives.directive('generateAsciiVideoDirective', function($timeout, $interval, $log, streamService, messageService) {

    var canvasOptions = {
        width : 160,
        height : 120,
        fps: 3
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

                // use $timeout to ensure that $apply is called after the current digest cycle.
                $timeout(function() {
                    messageService.sendMessage('video', {type: 'ascii', compressedVideoString: compressedString});

                });
            }
        });
    };

    return {
        restrict: 'A',
        link: function(scope, elem) {

            var $asciiDrawingTextElement = angular.element(elem).find('.cl-local-ascii-container').find('.cl-ascii-drawing-text');

            var videoElement = $('#id-local-video-element')[0];
            var localCanvas = document.createElement('canvas');
            localCanvas.width = canvasOptions.width;
            localCanvas.height = canvasOptions.height;

            var localCanvasContext = localCanvas.getContext('2d');

            function waitForLocalStream() {

                if (streamService.localStream) {

                    $interval(function() {
                        try {
                            if (scope.activeDivs.showLocalAsciiVideo) {
                                localCanvasContext.drawImage(videoElement, 0, 0 , canvasOptions.width, canvasOptions.height);
                                onFrame(localCanvas, $asciiDrawingTextElement);
                            }
                        } catch (e) {
                            $log.log('Error drawing image in canvas' + e);
                        }
                    }, Math.round(1000 / canvasOptions.fps));
                } else {
                    $timeout(waitForLocalStream, 200);
                }
            }



            waitForLocalStream();

        }
    };
});
