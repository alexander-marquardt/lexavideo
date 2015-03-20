
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global userInfoEmbeddedInHtml */

angular.module('lxMainView.controllers', [])

.controller('lxVideoChatAppViewCtrl',
    function(
        $rootScope,
        $location,
        $log,
        $route,
        $scope,
        $window,
        lxAppWideConstantsService,
        lxChannelService,
        lxHttpChannelService,
        lxModalSupportService) {


        // Copy information embedded in the Html into an angular service.
        angular.extend(lxAppWideConstantsService, userInfoEmbeddedInHtml);

        $scope.debugBuildEnabled = lxAppWideConstantsService.debugBuildEnabled;

        // remoteVideoObject will be populated with calls to lxCreateChatRoomObjectsService.createRemoteVideoObject
        // There will be one object for each remote client that the local user is exchanging video with.
        $scope.remoteVideoObjectsDict = {};


        // Keeps track of which chat room the user has selected, pulled from the URL that is set by ngRoute
        // and ngView.
        $rootScope.currentlyDisplayedChatRoom = {};


        // roomOccupancyDict will have a unique key corresponding to the chatRoomName of each room the the current
        // client is a member of. The value of each key will be an object that contains the name of the room
        // and a listing of all of the clients that are in each room.
        // eg. roomOccupancyDict[chatRoomName] = {
        //      chatRoomId: chatRoomId,
        //      listOfClientObjects: [],
        //      dictOfClientObjects: {},
        // }
        $scope.roomOccupancyDict = {};


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

        $scope.mainMenuObject = {
            showMainMenu: false
        };
        $scope.toggleMainMenu = function() {
            $scope.mainMenuObject.showMainMenu = !$scope.mainMenuObject.showMainMenu;
        };

        // videoExchangeObjectsDict will be populated with calls to
        // lxCreateChatRoomObjectsService.createVideoExchangeSettingsObject(), and there will be one key
        // for each remote client that the local user is exchanging video settings with.
        $scope.videoExchangeObjectsDict = {};

        $scope.videoStateInfoObject = {
            // we keep track of the number of times that the local user has enabled video exchanges. When this
            // number is zero, we do not show any video boxes, and when it is one or more, we show video.
            localVideoIsEnabledCount: 0
        };



        // The following declarations should only be used inside the lxMainVideoCtrl, however we need to declare them
        // here because information received on the channel needs to be written into these objects.
        $scope.videoSignalingObject = {

            localUserAccessCameraAndMicrophoneStatus: 'requestNotMade', // 'requestNotMade', 'waitingForResponse', 'allowAccess', 'denyAccess'

            // videoSignalingStatusForUserFeedback indicates what message/status the user should be shown about
            // the current video type requested/allowed/waiting for/etc.
            videoSignalingStatusForUserFeedback: null,

            // The following is a flag that is used for debugging - will over-ride ng-show directives on the video
            // windows to show any window that has this flag on it when it is set to true.
            debugShowAllVideoWindows: false
        };


        $scope.receivedChatMessageObject = {
            messageString: undefined,

           // receivedMessageTime is updated every time the user sends a message - this is necessary because
            // if we just watch receivedMessageString for changes to trigger sending of the message, then the user will not be
            // able to send the same message twice.
            receivedMessageTime: 0
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

        lxHttpChannelService.requestChannelToken(clientId, lxAppWideConstantsService.userId).then(function(response) {
            $scope.lxMainViewCtrl.channelToken = response.data.channelToken;

            lxChannelService.openChannel($scope);

            $window.onbeforeunload = function () {
                $log.debug('Manually disconnecting channel on window unload event.');
                lxHttpChannelService.manuallyDisconnectChannel($scope.lxMainViewCtrl.clientId);
            };

            // Periodically update the room so that the server knows if the user is currently in the room.
            // lxChannelService.startClientHeartbeat($scope.lxMainViewCtrl.clientId);

        }, function() {
            $scope.lxMainViewCtrl.channelToken = 'Failed to get channelToken';
            $scope.lxMainViewCtrl.clientId = 'Failed to get clientId';
        });


        $scope.$watch('mainGlobalControllerObj.errorEnteringIntoRoomInfoObj', function(errorEnteringIntoRoomInfoObj) {


            if (errorEnteringIntoRoomInfoObj !== null) {
                lxModalSupportService.showStandardModalWindowFromTemplate(
                        '<div class="modal-header">' +
                        '<h3 class="modal-title">Error entering into room ' + errorEnteringIntoRoomInfoObj.pageNameThatCausedError + '</h3>' +
                        '<div class="modal-body">' +
                            'Unable to enter into room: <strong>' +
                            errorEnteringIntoRoomInfoObj.pageNameThatCausedError + '</strong>' +
                            ' due to error code: ' + errorEnteringIntoRoomInfoObj.statusString  + '<br>' +
                            '<a ng-click="modalOkFn()" href=' +
                            errorEnteringIntoRoomInfoObj.pageUrlThatCausedError + '>Try Again </a>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                        '<button class="btn btn-primary" ng-click="modalOkFn()">Close</button>' +
                        '</div>' +
                        '</div>');
                $scope.mainGlobalControllerObj.errorEnteringIntoRoomInfoObj = null;

            }

        });


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

            // set the values on currentlyDisplayedChatRoom
            var chatRoomNameFromUrl = $route.current.params.chatRoomName;
            $rootScope.currentlyDisplayedChatRoom.chatRoomNameFromUrl = chatRoomNameFromUrl;
            $rootScope.currentlyDisplayedChatRoom.normalizedChatRoomNameFromUrl = chatRoomNameFromUrl.toLowerCase();

        });
    });


