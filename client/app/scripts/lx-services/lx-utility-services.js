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
    })

    .factory('lxShowNumMessagesService',
    function(
        $timeout
        ) {

        var numMessagesIsShownToggle = true;
        var timerId;


        var self = {
            clearNumMessagesInChatPanel: function(trackUnseenMessageCountObject, chatPanelObject) {
                trackUnseenMessageCountObject.unseenMessageCount -= chatPanelObject.numMessagesSinceLastTimeBottomOfPanelWasViewed;
                chatPanelObject.numMessagesSinceLastTimeBottomOfPanelWasViewed = 0;
            },


            // function that stops the title from flashing the number of new messages, and that adjusts
            // the number of unseen messages to reflect that the user has just clicked on a chat panel whose messages
            // have now been "seen" and are therefore removed from the count.
            stopFlashingTitleAndAdjustCount: function(trackUnseenMessageCountObject, chatPanelObject) {

                if (chatPanelObject.chatPanelIsCurrentlyVisible) {

                    if (chatPanelObject.chatPanelIsGlued) {
                        self.clearNumMessagesInChatPanel(trackUnseenMessageCountObject, chatPanelObject);
                    }
                }

                // remove blinking of the number of messages
                $timeout.cancel(timerId);
            },

            // Displays the number of messages received in the document title , and flashes the
            // number of messages to get the users attention.
            showNumMessagesInDocumentTitle: function (trackUnseenMessageCountObject) {

                // show the number of messages in the document title.
                if (trackUnseenMessageCountObject.unseenMessageCount) {
                    document.title = '(' + trackUnseenMessageCountObject.unseenMessageCount + ') ' + $('#id-document-title-div').text();

                    // The remainder of this code deals with making the number of messages flash in the document title.
                    // First, check to see if the title is already flashing by seeing if timerId has been set. If it is already
                    // flashing, then don't start any new timer-loops.
                    if (!timerId) {
                        // don't start flashing until 10 seconds have passed.
                        var timeoutDelay = 10000;
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
                                timeoutDelay = 1000;

                                timeoutFn();
                            }, timeoutDelay);
                        };
                        timeoutFn();
                    }
                } else {
                    document.title = $('#id-document-title-div').text();
                }
            }
        }
        return self;
    });