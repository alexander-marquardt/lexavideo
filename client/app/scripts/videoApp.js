'use strict';
var videoApp = angular.module('videoApp', ['videoApp.mainConstants', 'videoApp.directives', 'videoApp.services']);

videoApp.run(function($log, $window, constantsService, channelService, turnService,
              peerService, callService, userNotificationService,
              messageService, globalVarsService) {
    
    var i;
    if (constantsService.errorMessages.length > 0) {
        for (i = 0; i < constantsService.errorMessages.length; ++i) {
            $window.alert(constantsService.errorMessages[i]);
        }
        return;
    }

    $log.log('Initializing; room=' + constantsService.roomKey + '.');

    userNotificationService.resetStatus();
    // NOTE: AppRTCClient.java searches & parses this line; update there when
    // changing here.
    channelService.openChannel();
    turnService.maybeRequestTurn();

    // Caller is always ready to create peerConnection.
    // ARM Note: Caller is the 2nd person to join the chatroom, not the creator
    globalVarsService.signalingReady = globalVarsService.initiator;

    if (constantsService.mediaConstraints.audio === false &&
        constantsService.mediaConstraints.video === false) {
        callService.hasLocalStream = false;
        callService.maybeStart();
    } else {
        callService.hasLocalStream = true;
        callService.doGetUserMedia();
    }


    // Send BYE on refreshing(or leaving) a demo page
    // to ensure the room is cleaned for next session.
    $window.onbeforeunload = function() {
        messageService.sendMessage({type: 'bye'});
    };


});