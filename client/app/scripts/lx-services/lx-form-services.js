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