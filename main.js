/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage, addAnchor */

define(function (require, exports, module) {
	"use strict";
   
	require('jquery-ui-1.9.2.custom.min');
	require('runmode');
    require('sketch');
    require('kinetic-v4.3.1.min');
    require('kinetic-functions');

	var CommandManager = brackets.getModule("command/CommandManager"),
		EditorManager = brackets.getModule("editor/EditorManager"),
		ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		Editor = brackets.getModule("editor/Editor").Editor,
		DocumentManager = brackets.getModule("document/DocumentManager"),
        AppInit = brackets.getModule("utils/AppInit"),
		EditorUtils = brackets.getModule("editor/EditorUtils"),
		Menus = brackets.getModule("command/Menus"),
		COMMAND_ID = "me.lukasspy.brackets.sketchmeister";

    var stage;
    var imageLayer;
    
    var _sketchingAreaIdCounter = 0;
    
	var loadCSSPromise = ExtensionUtils.loadStyleSheet(module, 'main.css');
	var active = false;
    var sketchIconActive = require.toUrl('./sketch_button_on.png');
    var sketchIconDeactive = require.toUrl('./sketch_button_off.png');
    var testImage = require.toUrl('./test.png');
    
    var _activeEditor = null;
    var _activeDocument = null;
    var _documentSketchingAreas = [];
    var _activeSketchingArea = null;
    var _codeMirror = null;
    
    
    
    /*----- sketch.js functionen -----*/
    
    function sketchGetURL() {
        var canvas = $('#simple_sketch-' + _activeSketchingArea.id)[0];
        var sketchDataURL = canvas.toDataURL();
        console.log(canvas);
    }
    
    /*----- functions for kinetic drag/resize ------*/
    
    function createStage(sketchingArea) {
        stage = new Kinetic.Stage({
            container: 'overlay-' + sketchingArea.id,
            width: sketchingArea.width,
            height: sketchingArea.height
        });
        imageLayer = new Kinetic.Layer({
            id: 'images'
        });
        stage.add(imageLayer);
        console.log('stage done: ' +  stage + ' layer done: ' + imageLayer);
        //stage.setAbsolutePosition(widthOfEditorFull, 0);
    }
    
    function addImageToStage(imageToAdd) {
        var helpImage = new Image();
        helpImage.src =  imageToAdd;
        //bild muss erst in den DOM geschrieben werden und dann kann die Größe ermittelt werden .. 
        var widthOfImage = helpImage.naturalWidth;
        var heightOfImage = helpImage.naturalHeight;

        var widthResized = 200;
        var heightResized = 150;
        
        var imageGroup = new Kinetic.Group({
            x: 0,
            y: 0,
            draggable: true
        });

        // new Image added to group
        var newImg = new Kinetic.Image({
            x: 40,
            y: 40,
            image: helpImage,
            width: widthResized,
            height: 150,
            name: 'image'
        });
    
        imageGroup.add(newImg);
        imageLayer.add(imageGroup);
        
        addAnchor(imageGroup, 0, 0, 'topLeft');
        addAnchor(imageGroup, widthResized, 0, 'topRight');
        addAnchor(imageGroup, widthResized, heightResized, 'bottomRight');
        addAnchor(imageGroup, 0, heightResized, 'bottomLeft');
    
        imageGroup.on('dragstart', function () {
            this.moveToTop();
        });
        stage.draw();
    }

    /*----- functions for sketching area ------*/
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
    
    function _addSketchingTools(id) {
        $(_activeEditor.getScrollerElement()).append('<div class="tools" id="tools-' + id + '"><a href="#simple_sketch-' + id + '" data-tool="eraser">Era</a></div>');
        $.each(['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#000', '#fff'], function () {
            $('#tools-' + id).append("<a href='#simple_sketch-" + id + "' data-tool='marker' data-color='" + this + "' style='width: 30px; background: " + this + ";'></a> ");
        });
        $.each([3, 5, 10, 15], function () {
            $('#tools-' + id).append("<a href='#simple_sketch-" + id + "' data-tool='marker' data-size='" + this + "' style='background: transparent'>" + this + "</a> ");
        });
        $('#tools-' + id).append("<a href='#' style='background: transparent' class='saveSketch'>save</a> ");
        $('#tools-' + id).append("<a href='#' style='background: transparent' class='addImageToStage'>add</a> ");
        $('#tools-' + id).append("<a href='#' style='background: transparent' class='imageLayerToTop'>Img</a> ");
        $('#tools-' + id).append("<a href='#' style='background: transparent' class='sketchingAreaToTop'>Draw</a> ");
    }
    
    function _addToolbarIcon(id) {
        $('#main-toolbar .buttons').prepend('<a href="#" id="toggle-sketching" title="SketchMeister"></a>');
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
    }

    function _addSketchingArea(path) {
        var id = _sketchingAreaIdCounter++;
        var height = $(_activeEditor.getScrollerElement()).height();
        var width = $(_activeEditor.getScrollerElement()).width() / 2;
        var totalHeight = _activeEditor.totalHeight(true);
        var sketchingArea = {'fullPath' : path, 'id' : id, 'active' : true, 'width' : width, 'height' : height};
        
        $(_activeEditor.getScrollerElement()).append('<div class="overlay" id="overlay-' + id + '"><canvas class="simple_sketch" id="simple_sketch-' + id + '" width="' + width + '" height="' + totalHeight + '"></canvas></div>');
        $("#overlay-" + id).css('height', height + 'px');
        $("#overlay-" + id).css('width', width + 'px');
        $('#simple_sketch-' + id).sketch();
        
        _addSketchingTools(id);
        createStage(sketchingArea);
        
        if (!active) {
            _deactivate();
            console.log('wurde deaktiviert');
        }
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
    
    function moveImageLayerToTop() {
        $('.kineticjs-content').css('z-index','5'); 
        $('.simple_sketch').css('z-index','3');
    }
    
    function movesketchingAreaToTop() {
        $('.simple_sketch').css('z-index','5');
        $('.kineticjs-content').css('z-index','3');
    }
    
	AppInit.appReady(function () {
        _addMenuItems();
        _addToolbarIcon();
        _addHandlers();
        initSketchingAreas();
        
        var imageToAdd = {
            newImage: testImage
        };
        $('.addImageToStage').click(function () {
            addImageToStage(testImage);
        });
        $('.saveSketch').click(function () {
            //sketchGetURL();
        });
        $('.imageLayerToTop').click(function () {
            moveImageLayerToTop();
        });
        $('.sketchingAreaToTop').click(function () {
            movesketchingAreaToTop();
        });
        //loadImages(sources, initStage);
    });
});