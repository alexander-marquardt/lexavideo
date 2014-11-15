'use strict';

angular.module('lxUtility.services', [])
    .factory('lxDelayActionService', function() {

        return {
            getDelayFn : function() {
                // Returns a function that wraps a callback inside a timeout. This can be used
                // for ensuring that an action is only executed after a certain amount of time has passed
                // since the last call to the callback function.
                var timer = null;
                return function(callback, delayMs){
                    clearTimeout (timer);
                    timer = setTimeout(callback, delayMs);
                };
            }
        };
    })

    .factory('lxTimeService', function() {

        // pad integers with zeros if necessary. ie. 6 seconds would be displayed as 06 seconds.
        function zfill(number, size) {
          number = number.toString();
          while (number.length < size) {
              number = '0' + number;
          }
          return number;
        }

        return {
            getTimeString : function() {
                var now = new Date();
                var h=now.getHours();
                var m=now.getMinutes();
                var s=now.getSeconds();

                m = zfill(m, 2);
                s = zfill(s, 2);

                var currentTimeString = h + ':' + m + ':' + s;
                return currentTimeString;
            }
        };
    })

    .factory('lxSoundService', function() {
        var canPlayMp3 = false;
        (function setCanPlayMp3Boolean() {
            var fakeAudioElement = document.createElement('audio');
            if (fakeAudioElement.canPlayType) {
                if (fakeAudioElement.canPlayType('audio/mpeg')) {
                    canPlayMp3 = true;
                }
            }
        })();

        return {
            canPlayMp3: canPlayMp3
        };
    });

