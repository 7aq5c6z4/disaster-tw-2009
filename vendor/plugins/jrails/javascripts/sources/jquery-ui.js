﻿/*
 * jQuery UI @VERSION
 *
 * Copyright (c) 2008 Paul Bakaus (ui.jquery.com)
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * http://docs.jquery.com/UI
 *
 * $Date: 2008-04-01 07:23:47 -0600 (Tue, 01 Apr 2008) $
 * $Rev: 5174 $
 */
;(function($) {

  //If the UI scope is not available, add it
  $.ui = $.ui || {};
  
  //Add methods that are vital for all mouse interaction stuff (plugin registering)
  $.extend($.ui, {
    plugin: {
      add: function(module, option, set) {
        var proto = $.ui[module].prototype;
        for(var i in set) {
          proto.plugins[i] = proto.plugins[i] || [];
          proto.plugins[i].push([option, set[i]]);
        }
      },
      call: function(instance, name, arguments) {
        var set = instance.plugins[name]; if(!set) return;
        for (var i = 0; i < set.length; i++) {
          if (instance.options[set[i][0]]) set[i][1].apply(instance.element, arguments);
        }
      } 
    },
    cssCache: {},
    css: function(name) {
      if ($.ui.cssCache[name]) return $.ui.cssCache[name];
      var tmp = $('<div class="ui-resizable-gen">').addClass(name).css({position:'absolute', top:'-5000px', left:'-5000px', display:'block'}).appendTo('body');
      
      //if (!$.browser.safari)
        //tmp.appendTo('body'); 
      
      //Opera and Safari set width and height to 0px instead of auto
      //Safari returns rgba(0,0,0,0) when bgcolor is not set
      $.ui.cssCache[name] = !!(
        (!/auto|default/.test(tmp.css('cursor')) || (/^[1-9]/).test(tmp.css('height')) || (/^[1-9]/).test(tmp.css('width')) || 
        !(/none/).test(tmp.css('backgroundImage')) || !(/transparent|rgba\(0, 0, 0, 0\)/).test(tmp.css('backgroundColor')))
      );
      try { $('body').get(0).removeChild(tmp.get(0)); } catch(e){}
      return $.ui.cssCache[name];
    },
    disableSelection: function(e) {
      e.unselectable = "on";
      e.onselectstart = function() {  return false; };
      if (e.style) e.style.MozUserSelect = "none";
    },
    enableSelection: function(e) {
      e.unselectable = "off";
      e.onselectstart = function() { return true; };
      if (e.style) e.style.MozUserSelect = "";
    },
    hasScroll: function(e, a) {
          var scroll = /top/.test(a||"top") ? 'scrollTop' : 'scrollLeft', has = false;
          if (e[scroll] > 0) return true; e[scroll] = 1;
          has = e[scroll] > 0 ? true : false; e[scroll] = 0;
          return has; 
      }
  });

  /******* fn scope modifications ********/

  $.each( ['Left', 'Top'], function(i, name) {
    if(!$.fn['scroll'+name]) $.fn['scroll'+name] = function(v) {
      return v != undefined ?
        this.each(function() { this == window || this == document ? window.scrollTo(name == 'Left' ? v : $(window)['scrollLeft'](), name == 'Top'  ? v : $(window)['scrollTop']()) : this['scroll'+name] = v; }) :
        this[0] == window || this[0] == document ? self[(name == 'Left' ? 'pageXOffset' : 'pageYOffset')] || $.boxModel && document.documentElement['scroll'+name] || document.body['scroll'+name] : this[0][ 'scroll' + name ];
    };
  });

  var _remove = $.fn.remove;
  $.fn.extend({
    position: function() {
      var offset       = this.offset();
      var offsetParent = this.offsetParent();
      var parentOffset = offsetParent.offset();

      return {
        top:  offset.top - num(this[0], 'marginTop')  - parentOffset.top - num(offsetParent, 'borderTopWidth'),
        left: offset.left - num(this[0], 'marginLeft')  - parentOffset.left - num(offsetParent, 'borderLeftWidth')
      };
    },
    offsetParent: function() {
      var offsetParent = this[0].offsetParent;
      while ( offsetParent && (!/^body|html$/i.test(offsetParent.tagName) && $.css(offsetParent, 'position') == 'static') )
        offsetParent = offsetParent.offsetParent;
      return $(offsetParent);
    },
    mouseInteraction: function(o) {
      return this.each(function() {
        new $.ui.mouseInteraction(this, o);
      });
    },
    removeMouseInteraction: function(o) {
      return this.each(function() {
        if($.data(this, "ui-mouse"))
          $.data(this, "ui-mouse").destroy();
      });
    },
    remove: function() {
      jQuery("*", this).add(this).trigger("remove");
      return _remove.apply(this, arguments );
    }
  });
  
  function num(el, prop) {
    return parseInt($.curCSS(el.jquery?el[0]:el,prop,true))||0;
  };
  
  
  /********** Mouse Interaction Plugin *********/
  
  $.ui.mouseInteraction = function(element, options) {
  
    var self = this;
    this.element = element;

    $.data(this.element, "ui-mouse", this);
    this.options = $.extend({}, options);
    
    $(element).bind('mousedown.draggable', function() { return self.click.apply(self, arguments); });
    if($.browser.msie) $(element).attr('unselectable', 'on'); //Prevent text selection in IE
    
    // prevent draggable-options-delay bug #2553
    $(element).mouseup(function() {
      if(self.timer) clearInterval(self.timer);
    });
  };
  
  $.extend($.ui.mouseInteraction.prototype, {
    
    destroy: function() { $(this.element).unbind('mousedown.draggable'); },
    trigger: function() { return this.click.apply(this, arguments); },
    click: function(e) {
      
      if(
           e.which != 1 //only left click starts dragging
        || $.inArray(e.target.nodeName.toLowerCase(), this.options.dragPrevention || []) != -1 // Prevent execution on defined elements
        || (this.options.condition && !this.options.condition.apply(this.options.executor || this, [e, this.element])) //Prevent execution on condition
      ) return true;
        
      var self = this;
      var initialize = function() {
        self._MP = { left: e.pageX, top: e.pageY }; // Store the click mouse position
        $(document).bind('mouseup.draggable', function() { return self.stop.apply(self, arguments); });
        $(document).bind('mousemove.draggable', function() { return self.drag.apply(self, arguments); });
        
        if(!self.initalized && Math.abs(self._MP.left-e.pageX) >= self.options.distance || Math.abs(self._MP.top-e.pageY) >= self.options.distance) {       
          if(self.options.start) self.options.start.call(self.options.executor || self, e, self.element);
          if(self.options.drag) self.options.drag.call(self.options.executor || self, e, this.element); //This is actually not correct, but expected
          self.initialized = true;
        }
      };

      if(this.options.delay) {
        if(this.timer) clearInterval(this.timer);
        this.timer = setTimeout(initialize, this.options.delay);
      } else {
        initialize();
      }
        
      return false;
      
    },
    stop: function(e) {     
      
      var o = this.options;
      if(!this.initialized) return $(document).unbind('mouseup.draggable').unbind('mousemove.draggable');

      if(this.options.stop) this.options.stop.call(this.options.executor || this, e, this.element);
      $(document).unbind('mouseup.draggable').unbind('mousemove.draggable');
      this.initialized = false;
      return false;
      
    },
    drag: function(e) {

      var o = this.options;
      if ($.browser.msie && !e.button) return this.stop.apply(this, [e]); // IE mouseup check
      
      if(!this.initialized && (Math.abs(this._MP.left-e.pageX) >= o.distance || Math.abs(this._MP.top-e.pageY) >= o.distance)) {        
        if(this.options.start) this.options.start.call(this.options.executor || this, e, this.element);
        this.initialized = true;
      } else {
        if(!this.initialized) return false;
      }

      if(o.drag) o.drag.call(this.options.executor || this, e, this.element);
      return false;
      
    }
  });
  
})(jQuery);

/*
 * jQuery UI Draggable
 *
 * Copyright (c) 2008 Paul Bakaus
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 * 
 * http://docs.jquery.com/UI/Draggables
 *
 * Depends:
 *   ui.base.js
 *
 * Revision: $Id: ui.draggable.js 5194 2008-04-04 12:30:10Z paul.bakaus $
 */
;(function($) {

  $.fn.extend({
    draggable: function(options) {
      var args = Array.prototype.slice.call(arguments, 1);
      
      return this.each(function() {
        if (typeof options == "string") {
          var drag = $.data(this, "draggable");
          if(drag) drag[options].apply(drag, args);

        } else if(!$.data(this, "draggable"))
          new $.ui.draggable(this, options);
      });
    }
  });
  
  $.ui.draggable = function(element, options) {
    //Initialize needed constants
    var self = this;
    
    this.element = $(element);
    
    $.data(element, "draggable", this);
    this.element.addClass("ui-draggable");
    
    //Prepare the passed options
    this.options = $.extend({}, options);
    var o = this.options;
    $.extend(o, {
      helper: o.ghosting == true ? 'clone' : (o.helper || 'original'),
      handle : o.handle ? ($(o.handle, element)[0] ? $(o.handle, element) : this.element) : this.element,
      appendTo: o.appendTo || 'parent'    
    });
    
    $(element).bind("setData.draggable", function(event, key, value){
      self.options[key] = value;
    }).bind("getData.draggable", function(event, key){
      return self.options[key];
    });
    
    //Initialize mouse events for interaction
    $(o.handle).mouseInteraction({
      executor: this,
      delay: o.delay,
      distance: o.distance || 1,
      dragPrevention: o.cancel || o.cancel === '' ? o.cancel.toLowerCase().split(',') : ['input','textarea','button','select','option'],
      start: this.start,
      stop: this.stop,
      drag: this.drag,
      condition: function(e) { return !(e.target.className.indexOf("ui-resizable-handle") != -1 || this.options.disabled); }
    });
    
    //Position the node
    if(o.helper == 'original' && (this.element.css('position') == 'static' || this.element.css('position') == ''))
      this.element.css('position', 'relative');
      
    //Prepare cursorAt
    if(o.cursorAt && o.cursorAt.constructor == Array)
      o.cursorAt = { left: o.cursorAt[0], top: o.cursorAt[1] };
    
  };
  
  $.extend($.ui.draggable.prototype, {
    plugins: {},
    ui: function(e) {
      return {
        helper: this.helper,
        position: this.position,
        absolutePosition: this.positionAbs,
        instance: this,
        options: this.options,
        element: this.element       
      };
    },
    propagate: function(n,e) {
      $.ui.plugin.call(this, n, [e, this.ui()]);
      return this.element.triggerHandler(n == "drag" ? n : "drag"+n, [e, this.ui()], this.options[n]);
    },
    destroy: function() {
      if(!$.data(this.element[0], 'draggable')) return;
      this.options.handle.removeMouseInteraction();
      this.element
        .removeClass("ui-draggable ui-draggable-disabled")
        .removeData("draggable")
        .unbind(".draggable");
    },
    enable: function() {
      this.element.removeClass("ui-draggable-disabled");
      this.options.disabled = false;
    },
    disable: function() {
      this.element.addClass("ui-draggable-disabled");
      this.options.disabled = true;
    },
    setContrains: function(minLeft,maxLeft,minTop,maxTop) {
      this.minLeft = minLeft; this.maxLeft = maxLeft;
      this.minTop = minTop; this.maxTop = maxTop;
      this.constrainsSet = true;
    },
    checkConstrains: function() {
      if(!this.constrainsSet) return;
      if(this.position.left < this.minLeft) this.position.left = this.minLeft;
      if(this.position.left > this.maxLeft - this.helperProportions.width) this.position.left = this.maxLeft - this.helperProportions.width;
      if(this.position.top < this.minTop) this.position.top = this.minTop;
      if(this.position.top > this.maxTop - this.helperProportions.height) this.position.top = this.maxTop - this.helperProportions.height;
    },
    recallOffset: function(e) {

      var elementPosition = { left: this.elementOffset.left - this.offsetParentOffset.left, top: this.elementOffset.top - this.offsetParentOffset.top };
      var r = this.helper.css('position') == 'relative';

      //Generate the original position
      this.originalPosition = {
        left: (r ? parseInt(this.helper.css('left'),10) || 0 : elementPosition.left + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollLeft)),
        top: (r ? parseInt(this.helper.css('top'),10) || 0 : elementPosition.top + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollTop))
      };
      
      //Generate a flexible offset that will later be subtracted from e.pageX/Y
      this.offset = {left: this._pageX - this.originalPosition.left, top: this._pageY - this.originalPosition.top };
      
    },
    start: function(e) {
      var o = this.options;
      if($.ui.ddmanager) $.ui.ddmanager.current = this;
      
      //Create and append the visible helper
      this.helper = typeof o.helper == 'function' ? $(o.helper.apply(this.element[0], [e])) : (o.helper == 'clone' ? this.element.clone().appendTo((o.appendTo == 'parent' ? this.element[0].parentNode : o.appendTo)) : this.element);
      if(this.helper[0] != this.element[0]) this.helper.css('position', 'absolute');
      if(!this.helper.parents('body').length) this.helper.appendTo((o.appendTo == 'parent' ? this.element[0].parentNode : o.appendTo));
      
      
      //Find out the next positioned parent
      this.offsetParent = (function(cp) {
        while(cp) {
          if(cp.style && (/(absolute|relative|fixed)/).test($.css(cp,'position'))) return $(cp);
          cp = cp.parentNode ? cp.parentNode : null;
        }; return $("body");    
      })(this.helper[0].parentNode);
      
      //Prepare variables for position generation
      this.elementOffset = this.element.offset();
      this.offsetParentOffset = this.offsetParent.offset();
      var elementPosition = { left: this.elementOffset.left - this.offsetParentOffset.left, top: this.elementOffset.top - this.offsetParentOffset.top };
      this._pageX = e.pageX; this._pageY = e.pageY;
      this.clickOffset = { left: e.pageX - this.elementOffset.left, top: e.pageY - this.elementOffset.top };
      var r = this.helper.css('position') == 'relative';

      //Generate the original position
      this.originalPosition = {
        left: (r ? parseInt(this.helper.css('left'),10) || 0 : elementPosition.left + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollLeft)),
        top: (r ? parseInt(this.helper.css('top'),10) || 0 : elementPosition.top + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollTop))
      };
      
      //If we have a fixed element, we must subtract the scroll offset again
      if(this.element.css('position') == 'fixed') {
        this.originalPosition.top -= this.offsetParent[0] == document.body ? $(document).scrollTop() : this.offsetParent[0].scrollTop;
        this.originalPosition.left -= this.offsetParent[0] == document.body ? $(document).scrollLeft() : this.offsetParent[0].scrollLeft;
      }
      
      //Generate a flexible offset that will later be subtracted from e.pageX/Y
      this.offset = {left: e.pageX - this.originalPosition.left, top: e.pageY - this.originalPosition.top };
      
      //Substract margins
      if(this.element[0] != this.helper[0]) {
        this.offset.left += parseInt(this.element.css('marginLeft'),10) || 0;
        this.offset.top += parseInt(this.element.css('marginTop'),10) || 0;
      }
      
      //Call plugins and callbacks
      this.propagate("start", e);

      this.helperProportions = { width: this.helper.outerWidth(), height: this.helper.outerHeight() };
      if ($.ui.ddmanager && !o.dropBehaviour) $.ui.ddmanager.prepareOffsets(this, e);
      
      //If we have something in cursorAt, we'll use it
      if(o.cursorAt) {
        if(o.cursorAt.top != undefined || o.cursorAt.bottom != undefined) {
          this.offset.top -= this.clickOffset.top - (o.cursorAt.top != undefined ? o.cursorAt.top : (this.helperProportions.height - o.cursorAt.bottom));
          this.clickOffset.top = (o.cursorAt.top != undefined ? o.cursorAt.top : (this.helperProportions.height - o.cursorAt.bottom));
        }
        if(o.cursorAt.left != undefined || o.cursorAt.right != undefined) {
          this.offset.left -= this.clickOffset.left - (o.cursorAt.left != undefined ? o.cursorAt.left : (this.helperProportions.width - o.cursorAt.right));
          this.clickOffset.left = (o.cursorAt.left != undefined ? o.cursorAt.left : (this.helperProportions.width - o.cursorAt.right));
        }
      }

      return false;

    },
    clear: function() {
      if($.ui.ddmanager) $.ui.ddmanager.current = null;
      this.helper = null;
    },
    stop: function(e) {

      //If we are using droppables, inform the manager about the drop
      if ($.ui.ddmanager && !this.options.dropBehaviour)
        $.ui.ddmanager.drop(this, e);
        
      //Call plugins and trigger callbacks
      this.propagate("stop", e);
      
      if(this.cancelHelperRemoval) return false;      
      if(this.options.helper != 'original') this.helper.remove();
      this.clear();

      return false;
    },
    drag: function(e) {

      //Compute the helpers position
      this.position = { top: e.pageY - this.offset.top, left: e.pageX - this.offset.left };
      this.positionAbs = { left: e.pageX - this.clickOffset.left, top: e.pageY - this.clickOffset.top };

      //Call plugins and callbacks
      this.checkConstrains();     
      this.position = this.propagate("drag", e) || this.position;
      this.checkConstrains();
      
      $(this.helper).css({ left: this.position.left+'px', top: this.position.top+'px' }); // Stick the helper to the cursor
      if($.ui.ddmanager) $.ui.ddmanager.drag(this, e);
      return false;
      
    }
  });
  
/*
 * Draggable Extensions
 */
   
  $.ui.plugin.add("draggable", "cursor", {
    start: function(e, ui) {
      var t = $('body');
      if (t.css("cursor")) ui.options._cursor = t.css("cursor");
      t.css("cursor", ui.options.cursor);
    },
    stop: function(e, ui) {
      if (ui.options._cursor) $('body').css("cursor", ui.options._cursor);
    }
  });

  $.ui.plugin.add("draggable", "zIndex", {
    start: function(e, ui) {
      var t = $(ui.helper);
      if(t.css("zIndex")) ui.options._zIndex = t.css("zIndex");
      t.css('zIndex', ui.options.zIndex);
    },
    stop: function(e, ui) {
      if(ui.options._zIndex) $(ui.helper).css('zIndex', ui.options._zIndex);
    }
  });

  $.ui.plugin.add("draggable", "opacity", {
    start: function(e, ui) {
      var t = $(ui.helper);
      if(t.css("opacity")) ui.options._opacity = t.css("opacity");
      t.css('opacity', ui.options.opacity);
    },
    stop: function(e, ui) {
      if(ui.options._opacity) $(ui.helper).css('opacity', ui.options._opacity);
    }
  });


  $.ui.plugin.add("draggable", "revert", {
    stop: function(e, ui) {
      var self = ui.instance, helper = $(self.helper);
      self.cancelHelperRemoval = true;
      
      $(ui.helper).animate({ left: self.originalPosition.left, top: self.originalPosition.top }, parseInt(ui.options.revert, 10) || 500, function() {
        if(ui.options.helper != 'original') helper.remove();
        if (!helper) self.clear();
      });
    }
  });

  $.ui.plugin.add("draggable", "iframeFix", {
    start: function(e, ui) {

      var o = ui.options;
      if(ui.instance.slowMode) return; // Make clones on top of iframes (only if we are not in slowMode)
      
      if(o.iframeFix.constructor == Array) {
        for(var i=0;i<o.iframeFix.length;i++) {
          var co = $(o.iframeFix[i]).offset({ border: false });
          $('<div class="DragDropIframeFix"" style="background: #fff;"></div>').css("width", $(o.iframeFix[i])[0].offsetWidth+"px").css("height", $(o.iframeFix[i])[0].offsetHeight+"px").css("position", "absolute").css("opacity", "0.001").css("z-index", "1000").css("top", co.top+"px").css("left", co.left+"px").appendTo("body");
        }   
      } else {
        $("iframe").each(function() {         
          var co = $(this).offset({ border: false });
          $('<div class="DragDropIframeFix" style="background: #fff;"></div>').css("width", this.offsetWidth+"px").css("height", this.offsetHeight+"px").css("position", "absolute").css("opacity", "0.001").css("z-index", "1000").css("top", co.top+"px").css("left", co.left+"px").appendTo("body");
        });             
      }

    },
    stop: function(e, ui) {
      if(ui.options.iframeFix) $("div.DragDropIframeFix").each(function() { this.parentNode.removeChild(this); }); //Remove frame helpers 
    }
  });
  
  $.ui.plugin.add("draggable", "containment", {
    start: function(e, ui) {

      var o = ui.options;
      var self = ui.instance;
      if((o.containment.left != undefined || o.containment.constructor == Array) && !o._containment) return;
      if(!o._containment) o._containment = o.containment;

      if(o._containment == 'parent') o._containment = this[0].parentNode;
      if(o._containment == 'document') {
        o.containment = [
          0,
          0,
          $(document).width(),
          ($(document).height() || document.body.parentNode.scrollHeight)
        ];
      } else { //I'm a node, so compute top/left/right/bottom

        var ce = $(o._containment)[0];
        var co = $(o._containment).offset();

        o.containment = [
          co.left,
          co.top,
          co.left+(ce.offsetWidth || ce.scrollWidth),
          co.top+(ce.offsetHeight || ce.scrollHeight)
        ];
      }
      
      var c = o.containment;
      ui.instance.setContrains(
        c[0] - (self.offset.left - self.clickOffset.left), //min left
        c[2] - (self.offset.left - self.clickOffset.left), //max left
        c[1] - (self.offset.top - self.clickOffset.top), //min top
        c[3] - (self.offset.top - self.clickOffset.top) //max top
      );

    }
  });

  $.ui.plugin.add("draggable", "grid", {
    drag: function(e, ui) {
      var o = ui.options;
      var newLeft = ui.instance.originalPosition.left + Math.round((e.pageX - ui.instance._pageX) / o.grid[0]) * o.grid[0];
      var newTop = ui.instance.originalPosition.top + Math.round((e.pageY - ui.instance._pageY) / o.grid[1]) * o.grid[1];
      
      ui.instance.position.left = newLeft;
      ui.instance.position.top = newTop;

    }
  });

  $.ui.plugin.add("draggable", "axis", {
    drag: function(e, ui) {
      var o = ui.options;
      if(o.constraint) o.axis = o.constraint; //Legacy check
      switch (o.axis) {
        case 'x' : ui.instance.position.top = ui.instance.originalPosition.top; break;
        case 'y' : ui.instance.position.left = ui.instance.originalPosition.left; break;
      }
    }
  });

  $.ui.plugin.add("draggable", "scroll", {
    start: function(e, ui) {
      var o = ui.options;
      o.scrollSensitivity = o.scrollSensitivity || 20;
      o.scrollSpeed   = o.scrollSpeed || 20;

      ui.instance.overflowY = function(el) {
        do { if(/auto|scroll/.test(el.css('overflow')) || (/auto|scroll/).test(el.css('overflow-y'))) return el; el = el.parent(); } while (el[0].parentNode);
        return $(document);
      }(this);
      ui.instance.overflowX = function(el) {
        do { if(/auto|scroll/.test(el.css('overflow')) || (/auto|scroll/).test(el.css('overflow-x'))) return el; el = el.parent(); } while (el[0].parentNode);
        return $(document);
      }(this);
    },
    drag: function(e, ui) {
      
      var o = ui.options;
      var i = ui.instance;

      if(i.overflowY[0] != document && i.overflowY[0].tagName != 'HTML') {
        if(i.overflowY[0].offsetHeight - (ui.position.top - i.overflowY[0].scrollTop + i.clickOffset.top) < o.scrollSensitivity)
          i.overflowY[0].scrollTop = i.overflowY[0].scrollTop + o.scrollSpeed;
        if((ui.position.top - i.overflowY[0].scrollTop + i.clickOffset.top) < o.scrollSensitivity)
          i.overflowY[0].scrollTop = i.overflowY[0].scrollTop - o.scrollSpeed;        
      } else {
        //$(document.body).append('<p>'+(e.pageY - $(document).scrollTop())+'</p>');
        if(e.pageY - $(document).scrollTop() < o.scrollSensitivity)
          $(document).scrollTop($(document).scrollTop() - o.scrollSpeed);
        if($(window).height() - (e.pageY - $(document).scrollTop()) < o.scrollSensitivity)
          $(document).scrollTop($(document).scrollTop() + o.scrollSpeed);
      }
      
      if(i.overflowX[0] != document && i.overflowX[0].tagName != 'HTML') {
        if(i.overflowX[0].offsetWidth - (ui.position.left - i.overflowX[0].scrollLeft + i.clickOffset.left) < o.scrollSensitivity)
          i.overflowX[0].scrollLeft = i.overflowX[0].scrollLeft + o.scrollSpeed;
        if((ui.position.top - i.overflowX[0].scrollLeft + i.clickOffset.left) < o.scrollSensitivity)
          i.overflowX[0].scrollLeft = i.overflowX[0].scrollLeft - o.scrollSpeed;        
      } else {
        if(e.pageX - $(document).scrollLeft() < o.scrollSensitivity)
          $(document).scrollLeft($(document).scrollLeft() - o.scrollSpeed);
        if($(window).width() - (e.pageX - $(document).scrollLeft()) < o.scrollSensitivity)
          $(document).scrollLeft($(document).scrollLeft() + o.scrollSpeed);
      }
      
      ui.instance.recallOffset(e);

    }
  });
  
  $.ui.plugin.add("draggable", "snap", {
    start: function(e, ui) {
      
      ui.instance.snapElements = [];
      $(ui.options.snap === true ? '.ui-draggable' : ui.options.snap).each(function() {
        var $t = $(this); var $o = $t.offset();
        if(this != ui.instance.element[0]) ui.instance.snapElements.push({
          item: this,
          width: $t.outerWidth(),
          height: $t.outerHeight(),
          top: $o.top,
          left: $o.left
        });
      });
      
    },
    drag: function(e, ui) {

      var d = ui.options.snapTolerance || 20;
      var x1 = ui.absolutePosition.left, x2 = x1 + ui.instance.helperProportions.width,
          y1 = ui.absolutePosition.top, y2 = y1 + ui.instance.helperProportions.height;

      for (var i = ui.instance.snapElements.length - 1; i >= 0; i--){

        var l = ui.instance.snapElements[i].left, r = l + ui.instance.snapElements[i].width, 
            t = ui.instance.snapElements[i].top,  b = t + ui.instance.snapElements[i].height;

        //Yes, I know, this is insane ;)
        if(!((l-d < x1 && x1 < r+d && t-d < y1 && y1 < b+d) || (l-d < x1 && x1 < r+d && t-d < y2 && y2 < b+d) || (l-d < x2 && x2 < r+d && t-d < y1 && y1 < b+d) || (l-d < x2 && x2 < r+d && t-d < y2 && y2 < b+d))) continue;

        if(ui.options.snapMode != 'inner') {
          var ts = Math.abs(t - y2) <= 20;
          var bs = Math.abs(b - y1) <= 20;
          var ls = Math.abs(l - x2) <= 20;
          var rs = Math.abs(r - x1) <= 20;
          if(ts) ui.position.top = t - ui.instance.offset.top + ui.instance.clickOffset.top - ui.instance.helperProportions.height;
          if(bs) ui.position.top = b - ui.instance.offset.top + ui.instance.clickOffset.top;
          if(ls) ui.position.left = l - ui.instance.offset.left + ui.instance.clickOffset.left - ui.instance.helperProportions.width;
          if(rs) ui.position.left = r - ui.instance.offset.left + ui.instance.clickOffset.left;
        }
        
        if(ui.options.snapMode != 'outer') {
          var ts = Math.abs(t - y1) <= 20;
          var bs = Math.abs(b - y2) <= 20;
          var ls = Math.abs(l - x1) <= 20;
          var rs = Math.abs(r - x2) <= 20;
          if(ts) ui.position.top = t - ui.instance.offset.top + ui.instance.clickOffset.top;
          if(bs) ui.position.top = b - ui.instance.offset.top + ui.instance.clickOffset.top - ui.instance.helperProportions.height;
          if(ls) ui.position.left = l - ui.instance.offset.left + ui.instance.clickOffset.left;
          if(rs) ui.position.left = r - ui.instance.offset.left + ui.instance.clickOffset.left - ui.instance.helperProportions.width;
        }

      };
    }
  });
  
  $.ui.plugin.add("draggable", "connectToSortable", {
    start: function(e,ui) {
      ui.instance.sortable = $.data($(ui.options.connectToSortable)[0], 'sortable');
      ui.instance.sortableOffset = ui.instance.sortable.element.offset();
      ui.instance.sortableOuterWidth = ui.instance.sortable.element.outerWidth();
      ui.instance.sortableOuterHeight = ui.instance.sortable.element.outerHeight();
      if(ui.instance.sortable.options.revert) ui.instance.sortable.shouldRevert = true;
    },
    stop: function(e,ui) {
      //If we are still over the sortable, we fake the stop event of the sortable, but also remove helper
      var inst = ui.instance.sortable;
      if(inst.isOver) {
        inst.isOver = 0;
        ui.instance.cancelHelperRemoval = true; //Don't remove the helper in the draggable instance
        inst.cancelHelperRemoval = false; //Remove it in the sortable instance (so sortable plugins like revert still work)
        if(inst.shouldRevert) inst.options.revert = true; //revert here
        inst.stop(e);
        inst.options.helper = "original";
      }
    },
    drag: function(e,ui) {
      //This is handy: We reuse the intersectsWith method for checking if the current draggable helper
      //intersects with the sortable container
      var inst = ui.instance.sortable;
      ui.instance.position.absolute = ui.absolutePosition; //Sorry, this is an ugly API fix
      
      if(inst.intersectsWith.call(ui.instance, {
        left: ui.instance.sortableOffset.left, top: ui.instance.sortableOffset.top,
        width: ui.instance.sortableOuterWidth, height: ui.instance.sortableOuterHeight
      })) {
        //If it intersects, we use a little isOver variable and set it once, so our move-in stuff gets fired only once
        if(!inst.isOver) {
          inst.isOver = 1;
          
          //Cache the width/height of the new helper
          var height = inst.options.placeholderElement ? $(inst.options.placeholderElement, $(inst.options.items, inst.element)).innerHeight() : $(inst.options.items, inst.element).innerHeight();
          var width = inst.options.placeholderElement ? $(inst.options.placeholderElement, $(inst.options.items, inst.element)).innerWidth() : $(inst.options.items, inst.element).innerWidth();

          //Now we fake the start of dragging for the sortable instance,
          //by cloning the list group item, appending it to the sortable and using it as inst.currentItem
          //We can then fire the start event of the sortable with our passed browser event, and our own helper (so it doesn't create a new one)
          inst.currentItem = $(this).clone().appendTo(inst.element);
          inst.options.helper = function() { return ui.helper[0]; };
          inst.start(e);
          
          //Because the browser event is way off the new appended portlet, we modify a couple of variables to reflect the changes
          inst.clickOffset.top = ui.instance.clickOffset.top;
          inst.clickOffset.left = ui.instance.clickOffset.left;
          inst.offset.left -= ui.absolutePosition.left - inst.position.absolute.left;
          inst.offset.top -= ui.absolutePosition.top - inst.position.absolute.top;
          
          //Do a nifty little helper animation: Animate it to the portlet's size (just takes the first 'li' element in the sortable now)
          inst.helperProportions = { width:  width, height: height}; //We have to reset the helper proportions, because we are doing our animation there
          ui.helper.animate({ height: height, width: width}, 500);
          ui.instance.propagate("toSortable", e);
        
        }

        //Provided we did all the previous steps, we can fire the drag event of the sortable on every draggable drag, when it intersects with the sortable
        if(inst.currentItem) inst.drag(e);
        
      } else {
        
        //If it doesn't intersect with the sortable, and it intersected before,
        //we fake the drag stop of the sortable, but make sure it doesn't remove the helper by using cancelHelperRemoval
        if(inst.isOver) {
          inst.isOver = 0;
          inst.cancelHelperRemoval = true;
          inst.options.revert = false; //No revert here
          inst.stop(e);
          inst.options.helper = "original";
          
          //Now we remove our currentItem, the list group clone again, and the placeholder, and animate the helper back to it's original size
          inst.currentItem.remove();
          inst.placeholder.remove();
          
          ui.helper.animate({ height: this.innerHeight(), width: this.innerWidth() }, 500);
          ui.instance.propagate("fromSortable", e);
        }
        
      };
    }
  })

  //TODO: wrapHelper

})(jQuery);

/*
 * jQuery UI Droppable
 *
 * Copyright (c) 2008 Paul Bakaus
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 * 
 * http://docs.jquery.com/UI/Droppables
 *
 * Depends:
 *   ui.base.js
 *   ui.draggable.js
 *
 * Revision: $Id: ui.droppable.js 5198 2008-04-04 13:06:40Z paul.bakaus $
 */
;(function($) {
  
  $.fn.extend({
    droppable: function(options) {
      var args = Array.prototype.slice.call(arguments, 1);
      
      return this.each(function() {
        if (typeof options == "string") {
          var drop = $.data(this, "droppable");
          if(drop) drop[options].apply(drop, args);
          
        } else if(!$.data(this, "droppable"))
          new $.ui.droppable(this, options);
      });
    }
  });
  
  $.ui.droppable = function(element, options) {
    
    //Initialize needed constants
    var instance = this;
    this.element = $(element);
    $.data(element, "droppable", this);
    this.element.addClass("ui-droppable");
    
    //Prepare the passed options
    var o = this.options = options = $.extend({}, $.ui.droppable.defaults, options);
    var accept = o.accept;
    o = $.extend(o, {
      accept: o.accept && o.accept.constructor == Function ? o.accept : function(d) {
        return $(d).is(accept);
      }
    });
    
    $(element).bind("setData.droppable", function(event, key, value){
      o[key] = value;
    }).bind("getData.droppable", function(event, key){
      return o[key];
    }).bind('remove', function() {
      instance.destroy();
    });
    
    //Store the droppable's proportions
    this.proportions = { width: this.element.outerWidth(), height: this.element.outerHeight() };
    
    // Add the reference and positions to the manager
    $.ui.ddmanager.droppables.push({ item: this, over: 0, out: 1 });
    
  };
  
  $.extend($.ui.droppable, {
    defaults: {
      disabled: false,
      tolerance: 'intersect'
    }
  });
  
  $.extend($.ui.droppable.prototype, {
    plugins: {},
    ui: function(c) {
      return {
        instance: this,
        draggable: (c.currentItem || c.element),
        helper: c.helper,
        position: c.position,
        absolutePosition: c.positionAbs,
        options: this.options,
        element: this.element
      };
    },
    destroy: function() {
      var drop = $.ui.ddmanager.droppables;
      for ( var i = 0; i < drop.length; i++ )
        if ( drop[i].item == this )
          drop.splice(i, 1);
      
      this.element
        .removeClass("ui-droppable ui-droppable-disabled")
        .removeData("droppable")
        .unbind(".droppable");
    },
    enable: function() {
      this.element.removeClass("ui-droppable-disabled");
      this.options.disabled = false;
    },
    disable: function() {
      this.element.addClass("ui-droppable-disabled");
      this.options.disabled = true;
    },
    over: function(e) {
      
      var draggable = $.ui.ddmanager.current;
      if (!draggable || (draggable.currentItem || draggable.element)[0] == this.element[0]) return; // Bail if draggable and droppable are same element
      
      if (this.options.accept.call(this.element,(draggable.currentItem || draggable.element))) {
        $.ui.plugin.call(this, 'over', [e, this.ui(draggable)]);
        this.element.triggerHandler("dropover", [e, this.ui(draggable)], this.options.over);
      }
      
    },
    out: function(e) {
      
      var draggable = $.ui.ddmanager.current;
      if (!draggable || (draggable.currentItem || draggable.element)[0] == this.element[0]) return; // Bail if draggable and droppable are same element
      
      if (this.options.accept.call(this.element,(draggable.currentItem || draggable.element))) {
        $.ui.plugin.call(this, 'out', [e, this.ui(draggable)]);
        this.element.triggerHandler("dropout", [e, this.ui(draggable)], this.options.out);
      }
      
    },
    drop: function(e,custom) {
      
      var draggable = custom || $.ui.ddmanager.current;
      if (!draggable || (draggable.currentItem || draggable.element)[0] == this.element[0]) return; // Bail if draggable and droppable are same element
      
      var childrenIntersection = false;
      this.element.find(".ui-droppable").each(function() {
        var inst = $.data(this, 'droppable');
        if(inst.options.greedy && $.ui.intersect(draggable, { item: inst, offset: inst.element.offset() }, inst.options.tolerance)) {
          childrenIntersection = true; return false;
        }
      });
      if(childrenIntersection) return;
      
      if(this.options.accept.call(this.element,(draggable.currentItem || draggable.element))) {
        $.ui.plugin.call(this, 'drop', [e, this.ui(draggable)]);
        this.element.triggerHandler("drop", [e, this.ui(draggable)], this.options.drop);
      }
      
    },
    activate: function(e) {
      
      var draggable = $.ui.ddmanager.current;
      $.ui.plugin.call(this, 'activate', [e, this.ui(draggable)]);
      if(draggable) this.element.triggerHandler("dropactivate", [e, this.ui(draggable)], this.options.activate);
      
    },
    deactivate: function(e) {
      
      var draggable = $.ui.ddmanager.current;
      $.ui.plugin.call(this, 'deactivate', [e, this.ui(draggable)]);
      if(draggable) this.element.triggerHandler("dropdeactivate", [e, this.ui(draggable)], this.options.deactivate);
      
    }
  });
  
  $.ui.intersect = function(draggable, droppable, toleranceMode) {
    
    if (!droppable.offset) return false;
    
    var x1 = (draggable.positionAbs || draggable.position.absolute).left, x2 = x1 + draggable.helperProportions.width,
        y1 = (draggable.positionAbs || draggable.position.absolute).top, y2 = y1 + draggable.helperProportions.height;
    var l = droppable.offset.left, r = l + droppable.item.proportions.width,
        t = droppable.offset.top,  b = t + droppable.item.proportions.height;
    
    switch (toleranceMode) {
      case 'fit':
        
        if(!((y2-(draggable.helperProportions.height/2) > t && y1 < t) || (y1 < b && y2 > b) || (x2 > l && x1 < l) || (x1 < r && x2 > r))) return false;
        
        if(y2-(draggable.helperProportions.height/2) > t && y1 < t) return 1; //Crosses top edge
        if(y1 < b && y2 > b) return 2; //Crosses bottom edge
        if(x2 > l && x1 < l) return 1; //Crosses left edge
        if(x1 < r && x2 > r) return 2; //Crosses right edge
        
        //return (   l < x1 && x2 < r
        //  && t < y1 && y2 < b);
        break;
      case 'intersect':
        return (   l < x1 + (draggable.helperProportions.width  / 2)    // Right Half
          &&     x2 - (draggable.helperProportions.width  / 2) < r    // Left Half
          && t < y1 + (draggable.helperProportions.height / 2)        // Bottom Half
          &&     y2 - (draggable.helperProportions.height / 2) < b ); // Top Half
        break;
      case 'pointer':
        return (   l < ((draggable.positionAbs || draggable.position.absolute).left + draggable.clickOffset.left) && ((draggable.positionAbs || draggable.position.absolute).left + draggable.clickOffset.left) < r
          && t < ((draggable.positionAbs || draggable.position.absolute).top + draggable.clickOffset.top) && ((draggable.positionAbs || draggable.position.absolute).top + draggable.clickOffset.top) < b);
        break;
      case 'touch':
        return ( (y1 >= t && y1 <= b) ||  // Top edge touching
             (y2 >= t && y2 <= b) ||  // Bottom edge touching
             (y1 < t && y2 > b)   // Surrounded vertically
             ) && (
             (x1 >= l && x1 <= r) ||  // Left edge touching
             (x2 >= l && x2 <= r) ||  // Right edge touching
             (x1 < l && x2 > r)   // Surrounded horizontally
            );
        break;
      default:
        return false;
        break;
      }
    
  };
  
  /*
    This manager tracks offsets of draggables and droppables
  */
  $.ui.ddmanager = {
    current: null,
    droppables: [],
    prepareOffsets: function(t, e) {
      
      var m = $.ui.ddmanager.droppables;
      var type = e ? e.type : null; // workaround for #2317
      for (var i = 0; i < m.length; i++) {
        
        if(m[i].item.options.disabled || (t && !m[i].item.options.accept.call(m[i].item.element,(t.currentItem || t.element)))) continue;
        m[i].offset = $(m[i].item.element).offset();
        m[i].item.proportions = { width: m[i].item.element.outerWidth(), height: m[i].item.element.outerHeight() };
        
        if(type == "dragstart") m[i].item.activate.call(m[i].item, e); //Activate the droppable if used directly from draggables
      }
      
    },
    drop: function(draggable, e) {
      
      $.each($.ui.ddmanager.droppables, function() {
        
        if (!this.item.options.disabled && $.ui.intersect(draggable, this, this.item.options.tolerance))
          this.item.drop.call(this.item, e);
        
        if (!this.item.options.disabled && this.item.options.accept.call(this.item.element,(draggable.currentItem || draggable.element))) {
          this.out = 1; this.over = 0;
          this.item.deactivate.call(this.item, e);
        }
        
      });
      
    },
    drag: function(draggable, e) {
      
      //If you have a highly dynamic page, you might try this option. It renders positions every time you move the mouse.
      if(draggable.options.refreshPositions) $.ui.ddmanager.prepareOffsets(draggable, e);
      
      //Run through all droppables and check their positions based on specific tolerance options
      $.each($.ui.ddmanager.droppables, function() {
        
        if(this.item.disabled || this.greedyChild) return;
        var intersects = $.ui.intersect(draggable, this, this.item.options.tolerance);
        
        var c = !intersects && this.over == 1 ? 'out' : (intersects && this.over == 0 ? 'over' : null);
        if(!c) return;
        
        var instance = $.data(this.item.element[0], 'droppable');
        if (instance.options.greedy) {
          this.item.element.parents('.ui-droppable:eq(0)').each(function() {
            var parent = this;
            $.each($.ui.ddmanager.droppables, function() {
              if (this.item.element[0] != parent) return;
              this[c] = 0;
              this[c == 'out' ? 'over' : 'out'] = 1;
              this.greedyChild = (c == 'over' ? 1 : 0);
              this.item[c == 'out' ? 'over' : 'out'].call(this.item, e);
              return false;
            });
          });
        }
        
        this[c] = 1; this[c == 'out' ? 'over' : 'out'] = 0;
        this.item[c].call(this.item, e);
        
      });
      
    }
  };
  
/*
 * Droppable Extensions
 */
  
  $.ui.plugin.add("droppable", "activeClass", {
    activate: function(e, ui) {
      $(this).addClass(ui.options.activeClass);
    },
    deactivate: function(e, ui) {
      $(this).removeClass(ui.options.activeClass);
    },
    drop: function(e, ui) {
      $(this).removeClass(ui.options.activeClass);
    }
  });
  
  $.ui.plugin.add("droppable", "hoverClass", {
    over: function(e, ui) {
      $(this).addClass(ui.options.hoverClass);
    },
    out: function(e, ui) {
      $(this).removeClass(ui.options.hoverClass);
    },
    drop: function(e, ui) {
      $(this).removeClass(ui.options.hoverClass);
    }
  });
  
})(jQuery);

/*
 * jQuery UI Slider
 *
 * Copyright (c) 2008 Paul Bakaus
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 * 
 * http://docs.jquery.com/UI/Slider
 *
 * Depends:
 *   ui.base.js
 *
 * Revision: $Id: ui.slider.js 5196 2008-04-04 12:52:32Z paul.bakaus $
 */
;(function($) {

  $.fn.extend({
    slider: function(options) {
      var args = Array.prototype.slice.call(arguments, 1);
      
      if ( options == "value" )
        return $.data(this[0], "slider").value(arguments[1]);
      
      return this.each(function() {
        if (typeof options == "string") {
          var slider = $.data(this, "slider");
          if (slider) slider[options].apply(slider, args);

        } else if(!$.data(this, "slider"))
          new $.ui.slider(this, options);
      });
    }
  });
  
  $.ui.slider = function(element, options) {

    //Initialize needed constants
    var self = this;
    this.element = $(element);
    $.data(element, "slider", this);
    this.element.addClass("ui-slider");
    
    //Prepare the passed options
    this.options = $.extend({}, $.ui.slider.defaults, options);
    var o = this.options;
    $.extend(o, {
      axis: o.axis || (element.offsetWidth < element.offsetHeight ? 'vertical' : 'horizontal'),
      max: !isNaN(parseInt(o.max,10)) ? { x: parseInt(o.max, 10), y: parseInt(o.max, 10)  } : ({ x: o.max && o.max.x || 100, y:  o.max && o.max.y || 100 }),
      min: !isNaN(parseInt(o.min,10)) ? { x: parseInt(o.min, 10), y: parseInt(o.min, 10)  } : ({ x: o.min && o.min.x || 0, y:  o.min && o.min.y || 0 })
    });
  
    //Prepare the real maxValue
    o.realMax = {
      x: o.max.x - o.min.x,
      y: o.max.y - o.min.y
    };
    
    //Calculate stepping based on steps
    o.stepping = {
      x: o.stepping && o.stepping.x || parseInt(o.stepping, 10) || (o.steps && o.steps.x ? o.realMax.x/o.steps.x : 0),
      y: o.stepping && o.stepping.y || parseInt(o.stepping, 10) || (o.steps && o.steps.y ? o.realMax.y/o.steps.y : 0)
    };
    
    $(element).bind("setData.slider", function(event, key, value){
      self.options[key] = value;
    }).bind("getData.slider", function(event, key){
      return self.options[key];
    });

    //Initialize mouse and key events for interaction
    this.handle = $(o.handle, element);
    if (!this.handle.length) {
      self.handle = self.generated = $(o.handles || [0]).map(function() {
        var handle = $("<div/>").addClass("ui-slider-handle").appendTo(element);
        if (this.id)
          handle.attr("id", this.id);
        return handle[0];
      });
    }
    $(this.handle)
      .mouseInteraction({
        executor: this,
        delay: o.delay,
        distance: o.distance != undefined ? o.distance : 1,
        dragPrevention: o.prevention ? o.prevention.toLowerCase().split(',') : ['input','textarea','button','select','option'],
        start: this.start,
        stop: this.stop,
        drag: this.drag,
        condition: function(e, handle) {
          if(!this.disabled) {
            if(this.currentHandle) this.blur(this.currentHandle);
            this.focus(handle,1);
            return !this.disabled;
          }
        }
      })
      .wrap('<a href="javascript:void(0)" style="cursor:default;"></a>')
      .parent()
        .bind('focus', function(e) { self.focus(this.firstChild); })
        .bind('blur', function(e) { self.blur(this.firstChild); })
        .bind('keydown', function(e) {
          if(/(37|38|39|40)/.test(e.keyCode)) {
            self.moveTo({
              x: /(37|39)/.test(e.keyCode) ? (e.keyCode == 37 ? '-' : '+') + '=' + self.oneStep(1) : null,
              y: /(38|40)/.test(e.keyCode) ? (e.keyCode == 38 ? '-' : '+') + '=' + self.oneStep(2) : null
            }, this.firstChild);
          }
        })
    ;
    
    //Prepare dynamic properties for later use
    this.actualSize = { width: this.element.outerWidth() , height: this.element.outerHeight() };
    
    //Bind the click to the slider itself
    this.element.bind('mousedown.slider', function(e) {
      self.click.apply(self, [e]);
      self.currentHandle.data("ui-mouse").trigger(e);
      self.firstValue = self.firstValue + 1; //This is for always triggering the change event
    });
    
    //Move the first handle to the startValue
    $.each(o.handles || [], function(index, handle) {
      self.moveTo(handle.start, index, true);
    });
    if (!isNaN(o.startValue))
      this.moveTo(o.startValue, 0, true);
    
    //If we only have one handle, set the previous handle to this one to allow clicking before selecting the handle
    if(this.handle.length == 1) this.previousHandle = this.handle;
    if(this.handle.length == 2 && o.range) this.createRange();
  
  };
  
  $.extend($.ui.slider.prototype, {
    plugins: {},
    createRange: function() {
      this.rangeElement = $('<div></div>')
        .addClass('ui-slider-range')
        .css({ position: 'absolute' })
        .appendTo(this.element);
      this.updateRange();
    },
    updateRange: function() {
        var prop = this.options.axis == "vertical" ? "top" : "left";
        var size = this.options.axis == "vertical" ? "height" : "width";
        this.rangeElement.css(prop, parseInt($(this.handle[0]).css(prop),10) + this.handleSize(0, this.options.axis == "vertical" ? 2 : 1)/2);
        this.rangeElement.css(size, parseInt($(this.handle[1]).css(prop),10) - parseInt($(this.handle[0]).css(prop),10));
    },
    getRange: function() {
      return this.rangeElement ? this.convertValue(parseInt(this.rangeElement.css(this.options.axis == "vertical" ? "height" : "width"),10)) : null;
    },
    ui: function(e) {
      return {
        instance: this,
        options: this.options,
        handle: this.currentHandle,
        value: this.options.axis != "both" || !this.options.axis ? Math.round(this.value(null,this.options.axis == "vertical" ? 2 : 1)) : {
          x: Math.round(this.value(null,1)),
          y: Math.round(this.value(null,2))
        },
        range: this.getRange()
      };
    },
    propagate: function(n,e) {
      $.ui.plugin.call(this, n, [e, this.ui()]);
      this.element.triggerHandler(n == "slide" ? n : "slide"+n, [e, this.ui()], this.options[n]);
    },
    destroy: function() {
      this.element
        .removeClass("ui-slider ui-slider-disabled")
        .removeData("slider")
        .unbind(".slider");
      this.handle.removeMouseInteraction();
      this.generated && this.generated.remove();
    },
    enable: function() {
      this.element.removeClass("ui-slider-disabled");
      this.disabled = false;
    },
    disable: function() {
      this.element.addClass("ui-slider-disabled");
      this.disabled = true;
    },
    focus: function(handle,hard) {
      this.currentHandle = $(handle).addClass('ui-slider-handle-active');
      if(hard) this.currentHandle.parent()[0].focus();
    },
    blur: function(handle) {
      $(handle).removeClass('ui-slider-handle-active');
      if(this.currentHandle && this.currentHandle[0] == handle) { this.previousHandle = this.currentHandle; this.currentHandle = null; };
    },
    value: function(handle, axis) {
      if(this.handle.length == 1) this.currentHandle = this.handle;
      if(!axis) axis = this.options.axis == "vertical" ? 2 : 1;
      
      var value = ((parseInt($(handle != undefined && handle !== null ? this.handle[handle] || handle : this.currentHandle).css(axis == 1 ? "left" : "top"),10) / (this.actualSize[axis == 1 ? "width" : "height"] - this.handleSize(null,axis))) * this.options.realMax[axis == 1 ? "x" : "y"]) + this.options.min[axis == 1 ? "x" : "y"];
      
      var o = this.options;
      if (o.stepping[axis == 1 ? "x" : "y"]) {
          value = Math.round(value / o.stepping[axis == 1 ? "x" : "y"]) * o.stepping[axis == 1 ? "x" : "y"];
      }
      return value;
    },
    convertValue: function(value,axis) {
      if(!axis) axis = this.options.axis == "vertical" ? 2 : 1;
      return this.options.min[axis == 1 ? "x" : "y"] + (value / (this.actualSize[axis == 1 ? "width" : "height"] - this.handleSize(null,axis))) * this.options.realMax[axis == 1 ? "x" : "y"];
    },
    translateValue: function(value,axis) {
      if(!axis) axis = this.options.axis == "vertical" ? 2 : 1;
      return ((value - this.options.min[axis == 1 ? "x" : "y"]) / this.options.realMax[axis == 1 ? "x" : "y"]) * (this.actualSize[axis == 1 ? "width" : "height"] - this.handleSize(null,axis));
    },
    handleSize: function(handle,axis) {
      if(!axis) axis = this.options.axis == "vertical" ? 2 : 1;
      return $(handle != undefined && handle !== null ? this.handle[handle] : this.currentHandle)[axis == 1 ? "outerWidth" : "outerHeight"]();  
    },
    click: function(e) {
    
      // This method is only used if:
      // - The user didn't click a handle
      // - The Slider is not disabled
      // - There is a current, or previous selected handle (otherwise we wouldn't know which one to move)
      var pointer = [e.pageX,e.pageY];
      var clickedHandle = false; this.handle.each(function() { if(this == e.target) clickedHandle = true;  });
      if(clickedHandle || this.disabled || !(this.currentHandle || this.previousHandle)) return;

      //If a previous handle was focussed, focus it again
      if(this.previousHandle) this.focus(this.previousHandle, 1);
      
      //Move focussed handle to the clicked position
      this.offset = this.element.offset();
      this.moveTo({
        y: this.convertValue(e.pageY - this.offset.top - this.currentHandle.outerHeight()/2),
        x: this.convertValue(e.pageX - this.offset.left - this.currentHandle.outerWidth()/2)
      }, null, true);
    },
    start: function(e, handle) {
    
      var o = this.options;
      if(!this.currentHandle) this.focus(this.previousHandle, true); //This is a especially ugly fix for strange blur events happening on mousemove events

      this.offset = this.element.offset();
      this.handleOffset = this.currentHandle.offset();
      this.clickOffset = { top: e.pageY - this.handleOffset.top, left: e.pageX - this.handleOffset.left };
      this.firstValue = this.value();
      
      this.propagate('start', e);
      return false;
            
    },
    stop: function(e) {
      this.propagate('stop', e);
      if (this.firstValue != this.value())
        this.propagate('change', e);
      this.focus(this.currentHandle, true); //This is a especially ugly fix for strange blur events happening on mousemove events
      return false;
    },
    
    oneStep: function(axis) {
      if(!axis) axis = this.options.axis == "vertical" ? 2 : 1;
      return this.options.stepping[axis == 1 ? "x" : "y"] ? this.options.stepping[axis == 1 ? "x" : "y"] : (this.options.realMax[axis == 1 ? "x" : "y"] / this.actualSize[axis == 1 ? "width" : "height"]) * 5;
    },
    
    translateRange: function(value,axis) {
      if (this.rangeElement) {
        if (this.currentHandle[0] == this.handle[0] && value >= this.translateValue(this.value(1),axis))
          value = this.translateValue(this.value(1,axis) - this.oneStep(axis), axis);
        if (this.currentHandle[0] == this.handle[1] && value <= this.translateValue(this.value(0),axis))
          value = this.translateValue(this.value(0,axis) + this.oneStep(axis));
      }
      if (this.options.handles) {
        var handle = this.options.handles[this.handleIndex()];
        if (value < this.translateValue(handle.min,axis)) {
          value = this.translateValue(handle.min,axis);
        } else if (value > this.translateValue(handle.max,axis)) {
          value = this.translateValue(handle.max,axis);
        }
      }
      return value;
    },
    
    handleIndex: function() {
      return this.handle.index(this.currentHandle[0])
    },
    
    translateLimits: function(value,axis) {
      if(!axis) axis = this.options.axis == "vertical" ? 2 : 1;
      if (value >= this.actualSize[axis == 1 ? "width" : "height"] - this.handleSize(null,axis))
        value = this.actualSize[axis == 1 ? "width" : "height"] - this.handleSize(null,axis);
      if (value <= 0)
        value = 0;
      return value;
    },
    
    drag: function(e, handle) {

      var o = this.options;
      var position = { top: e.pageY - this.offset.top - this.clickOffset.top, left: e.pageX - this.offset.left - this.clickOffset.left};
      if(!this.currentHandle) this.focus(this.previousHandle, true); //This is a especially ugly fix for strange blur events happening on mousemove events

      position.left = this.translateLimits(position.left,1);
      position.top = this.translateLimits(position.top,2);
      
      if (o.stepping.x) {
        var value = this.convertValue(position.left,1);
        value = Math.round(value / o.stepping.x) * o.stepping.x;
        position.left = this.translateValue(value, 1);  
      }
      if (o.stepping.y) {
        var value = this.convertValue(position.top,2);
        value = Math.round(value / o.stepping.y) * o.stepping.y;
        position.top = this.translateValue(value, 2); 
      }
      
      position.left = this.translateRange(position.left, 1);
      position.top = this.translateRange(position.top, 2);

      if(o.axis != "vertical") this.currentHandle.css({ left: position.left });
      if(o.axis != "horizontal") this.currentHandle.css({ top: position.top });
      
      if (this.rangeElement)
        this.updateRange();
      this.propagate('slide', e);
      return false;
    },
    
    moveTo: function(value, handle, noPropagation) {
      var o = this.options;
      if (handle == undefined && !this.currentHandle && this.handle.length != 1)
        return false; //If no handle has been passed, no current handle is available and we have multiple handles, return false
      if (handle == undefined && !this.currentHandle)
        handle = 0; //If only one handle is available, use it
      if (handle != undefined)
        this.currentHandle = this.previousHandle = $(this.handle[handle] || handle);



      if(value.x !== undefined && value.y !== undefined) {
        var x = value.x;
        var y = value.y;
      } else {
        var x = value, y = value;
      }

      if(x && x.constructor != Number) {
        if (/^\-\=/.test(x) ) {
          x = this.value(null,1) - parseInt(x.replace('-=', ''), 10);
        } else if (/^\+\=/.test(x) ) {
          x = this.value(null,1) + parseInt(x.replace('+=', ''), 10);
        }
      }
      
      if(y && y.constructor != Number) {
        if (/^\-\=/.test(y) ) {
          y = this.value(null,2) - parseInt(y.replace('-=', ''), 10);
        } else if (/^\+\=/.test(y) ) {
          y = this.value(null,2) + parseInt(y.replace('+=', ''), 10);
        }
      }

      if(o.axis != "vertical" && x) {
        if(o.stepping.x) x = Math.round(x / o.stepping.x) * o.stepping.x;
        x = this.translateValue(x, 1);
        x = this.translateLimits(x, 1);
        x = this.translateRange(x, 1);
        this.currentHandle.css({ left: x });
      }

      if(o.axis != "horizontal" && y) {
        if(o.stepping.y) y = Math.round(y / o.stepping.y) * o.stepping.y;
        y = this.translateValue(y, 2);
        y = this.translateLimits(y, 2);
        y = this.translateRange(y, 2);
        this.currentHandle.css({ top: y });
      }
      
      if (this.rangeElement)
        this.updateRange();
      
      if (!noPropagation) {
        this.propagate('start', null);
        this.propagate('stop', null);
        this.propagate('change', null);
        this.propagate("slide", null);
      }
    }
  });
  
  $.ui.slider.defaults = {
    handle: ".ui-slider-handle"
  };

})(jQuery);

/*
 * jQuery UI Sortable
 *
 * Copyright (c) 2008 Paul Bakaus
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 * 
 * http://docs.jquery.com/UI/Sortables
 *
 * Depends:
 *   ui.base.js
 *
 * Revision: $Id: ui.sortable.js 5199 2008-04-04 14:04:32Z paul.bakaus $
 */
;(function($) {

  if (window.Node && Node.prototype && !Node.prototype.contains) {
    Node.prototype.contains = function (arg) {
      return !!(this.compareDocumentPosition(arg) & 16);
    };
  }

  $.fn.extend({
    sortable: function(options) {
      
      var args = Array.prototype.slice.call(arguments, 1);
      
      if (options == "serialize" || options == "toArray")
        return $.data(this[0], "sortable")[options](arguments[1]);
      
      return this.each(function() {
        if (typeof options == "string") {
          var sort = $.data(this, "sortable");
          if (sort) sort[options].apply(sort, args);

        } else if(!$.data(this, "sortable"))
          new $.ui.sortable(this, options);
      });
    }
  });
  
  $.ui.sortable = function(element, options) {
    //Initialize needed constants
    var self = this;
    
    this.element = $(element);
    this.containerCache = {};
    
    $.data(element, "sortable", this);
    this.element.addClass("ui-sortable");

    //Prepare the passed options
    this.options = $.extend({}, options);
    var o = this.options;
    $.extend(o, {
      items: this.options.items || '> *',
      zIndex: this.options.zIndex || 1000,
      startCondition: function() {
        return !self.options.disabled;
      }
    });
    
    $(element).bind("setData.sortable", function(event, key, value){
      self.options[key] = value;
    }).bind("getData.sortable", function(event, key){
      return self.options[key];
    });
    
    //Get the items
    this.refresh();

    //Let's determine if the items are floating
    this.floating = this.items.length ? (/left|right/).test(this.items[0].item.css('float')) : false;
    
    //Let's determine the parent's offset
    if(!(/(relative|absolute|fixed)/).test(this.element.css('position'))) this.element.css('position', 'relative');
    this.offset = this.element.offset();

    //Initialize mouse events for interaction
    this.element.mouseInteraction({
      executor: this,
      delay: o.delay,
      distance: o.distance || 0,
      dragPrevention: o.prevention ? o.prevention.toLowerCase().split(',') : ['input','textarea','button','select','option'],
      start: this.start,
      stop: this.stop,
      drag: this.drag,
      condition: function(e) {

        if(this.options.disabled || this.options.type == 'static') return false;

        //Find out if the clicked node (or one of its parents) is a actual item in this.items
        var currentItem = null, nodes = $(e.target).parents().each(function() { 
          if($.data(this, 'sortable-item')) {
            currentItem = $(this);
            return false;
          }
        });
        if($.data(e.target, 'sortable-item')) currentItem = $(e.target);
        
        if(!currentItem) return false;  
        if(this.options.handle) {
          var validHandle = false;
          $(this.options.handle, currentItem).each(function() { if(this == e.target) validHandle = true; });
          if(!validHandle) return false;
        }
          
        this.currentItem = currentItem;
        return true;

      }
    });
    
    //Prepare cursorAt
    if(o.cursorAt && o.cursorAt.constructor == Array)
      o.cursorAt = { left: o.cursorAt[0], top: o.cursorAt[1] };
  };
  
  $.extend($.ui.sortable.prototype, {
    plugins: {},
    ui: function(inst) {
      return {
        helper: (inst || this)["helper"],
        placeholder: (inst || this)["placeholder"] || $([]),
        position: (inst || this)["position"].current,
        absolutePosition: (inst || this)["position"].absolute,
        instance: this,
        options: this.options,
        element: this.element,
        item: (inst || this)["currentItem"],
        sender: inst ? inst.element : null
      };    
    },
    propagate: function(n,e,inst) {
      $.ui.plugin.call(this, n, [e, this.ui(inst)]);
      this.element.triggerHandler(n == "sort" ? n : "sort"+n, [e, this.ui(inst)], this.options[n]);
    },
    serialize: function(o) {
      
      var items = $(this.options.items, this.element).not('.ui-sortable-helper'); //Only the items of the sortable itself
      var str = []; o = o || {};
      
      items.each(function() {
        var res = ($(this).attr(o.attribute || 'id') || '').match(o.expression || (/(.+)[-=_](.+)/));
        if(res) str.push((o.key || res[1])+'[]='+(o.key ? res[1] : res[2]));
      });
      
      return str.join('&');
      
    },
    toArray: function(attr) {
      var items = $(this.options.items, this.element).not('.ui-sortable-helper'); //Only the items of the sortable itself
      var ret = [];

      items.each(function() { ret.push($(this).attr(attr || 'id')); });
      return ret;
    },
    enable: function() {
      this.element.removeClass("ui-sortable-disabled");
      this.options.disabled = false;
    },
    disable: function() {
      this.element.addClass("ui-sortable-disabled");
      this.options.disabled = true;
    },
    /* Be careful with the following core functions */
    intersectsWith: function(item) {
      
      var x1 = this.position.absolute.left, x2 = x1 + this.helperProportions.width,
          y1 = this.position.absolute.top, y2 = y1 + this.helperProportions.height;
      var l = item.left, r = l + item.width, 
          t = item.top,  b = t + item.height;
      
      return (   l < x1 + (this.helperProportions.width  / 2)    // Right Half
        &&     x2 - (this.helperProportions.width  / 2) < r    // Left Half
        && t < y1 + (this.helperProportions.height / 2)        // Bottom Half
        &&     y2 - (this.helperProportions.height / 2) < b ); // Top Half
      
    },
    intersectsWithEdge: function(item) {  
      var x1 = this.position.absolute.left, x2 = x1 + this.helperProportions.width,
          y1 = this.position.absolute.top, y2 = y1 + this.helperProportions.height;
      var l = item.left, r = l + item.width, 
          t = item.top,  b = t + item.height;


      if (!(   l < x1 + (this.helperProportions.width  / 2)    // Right Half
        &&     x2 - (this.helperProportions.width  / 2) < r    // Left Half
        && t < y1 + (this.helperProportions.height / 2)        // Bottom Half
        &&     y2 - (this.helperProportions.height / 2) < b )) return false; // Top Half
      
      if(this.floating) {
        if(x2 > l && x1 < l) return 2; //Crosses left edge
        if(x1 < r && x2 > r) return 1; //Crosses right edge
      } else {
        if(y2 > t && y1 < t) return 1; //Crosses top edge
        if(y1 < b && y2 > b) return 2; //Crosses bottom edge
      }
      
      return false;
      
    },
    //This method checks approximately if the item is dragged in a container, but doesn't touch any items
    inEmptyZone: function(container) {

      if(!$(container.options.items, container.element).length) {
        return container.options.dropOnEmpty ? true : false;
      };

      var last = $(container.options.items, container.element).not('.ui-sortable-helper'); last = $(last[last.length-1]);
      var top = last.offset()[this.floating ? 'left' : 'top'] + last[0][this.floating ? 'offsetWidth' : 'offsetHeight'];
      return (this.position.absolute[this.floating ? 'left' : 'top'] > top);
    },
    refresh: function() {
      this.refreshItems();
      this.refreshPositions();
    },
    refreshItems: function() {
      
      this.items = [];
      this.containers = [this];
      var items = this.items;
      var queries = [$(this.options.items, this.element)];
      
      if(this.options.connectWith) {
        for (var i = this.options.connectWith.length - 1; i >= 0; i--){
          var cur = $(this.options.connectWith[i]);
          for (var j = cur.length - 1; j >= 0; j--){
            var inst = $.data(cur[j], 'sortable');
            if(inst && !inst.options.disabled) {
              queries.push($(inst.options.items, inst.element));
              this.containers.push(inst);
            }
          };
        };
      }

      for (var i = queries.length - 1; i >= 0; i--){
        queries[i].each(function() {
          $.data(this, 'sortable-item', true); // Data for target checking (mouse manager)
          items.push({
            item: $(this),
            width: 0, height: 0,
            left: 0, top: 0
          });
        });
      };

    },
    refreshPositions: function(fast) {
      for (var i = this.items.length - 1; i >= 0; i--){
        if(!fast) this.items[i].width       = this.items[i].item.outerWidth();
        if(!fast) this.items[i].height      = this.items[i].item.outerHeight();
        var p = this.items[i].item.offset();
        this.items[i].left            = p.left;
        this.items[i].top             = p.top;
      };
      for (var i = this.containers.length - 1; i >= 0; i--){
        var p =this.containers[i].element.offset();
        this.containers[i].containerCache.left  = p.left;
        this.containers[i].containerCache.top   = p.top;
        this.containers[i].containerCache.width = this.containers[i].element.outerWidth();
        this.containers[i].containerCache.height= this.containers[i].element.outerHeight();
      };
    },
    destroy: function() {
      this.element
        .removeClass("ui-sortable ui-sortable-disabled")
        .removeData("sortable")
        .unbind(".sortable")
        .removeMouseInteraction();
      
      for ( var i = this.items.length - 1; i >= 0; i-- )
        this.items[i].item.removeData("sortable-item");
    },
    createPlaceholder: function(that) {
      (that || this).placeholderElement = this.options.placeholderElement ? $(this.options.placeholderElement, (that || this).currentItem) : (that || this).currentItem;
      (that || this).placeholder = $('<div></div>')
        .addClass(this.options.placeholder)
        .appendTo('body')
        .css({ position: 'absolute' })
        .css((that || this).placeholderElement.offset())
        .css({ width: (that || this).placeholderElement.outerWidth(), height: (that || this).placeholderElement.outerHeight() })
        ;
    },
    contactContainers: function(e) {
      for (var i = this.containers.length - 1; i >= 0; i--){

        if(this.intersectsWith(this.containers[i].containerCache)) {
          if(!this.containers[i].containerCache.over) {
            

            if(this.currentContainer != this.containers[i]) {
              
              //When entering a new container, we will find the item with the least distance and append our item near it
              var dist = 10000; var itemWithLeastDistance = null; var base = this.position.absolute[this.containers[i].floating ? 'left' : 'top'];
              for (var j = this.items.length - 1; j >= 0; j--) {
                if(!this.containers[i].element[0].contains(this.items[j].item[0])) continue;
                var cur = this.items[j][this.containers[i].floating ? 'left' : 'top'];
                if(Math.abs(cur - base) < dist) {
                  dist = Math.abs(cur - base); itemWithLeastDistance = this.items[j];
                }
              }
              
              //We also need to exchange the placeholder
              if(this.placeholder) this.placeholder.remove();
              if(this.containers[i].options.placeholder) {
                this.containers[i].createPlaceholder(this);
              } else {
                this.placeholder = null; this.placeholderElement = null;
              }
              
              
              itemWithLeastDistance ? this.rearrange(e, itemWithLeastDistance) : this.rearrange(e, null, this.containers[i].element);
              this.propagate("change", e); //Call plugins and callbacks
              this.containers[i].propagate("change", e, this); //Call plugins and callbacks
              this.currentContainer = this.containers[i];

            }
            
            this.containers[i].propagate("over", e, this);
            this.containers[i].containerCache.over = 1;
          }
        } else {
          if(this.containers[i].containerCache.over) {
            this.containers[i].propagate("out", e, this);
            this.containers[i].containerCache.over = 0;
          }
        }
        
      };      
    },
    start: function(e,el) {
      
      var o = this.options;
      this.refresh();

      //Create and append the visible helper
      this.helper = typeof o.helper == 'function' ? $(o.helper.apply(this.element[0], [e, this.currentItem])) : this.currentItem.clone();
      if(!this.helper.parents('body').length) this.helper.appendTo(o.appendTo || this.currentItem[0].parentNode); //Add the helper to the DOM if that didn't happen already
      this.helper.css({ position: 'absolute', clear: 'both' }).addClass('ui-sortable-helper'); //Position it absolutely and add a helper class
      
      //Prepare variables for position generation
      $.extend(this, {
        offsetParent: this.helper.offsetParent(),
        offsets: {
          absolute: this.currentItem.offset()
        },
        mouse: {
          start: { top: e.pageY, left: e.pageX }
        },
        margins: {
          top: parseInt(this.currentItem.css("marginTop")) || 0,
          left: parseInt(this.currentItem.css("marginLeft")) || 0
        }
      });
      
      //The relative click offset
      this.offsets.parent = this.offsetParent.offset();
      this.clickOffset = { left: e.pageX - this.offsets.absolute.left, top: e.pageY - this.offsets.absolute.top };
      
      this.originalPosition = {
        left: this.offsets.absolute.left - this.offsets.parent.left - this.margins.left,
        top: this.offsets.absolute.top - this.offsets.parent.top - this.margins.top
      }
      
      //Generate a flexible offset that will later be subtracted from e.pageX/Y
      //I hate margins - they need to be removed before positioning the element absolutely..
      this.offset = {
        left: e.pageX - this.originalPosition.left,
        top: e.pageY - this.originalPosition.top
      };

      //Save the first time position
      $.extend(this, {
        position: {
          current: { top: e.pageY - this.offset.top, left: e.pageX - this.offset.left },
          absolute: { left: e.pageX - this.clickOffset.left, top: e.pageY - this.clickOffset.top },
          dom: this.currentItem.prev()[0]
        }
      });

      //If o.placeholder is used, create a new element at the given position with the class
      if(o.placeholder) this.createPlaceholder();

      this.propagate("start", e); //Call plugins and callbacks
      this.helperProportions = { width: this.helper.outerWidth(), height: this.helper.outerHeight() }; //Save and store the helper proportions

      //If we have something in cursorAt, we'll use it
      if(o.cursorAt) {
        if(o.cursorAt.top != undefined || o.cursorAt.bottom != undefined) {
          this.offset.top -= this.clickOffset.top - (o.cursorAt.top != undefined ? o.cursorAt.top : (this.helperProportions.height - o.cursorAt.bottom));
          this.clickOffset.top = (o.cursorAt.top != undefined ? o.cursorAt.top : (this.helperProportions.height - o.cursorAt.bottom));
        }
        if(o.cursorAt.left != undefined || o.cursorAt.right != undefined) {
          this.offset.left -= this.clickOffset.left - (o.cursorAt.left != undefined ? o.cursorAt.left : (this.helperProportions.width - o.cursorAt.right));
          this.clickOffset.left = (o.cursorAt.left != undefined ? o.cursorAt.left : (this.helperProportions.width - o.cursorAt.right));
        }
      }

      if(this.options.placeholder != 'clone') $(this.currentItem).css('visibility', 'hidden'); //Set the original element visibility to hidden to still fill out the white space
      for (var i = this.containers.length - 1; i >= 0; i--) { this.containers[i].propagate("activate", e, this); } //Post 'activate' events to possible containers
      
      //Prepare possible droppables
      if($.ui.ddmanager) $.ui.ddmanager.current = this;
      if ($.ui.ddmanager && !o.dropBehaviour) $.ui.ddmanager.prepareOffsets(this, e);

      this.dragging = true;
      return false;
      
    },
    stop: function(e) {

      this.propagate("stop", e); //Call plugins and trigger callbacks
      if(this.position.dom != this.currentItem.prev()[0]) this.propagate("update", e); //Trigger update callback if the DOM position has changed
      if(!this.element[0].contains(this.currentItem[0])) { //Node was moved out of the current element
        this.propagate("remove", e);
        for (var i = this.containers.length - 1; i >= 0; i--){
          if(this.containers[i].element[0].contains(this.currentItem[0])) {
            this.containers[i].propagate("update", e, this);
            this.containers[i].propagate("receive", e, this);
          }
        };
      };
      
      //Post events to containers
      for (var i = this.containers.length - 1; i >= 0; i--){
        this.containers[i].propagate("deactivate", e, this);
        if(this.containers[i].containerCache.over) {
          this.containers[i].propagate("out", e, this);
          this.containers[i].containerCache.over = 0;
        }
      }
      
      //If we are using droppables, inform the manager about the drop
      if ($.ui.ddmanager && !this.options.dropBehaviour) $.ui.ddmanager.drop(this, e);
      
      this.dragging = false;
      if(this.cancelHelperRemoval) return false;
      $(this.currentItem).css('visibility', '');
      if(this.placeholder) this.placeholder.remove();
      this.helper.remove();

      return false;
      
    },
    drag: function(e) {

      //Compute the helpers position
      this.position.current = { top: e.pageY - this.offset.top, left: e.pageX - this.offset.left };
      this.position.absolute = { left: e.pageX - this.clickOffset.left, top: e.pageY - this.clickOffset.top };

      //Rearrange
      for (var i = this.items.length - 1; i >= 0; i--) {
        var intersection = this.intersectsWithEdge(this.items[i]);
        if(!intersection) continue;
        
        if(     this.items[i].item[0] != this.currentItem[0] //cannot intersect with itself
          &&  this.currentItem[intersection == 1 ? "next" : "prev"]()[0] != this.items[i].item[0] //no useless actions that have been done before
          &&  !this.currentItem[0].contains(this.items[i].item[0]) //no action if the item moved is the parent of the item checked
          && (this.options.type == 'semi-dynamic' ? !this.element[0].contains(this.items[i].item[0]) : true)
        ) {
          
          this.direction = intersection == 1 ? "down" : "up";
          this.rearrange(e, this.items[i]);
          this.propagate("change", e); //Call plugins and callbacks
          break;
        }
      }
      
      //Post events to containers
      this.contactContainers(e);
      
      //Interconnect with droppables
      if($.ui.ddmanager) $.ui.ddmanager.drag(this, e);

      this.propagate("sort", e); //Call plugins and callbacks
      this.helper.css({ left: this.position.current.left+'px', top: this.position.current.top+'px' }); // Stick the helper to the cursor
      return false;
      
    },
    rearrange: function(e, i, a) {
      a ? a.append(this.currentItem) : i.item[this.direction == 'down' ? 'before' : 'after'](this.currentItem);
      this.refreshPositions(true); //Precompute after each DOM insertion, NOT on mousemove
      if(this.placeholderElement) this.placeholder.css(this.placeholderElement.offset());
    }
  });
  
/*
 * Sortable Extensions
 */

  $.ui.plugin.add("sortable", "cursor", {
    start: function(e, ui) {
      var t = $('body');
      if (t.css("cursor")) ui.options._cursor = t.css("cursor");
      t.css("cursor", ui.options.cursor);
    },
    stop: function(e, ui) {
      if (ui.options._cursor) $('body').css("cursor", ui.options._cursor);
    }
  });

  $.ui.plugin.add("sortable", "zIndex", {
    start: function(e, ui) {
      var t = ui.helper;
      if(t.css("zIndex")) ui.options._zIndex = t.css("zIndex");
      t.css('zIndex', ui.options.zIndex);
    },
    stop: function(e, ui) {
      if(ui.options._zIndex) $(ui.helper).css('zIndex', ui.options._zIndex);
    }
  });

  $.ui.plugin.add("sortable", "opacity", {
    start: function(e, ui) {
      var t = ui.helper;
      if(t.css("opacity")) ui.options._opacity = t.css("opacity");
      t.css('opacity', ui.options.opacity);
    },
    stop: function(e, ui) {
      if(ui.options._opacity) $(ui.helper).css('opacity', ui.options._opacity);
    }
  });


  $.ui.plugin.add("sortable", "revert", {
    stop: function(e, ui) {
      var self = ui.instance;
      self.cancelHelperRemoval = true;
      var cur = self.currentItem.offset();
      var op = self.helper.offsetParent().offset();
      if(ui.instance.options.zIndex) ui.helper.css('zIndex', ui.instance.options.zIndex); //Do the zIndex again because it already was resetted by the plugin above on stop

      //Also animate the placeholder if we have one
      if(ui.instance.placeholder) ui.instance.placeholder.animate({ opacity: 'hide' }, parseInt(ui.options.revert, 10) || 500);
      
      
      ui.helper.animate({
        left: cur.left - op.left - self.margins.left,
        top: cur.top - op.top - self.margins.top
      }, parseInt(ui.options.revert, 10) || 500, function() {
        self.currentItem.css('visibility', 'visible');
        window.setTimeout(function() {
          if(self.placeholder) self.placeholder.remove();
          self.helper.remove();
          if(ui.options._zIndex) ui.helper.css('zIndex', ui.options._zIndex);
        }, 50);
      });
    }
  });

  
  $.ui.plugin.add("sortable", "containment", {
    start: function(e, ui) {

      var o = ui.options;
      if((o.containment.left != undefined || o.containment.constructor == Array) && !o._containment) return;
      if(!o._containment) o._containment = o.containment;

      if(o._containment == 'parent') o._containment = this[0].parentNode;
      if(o._containment == 'sortable') o._containment = this[0];
      if(o._containment == 'document') {
        o.containment = [
          0,
          0,
          $(document).width(),
          ($(document).height() || document.body.parentNode.scrollHeight)
        ];
      } else { //I'm a node, so compute top/left/right/bottom

        var ce = $(o._containment);
        var co = ce.offset();

        o.containment = [
          co.left,
          co.top,
          co.left+(ce.outerWidth() || ce[0].scrollWidth),
          co.top+(ce.outerHeight() || ce[0].scrollHeight)
        ];
      }

    },
    sort: function(e, ui) {

      var o = ui.options;
      var h = ui.helper;
      var c = o.containment;
      var self = ui.instance;
      var borderLeft = (parseInt(self.offsetParent.css("borderLeftWidth"), 10) || 0);
      var borderRight = (parseInt(self.offsetParent.css("borderRightWidth"), 10) || 0);
      var borderTop = (parseInt(self.offsetParent.css("borderTopWidth"), 10) || 0);
      var borderBottom = (parseInt(self.offsetParent.css("borderBottomWidth"), 10) || 0);
      
      if(c.constructor == Array) {
        if((self.position.absolute.left < c[0])) self.position.current.left = c[0] - self.offsets.parent.left - self.margins.left;
        if((self.position.absolute.top < c[1])) self.position.current.top = c[1] - self.offsets.parent.top - self.margins.top;
        if(self.position.absolute.left - c[2] + self.helperProportions.width >= 0) self.position.current.left = c[2] - self.offsets.parent.left - self.helperProportions.width - self.margins.left - borderLeft - borderRight;
        if(self.position.absolute.top - c[3] + self.helperProportions.height >= 0) self.position.current.top = c[3] - self.offsets.parent.top - self.helperProportions.height - self.margins.top - borderTop - borderBottom;
      } else {
        if((ui.position.left < c.left)) self.position.current.left = c.left;
        if((ui.position.top < c.top)) self.position.current.top = c.top;
        if(ui.position.left - self.offsetParent.innerWidth() + self.helperProportions.width + c.right + borderLeft + borderRight >= 0) self.position.current.left = self.offsetParent.innerWidth() - self.helperProportions.width - c.right - borderLeft - borderRight;
        if(ui.position.top - self.offsetParent.innerHeight() + self.helperProportions.height + c.bottom + borderTop + borderBottom >= 0) self.position.current.top = self.offsetParent.innerHeight() - self.helperProportions.height - c.bottom - borderTop - borderBottom;
      }

    }
  });

  $.ui.plugin.add("sortable", "axis", {
    sort: function(e, ui) {
      var o = ui.options;
      if(o.constraint) o.axis = o.constraint; //Legacy check
      o.axis == 'x' ? ui.instance.position.top = ui.instance.originalPosition.top : ui.instance.position.left = ui.instance.originalPosition.left;
    }
  });

  $.ui.plugin.add("sortable", "scroll", {
    start: function(e, ui) {
      var o = ui.options;
      o.scrollSensitivity = o.scrollSensitivity || 20;
      o.scrollSpeed   = o.scrollSpeed || 20;

      ui.instance.overflowY = function(el) {
        do { if((/auto|scroll/).test(el.css('overflow')) || (/auto|scroll/).test(el.css('overflow-y'))) return el; el = el.parent(); } while (el[0].parentNode);
        return $(document);
      }(this);
      ui.instance.overflowX = function(el) {
        do { if((/auto|scroll/).test(el.css('overflow')) || (/auto|scroll/).test(el.css('overflow-x'))) return el; el = el.parent(); } while (el[0].parentNode);
        return $(document);
      }(this);
      
      if(ui.instance.overflowY[0] != document && ui.instance.overflowY[0].tagName != 'HTML') ui.instance.overflowYstart = ui.instance.overflowY[0].scrollTop;
      if(ui.instance.overflowX[0] != document && ui.instance.overflowX[0].tagName != 'HTML') ui.instance.overflowXstart = ui.instance.overflowX[0].scrollLeft;
      
    },
    sort: function(e, ui) {
      
      var o = ui.options;
      var i = ui.instance;

      if(i.overflowY[0] != document && i.overflowY[0].tagName != 'HTML') {
        if(i.overflowY[0].offsetHeight - (ui.position.top - i.overflowY[0].scrollTop + i.clickOffset.top) < o.scrollSensitivity)
          i.overflowY[0].scrollTop = i.overflowY[0].scrollTop + o.scrollSpeed;
        if((ui.position.top - i.overflowY[0].scrollTop + i.clickOffset.top) < o.scrollSensitivity)
          i.overflowY[0].scrollTop = i.overflowY[0].scrollTop - o.scrollSpeed;        
      } else {
        //$(document.body).append('<p>'+(e.pageY - $(document).scrollTop())+'</p>');
        if(e.pageY - $(document).scrollTop() < o.scrollSensitivity)
          $(document).scrollTop($(document).scrollTop() - o.scrollSpeed);
        if($(window).height() - (e.pageY - $(document).scrollTop()) < o.scrollSensitivity)
          $(document).scrollTop($(document).scrollTop() + o.scrollSpeed);
      }
      
      if(i.overflowX[0] != document && i.overflowX[0].tagName != 'HTML') {
        if(i.overflowX[0].offsetWidth - (ui.position.left - i.overflowX[0].scrollLeft + i.clickOffset.left) < o.scrollSensitivity)
          i.overflowX[0].scrollLeft = i.overflowX[0].scrollLeft + o.scrollSpeed;
        if((ui.position.top - i.overflowX[0].scrollLeft + i.clickOffset.left) < o.scrollSensitivity)
          i.overflowX[0].scrollLeft = i.overflowX[0].scrollLeft - o.scrollSpeed;        
      } else {
        if(e.pageX - $(document).scrollLeft() < o.scrollSensitivity)
          $(document).scrollLeft($(document).scrollLeft() - o.scrollSpeed);
        if($(window).width() - (e.pageX - $(document).scrollLeft()) < o.scrollSensitivity)
          $(document).scrollLeft($(document).scrollLeft() + o.scrollSpeed);
      }
      
      //ui.instance.recallOffset(e);
      i.offset = {
        left: i.mouse.start.left - i.originalPosition.left + (i.overflowXstart !== undefined ? i.overflowXstart - i.overflowX[0].scrollLeft : 0),
        top: i.mouse.start.top - i.originalPosition.top + (i.overflowYstart !== undefined ? i.overflowYstart - i.overflowX[0].scrollTop : 0)
      };

    }
  });

})(jQuery);
