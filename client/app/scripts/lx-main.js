/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
*/

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


videoApp.run(function(gettextCatalog, $window, $rootScope) {

    $rootScope.globalData = {};

    // Check if the user has previously intentionally selected a language.
    if ($window.localStorage.languageLocale) {
        gettextCatalog.setCurrentLanguage($window.localStorage.languageLocale);
        $rootScope.globalData.languageLocale = $window.localStorage.languageLocale;
    }

    // The user has not selected a language, let the server determine what language to show
    // based on their browser settings.
    else {
        gettextCatalog.setCurrentLanguage(userInfoEmbeddedInHtml.preferedLocale);
        $rootScope.globalData.languageLocale = userInfoEmbeddedInHtml.preferedLocale;
    }
    gettextCatalog.debug = true;
});