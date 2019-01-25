#!/usr/bin/env python
# -*- coding: utf-8 -*-

#############################################################################
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
#############################################################################

import json

from tests import base

from girder.models.folder import Folder
from girder.models.user import User
from girder.models.item import Item


def setUpModule():
    base.enabledPlugins.append('overlays')
    base.startServer()


def tearDownModule():
    base.stopServer()


class OverlaysTestCase(base.TestCase):
    def setUp(self):
        base.TestCase.setUp(self)

        self.users = [
            User().createUser(
                'user%d' % n,
                'testpassword',
                'Test',
                'User',
                'user%d@example.com' % n
            ) for n in [0, 1]
        ]

        folders = Folder().childFolders(self.users[0], 'user',
                                        user=self.users[0])
        for folder in folders:
            if folder['name'] == 'Public':
                self.publicFolder = folder
            else:
                self.privateFolder = folder


class OverlaysRESTTestCase(OverlaysTestCase):
    def _createItem(self, parentId, name, description, user):
        params = {
            'name': name,
            'description': description,
            'folderId': parentId
        }
        resp = self.request(path='/item', method='POST', params=params,
                            user=user)
        self.assertStatusOk(resp)
        return resp.json

    def _createOverlay(self, name='Test overlay', user=None):
        if user is None:
            user = self.users[0]
        parentItem = self._createItem(self.publicFolder['_id'], 'parent',
                                      'Parent item of overlay', user)
        overlayItem = self._createItem(self.publicFolder['_id'], 'overlay',
                                       'Overlay item', user)
        body = {
            'itemId': parentItem['_id'],
            'overlayItemId': overlayItem['_id'],
            'name': name
        }
        overlay = self.request(
            path='/overlay',
            method='POST',
            user=user,
            type='application/json',
            body=json.dumps(body),
        )
        return parentItem, overlayItem, overlay

    def _getOverlay(self, id, user=None):
        if user is None:
            user = self.users[0]
        response = self.request(
            path='/overlay/%s' % id,
            method='GET',
            user=self.users[0]
        )
        return response.json

    def testOverlayCreate(self):
        parentItem = self._createItem(self.publicFolder['_id'], 'parent',
                                      'Parent item of overlay', self.users[0])
        overlayItem = self._createItem(self.publicFolder['_id'], 'overlay',
                                       'Overlay item', self.users[0])
        body = {
            'itemId': parentItem['_id'],
            'overlayItemId': overlayItem['_id']
        }

        overlay = self.request(
            path='/overlay',
            method='POST',
            user=self.users[0],
            type='application/json',
            body=json.dumps(body),
        )
        self.assertValidationError(overlay, 'name')

        body['name'] = 'Test overlay'

        overlay = self.request(
            path='/overlay',
            method='POST',
            user=self.users[0],
            type='application/json',
            body=json.dumps(body)
        )
        self.assertStatusOk(overlay)

        parentItem = self._createItem(self.privateFolder['_id'], 'parent',
                                      'Parent item of overlay', self.users[0])
        body['itemId'] = parentItem['_id']
        overlay = self.request(
            path='/overlay',
            method='POST',
            user=self.users[1],
            type='application/json',
            body=json.dumps(body)
        )
        self.assertStatus(overlay, 403)

    def testOverlayFind(self):
        name = 'Test find'
        user = self.users[0]
        self._createOverlay(name, user)
        overlays = self.request(
            path='/overlay',
            method='GET',
            user=user
        )
        self.assertStatusOk(overlays)
        self.assertEqual(len(overlays.json), 1)
        self.assertEqual(overlays.json[0]['name'], name)

        overlays = self.request(
            path='/overlay',
            method='GET',
            user=self.users[1]
        )
        self.assertStatusOk(overlays)
        self.assertEqual(len(overlays.json), 0)

    def testOverlayFindByItem(self):
        name = 'Test find by item'
        user = self.users[0]
        parentItem, _, _ = self._createOverlay(name, user)
        overlays = self.request(
            path='/overlay',
            method='GET',
            user=user,
            params={'itemId': parentItem['_id']}
        )
        self.assertStatusOk(overlays)
        self.assertEqual(len(overlays.json), 1)
        self.assertEqual(overlays.json[0]['name'], name)

    def testOverlayGet(self):
        self._createOverlay()
        _, _, overlay = self._createOverlay()
        created = overlay.json
        response = self.request(
            path='/overlay/%s' % created['_id'],
            method='GET',
            user=self.users[0]
        )
        self.assertStatusOk(response)
        self.assertTrue(response.json)
        found = response.json
        for key in ('_id', 'itemId', 'overlayItemId', 'name'):
            self.assertEqual(created.get(key), found.get(key))

    def testOverlayDelete(self):
        _, _, overlay = self._createOverlay()
        response = self.request(
            path='/overlay/%s' % overlay.json['_id'],
            method='DELETE',
            user=self.users[0]
        )
        self.assertStatusOk(response)

        _, _, overlay = self._createOverlay()
        response = self.request(
            path='/overlay/%s' % overlay.json['_id'],
            method='DELETE',
            user=self.users[1]
        )
        self.assertStatus(response, 403)

    def testOverlayUpdate(self):
        name = 'Original name'
        _, _, overlay = self._createOverlay(name)
        overlayId = overlay.json['_id']
        self.assertEqual(name, self._getOverlay(overlayId)['name'])

        newName = 'New name'

        response = self.request(
            path='/overlay/%s' % overlayId,
            method='PUT',
            user=self.users[0],
            type='application/json',
            body=json.dumps({
                'name': newName,
                'creatorId': str(self.users[1]['_id']),
            }),
        )
        self.assertStatus(response, 403)

        response = self.request(
            path='/overlay/%s' % overlayId,
            method='PUT',
            user=self.users[0],
            type='application/json',
            body=json.dumps({'name': newName}),
        )
        self.assertStatusOk(response)
        self.assertEqual(newName, self._getOverlay(overlayId)['name'])

        parentItem = self._createItem(self.publicFolder['_id'], 'new parent',
                                      'New parent item of overlay',
                                      self.users[0])
        response = self.request(
            path='/overlay/%s' % overlayId,
            method='PUT',
            user=self.users[0],
            type='application/json',
            body=json.dumps({'itemId': str(parentItem['_id'])}),
        )
        self.assertStatusOk(response)
        self.assertEqual(parentItem['_id'],
                         self._getOverlay(overlayId)['itemId'])

        parentItem = self._createItem(self.privateFolder['_id'],
                                      'someone else\'s parent',
                                      'Someone else\'s parent item',
                                      self.users[0])
        response = self.request(
            path='/overlay/%s' % overlayId,
            method='PUT',
            user=self.users[1],
            type='application/json',
            body=json.dumps({'itemId': str(parentItem['_id'])}),
        )
        self.assertStatus(response, 403)

        overlayItem = self._createItem(self.publicFolder['_id'], 'new overlay',
                                       'New overlay item', self.users[0])
        response = self.request(
            path='/overlay/%s' % overlayId,
            method='PUT',
            user=self.users[0],
            type='application/json',
            body=json.dumps({'overlayItemId': str(overlayItem['_id'])}),
        )
        self.assertStatusOk(response)
        self.assertEqual(overlayItem['_id'],
                         self._getOverlay(overlayId)['overlayItemId'])

        overlayItem = self._createItem(self.privateFolder['_id'],
                                       'someone else\'s overlay',
                                       'Someone else\'s overlay item',
                                       self.users[0])
        response = self.request(
            path='/overlay/%s' % overlayId,
            method='PUT',
            user=self.users[1],
            type='application/json',
            body=json.dumps({'overlayItemId': str(overlayItem['_id'])}),
        )
        self.assertStatus(response, 403)


class OverlaysModelTestCase(OverlaysTestCase):
    def testOverlayUpdate(self):
        from girder.plugins.overlays.models.overlay import Overlay

        item = Item().createItem('Test item', self.users[0], self.publicFolder)
        overlayItem = Item().createItem('Test overlay item', self.users[0],
                                        self.publicFolder)
        overlay = {
            'name': 'Test overlay',
        }
        overlay = Overlay().createOverlay(item, overlayItem, self.users[0],
                                          **overlay)
        overlay = Overlay().load(overlay['_id'], user=self.users[0])
        Overlay().updateOverlay(overlay)
