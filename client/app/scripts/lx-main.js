'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary routes
    'lxMain.routes',

    // proprietary controllers
    'lxChatbox.controllers',
    'lxUseChatRoom.controllers',
    'lxLandingPage.controllers',
    'lxMainView.controllers',

    // proprietary directives
    'lxChatbox.directives',
    'lxChatRoom.directives',
    'lxCommon.directives',
    'lxMainVideo.directives',
    'lxLandingPage.directives',
    'lxVideoNegotiation.directives',

    // proprietary services
    'lxAccessSystemResources.services',
    'lxBasicFunctionality.services',
    'lxChannel.services',
    'lxChatbox.services',
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

    // vendor directives
    'scrollGlue.directives',

    // angular services
    'ngAnimate',
    'ui.bootstrap'
]);

videoApp.run(function() {

});