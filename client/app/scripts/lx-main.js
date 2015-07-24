'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary routes
    'lxMain.routes',

    // proprietary controllers
    'LxChatPanel.controllers',
    'LxDebuggingInfo.controllers',
    'LxLandingPage.controllers',
    'LxLogin.controllers',
    'LxMainView.controllers',
    'LxPresence.controllers',
    'LxChatRoom.controllers',
    'LxVideo.controllers',

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
    'lxChatRoom.services',
    'lxCodecs.services',
    'lxCheckCompatibility.services',
    'lxErrorHandling.services',
    'lxForms.services',
    'lxGlobalVarsAndConstants.services',
    'lxHttp.services',
    'lxMainView.services',
    'lxModalSupport.services',
    'lxPresence.services',
    'lxUtility.services',
    'lxVideo.services',
    'lxVideoNegotiation.services',
    'lxVideoSetup.services',

    // vendor directives
    'scrollGlue.directives',
    'presenceModule',
    'gettext',

    // angular services
    'ngAnimate',
    'ngTouch',
    'ui.bootstrap',
    'angular-jwt'
]);


videoApp.run(function(gettextCatalog) {
    gettextCatalog.setCurrentLanguage(userInfoEmbeddedInHtml.preferedLocale);
    gettextCatalog.debug = true;
});