'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxMiniVideoElementDirective',
    function()
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {
                var e;
                var clientId = scope.clientId;

                 if (clientId === 'localVideoElement') {
                    elem.append(scope.localVideoObject.localSmallVideoElem);
                }
                // otherwise this is a remote video element.
                else {
                    elem.append(scope.remoteMiniVideoElementsDict[clientId].remoteMiniVideoElem);
                }
//
//
//
//                scope.$on('$destroy', function() {
//                    if (clientId === 'localVideoElement') {
//                        scope.localVideoObject.localSmallVideoElem = null;
//                    }
//                    else {
//                        delete scope.remoteMiniVideoElementsDict[clientId];
//                    }
//                });
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
                                videoStreamActive = !!lxStreamService.localStream;
                            }
                            else {
                                videoStreamActive = !!lxPeerService.remoteStream[selectedVideoElement];
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





