import { wrap } from '@girder/core/utilities/PluginUtils';

import App from '@girder/histomicsui/app';

import bindRoutes from './routes';

wrap(App, 'bindRoutes', function () {
    bindRoutes();
});

export default App;
