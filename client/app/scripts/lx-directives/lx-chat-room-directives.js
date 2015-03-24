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

                scope.$watch('windowWatcher.isFocused', function() {
                    var chatPanelObject = scope.chatRoomDisplayObject.chatPanelObject;
                    lxShowNumMessagesService.stopFlashingTitleAndAdjustCount(scope.trackUnseenMessageCountObject, chatPanelObject);
                    lxShowNumMessagesService.showNumMessagesInDocumentTitle(scope.trackUnseenMessageCountObject)
                });
            }
        };
    });