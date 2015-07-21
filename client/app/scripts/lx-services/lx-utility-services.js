'use strict';
/* global $ */
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
    })

    .factory('lxWindowFocus', function() {

        var windowIsFocused = true;

        // Monitor the window to see if it has focus, and set the windowWatcher.windowIsFocused
        // variable appropriately. $scope.windowWatcher.windowIsFocused can then be watched by child scopes.
        $(window).focus(function() {
            windowIsFocused = true;
        }).blur(function() {
            windowIsFocused = false;
        });

        function windowIsFocusedFn() {
            return windowIsFocused;
        }

        return {
            'windowIsFocusedFn': windowIsFocusedFn
        };
    })

    .factory('lxSetEnableShowVideoElementsService',
    function(
        $log
        ) {


        return {
            lxSetEnableShowVideoElementsFn :function($scope) {
                $log.debug('setting enableShowVideoElements to false');

                $scope.videoStateInfoObject.enableShowVideoElements = false;

                // we wait for the ng-view animation to end before we show the video elements. This
                // is necessary because the if video is shown, then the animations don't work correctly.
                // Note: the "one" handler is unbound after it's first invocation, which is exactly what we want.
                $('.cl-ng-view').one('animationend webkitAnimationEnd oAnimationEnd MSAnimationEnd', function(){
                    $scope.$apply(function() {
                        $log.debug('setting enableShowVideoElements to true');
                        $scope.videoStateInfoObject.enableShowVideoElements = true;
                    });
                });

                // The following code is necessary because sometime the above ".one()" code doesn't fire if the user
                // switches away from the window while the animation is going on. Therefore, if the user leaves the
                // current window, automatically set enableShowVideoElements to true.
                $(window).on('blur', function() {
                    $log.debug('setting enableShowVideoElements to true after user has left window');
                    $scope.videoStateInfoObject.enableShowVideoElements = true;

                    // remove the event listener since we have now enabled the display of the video elements.
                    $(window).off('blur');
                });
            }
        }
    })

    .factory('lxShowNumMessagesService',
    function(
        $timeout,
        lxWindowFocus
        ) {

        var numMessagesIsShownToggle = true;
        var timerId = null;



        var clearNumMessagesInChatPanel = function(trackUnseenMessageCountObject, chatPanelObject) {
            trackUnseenMessageCountObject.unseenMessageCount -= chatPanelObject.numMessagesSinceLastTimeBottomOfPanelWasViewed;
            chatPanelObject.numMessagesSinceLastTimeBottomOfPanelWasViewed = 0;
        };





        var self = {
            subtractNumMessagesSeen: function(trackUnseenMessageCountObject, chatPanelObject) {
                clearNumMessagesInChatPanel(trackUnseenMessageCountObject, chatPanelObject);
                self.showNumMessagesInDocumentTitle(trackUnseenMessageCountObject);
            },
                    // function that stops the title from flashing the number of new messages
            stopFlashingTitle: function() {
                // remove blinking of the number of messages
                $timeout.cancel(timerId);
                timerId = null;
            },

            // Displays the number of messages received in the document title , and flashes the
            // number of messages to get the users attention.
            showNumMessagesInDocumentTitle: function (trackUnseenMessageCountObject) {

                // show the number of messages in the document title.
                if (trackUnseenMessageCountObject.unseenMessageCount) {
                    document.title = '(' + trackUnseenMessageCountObject.unseenMessageCount + ') ' + $('#id-document-title-div').text();

                    // If the user is focused on a page that
                    // flashing, we stop the flashing. It should only start to flash again in the case
                    // that the user focus is away from the page, and that the number of unseen messages has increased
                    // in the time that the user was not focused.
                    if (lxWindowFocus.windowIsFocusedFn()) {
                        self.stopFlashingTitle();
                    }

                    else {
                        // The remainder of this code deals with making the number of messages flash in the document title.
                        // First, check to see if the title is already flashing by seeing if timerId has been set. If it is already
                        // flashing, then don't start any new timer-loops.
                        if (!timerId) {
                            // don't start flashing until 10 seconds have passed.
                            var timeoutDelay = 2000;
                            // the following timer is used for switching between the title with and without the number of
                            // new messages included in the title.
                            var timeoutFn = function () {
                                timerId = $timeout(function () {

                                    if (trackUnseenMessageCountObject.unseenMessageCount) {
                                        if (numMessagesIsShownToggle) {
                                            document.title = $('#id-document-title-div').text();
                                        } else {
                                            document.title = '(' + trackUnseenMessageCountObject.unseenMessageCount + ') ' + $('#id-document-title-div').text();
                                        }
                                    }
                                    numMessagesIsShownToggle = !numMessagesIsShownToggle;
                                    // after initial wait, start flashing every X seconds.
                                    timeoutDelay = 500;

                                    timeoutFn();

                                }, timeoutDelay);
                            };
                            timeoutFn();
                        }
                    }
                } else {
                    document.title = $('#id-document-title-div').text();
                }
            }
        };

        return self;
    });