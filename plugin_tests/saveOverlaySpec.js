girderTest.importPlugin('jobs');
girderTest.importPlugin('worker');
girderTest.importPlugin('large_image');
girderTest.importPlugin('slicer_cli_web');
girderTest.importPlugin('histogram');
girderTest.importPlugin('colormaps');
girderTest.importPlugin('HistomicsTK');
girderTest.importPlugin('overlays');

girderTest.startApp();

describe('Test the hierarchy save overlay modal', function () {
    describe('create overlay modal', function () {
        var view, params, itemId, testEl;

        it('create the admin user', girderTest.createUser('admin', 'admin@email.com', 'Admin', 'Admin', 'testpassword'));

        it('go to collections page', function () {
            runs(function () {
                $("a.g-nav-link[g-target='collections']").click();
            });

            waitsFor(function () {
                return $('.g-collection-create-button:visible').length > 0;
            }, 'navigate to collections page');

            runs(function () {
                expect($('.g-collection-list-entry').length).toBe(0);
            });
        });
        it('create collection', girderTest.createCollection('test', '', 'image'));

        it('upload test file', function () {
            girderTest.waitForLoad();
            runs(function () {
                $('.g-folder-list-link:first').click();
            });
            girderTest.waitForLoad();
            runs(function () {
                girderTest.binaryUpload('plugins/overlays/plugin_tests/test_files/Seg.tiff');
            });
            girderTest.waitForLoad();
            runs(function () {
                itemId = $('.large_image_thumbnail img').prop('src').match(/\/item\/([^/]*)/)[1];
            });
        });
        it('test create overlay', function () {
            testEl = $('<div/>').appendTo('body');
            params = {
                overlay: new girder.plugins.overlays.models.OverlayModel({itemId: itemId})
            };
            view = girder.plugins.overlays.dialogs.saveOverlay({
                overlay: params.overlay,
                el: testEl
            }, {title: 'test create overlay'}).render();
            expect(view.$('.modal-title').text()).toBe('test create overlay');
            expect(view.$('#g-root-selector').length).toBe(1);
            expect(view.$('#h-browser-container').css('display')).toBe('none');
            waitsFor(function () {
                return $(view.$el).is(':visible');
            });
            runs(function () {
                view.$('.h-open-image').click();
                expect(view.$('#h-browser-container').css('display')).toBe('block');
            });
        });
    });
});
