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
    var OriItemId, overlayItemId1, overlayItemId2, colorMapFileId;

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
        runs(function () {
            girderTest.binaryUpload('plugins/overlays/plugin_tests/test_files/Rainbow.json');
        });
        girderTest.waitForLoad();
        runs(function () {
            $('.g-item-list-entry:contains("Rainbow.json") .g-item-list-link').click();
        });
        girderTest.waitForLoad();
        runs(function () {
            colorMapFileId = $('.g-file-list-link').prop('href').match(/\/file\/([^/]*)/)[1];
        });
    });
    describe('Overlay selector panel', function () {
        var testEl, overlayModel1, overlayModel2, overlayCollection,
            overlaySelector, girderItemModel;
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
        it('test editOverlay overlay', function () {
            var ifcalls = false;
            overlaySelector.on('h:editOverlay', function () {
                ifcalls = !ifcalls;
            });
            runs(function () {
                $('[data-id=' + overlayModel1.id + '] .h-overlay-name').click();
            });
            waitsFor(function () {
                return ifcalls;
            }, 'wait for event h:editOverlay called.');
            ifcalls = false;
            runs(function () {
                $('[data-id=' + overlayModel1.id + '] .h-overlay-name').click();
            });
            waitsFor(function () {
                return !ifcalls;
            }, 'wait for event h:editOverlay will not be called.');
        });
        it('test move up/down overlays', function () {
            runs(function () {
                overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-move-overlay-down').click();
            });
            waitsFor(function () {
                return overlayCollection.at(0).id === overlayModel2.id;
            }, 'wait for overlay1 moves down and collection sorted.');

            runs(function () {
                overlaySelector.$('[data-id=' + overlayModel1.id + '] .h-move-overlay-up').click();
            });
            waitsFor(function () {
                return overlayCollection.at(0).id === overlayModel1.id;
            }, 'wait for overlay1 moves up and collection sorted.');
        });
        it('test edit overlay', function () {
            runs(function () {
                $('[data-id=' + overlayModel1.id + '] .h-edit-overlay').click();
            });
            girderTest.waitForDialog();
            waitsFor(function () {
                return $('.modal .modal-title').text() === 'Edit overlay';
            }, 'wait for edit dialog pops up.');
            runs(function () {
                $('.h-cancel').click();
            });
            girderTest.waitForLoad();
        });
        it('test delete overlay', function () {
            runs(function () {
                $('[data-id=' + overlayModel2.id + '] .h-delete-overlay').click();
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
            girderTest.waitForDialog();
            waitsFor(function () {
                return $('.modal .modal-title').text() === 'Create overlay';
            }, 'wait for Create overlay dialog pops up');
            runs(function () {
                $('.h-cancel').click();
            });
            girderTest.waitForLoad();
        });
    });

    describe('Overlay properties panel', function () {
        var testPropertiesEl, overlayModel1, overlayProperties;
        it('test create an overlay model', function () {
            runs(function () {
                testPropertiesEl = $('<div/>').appendTo('body');
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
                overlayProperties = new girder.plugins.overlays.panels.OverlayPropertiesWidget({
                    parentView: null,
                    overlay: overlayModel1,
                    el: testPropertiesEl
                });
                overlayProperties.setViewer('fake');
                overlayProperties.render();
            });
            waitsFor(function () {
                return overlayProperties.$('.s-panel-title-container').length === 1;
            }, 'properties panel rendered.');
        });
        it('test label check', function () {
            runs(function () {
                $('#h-overlay-label').prop('checked', !$('#h-overlay-label').is(':checked')).trigger('input');
            });
            waitsFor(function () {
                return overlayProperties.overlay.get('label') === $('#h-overlay-label').is(':checked');
            }, 'properties overlay label is set.');
            waitsFor(function () {
                return overlayProperties.overlay.get('label') === overlayProperties._histogramView.model.get('label');
            }, 'properties overlay label is set to histogram');
        });
        it('test invert label check', function () {
            runs(function () {
                $('#h-overlay-invert-label').prop('checked', !$('#h-overlay-invert-label').is(':checked')).trigger('input');
            });
            waitsFor(function () {
                return overlayProperties.overlay.get('invertLabel') === $('#h-overlay-invert-label').is(':checked');
            }, 'properties overlay invert label is set.');
        });
        it('test flatten label check', function () {
            runs(function () {
                $('#h-overlay-flatten-label').prop('checked', !$('#h-overlay-flatten-label').is(':checked')).trigger('input');
            });
            waitsFor(function () {
                return overlayProperties.overlay.get('flattenLabel') === $('#h-overlay-flatten-label').is(':checked');
            }, 'properties overlay flatten label is set.');
        });
        it('test bitmask check', function () {
            var hRedrawEvent = false;
            overlayProperties.on('h:redraw', function () {
                hRedrawEvent = !hRedrawEvent;
            });
            runs(function () {
                $('#h-overlay-bitmask-label').prop('checked', !$('#h-overlay-bitmask-label').is(':checked')).trigger('input');
            });
            waitsFor(function () {
                return overlayProperties.overlay.get('bitmask') === $('#h-overlay-bitmask-label').is(':checked');
            }, 'properties overlay bitmask is set.');
            runs(function () {
                expect(hRedrawEvent).toBe(true);
            });
        });
        it('test overlay opacity', function () {
            var hOverlayOpacityEvent = false;
            overlayProperties.on('h:overlayOpacity', function () {
                hOverlayOpacityEvent = !hOverlayOpacityEvent;
            });
            runs(function () {
                $('#h-overlay-opacity').val(0.39).trigger('input');
            });
            waitsFor(function () {
                return parseFloat(overlayProperties.overlay.get('opacity')) === 0.39;
            }, 'properties overlay opacity is set.');
            runs(function () {
                expect(hOverlayOpacityEvent).toBe(true);
            });
        });
        it('test overlay offset-x', function () {
            runs(function () {
                $('#h-overlay-offset-x').val(0.499).trigger('input');
            });
            waitsFor(function () {
                return parseFloat(overlayProperties.overlay.get('offset').x) === 0.499;
            }, 'properties overlay offset-x is set.');
        });
        it('test overlay offset-y', function () {
            runs(function () {
                $('#h-overlay-offset-y').val(0.599).trigger('input');
            });
            waitsFor(function () {
                return parseFloat(overlayProperties.overlay.get('offset').y) === 0.599;
            }, 'properties overlay offset-y is set.');
        });
        it('test overlay colormap set', function () {
            var xhr, colorMapId;
            runs(function () {
                xhr = girder.rest.restRequest({
                    url: 'colormap/file/' + colorMapFileId,
                    method: 'POST'
                }).done(function () {
                    colorMapId = xhr.responseJSON._id;
                });
            });
            waitsFor(function () {
                return colorMapId !== undefined;
            }, 'colormap is successfully register');
            runs(function () {
                overlayProperties.overlay.set('colormapId', colorMapId).save();
            });
            waitsFor(function () {
                return overlayProperties._histogramView.colormap !== null;
            }, 'colormap is successfully register to histogram');
            runs(function () {
                expect(overlayProperties._histogramView.colormap[0][0]).toBe(255);
                expect(overlayProperties._histogramView.colormap[33][1]).toBe(97);
            });
        });
    });
});
