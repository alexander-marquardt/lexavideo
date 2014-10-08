'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary routes
    'lxMain.routes',

    // proprietary controllers
    'lxLandingPage.controllers',
    'lxMainView.controllers',
    'lxUseChatRoom.controllers',

    // proprietary directives
    'lxAsciiVideo.directives',
    'lxChatRoom.directives',
    'lxCheckCompatibility.directives',
    'lxMainVideo.directives',
    'lxUserInputFeedback.directives',
    'lxVideoNegotiation.directives',

    // proprietary services
    'lxAccessSystemResources.services',
    'lxChannel.services',
    'lxChatRoom.services',
    'lxCodecs.services',
    'lxCheckCompatibility.services',
    'lxErrorHandling.services',
    'lxGlobalVarsAndConstants.services',
    'lxHttp.services',
    'lxVideoSetup.services',
    'lxModalSupport.services',
    'lxUtility.services',
    'lxVideoNegotiation.services',

    // angular services
    'ngAnimate',
    'ui.bootstrap'
]);

videoApp.run(function() {

});