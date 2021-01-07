import _ from 'underscore';

import { restRequest } from '@girder/core/rest';

import AccessControlledModel from '@girder/core/models/AccessControlledModel';

var OverlayModel = AccessControlledModel.extend({
    resourceName: 'overlay',
    defaults: {
        displayed: true,
        name: 'unnamed overlay',
        description: '',
        opacity: 1.0,
        label: false,
        invertLabel: true,
        flattenLabel: false,
        bitmask: false,
        overlayItemId: null,
        offset: {x: 0, y: 0},
        colormapId: null,
        threshold: {max: 255, min: 0},
        thresholdBit: {max: 8, min: 1}
    },

    save: function () {
        if (this.altUrl === null && this.resourceName === null) {
            throw new Error('An altUrl or resourceName must be set on the Model.');
        }

        var path, type;
        if (this.has('_id')) {
            path = (this.altUrl || this.resourceName) + '/' + this.get('_id');
            type = 'PUT';
        } else {
            path = (this.altUrl || this.resourceName);
            type = 'POST';
        }
        var data = {};
        _.each(this.keys(), function (key) {
            var value = this.get(key);
            /*
            if (!_.isObject(value)) {
                data[key] = value;
            }
             */
            data[key] = value;
        }, this);

        return restRequest({
            url: path,
            method: type,
            contentType: 'application/json',
            processData: false,
            data: JSON.stringify(data)
        }).done((resp) => {
            this.set(resp);
            this.trigger('g:saved');
        }).fail((err) => {
            this.trigger('g:error', err);
        });
    }
});

export default OverlayModel;
