(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
var L = (typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null)
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./layout.css":2,"./range.css":4}],2:[function(require,module,exports){
var inject = require('./node_modules/cssify');
var css = ".leaflet-sbs-range {\n    position: absolute;\n    top: 50%;\n    width: 100%;\n    z-index: 999;\n}\n.leaflet-sbs-range-horizontal {\n    position: absolute;\n    top: 50%;\n    /* fix for strange positioning */\n    left: calc(50% - 50vh);\n    right: 50%;\n    bottom:0;\n    z-index: 999;\n}\n.leaflet-sbs-divider {\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 50%;\n    margin-left: -2px;\n    width: 4px;\n    background-color: #fff;\n    pointer-events: none;\n    z-index: 999;\n}\n.leaflet-sbs-divider-horizontal {\n    position: absolute;\n    top: 50%;\n    left: 0;\n    right: 0;\n    margin-top: -2px;\n    height: 4px;\n    background-color: #fff;\n    pointer-events: none;\n    z-index: 999;\n}\n";
inject(css, undefined, '_87oguh');
module.exports = css;

},{"./node_modules/cssify":3}],3:[function(require,module,exports){
'use strict'

function injectStyleTag (document, fileName, cb) {
  var style = document.getElementById(fileName)

  if (style) {
    cb(style)
  } else {
    var head = document.getElementsByTagName('head')[0]

    style = document.createElement('style')
    if (fileName != null) style.id = fileName
    cb(style)
    head.appendChild(style)
  }

  return style
}

module.exports = function (css, customDocument, fileName) {
  var doc = customDocument || document
  /* istanbul ignore if: not supported by Electron */
  if (doc.createStyleSheet) {
    var sheet = doc.createStyleSheet()
    sheet.cssText = css
    return sheet.ownerNode
  } else {
    return injectStyleTag(doc, fileName, function (style) {
      /* istanbul ignore if: not supported by Electron */
      if (style.styleSheet) {
        style.styleSheet.cssText = css
      } else {
        style.innerHTML = css
      }
    })
  }
}

module.exports.byUrl = function (url) {
  /* istanbul ignore if: not supported by Electron */
  if (document.createStyleSheet) {
    return document.createStyleSheet(url).ownerNode
  } else {
    var head = document.getElementsByTagName('head')[0]
    var link = document.createElement('link')

    link.rel = 'stylesheet'
    link.href = url

    head.appendChild(link)
    return link
  }
}

},{}],4:[function(require,module,exports){
var inject = require('./node_modules/cssify');
var css = ".leaflet-sbs-range {\n    -webkit-appearance: none;\n    display: inline-block!important;\n    vertical-align: middle;\n    height: 0;\n    padding: 0;\n    margin: 0;\n    border: 0;\n    background: rgba(0, 0, 0, 0.25);\n    min-width: 100px;\n    cursor: pointer;\n    pointer-events: none;\n    z-index: 999;\n}\n.leaflet-sbs-range::-ms-fill-upper {\n    background: transparent;\n}\n.leaflet-sbs-range::-ms-fill-lower {\n    background: rgba(255, 255, 255, 0.25);\n}\n/* Browser thingies */\n\n.leaflet-sbs-range::-moz-range-track {\n    opacity: 0;\n}\n.leaflet-sbs-range::-ms-track {\n    opacity: 0;\n}\n.leaflet-sbs-range::-ms-tooltip {\n    display: none;\n}\n/* For whatever reason, these need to be defined\n * on their own so dont group them */\n\n.leaflet-sbs-range::-webkit-slider-thumb {\n    -webkit-appearance: none;\n    margin: 0;\n    padding: 0;\n    background: #fff;\n    height: 40px;\n    width: 40px;\n    border-radius: 20px;\n    cursor: ew-resize;\n    pointer-events: auto;\n    border: 1px solid #ddd;\n    background-image: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAABlBMVEV9fX3///+Kct39AAAAAnRSTlP/AOW3MEoAAAA9SURBVFjD7dehDQAwDANBZ/+l2wmKoiqR7pHRcaeaCxAIBAL/g7k9JxAIBAKBQCAQCAQC14H+MhAIBE4CD3fOFvGVBzhZAAAAAElFTkSuQmCC\");\n    background-position: 50% 50%;\n    background-repeat: no-repeat;\n    background-size: 40px 40px;\n}\n.leaflet-sbs-range::-ms-thumb {\n    margin: 0;\n    padding: 0;\n    background: #fff;\n    height: 40px;\n    width: 40px;\n    border-radius: 20px;\n    cursor: ew-resize;\n    pointer-events: auto;\n    border: 1px solid #ddd;\n    background-image: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAABlBMVEV9fX3///+Kct39AAAAAnRSTlP/AOW3MEoAAAA9SURBVFjD7dehDQAwDANBZ/+l2wmKoiqR7pHRcaeaCxAIBAL/g7k9JxAIBAKBQCAQCAQC14H+MhAIBE4CD3fOFvGVBzhZAAAAAElFTkSuQmCC\");\n    background-position: 50% 50%;\n    background-repeat: no-repeat;\n    background-size: 40px 40px;\n}\n.leaflet-sbs-range::-moz-range-thumb {\n    padding: 0;\n    right: 0    ;\n    background: #fff;\n    height: 40px;\n    width: 40px;\n    border-radius: 20px;\n    cursor: ew-resize;\n    pointer-events: auto;\n    border: 1px solid #ddd;\n    background-image: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAABlBMVEV9fX3///+Kct39AAAAAnRSTlP/AOW3MEoAAAA9SURBVFjD7dehDQAwDANBZ/+l2wmKoiqR7pHRcaeaCxAIBAL/g7k9JxAIBAKBQCAQCAQC14H+MhAIBE4CD3fOFvGVBzhZAAAAAElFTkSuQmCC\");\n    background-position: 50% 50%;\n    background-repeat: no-repeat;\n    background-size: 40px 40px;\n}\n.leaflet-sbs-range:disabled::-moz-range-thumb {\n    cursor: default;\n}\n.leaflet-sbs-range:disabled::-ms-thumb {\n    cursor: default;\n}\n.leaflet-sbs-range:disabled::-webkit-slider-thumb {\n    cursor: default;\n}\n.leaflet-sbs-range:disabled {\n    cursor: default;\n}\n.leaflet-sbs-range:focus {\n    outline: none!important;\n}\n.leaflet-sbs-range::-moz-focus-outer {\n    border: 0;\n}\n\n.leaflet-sbs-range-horizontal {\n    -webkit-appearance: none;\n    display: inline-block!important;\n    height: 0;\n    padding: 0;\n    margin: 0;\n    border: 0;\n    background: rgba(0, 0, 0, 0);\n    min-width: 100px;\n    cursor: pointer;\n    pointer-events: none;\n    -webkit-transform:rotate(90deg);\n    -moz-transform:rotate(90deg);\n    -o-transform:rotate(90deg);\n    -ms-transform:rotate(90deg);\n    transform:rotate(90deg);\n}\n.leaflet-sbs-range-horizontal::-ms-fill-upper {\n    background: transparent;\n}\n.leaflet-sbs-range-horizontal::-ms-fill-lower {\n    background: rgba(255, 255, 255, 0);\n}\n/* Browser thingies */\n\n.leaflet-sbs-range-horizontal::-moz-range-track {\n    opacity: 0;\n}\n.leaflet-sbs-range-horizontal::-ms-track {\n    opacity: 0;\n}\n.leaflet-sbs-range-horizontal::-ms-tooltip {\n    display: none;\n}\n/* For whatever reason, these need to be defined\n * on their own so dont group them */\n\n.leaflet-sbs-range-horizontal::-webkit-slider-thumb {\n    -webkit-appearance: none;\n    margin: 0;\n    padding: 0;\n    background: #fff;\n    height: 40px;\n    width: 40px;\n    border-radius: 20px;\n    cursor: ew-resize;\n    pointer-events: auto;\n    border: 1px solid #ddd;\n    background-image: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAABlBMVEV9fX3///+Kct39AAAAAnRSTlP/AOW3MEoAAAA9SURBVFjD7dehDQAwDANBZ/+l2wmKoiqR7pHRcaeaCxAIBAL/g7k9JxAIBAKBQCAQCAQC14H+MhAIBE4CD3fOFvGVBzhZAAAAAElFTkSuQmCC\");\n    background-position: 50% 50%;\n    background-repeat: no-repeat;\n    background-size: 40px 40px;\n}\n.leaflet-sbs-range-horizontal::-ms-thumb {\n    margin: 0;\n    padding: 0;\n    background: #fff;\n    height: 40px;\n    width: 40px;\n    border-radius: 20px;\n    cursor: ew-resize;\n    pointer-events: auto;\n    border: 1px solid #ddd;\n    background-image: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAABlBMVEV9fX3///+Kct39AAAAAnRSTlP/AOW3MEoAAAA9SURBVFjD7dehDQAwDANBZ/+l2wmKoiqR7pHRcaeaCxAIBAL/g7k9JxAIBAKBQCAQCAQC14H+MhAIBE4CD3fOFvGVBzhZAAAAAElFTkSuQmCC\");\n    background-position: 50% 50%;\n    background-repeat: no-repeat;\n    background-size: 40px 40px;\n}\n.leaflet-sbs-range-horizontal::-moz-range-thumb {\n    padding: 0;\n    right: 0    ;\n    background: #fff;\n    height: 40px;\n    width: 40px;\n    border-radius: 20px;\n    cursor: ew-resize;\n    pointer-events: auto;\n    border: 1px solid #ddd;\n    background-image: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAABlBMVEV9fX3///+Kct39AAAAAnRSTlP/AOW3MEoAAAA9SURBVFjD7dehDQAwDANBZ/+l2wmKoiqR7pHRcaeaCxAIBAL/g7k9JxAIBAKBQCAQCAQC14H+MhAIBE4CD3fOFvGVBzhZAAAAAElFTkSuQmCC\");\n    background-position: 50% 50%;\n    background-repeat: no-repeat;\n    background-size: 40px 40px;\n}\n.leaflet-sbs-range-horizontal:disabled::-moz-range-thumb {\n    cursor: default;\n}\n.leaflet-sbs-range-horizontal:disabled::-ms-thumb {\n    cursor: default;\n}\n.leaflet-sbs-range-horizontal:disabled::-webkit-slider-thumb {\n    cursor: default;\n}\n.leaflet-sbs-range-horizontal:disabled {\n    cursor: default;\n}\n.leaflet-sbs-range-horizontal:focus {\n    outline: none!important;\n}\n.leaflet-sbs-range-horizontal::-moz-focus-outer {\n    border: 0;\n}\n\n\n";
inject(css, undefined, '_1fr81xo');
module.exports = css;

},{"./node_modules/cssify":3}]},{},[1]);
