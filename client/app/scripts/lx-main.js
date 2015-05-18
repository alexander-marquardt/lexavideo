'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary routes
    'lxMain.routes',

    // proprietary controllers
    'lxAuthentication.controllers',
    'lxChatbox.controllers',
    'lxDebuggingInfo.controllers',
    'lxUseChatRoom.controllers',
    'lxLandingPage.controllers',
    'lxMainView.controllers',
    'lxVideo.controllers',
    'lxPresence.controllers',

    // proprietary directives
    'lxChatbox.directives',
    'lxChatRoom.directives',
    'lxCommon.directives',
    'lxMainVideo.directives',
    'lxLandingPage.directives',
    'lxVideoExchangeUserFeedback.directives',

    // proprietary services
    'lxAuthentication.services',
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
    'lxPresence.services',
    'lxVideoSetup.services',
    'lxModalSupport.services',
    'lxUtility.services',
    'lxVideo.services',
    'lxVideoNegotiation.services',

    // vendor directives
    'scrollGlue.directives',
    'presenceModule',

    // angular services
    'ngAnimate',
    'ngTouch',
    'ui.bootstrap',
    'angular-jwt'
]);

videoApp.run(function() {

});