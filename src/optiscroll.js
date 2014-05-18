
/**
 * Optiscroll, use this to create instances
 * ```
 * var scrolltime = new Optiscroll(element);
 * ```
 */
var Optiscroll = function Optiscroll(element, options) {
  return new Optiscroll.Instance(element, options || {});
};


  
var GS = Optiscroll.globalSettings = {
  scrollMinUpdateInterval: 1000 / 40, // 40 FPS
  checkFrequency: 1000,
  pauseCheck: false
};

Optiscroll.defaults = {
  preventParentScroll: false,
  forceScrollbars: false,
  scrollStopDelay: 300,
  maxTrackSize: 95,
  minTrackSize: 5,
  draggableTracks: true,
  autoUpdate: true,
  classPrefix: 'optiscroll'
};



Optiscroll.Instance = function ( element, options ) {
  var me = this;
  
  me.element = element;
  me.scrollEl = element.children[0];
  
  // instance variables
  me.settings = _extend( _extend({}, Optiscroll.defaults), options || {});
  
  me.cache = {};
  
  me.init();
};



Optiscroll.Instance.prototype.init = function () {
  var me = this,
      settings = me.settings;

  // add instance to global array for timed check
  if(settings.autoUpdate) {
    G.instances.push( me );
  }

  // initialize scrollbars
  me.scrollbars = { 
    v: new Scrollbar('v', me), 
    h: new Scrollbar('h', me) 
  };

  // disable forced scrollbars if Firefox 
  // because we cannot hide native scrollbars yet
  if(G.nativeScrollbarSize === 0 && 'mozRequestAnimationFrame' in window) {
    settings.forceScrollbars = false;
  }

  // create DOM scrollbars only if they have size or if it's forced
  if(G.nativeScrollbarSize || settings.forceScrollbars) {
    Utils.hideNativeScrollbars(me.scrollEl);
    _invoke(me.scrollbars, 'create');
  } 

  if(G.isTouch && settings.preventParentScroll) {
    toggleClass(me.element, settings.classPrefix+'-nobounce', true);
  }

  // calculate scrollbars
  me.update();

  // bind container events
  me.bind();

  // start the timed check if it is not already running
  if(settings.autoUpdate && !G.checkTimer) {
    Utils.checkLoop();
  }

};

  

Optiscroll.Instance.prototype.bind = function () {
  var me = this,
      listeners = me.listeners = {},
      scrollEl = me.scrollEl;

  // scroll event binding
  listeners.scroll = _throttle(function (ev) { 
    Events.scroll(ev, me); 
  }, GS.scrollMinUpdateInterval);

  // overflow events bindings (non standard, moz + webkit)
  // to update scrollbars immediately 
  listeners.overflow = listeners.underflow = listeners.overflowchanged = function (ev) { me.update(); };

  if(G.isTouch) {
    listeners.touchstart = function (ev) { Events.touchstart(ev, me); };
    listeners.touchend = function (ev) { Events.touchend(ev, me); };
  }

  if(me.settings.preventParentScroll) {
     // Safari does not support wheel event
    listeners.mousewheel = listeners.wheel = function (ev) { Events.wheel(ev, me); };
  }

  for (var ev in listeners) {
    scrollEl.addEventListener(ev, listeners[ev]);
  }

};




Optiscroll.Instance.prototype.update = function () {
  var me = this,
      oldcH = me.cache.clientH,
      scrollEl = me.scrollEl,
      cache = me.cache,
      sH = scrollEl.scrollHeight,
      cH = scrollEl.clientHeight,
      sW = scrollEl.scrollWidth,
      cW = scrollEl.clientWidth;
  
  if( sH !== cache.scrollH || cH !== cache.clientH || 
    sW !== cache.scrollW || cW !== cache.clientW ) {
    
    // if the element is no more in the DOM
    if(sH === 0 && cH === 0 && !document.body.contains(me.element)) {
      me.destroy();
      return false;
    }

    cache.scrollH = sH;
    cache.clientH = cH;
    cache.scrollW = sW;
    cache.clientW = cW;

    // only fire if cache was defined
    if( oldcH !== undefined ) {
      me.fireCustomEvent('sizechange');
    }

    // this will update the scrollbar
    // and check if bottom is reached
    _invoke(me.scrollbars, 'update');
  }
};




/**
 * Animate scrollTo
 * ```
 * $(el).optiscroll('scrollTo', 'left', 100, 200) // scrolls x,y in 200ms
 * ```
 */
Optiscroll.Instance.prototype.scrollTo = function (destX, destY, duration, disableEvents) {
  var me = this,
      cache = me.cache,
      startX, startY, endX, endY;

  G.pauseCheck = true;
  // force update
  me.update();

  startX = endX = me.scrollEl.scrollLeft;
  startY = endY = me.scrollEl.scrollTop;
  
  if (typeof destX === 'string') { // left or right
    endX = (destX === 'left') ? 0 : cache.scrollW - cache.clientW;
  } else if (typeof destX === 'number') { // num - not false
    endX = destX;
  }

  if (typeof destY === 'string') { // top or bottom
    endY = (destY === 'top') ? 0 : cache.scrollH - cache.clientH;
  } else if (typeof destY === 'number') { // num - not false
    endY = destY;
  }

  me.disableScrollEv = disableEvents;

  // animate
  me.animateScroll(startX, endX, startY, endY, duration);
  
};


Optiscroll.Instance.prototype.scrollIntoView = function (elem, duration, delta) {
  var me = this,
      scrollEl = me.scrollEl,
      eDim, sDim,
      leftEdge, topEdge, rightEdge, bottomEdge,
      startX, startY, endX, endY;

  G.pauseCheck = true;
  // force update
  me.update();

  if(typeof elem === 'string') { // selector
    elem = scrollEl.querySelector(elem);
  }

  if(elem.length && elem.jquery) { // jquery element
    elem = elem[0];
  }

  if(typeof delta === 'number') { // same delta for all
    delta = { top:delta, right:delta, bottom:delta, left:delta };
  }

  delta = delta || {};
  eDim = elem.getBoundingClientRect();
  sDim = scrollEl.getBoundingClientRect();

  startX = endX = scrollEl.scrollLeft;
  startY = endY = scrollEl.scrollTop;
  leftEdge = startX + eDim.left - sDim.left - (delta.left || 0);
  topEdge = startY + eDim.top - sDim.top - (delta.top || 0);
  rightEdge = startX + eDim.left - sDim.left + eDim.width - me.cache.clientW + (delta.right || 0);
  bottomEdge = startY + eDim.top - sDim.top + eDim.height - me.cache.clientH + (delta.bottom || 0);
  
  if(leftEdge < startX) { endX = leftEdge; }
  if(rightEdge > startX) { endX = rightEdge; }

  if(topEdge < startY) { endY = topEdge; }
  if(bottomEdge > startY) { endY = bottomEdge; }

  // animate
  me.animateScroll(startX, endX, startY, endY, duration);
};




Optiscroll.Instance.prototype.animateScroll = function (startX, endX, startY, endY, duration) {
  var me = this,
      scrollEl = me.scrollEl,
      startTime = Date.now();

  if(endX === startX && endY === startY) {
    return;
  }

  if(duration === 0) {
    scrollEl.scrollLeft = endX;
    scrollEl.scrollTop = endY;
    animationTimeout( function () { me.disableScrollEv = false; }); // restore
    return;
  }

  if(typeof duration !== 'number') { // undefined or auto
    // 500px in 430ms, 1000px in 625ms, 2000px in 910ms
    duration = Math.pow( Math.max( Math.abs(endX - startX), Math.abs(endY - startY) ), 0.54) * 15;
  }

  var scrollAnimation = function () {
    var time = Math.min(1, ((Date.now() - startTime) / duration)),
        easedTime = Utils.easingFunction(time);
    
    if( endY !== startY ) {
      scrollEl.scrollTop = (easedTime * (endY - startY)) + startY;
    }
    if( endX !== startX ) {
      scrollEl.scrollLeft = (easedTime * (endX - startX)) + startX;
    }

    if(time < 1) {
      animationTimeout(scrollAnimation);
    } else {
      me.disableScrollEv = false;
      // now the internal scroll event will fire
    }
  };
  
  animationTimeout(scrollAnimation);
};




Optiscroll.Instance.prototype.destroy = function () {
  var me = this,
      scrollEl = me.scrollEl,
      listeners = me.listeners,
      index = G.instances.indexOf( me );

  // unbind events
  for (var ev in listeners) {
    scrollEl.removeEventListener(ev, listeners[ev]);
  }

  // remove scrollbars elements
  _invoke(me.scrollbars, 'remove');
  
  // restore style
  scrollEl.removeAttribute('style');
  scrollEl.removeAttribute('data-scroll');

  // remove classes
  toggleClass(me.element, me.settings.classPrefix+'-nobounce', false);
  
  // defer instance removal from global array
  // to not affect checkLoop _invoke
  if (index > -1) {
    animationTimeout(function () {
      G.instances.splice(index, 1);
    });
  }
};




Optiscroll.Instance.prototype.fireCustomEvent = function (eventName) {
  var eventData = Utils.exposedData(this.cache),
      cEvent = new CustomEvent(eventName, { detail: eventData });
  
  this.element.dispatchEvent(cEvent);
};

