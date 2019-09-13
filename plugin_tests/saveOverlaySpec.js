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
        var view, params, itemId, testEl, itemModel;

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
                girderTest.binaryUpload('plugins/overlays/plugin_tests/test_files/Seg1.tiff');
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
            var ncalls = 0;
            view.on('g:submit', function (model) {
                ncalls += 1;
            });
            waitsFor(function () {
                return $(view.$el).is(':visible');
            });
            runs(function () {
                view.$('.h-open-image').click();
                expect(view.$('#h-browser-container').css('display')).toBe('block');
            });
            runs(function () {
                $('#h-overlay-name').val('');
                $('.h-submit').click();
                expect($('.g-validation-failed-message').text()).toBe('Please enter a name.');
            });
            runs(function () {
                $('#h-overlay-name').val('testing');
                $('.h-submit').click();
                expect($('.g-validation-failed-message').text()).toBe('Please select a "large image" item for the overlay.');
            });
            runs(function () {
                $('#h-overlay-name').val('testing');
                itemModel = new girder.models.ItemModel();
                itemModel.set('_id', itemId).fetch();
            });
            waitsFor(function () {
                return itemModel.get('name') === 'Seg1.tiff';
            }, 'itemModel is defined');
            runs(function () {
                view._selectOverlayItem(itemModel);
                $('.h-submit').click();
            });
            waitsFor(function () {
                return !$(view.$el).is(':visible');
            });
            runs(function () {
                expect(ncalls).toBe(1);
            });
        });
    });
});
