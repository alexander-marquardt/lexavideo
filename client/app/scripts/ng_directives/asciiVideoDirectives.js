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

    return {
        restrict: 'A',
        scope: {},
        link: function() {

            function waitForLocalStream() {
                var videoStream = callService.getLocalStream();

                if (videoStream) {

                    videoElement.setAttribute('width', 400);
                    videoElement.setAttribute('height', 400);


                    if (videoElement.mozSrcObject !== undefined) { // hack for Firefox < 19
                        videoElement.mozSrcObject = videoStream;
                    } else {
                        videoElement.src = (window.URL && window.URL.createObjectURL(videoStream)) || videoStream;
                    }


                    videoElement.play();
                    $interval(function() {
                        try {
                            localCanvasContext.drawImage(videoElement, 0, 0 , 400, 400);
                        } catch (e) {
                            $log.log('Error drawing image in canvas' + e);
                        }
                    }, Math.round(1000 / 30));
                } else {
                    $timeout(waitForLocalStream, 200);
                }
            }

            waitForLocalStream();
        }
    };
});
