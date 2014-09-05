'use strict';
var videoApp = angular.module('videoApp', [

    // proprietary services
    'lxServerConstants.services', 'lxCheckCompatibility.services',
    'lxModalSupport.services', 'lxVideoApp.services', 'lxVideoSettingsNegotiation.services',

    // proprietary directives
    'lxAccessSystemResources.directives',
    'lxMainVideo.directives', 'lxCheckCompatibility.directives',
    'lxAsciiVideo.directives', 'lxVideoTypeNegotiation.directives',

    // angular services
    'ngAnimate', 'ui.bootstrap']);

videoApp.run(function() {

});