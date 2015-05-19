'use strict';
/* global $ */

angular.module('lxForms.services', [])

    .factory('lxFormsInputService',
    function() {
        return {
            highlightInput: function(inputElement) {

                var cssClass;
                if (inputElement.$invalid  && inputElement.$dirty ) {
                    cssClass = 'cl-invalid-input-glow';
                }
                else if (inputElement.$valid && inputElement.$dirty) {

                    // the roomIsEmptyMessage and roomNotFullMessage are set in the checkForRoomOccupancy directive.
                    if (inputElement.roomIsEmptyMessage) {
                        cssClass = 'cl-valid-input-glow';
                    }
                    if (inputElement.roomNotFullMessage) {
                        cssClass = 'cl-warning-input-glow';
                    }
                }
                else {
                    cssClass = '';
                }
                return cssClass;
            }
        }
    });