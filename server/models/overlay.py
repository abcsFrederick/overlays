#!/usr/bin/env python
# -*- coding: utf-8 -*-

from girder import events
from girder.constants import AccessType, SortDir
from girder.exceptions import ValidationException
from girder.models.model_base import AccessControlledModel


class Overlay(AccessControlledModel):
    def initialize(self):
        self.name = 'overlay'
        self.ensureIndices([
            'itemId',
            'creatorId',
            'index',
            'name',
            'overlayItemId',
            'colormapId',
        ])

        fields = (
            '_id',
            'creatorId',
            'description',
            'displayed',
            'index',
            'position',
            'itemId',
            'label',
            'invertLabel',
            'flattenLabel',
            'bitmask',
            'name',
            'opacity',
            'threshold',
            'exclude',
            'overlayItemId',
            'offset',
            'colormapId',
        )
        self.exposeFields(AccessType.READ, fields)

        events.bind('model.item.remove', 'colormap', self._onColormapRemove)
        events.bind('model.item.remove', 'large_image', self._onItemRemove)

    def _onColormapRemove(self, event):
        self.update({'colormapId': event.info['_id']},
                    {'$unset': {'colormapId': ""}})

    def _onItemRemove(self, event):
        item = event.info
        for overlay in self.find({'itemId': item['_id']}):
            self.remove(overlay)
        for overlay in self.find({'overlayItemId': item['_id']}):
            self.remove(overlay)

    def _getMaxIndex(self, itemId, creatorId):
        query = {
            'itemId': itemId,
            'creatorId': creatorId,
        }
        for overlay in self.find(query, sort=[('index', SortDir.DESCENDING)],
                                 fields=['index']):
            return overlay['index'] + 1
        return 0

    def createOverlay(self, user, **doc):
        self.setUserAccess(doc, user=user, level=AccessType.ADMIN,
                           save=False)
        if 'itemId' in doc and 'creatorId' in doc:
            doc['index'] = self._getMaxIndex(doc['itemId'], doc['creatorId'])
        return self.save(doc)

    def updateOverlay(self, doc, update):
        doc.update(update)
        self.save(doc)

    def validate(self, doc):
        validation = (
            ('itemId', 'Overlay must have a parent item ID'),
            ('creatorId', 'Overlay must have a creator ID'),
            ('index', 'Overlay must have an index'),
            ('overlayItemId', 'Overlay must have an overlay item ID'),
            ('name', 'Overlay must have a name')
        )
        for field, message in validation:
            if doc.get(field) is None:
                raise ValidationException(message, field)
        return doc
