import _ from 'underscore';

import $ from 'jquery';

import View from '@girder/core/views/View';

import BrowserWidget from './browserWidget';

import saveOverlay from '../templates/dialogs/saveOverlay.pug';

/**
 * Create a modal dialog with fields to edit the properties of
 * an overlay before POSTing it to the server.
 */
var SaveOverlay = View.extend({
    events: {
        'click .h-open-image': function (evt) {
            this.$('#h-overlay-select').attr('disabled', 'disabled');
            this.$('#h-browser-container').removeClass('hidden');
            this.$('.h-open-image').bind('click', (ev) => ev.preventDefault());
        },
        'click .h-cancel': 'cancel',
        'click .h-submit': 'save'
    },

    show(params, options) {
        this.overlay = params.overlay;
        this.overlayRoot = params.overlayRoot;
        this.overlayItem = params.overlayItem;
        this.options = options;

        this.setElement('#g-dialog-container').render();
    },

    render() {
        this.$el.html(
            saveOverlay({
                title: this.options.title,
                name: this.overlay.get('name'),
                description: this.overlay.get('description')
            })
        ).girderModal(this);
        if (this._browserWidget) {
            this._browserWidget.destroy();
        }
        this._browserWidget = new BrowserWidget({
            parentView: this,
            titleText: 'Select an overlay...',
            submitText: 'Open',
            showItems: true,
            selectItem: true,
            showPreview: false,
            helpText: 'Click on a large image item to select.',
            rootSelectorSettings: {
                pageLimit: 50
            },
            root: this.overlayRoot
        }).setElement($('#h-browser-container')).render();
        this.listenTo(this._browserWidget, 'g:selected', this._selectOverlayItem);
        if (this.overlayItem) {
            this._browserWidget._selectItem(this.overlayItem);
        }
        return this;
    },

    cancel(evt) {
        evt.preventDefault();
        this.$el.modal('hide');
        $('.modal-backdrop').remove();
    },

    save(evt) {
        evt.preventDefault();

        if (!this.$('#h-overlay-name').val()) {
            this.$('#h-overlay-name').parent()
                .addClass('has-error');
            this.$('.overlay.g-validation-failed-message')
                .text('Please enter a name.')
                .removeClass('hidden');
            return;
        }

        if (!(this.overlayItem && this.overlayItem.has('largeImage') &&
                this.$('#h-overlay-item').val())) {
            this.$('#h-overlay-item').parent()
                .addClass('has-error');
            this.$('.overlay.g-validation-failed-message')
                .text('Please select a "large image" item for the overlay.')
                .removeClass('hidden');
            return;
        }

        this.overlay.set({
            name: this.$('#h-overlay-name').val(),
            description: this.$('#h-overlay-description').val(),
            overlayItemId: this.overlayItem.id
        });
        this.trigger('g:submit');
        this.$el.modal('hide');
        $('.modal-backdrop').remove();
    },

    _selectOverlayItem(item) {
        this.overlayItem = item;
        this.$('#h-overlay-item').val('');
        if (this.overlayItem) {
            this.$('#h-overlay-item').val(this.overlayItem.get('name'));
        }
        this.$('#h-browser-container').addClass('hidden');
        this.$('#h-overlay-select').removeAttr('disabled').unbind('click');
    }
});

/**
 * Create a singleton instance of this widget that will be rendered
 * when `show` is called.
 */
var dialog = new SaveOverlay({
    parentView: null
});

function show(params, options) {
    _.defaults(options, {'title': 'Create overlay'});
    dialog.show(params, options);

    return dialog;
}

export default show;
