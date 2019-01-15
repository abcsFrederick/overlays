import Collection from 'girder/collections/Collection';

import OverlayModel from '../models/OverlayModel';

export default Collection.extend({
    resourceName: 'overlay',
    model: OverlayModel,
    sortField: 'index'
});
