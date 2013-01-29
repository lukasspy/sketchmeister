/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window, CodeMirror, document */

define(function (require, exports, module) {
	"use strict";

	require('jquery-ui-1.9.2.custom.min');
	require('runmode');
    require('sketch');
    require('kinetic-v4.3.1.min');
    //require('kinetic-functions');

	var CommandManager = brackets.getModule("command/CommandManager"),
		EditorManager = brackets.getModule("editor/EditorManager"),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		Editor = brackets.getModule("editor/Editor").Editor,
		DocumentManager = brackets.getModule("document/DocumentManager"),
        AppInit = brackets.getModule("utils/AppInit"),
		EditorUtils = brackets.getModule("editor/EditorUtils"),
		Menus = brackets.getModule("command/Menus"),
		COMMAND_ID = "me.lukasspy.brackets.sketchmeister";

    var _sketchingAreaIdCounter = 0;
    
	var loadCSSPromise = ExtensionUtils.loadStyleSheet(module, 'main.css');
	var active = false;
    var sketchIconActive = require.toUrl('./sketch_button_on.png');
    var sketchIconDeactive = require.toUrl('./sketch_button_off.png');
    var testImage = require.toUrl('./brackets-minimap.png');
    
    var _activeEditor = null;
    var _activeDocument = null;
    var _documentSketchingAreas = [];
    var _activeSketchingArea = null;
    var _codeMirror = null;
    
    /*----- functions for kinetic drag/resize ------*/
    function update(activeAnchor) {
        var group = activeAnchor.getParent();

        var topLeft = group.get('.topLeft')[0];
        var topRight = group.get('.topRight')[0];
        var bottomRight = group.get('.bottomRight')[0];
        var bottomLeft = group.get('.bottomLeft')[0];
        var image = group.get('.image')[0];

        var anchorX = activeAnchor.getX();
        var anchorY = activeAnchor.getY();

        // update anchor positions
        switch (activeAnchor.getName()) {
          case 'topLeft':
            topRight.setY(anchorY);
            bottomLeft.setX(anchorX);
            break;
          case 'topRight':
            topLeft.setY(anchorY);
            bottomRight.setX(anchorX);
            break;
          case 'bottomRight':
            bottomLeft.setY(anchorY);
            topRight.setX(anchorX); 
            break;
          case 'bottomLeft':
            bottomRight.setY(anchorY);
            topLeft.setX(anchorX); 
            break;
        }

        image.setPosition(topLeft.getPosition());

        var width = topRight.getX() - topLeft.getX();
        var height = bottomLeft.getY() - topLeft.getY();
        if(width && height) {
          image.setSize(width, height);
        }
      }
      function addAnchor(group, x, y, name) {
        var stage = group.getStage();
        var layer = group.getLayer();

        var anchor = new Kinetic.Circle({
          x: x,
          y: y,
          stroke: '#666',
          fill: '#ddd',
          strokeWidth: 1,
          radius: 8,
          name: name,
          draggable: true,
          dragOnTop: false
        });

        anchor.on('dragmove', function() {
          update(this);
          layer.draw();
        });
        anchor.on('mousedown touchstart', function() {
          group.setDraggable(false);
          this.moveToTop();
        });
        anchor.on('dragend', function() {
          group.setDraggable(true);
          layer.draw();
        });
        // add hover styling
        anchor.on('mouseover', function() {
          var layer = this.getLayer();
          document.body.style.cursor = 'pointer';
          this.setStrokeWidth(4);
          layer.draw();
        });
        anchor.on('mouseout', function() {
          var layer = this.getLayer();
          document.body.style.cursor = 'default';
          this.setStrokeWidth(2);
          layer.draw();
        });

        group.add(anchor);
      }
      function loadImages(sources, callback) {
        var images = {};
        var loadedImages = 0;
        var numImages = 0;
        for(var src in sources) {
          numImages++;
        }
        for(var src in sources) {
          images[src] = new Image();
          images[src].onload = function() {
            if(++loadedImages >= numImages) {
              callback(images);
            }
          };
          images[src].src = sources[src];
        }
      }
    function addImageToStage(imageToAdd) { 
        console.log('found');
        var helpImage = new Image();
        helpImage.src = imageToAdd.newImage;
        var widthOfImage = helpImage.width;
        var heightOfImage = helpImage.height;
        console.log(widthOfImage + " and " + heightOfImage);
        
        var stage = new Kinetic.Stage({
          container: 'overlay-' + _activeSketchingArea.id,
          width: 578,
          height: 400
        });
        
        var imageGroup = new Kinetic.Group({
          x: 100,
          y: 100,
          draggable: true
        });
        var layer = new Kinetic.Layer();
        layer.add(imageGroup);
        stage.add(layer);
        
        
        
        // darth vader
        var newImg = new Kinetic.Image({
          x: 0,
          y: 0,
          image: imageToAdd.newImage,
          width: widthOfImage,
          height: heightOfImage,
          name: 'image'
        });

        imageGroup.add(newImg);
        addAnchor(imageGroup, 0, 0, 'topLeft');
        addAnchor(imageGroup, 200, 0, 'topRight');
        addAnchor(imageGroup, 200, 138, 'bottomRight');
        addAnchor(imageGroup, 0, 138, 'bottomLeft');

        imageGroup.on('dragstart', function() {
          this.moveToTop();
        });
        stage.draw();
    }
    
    function initStage(images) {
        var stage = new Kinetic.Stage({
          container: 'overlay-' + _activeSketchingArea.id,
          width: 578,
          height: 400
        });
        var darthVaderGroup = new Kinetic.Group({
          x: 270,
          y: 100,
          draggable: true
        });
        var yodaGroup = new Kinetic.Group({
          x: 100,
          y: 110,
          draggable: true
        });
        var layer = new Kinetic.Layer();

        /*
         * go ahead and add the groups
         * to the layer and the layer to the
         * stage so that the groups have knowledge
         * of its layer and stage
         */
        layer.add(darthVaderGroup);
        layer.add(yodaGroup);
        stage.add(layer);

        // darth vader
        var darthVaderImg = new Kinetic.Image({
          x: 0,
          y: 0,
          image: images.darthVader,
          width: 200,
          height: 138,
          name: 'image'
        });

        darthVaderGroup.add(darthVaderImg);
        addAnchor(darthVaderGroup, 0, 0, 'topLeft');
        addAnchor(darthVaderGroup, 200, 0, 'topRight');
        addAnchor(darthVaderGroup, 200, 138, 'bottomRight');
        addAnchor(darthVaderGroup, 0, 138, 'bottomLeft');

        darthVaderGroup.on('dragstart', function() {
          this.moveToTop();
        });
        // yoda
        var yodaImg = new Kinetic.Image({
          x: 0,
          y: 0,
          image: images.yoda,
          width: 93,
          height: 104,
          name: 'image'
        });

        yodaGroup.add(yodaImg);
        addAnchor(yodaGroup, 0, 0, 'topLeft');
        addAnchor(yodaGroup, 93, 0, 'topRight');
        addAnchor(yodaGroup, 93, 104, 'bottomRight');
        addAnchor(yodaGroup, 0, 104, 'bottomLeft');

        yodaGroup.on('dragstart', function() {
          this.moveToTop();
        });

        stage.draw();
      }

      var sources = {
        darthVader: sketchIconActive,
        yoda: sketchIconDeactive
      };
    /*----- functions for sketching area ------*/
    
    
    function _addSketchingTools(id) {
        $(_activeEditor.getScrollerElement()).append('<div class="tools" id="tools-' + id + '"><a href="#simple_sketch-' + id + '" data-tool="eraser">Era</a></div>');
        $.each(['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#000', '#fff'], function () {
            $('#tools-' + id).append("<a href='#simple_sketch-" + id + "' data-tool='marker' data-color='" + this + "' style='width: 30px; background: " + this + ";'></a> ");
        });
        $.each([3, 5, 10, 15], function () {
            $('#tools-' + id).append("<a href='#simple_sketch-" + id + "' data-tool='marker' data-size='" + this + "' style='background: transparent'>" + this + "</a> ");
        });
        $('#tools-' + id).append("<a href='#' style='background: transparent' class='addImageToStage'>add</a> ");
        if (!active) {
            $('#tools-' + id).hide();
        }
    }
    
    function _addToolbarIcon(id) {
        $('#main-toolbar .buttons').prepend('<a href="#" id="toggle-sketching" title="SketchMeister"></a>');
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
    }

    function _addSketchingArea(path) {
        var id = _sketchingAreaIdCounter++;
        var sketchingArea = {'fullPath' : path, 'id' : id, 'active' : true};
        
        var height = $(_activeEditor.getScrollerElement()).height();
        var width = $(_activeEditor.getScrollerElement()).width();
        var totalHeight = _activeEditor.totalHeight(true);
        $(_activeEditor.getScrollerElement()).append('<div class="overlay" id="overlay-' + id + '"><canvas class="simple_sketch" id="simple_sketch-' + id + '" width="' + width + '" height="' + totalHeight + '"></canvas></div>');
        $("#overlay-" + id).css('height', height + 'px');
        $("#overlay-" + id).css('width', width + 'px');
        $('#simple_sketch-' + id).sketch();
        
        _addSketchingTools(id);
        
        var length = _documentSketchingAreas.push(sketchingArea);
        return length - 1;
	}
    
	/* function _documentChange() {
		
        var editor = EditorManager.getCurrentFullEditor();
        $(editor).on('scroll', function(e){
            var height = $(editor.getScrollerElement()).height();
            var totalHeight = editor.totalHeight(true);
            var miniSelectionEl = $('#mini-map .selection')[0];     
            miniSelectionEl.style.top = (e.delegateTarget.scrollTop/(totalHeight-height))*height+e.delegateTarget.scrollTop+"px";
        });
        _documentUpdate();
    }*/

    function _scroll() {
        var scrollPos = _activeEditor.getScrollPos();
        $('#overlay-' + _activeSketchingArea.id).scrollTop(scrollPos.y);
    }
    
	function currentDocumentChanged() {
        _activeEditor = EditorManager.getCurrentFullEditor();
        $(_activeEditor).on("scroll", _scroll);
        _activeDocument = DocumentManager.getCurrentDocument();
        var _activeFullPath = _activeDocument.file.fullPath;
        var foundSketchingArea = -1;
        $.each(_documentSketchingAreas, function (key, sketchingArea) {
            if (sketchingArea.fullPath === _activeFullPath) {
                foundSketchingArea = key;
                return false;
            }
        });
        if (foundSketchingArea !== -1) {
            _activeSketchingArea = _documentSketchingAreas[foundSketchingArea];
        } else {
            var key = _addSketchingArea(_activeFullPath);
            _activeSketchingArea = _documentSketchingAreas[key];
        }
        console.log(_documentSketchingAreas);
    }
    
    function deleteSketchingArea(id) {
        _documentSketchingAreas.splice(id, 1);
        console.log(_documentSketchingAreas);
    }
    
    function removeOverlay() {
        var _activeWorkingSet = DocumentManager.getWorkingSet();
        var sketchingAreaToDelete;
        $.each(_documentSketchingAreas, function (keySketchingArea, sketchingArea) {
            var found = false;
            $.each(_activeWorkingSet, function (keyWorkingSet, workingSet) {
                if (sketchingArea.fullPath === workingSet.file.fullPath) {
                    found = true;
                }
            });
            if (!found) {
                sketchingAreaToDelete = keySketchingArea;
            }
        });
        deleteSketchingArea(sketchingAreaToDelete);
    }
    
    function _deactivate() {
        $(".overlay").hide();
        $(".tools").hide();
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
        active = false;
    }
    
    function _activate() {
        $(".overlay").show();
        $(".tools").show();
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconActive + '")');
        active = true;
    }
    
    function _toggleStatus() {
        if (active) {
            _deactivate();
        } else {
            _activate();
        }
    }
    
    function _addMenuItems() {
        var MY_COMMAND_ID = "sketchmeister.toggleActivation";   // package-style naming to avoid collisions
        CommandManager.register("Enable Sketchmeister", MY_COMMAND_ID, _toggleStatus);
    
        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuDivider();
        menu.addMenuItem(MY_COMMAND_ID);
    }
    
    function _addHandlers() {
        $(DocumentManager).on("currentDocumentChange", currentDocumentChanged);
        
        $('#toggle-sketching').click(function () {
            _toggleStatus();
        });
        
        $('.addImageToStage').click(function () {
            addImageToStage(testImage);
        });
        //$(DocumentManager).on("workingSetAdd", addOverlay);
        $(DocumentManager).on("workingSetRemove", removeOverlay);
        
    }
    
    function initSketchingAreas() {
        currentDocumentChanged();// Load up the currently open document, set all the variables such as editor which the Handlers need
        _deactivate();
    }
    
	AppInit.appReady(function () {
        _addMenuItems();
        _addToolbarIcon();
        _addHandlers();
        initSketchingAreas();
        
        var imageToAdd = {
            newImage: testImage
        }
        $('.addImageToStage').click(function () {
            addImageToStage(testImage);
        });
        //loadImages(sources, initStage);
    });
});