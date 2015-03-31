/**
 * Created by alexandermarquardt on 2014-09-04.
 */



'use strict';

var lxSelectVideoTypePreferenceServices = angular.module('lxVideoNegotiation.services', []);


lxSelectVideoTypePreferenceServices.factory('lxAccessVideoElementsAndAccessCameraService',
    function(
        lxMessageService,
        lxJs
    ) {

        return {
            sendStatusOfVideoElementsEnabled: function(scope, localVideoElementsEnabled, toClientId) {

                /* localClientIsInitiatingVideoInformationExchange: If the client is initiating a request to start video, then we want
                 to know if the remote user has accepted the request. However, if the client is responding to
                 a remote request to start a video exchange, then we don't
                 want to request the remote user (who is the original initiator of the video exchange) to tell us if they
                 have accepted to transmit video, as doing so would cause circular requests and responses.
                 */

                lxJs.assert(toClientId, 'toClientId is not set');

                var messagePayload = {videoElementsEnabledAndCameraAccessRequested: localVideoElementsEnabled};
                lxMessageService.sendMessageToClientFn(
                    'videoExchangeStatusMsg',
                    messagePayload,
                    scope.lxMainViewCtrl.clientId,
                    toClientId
                );
            }
        };
    }
);