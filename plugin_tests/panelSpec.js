girderTest.importPlugin('jobs');
girderTest.importPlugin('worker');
girderTest.importPlugin('large_image');
girderTest.importPlugin('slicer_cli_web');
girderTest.importPlugin('histogram');
girderTest.importPlugin('colormaps');
girderTest.importPlugin('HistomicsTK');
girderTest.importPlugin('overlays');

girderTest.startApp();

describe('Test overlay panels', function () {
    describe('Overlay selector panel', function () {
        var OriItemId, overlayItemId1, overlayItemId2, testEl,
            overlayModel1, overlayModel2, overlayCollection,
            overlaySelector, girderItemModel;

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
                girderTest.binaryUpload('plugins/overlays/plugin_tests/test_files/Seg2.tiff');
                girderTest.binaryUpload('plugins/overlays/plugin_tests/test_files/Ori.tiff');
            });
            girderTest.waitForLoad();
            runs(function () {
                overlayItemId1 = $('.g-item-list-entry:contains("Seg1.tiff") .large_image_thumbnail img').prop('src').match(/\/item\/([^/]*)/)[1];
                overlayItemId2 = $('.g-item-list-entry:contains("Seg2.tiff") .large_image_thumbnail img').prop('src').match(/\/item\/([^/]*)/)[1];
                OriItemId = $('.g-item-list-entry:contains("Ori.tiff") .large_image_thumbnail img').prop('src').match(/\/item\/([^/]*)/)[1];
            });
        });
        it('test create overlay collections', function () {
            runs(function () {
                testEl = $('<div/>').appendTo('body');
                overlayModel1 = new girder.plugins.overlays.models.OverlayModel();
                overlayModel1.set({
                    itemId: OriItemId,
                    name: 'test1',
                    description: 'test1',
                    overlayItemId: overlayItemId1
                }).save();
            });

            waitsFor(function () {
                return overlayModel1.id;
            }, 'test overlay1 created');

            runs(function () {
                overlayModel2 = new girder.plugins.overlays.models.OverlayModel();
                overlayModel2.set({
                    itemId: OriItemId,
                    name: 'test2',
                    description: 'test2',
                    overlayItemId: overlayItemId2
                }).save();
            });

            waitsFor(function () {
                return overlayModel2.id;
            }, 'test overlay2 created');

            runs(function () {
                overlayCollection = new girder.plugins.overlays.collections.OverlayCollection();
                overlayCollection.add([overlayModel1, overlayModel2]);

                overlaySelector = new girder.plugins.overlays.panels.OverlaySelector({
                    parentView: null,
                    collection: overlayCollection,
                    el: testEl
                });
                overlaySelector.setViewer('fake');
                overlaySelector.render();
            });

            waitsFor(function () {
                return overlaySelector.$('.s-panel-title-container').length === 1;
            }, 'selector panel rendered.');

            runs(function () {
                var overlay1Text = overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-overlay-name').text();
                var overlay2Text = overlaySelector.$('[data-id=' + overlayModel2.id + '] .h-overlay-name').text();
                expect(overlay1Text).toBe('test1');
                expect(overlay2Text).toBe('test2');
            });
        });
        it('test toggle overlay', function () {
            runs(function () {
                $('[data-id=' + overlayModel1.id + '] .h-toggle-overlay').click();
            });
            waitsFor(function () {
                return overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-toggle-overlay').attr('data-original-title') === 'Show overlay';
            }, 'wait for display eye icon turns off.');
            runs(function () {
                expect(overlayModel1.get('displayed')).toBe(false);
            });
        });
        it('test show/hide all overlays', function () {
            runs(function () {
                overlaySelector.$('.h-hide-all-overlays').click();
            });
            waitsFor(function () {
                return overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-toggle-overlay').attr('data-original-title') === 'Show overlay' &&
                       overlaySelector.$('[data-id=' + overlayModel2.id + '] .h-toggle-overlay').attr('data-original-title') === 'Show overlay';
            }, 'wait for all display eye icon turns off.');
            runs(function () {
                expect(overlayModel1.get('displayed')).toBe(false);
                expect(overlayModel2.get('displayed')).toBe(false);
            });
            runs(function () {
                overlaySelector.$('.h-show-all-overlays').click();
            });
            waitsFor(function () {
                return overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-toggle-overlay').attr('data-original-title') === 'Hide overlay' &&
                       overlaySelector.$('[data-id=' + overlayModel2.id + '] .h-toggle-overlay').attr('data-original-title') === 'Hide overlay';
            }, 'wait for all display eye icon turns on.');
            runs(function () {
                expect(overlayModel1.get('displayed')).toBe(true);
                expect(overlayModel2.get('displayed')).toBe(true);
            });
        });
        it('test move up/down overlays', function () {
            // var overlayModel1Index;
            runs(function () {
                overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-move-overlay-down').click();
            });
            waitsFor(function () {
                return overlayCollection.at(0).id === overlayModel2.id;
            }, 'wait for overlay1 moves down and collection sorted.');
            // runs(function () {
            //     console.log('overlay1 move down, 1 index ' + overlayModel1.get('index'));
            //     console.log('overlay1 move down, 2 index ' + overlayModel2.get('index'));
            //     overlayModel1Index = overlayModel1.get('index');
            //     // overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-move-overlay-down').click();
            // });
            // waitsFor(function () {
            //     console.log('overlay1 move down again, 1 index ' + overlayModel1.get('index'));
            //     console.log('overlay1 move down again, 2 index ' + overlayModel2.get('index'));
            //     return overlayModel1.get('index') === 5;
            // }, 'overlay1 stay the same.');

            runs(function () {
                overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-move-overlay-up').click();
            });
            waitsFor(function () {
                return overlayCollection.at(0).id === overlayModel1.id;
            }, 'wait for overlay1 moves up and collection sorted.');
            // runs(function () {
            //     overlayModel1Index = overlayModel1.get('index');
            //     overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-move-overlay-up').click();
            // });
            // waitsFor(function () {
            //     return overlayModel1.get('index') === overlayModel1Index;
            // }, 'overlay1 stay the same.');
        });
        it('test edit overlay', function () {
            runs(function () {
                $('[data-id=' + overlayModel1.id + '] .h-edit-overlay').click();
            });
            girderTest.waitForDialog();
            waitsFor(function () {
                return $('.modal .modal-title').text() === 'Edit overlay';
            }, 'wait for edit dialog pops up.');
        });
        it('test delete overlay', function () {
            runs(function () {
                $('[data-id=' + overlayModel1.id + '] .h-delete-overlay').click();
            });
            girderTest.waitForDialog();
            waitsFor(function () {
                return $('.modal .modal-title').text() === 'Warning';
            }, 'wait for Warning dialog pops up.');
            runs(function () {
                $('.h-submit').click();
            });
            waitsFor(function () {
                return overlayCollection.length === 1;
            }, 'wait for overlayCollection update.');
        });
        it('test create new overlay on parent Item', function () {
            runs(function () {
                girderItemModel = new girder.models.ItemModel();
                girderItemModel.set('_id', OriItemId).fetch();
            });
            waitsFor(function () {
                return girderItemModel.id;
            }, 'test parent Item fetched created');
            runs(function () {
                overlaySelector.setItem(girderItemModel);
            });
            waitsFor(function () {
                return overlaySelector.parentItem.id;
            }, 'test parent Item id created');
            runs(function () {
                $('.h-create-overlay').click();
            });
            waitsFor(function () {
                return $('.modal .modal-title').text() === 'Create overlay';
            }, 'wait for Create overlay dialog pops up');
        });
    });

    describe('Overlay properities panel', function () {

    });
});
