'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary routes
    'lxMain.routes',

    // proprietary directives
    'lxAccessSystemResources.directives',
    'lxAsciiVideo.directives',
    'lxCheckCompatibility.directives',
    'lxMainVideo.directives',
    'lxVideoNegotiation.directives',

    // proprietary services
    'lxCheckCompatibility.services',
    'lxErrorHandling.services',
    'lxGlobalVarsAndConstants.services',
    'lxModalSupport.services',
    'lxVideoApp.services',
    'lxVideoNegotiation.services',

    // angular services
    'ngAnimate',
    'ui.bootstrap'
]);

videoApp.run(function() {

});