/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, _toggleStatus, document, Kinetic, _addImageToStage, _addAnchor, _addMissionControlAnchor, _unhighlightMissionControl, _highlightMissionControl, _addMissionControlMarker, _allAnchors, _addListenersToAnchor, _addListenersToMissionControlAnchor, _showAnchors, _hideAnchors, _addListenersToMagnet, _addListenersToMissionControlMagnet, _addMarker, _removeMarker, _highlight, _unhighlight, _recalculateStartAndEndOfConnection, _unhighlightMissionControlFile, _highlightMissionControlFile */

var xmlFilename = "sketchmeister.xml";
var panelSize = 2;

var myPanel = $('<div id="myPanel"></div>');
var missionControl;

var _asyncScroll = false;
var mouseOverPanel = false;

var _sketchingAreaIdCounter = 0;
var xmlData, $xml;

var active = false;
var firstActivation = true;

var _activeEditor = null;
var _activeDocument = null;
var _documentSketchingAreas = [];
var _activeSketchingArea = null;
var _activeStage;
var _activeLayer = "image";
var imageLayer;
var _codeMirror = null;
var _projectClosed = false;
var _activeMarker = [];
var allPaintingActions = [];

var addedListeners = [];

define(function (require, exports, module) {
    "use strict";
    var sketchIconActive = require.toUrl('./img/sidebar-on.png');
    var sketchIconDeactive = require.toUrl('./img/sidebar-off.png');
    var missionControlActive = require.toUrl('./img/mission-control-on.png');
    var missionControlDeactive = require.toUrl('./img/mission-control-off.png');
    var testImage = require.toUrl('./img/test.png');
    var delCursor = require.toUrl('./img/cursor-delete.gif');
    
    var deleteIcon = require.toUrl('./img/delete-button.png');
    var addIcon = require.toUrl('./img/add-button.png');
    var toolbarAddImages = require.toUrl('./img/add-images.png');
    var toolbarEditImages = require.toUrl('./img/edit-images.png');
    var toolbarDrawSketches = require.toUrl('./img/draw-sketches.png');
    var toolbarMissionControl = require.toUrl('./img/mission-control.png');
    var toolbarSidebar = require.toUrl('./img/sidebar.png');

    var initialize = true;
    
    // load all needed modules
    var CommandManager = brackets.getModule("command/CommandManager"),
        ProjectManager = brackets.getModule("project/ProjectManager"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        Editor = brackets.getModule("editor/Editor").Editor,
        DocumentManager = brackets.getModule("document/DocumentManager"),
        NativeFileSystem = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        FileUtils = brackets.getModule("file/FileUtils"),
        AppInit = brackets.getModule("utils/AppInit"),
        Resizer = brackets.getModule("utils/Resizer"),
        Menus = brackets.getModule("command/Menus"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
        Dialogs = brackets.getModule("widgets/Dialogs");
    
    // load the CSS
    var loadCSSPromise = ExtensionUtils.loadStyleSheet(module, 'css/main.css');

    require('js/kinetic-v4.3.1');
    require('js/kinetic-functions');
    require('js/jquery-ui-1.10.0.custom.min');
    require('js/sketch');
    require('js/json2');

    /*----- xml functions -----*/

    /**
    * Add a new xml element
    *
    * @param {String} name of the new element
    * @method createElement
    * @return {DomELement} returns the node
    */
    $.createElement = function (name) {
        return $('<' + name + ' />');
    };

    /**
    * Add a new node for a new project
    *
    * @param {String} full path of the new project
    * @method createProjectNode
    */
    function _createProjectNode(fullPathOfProject) {
        xmlData = $('<root><project fullPath="' + fullPathOfProject + '"/></root>');
        $xml = $(xmlData);
    }

    /**
    * Create a new file node with two attributes: filename and realtive path of the file
    *
    * @param {String} filename
    * @param {String} relative path of the file
    * @method createFileNode
    * @return {DomELement} returns the node
    */
    function _createFileNode(filename, relativePath) {
        var newFile = $.createElement("file");
        newFile.attr("filename", filename).attr("path", relativePath);
        return newFile;
    }

    /*----- functions for kinetic drag/resize ------*/

    
    /**
    * Move the tools in the sidebar to the top by changing the z-index
    *
    * @method _moveToolsToTop
    */
    function _moveToolsToTop() {
        $('.tools').css('z-index', '5');
    }

    /**
    * Move the image layer to the top by: 
    *   - setting the z-index of both the image layer and the sketching layer accordingly
    *   - hiding the sketching tools
    *   - setting the image layer as the active layer 
    *
    * @method _moveImageLayerToTop
    */
    function _moveImageLayerToTop() {
        //Anchor einblenden
        $('.kineticjs-content').css('z-index', '5');
        $('.simple_sketch').css('z-index', '3');
        $('.sketching-tools').hide();
        _activeLayer = "image";
    }
    
    /**
    * Move the sketching layer to the top by: 
    *   - setting the z-index of both the image layer and the sketching layer accordingly
    *   - showing the sketching tools
    *   - setting the sketching layer as the active layer 
    *
    * @method _moveSketchingAreaToTop
    */
    function _moveSketchingAreaToTop() {
        //Anchor ausblenden
        $('.simple_sketch').css('z-index', '5');
        $('.kineticjs-content').css('z-index', '3');
        $('.sketching-tools').show();
        _activeLayer = "sketch";
    }

    /**
    * A kinetic.js-stage is created to manage the images and connection dots of a particular file.
    *   - a new stage is created if there is no data for the particular file in the xml or a stage is re-created out of saved data from the xml file
    *   - in case of the ladder: the images have to be actively linked and reloaded into the DOM. Resize anchors are created and listeners are registered.
    *
    * @param {DomELement} the id of a DomElement in which the kinetic.js-stage is created (e.g. cont, if <div id="cont"/>)
    * @param {Number} width of the stage
    * @param {Number} height of the stage
    * @param {String} full path of the file for which the stage is created
    * @param {String} filename of the file for which the stage is created
    * @method _createStage
    * @return {Object} returns the stage
    */
    function _createStage(container, width, height, path, filename) {
        // check if stage-data is in the xml-variable,
        // yes: create a stage out of the JSON-data in xml-variable 
        // no: create empty stage
        var stage;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = path.replace(fullProjectPath, "").replace(filename, "");
        var stageObjectInXml = $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").find("stage");
        if (stageObjectInXml.html() !== null) {
            stage = Kinetic.Node.create(stageObjectInXml.html(), container);
            stage.setWidth(width);
            stage.setHeight(height);
            var groups = stage.get(".group");
            
            var images = stage.get(".image");
            $.each(images, function (key, image) {
                
                var tempImage = new Image();
                
                if (image.attrs.relative) {
                    tempImage.src = fullProjectPath + image.attrs.src;
                } else {
                    tempImage.src = image.attrs.src;
                }
                var width = image.attrs.width;
                var height = image.attrs.height;
                var tempImageContainer = $('<img src="' + tempImage.src + '" id="tempImage" class="visibility: hidden"/>');
                tempImageContainer.load(function () {
                    
                    var group = groups[key];
                    group.setDraggable(false);
                    
                    var anchors = group.get(".topLeft");
                    var imageObj = new Image();
                    imageObj.src = deleteIcon;
                    $.each(anchors, function (key, anchor) {
                        
                        anchor.setImage(imageObj);
                        _addListenersToAnchor(anchor, group);
                    });

                    anchors = group.get(".topRight");
                    imageObj = new Image();
                    imageObj.src = addIcon;
                    $.each(anchors, function (key, anchor) {
                        anchor.setImage(imageObj);
                        _addListenersToAnchor(anchor, group);
                    });
                    
                    anchors = group.get(".bottomRight");
                    $.each(anchors, function (key, anchor) {
                        _addListenersToAnchor(anchor, group);

                    });
                    
                    anchors = group.get(".bottomLeft");
                    $.each(anchors, function (key, anchor) {
                        _addListenersToAnchor(anchor, group);
                    });
                
                    _hideAnchors(stage);
                    var magnets = group.get(".magnet");
                    $.each(magnets, function (key, magnet) {
                        magnet.setDraggable(false);
                        _addMarker(JSON.parse(magnet.attrs.connection), magnet._id);
                        _addListenersToMagnet(magnet, group);
                    });
                    image.setImage(tempImage);
                    
                    image.on('mouseover', function () {
                        if ($('.tools .edit').hasClass('selected')) {
                            var layer = this.getLayer();
                            document.body.style.cursor = "move";
                            this.setStroke("#EE8900");
                            layer.draw();
                        }
                    });
                    image.on('mouseout', function () {
                        if ($('.tools .edit').hasClass('selected')) {
                            var layer = this.getLayer();
                            document.body.style.cursor = 'default';
                            this.setStroke("transparent");
                            layer.draw();
                        }
                    });
                    
                    $('#tempImage').remove();
                    image.getLayer().draw();
                    tempImageContainer.unload();
                });
            });
        } else {
            stage = new Kinetic.Stage({
                container: container,
                width: width,
                height: height
            });
            imageLayer = new Kinetic.Layer({
                id: 'images'
            });
            stage.add(imageLayer);
        }
        stage.draw();
        return stage;
    }
    
    /**
    * A kinetic.js-stage is created to manage the images and connection dots of the Mission Control.
    *   - a new stage is created if there is no data for the MissionControl in the xml or a stage is re-created out of saved data from the xml file
    *   - in case of the ladder: the images have to be actively linked and reloaded into the DOM. Resize anchors are created and listeners are registered.
    *
    * @param {DomELement} the id of a DomElement in which the kinetic.js-stage is created (e.g. cont, if <div id="cont"/>)
    * @param {Number} width of the stage
    * @param {Number} height of the stage
    * @method _createStageForMissionControl
    * @return {Object} returns the stage
    */
    function _createStageForMissionControl(container, width, height) {
        var stage;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var missionControlAsJSON = $xml.find("project").find("missioncontrol");
        if (missionControlAsJSON.html() !== null) {
            stage = Kinetic.Node.create(missionControlAsJSON.html(), container);
            stage.setWidth(width);
            stage.setHeight(height);
            stage.attrs.draggable = true;
            var groups = stage.get(".group");
            
            var images = stage.get(".image");
            $.each(images, function (key, image) {
                
                var tempImage = new Image();
                
                if (image.attrs.relative) {
                    tempImage.src = fullProjectPath + image.attrs.src;
                } else {
                    tempImage.src = image.attrs.src;
                }

                var width = image.attrs.width;
                var height = image.attrs.height;
                var tempImageContainer = $('<img src="' + tempImage.src + '" id="tempImage" class="visibility: hidden"/>');
                tempImageContainer.load(function () {
                    
                    var group = groups[key];
                    group.setDraggable(true);
                    var anchors = group.get(".topLeft");
                    var imageObj = new Image();
                    imageObj.src = deleteIcon;
                    $.each(anchors, function (key, anchor) {
                        anchor.setImage(imageObj);
                        _addListenersToMissionControlAnchor(anchor, group);
                    });

                    anchors = group.get(".topRight");
                    
                    imageObj = new Image();
                    imageObj.src = addIcon;
                    $.each(anchors, function (key, anchor) {
                        anchor.setImage(imageObj);
                        _addListenersToMissionControlAnchor(anchor, group);
                    });
                    
                    anchors = group.get(".bottomRight");
                    $.each(anchors, function (key, anchor) {
                        _addListenersToMissionControlAnchor(anchor, group);
                    });
                    
                    anchors = group.get(".bottomLeft");
                    $.each(anchors, function (key, anchor) {
                        _addListenersToMissionControlAnchor(anchor, group);
                    });
                    
                    var magnets = group.get(".magnet");
                    $.each(magnets, function (key, magnet) {
                        _unhighlightMissionControl(magnet);
                        var JSONconnection = JSON.parse(magnet.attrs.connection);
                        if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
                            magnet.setStroke('rgba(47, 31, 74, 1)');
                            magnet.setFill('rgba(85, 50, 133, 0.8)');
                        }
                        magnet.setRadius(12);
                        magnet.attrs.clicked = false;
                        _addListenersToMissionControlMagnet(magnet, group);
                    });
                    
                    image.setImage(tempImage);
                    image.setStroke("transparent");
                    
                    image.on('mouseover', function () {
                        if (missionControl.editMode) {
                            var layer = this.getLayer();
                            document.body.style.cursor = "move";
                            this.setStroke("#EE8900");
                            layer.draw();
                        }
                    });
                    image.on('mouseout', function () {
                        if (missionControl.editMode) {
                            var layer = this.getLayer();
                            document.body.style.cursor = 'default';
                            this.setStroke("transparent");
                            layer.draw();
                        }
                    });
                    
                    $('#tempImage').remove();
                    image.getLayer().draw();
                    tempImageContainer.unload();
                });
            });
        } else {
            stage = new Kinetic.Stage({
                container: container,
                width: width,
                height: height,
                draggable: true
            });
        }
        return stage;
    }

    /**
    * An image is added to the stage
    *   - the image is loaded into the DOM
    *   - the image is resized to fit the stage width if necessary
    *   - anchors are added to the image
    *   - if the image-path is similar to the project-path the path is made relative to support portability of project
    *
    * @param {String} the full path and filename of an image
    * @method _addImageToStage
    */
    function _addImageToStage(imageToAdd) {
        var widthOfImage;
        var heightOfImage;
        var tempImage = new Image();
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        
        //check if image is in the project folder, if yes set relative true
        var updatedPath = imageToAdd.replace(fullProjectPath, "");
        var relative = (imageToAdd !== updatedPath) ? true : false;
        var tempImageContainer = $('<img src="' + imageToAdd + '" id="tempImage" class="visibility: hidden"/>');
        tempImageContainer.load(function () {
            $(this).appendTo('#sidebar');
            tempImage.src = $('#tempImage').attr('src');
            widthOfImage = tempImage.width;
            heightOfImage = tempImage.height;

            _moveImageLayerToTop();
            var widthResized = (myPanel.width() * 0.7);
            var heightResized = (myPanel.width() * 0.7) / widthOfImage * heightOfImage;
            if (widthResized > widthOfImage) {
                widthResized = widthOfImage;
                heightResized = heightOfImage;
            }
            var visualPos = myPanel.scrollTop();
            var imageGroup = new Kinetic.Group({
                x: 40,
                y: visualPos + 70,
                name: 'group',
                draggable: true
            });

            // new Image added to group
            var newImg = new Kinetic.Image({
                x: 0,
                y: 0,
                stroke: "transparent",
                strokeWidth: 2,
                image: tempImage,
                width: widthResized,
                height: heightResized,
                name: 'image',
                src: updatedPath,
                relative: relative
            });
            
            newImg.on('mouseover', function () {
                if ($('.tools .edit').hasClass('selected')) {
                    var layer = this.getLayer();
                    document.body.style.cursor = "move";
                    this.setStroke("#EE8900");
                    layer.draw();
                }
            });
            newImg.on('mouseout', function () {
                if ($('.tools .edit').hasClass('selected')) {
                    var layer = this.getLayer();
                    document.body.style.cursor = 'default';
                    this.setStroke("transparent");
                    layer.draw();
                }
            });
            imageGroup.add(newImg);
            var thisImageLayer = _activeSketchingArea.stage.getChildren()[0];
            thisImageLayer.add(imageGroup);

            _addAnchor(imageGroup, 0, 0, 'topLeft', deleteIcon);
            _addAnchor(imageGroup, widthResized, 0, 'topRight', addIcon);
            _addAnchor(imageGroup, widthResized, heightResized, 'bottomRight');
            _addAnchor(imageGroup, 0, heightResized, 'bottomLeft');
            imageGroup.on('dragstart', function () {
                this.moveToTop();
            });
            
            _activeSketchingArea.stage.draw();
            $('#tempImage').remove();
            tempImageContainer.unload();
        });
    }

    /*----- functions for sketching area ------*/

    /**
    * UI elements of the side panel are created and loaded into the DOM
    *
    * @param {String} the id of the div-container that is created for a particular sketching area
    * @method _addSketchingTools
    */
    function _addSketchingTools(id) {
        var height = $(_activeEditor.getScrollerElement()).height() - 100;
        myPanel.append('<div class="tools" id="tools-' + id + '" style="height: ' + height + 'px"></div>');
        
        $('#tools-' + id).append('<div class="seperator"></div>');
        $('#tools-' + id).append("<a href='#' class='add-image button' title='add images'></a> ");
        $('#tools-' + id).append("<a href='#' class='image-layer edit' title='edit images'></a> ");
        $('#tools-' + id).append("<a href='#' class='sketch-layer button' title='sketch'></a> ");
        
        var sketchingTools = $('<div class="sketching-tools"></div>');
        sketchingTools.append('<div class="seperator"></div>');
        sketchingTools.append('<a href="#simple_sketch-' + id + '" data-undo="1" class="undo" title="undo"></a>');
        sketchingTools.append("<a href='#simple_sketch-" + id + "' data-clear='1' class='clear' title='clear'></a> ");

        var colors = {
            'black': '#000000',
            'grey': '#B2ADA1',
            'red': '#E22E00',
            'yellow': '#F5A800',
            'blue': '#447E82',
            'green': '#8DA56D'
        };
        $.each(colors, function (key, value) {
            if (key === "black") {
                sketchingTools.append("<a class='color " + key + " selected' href='#simple_sketch-" + id + "' data-tool='marker' data-color='" + value + "' style='background: " + value + ";'></a> ");
            } else {
                sketchingTools.append("<a class='color " + key + "' href='#simple_sketch-" + id + "' data-tool='marker' data-color='" + value + "' style='background: " + value + ";'></a> ");
            }
        });
        sketchingTools.append('<a class="eraser" href="#simple_sketch-' + id + '" data-tool="eraser"></a>');
        sketchingTools.append('<div class="seperator"></div>');
        var sizes = {
            'small': 5,
            'medium': 10,
            'large': 15
        };
        $.each(sizes, function (key, value) {
            if (key === "small") {
                sketchingTools.append("<a class='size " + key + " selected' href='#simple_sketch-" + id + "' data-size='" + (value - 3) + "'>" + value + "</a> ");
            } else {
                sketchingTools.append("<a class='size " + key + "' href='#simple_sketch-" + id + "' data-size='" + (value - 3) + "'>" + value + "</a> ");
            }
        });
        $('#tools-' + id).append(sketchingTools);
    }
    
    /**
    * Toolbar icons are added to the Brackets toolbar
    *   - icon to toggle MissionControl
    *   - icon to toggle SketchMeister
    *
    * @method _addToolbarIcon
    */
    function _addToolbarIcon() {
        $('#main-toolbar .buttons').append('<a href="#" id="toggle-missionControl" title="MissionControl"></a>');
        $('#toggle-missionControl').css('background-image', 'url("' + missionControlDeactive + '")');
        $('#main-toolbar .buttons').append('<a href="#" id="toggle-sketching" title="SketchMeister"></a>');
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
    }
    
    /**
    * The sketching actions for a particular file are returned from the xml file
    *
    * @param {String} filename
    * @param {String} relative path of the file
    * @method _getSketchingActionsForThisFileFromXml
    * @return {Array} an empty array or a JSON string with the actions (history of strokes)
    */
    function _getSketchingActionsForThisFileFromXml(filename, relativePath) {
        var actions = $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").find("sketchingactions");
        // check if there are actions for this sketchingArea
        // if yes then parse the JSON string and return else return an empty array -> default if no actions
        if (actions.html() !== null) {
            return JSON.parse(actions.html());
        } else {
            return [];
        }
    }
    
    /**
    * Gets the stage object from the xml file for particular file and recreates the stage object
    *
    * @param {String} id of the DOM container in which the stage is placed
    * @param {String} filename
    * @param {String} relative path of the file
    * @method _getStageObjectForThisFileFromXml
    * @return {Object} the stage or false
    */
    function _getStageObjectForThisFileFromXml(id, filename, relativePath) {
        var stageObject = $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").find("stage");
        // check if there is a stage for this sketchingArea
        // if yes then parse the JSON string and return else return an flse -> default creating empty stage
        var stage = Kinetic.Node.create(stageObject.html(), 'overlay-' + id);
        if (stageObject.html() !== null) {
            return stage;
        } else {
            return false;
        }
    }
    
    /**
    * Loads the sketching actions from the xml file to the sketching area.
    *   - gets the sketching action history
    *   - redraws the sketchingArea to show the strokes
    *
    * @method _loadSketchingActionsFromXmlToSketchingArea
    */
    function _loadSketchingActionsFromXmlToSketchingArea() {
        var filename = DocumentManager.getCurrentDocument().file.name;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = _activeSketchingArea.fullPath.replace(fullProjectPath, "").replace(filename, "");
        var actions = _getSketchingActionsForThisFileFromXml(filename, relativePath);
        _activeSketchingArea.sketchArea.actions = actions;
        if (actions.length > 0) {
            _activeSketchingArea.sketchArea.redraw();
        }
    }

    /**
    * Deactivate the tools
    *   - hide the tool-container
    *   - change sketch icon in Brackets toolbar
    *
    * @method _deactivate
    */
    function _deactivate() {
        $(".tools").hide();
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
        active = false;
    }

    /**
    * Activate the tools
    *   - show the tool-container
    *   - change sketch icon in Brackets toolbar
    *
    * @method _deactivate
    */
    function _activate() {
        $(".tools").show();
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconActive + '")');
        active = true;
    }

    /**
    * Adds the sketching area including a Kinetic.js-stage
    *   - the width of the sketching area is set to a fixed width of 1500
    *   - the overlay is added to the panel
    *   - sketching area and stage is added
    *
    * @param {String} fullpath of the file
    * @param {String} filename
    * @method _addSketchingArea
    * @return {Object} the amount of registered sketching areas
    */
    function _addSketchingArea(path, filename) {
        var id = _sketchingAreaIdCounter++;
        var height = $(_activeEditor.getScrollerElement()).height();
        var width = $(_activeEditor.getScrollerElement()).width();

        // feste Breite ... entscheidung für Nutzer getroffen ... 1500px
        // dieser Wert muss gesetzt werden, auch wenn das Panel deaktiv ist ... => nicht aus myPanel auslesen ...
        width = "1500";
        // irgendwo kommt eine 30 her ... keine ahnung wo ... ist von CodeMirror irgendwas
        var totalHeight = _activeEditor.totalHeight() - 30;
        $("#myPanel").append('<div class="overlay" id="overlay-' + id + '"><canvas class="simple_sketch" id="simple_sketch-' + id + '" width="' + width + '" height="' + totalHeight + '"></canvas></div>');

        $("#overlay-" + id).css('height', totalHeight + 'px');
        var sketchArea = $('#simple_sketch-' + id).sketch();

        _addSketchingTools(id);
        var stage = _createStage('overlay-' + id, myPanel.width(), totalHeight, path, filename);
        var sketchingArea = {
            'filename': filename,
            'fullPath': path,
            'id': id,
            'active': true,
            'width': width,
            'height': totalHeight,
            'stage': stage,
            'sketchArea': sketchArea.obj
        };

        if (!active) {
            _deactivate();
        }
        var length = _documentSketchingAreas.push(sketchingArea);
        return length - 1;
    }
    
    var ignoreScrollEventsFromPanel = false;
    var ignoreScrollEventsFromEditor = false;
    
    /**
    * Scroll the SketchMeister panel if editor container is scrolled to support synchronized scrolling.
    *
    * @method _scroll
    */
    function _scroll() {
        var ignore = ignoreScrollEventsFromEditor;
        ignoreScrollEventsFromEditor = false;
        if (ignore) {
            return false;
        } else if (!_asyncScroll) {
            var scrollPos = _activeEditor.getScrollPos();
            ignoreScrollEventsFromPanel = true;
            if ($('#myPanel').scrollTop() !== scrollPos.y) {
                $('#myPanel').scrollTop(scrollPos.y);
            }
        }
    }

    /**
    * Scroll the editor container if the SketchMeister panel is scrolled to support synchronized scrolling.
    *
    * @method _scrollEditor
    */
    function _scrollEditor() {
        var ignore = ignoreScrollEventsFromPanel;
        ignoreScrollEventsFromPanel = false;
        if (ignore) {
            return false;
        } else if (!_asyncScroll) {
            var scrollPos = $('#myPanel').scrollTop();
            ignoreScrollEventsFromEditor = true;
            if (_activeEditor.getScrollPos().y !== scrollPos) {
                _activeEditor.setScrollPos(_activeEditor.getScrollPos().x, scrollPos);
            }
        }
    }
    
    /**
    * Add listeners to the editor container
    *   - adds the listeners to recalculate the connection if the file is changed
    *   - adds the listeners to the line numbers to connect them to the connection dots
    *
    * @param {Object} editor
    * @param {String} fullpath of the file
    * @param {Boolean} initialize
    * @method _addListenersToEditor
    * @return {Boolean} return if this document is opened for the first time to know if listeners have to be added
    */
    function _addListenersToEditor(editor, fullPath, initialize) {
        if (!initialize) {
            var listenersAlreadyAdded = false;
            $.each(addedListeners, function (key, addedListener) {
                if (addedListener === fullPath) {
                    listenersAlreadyAdded = true;
                    return false;
                }
            });
            if (listenersAlreadyAdded) {
                return false;
            }
        }
        addedListeners.push(fullPath);
        editor._codeMirror.on("change", function (cm, change) {
            var magnets = _activeStage.get(".magnet");
            $.each(magnets, function (pos, magnet) {
                var reCalculatedConnection = _recalculateStartAndEndOfConnection(magnet, cm, change, 0);
                if (reCalculatedConnection) {
                    magnet.attrs.connection = reCalculatedConnection;
                } else {
                    magnet.destroy();
                    _activeStage.draw();
                }
            });
            
            magnets = missionControl.stage.get(".magnet");
            $.each(magnets, function (pos, magnet) {
                var reCalculatedConnection = _recalculateStartAndEndOfConnection(magnet, cm, change, 1);
                if (reCalculatedConnection) {
                    magnet.attrs.connection = reCalculatedConnection;
                } else {
                    magnet.destroy();
                    _activeStage.draw();
                }
            });
            
        });
        
        editor._codeMirror.on("gutterClick", function (cm, n) {
            var lineInfo = cm.lineInfo(n);
            if (lineInfo.gutterMarkers) {
                var foundMagnetInNormalStage = 0;
                $.each(lineInfo.gutterMarkers, function (key, value) {
                    var magnets = _activeStage.get(".magnet");
                    $.each(magnets, function (pos, magnet) {
                        if (magnet._id === value.name) {
                            foundMagnetInNormalStage++;
                            if (magnet.clicked) {
                                // mark in text is set, so lets clear and delete the mark-reference
                                _unhighlight(magnet);
                                magnet.clicked = false;
                                if (_activeMarker[magnet._id]) {
                                    _activeMarker[magnet._id].clear();
                                }
                                $(".magnet-" + magnet._id).removeClass('selectionLink');
                                delete (_activeMarker[magnet._id]);
                                _asyncScroll = true;
                                myPanel.animate({ scrollTop: $(_activeEditor.getScrollerElement()).scrollTop() }, 700);
                                setTimeout(function () {
                                    _asyncScroll = false;
                                }, 750);
                            } else {
                                // no mark in text, so lets get the magnet and mark corresponding text
                                var editorHeight = $(_activeEditor.getScrollerElement()).height();
                                var editorFirstVisiblePixel = _activeEditor.getScrollPos().y;
                                var editorLastVisiblePixel = editorFirstVisiblePixel + editorHeight;
                                var groupHeight = magnet.getParent().get('.image')[0].getHeight();
                                var magnetsGroupFirstPixel = magnet.getParent().getAbsolutePosition().y;
                                var magnetsGroupLastPixel = magnet.getParent().getAbsolutePosition().y + groupHeight;
                                var offscreenLocation = "visible";
                                if (magnetsGroupLastPixel > editorLastVisiblePixel) {
                                    offscreenLocation = "bottom";
                                } else if (magnetsGroupFirstPixel < editorFirstVisiblePixel) {
                                    offscreenLocation = "top";
                                }
                                
                                var timeout = 0;
                                if (!active) {
                                    _toggleStatus();
                                    //set the timeout: if panel has not been opened yet it takes a little time and then the animation would be missed
                                    timeout = 100;
                                }
                                setTimeout(function () {
                                    _highlight(magnet);
                                    magnet.clicked = true;
                                    $(".magnet-" + magnet._id).addClass("selectionLink");
                                    var connection = JSON.parse(magnet.attrs.connection);
                                    _activeMarker[magnet._id] = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                                    if (offscreenLocation === "bottom") {
                                        var scrollPos = magnetsGroupFirstPixel - (editorHeight - groupHeight);
                                        _asyncScroll = true;
                                        myPanel.animate({ scrollTop: scrollPos }, 700);
                                        setTimeout(function () {
                                            _asyncScroll = false;
                                        }, 750);
                                    } else if (offscreenLocation === "top") {
                                        _asyncScroll = true;
                                        myPanel.animate({ scrollTop: magnetsGroupFirstPixel - 10 }, 700);
                                        setTimeout(function () {
                                            _asyncScroll = false;
                                        }, 750);
                                    }
                                }, timeout);
                            }
                        }
                    });

                    if (foundMagnetInNormalStage < Object.keys(lineInfo.gutterMarkers).length) {
                        magnets = missionControl.stage.get(".magnet");
                        $.each(magnets, function (pos, magnet) {
                            if (magnet._id === value.name) {
                                if (magnet.clicked) {
                                    _unhighlightMissionControl(magnet);
                                    magnet.clicked = false;
                                    if (_activeMarker[magnet._id]) {
                                        _activeMarker[magnet._id].clear();
                                    }
                                    $(".magnet-" + magnet._id).removeClass('selectionLinkFromMissionControl');
                                    delete (_activeMarker[magnet._id]);
                                } else {
                                    _highlightMissionControl(magnet, magnets);
                                    magnet.clicked = true;
                                    $(".magnet-" + magnet._id).addClass("selectionLinkFromMissionControl");
                                    var connection = JSON.parse(magnet.attrs.connection);
                                    _activeMarker[magnet._id] = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLinkFromMissionControl'});
                                }
                            }
                        });
                    }
                });
            }
        });
        return true;
    }

    /**
    * Manages everything when the current docment is changed
    *   - set all variables accordingly
    *   - add a marker on a line number if there is a connection to the MissionControl
    *   - created a new sketching area or load if documents was open already
    *   - show/redraw sketching areas and stage
    *   - scroll to correct position (Brackets saves the last scroll position on closing a document)
    *
    * @param {Boolean} initialize
    * @method currentDocumentChanged
    * @return {Boolean} 
    */
    function currentDocumentChanged(initialize) {
        // some default stuff
        _activeEditor = EditorManager.getCurrentFullEditor();
        _activeDocument = DocumentManager.getCurrentDocument();
        var _activeFullPath = DocumentManager.getCurrentDocument().file.fullPath;
        var _activeFilename = DocumentManager.getCurrentDocument().file.name;
        var thisFileIsOpenedForFirstTime = true;

        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = _activeFullPath.replace(fullProjectPath, "");

        // check if MissionControlMagnet is connected to this file, if yes: add marker
        var magnets = missionControl.stage.get(".magnet");
        $.each(magnets, function (key, magnet) {
            if (relativePath === magnet.attrs.relativePath) {
                _addMissionControlMarker(JSON.parse(magnet.attrs.connection), magnet._id);
            }
        });
        
        magnets = missionControl.stage.get(".magnet");
        $.each(magnets, function (pos, magnet) {
            var JSONconnection = JSON.parse(magnet.attrs.connection);
            if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
                _unhighlightMissionControlFile(magnet);
                if (relativePath === magnet.attrs.relativePath) {
                    _highlightMissionControlFile(magnet);
                }
            }
        });
        
        thisFileIsOpenedForFirstTime = _addListenersToEditor(EditorManager.getCurrentFullEditor(), _activeFullPath, initialize);
      
        // go through all already opened sketchingAreas and check if opened file already has a sketchingArea  
        var foundSketchingArea = -1;
        if (!initialize) {
            $.each(_documentSketchingAreas, function (key, sketchingArea) {
                sketchingArea.active = false;
                $('#overlay-' + sketchingArea.id).hide();
                if (sketchingArea.fullPath === _activeFullPath) {
                    foundSketchingArea = key;
                }
            });
        }
        // if sketchingArea is already loaded set it as active, else create a new sketchingArea and add it to Array of sketchingAreas
        if (!initialize && !thisFileIsOpenedForFirstTime) {
            // sketchingArea was found and it is set
            _activeSketchingArea = _documentSketchingAreas[foundSketchingArea];
            _activeSketchingArea.active = true;
        } else {
            $(_activeEditor).on("scroll", _scroll);
            myPanel.on("scroll", _scrollEditor);
            // sketchingArea is not in Array and will be created with _addSketching Area
            var key = _addSketchingArea(_activeFullPath, _activeFilename);
            _activeSketchingArea = _documentSketchingAreas[key];
            // check which layer is on top to stay in sync with other already open sketching areas
            if (_activeLayer === "sketch") {
                _moveSketchingAreaToTop();
            } else {
                _moveImageLayerToTop();
            }
            //sketchingArea has been created and now the xml-file has to be checked if there are sketchingActions for that file
            _loadSketchingActionsFromXmlToSketchingArea();
        }
        
        // set the active stage by referencing the stage of the active sketchingArea
        _activeStage = _activeSketchingArea.stage;
        _activeSketchingArea.sketchArea.redraw();
        _activeSketchingArea.stage.draw();
        if (active) {
            $('#overlay-' + _activeSketchingArea.id).show();
        }
        
        //when document is changed the editor position was stored, so the panel needs to be synced on reentering
        myPanel.scrollTop(_activeEditor.getScrollPos().y);
    }
    
    /**
    * Delete a skething Area from the array of all registered sketching areas
    *
    * @param {number} id of the sketching area
    * @method _deleteSketchingArea
    */
    function _deleteSketchingArea(id) {
        _documentSketchingAreas.splice(id, 1);
    }

    /**
    * Remove the sketching area if a document is closed and removed from the working set
    *
    * @method _removeOverlay
    */
    function _removeOverlay() {
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
        _deleteSketchingArea(sketchingAreaToDelete);
    }

    /**
    * Check if the file node exists
    *
    * @param {String} filename
    * @param {String} relative path of the file
    * @method _checkIfFileNodeExists
    * @return {Object} returns a jQuery collection which contains only the list elements that are descendants of corresponding item
    */
    function _checkIfFileNodeExists(filename, relativePath) {
        return $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']");
    }

    /**
    * Set the sketching actions at the corresponding xml node
    *
    * @param {String} sketching actions as JSON string
    * @param {String} filename
    * @param {String} relative path of the file
    * @method _setSketchingActionsAtNode
    */
    function _setSketchingActionsAtNode(sketchingActionsAsJSON, filename, relativePath) {
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").children("sketchingactions").remove();
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").append("<sketchingactions>" + sketchingActionsAsJSON + "</sketchingactions>");
    }
    
    /**
    * Set the stage object at the corresponding xml node
    *
    * @param {String} stage object as JSON string
    * @param {String} filename
    * @param {String} relative path of the file
    * @method _setStageObjectAtNode
    */
    function _setStageObjectAtNode(stageObjectAsJSON, filename, relativePath) {
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").children("stage").remove();
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").append("<stage>" + stageObjectAsJSON + "</stage>");
    }

    /**
    * Read the xml data for the project
    *
    * @param {Function} the callback function that is processed after the xml file is read entirly from the HDD
    * @param {String} filename
    * @param {String} relative path of the file
    * @method readXmlFileData
    */
    function readXmlFileData(callback) {
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var fileEntry = new NativeFileSystem.FileEntry(fullProjectPath + xmlFilename);
        FileUtils.readAsText(fileEntry).done(function (data, readTimestamp) {
            $xml = $(data);
            if (typeof callback === 'function') { // make sure the callback is a function
                callback.call(this); // brings the scope to the callback
            }
        }).fail(function (err) {
            _createProjectNode(fullProjectPath); // create a new project node if there is no entry in the xml file
            if (typeof callback === 'function') {
                callback.call(this);
            }
        });
    }

    /**
    * Save all data from the sketching area in the xml file (sketches and images)
    *
    * @param {Object} sketchingArea to save
    * @method _saveSketchesAndImages
    */
    function _saveSketchesAndImages(sketchingArea) {
        var sketchingActionsAsJSON = JSON.stringify(sketchingArea.sketchArea.actions);
        var stageObjectAsJSON = sketchingArea.stage.toJSON();
        var filename = sketchingArea.filename;
        var fullProjectPathAndFilename = sketchingArea.fullPath;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = fullProjectPathAndFilename.replace(fullProjectPath, "").replace(filename, "");
        var fileNode;
        var nodeForActiveFile;

        //check if node for activeFile is already in the xml
        fileNode = _checkIfFileNodeExists(filename, relativePath);
        if (!fileNode.html()) {
            nodeForActiveFile = _createFileNode(filename, relativePath);
            $xml.find("project").append(nodeForActiveFile);
        }
        _setSketchingActionsAtNode(sketchingActionsAsJSON, filename, relativePath);
        _setStageObjectAtNode(stageObjectAsJSON, filename, relativePath);
    }
    
    /**
    * Save all data from the sketching area in the xml file (sketches and images)
    *
    * @param {Object} sketchingArea to save
    * @method _saveSketchesAndImagesOfAllAreas
    */
    function _saveSketchesAndImagesOfAllAreas() {
        $.each(_documentSketchingAreas, function (key, sketchingArea) {
            _saveSketchesAndImages(sketchingArea);
        });
    }
    
    /**
    * Write xml data to hdd
    *
    * @method _writeXmlDataToFile
    */
    function _writeXmlDataToFile() {
        var fileEntry = new NativeFileSystem.FileEntry(ProjectManager.getProjectRoot().fullPath + xmlFilename);
        FileUtils.writeText(fileEntry, "<root>" + $xml.html() + "</root>").done(function () {
        }).fail(function (err) {
            console.log("Error writing text: " + err.name);
        });
    }
    
    /**
    * Save sketches and images of all sketching areas and write them to the file
    *
    * @method _saveAll
    */
    function _saveAll() {
        _saveSketchesAndImagesOfAllAreas();
        _writeXmlDataToFile();
    }
    
    /**
    * Insert all selected images to the stage
    *
    * @param {Array} an array of images selected from the add dialog
    * @method _insertFileToImageArea
    */
    function _insertFileToImageArea(files) {
        $('.tools .layer').removeClass('selected');
        $('.tools .image-layer').addClass('selected');
        var i;
        for (i = 0; i < files.length; i++) {
            _addImageToStage(files[i]);
        }
    }
    
    /**
    * Save Mission Control data in the xml container
    *
    * @method _saveMissionControl
    */
    function _saveMissionControl() {
        var missionControlAsJSON = missionControl.stage.toJSON();
        $xml.find("project").children("missioncontrol").remove();
        $xml.find("project").append("<missioncontrol>" + missionControlAsJSON + "</missioncontrol>");
    }
    
    /**
    * Mission Control
    *
    * @class MissionControl
    * @constructor
    */
    function MissionControl() {
        this.overlay = $('<div id="missionControl"><div class="top controls"><a href="#" class="esc"></a></div><div class="bottom controls"><a href="#" class="reset-zoom"></a><a href="#" class="add"></a><a href="#" class="edit"></a></div></div>');
        this.active = false;
        this.editMode = false;
        this.stage = null;
        this.imageLayering = null;
        this.scale = 1;
        this.zoomFactor = 1.02;
        this.origin = {
            x: 0,
            y: 0
        };
    }
    
    /**
    * Initialize the MissionControl
    *
    * @method init
    */
    MissionControl.prototype.init = function () {
        this.overlay.appendTo("body");
        this.stage = _createStageForMissionControl("missionControl", $("body").width(), $("body").height());
        this.imageLayering = new Kinetic.Layer({id: 'images'});
        this.stage.add(this.imageLayering);
        $('#missionControl .kineticjs-content').css('z-index', '21');
        this.deactivateEditMode();
    };
    
    /**
    * Zooms the MissionControl according to the scroll event
    *
    * @method zoom
    */
    MissionControl.prototype.zoom = function (event) {
        event.preventDefault();
        var evt = event.originalEvent,
            mx = evt.clientX, /* - canvas.offsetLeft */
            my = evt.clientY; /* - canvas.offsetTop */
        var zoom = (this.zoomFactor - (evt.wheelDelta < 0 ? 0.04 : 0));
        var newscale = this.scale * zoom;
        this.origin.x = mx / this.scale + this.origin.x - mx / newscale;
        this.origin.y = my / this.scale + this.origin.y - my / newscale;
        
        var scale = this.stage.getScale();
        this.stage.setOffset(this.origin.x, this.origin.y);
        this.stage.setScale(newscale);
        this.stage.draw();
        this.scale *= zoom;
    };
    
    /**
    * Zooms in the MissionControl by clicking on the zoom in button
    *
    * @method zoom
    */
    MissionControl.prototype.zoomIn = function () {
        var position = this.stage.getUserPosition();
        var scale = this.stage.getScale();
        this.stage.setScale(scale.x + 0.2, scale.y + 0.2);
        this.stage.draw();
    };
    
    /**
    * Zooms out the MissionControl by clicking on the zoom out button
    *
    * @method zoom
    */
    MissionControl.prototype.zoomOut = function () {
        var position = this.stage.getUserPosition();
        var scale = this.stage.getScale();
        this.stage.setScale(scale.x - 0.2, scale.y - 0.2);
        this.stage.draw();
        //stage.setPosition(position.x - stage.getX(), position.y - stage.getY());
    };
    
    /**
    * Toggle the visibility of the MissionControl
    *   - saves Mission Control data to the xml container
    *   - writes xml data to the file
    *
    * @method toggle
    */
    MissionControl.prototype.toggle = function () {
        if (this.active) {
            this.active = false;
            this.overlay.hide("puff"); //fadeOut("fast");
            _saveMissionControl();
            _writeXmlDataToFile();
        } else {
            this.active = true;
            this.overlay.show("puff"); //fadeIn("fast");
        }
    };
    
    /**
    * Deactives the edit mode of Mission Control
    *
    * @method deactivateEditMode
    */
    MissionControl.prototype.deactivateEditMode = function () {
        var anchors, magnets, groups;
        $("#missionControl .controls a.edit").removeClass("active");
        this.editMode = false;
        this.stage.setDraggable(true);
        anchors = this.stage.get('.topLeft');
        $.each(anchors, function (index, anchor) {
            anchor.hide();
        });
        anchors = this.stage.get('.topRight');
        $.each(anchors, function (index, anchor) {
            anchor.hide();
        });
        anchors = this.stage.get('.bottomLeft');
        $.each(anchors, function (index, anchor) {
            anchor.hide();
        });
        anchors = this.stage.get('.bottomRight');
        $.each(anchors, function (index, anchor) {
            anchor.hide();
        });
        
        magnets = this.stage.get(".magnet");
        $.each(magnets, function (key, magnet) {
            magnet.setDraggable(false);
        });
        groups = this.stage.get(".group");
        $.each(groups, function (key, group) {
            group.setDraggable(false);
        });
        this.stage.draw();
    };
    
    /**
    * Activates the edit mode of Mission Control
    *
    * @method activateEditMode
    */
    MissionControl.prototype.activateEditMode = function () {
        var anchors, magnets, groups;
        $("#missionControl .controls a.edit").addClass("active");
        this.editMode = true;
        this.stage.setDraggable(false);
        anchors = this.stage.get('.topLeft');
        $.each(anchors, function (index, anchor) {
            anchor.show();
        });
        anchors = this.stage.get('.topRight');
        $.each(anchors, function (index, anchor) {
            anchor.show();
        });
        anchors = this.stage.get('.bottomLeft');
        $.each(anchors, function (index, anchor) {
            anchor.show();
        });
        anchors = this.stage.get('.bottomRight');
        $.each(anchors, function (index, anchor) {
            anchor.show();
        });
        
        magnets = this.stage.get(".magnet");
        $.each(magnets, function (key, magnet) {
            magnet.setDraggable(true);
        });
        groups = this.stage.get(".group");
        $.each(groups, function (key, group) {
            group.setDraggable(true);
        });
        this.stage.draw();
    };
    
    /**
    * Toggles the edit mode of Mission Control
    *
    * @method toggleEditMode
    */
    MissionControl.prototype.toggleEditMode = function () {
        if (this.editMode) {
            this.deactivateEditMode();
        } else {
            this.activateEditMode();
        }
    };
    
    /**
    * Adds an image to the Misson Control stage
    *   - the image is loaded into the DOM
    *   - the image is resized to fit the stage width if necessary
    *   - anchors are added to the image
    *   - if the image-path is similar to the project-path the path is made relative to support portability of project
    *
    * @method toggleEditMode
    */
    MissionControl.prototype.addImage = function (imageToAdd) {
        var widthOfImage;
        var heightOfImage;
        var tempImage = new Image();
        var thisMissionControl = this;
        
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        //check if image is in the project folder, if yes set relative true
        var updatedPath = imageToAdd.replace(fullProjectPath, "");
        var relative = (imageToAdd !== updatedPath) ? true : false;
        
        var tempImageContainer = $('<img src="' + imageToAdd + '" id="tempImage" class="visibility: hidden"/>');
        tempImageContainer.load(function () {
            tempImageContainer.appendTo('#sidebar');
            tempImage.src = $('#tempImage').attr('src');
            widthOfImage = tempImage.width;
            heightOfImage = tempImage.height;
            var widthResized, heightResized;
            if (widthOfImage > heightOfImage) {
                widthResized = ($(window).width() * 0.7);
                heightResized = (widthResized / widthOfImage) * heightOfImage;
            } else {
                heightResized = ($(window).height() * 0.7);
                widthResized = (heightResized / heightOfImage) * widthOfImage;
            }
            if (widthResized > widthOfImage || heightResized > heightOfImage) {
                widthResized = widthOfImage;
                heightResized = heightOfImage;
            }
            var imageGroup = new Kinetic.Group({
                x: 40,
                y: 40,
                name: 'group',
                draggable: true
            });
    
            // new Image added to group
            var newImg = new Kinetic.Image({
                x: 0,
                y: 0,
                image: tempImage,
                width: widthResized,
                height: heightResized,
                name: 'image',
                src: updatedPath,
                relative: relative
            });
            
            newImg.on('mouseover', function () {
                if (thisMissionControl.editMode) {
                    var layer = this.getLayer();
                    document.body.style.cursor = "move";
                    this.setStroke("#EE8900");
                    layer.draw();
                }
            });
            newImg.on('mouseout', function () {
                if (thisMissionControl.editMode) {
                    var layer = this.getLayer();
                    document.body.style.cursor = 'default';
                    this.setStroke("transparent");
                    layer.draw();
                }
            });
    
            imageGroup.add(newImg);
            thisMissionControl.imageLayering.add(imageGroup);
    
            _addMissionControlAnchor(imageGroup, 0, 0, 'topLeft', deleteIcon);
            _addMissionControlAnchor(imageGroup, widthResized, 0, 'topRight', addIcon);
            _addMissionControlAnchor(imageGroup, widthResized, heightResized, 'bottomRight');
            _addMissionControlAnchor(imageGroup, 0, heightResized, 'bottomLeft');
            
            $('#tempImage').remove();
            thisMissionControl.stage.draw();
            tempImageContainer.unload();
        });
        this.activateEditMode();
        
    };
    
    /**
    * Resets all variables
    *
    * @method resetAllVariables
    */
    function resetAllVariables() {
        _sketchingAreaIdCounter = 0;
        active = false;
        firstActivation = true;

        _activeEditor = null;
        _activeDocument = null;
        _documentSketchingAreas = [];
        _activeSketchingArea = null;
        _activeStage = "";
        _activeLayer = "sketch";
        imageLayer = "";
        allPaintingActions = [];
        missionControl = null;
    }
    
    /**
    * Set the size of the side panel
    *
    * @param {Number} size of the panel in px
    * @method _setSizeOfMyPanel
    */
    function _setSizeOfMyPanel(space) {
        var windowsWidth = $('.content').width();
        // subtract 30 pixels, due to new SideBar in Sprint 23 
        var widthOfMyPanel = (space > 0) ? (windowsWidth / space - 30) : 0;
        var height = $('#editor-holder').height(); // hide horizontal scrollbar behind statusbar
        $('#editor-holder').css('margin-right', widthOfMyPanel);
        myPanel.css("width", widthOfMyPanel);
        myPanel.css("height", height);
    }
    
    /**
    * Hide the side panel
    *
    * @method _hideMyPanel
    */
    function _hideMyPanel() {
        $('#editor-holder').css('margin-right', "0");
        myPanel.hide();
    }
    
    /**
    * Show the side panel and scroll to correct scroll position
    *
    * @method _showMyPanel
    */
    function _showMyPanel() {
        $('#editor-holder').css('margin-right', myPanel.width());
        myPanel.show();
        myPanel.scrollTop(_activeEditor.getScrollPos().y);
    }
    
    /**
    * Add side panel 
    *
    * @method _addMyPanel
    */
    function _addMyPanel() {
        myPanel.insertAfter($('.content'));
        myPanel.mouseleave(function () {
            if (!$('.tools .edit').hasClass('selected')) {
                myPanel.animate({ scrollTop: _activeEditor.getScrollPos().y }, 700);
                setTimeout(function () {
                    _asyncScroll = false;
                }, 750);
            }
        });
        _hideMyPanel();
    }
    
    /**
    * Toggle the status of the SketchMeister
    *   - if active: deactivate, save all, and hide the side panel
    *   - if not active: set the size of the panel, show the panel, activate, redraw sketching area and stage
    *
    * @method _toggleStatus
    */
    function _toggleStatus() {
        if (active) {
            _deactivate();
            _saveAll();
            _hideMyPanel();
        } else {
            _setSizeOfMyPanel(panelSize);
            _showMyPanel();
            _activate();
            if (!firstActivation) {
                currentDocumentChanged(false);
            } else {
                firstActivation = false;
            }
            myPanel.find("canvas").width(myPanel.width());
            
            _activeSketchingArea.sketchArea.redraw();
            _activeStage.setWidth(myPanel.width());
            _activeStage.draw();
        }
    }
    
    /**
    * Initialization of the side panel 
    *
    * @method init
    */
    function init() {
        _setSizeOfMyPanel(panelSize);
        _showMyPanel();
        myPanel.find("canvas").width(myPanel.width());
        _activeSketchingArea.sketchArea.redraw();
        _hideMyPanel();
    }
    
    /**
    * Add all handlers
    *
    * @method _addHandlers
    */
    function _addHandlers() {
        // the document changes
        $(DocumentManager).on("currentDocumentChange", function () {
            if (!_projectClosed) {
                currentDocumentChanged(false);
            }
            if (active) {
                _saveAll();
            }
        });
        
        // a new project is opened
        $(ProjectManager).on("projectOpen", function () {
            setTimeout(function () {
                _projectClosed = false;
                resetAllVariables();
                readXmlFileData(function () {
                    missionControl = new MissionControl();
                    missionControl.init();
                    currentDocumentChanged(true);
                });
            }, 2000);
            
        });
        
        // bevfore the project is closed
        $(ProjectManager).on("beforeProjectClose", function () {
            _projectClosed = true;
            //save();
        });
        
        // reset the size of the side panel on resizing the Brackets window
        $(window).resize(function () {
            if (active) {
                _setSizeOfMyPanel(panelSize);
                $('.tools').css('height', $(_activeEditor.getScrollerElement()).height() - 100);
            } else {
                _setSizeOfMyPanel(0);
            }
            missionControl.stage.setWidth($("body").width());
            missionControl.stage.setHeight($("body").height());
        });
        
        // reset the size of the side panel if the active editor changes
        $(EditorManager).on("activeEditorChange", function () {
            if (active) {
                _setSizeOfMyPanel(panelSize);
            } else {
                _setSizeOfMyPanel(0);
            }
        });
        
        // save MissionControl and all sketches and stages if the document is saved
        $(DocumentManager).on("documentSaved", function () {
            _saveMissionControl();
            _saveSketchesAndImagesOfAllAreas();
            _writeXmlDataToFile();
        });
        
        // toggle SketchMeister on clicking on the UI button
        $('#toggle-sketching').click(function () {
            _toggleStatus();
        });
        
        // toggle MissionControl on clicking on the UI button
        $('#toggle-missionControl').click(function () {
            missionControl.toggle();
        });

        // remove the overlay if a document is removed from the working set
        $(DocumentManager).on("workingSetRemove", _removeOverlay);

        // panel is resized, move image layer and tools to top
        $('.overlay').on("panelResizeEnd", function () {
            _moveImageLayerToTop();
            _moveToolsToTop();
        });
        
        // Add button of the MissionControl
        $('body').delegate('#missionControl .controls a.add', 'click', function () {
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {
                $.each(files, function (key, image) {
                    missionControl.addImage(image);
                });
            }, function (err) {console.log(err); });
        });
        
        // Mouse scroll event on the MissionControl
        $('body').delegate('#missionControl', 'mousewheel', function (event) {
            missionControl.zoom(event);
        });
        
        // Edit button of the MissionControl
        $('body').delegate('#missionControl .controls a.edit', 'click', function () {
            missionControl.toggleEditMode();
        });
        
        // Escape button of the MissionControl
        $('body').delegate('#missionControl .controls a.esc', 'click', function () {
            missionControl.toggle();
        });
        
        // Reset the zoom level of the MissionControl
        $('body').delegate('#missionControl .controls a.reset-zoom', 'click', function () {
            missionControl.stage.setScale(1.0, 1.0);
            missionControl.stage.draw();
        });
        
        // If MissionControl is active and the ESC-Button pressed the Mission Control is deactivated
        $(document).keydown(function (e) {
            if (e.keyCode === 27 && missionControl.active) { // ESC was pressed and MissionControl is active
                missionControl.toggle();
            }
        });
        
        // Zoom in button of the MissionControl
        $('body').delegate('#missionControl .controls a.zoomin', 'click', function () {
            missionControl.zoomIn();
        });
        
        // Zoom out button of the MissionControl
        $('body').delegate('#missionControl .controls a.zoomout', 'click', function () {
            missionControl.zoomOut();
        });
        
        // highlight the clicked button on the tool bar
        $('body').delegate('.tools .button', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .button').removeClass('selected');
            $(this).addClass('selected');
        });
        
        // highlight the eraser button on the tool bar
        $('body').delegate('.tools .eraser', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .color').removeClass('selected');
            $(this).addClass('selected');
        });

        // highlight the color button on the tool bar
        $('body').delegate('.tools .color', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .edit').removeClass('selected');
            $('#tools-' + id + ' .eraser').removeClass('selected');
            $('#tools-' + id + ' .color').removeClass('selected');
            $(this).addClass('selected');
        });

        // Edit button on the tool bar
        $('body').delegate('.tools .edit', 'click', function () {
            var magnets, groups;
            if ($(this).hasClass('selected')) {
                //deactivate edit mode
                _activeLayer = "image";
                myPanel.animate({ scrollTop: _activeEditor.getScrollPos().y }, 700);
                setTimeout(function () {
                    _asyncScroll = false;
                }, 750);
                $(this).removeClass('selected');
                _hideAnchors(_activeSketchingArea.stage);
                
                magnets = _activeStage.get(".magnet");
                $.each(magnets, function (key, magnet) {
                    magnet.setDraggable(false);
                });
                groups = _activeStage.get(".group");
                $.each(groups, function (key, group) {
                    group.setDraggable(false);
                });
            } else {
                //activate edit mode
                _activeLayer = "edit";
                _asyncScroll = true;
                $(this).addClass('selected');
                _showAnchors(_activeSketchingArea.stage);
                $('.tools .sketch-layer').removeClass('selected');

                magnets = _activeStage.get(".magnet");
                $.each(magnets, function (key, magnet) {
                    magnet.setDraggable(true);
                });
                groups = _activeStage.get(".group");
                $.each(groups, function (key, group) {
                    group.setDraggable(true);
                });
            }
        });

        // hightlight the stroke size button on the tool bar
        $('body').delegate('.tools .size', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .size').removeClass('selected');
            $(this).addClass('selected');
        });

        // add-image button on the tool bar
        $('body').delegate('.add-image', 'click', function () {
            var id = _activeSketchingArea.id;
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {
                _activeLayer = "edit";
                _asyncScroll = true;
                _showAnchors(_activeSketchingArea.stage);
                $('.tools .sketch-layer').removeClass('selected');
                var magnets = _activeStage.get(".magnet");
                $.each(magnets, function (key, magnet) {
                    magnet.setDraggable(true);
                });
                var groups = _activeStage.get(".group");
                $.each(groups, function (key, group) {
                    group.setDraggable(true);
                });
                _insertFileToImageArea(files);
            }, function (err) {});
        });

        // change to image layer
        $('body').delegate('.image-layer', 'click', function () {
            _moveImageLayerToTop();
        });
        
        // change to sketch layer
        $('body').delegate('.sketch-layer', 'click', function () {
            if (_activeLayer === "sketch") {
                $(this).removeClass('selected');
                _moveImageLayerToTop();
                var id = _activeSketchingArea.id;
                $('#tools-' + id + ' .color').removeClass('selected');
            } else {
                $('.tools .edit').removeClass('selected');
                $(this).addClass('selected');
                _hideAnchors(_activeSketchingArea.stage);
                _moveSketchingAreaToTop();
                _asyncScroll = false;
            }
            
        });

    }
    
    /**
    * Toggle the status of the MissionControl
    *
    * @method _toggleMissionControl
    */
    function _toggleMissionControl() {
        missionControl.toggle();
    }
    
    /**
    * Add menu items to the Brackets menu bar to toggle SketchMeister and MissionControl
    *
    * @method _addMenuItems
    */
    function _addMenuItems() {
        var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        viewMenu.addMenuDivider();

        function registerCommandHandler(commandId, menuName, handler, shortcut) {
            CommandManager.register(menuName, commandId, handler);
            viewMenu.addMenuItem(commandId);
            KeyBindingManager.addBinding(commandId, shortcut);
        }

        registerCommandHandler("lukasspy.sketchmeister.toggleSketchmeister", "Enable SketchMeister", _toggleStatus, "Ctrl-1");
        registerCommandHandler("lukasspy.sketchmeister.toggleMissionControl", "Enable MissionControl", _toggleMissionControl, "Alt-1");
    }

    AppInit.appReady(function () {
        
        readXmlFileData(function () {
            // important: deactivate LineWrapping of CodeMirror, since otherwise height of editorWrapper is changed => cannot be mapped to the SketchingArea and async-scrolling is wrong
            Editor.setWordWrap(false);
            
            _addMenuItems();
            _addToolbarIcon();
            _addHandlers();
            _addMyPanel();
            missionControl = new MissionControl();
            missionControl.init();
            currentDocumentChanged(true);
        });
    });
});