import _ from 'underscore';

import { restRequest } from 'girder/rest';
import { getCurrentUser } from 'girder/auth';
import FolderCollection from 'girder/collections/FolderCollection';
import UploadWidget from 'girder/views/widgets/UploadWidget';
import { handleClose } from 'girder/dialog';

import FileModel from 'girder/models/FileModel';
import ItemModel from 'girder/models/ItemModel';

import Panel from 'girder_plugins/slicer_cli_web/views/Panel';

import HistogramModel from 'girder_plugins/histogram/models/HistogramModel';
import HistogramWidget from 'girder_plugins/histogram/views/widgets/histogramWidget';

import ColormapCollection from 'girder_plugins/colormaps/collections/ColormapCollection';
import colormapSelectorWidget from 'girder_plugins/colormaps/templates/panels/colormapSelectorWidget.pug';
import 'girder_plugins/colormaps/stylesheets/panels/colormapSelectorWidget.styl';

import overlayPropertiesWidget from '../templates/panels/overlayPropertiesWidget.pug';
import '../stylesheets/panels/overlayPropertiesWidget.styl';

var OverlayPropertiesWidget = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'input #h-overlay-label': function (e) {
            if (this._histogramView.model.get('loading')) {
                $(e.target).prop('checked', !$(e.target).prop('checked'));
            } else {
                this.overlay.set('label', $(e.target).is(':checked')).save();
            }
        },
        'input #h-overlay-invert-label': function (e) {
            this.overlay.set('invertLabel', $(e.target).is(':checked')).save();
        },
        'input #h-overlay-flatten-label': function (e) {
            this.overlay.set('flattenLabel', $(e.target).is(':checked')).save();
        },
        'input #h-overlay-bitmask-label': function (e) {
            if (this._histogramView.model.get('loading')) {
                $(e.target).prop('checked', !$(e.target).prop('checked'));
            } else {
                this.overlay.set('bitmask', $(e.target).is(':checked')).save();
            }
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
        this.listenTo(this.overlay, 'change:exclude', this._excludeOverlayBins);
        this.listenTo(
            this.overlay,
            'change:threshold change:offset change:label change:invertLabel ' +
            'change:flattenLabel change:bitmask change:overlayItemId ' +
            'change:colormapId',
            (model) => { this.trigger('h:redraw', model); }
        );
        this.listenTo(
            this.overlay,
            'change:label change:bitmask',
            (model) => {
                this._histogramView.model.set({
                    'label': model.get('label'),
                    'bitmask': model.get('bitmask')
                });
                this._histogramView._getHistogram();
                this._histogramView.render();
            }
        );
        this.listenTo(
            this,
            'h:active-overlay-value',
            (evt) => {
                if (!this._histogramView || !this._histogramView.colormap ||
                    !this._histogramView.model.get('bitmask')) {
                    return;
                }

                var labels = this._histogramView.colormap.get('labels');
                if (!labels) {
                    return;
                }

                var colormap = this._histogramView.colormap.get('colormap');

                this.trigger(
                    'h:overlayLabels',
                    {
                        labels: _.map(
                            evt.values,
                            (value) => {
                                var label = { text: labels[value] };
                                if (colormap) {
                                    label.color = colormap[value];
                                }
                                return label;
                            }
                        )
                    }
                );
            }
        );
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
        // TODO: move me
        new ItemModel({
            _id: this.overlay.get('overlayItemId')
        }).fetch().done((overlayItem) => {
            this._histogramView.model.set({
                _id: overlayItem._id,
                fileId: overlayItem.largeImage.originalId,
                loading: true
            });
            this._histogramView._getHistogram();
            return this;
        });
        return this;
    },

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
            colormapId: this.overlay.get('colormapId'),
            parentView: this,
            threshold: this.overlay.get('threshold'),
            exclude: this.overlay.get('exclude'),
            opacities: this.overlay.get('opacities')
        }).render();

        this.listenTo(this._histogramView, 'h:range', function (evt) {
            this.overlay.set('threshold', evt.range).save();
        });

        this.listenTo(this._histogramView, 'h:opacities', function (evt) {
            this.overlay.set('opacities', evt.opacities).save();
        });

        this.listenTo(this._histogramView, 'h:exclude', function (evt) {
            this.overlay.set('exclude', evt.exclude).save();
        });
    },

    setViewer(viewer) {
        this.viewer = viewer;
        /*
        // make sure our listeners are in the correct order.
        this.stopListening(events, 's:widgetDrawRegion', this._widgetDrawRegion);
        if (viewer) {
            this.listenTo(events, 's:widgetDrawRegion', this._widgetDrawRegion);
            viewer.stopListening(events, 's:widgetDrawRegion', viewer.drawRegion);
            viewer.listenTo(events, 's:widgetDrawRegion', viewer.drawRegion);
        }
         */
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

    _excludeOverlayBins(overlay, value) {
        this.trigger('h:overlayExcludeBins', {
            index: overlay.get('index'),
            exclude: value
        });
    }
});

function uploadColormapWidget() {
    const user = getCurrentUser();
    if (!user) {
        throw new Error('User must be logged in');
    }
    const userFolders = new FolderCollection();
    userFolders.fetch({
        parentId: user.id,
        parentType: 'user',
        name: 'Private',
        limit: 1
    }).then(() => {
        if (userFolders.isEmpty()) {
            throw new Error('Could not find the user\'s private folder');
        }

        new UploadWidget({
            el: $('#g-dialog-container'),
            title: 'Upload Colormap',
            parent: userFolders.at(0),
            parentType: 'folder',
            parentView: this
        }).on('g:uploadFinished', function (e) {
            _.each(e.files, (file) => {
                restRequest({
                    url: `colormap/file/${file.id}`,
                    method: 'POST'
                }).done((results) => {
                    var model = new FileModel({_id: file.id});
                    model.destroy(); // .fail();
                    this.trigger('h:colormapsUpdated');
                }).fail((error) => {
                    console.log(error);
                });
            });
            handleClose('upload');
        }, this).render();

        return this;
    });
}

var ColormapSelectorWidget = Panel.extend({
    events: {
        'change select': '_select',
        'click .h-remove-colormap': '_removeColormap',
        'click .h-upload-colormap': uploadColormapWidget
    },

    initialize: function (settings) {
        this.nullLabel = '(none)';
        this.nullNameLabel = '(unnamed)';
        this.collection = new ColormapCollection();
        this.colormapId = settings.colormapId;
        this.collection.on('g:changed', () => {
            this.render();
            this.trigger('g:changed');
        });
        this.listenTo(this.collection, 'update', this.render);
        this.on('h:colormapsUpdated', () => {
            this.collection.fetch({limit: 0, offset: 0});
        });
        this.collection.fetch({limit: 0});
    },

    render: function () {
        this.$el.html(colormapSelectorWidget({
            colormaps: this.collection.toArray(),
            colormapId: this.colormapId,
            nullLabel: this.nullLabel,
            nullNameLabel: this.nullNameLabel
        }));
        return this;
    },

    _select: function () {
        var selected;
        this.colormapId = this.$(':selected').attr('value');
        if (this.colormapId) {
            selected = this.collection.get(this.colormapId);
            this.$('.h-remove-colormap').removeClass('disabled');
        } else {
            this.$('.h-remove-colormap').addClass('disabled');
        }
        this.trigger('g:selected', selected);
    },

    _removeColormap: function () {
        if (this.colormapId) {
            this.collection.get(this.colormapId).destroy();
            this.$('.h-colormap').val(this.nullLabel).trigger('change');
        }
    }
});

export default OverlayPropertiesWidget;
