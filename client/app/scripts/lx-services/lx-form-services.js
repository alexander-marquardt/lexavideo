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

angular.module('lxForms.services', [])

    .factory('lxFormsInputService',
    function() {
        return {

            checkForInvalidCharacters: function(inputElem, invalidCharsPattern) {
                // Get the last character that was entered when $error.pattern changed to true.
                // The will set invalidCharacter to the first invalid character in the sequence.
                // Note: $error.pattern is a boolean that returns true if the pattern is invalid.
                var invalidCharacterFeedbackArray = [];
                if (inputElem.$error.pattern) {

                    var invalidCharacterSet = {}; // used to ensure that we report each character only once
                    var invalidCharactersArray = inputElem.$viewValue.match(invalidCharsPattern);

                    angular.forEach(invalidCharactersArray, function (invalidCharacter) {

                        // if invalidCharacter is already in invalidCharacterSet, then don't add the character
                        // to the invalidCharactersArray.
                        if (!(invalidCharacter in invalidCharacterSet)) {

                            // we treat invalidCharacterSet as a set, and only want to show each "key" once. The "value"
                            // for each key is irrelevant, so we just set it to null since we don't use it anyway.
                            invalidCharacterSet[invalidCharacter] = null;

                            if (invalidCharacter.match(/\s/)) {
                                var blankStr = 'blank space';
                                invalidCharacterFeedbackArray.push(blankStr);
                            } else {
                                invalidCharacterFeedbackArray.push(invalidCharacter);
                            }
                        }
                    });
                }

                return invalidCharacterFeedbackArray;
            }
        };
    });