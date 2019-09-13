import View from 'girder/views/View';
import events from 'girder_plugins/HistomicsTK/events';

import OverlayOpenTemplate from '../../templates/body/OverlayOpenTemplate.pug';

var HeaderLabelView = View.extend({
    events: {
        'click .h-open-labeled-image': function (evt) {
            console.log('click');
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
