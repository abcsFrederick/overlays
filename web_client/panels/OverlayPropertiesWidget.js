import _ from 'underscore';

import { restRequest } from 'girder/rest';

import Panel from 'girder_plugins/slicer_cli_web/views/Panel';
import HistogramModel from 'girder_plugins/histogram/models/HistogramModel';
import HistogramCollection from 'girder_plugins/histogram/collections/HistogramCollection';
import HistogramWidget from 'girder_plugins/histogram/views/widgets/histogramWidget';
import ColormapModel from 'girder_plugins/colormaps/models/ColormapModel';
import ColormapSelectorWidget from 'girder_plugins/colormaps/views/widgets/colormapSelectorWidget';

import overlayPropertiesWidget from '../templates/panels/overlayPropertiesWidget.pug';
import '../stylesheets/panels/overlayPropertiesWidget.styl';

var OverlayPropertiesWidget = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'input #h-overlay-label': function (e) {
            // if (this._histogramView.model.get('loading')) {
            //     $(e.target).prop('checked', !$(e.target).prop('checked'));
            // } else {
            this.overlay.set('label', $(e.target).is(':checked')).save();
            // }
        },
        'input #h-overlay-invert-label': function (e) {
            this.overlay.set('invertLabel', $(e.target).is(':checked')).save();
        },
        'input #h-overlay-flatten-label': function (e) {
            this.overlay.set('flattenLabel', $(e.target).is(':checked')).save();
        },
        'input #h-overlay-bitmask-label': function (e) {
            // if (this._histogramView.model.get('loading')) {
            //     $(e.target).prop('checked', !$(e.target).prop('checked'));
            // } else {
            this.overlay.set('bitmask', $(e.target).is(':checked')).save();
            // }
        },
        'input #h-overlay-opacity': function (e) {
            var opacity = this.$('#h-overlay-opacity').val();
            var text = `Opacity ${(opacity * 100).toFixed()}%`;
            this.$('#h-overlay-opacity-label').text(text);
            this.overlay.set('opacity', opacity).save();
        },
        'input #h-overlay-offset-x': function (e) {
            var offset = this.overlay.get('offset');
            this.overlay.set('offset', {x: e.target.valueAsNumber, y: offset.y}).save();
        },
        'input #h-overlay-offset-y': function (e) {
            var offset = this.overlay.get('offset');
            this.overlay.set('offset', {x: offset.x, y: e.target.valueAsNumber}).save();
        }
    }),

    initialize(settings) {
        this.viewer = settings.viewer;
        this.overlay = settings.overlay;
        /*
        this.listenTo(this.viewer, 'h:pixel-value', (value) => {
            _.each(this._histogramView.colormap.get('colormap'),
                      (color, i) => {
                if (value.r === color[0] && value.g === color[1] &&
                        value.b === color[2]) {
                    console.log(i);
                }
            });
            console.log(value);
        });
         */
        this.listenTo(this.overlay, 'change:opacity', this._setOverlayOpacity);
        this.listenTo(this.overlay, 'change:opacities', this._setOverlayOpacities);
        this.listenTo(this.overlay, 'change:colormapId', (evt) => {
            this._setColormapId(evt.get('colormapId'));
        });
        this.listenTo(
            this.overlay,
            'change:threshold change:offset change:label change:invertLabel ' +
            'change:flattenLabel change:bitmask change:overlayItemId ' +
            'change:colormapId change:thresholdBit',
            (model) => { this.trigger('h:redraw', model); }
        );
        this.listenTo(
            this.overlay,
            'change:overlayItemId change:label change:bitmask',
            this._getOrCreateHistogram
        );
        this.listenTo(this, 'h:active-overlay-value', this._onActiveOverlay);

        this._getOrCreateHistogram(this.overlay);
        this._setColormapId(this.overlay.get('colormapId'));
    },

    render() {
        if (!this.viewer) {
            this.$el.empty();
            return;
        }
        const name = this.overlay.get('name');
        this.$el.html(overlayPropertiesWidget({
            title: 'Properties',
            label: this.overlay.get('label'),
            invertLabel: this.overlay.get('invertLabel'),
            flattenLabel: this.overlay.get('flattenLabel'),
            bitmask: this.overlay.get('bitmask'),
            opacity: this.overlay.get('opacity'),
            offset: this.overlay.get('offset'),
            name
        }));
        this.$('.s-panel-content').collapse({toggle: false});
        this.$('[data-toggle="tooltip"]').tooltip({container: 'body'});

        this.colormapSelector = new ColormapSelectorWidget({
            parentView: this,
            el: this.$('#h-overlay-colormap-selector'),
            colormapId: this.overlay.get('colormapId')
        }).render();
        this.colormapSelector.on('g:selected', (colormap) => {
            if (colormap) {
                this.overlay.set('colormapId', colormap.id).save();
            } else {
                this.overlay.set('colormapId', null).save();
            }
        });

        this._renderHistogram();

        return this;
    },

    _getOrCreateHistogram(overlay) {
        restRequest({
            type: 'GET',
            url: 'histogram/settings'
        }).done((resp) => {
            let bin = resp['histogram.default_bins'];
            var attributes = {
                itemId: overlay.get('overlayItemId'),
                label: overlay.get('label'),
                bitmask: overlay.get('bitmask'),
                bins: overlay.get('bitmask') ? 8 : bin
            };
            var histogramCollection = new HistogramCollection();
            histogramCollection.fetch(Object.assign({
                limit: 2
            }, attributes)).done(() => {
                if (histogramCollection.models.length) {
                    attributes = histogramCollection.pop().attributes;
                    this._histogramView.model.set(attributes);
                } else {
                    this._histogramView.model.set(Object.assign({
                        _id: undefined,
                        fileId: undefined,
                    }, attributes)).save();
                }
                this._histogramView.threshold = overlay.get('bitmask') ? overlay.get('thresholdBit') : overlay.get('threshold');
            }).fail((error) => {
                console.log(error);
            });
        });
    },
    // ToDo threshold default value
    _renderHistogram() {
        if (this._histogramView) {
            this.stopListening(this._histogramView);
            this._histogramView.off();
            this.$('.h-histogram-widget-container').empty();
        }
        this._histogramView = new HistogramWidget({
            el: this.$('.h-histogram-widget-container'),
            model: new HistogramModel({
                label: this.overlay.get('label'),
                bitmask: this.overlay.get('bitmask')
            }),
            parentView: this,
            colormap: this.colormap ? this.colormap.get('colormap') : null,
            threshold: this.overlay.get('bitmask') ? this.overlay.get('thresholdBit') : this.overlay.get('threshold')
            /*
            colormapId: this.overlay.get('colormapId'),
            threshold: this.overlay.get('threshold'),
            opacities: this.overlay.get('opacities')
             */
        }).render();
        this.listenTo(this._histogramView, 'h:histogramRender', function (evt) {
            this.trigger('h:histogramRender');
        });
        this.listenTo(this._histogramView, 'h:range', function (evt) {
            if (!this.overlay.get('bitmask')) {
                this.overlay.set('threshold', evt.range).save();
            } else {
                this.overlay.set('thresholdBit', evt.range).save();
            }
        });

        this.listenTo(this._histogramView, 'h:opacities', function (evt) {
            this.overlay.set('opacities', evt.opacities).save();
        });

        this.listenTo(this._histogramView, 'h:excludeBins', function (evt) {
            // debugger
            this.trigger('h:overlayExcludeBins', {
                index: this.overlay.get('index'),
                exclude: _.map(evt.value, (v) => {
                    return v + this.overlay.get('label');
                })
            });
        });
    },

    setViewer(viewer) {
        this.viewer = viewer;
        return this;
    },

    _setOverlayOpacity(overlay, value) {
        this.trigger('h:overlayOpacity', {
            index: overlay.get('index'),
            opacity: value
        });
    },

    _setOverlayOpacities(overlay, value) {
        this.trigger('h:overlayOpacities', {
            index: overlay.get('index'),
            opacities: value
        });
    },

    _onActiveOverlay(evt) {
        if (!this._histogramView || !this._histogramView.colormap ||
            !this._histogramView.model.get('bitmask')) {
            return;
        }

        var labels = this._histogramView.colormap.get('labels');
        if (!labels) {
            return;
        }

        var colormap = this._histogramView.colormap.get('colormap');

        function labelValues(value) {
            var label = { text: labels[value] };
            if (colormap) {
                label.color = colormap[value];
            }
            return label;
        }

        var overlayLabels = { labels: _.map(evt.values, labelValues) };

        this.trigger('h:overlayLabels', overlayLabels);
    },

    _setColormapId(colormapId) {
        if (colormapId) {
            this.colormap = new ColormapModel({
                _id: colormapId,
                loading: true
            });
            this.colormap.fetch().done((value) => {
                if (this._histogramView) {
                    this._histogramView.setColormap(value['colormap']);
                }
                this.colormap.unset('loading');
            });
        } else {
            this.colormap = null;
            if (this._histogramView) {
                this._histogramView.setColormap();
            }
        }
    }
});

export default OverlayPropertiesWidget;
