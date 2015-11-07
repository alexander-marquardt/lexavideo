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

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

var commonDirectives = angular.module('lxCommon.directives', []);


commonDirectives.directive('lxCheckIfSystemSupportsWebRtcDirective',
    function(lxCheckIfSystemSupportsWebRtcService){

    return {
        restrict: 'A',
        scope: {}, // restrict scope so that we don't pollute other scopes
        link: function(scope) {
            lxCheckIfSystemSupportsWebRtcService.checkBrowserVersionToSeeIfGetUserMediaSupported(scope);
        }
    };
});


commonDirectives.directive('lxClickOnceDirective', function ($timeout) {
    var delay = 500;   // min milliseconds between clicks

    return {
        restrict: 'A',
        priority: -1,   // cause out postLink function to execute before native `ngClick`'s
                        // ensuring that we can stop the propagation of the 'click' event
                        // before it reaches `ngClick`'s listener
        link: function (scope, elem) {
            var disabled = false;

            function onClick(evt) {
                if (disabled) {
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                } else {
                    disabled = true;
                    $timeout(function () { disabled = false; }, delay, false);
                }
            }

            scope.$on('$destroy', function () { elem.off('click', onClick); });
            elem.on('click', onClick);
        }
    };
});

commonDirectives.factory('clickAnywhereButHereService', function(
    $document,
    $log,
    $timeout){

    var handlerClosure = null;
    var disabled = false;

    return {
        handleOuterClick: function($scope, expr) {
            var handler = function() {
                $log.log('executing handleOuterClick: ' +  expr);
                $scope.$apply(expr);
            };

            if (!disabled) {
                $document.on('click.clickAnywhereButHereDocument', handler);
            }

            // IMPORTANT! Tear down this event handler when the scope is destroyed.
            $scope.$on('$destroy', function(){$document.off('click.clickAnywhereButHereDocument', handler);});

            handlerClosure = handler;
        },

        // In some rare cases, we may need to temporarily disable the clickAnywhereButHere directive. In particular
        // this is needed when we detect a swipe event, and need to prevent the click from triggering and undoing
        // the swipe action.
        temporarilyDisableHandleOuterClick: function() {
            $document.off('click.clickAnywhereButHereDocument', handlerClosure);
            disabled = true;
            $timeout(function() {
                $document.on('click.clickAnywhereButHereDocument', handlerClosure);
                disabled = false;
            }, 50);
        }
    };
});

commonDirectives.directive('clickAnywhereButHere', function($log, clickAnywhereButHereService){
    return {
        restrict: 'A',
        link: function(scope, elem, attr) {
            var handler = function(e) {
                $log.log('clickAnywhereButHere stopping click propagation.');
                e.stopPropagation();
            };
            elem.on('click.clickAnywhereButHereElem', handler);

            scope.$on('$destroy', function(){
                elem.off('click.clickAnywhereButHereElem', handler);
            });

            $log.log('executing clickAnywhereButHere' +  attr.clickAnywhereButHere);
            clickAnywhereButHereService.handleOuterClick(scope, attr.clickAnywhereButHere);
        }
    };
});

commonDirectives.directive('lxClickHereDirective', function($log) {
    return {
        restrict: 'A',
        link: function (scope, elem, attr) {
            var handler = function() {
                $log.log('executing lxClickHereDirective: ' +  attr.lxClickHereDirective);
                scope.$apply(attr.lxClickHereDirective);
            };

            $log.log('executing lxClickHereDirective' +  attr.lxClickHereDirective);

            elem.on('click.lxClickHereDirective', handler);
            scope.$on('$destroy', function(){
                elem.off('click.lxClickHereDirective', handler);
            });
        }
    };
});

commonDirectives.directive('setClassesForCommonArea', function(){
    return {
        restrict: 'A',
        link: function(scope,element){

            var standardClasses = 'col-xs-12';
            var mainMenuShownClasses = 'col-xs-12 col-xs-offset-4 col-sm-9 col-sm-offset-3 col-md-10 col-md-offset-2';
            var partialNotificationMenuShown = 'col-xs-9 cl-col-remove-right-padding';

            function resizeCommonArea() {
                if (!scope.mainMenuObject.showMainMenu && !scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention) {
                    element.removeClass(mainMenuShownClasses);
                    element.removeClass(partialNotificationMenuShown);
                    element.addClass   (standardClasses);
                }
                else if (scope.mainMenuObject.showMainMenu) {
                    element.removeClass(standardClasses);
                    element.removeClass(partialNotificationMenuShown);
                    element.addClass   (mainMenuShownClasses);
                }
                else if (scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention) {
                    element.removeClass(standardClasses);
                    element.removeClass(mainMenuShownClasses);
                    element.addClass   (partialNotificationMenuShown);
                }
            }

            // Set the body background to a different color, so that the user will notice that something is pending.
            function setBodyClassToAttention(getAttention) {
                if (getAttention) {
                    $('body').addClass('cl-body-notification-pending');
                } else {
                    $('body').removeClass('cl-body-notification-pending');
                }
            }

            scope.$watch('mainMenuObject.showMainMenu', function() {
                resizeCommonArea();
            });

            scope.$watch('notificationMenuObject.partialShowNotificationMenuAndGetAttention', function(getAttention) {
                resizeCommonArea();
                setBodyClassToAttention(getAttention);
            });
        }
    };
});

commonDirectives.directive('lxDisableNgAnimate', function($animate) {
  return {
    restrict: 'A',
    link: function(scope, element) {
      $animate.enabled(false, element);
    }
  };
});

commonDirectives.directive('lxNoSwipePropagation',

    function() {
        return {
            restrict: 'A',
            link: function (scope, elem) {

                var handler = function(event) {
                    event.stopPropagation();
                };

                // Catch mousedown events so that the ng-swipe events are not propagated outside
                // of the mini-video carousel.
                var events = 'mousedown.lxNoSwipePropagation mousemove.lxNoSwipePropagation touchstart.lxNoSwipePropagation touchend.lxNoSwipePropagation';
                elem.on(events, handler);

                scope.$on('$destroy', function() {
                    elem.off(events, handler);
                });
            }
        };
    });

commonDirectives.directive('lxGetPresenceColorCssClass',
    function($log) {

        var cssActive = 'cl-presence-active';
        var cssIdle = 'cl-presence-idle';
        var cssAway = 'cl-presence-away';
        return {
            restrict: 'A',
            link: function(scope, element, attr) {
                var presenceStateName = attr.presenceStateName;

                element.removeClass(cssActive);
                element.removeClass(cssIdle);
                element.removeClass(cssAway);

                if (presenceStateName === 'PRESENCE_ACTIVE') {
                    element.addClass(cssActive);
                }
                else if (presenceStateName === 'PRESENCE_IDLE') {
                    element.addClass(cssIdle);
                }
                else if (presenceStateName === 'PRESENCE_AWAY') {
                    element.addClass(cssAway);
                }
                else {
                    $log.error('Unknown presenceStateName: ' + presenceStateName);
                }
            }
        }
    });