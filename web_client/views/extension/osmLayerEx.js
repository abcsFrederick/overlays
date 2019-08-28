function registerLayer(geo) {
    var modulo = function (a, b) {
        return ((a % b) + b) % b;
    };
    geo.osmLayerEx = function (args) {
        var imageTile = geo.imageTile;
        // Constructors take a single object to hold options passed to each
        // constructor in the class hierarchy.  The default is usually an
        // empty object.
        args = args || {};

        // Here we handle calling the constructor again with a new object
        // when necessary.
        if (!(this instanceof geo.osmLayerEx)) {
            // eslint-disable-next-line
            return new geo.osmLayerEx(args);
        }
        if (args.mapOpacity !== undefined && args.opacity === undefined) {
            args.opacity = args.mapOpacity;
        }
        // Call the parent class's constructor.
        geo.tileLayer.call(this, args);

        this.mapOpacity = this.opacity;

        // eslint-disable-next-line
        var m_this = this, m_lastTileSet = [];
        this._getTiles = function (maxLevel, bounds, sorted, onlyIfChanged) {
            var i, j, tiles = [], index, nTilesLevel,
                start, end, indexRange, source, center, changed = false, old, level,
                minLevel = (m_this._options.keepLower ? m_this._options.minLevel : maxLevel);
            if (maxLevel < minLevel) {
                maxLevel = minLevel;
            }
            if (minLevel > m_this._options.maxLevel) {
                minLevel = m_this._options.maxLevel;
            }
            /* Generate a list of the tiles that we want to create.  This is done
            * before sorting, because we want to actually generate the tiles in
            * the sort order. */
            for (level = minLevel; level <= maxLevel; level += 1) {
                // get the tile range to fetch
                indexRange = m_this._getTileRange(level, bounds);
                start = indexRange.start;
                end = indexRange.end;
                // total number of tiles existing at m_this level
                nTilesLevel = m_this.tilesAtZoom(level);

                if (!m_this._options.wrapX) {
                    start.x = Math.min(Math.max(start.x, 0), nTilesLevel.x - 1);
                    end.x = Math.min(Math.max(end.x, 0), nTilesLevel.x - 1);
                    if (level === minLevel && m_this._options.keepLower) {
                        start.x = 0;
                        end.x = nTilesLevel.x - 1;
                    }
                }
                if (!m_this._options.wrapY) {
                    start.y = Math.min(Math.max(start.y, 0), nTilesLevel.y - 1);
                    end.y = Math.min(Math.max(end.y, 0), nTilesLevel.y - 1);
                    if (level === minLevel && m_this._options.keepLower) {
                        start.y = 0;
                        end.y = nTilesLevel.y - 1;
                    }
                }
                /* If we are reprojecting tiles, we need a check to not use all levels
                * if the number of tiles is excessive. */
                if (m_this._options.gcs && m_this._options.gcs !== m_this.map().gcs() &&
                    level !== minLevel &&
                    (end.x + 1 - start.x) * (end.y + 1 - start.y) >
                    (m_this.map().size().width * m_this.map().size().height /
                    m_this._options.tileWidth / m_this._options.tileHeight) * 16) {
                    break;
                }

                // loop over the tile range
                for (i = start.x; i <= end.x; i += 1) {
                    for (j = start.y; j <= end.y; j += 1) {
                        index = {level: level, x: i, y: j};
                        source = {level: level, x: i, y: j};
                        if (m_this._options.wrapX) {
                            source.x = modulo(source.x, nTilesLevel.x);
                        }
                        if (m_this._options.wrapY) {
                            source.y = modulo(source.y, nTilesLevel.y);
                        }
                        if (m_this.isValid(source)) {
                            if (onlyIfChanged && tiles.length < m_lastTileSet.length) {
                                old = m_lastTileSet[tiles.length];
                                changed = changed || (index.level !== old.level ||
                                index.x !== old.x || index.y !== old.y);
                            }
                            tiles.push({index: index, source: source});
                        }
                    }
                }
            }
            if (onlyIfChanged) {
                if (!changed && tiles.length === m_lastTileSet.length) {
                    return;
                }
                m_lastTileSet.splice(0, m_lastTileSet.length);
                // eslint-disable-next-line
                $.each(tiles, function (idx, tile) {
                    m_lastTileSet.push(tile.index);
                });
            }

            if (sorted) {
                center = {
                    x: (start.x + end.x) / 2,
                    y: (start.y + end.y) / 2,
                    level: maxLevel,
                    bottomLevel: maxLevel
                };
                var numTiles = Math.max(end.x - start.x, end.y - start.y) + 1;
                for (; numTiles >= 1; numTiles /= 2) {
                    center.bottomLevel -= 1;
                }
                tiles.sort(m_this._loadMetric(center));
                /* If we are using a fetch queue, start a new batch */
                if (m_this._queue) {
                    m_this._queue.batch(true);
                }
            }
            if (m_this.cache.size < tiles.length) {
                console.log('Increasing cache size to ' + tiles.length);
                m_this.cache.size = tiles.length;
            }
            /* Actually get the tiles. */
            for (i = 0; i < tiles.length; i += 1) {
                tiles[i] = m_this._getTileCached(tiles[i].index, tiles[i].source, true);
            }
            m_this.cache.purge(m_this.remove);
            return tiles;
        };

        this._canPurge = function (tile, bounds, zoom, doneLoading) {
            if (m_this._options.keepLower) {
                zoom = zoom || 0;
                if (zoom < tile.index.level &&
                    tile.index.level !== m_this._options.minLevel) {
                    return true;
                }
                if (tile.index.level === m_this._options.minLevel &&
                    !m_this._options.wrapX && !m_this._options.wrapY) {
                    return false;
                }
            } else {
                /* For tile layers that should only keep one layer, if loading is
                * finished, purge all but the current layer.  This is important for
                * semi-transparanet layers. */
                if ((doneLoading || m_this._isCovered(tile)) &&
                    zoom !== tile.index.level) {
                    if (zoom > m_this.options.maxLevel) {
                        if (zoom !== tile.index.level + 1) {
                            return true;
                        } else {
                            return false;
                        }
                    }
                    return true;
                }
            }
            if (bounds) {
                return m_this._outOfBounds(tile, bounds);
            }
            return false;
        };
        this._getTile = function (index, source) {
            var urlParams = source || index;
            return imageTile({
                index: index,
                size: {x: this._options.tileWidth, y: this._options.tileHeight},
                queue: this._queue,
                overlap: this._options.tileOverlap,
                scale: this._options.tileScale,
                url: this._options.url.call(
                    this, urlParams.x, urlParams.y, urlParams.level || 0,
                    this._options.subdomains),
                crossDomain: this._options.crossDomain
            });
        }.bind(this);
        return this;
    };
    geo.osmLayerEx.defaults = $.extend({}, geo.tileLayer.defaults, {
        tileOffset: function (level) {
            var s = Math.pow(2, level - 1) * 256;
            return {x: s, y: s};
        },
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: 'Tile data &copy; <a href="https://osm.org/copyright">' +
            'OpenStreetMap</a> contributors'
    });
    // Initialize the class prototype.
    geo.inherit(geo.osmLayerEx, geo.tileLayer);

    geo.registerLayer('osmEx', geo.osmLayerEx, [geo.quadFeature.capabilities.image]);
}
export default registerLayer;
