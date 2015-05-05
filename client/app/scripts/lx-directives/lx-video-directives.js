'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxShowMiniVideoElementDirective',
    function(
        lxAdapterService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {

                var clientId = scope.clientId;

                if (clientId === 'localVideoElement') {
                    elem.html(scope.localVideoObject.localMiniVideoElem);
                    lxAdapterService.reattachMediaStream(scope.localVideoObject.localMiniVideoElem, scope.localVideoObject.localMiniVideoElem);
                }
                // otherwise this is a remote video element.
                else {
                    var remoteVideoObject = scope.remoteVideoElementsDict[clientId];
                    elem.html(remoteVideoObject.remoteMiniVideoElem);
                    lxAdapterService.reattachMediaStream(remoteVideoObject.remoteMiniVideoElem, remoteVideoObject.remoteMiniVideoElem)
                }
            }
        };
    }
);


videoAppDirectives.directive('lxAttachStreamToVideoElementDirective',
    function(
        lxAdapterService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {
                var videoElem = elem.find('video')[0];
                scope.$watch('videoDisplaySelection.currentlySelectedVideoElementId',
                    function(selectedVideoElementId) {
                        if (selectedVideoElementId === 'localVideoElement') {
                            lxAdapterService.reattachMediaStream(videoElem, scope.localVideoObject.localMiniVideoElem);
                        } else {
                            var remoteVideoObject = scope.remoteVideoElementsDict[selectedVideoElementId];
                            lxAdapterService.reattachMediaStream(videoElem, remoteVideoObject.remoteMiniVideoElem)
                        }
                    }
                );
            }
        };
    }
);





