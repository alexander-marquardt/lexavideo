'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary routes
    'lxMain.routes',

    // proprietary controllers
    'lxLandingPage.controllers',
    'lxMainView.controllers',
    'lxUseChatRoom.controllers',

    // proprietary directives
    'lxAccessSystemResources.directives',
    'lxAsciiVideo.directives',
    'lxCheckCompatibility.directives',
    'lxMainVideo.directives',
    'lxUseChatRoom.directives',
    'lxUserInputFeedback.directives',
    'lxVideoNegotiation.directives',

    // proprietary services
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