import _ from 'underscore';

import { apiRoot } from 'girder/rest';

import GeojsImageViewerWidget from 'girder_plugins/large_image/views/imageViewerWidget/geojs';

var OverlayGeojsImageViewerWidget = GeojsImageViewerWidget.extend({
    initialize: function (settings) {
        this._globalOverlaysOpacity = settings.globalOverlaysOpacity || 1.0;
        this._overlays = [];

        return GeojsImageViewerWidget.prototype.initialize.call(this, settings);
    },

    render: function () {
        var result = GeojsImageViewerWidget.prototype.render.call(this, arguments);
        if (window.geo && this.tileWidth && this.tileHeight && !this.deleted && !this.viewer) {
            this.setGlobalOverlayOpacity(this._globalOverlaysOpacity);
        }

        return result;
    },

    _getTileUrl: function (level, x, y, query, itemId) {
        itemId = itemId || this.itemId;
        var url = apiRoot + '/item/' + itemId + '/tiles/zxy/' + level + '/' + x + '/' + y;
        if (query) {
            url += '?' + $.param(query);
        }
        return url;
    },

    _setOverlayVisibility: function (index, visible, exclude) {
        if (visible === undefined || visible === null) {
            visible = this._overlays[index].overlay.get('displayed');
        }
        if (exclude === undefined || exclude === null) {
            exclude = this._overlays[index].overlay.get('exclude');
        }
        var updatedLayers = [];
        _.each(this._overlays[index].layers, (layer, bin) => {
            bin = parseInt(bin);
            var layerVisible = _.contains(exclude, bin) ? false : visible;
            if (layerVisible !== layer.visible()) {
                layer.visible(layerVisible);
                updatedLayers.push(bin);
            }
        });
        return updatedLayers;
    },

    _setOverlayLayerVisibility: function (index, layer, visible) {
        this._overlays[index].layers[layer].visible(this._overlays[index].overlay.get('displayed') ? visible : false);
    },

    _addOverlay: function (overlay) {
        var geo = window.geo;
        var index = overlay.get('index');

        var queries = [];
        var query = {};
        var threshold = overlay.get('threshold');
        var colormapId = overlay.get('colormapId');
        if (overlay.get('bitmask')) {
            threshold = threshold || {min: 0, max: 8};
            var i = Math.max(overlay.get('label') ? 1 : 0, threshold.min);
            for (; i <= threshold.max; i++) {
                query = { bitmaskChannel: i };
                if (colormapId) {
                    query['colormapId'] = colormapId;
                }
                queries.push(query);
            }
        } else {
            if (overlay.get('label')) {
                query['label'] = 1;
                if (!overlay.get('invertLabel')) {
                    query['invertLabel'] = 0;
                }
                if (overlay.get('flattenLabel')) {
                    query['flattenLabel'] = 1;
                }
            }
            if (threshold) {
                query['normalize'] = 1;
                if (threshold.min !== null) {
                    query['normalizeMin'] = threshold.min;
                }
                if (threshold.max !== null) {
                    query['normalizeMax'] = threshold.max;
                }
            }
            if (colormapId) {
                query['colormapId'] = colormapId;
            }
            queries.push(query);
        }

        this._overlays[index] = {
            overlay: overlay,
            layers: {}
        };

        var opacities = overlay.get('opacities') || [];

        _.each(queries, (query) => {
            var params = geo.util.pixelCoordinateParams(this.el, this.sizeX, this.sizeY, this.tileWidth, this.tileHeight);
            params.layer.useCredentials = true;
            // params.layer.keepLower = false;
            params.layer.url = this._getTileUrl('{z}', '{x}', '{y}', query, overlay.get('overlayItemId'));

            params.layer.visible = overlay.get('displayed') && !(overlay.get('exclude') && _.contains(overlay.get('exclude'), query.bitmaskChannel));
            var maxZoom = this.viewer.zoomRange().max;
            var offset = overlay.get('offset');
            params.layer.tileOffset = (level) => {
                var scale = Math.pow(2, level - maxZoom);
                return {x: -offset.x * scale, y: -offset.y * scale};
            };
            params.layer.renderer = 'canvas';
            var geojsLayer = this.viewer.createLayer('osm', params.layer);
            geojsLayer.name('overlay');
            geojsLayer.zIndex(this.featureLayer.zIndex());
            var bin = query.bitmaskChannel ? query.bitmaskChannel : 0;
            geojsLayer.opacity(this._globalOverlaysOpacity * overlay.get('opacity') * (opacities[bin] === undefined ? 1 : opacities[bin]));
            this._overlays[index].layers[bin] = geojsLayer;
        });

        this._setOverlayVisibility(index, overlay.get('displayed'));

        return index;
    },

    _removeOverlay: function (index) {
        _.each(this._overlays[index].layers, (layer) => {
            this.viewer.deleteLayer(layer);
        });
        delete this._overlays[index];
    },

    removeOverlay: function (overlay) {
        var index = overlay.get('index');
        if (_.has(this._overlays, index)) {
            this._removeOverlay(index);
            this.viewer.draw();
        }
    },

    // updateOverlay: function(overlay) {
    drawOverlay: function (overlay) {
        var index = overlay.get('index');
        if (_.has(this._overlays, index)) {
            this._removeOverlay(index);
        }
        index = this._addOverlay(overlay);
        this.redrawOverlay(index);
        return index;
    },

    redrawOverlay: function (index, layers) {
        if (layers) {
            _.each(layers, (layer) => {
                this._overlays[index].layers[layer].draw();
            });
        } else {
            _.each(this._overlays[index].layers, (layer) => { layer.draw(); });
        }
    },

    redrawOverlayLayer: function (index, layer) {
        this._overlays[index].layer[layer].draw();
    },

    setOverlayVisibility: function (index, visible) {
        var updatedLayers = this._setOverlayVisibility(index, visible);
        this.redrawOverlay(index, updatedLayers);
    },

    setOverlayLayerVisibility: function (index, layer, visible) {
        this._setOverlayVisibility(index, layer, visible);
        this.redrawOverlayLayer(index, layer);
    },

    moveOverlayDown: function (index) {
        var _overlay = this._overlays[index];
        var newIndex = _overlay.overlay.get('index');
        this._overlays[index] = this._overlays[newIndex];
        this._overlays[newIndex] = _overlay;
        _.each(_overlay.layers, (layer) => {
            layer.moveUp(this._overlays[index].layers.length);
        });
        this.viewer.draw();
    },

    moveOverlayUp: function (index) {
        var _overlay = this._overlays[index];
        var newIndex = _overlay.overlay.get('index');
        this._overlays[index] = this._overlays[newIndex];
        this._overlays[newIndex] = _overlay;
        _.each(_overlay.layers, (layer) => {
            layer.moveDown(this._overlays[index].layers.length);
        });
        this.viewer.draw();
    },

    getOverlayLayerValues: function (index, layers, x, y, width, height) {
        if (!this._overlays || !this._overlays[index]) {
            return $.when();
        }
        layers = layers || _.keys(this._overlays[index].layers);
        x = x || 0;
        y = y || 0;
        width = width || 1;
        height = height || 1;

        var opts = { background: false, wait: 'idle' };

        var promises = _.map(layers, (layerIndex) => {
            var layer = this._overlays[index].layers[layerIndex];
            return this.viewer.screenshot(layer, 'canvas', null, opts).then((canvas) => {
                return canvas.getContext('2d').getImageData(x, y, 1, 1).data;
            });
        });

        return $.when.apply($, promises).then(function () {
            var indexedValues = [];
            _.each(arguments, (value, i) => {
                indexedValues[layers[i]] = value;
            });
            return indexedValues;
        });
    },

    setGlobalAnnotationOpacity: function (opacity) {
        this._globalAnnotationOpacity = opacity;
        if (this.featureLayer) {
            this.featureLayer.opacity(opacity);
        }
        return this;
    },

    setGlobalOverlayOpacity: function (opacity) {
        this._globalOverlaysOpacity = opacity;
        _.each(this._overlays, (_overlay) => {
            if (!_overlay) {
                return;
            }
            var opacity = _overlay.overlay.get('opacity');
            var opacities = _overlay.overlay.get('opacities') || [];
            _.each(_overlay.layers, (layer, i) => {
                layer.opacity(this._globalOverlaysOpacity * opacity * (opacities[i] === undefined ? 1 : opacities[i]));
            });
        });

        if (this.viewer) {
            this.viewer.draw();
        }

        return this;
    },

    // setOverlayOpacity: function (index, opacity) {
    setOverlayOpacity: function (index) {
        var _overlay = this._overlays[index];
        var opacity = _overlay.overlay.get('opacity');
        var opacities = _overlay.overlay.get('opacities') || [];
        _.each(_overlay.layers, (layer, i) => {
            layer.opacity(this._globalOverlaysOpacity * opacity * (opacities[i] === undefined ? 1 : opacities[i]));
        });
        return this;
    },

    // setOverlayOpacities: function (index, opacities) {
    setOverlayOpacities: function (index) {
        var _overlay = this._overlays[index];
        var opacity = _overlay.overlay.get('opacity');
        var opacities = _overlay.overlay.get('opacities') || [];
        _.each(_overlay.layers, (layer, i) => {
            layer.opacity(this._globalOverlaysOpacity * opacity * (opacities[i] === undefined ? 1 : opacities[i]));
        });
        return this;
    }
});

export default OverlayGeojsImageViewerWidget;
