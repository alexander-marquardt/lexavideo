/**
 * Created by alexandermarquardt on 2014-09-04.
 */



'use strict';

var lxSelectVideoTypePreferenceServices = angular.module('lxVideoNegotiation.services', []);


lxSelectVideoTypePreferenceServices.factory('lxSelectAndNegotiateVideoTypeService',
    function(
        $animate,
        $log,
        lxCallService,
        lxMessageService,
        lxStreamService)
    {

    var setVideoSignalingStatusForUserFeedback = function(scope) {

        for (var remoteClientId in scope.videoExchangeObjectsDict) {

            // if the user has not yet given access to their local stream, then this is the feedback message
            // that they will be shown.
            if (!lxStreamService.localStream) {
                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'mustEnableVideoToStartTransmission';
            }

            else if (scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting === 'waitingForEnableVideoExchangePermission') {
                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'waitingForRemoteToAgreeToExchangeVideo';
            }

            else if (scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting === 'doNotEnableVideoExchange') {
                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasDeniedToExchangeVideo';
            }

            // If remote user has activated their video elements then show the message that indicates that we are waiting
            // for access to their camera and microphone. This message will be removed when the onRemoteStreamAdded
            // call back is executed. Note: checking activateWindow just lets us know that the user has already
            // agreed to enable their video elements, and we infer that since we don't have a video stream yet, that the user has not
            // yet given access to their camera and microphone - this may have to be revisited in the future.
            else if (scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting === 'enableVideoExchange') {
                scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'remoteHasNotEnabledVideoYet';
            }

            // if the user has already given access to their local stream, then we can show them the
            // feedback that has been requested.
            else {
                $log.info('Not showing any feedback regarding client: ' + remoteClientId);
            }
        }
    };


    return  {


        /*
         This function will monitor the type of to see if each user has activated their video and if they are
         currently in the room.
         */
        watchForVideoSettingsChanges : function(scope) {

            // Watch to see if the user has given access to their camera/microphone (localStream), and if so
            // make sure that the user feedback is correct, and that the videoSignalingObject is updated to
            // reflect the new value.
            scope.$watch(lxStreamService.getLocalStream, function(localStream) {

                if (localStream) {

                    // If the user was being shown a message telling them to enable their video, then we can now remove
                    // this message.
                    if (scope.videoSignalingObject.videoSignalingStatusForUserFeedback === 'mustEnableVideoToStartTransmission') {
                        setVideoSignalingStatusForUserFeedback(scope);
                    }
                }
            });

            function watchRemoteVideoEnabledSettings(scope) {
                var concatenateRemoteVideoEnabledSettings = '';
                for (var remoteClientId in scope.videoExchangeObjectsDict) {
                    if (scope.videoExchangeObjectsDict.hasOwnProperty(remoteClientId)) {
                        concatenateRemoteVideoEnabledSettings +=
                            scope.videoExchangeObjectsDict[remoteClientId].remoteVideoEnabledSetting;
                    }
                }
                return concatenateRemoteVideoEnabledSettings;
            }

            // Monitor remoteVideoEnabledSetting to track if the remote user has activated
            // their video elements and requested access to their camera.
            scope.$watch(watchRemoteVideoEnabledSettings(scope), function() {

                // any change on the remoteVideoEnabledSetting should trigger a reloading of the notification.
                setVideoSignalingStatusForUserFeedback(scope);

            });
        }
    };
});

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