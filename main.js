/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage, addAnchor, showAnchors, hideAnchors */

define(function (require, exports, module) {
    "use strict";

    var xmlFilename = "sketchmeister.xml";
    var panelSize = 2;
    

    //require('js/jquery-ui-1.10.0.custom.min');
    //require('js/runmode');
    require('js/sketch');
    require('js/json2');
    require('js/kinetic-v4.3.1');
    require('js/kinetic-functions');

    var myPanel = $('<div id="myPanel"></div>');
    var missionControl;
    var addImageDialog = require("text!html/dialog.html");

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
        EditorUtils = brackets.getModule("editor/EditorUtils"),
        Menus = brackets.getModule("command/Menus"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
        Dialogs = brackets.getModule("widgets/Dialogs");

    var _sketchingAreaIdCounter = 0;
    var xmlData, $xml;
    var loadCSSPromise = ExtensionUtils.loadStyleSheet(module, 'css/main.css');
    var active = false;
    var firstActivation = true;
    var sketchIconActive = require.toUrl('./img/sketch_button_on.png');
    var sketchIconDeactive = require.toUrl('./img/sketch_button_off.png');
    var testImage = require.toUrl('./img/test.png');

    var _activeEditor = null;
    var _activeDocument = null;
    var _documentSketchingAreas = [];
    var _activeSketchingArea = null;
    var _activeStage;
    var _activeLayer = "sketch";
    var imageLayer;
    var _codeMirror = null;
    var _projectClosed = false;

    var allPaintingActions = [];

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
        showAnchors(_activeSketchingArea.stage);
        $('.kineticjs-content').css('z-index', '5');
        $('.simple_sketch').css('z-index', '3');
        _activeLayer = "image";
    }

    function moveSketchingAreaToTop() {
        //Anchor ausblenden
        hideAnchors(_activeSketchingArea.stage);
        $('.simple_sketch').css('z-index', '5');
        $('.kineticjs-content').css('z-index', '3');
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
            stage.setWidth(myPanel.width());
            stage.setHeight(myPanel.height());
            var groups = stage.get(".group");
            
            var images = stage.get(".image");
            $.each(images, function (key, image) {
                
                var tempImage = new Image();
                tempImage.src = image.attrs.src;
                var width = image.attrs.width;
                var height = image.attrs.height;
                $('<img src="' + image.attrs.src + '" id="tempImage" class="visibility: hidden"/>').load(function () {
                    
                    var group = groups[key];
                    group.get(".topLeft")[0].destroy();
                    group.get(".topRight")[0].destroy();
                    group.get(".bottomLeft")[0].destroy();
                    group.get(".bottomRight")[0].destroy();
                    
                    addAnchor(group, 0, 0, 'topLeft');
                    addAnchor(group, width, 0, 'topRight');
                    addAnchor(group, width, height, 'bottomRight');
                    addAnchor(group, 0, height, 'bottomLeft');
                    hideAnchors(stage);
                    
                    image.setImage(tempImage);
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
            var groups = stage.get(".group");
            
            var images = stage.get(".image");
            $.each(images, function (key, image) {
                
                var tempImage = new Image();
                tempImage.src = image.attrs.src;
                var width = image.attrs.width;
                var height = image.attrs.height;
                $('<img src="' + image.attrs.src + '" id="tempImage" class="visibility: hidden"/>').load(function () {
                    
                    var group = groups[key];
                    group.get(".topLeft")[0].destroy();
                    group.get(".topRight")[0].destroy();
                    group.get(".bottomLeft")[0].destroy();
                    group.get(".bottomRight")[0].destroy();
                    
                    addAnchor(group, 0, 0, 'topLeft');
                    addAnchor(group, width, 0, 'topRight');
                    addAnchor(group, width, height, 'bottomRight');
                    addAnchor(group, 0, height, 'bottomLeft');
                    
                    image.setImage(tempImage);
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
            var widthResized = (_activeSketchingArea.width * 0.7);
            var heightResized = (_activeSketchingArea.width * 0.7) / widthOfImage * heightOfImage;
            if (widthResized > widthOfImage) {
                widthResized = widthOfImage;
                heightResized = heightOfImage;
            }
            var visualPos = _activeEditor.getScrollPos();
            var imageGroup = new Kinetic.Group({
                x: visualPos.x + 40,
                y: visualPos.y + 70,
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

            imageGroup.add(newImg);
            var thisImageLayer = _activeSketchingArea.stage.getChildren()[0];
            thisImageLayer.add(imageGroup);

            addAnchor(imageGroup, 0, 0, 'topLeft');
            addAnchor(imageGroup, widthResized, 0, 'topRight');
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
        $('#tools-' + id).append('<a href="#simple_sketch-' + id + '" data-undo="1" class="undo"></a>');
        $('#tools-' + id).append("<a href='#simple_sketch-" + id + "' data-clear='1' class='button'>clear</a> ");

        $('#tools-' + id).append('<div class="seperator">Image</div>');
        $('#tools-' + id).append("<a href='#' class='add-image button'>+</a> ");
        $('#tools-' + id).append("<a href='#' class='image-layer edit'>edit</a> ");


        $('#tools-' + id).append('<div class="seperator">Color</div>');
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
                $('#tools-' + id).append("<a class='color " + key + " selected' href='#simple_sketch-" + id + "' data-tool='marker' data-color='" + value + "' style='background: " + value + ";'></a> ");
            } else {
                $('#tools-' + id).append("<a class='color " + key + "' href='#simple_sketch-" + id + "' data-tool='marker' data-color='" + value + "' style='background: " + value + ";'></a> ");
            }
        });
        $('#tools-' + id).append('<a class="eraser" href="#simple_sketch-' + id + '" data-tool="eraser"></a>');
        $('#tools-' + id).append('<div class="seperator">Size</div>');
        var sizes = {
            'small': 5,
            'medium': 10,
            'large': 15
        };
        $.each(sizes, function (key, value) {
            if (key === "small") {
                $('#tools-' + id).append("<a class='size " + key + " selected' href='#simple_sketch-" + id + "' data-size='" + (value - 3) + "'>" + value + "</a> ");

            } else {
                $('#tools-' + id).append("<a class='size " + key + "' href='#simple_sketch-" + id + "' data-size='" + (value - 3) + "'>" + value + "</a> ");
            }
        });
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
        var totalHeight = _activeEditor.totalHeight();

        $("#myPanel").append('<div class="overlay" id="overlay-' + id + '"><canvas class="simple_sketch" id="simple_sketch-' + id + '" width="' + width + '" height="' + totalHeight + '"></canvas></div>');

        $("#overlay-" + id).css('height', totalHeight + 'px');
        var sketchArea = $('#simple_sketch-' + id).sketch();

        _addSketchingTools(id);
        var stage = createStage('overlay-' + id, width, totalHeight, path, filename);
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

    function _scroll() {
        var scrollPos = _activeEditor.getScrollPos();
        $('#myPanel').scrollTop(scrollPos.y);
    }
    
    function _scrollEditor() {
        var scrollPos = $('#myPanel').scrollTop();
        _activeEditor.setScrollPos(_activeEditor.getScrollPos().x, scrollPos);
    }

    function currentDocumentChanged() {
        // set the current Full Editor as _activeEditor
        _activeEditor = EditorManager.getCurrentFullEditor();
        // if _activeEditor gets scrolled then also scroll the sketching overlay
        $(_activeEditor).on("scroll", _scroll);
                
        myPanel.on("scroll", _scrollEditor);
        // set the current Document as _activeDocument to get additional data of the file
        _activeDocument = DocumentManager.getCurrentDocument();
        var _activeFullPath = DocumentManager.getCurrentDocument().file.fullPath;
        var _activeFilename = DocumentManager.getCurrentDocument().file.name;
        // go through all already opened sketchingAreas and check if opened file already has a sketchingArea
        var foundSketchingArea = -1;
        $.each(_documentSketchingAreas, function (key, sketchingArea) {
            sketchingArea.active = false;
            if (active) {
                $('#overlay-' + sketchingArea.id).hide();
            }
            if (sketchingArea.fullPath === _activeFullPath) {
                foundSketchingArea = key;
            }
        });
        // if sketchingArea is already loaded set it as active, else create a new sketchingArea and add it to Array of sketchingAreas
        if (foundSketchingArea !== -1) {
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
        // set the active stage by referencing the stage of the active sketchingArea
        _activeStage = _activeSketchingArea.stage;

        if (active) {
            $('#overlay-' + _activeSketchingArea.id).show();
        }
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
    
    function MissionControl() {
        this.overlay = $('<div id="missionControl"><div class="left controls"><a href="#" class="add"></div><div class="right controls"><a href="#" class="zoomin"></a><a href="#" class="zoomout"></a></div></div>');
        this.active = false;
        this.stage = null;
        this.imageLayering = null;
    }
    
    MissionControl.prototype.init = function () {
        this.overlay.appendTo("body");
        this.stage = createStageForMissionControl("missionControl", $("body").width(), $("body").height());
        this.imageLayering = new Kinetic.Layer({id: 'images'});
        this.stage.add(this.imageLayering);
        $('#missionControl .kineticjs-content').css('z-index', '21');
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
            this.overlay.fadeOut("fast");
            saveMissionControl();
            writeXmlDataToFile();
        } else {
            this.active = true;
            this.overlay.fadeIn("fast");
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
    
            imageGroup.add(newImg);
            thisMissionControl.imageLayering.add(imageGroup);
    
            addAnchor(imageGroup, 0, 0, 'topLeft');
            addAnchor(imageGroup, widthResized, 0, 'topRight');
            addAnchor(imageGroup, widthResized, heightResized, 'bottomRight');
            addAnchor(imageGroup, 0, heightResized, 'bottomLeft');
            
            $('#tempImage').remove();
            thisMissionControl.stage.draw();
        });
    
    };
    
    function resetAllVariables() {
        _sketchingAreaIdCounter = 0;
        xmlData = "";
        $xml = "";
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
    }
    
    function _addMyPanel() {
        myPanel.insertAfter($('.content'));
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
            currentDocumentChanged();
            myPanel.find("canvas").width(myPanel.width());
            _activeSketchingArea.sketchArea.redraw();
            showMyPanel();
        }
        //Resizer.toggle(myPanel);
    }

    function _addHandlers() {
        $(DocumentManager).on("currentDocumentChange", function () {
            currentDocumentChanged();
            if (active) {
                saveAll();
            }
        });
        
        $(ProjectManager).on("projectOpen", function () {
            resetAllVariables();
        });
        $(ProjectManager).on("beforeProjectClose", function () {
            _projectClosed = true;
            //save();
            
        });
        
        $(window).resize(function () {
            if (active) {
                setSizeOfMyPanel(panelSize);
                /*
                $.each(_documentSketchingAreas, function (key, sketchingArea) {
                    sketchingArea.width = myPanel.width();
                    sketchingArea.height = myPanel.height();
                    sketchingArea.stage.setWidth(myPanel.width());
                    sketchingArea.stage.setHeight(myPanel.height());
                });
                $(".overlay").width(myPanel.width());
                $(".overlay").height(myPanel.height());
                */
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
        
        $('body').delegate('#missionControl .controls a.zoomin', 'click', function () {
            missionControl.zoomIn();
        });
        
        $('body').delegate('#missionControl .controls a.zoomout', 'click', function () {
            missionControl.zoomOut();
        });

        $('body').delegate('.saveSketch', 'click', function () {
            save();
        });

        $('body').delegate('.overlay .kineticjs-content', 'mousemove mousedown mouseup mouseleave hover', function (e) {
            e.preventDefault();
            _activeEditor.setSelection(_activeEditor.getCursorPos(), _activeEditor.getCursorPos());
            return false;
        });
        
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
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .color').removeClass('selected');
            $(this).addClass('selected');
        });

        $('body').delegate('.tools .size', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .size').removeClass('selected');
            $(this).addClass('selected');
        });

        $('body').delegate('.add-image', 'click', function () {
            var id = _activeSketchingArea.id;
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {
                insertFileToImageArea(files);
            }, function (err) {});
            //addImageToStage(testImage);
        });

        $('body').delegate('.image-layer', 'click', function () {
            moveImageLayerToTop();
        });
        $('body').delegate('.color, .size', 'click', function () {
            moveSketchingAreaToTop();
        });

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
        });
    });
});