#!/usr/bin/env python
# -*- coding: utf-8 -*-

import datetime

from girder import events
from girder.constants import AccessType, SortDir
from girder.exceptions import ValidationException
from girder.models.model_base import Model
from girder.models.item import Item
from girder.utility import acl_mixin


class Overlay(acl_mixin.AccessControlMixin, Model):
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
        self.ensureTextIndex({
            'name': 10,
            'description': 1
        })
        self.resourceColl = 'item'
        self.resourceParent = 'itemId'

        fields = (
            '_id',
            'creatorId',
            'updatedId',
            'created',
            'updated',
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
            'thresholdBit',
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

    # May not work if model is not initialized when load
    def _onItemRemove(self, event):
        item = event.info
        for overlay in self.find({'itemId': str(item['_id'])}):
            self.remove(overlay)
        for overlay in self.find({'overlayItemId': str(item['_id'])}):
            self.remove(overlay)

    def _getMaxIndex(self, itemId):
        for overlay in self.find({'itemId': itemId},
                                 sort=[('index', SortDir.DESCENDING)],
                                 fields=['index']):
            return overlay['index'] + 1
        return 0

    def createOverlay(self, overlay, creator):
        now = datetime.datetime.utcnow()
        doc = {
            'creatorId': creator['_id'],
            'updatedId': creator['_id'],
            'created': now,
            'updated': now,
        }
        doc.update(overlay)
        doc['index'] = self._getMaxIndex(doc['itemId'])

        return self.save(doc)

    def updateOverlay(self, overlay, user=None):
        overlay['updated'] = datetime.datetime.utcnow()
        if user is not None:
            overlay['updatedId'] = user['_id']
        return self.save(overlay)

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
        self.validateIndex(doc)
        return doc

    # TODO: move to collection?
    def validateIndex(self, overlay):
        query = {'itemId': overlay['itemId'], 'index': overlay['index']}
        if len(list(self.find(query, limit=2))) > 1:
            message = 'Duplicate index value %d' % overlay['index']
            raise ValidationException(message, 'index')

    # TODO: move to collection?
    def updateIndex(self, overlay):
        query = {'itemId': overlay['itemId']}
        sort = [('index', SortDir.ASCENDING), ('created', SortDir.ASCENDING)]
        for i, overlay in enumerate(self.find(query, sort=sort)):
            overlay['index'] = i
            self.save(overlay)
