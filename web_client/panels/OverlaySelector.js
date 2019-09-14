import _ from 'underscore';

import ItemModel from 'girder/models/ItemModel';
import FolderModel from 'girder/models/FolderModel';

import eventStream from 'girder/utilities/EventStream';
import { getCurrentUser } from 'girder/auth';
import events from 'girder/events';

import Panel from 'girder_plugins/slicer_cli_web/views/Panel';

import OverlayModel from '../models/OverlayModel';
import showSaveOverlayDialog from '../dialogs/saveOverlay';

import overlaySelectorWidget from '../templates/panels/overlaySelector.pug';
import '../stylesheets/panels/overlaySelector.styl';

/**
 * Create a panel controlling the visibility of overlays
 * on the image view.
 */
var OverlaySelector = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'click .h-overlay-name': 'editOverlay',
        'click .h-toggle-overlay': 'toggleOverlay',
        'click .h-delete-overlay': 'deleteOverlay',
        'click .h-create-overlay': 'createOverlay',
        'click .h-edit-overlay': 'editOverlayMetadata',
        'click .h-move-overlay-up': 'moveOverlayUp',
        'click .h-move-overlay-down': 'moveOverlayDown',
        'click .h-show-all-overlays': 'showAllOverlays',
        'click .h-hide-all-overlays': 'hideAllOverlays',
        'input #h-overlays-opacity': '_changeGlobalOpacity'
    }),

    /**
     * Create the panel.
     *
     * @param {object} settings
     * @param {OverlayCollection} settings.collection
     *     The collection representing the overlays attached
     *     to the current image.
     */
    initialize(settings = {}) {
        this._opacity = settings.opacity || 1.0;
        this.listenTo(this.collection, 'add', this._onAddOverlay);
        this.listenTo(this.collection, 'remove', this._onRemoveOverlay);
        this.listenTo(this.collection, 'update', this._onUpdate);
        this.listenTo(this.collection, 'change:displayed', this._onChangeOverlayDisplayed);
        this.listenTo(this.collection, 'change:overlayItemId', this._onChangeOverlayItem);
        this.listenTo(this.collection, 'sync reset change:loading', this.render);
        this.listenTo(this.collection, 'change:name', this._onChangeOverlayName);

        this.listenTo(eventStream, 'g:event.job_status', _.debounce(this._onJobUpdate, 500));
        // Since bitmask info is not saved in database, refresh will cause front in
        // sync issue, especially histogram exclude and slider
        // this.listenTo(eventStream, 'g:eventStream.start', this._refreshOverlays);
    },

    _onAddOverlay(overlay, collection, options) {
        this.trigger('h:addOverlay', overlay);
    },

    _onRemoveOverlay(overlay, collection, options) {
        this.trigger('h:removeOverlay', overlay.get('index'));
    },

    _onUpdate(collection, options) {
        this.render();
    },

    _onChangeOverlayDisplayed(overlay, value, options) {
        this.trigger('h:overlayDisplayed', {
            index: overlay.get('index'),
            displayed: value
        });
        this.render();
    },

    _onChangeOverlayName(overlay, value, options) {
        this.$('.h-overlay[data-id=' + overlay.id + '] > .h-overlay-name').attr('title', value).text(value);
    },

    render() {
        this.$('[data-toggle="tooltip"]').tooltip('destroy');
        if (!this.viewer) {
            this.$el.empty();
            return;
        }
        this.$el.html(overlaySelectorWidget({
            overlays: this.collection.sortBy('index'),
            id: 'overlay-panel-container',
            title: 'Overlays',
            activeOverlay: this._activeOverlay ? this._activeOverlay.id : '',
            user: getCurrentUser() || {},
            writeAccess: this._writeAccess,
            opacity: this._opacity
        }));
        this.$('.s-panel-content').collapse({toggle: false});
        this.$('[data-toggle="tooltip"]').tooltip({container: 'body'});
        this._changeGlobalOpacity();
        this.trigger('overlaySelectorFinish');
    },

    /**
     * Set the ItemModel associated with the overlay collection.
     * As a side effect, this resets the OverlayCollection and
     * fetches overlays from the server associated with the
     * item.
     *
     * @param {ItemModel} item
     */
    setItem(item) {
        if (this._parentId === item.id) {
            return;
        }

        this.parentItem = item;
        this._parentId = item.id;

        if (!this._parentId) {
            this.collection.reset();
            this.render();
            return;
        }
        this.collection.offset = 0;
        this.collection.reset();
        this.collection.fetch({itemId: this._parentId});

        return this;
    },

    /**
     * Set the image "viewer" instance.  This should be a subclass
     * of `large_image/imageViewerWidget` that is capable of rendering
     * overlays.
     */
    setViewer(viewer) {
        this.viewer = viewer;
        this.listenTo(this, 'h:active-overlay-value', (evt) => {
            console.log(evt);
        });
        /*
        if (this.viewer) {
            this.collection.each((overlay) => {
                this.viewer.addOverlay(overlay);
            });
        }
         */
        return this;
    },

    /**
     * Toggle the renderering of a specific overlay.  Sets the
     * `displayed` attribute of the `OverlayModel`.
     */
    toggleOverlay(evt) {
        var id = $(evt.currentTarget).parents('.h-overlay').data('id');
        var model = this.collection.get(id);

        if (!this._writeAccess(model)) {
            events.trigger('g:alert', {
                text: 'You do not have write access to this overlay.',
                type: 'warning',
                timeout: 2500,
                icon: 'info'
            });
            return;
        }

        model.set('displayed', !model.get('displayed')).save();
    },

    /**
     * Delete an overlay from the server.
     */
    deleteOverlay(evt) {
        const id = $(evt.currentTarget).parents('.h-overlay').data('id');
        const model = this.collection.get(id);

        if (model) {
            const name = model.get('name') || 'unnamed overlay';
            events.trigger('h:confirmDialog', {
                title: 'Warning',
                message: `Are you sure you want to delete ${name}?`,
                submitButton: 'Delete',
                onSubmit: () => {
                    this.trigger('h:deleteOverlay', model);
                    model.unset('displayed');
                    this.collection.remove(model);
                    model.destroy();
                }
            });
        }
    },

    editOverlayMetadata(evt) {
        const id = $(evt.currentTarget).parents('.h-overlay').data('id');
        const model = this.collection.get(id);

        var overlayItem = new ItemModel();
        overlayItem.set({_id: model.get('overlayItemId')}).fetch().then((overlayItem) => {
            var folder = new FolderModel();
            return folder.set({_id: overlayItem.folderId}).fetch();
        }).then((folder) => {
            var dialog = showSaveOverlayDialog({
                overlay: model,
                overlayRoot: new FolderModel(folder), // oof
                overlayItem: overlayItem
            }, {title: 'Edit overlay'});
            this.listenToOnce(dialog, 'g:submit', () => model.save());
            return dialog;
        });
    },

    _onJobUpdate(evt) {
        if (this.parentItem && evt.data.status > 2 &&
                evt.data.type !== 'histogram') {
            this._refreshOverlays();
        }
    },

    _refreshOverlays() {
        if (!this.parentItem || !this.parentItem.id) {
            return;
        }
        var models = this.collection.indexBy(_.property('id'));
        this.collection.offset = 0;
        this.collection.fetch({itemId: this.parentItem.id}).then(() => {
            var activeId = (this._activeOverlay || {}).id;
            this.collection.each((model) => {
                if (!_.has(models, model.id)) {
                    model.set('displayed', true);
                } else {
                    model.set('displayed', models[model.id].get('displayed'));
                }
            });
            this.render();
            this._activeOverlay = null;
            if (activeId) {
                this._setActiveOverlay(this.collection.get(activeId));
            }
            return null;
        });
    },

    editOverlay(evt) {
        var id = $(evt.currentTarget).parents('.h-overlay').data('id');
        var model = this.collection.get(id);

        // deselect the overlay if it is already selected
        if (this._activeOverlay && model && this._activeOverlay.id === model.id) {
            this._activeOverlay = null;
            this.trigger('h:editOverlay', null);
            this.render();
            return;
        }

        if (!this._writeAccess(model)) {
            events.trigger('g:alert', {
                text: 'You do not have write access to this overlay.',
                type: 'warning',
                timeout: 2500,
                icon: 'info'
            });
            return;
        }
        this._setActiveOverlay(model);
    },

    _setActiveOverlay(model) {
        this._activeOverlay = model;
        model.set('loading', true);
        model.fetch().done(() => {
            if (this._activeOverlay && this._activeOverlay.id !== model.id) {
                return;
            }
            model.set('displayed', true);
            this.trigger('h:editOverlay', model);
        }).always(() => {
            model.unset('loading');
        });
    },

    createOverlay(evt) {
        var params = {
            overlay: new OverlayModel({itemId: this.parentItem.id})
        };
        var dialog = showSaveOverlayDialog(params, {title: 'Create overlay'});
        this.listenToOnce(
            dialog,
            'g:submit',
            () => {
                params.overlay.save().done(() => {
                    this.collection.add(params.overlay);
                    this._setActiveOverlay(params.overlay);
                    // this.trigger('h:editOverlay', params.overlay);
                    // this._activeOverlay = params.overlay;
                });
            }
        );
    },

    _writeAccess(overlay) {
        const user = getCurrentUser();
        if (!user || !overlay) {
            return false;
        }
        const admin = user.get && user.get('admin');
        const creator = user.id === overlay.get('creatorId');
        return admin || creator;
    },

    showAllOverlays() {
        this.collection.each((model) => {
            model.set('displayed', true).save();
        });
    },

    hideAllOverlays() {
        this.collection.each((model) => {
            model.set('displayed', false).save();
        });
    },

    _changeGlobalOpacity() {
        this._opacity = this.$('#h-overlays-opacity').val();
        this.$('.h-overlays-opacity-container')
            .attr('title', `Overlay opacity ${(this._opacity * 100).toFixed()}%`);
        this.trigger('h:overlaysOpacity', this._opacity);
    },

    _swapOverlay(overlay1, overlay2) {
        var deferred = $.Deferred();

        var index1 = overlay1.get('index');
        var index2 = overlay2.get('index');
        overlay1.set('index', index2);
        overlay1.save().done(() => {
            overlay2.set('index', index1);
            overlay2.save().done(() => {
                this.collection.sort();
                this.render();
                deferred.resolve(index1);
            }).fail((error) => {
                overlay1.set('index', index1);
                overlay2.set('index', index2);
                deferred.reject(error);
            });
        }).fail((error) => {
            overlay1.set('index', index1);
            deferred.reject(error);
        });

        return deferred.promise();
    },

    moveOverlayUp(evt) {
        const id = $(evt.currentTarget).parents('.h-overlay').data('id');
        const model = this.collection.get(id);
        var i = this.collection.indexOf(model);
        if (!i) {
            return;
        }
        var otherModel = this.collection.at(i - 1);
        this._swapOverlay(model, otherModel).done((index) => {
            this.trigger('h:moveOverlayUp', index);
        });
        // $(evt.currentTarget).toggleClass('fade');
    },

    moveOverlayDown(evt) {
        const id = $(evt.currentTarget).parents('.h-overlay').data('id');
        const model = this.collection.get(id);
        var i = this.collection.indexOf(model);
        if (i + 1 === this.collection.length) {
            return;
        }
        var otherModel = this.collection.at(i + 1);
        this._swapOverlay(model, otherModel).done((index) => {
            this.trigger('h:moveOverlayDown', index);
        });
        // $(evt.currentTarget).toggleClass('fade');
    }
});

export default OverlaySelector;
