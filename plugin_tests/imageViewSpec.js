/* global overlaysTest */

girderTest.importPlugin('jobs');
girderTest.importPlugin('worker');
girderTest.importPlugin('large_image');
girderTest.importPlugin('slicer_cli_web');
girderTest.importPlugin('histogram');
girderTest.importPlugin('colormaps');
girderTest.importPlugin('HistomicsTK');
girderTest.importPlugin('overlays');

var app;
girderTest.addScript('/plugins/overlays/plugin_tests/common.js');

girderTest.promise.done(function () {
    app = overlaysTest.startApp();
});

describe('overlays tests', function () {
    describe('setup', function () {
        it('login', function () {
            overlaysTest.login();
        });

        it('open image', function () {
            overlaysTest.openImage('image');
        });
    });
});
