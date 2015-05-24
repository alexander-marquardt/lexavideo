'use strict';

angular.module('lxHttp.services', ['angular-jwt'])

    .factory('lxHttpRequestInterceptor', function(
        $window,
        $q,
        $rootScope) {
        return {
            'responseError': function(response) {

                if (response.status === 401) {

                    if ('invalidClientId' in response.data) {
                        delete $window.sessionStorage.clientId;
                        $rootScope.$broadcast('invalidClientId');
                    }

                    if ('invalidUserAuthToken' in response.data) {
                        delete $window.localStorage.token;
                        delete $window.sessionStorage.clientId;
                        $rootScope.$broadcast('invalidUserAuthToken');
                    }

                }
                return $q.reject(response);
            }
        }
    })

    .config(function Config($httpProvider, jwtInterceptorProvider) {

        jwtInterceptorProvider.tokenGetter = function() {
            return localStorage.getItem('token');
        };

        $httpProvider.interceptors.push('lxHttpRequestInterceptor');
        $httpProvider.interceptors.push('jwtInterceptor');
    })

    .factory('lxHttpHandleRoomService',
    function (
        $log,
        $http
        ) {


        return {
            createOrGetRoomOnServer : function(roomObj) {
                // this will either create a room object on the server, or enter into an existing room corresponding
                // to chatRoomName.
                // Note: the returned value is a promise that will be fulfilled once the resource
                // has been created on the server.
                var url = '/_lx/create_new_room_if_does_not_exist/';
                var httpPromise = $http.post(url, roomObj);
                return httpPromise;
            },


            checkIfRoomExists : function(chatRoomNameAsWritten) {

                var httpPromise = null;
                if (chatRoomNameAsWritten) {
                    var url = '/_lx/check_if_chat_room_exists/' + chatRoomNameAsWritten;
                    httpPromise = $http.get(url);
                }
                return httpPromise;
            }
        };
    })

    .factory('lxHttpHandleLoginService',
    function (
        $log,
        $http,
        $window,
        jwtHelper
        ) {


        return {

            checkIfUsernameAvailable : function(usernameAsWritten) {

                var httpPromise = null;
                if (usernameAsWritten) {
                    var url = '/_lx/check_if_username_available/' + usernameAsWritten;
                    httpPromise = $http.get(url);
                }
                return httpPromise;
            },


            loginUserOnServer: function(scope, usernameAsWritten) {
                var userObj = {usernameAsWritten: usernameAsWritten};
                var httpPromise = $http.post('/_lx/login_user/', userObj);
                httpPromise.success(function (data/*, status, headers, config */) {
                        $log.info('User ' + usernameAsWritten + ' successfully created with userId: ' + data.userId);
                        $window.localStorage.token = data.token;

                        var tokenPayload = jwtHelper.decodeToken(data.token);
                        scope.lxMainCtrlDataObj.userId = tokenPayload.userId;
                        scope.lxMainCtrlDataObj.usernameAsWritten = tokenPayload.usernameAsWritten;
                    })
                    .error(function (/*data, status, headers, config*/) {
                        // Erase the token if the user fails to log in
                        $log.error('User ' + usernameAsWritten + ' failed to be created');
                        delete $window.localStorage.token;
                    });
                return httpPromise;
            },

            createClientOnServer: function(clientId) {
                var clientObj = {clientId: clientId};
                var httpPromise = $http.post('/_lx/create_client_on_server/', clientObj);
                httpPromise.success(function (/*data, status, headers, config */) {
                        $log.info('client created on server for clientId: ' + clientId);
                    })
                    .error(function (/*data, status, headers, config*/) {
                        $log.error('clientId: ' + clientId + ' was not created');
                    });
                return httpPromise;
            }
        };
    })


    .factory('lxHttpChannelService',
    function (
        $http,
        $location,
        $log,
        lxJs
        ) {

        var self = {

            // In order to ensure that the channel is functioning, we periodically send the server "heartbeat"
            // messages.
            //
            // Heartbeat has three stages. 1st, the "syn" heartbeat is sent to the server. A "synAck" response from the
            // server is sent on the Channel and is expected with msToWaitForHeartbeatResponse milliseconds. Once
            // received, we know that connectivity is working in both directions (from client to server, and server
            // to client). We then send an "ack" response to the server,
            // along with the clients current presence, which will be updated in the servers data structures.


            // this function will be periodically called so that that room will be up-to-date with the users
            // that are currently in the room.
            sendSynHeartbeatToServer: function(clientId) {

                var messagePayload = {};

                var messageObject = {
                    'clientId': clientId,
                    'messageType': 'synHeartBeat', // use handshaking terminology for naming
                    'messagePayload': messagePayload
                };
                $http.post('/_lx/channel/syn_client_heartbeat/', messageObject);
            },


            // Update the users activity status on the server, to which the server will send an updated
            // list of clients (and their presence state) in the currently open chat room.
            updateClientStatusOnServerAndRequestUpdatedRoomInfo: function(clientId, presenceStatus, currentlyOpenChatRoomId, messageType) {

                var messagePayload = {
                    presenceStateName: presenceStatus.getCurrent().name,
                    currentlyOpenChatRoomId: currentlyOpenChatRoomId
                };

                var messageObject = {
                    'clientId': clientId,
                    'messageType': messageType,
                    'messagePayload': messagePayload
                };

                $http.post('/_lx/channel/update_client_status_and_request_updated_room_info/', messageObject);
            },

            // Once a "synchronization acknowledgement" has been received on the channel, we then send
            // a final "ack" to the server to let it know  that communications in both direction have been verified.
            sendAckHeartbeatToServer: function(clientId, presenceStatus, currentlyOpenChatRoomId) {
                self.updateClientStatusOnServerAndRequestUpdatedRoomInfo(clientId, presenceStatus, currentlyOpenChatRoomId, 'ackHeartbeat');
            },

            addClientToRoom: function(clientId, userId, chatRoomId) {
                lxJs.assert(clientId, 'clientId not set');
                lxJs.assert(userId, 'userId not set');
                lxJs.assert(chatRoomId, 'chatRoomId not set');

                var postData = {
                    'clientId': clientId,
                    'chatRoomId': chatRoomId
                };
                $http.post('/_lx/add_client_to_room/', postData);
            },

            tellServerClientChannelOpened: function(clientId) {
                var httpPromise = $http.post('/_lx/tell_server_client_channel_opened/', {'clientId': clientId});
                return httpPromise;
            },

            removeClientFromRoomOnServer: function(clientId, userId, chatRoomId) {
                var postData = {
                    'clientId': clientId,
                    'userId': userId,
                    'chatRoomId': chatRoomId
                };

                var httpPromise = $http.post('/_lx/remove_client_from_room/', postData);
                httpPromise.then(function() {
                    $log.info('Removed clientId: ' + clientId + ' from room: ' + chatRoomId);
                }, function(response) {
                    $log.error('Failed to remove client from room. clientId: ' + clientId +'\nStatus: ' + response.statusText +
                    '\ndata: ' + angular.toJson(response.data));
                });
                return httpPromise;
            },

            // Function that will initialize the channel and get the token from the server
            requestChannelToken: function(clientId, userId) {
                var postData = {
                    'clientId': clientId,
                    'userId': userId
                };
                var httpPromise = $http.post('/_lx/channel/request_channel_token/', postData);
                httpPromise.then(function(response){
                    $log.info('Got channel data: ' + response.data);
                }, function(response){
                    $log.error('Failed to open channel for client id: ' + clientId +'\nStatus: ' + response.statusText +
                    '\ndata: ' + angular.toJson(response.data));
                });

                return httpPromise;
            },

            manuallyDisconnectChannel: function(clientId, channelObject) {
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
                channelObject.socket.close();
            }
        };

        return self;
    })

    .factory('lxMessageService',
    function(
        $http,
        $log,
        lxChatRoomVarsService,
        lxJs)
    {

        /*
         Functionality for posting messages to the server.
         */
        return {
            broadcastMessageToRoomFn : function(messageType, messagePayload, fromClientId, chatRoomId) {
                /*
                 messageType: string indicating if this is a Signaling message or some other kind of message
                 that is being sent over the Appengine Channel API.
                 Allowed values:
                 'chat' - chat messages sent through the server
                 messagePayload: an object containing data that will be send from one peer to another through the server.
                 Note: this data will be serialized automatically by AngularJS into a JSON object/string.
                 */

                lxJs.assert(fromClientId, 'fromClientId is not set');
                lxJs.assert(chatRoomId, 'chatRoomId is not set');

                var messageObject = {
                    'chatRoomId': chatRoomId,
                    'fromClientId': fromClientId,
                    'messageType': messageType,
                    'messagePayload': messagePayload
                };

                var path = '/_lx/message_room';
                var httpPromise = $http.post(path, messageObject);
                return httpPromise;
            },

            sendMessageToClientFn : function(messageType, messagePayload, fromClientId, toClientId) {
                /*
                 messageType: string indicating if this is a Signaling message or some other kind of message
                 that is being sent over the Appengine Channel API.
                 Allowed values:
                 'sdp' - setting up peer to peer connection
                 'video' - sending video/images through the server
                 messagePayload: an object containing data that will be send from one peer to another through the server.
                 Note: this data will be serialized automatically by AngularJS into a JSON object/string.
                 */

                lxJs.assert(toClientId, 'toClientId is not set');
                lxJs.assert(fromClientId, 'fromClientId is not set');

                var messageObject = {
                    'fromClientId': fromClientId,
                    'toClientId': toClientId,
                    'messageType': messageType,
                    'messagePayload': messagePayload
                };

                //$log.debug('C->S: ' + angular.toJson(messagePayload));
                // NOTE: AppRTCClient.java searches & parses this line; update there when
                // changing here.
                var path = '/_lx/message_client';

                var httpPromise = $http.post(path, messageObject);
                return httpPromise;
            }
        };
    }
);
