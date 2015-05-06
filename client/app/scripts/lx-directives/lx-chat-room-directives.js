'use strict';



angular.module('lxChatRoom.directives', [])

    .directive('lxInitializeTurnDirective',
    function(
        $log,
        lxTurnService
        ) {

        return {
            restrict: 'A',
            link: function() {
                try {
                    lxTurnService.maybeRequestTurn();
                }
                catch (e) {
                    e.message = '\n\tError in lxInitializeTurnDirective\n\t' + e.message;
                    $log.error(e);
                    return false;
                }
            }
        };
    })


    .directive('lxAccessCameraAndMicrophoneDirective',
    function(
        lxAccessCameraAndMicrophoneService)
    {

        return {
            restrict: 'A',
            link: function(scope) {
                lxAccessCameraAndMicrophoneService.showModalsAndArrowsForGrantingCameraAndMicrophoneAccess(scope);
            }
        };
    })

    .directive('lxShowUnseenMessageCountDirective',
    function(
        lxShowNumMessagesService,
        lxWindowFocus
        ){

        return {
            restrict: 'A',
            link: function(scope) {

                // If the user is not focused on the current window, and then comes back to look at the current window
                // then we stop flashing the title.
                scope.$watch(
                    function() {
                        return lxWindowFocus.windowIsFocusedFn();
                    },
                    function(windowIsFocused) {
                        if (windowIsFocused === true) {
                            lxShowNumMessagesService.stopFlashingTitle();
                            lxShowNumMessagesService.showNumMessagesInDocumentTitle(scope.trackUnseenMessageCountObject);
                        }
                    }
                );
            }
        };
    })


    .directive('lxNotificationMenuButtonDirective',
    function(){

        return {
            restrict: 'A',
            transclude: true,
            template: '' +
                '<span ng-transclude></span>' +
                '<span ng-if="videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers">' +
                    '&nbsp;{{ videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers }}' +
                '</span>',

            link: function(scope, elem) {

                function applyToggleNotificationMenu(event) {
                    scope.$apply(function() {
                        scope.toggleNotificationMenu(event);
                    });
                }

                elem.on('click', applyToggleNotificationMenu);
                scope.$on('$destroy', function(){elem.off('click', applyToggleNotificationMenu);});

                // if the user gets a new notification then we want to draw attention to the button.
                scope.$watch('videoStateInfoObject.numVideoRequestsPendingFromRemoteUsers', function(numPendingRequests, prevNumPendingRequests) {
                    if (numPendingRequests > 0 && numPendingRequests > prevNumPendingRequests) {
                        // Show the "partial" notification menu, but only if the "full" notification menu is not already
                        // being viewed.
                        if (!scope.notificationMenuObject.showNotificationMenu) {
                            scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention = true;
                        }
                    }

                    if (numPendingRequests === 0) {
                        scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention = false;

                        // If the notification menu is shown, and then the number of pending notification is
                        // reduced (eg. a user agrees/denies a video exchange request) to zero, then hide
                        // the notification menu.
                        if (prevNumPendingRequests > 0) {
                            scope.notificationMenuObject.showNotificationMenu = false;
                        }
                    }
                });
            }
        };
    })


    .directive('lxWatchForErrorEnteringIntoRoom',
    function(
        lxModalSupportService
        )
    {

        return {
            restrict: 'A',
            link: function(scope) {
                scope.$watch('mainGlobalControllerObj.errorEnteringIntoRoomInfoObj', function(errorEnteringIntoRoomInfoObj) {

                    if (errorEnteringIntoRoomInfoObj !== null) {
                        lxModalSupportService.showStandardModalWindowFromTemplate(
                                '<div class="modal-header">' +
                                '<h3 class="modal-title">Error entering into room ' + errorEnteringIntoRoomInfoObj.pageNameThatCausedError + '</h3>' +
                                '<div class="modal-body">' +
                                'Unable to enter into room: <strong>' +
                                errorEnteringIntoRoomInfoObj.pageNameThatCausedError + '</strong>' +
                                ' due to error code: ' + errorEnteringIntoRoomInfoObj.statusString  + '<br>' +
                                '<a ng-click="modalOkFn()" href=' +
                                errorEnteringIntoRoomInfoObj.pageUrlThatCausedError + '>Try Again </a>' +
                                '</div>' +
                                '<div class="modal-footer">' +
                                '<button class="btn btn-primary" ng-click="modalOkFn()">Close</button>' +
                                '</div>' +
                                '</div>');
                        scope.mainGlobalControllerObj.errorEnteringIntoRoomInfoObj = null;
                    }
                });
            }
        };
    });
