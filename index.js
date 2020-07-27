var L = require('leaflet')
require('./layout.css')
require('./range.css')

var mapWasDragEnabled
var mapWasTapEnabled

// Leaflet v0.7 backwards compatibility
function on (el, types, fn, context) {
  types.split(' ').forEach(function (type) {
    L.DomEvent.on(el, type, fn, context)
  })
}

// Leaflet v0.7 backwards compatibility
function off (el, types, fn, context) {
  types.split(' ').forEach(function (type) {
    L.DomEvent.off(el, type, fn, context)
  })
}

function getRangeEvent (rangeInput) {
  return 'oninput' in rangeInput ? 'input' : 'change'
}

function cancelMapDrag () {
  mapWasDragEnabled = this._map.dragging.enabled()
  mapWasTapEnabled = this._map.tap && this._map.tap.enabled()
  this._map.dragging.disable()
  this._map.tap && this._map.tap.disable()
}

function uncancelMapDrag (e) {
  this._refocusOnMap(e)
  if (mapWasDragEnabled) {
    this._map.dragging.enable()
  }
  if (mapWasTapEnabled) {
    this._map.tap.enable()
  }
}

// convert arg to an array - returns empty array if arg is undefined
function asArray (arg) {
  return (arg === 'undefined') ? [] : Array.isArray(arg) ? arg : [arg]
}

function noop () {}

L.Control.SideBySide = L.Control.extend({
  options: {
    thumbSize: 42,
    padding: 0,
    vertical: true
  },

  _setOrientation: function (vertical) {
    this.options.vertical = vertical
    this.addTo(this._map)
  },

  initialize: function (leftLayers, rightLayers, options) {
    this.setLeftLayers(leftLayers)
    this.setRightLayers(rightLayers)
    L.setOptions(this, options)
  },

  getPosition: function () {
    var rangeValue = this._range.value
    var offset = (0.5 - rangeValue) * (2 * this.options.padding + this.options.thumbSize)
    if (this.options.vertical) {
      return this._map.getSize().x * rangeValue + offset
    } else {
      return this._map.getSize().y * rangeValue + offset
    }
  },

  setPosition: noop,

  includes: L.Evented.prototype || L.Mixin.Events,

  addTo: function (map) {
    this.remove()
    this._map = map

    var container = this._container = L.DomUtil.create('div', 'leaflet-sbs', map._controlContainer)
    var range
    if (this.options.vertical) {
      this._divider = L.DomUtil.create('div', 'leaflet-sbs-divider', container)
      range = this._range = L.DomUtil.create('input', 'leaflet-sbs-range', container)
      range.style.paddingLeft = range.style.paddingRight = this.options.padding + 'px'
      range.style.minHeight = 0
      range.style.minWidth = '100%'
    } else {
      this._divider = L.DomUtil.create('div', 'leaflet-sbs-divider-horizontal', container)
      range = this._range = L.DomUtil.create('input', 'leaflet-sbs-range-horizontal', container)
      range.style.paddingTop = range.style.paddingBottom = this.options.padding + 'px'
      // range.style.minHeight = '100vw'
      range.style.minWidth = '100vh'
    }
    range.type = 'range'
    range.min = 0
    range.max = 1
    range.step = 'any'
    range.value = 0.5
    this._addEvents()
    this._updateLayers()
    return this
  },

  remove: function () {
    if (!this._map) {
      return this
    }
    if (this._leftLayer) {
      this._leftLayer.getContainer().style.clip = ''
    }
    if (this._rightLayer) {
      this._rightLayer.getContainer().style.clip = ''
    }
    this._removeEvents()
    L.DomUtil.remove(this._container)

    this._map = null

    return this
  },

  setLeftLayers: function (leftLayers) {
    this._leftLayers = asArray(leftLayers)
    this._updateLayers()
    return this
  },

  setRightLayers: function (rightLayers) {
    this._rightLayers = asArray(rightLayers)
    this._updateLayers()
    return this
  },

  _updateClip: function () {
    var map = this._map
    var nw = map.containerPointToLayerPoint([0, 0])
    var se = map.containerPointToLayerPoint(map.getSize())
    if (this.options.vertical) {
      var clipX = nw.x + this.getPosition()
      var dividerX = this.getPosition()

      this._divider.style.left = dividerX + 'px'
      this.fire('dividermove', {x: dividerX})
      var clipLeft = 'rect(' + [nw.y, clipX, se.y, nw.x].join('px,') + 'px)'
      var clipRight = 'rect(' + [nw.y, se.x, se.y, clipX].join('px,') + 'px)'
      if (this._leftLayer) {
        this._leftLayer.getContainer().style.clip = clipLeft
      }
      if (this._rightLayer) {
        this._rightLayer.getContainer().style.clip = clipRight
      }
    } else {
      var clipY = nw.y + this.getPosition()
      var dividerY = this.getPosition()

      this._divider.style.top = dividerY + 'px'
      this.fire('dividermove', {y: dividerY})
      var clipTop = 'rect(' + [nw.y, se.x, clipY, nw.x].join('px,') + 'px)'
      var clipBottom = 'rect(' + [clipY, se.x, se.y, nw.x].join('px,') + 'px)'
      if (this._leftLayer) {
        this._leftLayer.getContainer().style.clip = clipTop
      }
      if (this._rightLayer) {
        this._rightLayer.getContainer().style.clip = clipBottom
      }
    }
  },

  _updateLayers: function () {
    if (!this._map) {
      return this
    }
    var prevLeft = this._leftLayer
    var prevRight = this._rightLayer
    this._leftLayer = this._rightLayer = null
    this._leftLayers.forEach(function (layer) {
      if (this._map.hasLayer(layer)) {
        this._leftLayer = layer
      }
    }, this)
    this._rightLayers.forEach(function (layer) {
      if (this._map.hasLayer(layer)) {
        this._rightLayer = layer
      }
    }, this)
    if (prevLeft !== this._leftLayer) {
      prevLeft && this.fire('leftlayerremove', {layer: prevLeft})
      this._leftLayer && this.fire('leftlayeradd', {layer: this._leftLayer})
    }
    if (prevRight !== this._rightLayer) {
      prevRight && this.fire('rightlayerremove', {layer: prevRight})
      this._rightLayer && this.fire('rightlayeradd', {layer: this._rightLayer})
    }
    this._updateClip()
  },

  _addEvents: function () {
    var range = this._range
    var map = this._map
    if (!map || !range) return
    map.on('move', this._updateClip, this)
    map.on('layeradd layerremove', this._updateLayers, this)
    on(range, getRangeEvent(range), this._updateClip, this)
    on(range, L.Browser.touch ? 'touchstart' : 'mousedown', cancelMapDrag, this)
    on(range, L.Browser.touch ? 'touchend' : 'mouseup', uncancelMapDrag, this)
  },

  _removeEvents: function () {
    var range = this._range
    var map = this._map
    if (range) {
      off(range, getRangeEvent(range), this._updateClip, this)
      off(range, L.Browser.touch ? 'touchstart' : 'mousedown', cancelMapDrag, this)
      off(range, L.Browser.touch ? 'touchend' : 'mouseup', uncancelMapDrag, this)
    }
    if (map) {
      map.off('layeradd layerremove', this._updateLayers, this)
      map.off('move', this._updateClip, this)
    }
  }
})

L.control.sideBySide = function (leftLayers, rightLayers, options) {
  return new L.Control.SideBySide(leftLayers, rightLayers, options)
}

module.exports = L.Control.SideBySide
