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

    // Directive that will control signalling between two users about the type of video that they wish to transmit.
    // (ie. HD Video or Ascii Video)
    .directive('lxVideoNegotiationDirective',
    function (
        lxSelectAndNegotiateVideoTypeService) {


        return {
            restrict: 'A',
            link: function(scope) {
                lxSelectAndNegotiateVideoTypeService.watchForVideoSettingsChanges (scope);
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
        lxShowNumMessagesService
        ){

        return {
            restrict: 'A',
            link: function(scope) {

                // If the user is not focused on the current window, and then comes back to look at the current window
                // then the messages shown in the chat panel that is open in the window will be considered to have been
                // viewed, and the message counts will be adjusted accordingly.
                scope.$watch('windowWatcher.isFocused', function() {
                    var chatPanelObject = scope.chatRoomDisplayObject.chatPanelObject;
                    lxShowNumMessagesService.stopFlashingTitleAndAdjustCount(scope.trackUnseenMessageCountObject, chatPanelObject);
                    lxShowNumMessagesService.showNumMessagesInDocumentTitle(scope.trackUnseenMessageCountObject)
                });
            }
        };
    });