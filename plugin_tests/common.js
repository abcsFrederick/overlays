(function (global) {
    var app;
    // var currentImageId;

    function startApp() {
        $('body').css('overflow', 'hidden');
        girder.router.enabled(false);
        girder.events.trigger('g:appload.before');
        girder.plugins.HistomicsTK.panels.DrawWidget.throttleAutosave = false;
        app = new girder.plugins.overlays.App({
            el: 'body',
            parentView: null
        });
        app.bindRoutes();
        girder.events.trigger('g:appload.after');
        return app;
    }
    function openImage(name) {
        var imageId;
        var deferred = $.Deferred();

        runs(function () {
            app.bodyView.once('h:viewerWidgetCreated', function (viewerWidget) {
                viewerWidget.once('g:beforeFirstRender', function () {
                    window.geo.util.mockWebglRenderer();
                });
            });
            $('.h-open-image').click();
        });

        girderTest.waitForDialog();

        runs(function () {
            $('#g-root-selector').val(
                girder.auth.getCurrentUser().id
            ).trigger('change');
        });

        waitsFor(function () {
            return $('#g-dialog-container .g-folder-list-link').length > 0;
        }, 'Hierarchy widget to render');

        runs(function () {
            $('.g-folder-list-link:contains("Public")').click();
        });

        waitsFor(function () {
            return $('.g-item-list-link').length > 0;
        }, 'item list to load');

        runs(function () {
            var $item = $('.g-item-list-link:contains("' + name + '")');
            imageId = $item.next().attr('href').match(/\/item\/([a-f0-9]+)\/download/)[1];
            expect($item.length).toBe(1);
            $item.click();
        });
        waitsFor(function () {
            return $('#g-selected-model').val();
        }, 'selection to be set');

        girderTest.waitForDialog();
        runs(function () {
            $('.g-submit-button').click();
        });

        girderTest.waitForLoad();
        waitsFor(function () {
            return $('.geojs-layer.active').length > 0;
        }, 'image to load');
        runs(function () {
            expect(girder.plugins.HistomicsTK.router.getQuery('image')).toBe(imageId);
            // currentImageId = imageId;
            deferred.resolve(imageId);
        });

        return deferred.promise();
    }
    function addOverlay(name) {
        var overlayImageId;
        var deferred = $.Deferred();
        runs(function () {
            $('.h-create-overlay').click();
        });

        girderTest.waitForDialog();

        runs(function () {
            $('#h-overlay-select').click();
            expect($('#h-overlay-select').is('[disabled=disabled]')).toBe(true);
            $('#g-root-selector').val(
                girder.auth.getCurrentUser().id
            ).trigger('change');
        });

        waitsFor(function () {
            return $('#g-dialog-container .g-folder-list-link').length > 0;
        }, 'Hierarchy widget to render');

        runs(function () {
            $('.g-folder-list-link:contains("Public")').click();
        });

        waitsFor(function () {
            return $('.g-item-list-link').length > 0;
        }, 'item list to load');

        runs(function () {
            var $item = $('.g-item-list-link:contains("' + name + '")');
            overlayImageId = $item.next().attr('href').match(/\/item\/([a-f0-9]+)\/download/)[1];
            expect($item.length).toBe(1);
            $item.click();
        });

        waitsFor(function () {
            return $('#h-overlay-item').val();
        }, 'selection to be set');

        girderTest.waitForDialog();
        runs(function () {
            $('.h-submit').click();
        });
        // girderTest.waitForLoad();
        waitsFor(function () {
            return $('.geojs-layer.active#overlay').length > 0;
        }, 'overlay to load');
        runs(function () {
            // expect(girder.plugins.HistomicsTK.router.getQuery('image')).toBe(imageId);
            // currentImageId = imageId;
            deferred.resolve(overlayImageId);
        });
    }
    function login(user, password) {
        girderTest.waitForLoad();
        runs(function () {
            $('.g-login').click();
        });

        girderTest.waitForDialog();
        runs(function () {
            $('#g-login').val(user || 'user');
            $('#g-password').val(password || 'password');
            $('#g-login-button').click();
        });

        waitsFor(function () {
            return $('.h-user-dropdown-link').length > 0;
        }, 'user to be logged in');
        girderTest.waitForLoad();
    }

    global.overlaysTest = {
        // waitsForPromise: waitsForPromise,
        startApp: startApp,
        openImage: openImage,
        // geojsMap: geojsMap,
        // imageId: imageId,
        addOverlay: addOverlay,
        login: login
    };
}(window));
