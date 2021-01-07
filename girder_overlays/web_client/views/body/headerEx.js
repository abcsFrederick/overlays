import HeaderView from '@girder/histomicsui/views/layout/HeaderImageView';
import { wrap } from '@girder/core/utilities/PluginUtils';

import HeaderLabelView from './HeaderLabelView';

wrap(HeaderView, 'render', function (render) {
    render.call(this);
    new HeaderLabelView({
        el: this.$('.h-open-annotated-image').parent(),
        parentView: this
    }).render();
    return this;
});
