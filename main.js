/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, _toggleStatus, document, Kinetic, addImageToStage, addAnchor, addMissionControlAnchor, unhighlightMissionControl, highlightMissionControl, addMissionControlMarker, allAnchors, addListenersToAnchor, addListenersToMissionControlAnchor, addDeleteAnchor, showAnchors, hideAnchors, addListenersToMagnet, addListenersToMissionControlMagnet, addMarker, removeMarker, highlight, unhighlight, recalculateStartAndEndOfConnection */

var xmlFilename = "sketchmeister.xml";
var panelSize = 2;

var myPanel = $('<div id="myPanel"></div>');
var missionControl;

var asyncScroll = false;
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
var activeMarker = [];
var allPaintingActions = [];

var addedListeners = [];


define(function (require, exports, module) {
    "use strict";

    var addImageDialog = require("text!html/dialog.html");
    var sketchIconActive = require.toUrl('./img/sketch_button_on.png');
    var sketchIconDeactive = require.toUrl('./img/sketch_button_off.png');
    var testImage = require.toUrl('./img/test.png');
    var delCursor = require.toUrl('./img/cursor-delete.gif');
    
    var deleteIcon = require.toUrl('./img/delete-button.png');
    var addIcon = require.toUrl('./img/add-button.png');

    
    var CommandManager = brackets.getModule("command/CommandManager"),
        ProjectManager = brackets.getModule("project/ProjectManager"),
        //EditorUtils = brackets.getModule("editor/EditorUtils"),
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
    
    //require('js/jquery-ui-1.10.0.custom.min');
    //require('js/runmode');
    
    var loadCSSPromise = ExtensionUtils.loadStyleSheet(module, 'css/main.css');
   
    
    require('js/sketch');
    require('js/json2');
    require('js/functions');
    require('js/kinetic-v4.3.1');
    require('js/kinetic-functions');

    /*----- xml functions -----*/

    $.createElement = function (name) {
        return $('<' + name + ' />');
    };

    function createProjectNode(fullPathOfProject) {
        xmlData = $('<root><project fullPath="' + fullPathOfProject + '"/></root>');
        $xml = $(xmlData);
    }

    function createFileNode(filename, relativePath) {
        var newFile = $.createElement("file");
        newFile.attr("filename", filename).attr("path", relativePath);
        return newFile;
    }

    /*----- sketch.js functionen -----*/

    function sketchGetURL() {
        var canvas = $('#simple_sketch-' + _activeSketchingArea.id)[0];
        var sketchDataURL = canvas.toDataURL();
    }

    /*----- functions for kinetic drag/resize ------*/

    function moveToolsToTop() {
        $('.tools').css('z-index', '5');
    }

    function moveImageLayerToTop() {
        //Anchor einblenden
        $('.kineticjs-content').css('z-index', '5');
        $('.simple_sketch').css('z-index', '3');
        $('.sketching-tools').hide();
        _activeLayer = "image";
    }

    function moveSketchingAreaToTop() {
        //Anchor ausblenden
        $('.simple_sketch').css('z-index', '5');
        $('.kineticjs-content').css('z-index', '3');
        $('.sketching-tools').show();
        _activeLayer = "sketch";
    }

    function createStage(container, width, height, path, filename) {
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
                tempImage.src = image.attrs.src;
                var width = image.attrs.width;
                var height = image.attrs.height;
                $('<img src="' + image.attrs.src + '" id="tempImage" class="visibility: hidden"/>').load(function () {
                    
                    var group = groups[key];
                    group.setDraggable(false);
                    
                    var anchors = group.get(".topLeft");
                    var imageObj = new Image();
                    imageObj.src = deleteIcon;
                    $.each(anchors, function (key, anchor) {
                        
                        anchor.setImage(imageObj);
                        addListenersToAnchor(anchor, group);
                    });

                    anchors = group.get(".topRight");
                    imageObj = new Image();
                    imageObj.src = addIcon;
                    $.each(anchors, function (key, anchor) {
                        anchor.setImage(imageObj);
                        addListenersToAnchor(anchor, group);
                    });
                    
                    anchors = group.get(".bottomRight");
                    $.each(anchors, function (key, anchor) {
                        addListenersToAnchor(anchor, group);

                    });
                    
                    anchors = group.get(".bottomLeft");
                    $.each(anchors, function (key, anchor) {
                        addListenersToAnchor(anchor, group);
                    });
                    //addDeleteAnchor(group, width, 0, 'delete');
                    //addAnchor(group, width, height, 'bottomRight');
                
                    hideAnchors(stage);
                    var magnets = group.get(".magnet");
                    $.each(magnets, function (key, magnet) {
                        magnet.setDraggable(false);
                        //console.log(magnet._id);
                        addMarker(JSON.parse(magnet.attrs.connection), magnet._id);
                        addListenersToMagnet(magnet, group);
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
    
    function createStageForMissionControl(container, width, height) {
        var stage;
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
                tempImage.src = image.attrs.src;
                var width = image.attrs.width;
                var height = image.attrs.height;
                $('<img src="' + image.attrs.src + '" id="tempImage" class="visibility: hidden"/>').load(function () {
                    
                    var group = groups[key];
                    group.setDraggable(true);
                    var anchors = group.get(".topLeft");
                    var imageObj = new Image();
                    imageObj.src = deleteIcon;
                    $.each(anchors, function (key, anchor) {
                        anchor.setImage(imageObj);
                        addListenersToMissionControlAnchor(anchor, group);
                    });

                    anchors = group.get(".topRight");
                    
                    imageObj = new Image();
                    imageObj.src = addIcon;
                    $.each(anchors, function (key, anchor) {
                        anchor.setImage(imageObj);
                        addListenersToMissionControlAnchor(anchor, group);
                    });
                    
                    anchors = group.get(".bottomRight");
                    $.each(anchors, function (key, anchor) {
                        addListenersToMissionControlAnchor(anchor, group);

                    });
                    
                    anchors = group.get(".bottomLeft");
                    $.each(anchors, function (key, anchor) {
                        addListenersToMissionControlAnchor(anchor, group);
                    });
                    
                    var magnets = group.get(".magnet");
                    $.each(magnets, function (key, magnet) {
                        //magnet.setDraggable(false);
                        //console.log(magnet._id);
                        unhighlight(magnet);
                        var JSONconnection = JSON.parse(magnet.attrs.connection);
                        if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
                            magnet.setStroke('rgba(55, 101, 104, 1)');
                            magnet.setFill('rgba(55, 101, 104, 0.5)');
                        }
                        magnet.setRadius(12);
                        magnet.attrs.clicked = false;
                        addListenersToMissionControlMagnet(magnet, group);
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

    function addImageToStage(imageToAdd) {
        var widthOfImage;
        var heightOfImage;
        var tempImage = new Image();

        $('<img src="' + imageToAdd + '" id="tempImage" class="visibility: hidden"/>').load(function () {
            $(this).appendTo('#sidebar');
            tempImage.src = $('#tempImage').attr('src');
            widthOfImage = tempImage.width;
            heightOfImage = tempImage.height;

            moveImageLayerToTop();
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
                src: tempImage.src
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
            /*
            newImg.on('mouseover', function () {
                this.setStrokeWidth(4);
            });
            
            newImg.on('mouseout', function () {
                this.setStrokeWidth(0);
            });
            */
            imageGroup.add(newImg);
            var thisImageLayer = _activeSketchingArea.stage.getChildren()[0];
            thisImageLayer.add(imageGroup);

            addAnchor(imageGroup, 0, 0, 'topLeft', deleteIcon);
            addAnchor(imageGroup, widthResized, 0, 'topRight', addIcon);
            //addDeleteAnchor(imageGroup, widthResized, 0, 'delete');
            addAnchor(imageGroup, widthResized, heightResized, 'bottomRight');
            addAnchor(imageGroup, 0, heightResized, 'bottomLeft');
            imageGroup.on('dragstart', function () {
                this.moveToTop();
            });
            
            
            _activeSketchingArea.stage.draw();
            $('#tempImage').remove();
        });

    }

    /*----- functions for sketching area ------*/


    function _addSketchingTools(id) {
        myPanel.append('<div class="tools" id="tools-' + id + '" style="height: ' + $(_activeEditor.getScrollerElement()).height() + 'px"></div>');
        
        $('#tools-' + id).append('<div class="seperator"></div>');
        $('#tools-' + id).append("<a href='#' class='add-image button'>+</a> ");
        $('#tools-' + id).append("<a href='#' class='image-layer edit'>edit</a> ");
        //$('#tools-' + id).append("<a href='#' class='asyncScrolling button'>scroll</a> ");
        $('#tools-' + id).append("<a href='#' class='redraw button'>redraw</a> ");
        $('#tools-' + id).append("<a href='#' class='sketch-layer button'>sketch</a> ");
        
        var sketchingTools = $('<div class="sketching-tools"></div>');
        sketchingTools.append('<div class="seperator"></div>');
        sketchingTools.append('<a href="#simple_sketch-' + id + '" data-undo="1" class="undo"></a>');
        sketchingTools.append("<a href='#simple_sketch-" + id + "' data-clear='1' class='button'>clear</a> ");

        
        sketchingTools.append('<div class="seperator">Color</div>');
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
        sketchingTools.append('<div class="seperator">Size</div>');
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

    function _addToolbarIcon(id) {
        $('#main-toolbar .buttons').prepend('<a href="#" id="toggle-sketching" title="SketchMeister"></a>');
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
    }
    
    function getSketchingActionsForThisFileFromXml(filename, relativePath) {
        var actions = $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").find("sketchingactions");
        // check if there are actions for this sketchingArea
        // if yes then parse the JSON string and return else return an empty array -> default if no actions
        if (actions.html() !== null) {
            return JSON.parse(actions.html());
        } else {
            return [];
        }
    }
    
    function getStageObjectForThisFileFromXml(id, filename, relativePath) {
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
    
    function loadSketchingActionsFromXmlToSketchingArea() {
        var filename = DocumentManager.getCurrentDocument().file.name;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = _activeSketchingArea.fullPath.replace(fullProjectPath, "").replace(filename, "");
        var actions = getSketchingActionsForThisFileFromXml(filename, relativePath);
        _activeSketchingArea.sketchArea.actions = actions;
        if (actions.length > 0) {
            _activeSketchingArea.sketchArea.redraw();
        }
    }
    
    function loadStageObjectFromXmlToStage() {
        var filename = DocumentManager.getCurrentDocument().file.name;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = _activeSketchingArea.fullPath.replace(fullProjectPath, "").replace(filename, "");
        
        var stageObject = getStageObjectForThisFileFromXml(filename, relativePath);
        if (stageObject) {
            _activeSketchingArea.stage = stageObject;
            _activeSketchingArea.stage.draw();
        }
    }
       
    function _deactivate() {
        $(".tools").hide();
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
        active = false;
    }

    function _activate() {
        $(".tools").show();
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconActive + '")');
        active = true;
    }

    function _addSketchingArea(path, filename) {
        var id = _sketchingAreaIdCounter++;
        var height = $(_activeEditor.getScrollerElement()).height();
        var width = $(_activeEditor.getScrollerElement()).width();
        // breite von myPanel !!!!!! besser ist wohl $("#myPanel").width()
        width = myPanel.width();
        // feste Breite ... entscheidung für Nutzer getroffen ... 1500px
        //width = "1500";
        // keine Ahnung warum 30px mehr sein muessen ... im Editor wird immer noch eine letzte Zeile angezeigt, die keine Zeilennummer hat, aber eine Hoehe
        var totalHeight = _activeEditor.totalHeight() + 30;

        $("#myPanel").append('<div class="overlay" id="overlay-' + id + '"><canvas class="simple_sketch" id="simple_sketch-' + id + '" width="' + width + '" height="' + totalHeight + '"></canvas></div>');

        $("#overlay-" + id).css('height', totalHeight + 'px');
        var sketchArea = $('#simple_sketch-' + id).sketch();

        _addSketchingTools(id);
        var stage = createStage('overlay-' + id, myPanel.width(), totalHeight, path, filename);
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
            //console.log('wurde deaktiviert');
        }
        var length = _documentSketchingAreas.push(sketchingArea);
        return length - 1;
    }
    var ignoreScrollEventsFromPanel = false;
    var ignoreScrollEventsFromEditor = false;
    
    function _scroll() {
        var ignore = ignoreScrollEventsFromEditor;
        ignoreScrollEventsFromEditor = false;
        if (ignore) {
            return false;
        } else if (!asyncScroll) {
            var scrollPos = _activeEditor.getScrollPos();
            ignoreScrollEventsFromPanel = true;
            if ($('#myPanel').scrollTop() !== scrollPos.y) {
                $('#myPanel').scrollTop(scrollPos.y);
            }
        }
    }

    function _scrollEditor() {
        var ignore = ignoreScrollEventsFromPanel;
        ignoreScrollEventsFromPanel = false;
        if (ignore) {
            return false;
        } else if (!asyncScroll) {
            var scrollPos = $('#myPanel').scrollTop();
            ignoreScrollEventsFromEditor = true;
            if (_activeEditor.getScrollPos().y !== scrollPos) {
                _activeEditor.setScrollPos(_activeEditor.getScrollPos().x, scrollPos);
            }
        }
    }
    
    function whereIsThePointInRelationToTwoOtherPoints(point, from, to) {
        // -1 before < 0 inside < 1 after
        
        if (to < point) {
            return 1; //after
        } else if (point < from) {
            return -1; //before
        } else {
            return 0; //inside
        }
    }
    
    function addListenersToEditor(editor, fullPath, initialize) {
        if (!initialize) {
            var listenersAlreadyAdded = false;
            $.each(addedListeners, function (key, addedListener) {
                if (addedListener === fullPath) {
                    listenersAlreadyAdded = true;
                    return false;
                }
            });
            console.log("already added: " + listenersAlreadyAdded);
            if (listenersAlreadyAdded) {
                return false;
            }
        }
        
        addedListeners.push(fullPath);
        editor._codeMirror.on("change", function (cm, change) {
            var magnets = _activeStage.get(".magnet");
            $.each(magnets, function (pos, magnet) {
                var reCalculatedConnection = recalculateStartAndEndOfConnection(magnet, cm, change, 0);
                if (reCalculatedConnection) {
                    magnet.attrs.connection = reCalculatedConnection;
                } else {
                    magnet.destroy();
                    _activeStage.draw();
                }
            });
            
            magnets = missionControl.stage.get(".magnet");
            $.each(magnets, function (pos, magnet) {
                var reCalculatedConnection = recalculateStartAndEndOfConnection(magnet, cm, change, 1);
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
                                unhighlight(magnet);
                                magnet.clicked = false;
                                activeMarker[magnet._id].clear();
                                $(".magnet-" + magnet._id).removeClass('selectionLink');
                                delete (activeMarker[magnet._id]);
                                asyncScroll = true;
                                myPanel.animate({ scrollTop: $(_activeEditor.getScrollerElement()).scrollTop() }, 700);
                                setTimeout(function () {
                                    asyncScroll = false;
                                }, 750);
                            } else {
                                // no mark in text, so lets get the magnet and mark corresponding text
                                //console.log(magnet);
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
                                    highlight(magnet);
                                    magnet.clicked = true;
                                    $(".magnet-" + magnet._id).addClass("selectionLink");
                                    var connection = JSON.parse(magnet.attrs.connection);
                                    //console.log(connection);
                                    activeMarker[magnet._id] = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                                    if (offscreenLocation === "bottom") {
                                        var scrollPos = magnetsGroupFirstPixel - (editorHeight - groupHeight);
                                        asyncScroll = true;
                                        myPanel.animate({ scrollTop: scrollPos }, 700);
                                        setTimeout(function () {
                                            asyncScroll = false;
                                        }, 750);
                                    } else if (offscreenLocation === "top") {
                                        asyncScroll = true;
                                        myPanel.animate({ scrollTop: magnetsGroupFirstPixel - 10 }, 700);
                                        setTimeout(function () {
                                            asyncScroll = false;
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
                                    unhighlightMissionControl(magnet);
                                    magnet.clicked = false;
                                    activeMarker[magnet._id].clear();
                                    $(".magnet-" + magnet._id).removeClass('selectionLinkFromMissionControl');
                                    delete (activeMarker[magnet._id]);
                                } else {
                                    highlightMissionControl(magnet, magnets);
                                    magnet.clicked = true;
                                    $(".magnet-" + magnet._id).addClass("selectionLinkFromMissionControl");
                                    var connection = JSON.parse(magnet.attrs.connection);
                                    activeMarker[magnet._id] = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLinkFromMissionControl'});
                                }
                            }
                        });
                    }
                });
            } else {
                console.log("keine markierung");
            }
        });
    }

    function currentDocumentChanged(initialize) {
        //getCurrentDocument..
        // set the current Full Editor as _activeEditor
        _activeEditor = EditorManager.getCurrentFullEditor();
        
        
        //var gutter = _activeEditor._codeMirror.getWrapperElement().getElementsByClassName("CodeMirror-gutter")[0];
        $(_activeEditor).on("scroll", _scroll);
        myPanel.on("scroll", _scrollEditor);

        // set the current Document as _activeDocument to get additional data of the file
        _activeDocument = DocumentManager.getCurrentDocument();

        var _activeFullPath = DocumentManager.getCurrentDocument().file.fullPath;

        var magnets = missionControl.stage.get(".magnet");
        $.each(magnets, function (key, magnet) {
            if (_activeFullPath === magnet.attrs.fullPath) {
                addMissionControlMarker(JSON.parse(magnet.attrs.connection), magnet._id);
            }
        });
    
        var _activeFilename = DocumentManager.getCurrentDocument().file.name;
        
        if (initialize) {
            console.log("init");
            $.each(DocumentManager.getAllOpenDocuments(), function (key, openDocument) {
                addListenersToEditor(openDocument._masterEditor, openDocument.file.fullPath, initialize);
            });
        } else {
            console.log("not init");
            addListenersToEditor(EditorManager.getCurrentFullEditor(), _activeFullPath, initialize);
        }
        console.log(addedListeners);
        // go through all already opened sketchingAreas and check if opened file already has a sketchingArea
        var foundSketchingArea = -1;
        if (!initialize) {
            
            $.each(_documentSketchingAreas, function (key, sketchingArea) {
                sketchingArea.active = false;
                if (active) {
                    $('#overlay-' + sketchingArea.id).hide();
                }
                if (sketchingArea.fullPath === _activeFullPath) {
                    foundSketchingArea = key;
                }
            });
        }
        
        // if sketchingArea is already loaded set it as active, else create a new sketchingArea and add it to Array of sketchingAreas
        if (!initialize && foundSketchingArea !== -1) {
            // sketchingArea was found and it is set
            _activeSketchingArea = _documentSketchingAreas[foundSketchingArea];
            _activeSketchingArea.active = true;
        } else {
            // sketchingArea is not in Array and will be created with _addSketching Area
            var key = _addSketchingArea(_activeFullPath, _activeFilename);
            _activeSketchingArea = _documentSketchingAreas[key];
            // check which layer is on top to stay in sync with other already open sketching areas
            if (_activeLayer === "sketch") {
                moveSketchingAreaToTop();
            } else {
                moveImageLayerToTop();
            }
            //sketchingArea has been created and now the xml-file has to be checked if there are sketchingActions for that file
            loadSketchingActionsFromXmlToSketchingArea();
        }
        
        // adding listeners to newly created Editors or if init then add to all in the workingset
        
        // set the active stage by referencing the stage of the active sketchingArea
        _activeStage = _activeSketchingArea.stage;
        _activeSketchingArea.sketchArea.redraw();
        if (active) {
            $('#overlay-' + _activeSketchingArea.id).show();
        }
        
        //when document is changed the editor position was stored, so the panel needs to be synced on reentering
        myPanel.scrollTop(_activeEditor.getScrollPos().y);
    }

    function deleteSketchingArea(id) {
        _documentSketchingAreas.splice(id, 1);
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
    
    function checkIfXMLFileExists(path) {
        NativeFileSystem.resolveNativeFileSystemPath(path + xmlFilename, function (entry) {
            return true;
        }, function (err) {
            return false;
        });
    }

    function checkIfFileNodeExists(filename, relativePath) {
        return $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']");
    }

    function checkIfSketchingNodeForFileNodeExists(filename, relativePath) {
        return $xml.find("file[filename='" + filename + "'][path='" + relativePath + "'] sketchactions");
    }

    function setSketchingActionsAtNode(sketchingActionsAsJSON, filename, relativePath) {
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").children("sketchingactions").remove();
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").append("<sketchingactions>" + sketchingActionsAsJSON + "</sketchingactions>");
    }
    
    function setStageObjectAtNode(stageObjectAsJSON, filename, relativePath) {
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").children("stage").remove();
        $xml.find("file[filename='" + filename + "'][path='" + relativePath + "']").append("<stage>" + stageObjectAsJSON + "</stage>");
    }

    function readXmlFileData(callback) {
        //load xml-Datei oder erstellen, falls nix vorhanden
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var fileEntry = new NativeFileSystem.FileEntry(fullProjectPath + xmlFilename);
        FileUtils.readAsText(fileEntry).done(function (data, readTimestamp) {
            $xml = $(data);
            if (typeof callback === 'function') { // make sure the callback is a function
                callback.call(this); // brings the scope to the callback
            }
        }).fail(function (err) {
            createProjectNode(fullProjectPath);
            if (typeof callback === 'function') { // make sure the callback is a function
                callback.call(this); // brings the scope to the callback
            }
        });
        
    }

    function saveSketchesAndImages(sketchingArea) {
        var sketchingActionsAsJSON = JSON.stringify(sketchingArea.sketchArea.actions);
        var stageObjectAsJSON = sketchingArea.stage.toJSON();
        var filename = sketchingArea.filename;
        var fullProjectPathAndFilename = sketchingArea.fullPath;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = fullProjectPathAndFilename.replace(fullProjectPath, "").replace(filename, "");
        var fileNode;
        var nodeForActiveFile;

        //check if node for activeFile is already in the xml
        fileNode = checkIfFileNodeExists(filename, relativePath);
        if (!fileNode.html()) {
            nodeForActiveFile = createFileNode(filename, relativePath);
            $xml.find("project").append(nodeForActiveFile);
        }
        setSketchingActionsAtNode(sketchingActionsAsJSON, filename, relativePath);
        setStageObjectAtNode(stageObjectAsJSON, filename, relativePath);
    }
    
    function saveSketchesAndImagesOfAllAreas() {
        $.each(_documentSketchingAreas, function (key, sketchingArea) {
            saveSketchesAndImages(sketchingArea);
        });
    }
    
    function writeXmlDataToFile() {
        var fileEntry = new NativeFileSystem.FileEntry(ProjectManager.getProjectRoot().fullPath + xmlFilename);
        FileUtils.writeText(fileEntry, "<root>" + $xml.html() + "</root>").done(function () {
            console.log("XML successfully updated");
        }).fail(function (err) {
            console.log("Error writing text: " + err.name);
        });
    }

    function save(sketchingArea, callback) {
        readXmlFileData(function () {
            saveSketchesAndImages(sketchingArea);
            var fileEntry = new NativeFileSystem.FileEntry(ProjectManager.getProjectRoot().fullPath + xmlFilename);
            FileUtils.writeText(fileEntry, "<root>" + $xml.html() + "</root>").done(function () {
                console.log("XML successfully updated");
                if (typeof callback === 'function') { // make sure the callback is a function
                    callback.call(this); // brings the scope to the callback
                }
            }).fail(function (err) {
                console.log("Error writing text: " + err.name);
            });
        });
    }
    
    function saveAll() {
        // readXmlFileData ist vielleicht unnoetig, weil ja schon beim loaden alles gelesen werden .
        //readXmlFileData(function () {
        saveSketchesAndImagesOfAllAreas();
        writeXmlDataToFile();
        //});
    }
    
    function insertFileToImageArea(files) {
        $('.tools .layer').removeClass('selected');
        $('.tools .image-layer').addClass('selected');
        var i;
        for (i = 0; i < files.length; i++) {
            addImageToStage(files[i]);
        }
    }
    
    function saveMissionControl() {
        var missionControlAsJSON = missionControl.stage.toJSON();
        $xml.find("project").children("missioncontrol").remove();
        $xml.find("project").append("<missioncontrol>" + missionControlAsJSON + "</missioncontrol>");
    }
    // <a href="#" class="zoomin"></a><a href="#" class="zoomout"></a>
    function MissionControl() {
        this.overlay = $('<div id="missionControl"><div class="left controls"><a href="#" class="add"></a></div><div class="right controls"><a href="#" class="edit"></a></div></div>');
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
    
    MissionControl.prototype.init = function () {
        this.overlay.appendTo("body");
        this.stage = createStageForMissionControl("missionControl", $("body").width(), $("body").height());
        console.log(this.stage.getScale());
        this.imageLayering = new Kinetic.Layer({id: 'images'});
        this.stage.add(this.imageLayering);
        $('#missionControl .kineticjs-content').css('z-index', '21');
        //$("#missionControl").css("margin-left", $("#sidebar").width());
        this.deactivateEditMode();
    };
    
    MissionControl.prototype.zoom = function (event) {
        console.log(this.stage);
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
    
    MissionControl.prototype.zoomIn = function () {
        var position = this.stage.getUserPosition();
        var scale = this.stage.getScale();
        this.stage.setScale(scale.x + 0.2, scale.y + 0.2);
        this.stage.draw();
    };
    
    MissionControl.prototype.zoomOut = function () {
        var position = this.stage.getUserPosition();
        var scale = this.stage.getScale();
        this.stage.setScale(scale.x - 0.2, scale.y - 0.2);
        this.stage.draw();
        //stage.setPosition(position.x - stage.getX(), position.y - stage.getY());
    };
    
    MissionControl.prototype.toggle = function () {
        if (this.active) {
            this.active = false;
            this.overlay.hide(); //fadeOut("fast");
            saveMissionControl();
            writeXmlDataToFile();
        } else {
            this.active = true;
            this.overlay.show(); //fadeIn("fast");
        }
    };
    
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
    
    MissionControl.prototype.toggleEditMode = function () {
        if (this.editMode) {
            this.deactivateEditMode();
        } else {
            this.activateEditMode();
        }
    };
    
    MissionControl.prototype.addImage = function (imageToAdd) {
        var widthOfImage;
        var heightOfImage;
        var tempImage = new Image();
        var thisMissionControl = this;
        var imageElement = $('<img src="' + imageToAdd + '" id="tempImage" class="visibility: hidden"/>');
        
        imageElement.load(function () {
            imageElement.appendTo('#sidebar');
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
                src: tempImage.src
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
    
            addMissionControlAnchor(imageGroup, 0, 0, 'topLeft', deleteIcon);
            addMissionControlAnchor(imageGroup, widthResized, 0, 'topRight', addIcon);
            addMissionControlAnchor(imageGroup, widthResized, heightResized, 'bottomRight');
            addMissionControlAnchor(imageGroup, 0, heightResized, 'bottomLeft');
            
            $('#tempImage').remove();
            thisMissionControl.stage.draw();
        });
        this.activateEditMode();
    
    };
    
    function resetAllVariables() {
        _sketchingAreaIdCounter = 0;
        xmlData = "";
        $xml = null;
        active = false;
        firstActivation = true;

        _activeEditor = null;
        _activeDocument = null;
        _documentSketchingAreas = [];
        _activeSketchingArea = null;
        _activeStage = "";
        _activeLayer = "sketch";
        imageLayer = "";
        _codeMirror = null;
        allPaintingActions = [];
    }
    
    function setSizeOfMyPanel(space) {
        var windowsWidth = $('.content').width();
        var widthOfMyPanel = (space > 0) ? (windowsWidth / space) : 0;
        $('#editor-holder').css('margin-right', widthOfMyPanel);
        myPanel.css("width", widthOfMyPanel);
    }
    
    function hideMyPanel() {
        $('#editor-holder').css('margin-right', "0");
        myPanel.hide();
    }
    
    function showMyPanel() {
        $('#editor-holder').css('margin-right', myPanel.width());
        myPanel.show();
        myPanel.scrollTop(_activeEditor.getScrollPos().y);
    }
    
    function _addMyPanel() {
        myPanel.insertAfter($('.content'));
        myPanel.mouseleave(function () {
            if (!$('.tools .edit').hasClass('selected')) {
                myPanel.animate({ scrollTop: _activeEditor.getScrollPos().y }, 700);
                setTimeout(function () {
                    asyncScroll = false;
                }, 750);
            }
        });
        //Resizer.makeResizable(myPanel, 'horz', 'LEFT', '200', false, true);
        //Resizer.hide(myPanel);
        /*
        myPanel.mouseenter(function () {
            mouseOverPanel = true;
            asyncScroll = true;
            $('.asyncScrolling').addClass('selected');
        });
        $('#editor-holder').mouseenter(function () {
            mouseOverPanel = false;
            asyncScroll = false;
            $('.asyncScrolling').removeClass('selected');
        });
        */
        hideMyPanel();
    }
    
    function _toggleStatus() {
        if (active) {
            _deactivate();
            saveAll();
            hideMyPanel();
        } else {
            setSizeOfMyPanel(panelSize);
            _activate();
            
            currentDocumentChanged(false);
            myPanel.find("canvas").width(myPanel.width());
            _activeSketchingArea.sketchArea.redraw();
            showMyPanel();
        }
        //Resizer.toggle(myPanel);
    }
    
    function init() {
        setSizeOfMyPanel(panelSize);
        showMyPanel();
        myPanel.find("canvas").width(myPanel.width());
        _activeSketchingArea.sketchArea.redraw();
        hideMyPanel();
    }
    
    function _addHandlers() {
        $(DocumentManager).on("currentDocumentChange", function () {
            if (!_projectClosed) {
                currentDocumentChanged(false);
            }
            if (active) {
                saveAll();
            }
        });
        
        $(ProjectManager).on("projectOpen", function () {
            setTimeout(function () {
                _projectClosed = false;
                resetAllVariables();
                readXmlFileData();
                
            }, 2000);
            
        });
        $(ProjectManager).on("beforeProjectClose", function () {
            _projectClosed = true;
            
            //save();
            
        });
        
        $(window).resize(function () {
            if (active) {
                setSizeOfMyPanel(panelSize);
                $('.tools').css('height', $(_activeEditor.getScrollerElement()).height());
                
                //$.each(_documentSketchingAreas, function (key, sketchingArea) {
                    //$('#simple_sketch-' + sketchingArea.id).css('width', myPanel.width());
                    //sketchingArea.width = myPanel.width();
                    //sketchingArea.height = myPanel.height();
                    //sketchingArea.stage.setWidth(myPanel.width());
                    //sketchingArea.stage.setHeight(myPanel.height());
                //});
                //$(".overlay").width(myPanel.width());
                //$(".overlay").height(myPanel.height());
                
            } else {
                setSizeOfMyPanel(0);
            }
        });
        
        $(EditorManager).on("activeEditorChange", function () {
            if (active) {
                setSizeOfMyPanel(panelSize);
                //resize all SketchingAreas
                //resize all Stages
            } else {
                setSizeOfMyPanel(0);
            }
        });
        
        $(DocumentManager).on("documentSaved", function () {
            saveMissionControl();
            saveSketchesAndImagesOfAllAreas();
            writeXmlDataToFile();
        });
        
        $('#toggle-sketching').click(function () {
            _toggleStatus();
        });

        $('.addImageToStage').click(function () {
            addImageToStage(testImage);
        });

        $(DocumentManager).on("workingSetRemove", removeOverlay);

        $('.overlay').on("panelResizeEnd", function () {
            moveImageLayerToTop();
            moveToolsToTop();
        });
        
        $('body').delegate('#missionControl .controls a.add', 'click', function () {
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {
                $.each(files, function (key, image) {
                    missionControl.addImage(image);
                });
            }, function (err) {console.log(err); });
        });
        
        $('body').delegate('#missionControl', 'mousewheel', function (event) {
            
            missionControl.zoom(event);
        });
        
        $('body').delegate('#missionControl .controls a.edit', 'click', function () {
            missionControl.toggleEditMode();
        });
        
        $('body').delegate('#missionControl .controls a.zoomin', 'click', function () {
            missionControl.zoomIn();
        });
        
        $('body').delegate('#missionControl .controls a.zoomout', 'click', function () {
            missionControl.zoomOut();
        });

        $('body').delegate('.redraw', 'click', function () {
            console.log("redraw");
            _activeSketchingArea.stage = createStage('overlay-' + _activeSketchingArea.id, myPanel.width(), _activeSketchingArea.height, _activeSketchingArea.fullPath, _activeSketchingArea.filename);
            _activeSketchingArea.stage.draw();
        });
        /*
        $('body').delegate('.overlay .kineticjs-content', 'mousemove mousedown mouseup mouseleave hover', function (e) {
            e.preventDefault();
            _activeEditor.setSelection(_activeEditor.getCursorPos(), _activeEditor.getCursorPos());
            return false;
        });
        */
        $('body').delegate('.tools .button', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .button').removeClass('selected');
            $(this).addClass('selected');
        });
        $('body').delegate('.tools .eraser', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .color').removeClass('selected');
            $(this).addClass('selected');
        });

        $('body').delegate('.tools .color', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .edit').removeClass('selected');
            $('#tools-' + id + ' .eraser').removeClass('selected');
            $('#tools-' + id + ' .color').removeClass('selected');
            $(this).addClass('selected');
        });

        $('body').delegate('.tools .edit', 'click', function () {
            var magnets, groups;
            if ($(this).hasClass('selected')) {
                //deactivate edit mode
                _activeLayer = "image";
                myPanel.animate({ scrollTop: _activeEditor.getScrollPos().y }, 700);
                setTimeout(function () {
                    asyncScroll = false;
                }, 750);
                $(this).removeClass('selected');
                hideAnchors(_activeSketchingArea.stage);
                
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
                asyncScroll = true;
                $(this).addClass('selected');
                showAnchors(_activeSketchingArea.stage);
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

        $('body').delegate('.tools .size', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .size').removeClass('selected');
            $(this).addClass('selected');
        });

        $('body').delegate('.add-image', 'click', function () {
            var id = _activeSketchingArea.id;
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {
                _activeLayer = "edit";
                asyncScroll = true;
                showAnchors(_activeSketchingArea.stage);
                $('.tools .sketch-layer').removeClass('selected');
                var magnets = _activeStage.get(".magnet");
                $.each(magnets, function (key, magnet) {
                    magnet.setDraggable(true);
                });
                var groups = _activeStage.get(".group");
                $.each(groups, function (key, group) {
                    group.setDraggable(true);
                });
                insertFileToImageArea(files);
            }, function (err) {});
            //addImageToStage(testImage);
        });

        $('body').delegate('.image-layer', 'click', function () {
            moveImageLayerToTop();
        });
        $('body').delegate('.sketch-layer', 'click', function () {
            if (_activeLayer === "sketch") {
                $(this).removeClass('selected');
                moveImageLayerToTop();
                var id = _activeSketchingArea.id;
                $('#tools-' + id + ' .color').removeClass('selected');
            } else {
                $('.tools .edit').removeClass('selected');
                $(this).addClass('selected');
                hideAnchors(_activeSketchingArea.stage);
                moveSketchingAreaToTop();
                asyncScroll = false;
            }
            
        });
        
        /*$('body').delegate('.asyncScrolling', 'click', function () {
            // toggle status of asyncScroll
            if (asyncScroll) {
                asyncScroll = false;
                $(this).addClass('selected');
            } else {
                asyncScroll = true;
                $(this).removeClass('selected');
            }
        });
        */

    }
     
    function _toggleMissionControl() {
        missionControl.toggle();
    }
    
    function _addMenuItems() {
        var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        viewMenu.addMenuDivider();

        function registerCommandHandler(commandId, menuName, handler, shortcut) {
            CommandManager.register(menuName, commandId, handler);
            viewMenu.addMenuItem(commandId);
            KeyBindingManager.addBinding(commandId, shortcut);
        }

        registerCommandHandler("lukasspy.sketchmeister.toggleSketchmeister", "Enable Sketchmeister", _toggleStatus, "Ctrl-1");
        registerCommandHandler("lukasspy.sketchmeister.toggleMissionControl", "Enable MissionControl", _toggleMissionControl, "Alt-1");
    }

    AppInit.appReady(function () {
        
        readXmlFileData(function () {
            _addMenuItems();
            _addToolbarIcon();
            _addHandlers();
            _addMyPanel();
            missionControl = new MissionControl();
            missionControl.init();
            
            currentDocumentChanged(true);
            _toggleStatus();
            //initialization ... make stuff and hide everthing
        });
    });
});