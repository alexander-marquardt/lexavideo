'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary routes
    'lxMain.routes',

    // proprietary controllers
    'lxChatbox.controllers',
    'lxDebuggingInfo.controllers',
    'lxLandingPage.controllers',
    'lxLogin.controllers',
    'lxMainView.controllers',
    'lxPresence.controllers',
    'lxUseChatRoom.controllers',
    'lxVideo.controllers',

    // proprietary directives
    'lxChatbox.directives',
    'lxChatRoom.directives',
    'lxCommon.directives',
    'lxLandingPage.directives',
    'lxLogin.directives',
    'lxMainVideo.directives',
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
    'lxForms.services',
    'lxGlobalVarsAndConstants.services',
    'lxHttp.services',
    'lxModalSupport.services',
    'lxPresence.services',
    'lxUtility.services',
    'lxVideo.services',
    'lxVideoNegotiation.services',
    'lxVideoSetup.services',

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