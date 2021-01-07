import Collection from '@girder/core/collections/Collection';

import OverlayModel from '../models/OverlayModel';

export default Collection.extend({
    resourceName: 'overlay',
    model: OverlayModel,
    sortField: 'index'
});
