/* global geo */
// import { wrap } from 'girder/utilities/PluginUtils';
import events from 'girder/events';

import ImageView from 'girder_plugins/HistomicsTK/views/body/ImageView';

import OverlayCollection from '../../collections/OverlayCollection';
import OverlaySelector from '../../panels/OverlaySelector';
import OverlayPropertiesWidget from '../../panels/OverlayPropertiesWidget';

import GeojsViewer from '../../views/imageViewerWidget/geojs';

import imageTemplate from '../../templates/body/image.pug';
import '../../stylesheets/body/image.styl';

var OverlayImageView = ImageView.extend({
    initialize(settings) {
        var result = ImageView.prototype.initialize.apply(this, arguments);

        this.overlays = new OverlayCollection();

        this.overlaySelector = new OverlaySelector({
            parentView: this,
            collection: this.overlays,
            image: this.model
        });

        this.listenTo(this.overlaySelector.collection, 'add update change:displayed', this.toggleOverlay);

        this.listenTo(this.overlaySelector, 'h:editOverlay', this._editOverlay);
        this.listenTo(this.overlaySelector, 'h:deleteOverlay', this._deleteOverlay);
        this.listenTo(this.overlaySelector, 'h:overlaysOpacity', this._setOverlaysOpacity);
        this.listenTo(this.overlaySelector, 'h:moveOverlayUp', this._moveOverlayUp);
        this.listenTo(this.overlaySelector, 'h:moveOverlayDown', this._moveOverlayDown);

        this.render();

        return result;
    },

    /*
    render() {
        var result = ImageView.prototype.render.apply(this, arguments);

        this._removeOverlayPropertiesWidget();

        if (this.model.id) {
            if (this.viewerWidget) {
                this.viewerWidget.destroy();
            }
            this.viewerWidget = new GeojsViewer({
                parentView: this,
                el: this.$('.h-image-view-container'),
                itemId: this.model.id,
                hoverEvents: true,
                // it is very confusing if this value is smaller than the
                // AnnotationSelector MAX_ELEMENTS_LIST_LENGTH
                highlightFeatureSizeLimit: 5000,
                scale: {position: {bottom: 20, right: 10}}
            });
            this.viewerWidget.on('g:imageRendered', () => {
                if (this.viewer) {
                    this.$('#h-overlay-selector-container').removeClass('hidden');
                    this.overlaySelector
                        .setViewer(this.viewerWidget)
                        .setElement('.h-overlay-selector').render();

                    this.overlaySelector.collection.each((model) => {
                        if (model.get('displayed')) {
                            this.viewerWidget.drawOverlay(model);
                        }
                    });

                    if (this.overlayPropertiesWidget) {
                        this.$('.h-overlay-properties-widget').removeClass('hidden');
                        this.overlayPropertiesWidget
                            .setViewer(this.viewerWidget)
                            .setElement('.h-overlay-properties-widget').render();
                    }
                }
            });
            this.overlaySelector.setItem(this.model);

            this.overlaySelector
                .setViewer(null)
                .setElement('.h-overlay-selector').render();

            if (this.overlayPropertiesWidget) {
                this.$('.h-overlay-properties-widget').removeClass('hidden');
                this.overlayPropertiesWidget
                    .setViewer(null)
                    .setElement('.h-overlay-properties-widget').render();
            }
        }

        return result;
    },
     */

    render() {
        // Ensure annotations are removed from the popover widget on rerender.
        // This can happen when opening a new image while an annotation is
        // being hovered.
        this.mouseResetAnnotation();
        this._removeOverlayPropertiesWidget();
        this._removeDrawWidget();

        if (this.model.id === this._openId) {
            this.controlPanel.setElement('.h-control-panel-container').render();
            return;
        }
        this.$el.html(imageTemplate());
        this.contextMenu.setElement(this.$('#h-annotation-context-menu')).render();

        if (this.model.id) {
            this._openId = this.model.id;
            if (this.viewerWidget) {
                this.viewerWidget.destroy();
            }
            this.viewerWidget = new GeojsViewer({
                parentView: this,
                el: this.$('.h-image-view-container'),
                itemId: this.model.id,
                hoverEvents: true,
                // it is very confusing if this value is smaller than the
                // AnnotationSelector MAX_ELEMENTS_LIST_LENGTH
                highlightFeatureSizeLimit: 5000,
                scale: {position: {bottom: 20, right: 10}}
            });
            this.trigger('h:viewerWidgetCreated', this.viewerWidget);

            // handle annotation mouse events
            this.listenTo(this.viewerWidget, 'g:mouseOverAnnotation', this.mouseOverAnnotation);
            this.listenTo(this.viewerWidget, 'g:mouseOutAnnotation', this.mouseOutAnnotation);
            this.listenTo(this.viewerWidget, 'g:mouseOnAnnotation', this.mouseOnAnnotation);
            this.listenTo(this.viewerWidget, 'g:mouseOffAnnotation', this.mouseOffAnnotation);
            this.listenTo(this.viewerWidget, 'g:mouseClickAnnotation', this.mouseClickAnnotation);
            this.listenTo(this.viewerWidget, 'g:mouseResetAnnotation', this.mouseResetAnnotation);

            this.viewerWidget.on('g:imageRendered', () => {
                events.trigger('h:imageOpened', this.model);
                // store a reference to the underlying viewer
                this.viewer = this.viewerWidget.viewer;

                this.imageWidth = this.viewer.maxBounds().right;
                this.imageHeight = this.viewer.maxBounds().bottom;
                // allow panning off the image slightly
                var extraPanWidth = 0.1, extraPanHeight = 0;
                this.viewer.maxBounds({
                    left: -this.imageWidth * extraPanWidth,
                    right: this.imageWidth * (1 + extraPanWidth),
                    top: -this.imageHeight * extraPanHeight,
                    bottom: this.imageHeight * (1 + extraPanHeight)
                });

                // set the viewer bounds on first load
                this.setImageBounds();

                // also set the query string
                this.setBoundsQuery();

                if (this.viewer) {
                    this.viewer.zoomRange({max: this.viewer.zoomRange().max + this._increaseZoom2x});

                    // update the query string on pan events
                    this.viewer.geoOn(geo.event.pan, () => {
                        this.setBoundsQuery();
                    });

                    // update the coordinate display on mouse move
                    this.viewer.geoOn(geo.event.mousemove, (evt) => {
                        this.showCoordinates(evt);
                    });

                    // remove the hidden class from the coordinates display
                    this.$('.h-image-coordinates-container').removeClass('hidden');

                    // show the right side control container
                    this.$('#h-annotation-selector-container').removeClass('hidden');
                    this.$('#h-overlay-selector-container').removeClass('hidden');

                    this.zoomWidget
                        .setViewer(this.viewerWidget)
                        .setElement('.h-zoom-widget').render();

                    this.overlaySelector
                        .setViewer(this.viewerWidget)
                        .setElement('.h-overlay-selector').render();

                    this.overlaySelector.collection.each((model) => {
                        if (model.get('displayed')) {
                            this.viewerWidget.drawOverlay(model);
                        }
                    });

                    if (this.overlayPropertiesWidget) {
                        this.$('.h-overlay-properties-widget').removeClass('hidden');
                        this.overlayPropertiesWidget
                            .setViewer(this.viewerWidget)
                            .setElement('.h-overlay-properties-widget').render();
                    }

                    this.annotationSelector
                        .setViewer(this.viewerWidget)
                        .setElement('.h-annotation-selector').render();

                    if (this.drawWidget) {
                        this.$('.h-draw-widget').removeClass('hidden');
                        this.drawWidget
                            .setViewer(this.viewerWidget)
                            .setElement('.h-draw-widget').render();
                    }
                }
            });
            this.overlaySelector.setItem(this.model);

            this.overlaySelector
                .setViewer(null)
                .setElement('.h-overlay-selector').render();

            if (this.overlayPropertiesWidget) {
                this.$('.h-overlay-properties-widget').removeClass('hidden');
                this.overlayPropertiesWidget
                    .setViewer(null)
                    .setElement('.h-overlay-properties-widget').render();
            }

            this.annotationSelector.setItem(this.model);

            this.annotationSelector
                .setViewer(null)
                .setElement('.h-annotation-selector').render();

            if (this.drawWidget) {
                this.$('.h-draw-widget').removeClass('hidden');
                this.drawWidget
                    .setViewer(null)
                    .setElement('.h-draw-widget').render();
            }
        }
        this.controlPanel.setElement('.h-control-panel-container').render();
        this.popover.setElement('#h-annotation-popover-container').render();
        return this;
    },

    _removeOverlayPropertiesWidget() {
        if (this.overlayPropertiesWidget) {
            this.stopListening(this.overlayPropertiesWidget);
            this.overlayPropertiesWidget.remove();
            this.overlayPropertiesWidget = null;
            $('<div/>').addClass('h-overlay-properties-widget s-panel hidden')
                .insertAfter(this.$('.h-overlay-selector').first());
        }
    },

    _editOverlay(model) {
        this.activeOverlay = model;
        this._removeOverlayPropertiesWidget();
        if (model) {
            this.overlayPropertiesWidget = new OverlayPropertiesWidget({
                parentView: this,
                overlay: this.activeOverlay,
                el: this.$('.h-overlay-properties-widget'),
                viewer: this.viewerWidget
            }).render();
            this.listenTo(this.overlayPropertiesWidget, 'h:redraw', this._redrawOverlay);
            this.listenTo(this.overlayPropertiesWidget, 'h:overlayOpacity', this._setOverlayOpacity);
            this.listenTo(this.overlayPropertiesWidget, 'h:overlayOpacities', this._setOverlayOpacities);
            this.listenTo(this.overlayPropertiesWidget, 'h:overlayExcludeBins', this._excludeOverlayBins);
            this.$('.h-overlay-properties-widget').removeClass('hidden');
        }
    },

    _deleteOverlay(model) {
        if (this.activeOverlay && this.activeOverlay.id === model.id) {
            this._removeOverlayPropertiesWidget();
        }
    },

    _setOverlaysOpacity(opacity) {
        this.viewerWidget.setGlobalOverlayOpacity(opacity);
    },

    _setOverlayOpacity(evt) {
        this.viewerWidget.setOverlayOpacity(evt.index, evt.opacity);
    },

    _setOverlayOpacities(evt) {
        this.viewerWidget.setOverlayOpacities(evt.index, evt.opacities);
    },

    _excludeOverlayBins(evt) {
        this.viewerWidget.setOverlayVisibility(evt.index, null, evt.exclude);
    },

    _moveOverlayUp(index) {
        this.viewerWidget.moveOverlayUp(index);
    },

    _moveOverlayDown(index) {
        this.viewerWidget.moveOverlayDown(index);
    }
});

export default OverlayImageView;
