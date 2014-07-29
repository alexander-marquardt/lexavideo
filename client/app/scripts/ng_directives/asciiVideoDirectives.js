/**
 * Created by alexandermarquardt on 2014-07-28.
 */

'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

var asciiVideoDirectives = angular.module('asciiVideo.directives', ['videoApp.services']);



asciiVideoDirectives.directive('asciiVideoContainerDirective', function($timeout, $interval, $log, callService) {

    var localCanvas = $('#local-ascii-canvas')[0];
    var localCanvasContext = localCanvas.getContext('2d');
    var videoElement = document.createElement('video');
    var asciiContainer = $('#ascii-container')[0];

    var canvasOptions = {
        width : 320,
        height : 240
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


    var onFrame = function(canvas) {

        asciiFromCanvas(canvas, {
            contrast: 128,
            callback: function(asciiString) {
                asciiContainer.innerHTML = asciiString;
            }
        });
    };

    return {
        restrict: 'A',
        scope: {},
        link: function() {

            function waitForLocalStream() {
                var videoStream = callService.getLocalStream();

                if (videoStream) {

                    videoElement.setAttribute('width', canvasOptions.width);
                    videoElement.setAttribute('height', canvasOptions.height);


                    if (videoElement.mozSrcObject !== undefined) { // hack for Firefox < 19
                        videoElement.mozSrcObject = videoStream;
                    } else {
                        videoElement.src = (window.URL && window.URL.createObjectURL(videoStream)) || videoStream;
                    }


                    videoElement.play();
                    $interval(function() {
                        try {
                            localCanvasContext.drawImage(videoElement, 0, 0 , canvasOptions.width, canvasOptions.height);
                            onFrame(localCanvas);
                        } catch (e) {
                            $log.log('Error drawing image in canvas' + e);
                        }
                    }, Math.round(1000 / 2));
                } else {
                    $timeout(waitForLocalStream, 200);
                }
            }

            waitForLocalStream();
        }
    };
});
