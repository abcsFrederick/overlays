import { wrap } from 'girder/utilities/PluginUtils';

import App from 'girder_plugins/HistomicsTK/app';

import bindRoutes from './routes';

wrap(App, 'bindRoutes', function () {
    bindRoutes();
});

export default App;
