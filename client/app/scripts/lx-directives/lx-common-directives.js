/**
 * Created by alexandermarquardt on 2014-08-27.
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

commonDirectives.factory('clickAnywhereButHereService', function($document){

  return function($scope, expr) {
    var handler = function() {
      $scope.$apply(expr);
    };

    $document.on('click', handler);

    // IMPORTANT! Tear down this event handler when the scope is destroyed.
    $scope.$on('$destroy', function(){$document.off('click', handler);});
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
      elem.on('click', handler);

      scope.$on('$destroy', function(){
        elem.off('click', handler);
      });

      clickAnywhereButHereService(scope, attr.clickAnywhereButHere);
    }
  };
});

commonDirectives.directive('setClassesForCommonArea', function(){
    return {
        restrict: 'A',
        link: function(scope,element){

            var standardClasses = 'col-xs-12';
            var mainMenuShownClasses = 'col-xs-12 col-xs-offset-4 col-sm-9 col-sm-offset-3 col-md-10 col-md-offset-2';
            var partialNotificationMenuShown = 'col-xs-11 cl-col-remove-right-padding';

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