import events from '@girder/histomicsui/events';

import Router from '@girder/histomicsui/router';

import ImageView from './views/body/ImageView';

function bindRoutes() {
    Router.route('', 'index', function () {
        events.trigger('g:navigateTo', ImageView, {});
    });
    return Router;
}

export default bindRoutes;
