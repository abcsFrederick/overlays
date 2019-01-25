#!/usr/bin/env python
# -*- coding: utf-8 -*-

###############################################################################
#  Girder plugin framework and tests adapted from Kitware Inc. source and
#  documentation by the Imaging and Visualization Group, Advanced Biomedical
#  Computational Science, Frederick National Laboratory for Cancer Research.
#
#  Copyright Kitware Inc.
#
#  Licensed under the Apache License, Version 2.0 ( the "License" );
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
###############################################################################

from bson.objectid import ObjectId

from girder.api import access
from girder.api.describe import describeRoute, Description
from girder.api.rest import Resource, loadmodel, filtermodel
from girder.constants import AccessType, SortDir
from girder.exceptions import RestException
from girder.models.item import Item
from .models.overlay import Overlay
try:
    from girder.plugins.colormaps.models.colormap import Colormap
except ImportError:
    Colormap = None


class OverlayResource(Resource):
    def __init__(self):
        super(OverlayResource, self).__init__()

        self.resourceName = 'overlay'
        self.route('GET', (), self.find)
        self.route('POST', (), self.createOverlay)
        self.route('DELETE', (':id',), self.deleteOverlay)
        self.route('GET', (':id',), self.getOverlay)
        self.route('PUT', (':id',), self.updateOverlay)

    @describeRoute(
        Description('Search for overlays.')
        .responseClass('Overlay', array=True)
        .param('itemId', 'The ID of the parent item.',
                         required=False)
        .pagingParams(None, defaultLimit=None)
        .errorResponse()
        .errorResponse('No matching overlays were found.', 404)
    )
    @access.user
    @filtermodel(model='overlay', plugin='overlays')
    def find(self, params):
        user = self.getCurrentUser()
        limit, offset, sort = self.getPagingParameters(params)
        if sort is None:
            sort = [
                ('created', SortDir.ASCENDING),
                ('index', SortDir.ASCENDING),
            ]
        query = {}
        if 'itemId' in params:
            query['itemId'] = params['itemId']
        return list(Overlay().filterResultsByPermission(
            cursor=Overlay().find(query, sort=sort),
            user=user,
            level=AccessType.READ,
            limit=limit, offset=offset
        ))

    @describeRoute(
        Description('Create overlay for an item.')
        .responseClass('Overlay')
        .param('body', 'A JSON object containing the overlay.', paramType='body')
        .errorResponse('Parent large image ID was invalid.')
        .errorResponse('Read access was denied for the parent item.', 403)
        .errorResponse('Read access was denied for the overlay item.', 403)
    )
    @access.user
    @filtermodel(model='overlay', plugin='overlays')
    def createOverlay(self, params):
        user = self.getCurrentUser()
        overlay = self.getBodyJson()

        if 'itemId' in overlay:
            item = Item().load(overlay['itemId'], force=True)
            Item().requireAccess(item, user=user, level=AccessType.READ)

        if 'overlayItemId' in overlay:
            overlayItem = Item().load(overlay['overlayItemId'], force=True)
            Item().requireAccess(overlayItem, user=user, level=AccessType.READ)
        if Colormap is not None and 'colormapId' in overlay and overlay['colormapId']:
            colormap = Colormap().load(overlay['colormapId'], force=True)
            Colormap().requireAccess(colormap, user=user, level=AccessType.READ)
            overlay['colormapId'] = colormap['_id']

        return Overlay().createOverlay(item, overlayItem, user, **overlay)

    @describeRoute(
        Description('Delete an overlay.')
        .param('id', 'The ID of the overlay.', paramType='path')
        .errorResponse('ID was invalid.')
        .errorResponse('Write access was denied for the overlay.', 403)
    )
    @access.user
    @loadmodel(model='overlay', plugin='overlays', level=AccessType.WRITE)
    @filtermodel(model='overlay', plugin='overlays')
    def deleteOverlay(self, overlay, params):
        Overlay().remove(overlay)

    @describeRoute(
        Description('Get overlay by ID.')
        .param('id', 'The ID of the overlay.', paramType='path')
        .errorResponse('ID was invalid.')
        .errorResponse('Read access was denied for the overlay.', 403)
        .errorResponse('Overlay not found.', 404)
    )
    @access.cookie
    @access.public
    @loadmodel(model='overlay', plugin='overlays', level=AccessType.READ)
    @filtermodel(model='overlay', plugin='overlays')
    def getOverlay(self, overlay, params):
        return overlay

    @describeRoute(
        Description('Update an overlay.')
        .param('id', 'The ID of the overlay.', paramType='path')
        .param('body', 'A JSON object containing the overlay.',
               paramType='body')
        .errorResponse('Write access was denied for the item.', 403)
        .errorResponse('Overlays not found.', 404)
    )
    @access.user
    @loadmodel(model='overlay', plugin='overlays', level=AccessType.WRITE)
    @filtermodel(model='overlay', plugin='overlays')
    def updateOverlay(self, overlay, params):
        update = self.getBodyJson()
        if ('creatorId' in update and
                ObjectId(update['creatorId']) != overlay['creatorId']):
            raise RestException('Cannot change overlay creator', 403)
        user = self.getCurrentUser()
        if 'itemId' in update:
            item = Item().load(update['itemId'], force=True)
            if item is not None:
                Item().requireAccess(item, user=user, level=AccessType.READ)
        if 'overlayItemId' in update:
            overlayItem = Item().load(update['overlayItemId'], force=True)
            if item is not None:
                Item().requireAccess(overlayItem,
                                     user=user, level=AccessType.READ)
        if Colormap is not None and update.get('colormapId'):
            colormap = Colormap().load(update['colormapId'], force=True)
            if colormap is not None:
                Colormap().requireAccess(colormap,
                                         user=user, level=AccessType.READ)
        overlay.update(update)
        if '_id' in update:
            del update['_id']
        if 'updatedId' in update:
            del update['updatedId']
        return Overlay().updateOverlay(overlay, user=user)
