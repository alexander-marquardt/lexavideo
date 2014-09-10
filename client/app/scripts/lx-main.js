'use strict';
var videoApp = angular.module('videoApp', [


    // proprietary services
    'lxGlobalVarsAndConstants.services', 'lxCheckCompatibility.services',
    'lxModalSupport.services', 'lxVideoApp.services', 'lxVideoSettingsNegotiation.services',


    // proprietary directives
    'lxAccessSystemResources.directives',
    'lxMainVideo.directives', 'lxCheckCompatibility.directives',
    'lxAsciiVideo.directives', 'lxVideoTypeNegotiation.directives',


    // proprietary routes
    'lxMain.routes',

    // angular services
    'ngAnimate', 'ui.bootstrap'
]);

videoApp.run(function() {

});