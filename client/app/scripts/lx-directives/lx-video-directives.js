'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxMiniVideoElementDirective',
    function(
        $log,
        lxAdapterService,
        lxCallService,
        lxCreateChatRoomObjectsService,
        lxPeerService,
        lxStreamService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem, attrs) {
                var e;
                var clientId = scope.clientId;

                 if (clientId === 'localVideoElement') {
                    if (!scope.localVideoObject.localSmallVideoElem) {
                        e = angular.element('<video class="cl-video cl-mini-video-sizing" autoplay="autoplay" muted="true"></video>');
                        scope.localVideoObject.localSmallVideoElem = e[0];
                        elem.append(e);

                        // since the ng-repeat will remove and then re-insert these elements into the DOM
                        // we need to check if the localStream has already been setup.
                        if (lxStreamService.localStream) {
                            lxAdapterService.attachMediaStream(e[0], lxStreamService.localStream);
                        }
                    }
                }
                // otherwise this is a remote video element.
                else {
                    // only create the video element if it doesn't already exist.
                    if (!(clientId in scope.remoteMiniVideoElementsDict)) {
                        e = angular.element('<video class="cl-video cl-mini-video-sizing" autoplay="autoplay"></video>');
                        scope.remoteMiniVideoElementsDict[clientId] = lxCreateChatRoomObjectsService.createRemoteVideoElementsObject(e[0]);
                        elem.append(e);

                        // Check if the remote stream is already setup for this clientId, and if so
                        // attach it to the mini-video element. This will happen for existing video elements
                        // when we add a new video element. This happens because
                        // the surrounding ng-repeat directive thinks that the entire
                        // mini-video elements array has changed and removes and
                        // then re-inserts each video element.
                        if (clientId in lxPeerService.remoteStream) {
                            lxAdapterService.attachMediaStream(e[0], lxPeerService.remoteStream[clientId]);
                        }
                    }
                }



                scope.$on('$destroy', function() {
                    if (clientId === 'localVideoElement') {
                        scope.localVideoObject.localSmallVideoElem = null;
                    }
                    else {
                        delete scope.remoteMiniVideoElementsDict[clientId];
                    }
                });
            }
        };
    }
);


videoAppDirectives.directive('lxDisplayVideoElementDirective',
    function(
        $log,
        lxAdapterService,
        lxPeerService,
        lxStreamService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem, attrs) {

                scope.$watch(
                    function() {
                        var selectedVideoElement = attrs.selectedVideoElement;
                        var videoStreamActive;
                        try {
                            if (selectedVideoElement === 'localVideoElement') {
                                videoStreamActive = lxStreamService.localStream.active;
                            }
                            else {
                                videoStreamActive = lxPeerService.remoteStream[selectedVideoElement].active;
                            }
                        }
                        catch(err) {
                            videoStreamActive = false;
                        }
                        return selectedVideoElement + videoStreamActive.toString();
                    },
                    function() {
                        var e;
                        var selectedVideoElement = attrs.selectedVideoElement;

                        elem.empty();

                        e = angular.element('<video class="cl-video cl-video-sizing" autoplay="autoplay" muted="true"></video>');
                        if (selectedVideoElement === 'localVideoElement') {
                            lxAdapterService.attachMediaStream(e[0], lxStreamService.localStream);
                        }
                        else {
                            lxAdapterService.attachMediaStream(e[0], lxPeerService.remoteStream[selectedVideoElement]);
                        }
                        elem.append(e);
                    }
                );
            }
        };
    }
);





