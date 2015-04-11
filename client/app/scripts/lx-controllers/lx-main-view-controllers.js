
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global userInfoEmbeddedInHtml */

angular.module('lxMainView.controllers', [])

.controller('lxVideoChatAppViewCtrl',
    function(
        $document,
        $rootScope,
        $location,
        $log,
        $route,
        $scope,
        $window,
        lxAppWideConstantsService,
        lxChannelService) {


        // Copy information embedded in the Html into an angular service.
        angular.extend(lxAppWideConstantsService, userInfoEmbeddedInHtml);

        $scope.debugBuildEnabled = lxAppWideConstantsService.debugBuildEnabled;

        // remoteVideoElementsDict will be populated with calls to lxCreateChatRoomObjectsService.createRemoteVideoElementsObject
        // There will be one object for each remote client that the local user is exchanging video with.
        // remoteVideoElementsDict[remoteClientId] = {
        //    remoteHdVideoElem: the dom element that will display the remote video,
        //    isAudioMuted: boolean
        // }
        $scope.remoteVideoElementsDict = {};


        // Keeps track of which chat room the user has selected, pulled from the URL that is set by ngRoute
        // and ngView.
        $rootScope.chatRoomDisplayObject = {
            chatRoomNameFromUrl: null,
            normalizedChatRoomNameFromUrl: null,

            // If the user leaves the chat-room view and then comes back, they will be shown the last chat
            // room that they were participating in.
            lastChatRoomNameFromUrl: null,

            // point to the element in chatPanelDict that corresponds to the currently displayed chat
            chatPanelObject: null
        };


        // roomOccupancyDict will have a unique key corresponding to the chatRoomName of each room the the current
        // client is a member of. The value of each key will be an object that contains the name of the room
        // and a listing of all of the clients that are in each room.
        // eg. roomOccupancyDict[chatRoomName] = {
        //      chatRoomId: chatRoomId,
        //      listOfClientObjects: [],
        //      dictOfClientObjects: {},
        // }
        $scope.roomOccupancyDict = {};

        // The following structure contains a list of the room names, and is used for displaying a sorted list
        // of room names. Eg, it would contain ['room1', 'room5', 'room2', etc.]. Note, it is stored un-sorted,
        // and we use angular filters to do the sorting.
        $scope.normalizedOpenRoomNamesList = [];

        $scope.simpleArrayOrderByFn = function(x) {
            return x;
        };


        // The clientId is unique for each connection that a user makes to the server (ie. each new browser
        // window/device that they connect from). In order to create a unique clientID, we append the userId with
        // a randomly generated number with a billion possibilities. This should prevent the user
        // from being assigned two clientIds that clash.
        var uniqueClientIdentifier = Math.floor((Math.random() * 1000000000));
        var clientId = lxAppWideConstantsService.userId + '|' + uniqueClientIdentifier;

        $scope.lxMainViewCtrl = {
            channelToken: null,
            clientId: clientId,
            userId: lxAppWideConstantsService.userId,
            userName: lxAppWideConstantsService.userName
        };

        $scope.localVideoObject = {
            localHdVideoElem: undefined,  // set in lxVideoElementDirective
            localVideoWrapper: undefined, // set in lxVideoWrapperDirective
            isWebcamMuted: false,
            isMicrophoneMuted: false
        };


        $scope.notificationMenuObject = {
            showNotificationMenu: false,
            partialShowNotificationMenuAndGetAttention: false
        };

        $scope.toggleNotificationMenu = function(event) {
            // we don't want a click inside the notfication menu to propagate, because clicks outside
            // of the notification menu will close the menu (due to clickAnywhereButHere directive)
            event.stopPropagation();


            $scope.notificationMenuObject.showNotificationMenu = !$scope.notificationMenuObject.showNotificationMenu;

            // if notification menu is now shown, then get ride of the main menu
            if ($scope.notificationMenuObject.showNotificationMenu) {
                $scope.mainMenuObject.showMainMenu = false;
            }

            // If a user clicks on the button, then we stop drawing attention to it because they have
            // now seen whatever they needed to be alerted about.
            $scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention = false;
        };

        $scope.mainMenuObject = {
            showMainMenu: false
        };

        $scope.toggleMainMenu = function($event) {
            $event.stopPropagation();

            $scope.mainMenuObject.showMainMenu = !$scope.mainMenuObject.showMainMenu;

            // if main menu is now shown, then remove the notification menu (this needs to be done manually
            // since we have stopped propagation of this click event, and so code that detects a click outside
            // of the notification menu will not be triggered.
            if ($scope.mainMenuObject.showMainMenu) {
                $scope.notificationMenuObject.showNotificationMenu = false;
            }
        };

        $document.on('click', function() {
            $scope.$apply(function(){
                $scope.mainMenuObject.showMainMenu = false;
            });
        });


        // videoExchangeObjectsDict will be populated by calling
        // lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject(), and there will be one key
        // for each remote client that the local user is exchanging video settings with.
        //
        // eg. videoExchangeObjectsDict[remoteClientId] = {
        //      localVideoEnabledSetting: [string - see below for description],
        //      remoteVideoEnabledSetting: [string - see below for description],
        //      rtcInitiator: boolean
        //     }
        // localVideoEnabledSetting and remoteVideoEnabledSetting can be the following values:
        //    'waitingForPermissionToEnableVideoExchange': user has not made any request for a video exchange
        //    'doVideoExchange': user has requested/accepted to start video
        //    'denyVideoExchange': user has denied activation of video elements
        //    'hangupVideoExchange': user has denied activation of video elements
        $scope.videoExchangeObjectsDict = {};

        $scope.videoStateInfoObject = {
            // we keep track of the number of times that the local user has enabled video exchanges. When this
            // number is zero, we do not show any video boxes, and when it is one or more, we show video.
            numOpenVideoExchanges: 0,

            // Track number of requests for video exchanges that the local user has not yet responded to.
            numVideoRequestsPendingFromRemoteUsers: 0,


            // Track the remote IDs that have pending requests for video sessions
            pendingRequestsForVideoSessionsList: [],
            // Track the remote IDs that currently have open video sessions
            currentOpenVideoSessionsList: []
        };



        // The following declarations should only be used inside the lxMainVideoCtrl, however we need to declare them
        // here because information received on the channel needs to be written into these objects.
        $scope.videoSignalingObject = {

            localUserAccessCameraAndMicrophoneStatus: 'requestNotMade', // 'requestNotMade', 'waitingForResponse', 'allowAccess', 'denyAccess'

            // The following is a flag that is used for debugging - will over-ride ng-show directives on the video
            // windows to show any window that has this flag on it when it is set to true.
            debugShowAllVideoWindows: false
        };

        // receivedChatMessageObject will have a unique key corresponding to the chatRoomId of each room the the current
        // client is a member of. The value of each key will be an object that contains the name of the room
        // and a listing of all of the clients that are in each room.
        // eg. roomOccupancyDict[chatRoomId] = {
        //      messageString: string,
        //      // receivedMessageTime is updated every time the user sends a message - this is necessary because
        //      // if we just watch receivedMessageString for changes to trigger sending of the message, then the user will not be
        //      // able to send the same message twice.
        //      receivedMessageTime: time
        // }
        $scope.receivedChatMessageObject = {};



        // chatPanelDict will have a unique key corresponding to the chatRoomId of each room that the client
        // is currently a member of.
        // eg. chatPanelDict[chatRoomId] = {
        //    // initially keep the chat panel glued so that the most recent messages are shown.
        //    chatPanelIsGlued: true,
        //    numMessagesSinceLastTimeBottomOfPanelWasViewed: 0,
        //    chatPanelIsCurrentlyVisible: false
        // };
        $scope.chatPanelDict = {};

        $scope.trackUnseenMessageCountObject = {
            unseenMessageCount: 0
        };

        $scope.mainGlobalControllerObj = {
             // if the user is rejected from a room, then this will contain a information about what went wrong.
             /*
             errorEnteringIntoRoomInfoObj = {
                statusString: null,
                pageNameThatCausedError: null,
                pageUrlThatCausedError: null
             }
             We set errorEnteringIntoRoomInfoObj to null to indicate that there are no currently un reported errors.*/
            errorEnteringIntoRoomInfoObj: null
        };

        // Track if the user has chosen to show or hide the groupMembersDropdown. This is placed in the
        // mainViewController because we wish to maintain this state between different views.
        $scope.dropdownMenusStatuses = {
            groupMembersDropdownIsOpen: true,
            openChatsDropdownIsOpen: true
        };

        lxChannelService.initializeChannel($scope, clientId, lxAppWideConstantsService.userId);





        // handle case when a route change promise is not resolved
        $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
            $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection);
        });

        $rootScope.$on('$locationChangeStart', function(event, next, current) {
            $log.debug('Next route: ' + next);
            $log.debug('Current route: ' + current);
        });

        $rootScope.$on('$locationChangeSuccess', function() {
            $log.debug('$locationChangeSuccess called');
        });

        $rootScope.$on('$routeChangeSuccess', function() {
            $scope.mainMenuObject.showMainMenu = false;

            // set the values on chatRoomDisplayObject
            var chatRoomNameFromUrl = $route.current.params.chatRoomName;

            if (chatRoomNameFromUrl) {
                $rootScope.chatRoomDisplayObject.chatRoomNameFromUrl = chatRoomNameFromUrl;
                $rootScope.chatRoomDisplayObject.normalizedChatRoomNameFromUrl = chatRoomNameFromUrl.toLowerCase();
                $rootScope.chatRoomDisplayObject.lastChatRoomNameFromUrl = chatRoomNameFromUrl;
            }
            else {
                $rootScope.chatRoomDisplayObject.chatRoomNameFromUrl = null;
                $rootScope.chatRoomDisplayObject.normalizedChatRoomNameFromUrl = null;
                // Note: do not null lastChatRoomNameFromUrl as it "remembers" the last chat room
            }
        });

        $scope.windowWatcher = {
            isFocused: true
        };
        // Monitor the window to see if it has focus, and set the windowWatcher.isFocused
        // variable appropriately. $scope.windowWatcher.isFocused can then be watched by child scopes.
        $(window).focus(function() {
            $scope.$apply(function() {
                $scope.windowWatcher.isFocused = true;
            });
        }).blur(function() {
            $scope.$apply(function() {
                $scope.windowWatcher.isFocused = false;
            });
        });

    });


