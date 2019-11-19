import $ from 'jquery';
import _ from 'underscore';
import backbone from 'backbone';

import { restRequest } from 'girder/rest';
import ItemCollection from 'girder/collections/ItemCollection';
import UserCollection from 'girder/collections/UserCollection';
import View from 'girder/views/View';
import 'girder/utilities/jquery/girderModal';

import events from 'girder_plugins/HistomicsTK/events';
import router from 'girder_plugins/HistomicsTK/router';

import listTemplate from '../templates/dialogs/labeledImageList.pug';
import template from '../templates/dialogs/openLabeledImage.pug';
import '../stylesheets/dialogs/openLabeledImage.styl';

let dialog;
const paths = {};

const LabeledImageList = View.extend({
    initialize() {
        this.listenTo(this.collection, 'reset', this.render);
    },

    render() {
        this.$el.html(listTemplate({
            items: this.collection.toJSON(),
            paths,
            inFetch: this.collection._inFetch
        }));
        return this;
    }
});

const OpenLabeledImage = View.extend({
    events: {
        'click .h-labeled-image': '_submit',
        'keyup input': '_updateQuery',
        'change select': '_updateQuery'
    },

    initialize() {
        this.collection = new ItemCollection();
        // disable automatic sorting of this collection
        this.collection.comparator = null;

        // This is a view model used to store the form state of the dialog.
        this._query = new backbone.Model({
            name: '',
            creator: ''
        });

        // These properties are used to debounce rest calls, preventing a new
        // rest call from occuring until the previous one has finished.
        this._nextQuery = {};
        this.collection._inFetch = false;

        this._users = new UserCollection();
        this._users.sortField = 'login';
        this._users.pageLimit = 500;
        this._usersIsFetched = false;
        this._users.fetch().done(() => {
            this._usersIsFetched = true;
            this._fetchImages();
            this.render();
        });
        this.listenTo(this._query, 'change', this._queueFetchImages);
    },

    render() {
        if (!this._usersIsFetched) {
            return this;
        }
        this.$el.html(template({
            overlayName: this._query.get('name'),
            creator: this._query.get('creator'),
            users: this._users
        })).girderModal(this);
        this.$el.tooltip();

        new LabeledImageList({
            parentView: this,
            collection: this.collection,
            el: this.$('.h-annotated-images-list-container')
        }).render();
        return this;
    },

    _fetchImages() {
        const data = this._nextQuery;
        let items, uniqItems;

        if (!this._nextQuery || this.collection._inFetch) {
            return;
        }
        this.collection._inFetch = true;
        delete this._nextQuery;

        data.limit = 10;
        restRequest({
            url: 'overlay/images',
            data
        }).then((_items) => {
            this.overlays = _items;
            items = _items;
            uniqItems = _.uniq(items, 'itemId');
            const promises = _.map(uniqItems, (item) => {
                return this._getResourcePath(item);
            });
            return $.when(...promises);
        }).done(() => {
            this.collection._inFetch = false;
            this.collection.reset(uniqItems);
            this._fetchImages();
        });
    },

    _queueFetchImages() {
        const overlayName = this._query.get('name');
        const creator = this._query.get('creator');
        this._nextQuery = {};

        if (overlayName) {
            this._nextQuery.name = overlayName;
        }
        if (creator) {
            this._nextQuery.creatorId = creator;
        }

        this._fetchImages();
    },

    _updateQuery() {
        this._query.set({
            creator: this.$('#h-label-creator').val(),
            name: (this.$('#h-overlay-name').val() || '').trim()
        });
    },

    _submit(evt) {
        const id = this.$(evt.currentTarget).data('id');
        router.setQuery('bounds', null, {trigger: false});
        router.setQuery('image', id, {trigger: true});
        this.$el.modal('hide');
    },

    _getResourcePath(item) {
        if (_.has(paths, item.itemId)) {
            return $.Deferred().resolve(paths[item.itemId]).promise();
        }
        let restRequestPath = () => {
            return restRequest({
                url: `resource/${item.itemId}/path`,
                data: {
                    type: 'item'
                }
            }).done((path) => {
                return path;
            });
        };
        let restRequestImage = () => {
            return restRequest({
                url: `item/${item.itemId}`
            }).done((res) => {
                return res;
            });
        };
        return $.when(restRequestPath(), restRequestImage()).then((path, image) => {
            paths[item.itemId] = {};
            paths[item.itemId].path = path[0];
            paths[item.itemId].name = image[0].name;
            // eslint-disable-next-line
            let overlays = _.filter(this.overlays, {itemId: item.itemId});
            paths[item.itemId].overlays = overlays;
            return null;
        });
    }
});

function createDialog() {
    return new OpenLabeledImage({
        parentView: null
    });
}

events.on('h:openLabeledImageUi', function () {
    if (!dialog) {
        dialog = createDialog();
    }
    dialog.setElement($('#g-dialog-container')).render();
});

export default createDialog;
