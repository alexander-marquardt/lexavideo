'use strict';

angular.module('lxHttp.services', [])

    .factory('lxHttpHandleRoomService',
    function (
        $log,
        $resource
        ) {

        var handleRoomUrl = '/_lx/handle_room/';
        var RoomResource = $resource(handleRoomUrl + ':chatRoomName', {chatRoomName: '@chatRoomName'});

        return {
            enterIntoRoom : function(roomObj) {
                // this will either create a room object on the server, or enter into an existing room corresponding
                // to chatRoomName.
                // Note: the returned value is a promise that will be fulfilled once the resource
                // has been created on the server.
                return new RoomResource(roomObj).$save();
            },


            getRoom : function(chatRoomName) {

                var roomObj = null;
                if (chatRoomName) {
                    roomObj = RoomResource.get({chatRoomName:chatRoomName});
                }
                return roomObj;
            }
        };
    })
    .factory('lxHttpChannelService',
    function (
        $log,
        $http,
        lxChannelSupportService
        ) {

        return {
            // Function that will initialize the channel and get the token from the server
            requestChannelToken: function(userId) {
                var postData = {'userId': userId};
                var httpPromise = $http.post('/_lx/channel/open_channel/', postData);
                httpPromise.then(function(response){
                    $log.info('Got channel data: ' + response.data);
                }, function(response){
                    $log.error('Failed to open channel for user id: ' + userId +'\nStatus: ' + response.statusText +
                    '\ndata: ' + angular.toJson(response.data));
                });

                return httpPromise;
            },

            manuallyDisconnectChannel: function(clientId) {
                // If we know that the user is disconnecting from the page, then we may want to send
                // a message to the server immediately, so that the room will be vacated instantly. This
                // is useful for cases where the user clicks on the reload button so that they are removed
                // from the room before the attempt to reload the page is made.

                $http.post('/_lx/channel/manual_disconnect/', 'from=' + clientId, {
                    // post as form data, not as the default json
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded;'}
                }).success(function(){
                    $log.info('Successfully send manual disconnect to server for clientId: ' + clientId);
                }).error(function(){
                    $log.warn('Failed to send manual disconnect to server for clientId: ' + clientId);
                });

                // close the socket
                lxChannelSupportService.socket.close();
            }
        };
    })

    .factory('lxMessageService',
    function(
        $http,
        $log,
        lxChatRoomVarsService,
        lxAppWideConstantsService)
    {

        /*
         Functionality for posting messages to the server.
         */
        return {
            sendMessage : function(messageType, messagePayload) {
                /*
                 messageType: string indicating if this is a Signaling message or some other kind of message
                 that is being sent over the Appengine Channel API.
                 Allowed values:
                 'sdp' - setting up peer to peer connection
                 'video' - sending video/images through the server
                 'chat' - chat messages sent through the server
                 messagePayload: an object containing data that will be send from one peer to another through the server.
                 Note: this data will be serialized automatically by AngularJS into a JSON object/string.
                 */

                var messageObject = {
                    'messageType': messageType,
                    'messagePayload': messagePayload
                };

                //$log.debug('C->S: ' + angular.toJson(messagePayload));
                // NOTE: AppRTCClient.java searches & parses this line; update there when
                // changing here.
                var path = '/_lx/message?r=' + lxChatRoomVarsService.roomId + '&u=' + lxAppWideConstantsService.userId;

                var httpPromise = $http.post(path, messageObject);
                return httpPromise;
            }
        };
    }
);
