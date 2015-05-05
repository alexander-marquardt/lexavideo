'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxShowMiniVideoElementDirective',
    function(
        $compile,
        lxAdapterService
        )
    {
        return {
            restrict : 'A',
            transclude: true,
            template: '<div ng-transclude></div>',
            link: function(scope, elem) {

                var clientId = scope.clientId;

                if (clientId === 'localVideoElement') {
                    elem.append(scope.localVideoObject.localMiniVideoElem);
                    lxAdapterService.reattachMediaStream(scope.localVideoObject.localMiniVideoElem, scope.localVideoObject.localMiniVideoElem);
                }
                // otherwise this is a remote video element.
                else {
                    var remoteVideoObject = scope.remoteVideoElementsDict[clientId];
                    elem.append(remoteVideoObject.remoteMiniVideoElem);
                    lxAdapterService.reattachMediaStream(remoteVideoObject.remoteMiniVideoElem, remoteVideoObject.remoteMiniVideoElem)
                }
            }
        };
    }
);


videoAppDirectives.directive('lxMainVideoElementDirective',
    function(
        lxAdapterService,
        lxPeerService,
        lxStreamService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {
                var html = '<video class="cl-video cl-video-sizing" autoplay="autoplay" muted="true"></video>';
                var videoElem = angular.element(html);
                var domVideoElem = videoElem[0];
                elem.append(videoElem);

                scope.$watch(
                    function() {
                        var videoStreamActive;
                        var selectedVideoElementId = scope.videoDisplaySelection.currentlySelectedVideoElementId;
                        if (selectedVideoElementId === 'localVideoElement') {
                            videoStreamActive = !!lxStreamService.localStream;
                        }
                        else {
                            videoStreamActive = !!lxPeerService.remoteStream[selectedVideoElementId];
                        }
                        return selectedVideoElementId + videoStreamActive.toString();
                    },
                    
                    function() {
                        var selectedVideoElementId = scope.videoDisplaySelection.currentlySelectedVideoElementId;

                        if (selectedVideoElementId === 'localVideoElement') {
                            lxAdapterService.reattachMediaStream(domVideoElem, scope.localVideoObject.localMiniVideoElem);
                        } else {
                            var remoteVideoObject = scope.remoteVideoElementsDict[selectedVideoElementId];
                            lxAdapterService.reattachMediaStream(domVideoElem, remoteVideoObject.remoteMiniVideoElem)
                        }
                    }
                );
            }
        };
    }
);





