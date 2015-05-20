
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global userInfoEmbeddedInHtml */

angular.module('LxMainView.controllers', [])

.controller('LxMainController',
    function(
        $document,
        $rootScope,
        $location,
        $log,
        $route,
        $scope,
        $window,
        $timeout,
        lxAppWideConstantsService,
        lxAuthenticationHelper,
        lxChannelService,
        clickAnywhereButHereService
        ) {


        // Copy information embedded in the Html into an angular service.
        angular.extend(lxAppWideConstantsService, userInfoEmbeddedInHtml);

        var userId = lxAuthenticationHelper.lxGetUserIdInLocalStorage();
        var clientId;
        if (userId) {
            clientId = lxAuthenticationHelper.lxGetOrGenerateClientId(userId);
        } else {
            clientId = null;
        }

        $scope.lxMainCtrlDataObj = {
            clientId: clientId,
            userId: userId,
            username: null,
            currentView: null
        };


        $scope.debugBuildEnabled = lxAppWideConstantsService.debugBuildEnabled;

        // remoteVideoElementsDict will be populated with calls to lxCreateChatRoomObjectsService.createRemoteVideoElementsObject
        // There will be one object for each remote client that the local user is exchanging video with.
        // remoteVideoElementsDict[remoteClientId] = {
        //    remoteMiniVideoElem: the dom element that will display the miniature version of the remote video,
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
            chatPanelObject: null,

            // track the chatRoomId of the room that is currently displayed
            chatRoomId: null
        };


        // roomOccupancyDict will have a unique key corresponding to the chatRoomName of each room the the current
        // client is a member of. The value of each key will be an object that contains the name of the room
        // and a listing of all of the clients that are in each room.
        // eg. roomOccupancyDict[normalizedChatRoomName] = {
        //      chatRoomId: chatRoomId,
        //      listOfClientObjects: [],
        //      dictOfClientObjects: {},
        //      chatRoomNameAsWritten: string
        // }
        $scope.roomOccupancyDict = {};

        // The following structure contains a list of the room names, and is used for displaying a sorted list
        // of room names. Eg, it would contain ['room1', 'room5', 'room2', etc.]. Note, it is stored as a stack
        // with the most recent room at position 0, and the oldest room at the end of the list. This is done
        // so that when a user closes a room, we can easily direct them to the previous room that they had viewed.
        // When we are displaying a list of rooms in the html, we use angular filters to do the sorting.
        $scope.normalizedOpenRoomNamesList = [];

        $scope.simpleArrayOrderByFn = function(x) {
            return x;
        };



        $scope.channelObject = {
            channelToken: null,
            channelIsAlive: false,
            socket: null // socket returned from channel.open and is remembereed so we can later close the channel
        };

        $scope.localVideoObject = {
            localMiniVideoElem: null,
            localBigVideoElem: null,
            isWebcamMuted: false,
            isMicrophoneMuted: false
        };

        $scope.notificationMenuObject = {
            showNotificationMenu: false,
            partialShowNotificationMenuAndGetAttention: false
        };

        $scope.displayNotificationMenu = function(event, showNotificationBoolean) {
            event.stopPropagation();
            $scope.notificationMenuObject.showNotificationMenu = showNotificationBoolean;

            // if notification menu is now shown, then get ride of the main menu
            if ($scope.notificationMenuObject.showNotificationMenu) {
                $scope.mainMenuObject.showMainMenu = false;
            }

            // If a user clicks on the button, then we stop drawing attention to it because they have
            // now seen whatever they needed to be alerted about.
            $scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention = false;
        };

        $scope.toggleNotificationMenu = function(event) {
            // we don't want a click inside the notfication menu to propagate, because clicks outside
            // of the notification menu will close the menu (due to clickAnywhereButHere directive)

            $scope.displayNotificationMenu(event, !$scope.notificationMenuObject.showNotificationMenu);

        };

        $scope.mainMenuObject = {
            showMainMenu: false
        };

        $scope.displayMainMenu = function($event, showHideMainMenuBoolean) {
            $event.stopPropagation();

            $scope.mainMenuObject.showMainMenu = showHideMainMenuBoolean;

            // if main menu is now shown, then remove the notification menu (this needs to be done manually
            // since we have stopped propagation of this click event, and so code that detects a click outside
            // of the notification menu will not be triggered.
            if ($scope.mainMenuObject.showMainMenu) {
                $scope.notificationMenuObject.showNotificationMenu = false;
            }
        };

        function ignoreClickAnywhereButHereHandlerOnSwipe() {
           clickAnywhereButHereService.temporarilyDisableHandleOuterClick();
        }
        // on a right swipe, if the notification menu is shown then hide it. Otherwise, show the main menu.
        $scope.handleSwipeRight = function($event) {
            ignoreClickAnywhereButHereHandlerOnSwipe();

            // hide notification menu
            if ($scope.notificationMenuObject.showNotificationMenu || $scope.notificationMenuObject.partialShowNotificationMenuAndGetAttention) {
                $scope.displayNotificationMenu($event, false);
            }

            // show main menu
            else {
                $scope.displayMainMenu($event, true);
            }

        };

        // on a left swipe, if the main menu is shown then hide it, otherwise show the notification menu.
        $scope.handleSwipeLeft = function($event) {
            ignoreClickAnywhereButHereHandlerOnSwipe();

            // hide main menu
            if ($scope.mainMenuObject.showMainMenu) {
                $scope.displayMainMenu($event, false);
            }

            // show notification menu
            else {
                $scope.displayNotificationMenu($event, true);
            }

        };

        $scope.toggleMainMenu = function($event) {
            $scope.displayMainMenu($event, !$scope.mainMenuObject.showMainMenu);
        };


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
            enableShowVideoElements: true,

            // Track number of requests for video exchanges that the local user has not yet responded to.
            numVideoRequestsPendingFromRemoteUsers: 0,


            // Track the remote IDs that have pending requests for video sessions
            pendingRequestsForVideoSessionsList: [],
            // Track the remote IDs that currently have open video sessions
            currentOpenVideoSessionsList: []
        };

       $scope.chatboxPanelElementObject = {
           showFullChatHistory: true,
           videoIsFocused: true
       };
        // The following declarations should only be used inside the LxVideoController, however we need to declare them
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
        //    normalizedChatRoomName: string
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

        var watchClientId = $scope.$watch(function() {
            return $scope.lxMainCtrlDataObj.clientId;
        },
        function(clientId, previousClientId) {
            if (clientId) {
                $log.info('Calling lxChannelService.initializeChannel due to change in clientId from ' +
                    previousClientId + 'to ' + clientId);
                lxChannelService.initializeChannel($scope);

                // Kill this watch once we have initialized the channel
                watchClientId();
            }
        });
    });


