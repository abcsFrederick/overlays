import { apiRoot } from 'girder/rest';
import ImageViewerWidget from 'girder_plugins/large_image/views/imageViewerWidget/base';

var OverlayImageViewerWidget = ImageViewerWidget.extend({
    _getTileUrl: function (level, x, y, query, itemId) {
        if (itemId === null) {
            itemId = this.itemId;
        }
        var url = apiRoot + '/item/' + itemId + '/tiles/zxy/' +
            level + '/' + x + '/' + y;
        if (query) {
            url += '?' + $.param(query);
        }
        return url;
    },

    addOverlay: function (/* overlays */) {
        throw new Error('Viewer does not support adding overlays');
    },

    removeOverlay: function (/* overlays */) {
        throw new Error('Viewer does not support removing overlays');
    },

    setOverlayVisibility: function (/* overlays */) {
        throw new Error('Viewer does not support setting overlay visibilty');
    },

    moveOverlayDown: function (/* overlays */) {
        throw new Error('Viewer does not support moving overlays');
    },

    moveOverlayUp: function (/* overlays */) {
        throw new Error('Viewer does not support moving overlays');
    }
});

export default OverlayImageViewerWidget;
