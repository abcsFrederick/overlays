import View from '@girder/core/views/View';
import events from '@girder/histomicsui/events';

import OverlayOpenTemplate from '../../templates/body/OverlayOpenTemplate.pug';

var HeaderLabelView = View.extend({
    events: {
        'click .h-open-labeled-image': function (evt) {
            events.trigger('h:openLabeledImageUi');
        }
    },
    initialize: function (settings) {
        this.$el.append(OverlayOpenTemplate);
        this.$('.h-open-labeled-image').insertBefore('.h-open-annotated-image');
    },
    render() {
        return this;
    }
});

export default HeaderLabelView;
