girderTest.startApp();

$(function () {
    describe('Test the overlays plugin', function () {
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
            var itemId, overlayItemId;
            var overlay;

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
                girder.rest.restRequest({
                    url: 'overlay',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        name: 'test overlay',
                        itemId: itemId,
                        overlayItemId: overlayItemId
                    })
                }).done(function (resp) {
                    overlay = resp;
                });
            });

            waitsFor(function () {
                return !!overlay;
            });
        });
    });
});
