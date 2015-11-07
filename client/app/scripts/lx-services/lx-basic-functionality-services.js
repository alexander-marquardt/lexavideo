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

/* global $ */

angular.module('lxBasicFunctionality.services', [])

.factory('lxJs',
function() {

    return {
        assert: function (condition, message) {
            if (!condition) {
                message = message || 'Assertion failed';
                if (typeof Error !== 'undefined') {
                    throw new Error(message);
                }
                throw message; // Fallback
            }
        },

        removeItemFromList: function(itemToRemove, listToModify) {

            if ($.inArray(itemToRemove, listToModify) !== -1) {
                var idx = listToModify.indexOf(itemToRemove);
                listToModify.splice(idx, 1);
            }
        }
    };
});
