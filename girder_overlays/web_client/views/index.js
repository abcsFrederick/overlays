import * as body from './body';
import { ViewerWidget } from '@girder/large_image_annotation/views';
import * as extensions from './imageViewerWidget';

for (var key in ViewerWidget) {
    // viewers[key] = viewers[key].extend(ImageViewerWidgetAnnotationExtension);
    if (extensions[key]) {
        ViewerWidget[key] = extensions[key](ViewerWidget[key]);
    }
}

export {
    body,
    ViewerWidget as ViewerWidget
};
