girderTest.importPlugin('jobs');
girderTest.importPlugin('worker');
girderTest.importPlugin('large_image');
girderTest.importPlugin('slicer_cli_web');
girderTest.importPlugin('histogram');
girderTest.importPlugin('colormaps');
girderTest.importPlugin('HistomicsTK');
girderTest.importPlugin('overlays');

girderTest.startApp();

$(function () {
    describe('Test the overlays plugin', function () {
        var overlayId, overlay;
        var itemId, overlayItemId;

        it('create the admin user', girderTest.createUser('admin', 'admin@email.com', 'Admin', 'Admin', 'testpassword'));

        it('go to the collections page', function () {
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

        it('create test collection', function () {
            girderTest.createCollection('test collection', 'A test collection', 'test images')();
            runs(function () {
                $('.g-folder-list-link:first').click();
            });
            girderTest.waitForLoad();
        });

        it('create a test overlay', function () {
            var folderId = Backbone.history.fragment.split('/').pop();
            var testOverlay;
            var done;

            runs(function () {
                girder.rest.restRequest({
                    url: 'item',
                    method: 'POST',
                    data: {
                        name: 'test item',
                        folderId: folderId
                    }
                }).done(function (resp) {
                    itemId = resp._id;
                });
            });

            waitsFor(function () {
                return !!itemId;
            }, 'simulated binary upload to finish');

            runs(function () {
                girder.rest.restRequest({
                    url: 'item',
                    method: 'POST',
                    data: {
                        name: 'test overlay item',
                        folderId: folderId
                    }
                }).done(function (resp) {
                    overlayItemId = resp._id;
                });
            });

            waitsFor(function () {
                return !!overlayItemId;
            }, 'simulated binary upload to finish');

            runs(function () {
                testOverlay = new girder.plugins.overlays.models.OverlayModel({
                    name: 'test overlay',
                    itemId: itemId,
                    overlayItemId: overlayItemId
                });

                testOverlay.save().done(function (resp) {
                    expect(testOverlay.id).toBeDefined();
                    overlayId = testOverlay.id;
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            });
        });

        it('fetch the test overlay', function () {
            var done;

            runs(function () {
                overlay = new girder.plugins.overlays.models.OverlayModel({
                    _id: overlayId
                });

                overlay.fetch().done(function (resp) {
                    expect(resp._id).toEqual(overlayId);
                    expect(overlay.get('itemId')).toEqual(itemId);
                    expect(overlay.get('overlayItemId')).toEqual(overlayItemId);
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            });
        });

        it('fetch the test overlay collection by item', function () {
            var done;

            runs(function () {
                var overlays = new girder.plugins.overlays.collections.OverlayCollection();
                overlays.fetch({
                    itemId: itemId
                }).done(function () {
                    expect(overlays.length).toEqual(1);
                    overlay = overlays.pop();
                    expect(overlay.get('_id')).toEqual(overlayId);
                    expect(overlay.get('itemId')).toEqual(itemId);
                    expect(overlay.get('overlayItemId')).toEqual(overlayItemId);
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            });
        });

        it('update the test overlay', function () {
            var newName = 'renamed test overlay';
            var done;

            runs(function () {
                overlay.set({name: newName});
                overlay.save().done(function (resp) {
                    expect(resp._id).toEqual(overlayId);
                    expect(resp.itemId).toEqual(itemId);
                    expect(resp.overlayItemId).toEqual(overlayItemId);
                    expect(resp.name).toEqual(newName);
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            });
        });

        it('destroy the test overlay', function () {
            var done;

            runs(function () {
                overlay.destroy().done(function (resp) {
                    done = true;
                });
            });

            waitsFor(function () {
                return done;
            });
        });
    });
});
