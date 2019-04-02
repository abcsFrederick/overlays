import events from 'girder/events';

import Router from 'girder_plugins/HistomicsTK/router';

import ImageView from './views/body/ImageView';

function bindRoutes() {
    Router.route('', 'index', function () {
        events.trigger('g:navigateTo', ImageView, {});
    });
    return Router;
}

export default bindRoutes;
