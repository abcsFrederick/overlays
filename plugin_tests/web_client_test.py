import os

from girder.api import access
from girder.api.describe import Description, describeRoute
from girder.api.rest import Resource, setRawResponse, setResponseHeader
from tests import web_client_test

setUpModule = web_client_test.setUpModule
tearDownModule = web_client_test.tearDownModule

TEST_FILE_IMAGE = os.path.join(
    os.environ['GIRDER_TEST_DATA_PREFIX'],
    'plugins', 'overlays',
    'image.tiff'  # noqa
)

TEST_FILE_OVERLAY = os.path.join(
    os.environ['GIRDER_TEST_DATA_PREFIX'],
    'plugins', 'overlays',
    'overlay.tiff'  # noqa
)


class MockSlicerCLIWebResource(Resource):
    """
    This creates a mocked version of the ``/HistomicsTK/HistomicsTK/docker_image``
    endpoint so we can test generation of the analysis panel on the client without
    relying on girder_worker + docker.
    """

    def __init__(self):
        super(MockSlicerCLIWebResource, self).__init__()
        self.route('GET', ('docker_image',), self.dockerImage)
        self.route('GET', ('test_analysis_detection', 'xmlspec'), self.testAnalysisXmlDetection)
        self.route('GET', ('test_analysis_features', 'xmlspec'),
                   self.testAnalysisXmlFeatures)
        self.route('POST', ('test_analysis_detection', 'run'), self.testAnalysisRun)
        self.route('POST', ('test_analysis_features', 'run'), self.testAnalysisRun)

    @access.public
    @describeRoute(
        Description('Mock the /HistomicsTK/docker_image endpoint.')
    )
    def dockerImage(self, params):
        """
        Return a single CLI referencing mocked out /xmlspec and /run endpoints.
        """
        return {
            'dsarchive/histomicstk': {
                'latest': {
                    'ComputeNucleiFeatures': {
                        'run': 'mock_resource/test_analysis_features/run',
                        'type': 'python',
                        'xmlspec': 'mock_resource/test_analysis_features/xmlspec'
                    },
                    'NucleiDetection': {
                        'run': 'mock_resource/test_analysis_detection/run',
                        'type': 'python',
                        'xmlspec': 'mock_resource/test_analysis_detection/xmlspec'
                    }
                }
            }
        }

    @access.public
    @describeRoute(
        Description('Mock an analysis description route.')
    )
    def testAnalysisXmlDetection(self, params):
        """Return the nuclei detection XML spec as a test case."""
        xml_file = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__), '..', 'histomicstk', 'cli',
                'NucleiDetection', 'NucleiDetection.xml'
            )
        )
        with open(xml_file) as f:
            xml = f.read()
        setResponseHeader('Content-Type', 'application/xml')
        setRawResponse()
        return xml

    @access.public
    @describeRoute(
        Description('Mock an analysis description route.')
    )
    def testAnalysisXmlFeatures(self, params):
        """Return the nuclei feature classification XML spec as a test case."""
        xml_file = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__), '..', 'histomicstk', 'cli',
                'ComputeNucleiFeatures', 'ComputeNucleiFeatures.xml'
            )
        )
        with open(xml_file) as f:
            xml = f.read()
        setResponseHeader('Content-Type', 'application/xml')
        setRawResponse()
        return xml

    @access.public
    @describeRoute(
        Description('Mock an analysis run route.')
    )
    def testAnalysisRun(self, params):
        """
        Mock out the CLI execution endpoint.

        For now, this is a no-op, but we should add some logic to generate an annotation
        output and job status events to simulate a real execution of the CLI.
        """
        return {'_id': 'jobid'}


class WebClientTestCase(web_client_test.WebClientTestCase):

    def setUp(self):
        web_client_test.testServer.root.api.v1.mock_resource = MockSlicerCLIWebResource()

        super(WebClientTestCase, self).setUp()

        admin = self.model('user').createUser(
            login='admin',
            password='password',
            email='admin@email.com',
            firstName='Admin',
            lastName='Admin',
            admin=True
        )

        user = self.model('user').createUser(
            login='user',
            password='password',
            email='user@email.com',
            firstName='User',
            lastName='User',
            admin=False
        )

        publicFolder = self.model('folder').childFolders(
            user, 'user', filters={'name': 'Public'}
        ).next()

        with open(TEST_FILE_IMAGE, 'rb') as f:
            file_Image = self.uploadFile('image', f.read(), user, publicFolder)

        item_Image = self.model('item').load(file_Image['itemId'], force=True)
        self.model('image_item', 'large_image').createImageItem(
            item_Image, file_Image, user=user, createJob=False
        )
        self.model('image_item', 'large_image').copyItem(
            item_Image, user, name='copy')

        with open(TEST_FILE_OVERLAY, 'rb') as f:
            file_Overlay = self.uploadFile('overlay', f.read(), user, publicFolder)

        item_Overlay = self.model('item').load(file_Overlay['itemId'], force=True)
        self.model('image_item', 'large_image').createImageItem(
            item_Overlay, file_Overlay, user=user, createJob=False
        )

        annotation = self.model('annotation', 'large_image').createAnnotation(
            item_Image, admin, {'name': 'admin annotation'})
        annotation = self.model('annotation', 'large_image').setAccessList(
            annotation, {}, force=True, save=False)
        annotation = self.model('annotation', 'large_image').setPublic(
            annotation, True, save=True)
