/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage, addAnchor, showAnchors, hideAnchors */

define(function (require, exports, module) {
    "use strict";

    var xmlFilename = "sketchmeister.xml";
    

    require('js/jquery-ui-1.10.0.custom.min');
    require('js/runmode');
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
        console.log(canvas);
    }

    /*----- functions for kinetic drag/resize ------*/

    function moveToolsToTop() {
        $('.tools').css('z-index', '5');
    }

    function moveImageLayerToTop() {
        //Anchor einblenden
        showAnchors(_activeStage);
        $('.kineticjs-content').css('z-index', '5');
        $('.simple_sketch').css('z-index', '3');
        _activeLayer = "image";
    }

    function moveSketchingAreaToTop() {
        //Anchor ausblenden
        hideAnchors(_activeStage);
        $('.simple_sketch').css('z-index', '5');
        $('.kineticjs-content').css('z-index', '3');
        _activeLayer = "sketch";
    }

    function createStage(container, width, height) {
        var stage = new Kinetic.Stage({
            container: container,
            width: width,
            height: height
        });
        imageLayer = new Kinetic.Layer({
            id: 'images'
        });
        stage.add(imageLayer);
        return stage;
        //console.log('stage done: ' + stage + ' layer done: ' + imageLayer);
        //stage.setAbsolutePosition(widthOfEditorFull, 0);
    }
    
    function createStageForMissionControl(container, width, height) {
        return new Kinetic.Stage({
            container: container,
            width: width,
            height: height
        });
        //console.log('stage done: ' + stage + ' layer done: ' + imageLayer);
        //stage.setAbsolutePosition(widthOfEditorFull, 0);
    }

    function addImageToStage(imageToAdd) {
        var widthOfImage;
        var heightOfImage;
        var helpImage = new Image();

        $('<img src="' + imageToAdd + '" id="pups" class="visibility: hidden"/>').load(function () {
            $(this).appendTo('#sidebar');
            helpImage.src = $('#pups').attr('src');
            widthOfImage = helpImage.width;
            heightOfImage = helpImage.height;

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
                draggable: true
            });

            // new Image added to group
            var newImg = new Kinetic.Image({
                x: 0,
                y: 0,
                image: helpImage,
                width: widthResized,
                height: heightResized,
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
            _activeStage.draw();
            $('#pups').remove();
        });

    }
    
    

    /*----- functions for sketching area ------*/
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

    function _addSketchingTools(id) {
        $(_activeEditor.getScrollerElement()).append('<div class="tools" id="tools-' + id + '" style="height: ' + $(_activeEditor.getScrollerElement()).height() + 'px"></div>');
        $('#tools-' + id).append('<div class="seperator"></div>');
        //$('#tools-' + id).append("<a href='#' class='saveSketch button'>save</a> ");
        //$('#tools-' + id).append("<a href='#' class='loadSketch button'>load</a> ");
        //$('#tools-' + id).append("<a href='#' style='background: transparent' class='addImageToStage button'>add</a> ");
        //$('#tools-' + id).append("<a href='#' style='background: transparent' class='uploadDialog button'>Upl</a> ");
        //$('#tools-' + id).append("<input type='file' style='visibility:hidden;display:none' class='uploadButton'/>");

        $('#tools-' + id).append('<a href="#simple_sketch-' + id + '" data-undo="1" class="undo"></a>');
        $('#tools-' + id).append("<a href='#simple_sketch-" + id + "' data-clear='1' class='button'>clear</a> ");
       // $('#tools-' + id).append("<a href='#simple_sketch-" + id + "' data-save='save' class='button'>save</a> ");

        $('#tools-' + id).append('<div class="seperator">Image</div>');
        $('#tools-' + id).append("<a href='#' class='add-image button'>+</a> ");
        $('#tools-' + id).append("<a href='#' class='image-layer edit'>edit</a> ");


        $('#tools-' + id).append('<div class="seperator">Color</div>');
        var colors = {
            'black': '#000000',
            'grey': '#B2ADA1',
            'white': '#FFFFFF',
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
    
    function loadSketchingActionsFromXmlToSketchingArea() {
        var filename = DocumentManager.getCurrentDocument().file.name;
        var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
        var relativePath = _activeSketchingArea.fullPath.replace(fullProjectPath, "").replace(filename, "");
        var actions = getSketchingActionsForThisFileFromXml(filename, relativePath);
        _activeSketchingArea.sketchArea.actions = actions;
        //_activeSketchingArea.sketchArea.action = null;
        if (actions.length > 0) {
            _activeSketchingArea.sketchArea.redraw();
        }
    }

    function _addSketchingArea(path) {
        var id = _sketchingAreaIdCounter++;
        var height = $(_activeEditor.getScrollerElement()).height();
        var width = $(_activeEditor.getScrollerElement()).width();
        // breite von myPanel
        width = myPanel.width();
        var totalHeight = _activeEditor.totalHeight();

        $("#myPanel").append('<div class="overlay" id="overlay-' + id + '"><canvas class="simple_sketch" id="simple_sketch-' + id + '" width="' + width + '" height="' + totalHeight + '"></canvas></div>');

        //Resizer.makeResizable($("#overlay-" + id), "horz", "left", "10", 'true', 'false');

        $("#overlay-" + id).css('height', totalHeight + 'px');
        //$("#overlay-" + id).css('width', width + 'px');
        var sketchArea = $('#simple_sketch-' + id).sketch();

        _addSketchingTools(id);
        var stage = createStage('overlay-' + id, width, totalHeight);
        var sketchingArea = {
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
        $('#myPanel').scrollTop(scrollPos.y);
        //$('#overlay-' + _activeSketchingArea.id).scrollTop(scrollPos.y);
    }

    function currentDocumentChanged() {
        // set the current Full Editor as _activeEditor
        _activeEditor = EditorManager.getCurrentFullEditor();
        // if _activeEditor gets scrolled then also scroll the sketching overlay
        $(_activeEditor).on("scroll", _scroll);
        // set the current Document as _activeDocument to get additional data of the file
        _activeDocument = DocumentManager.getCurrentDocument();
        var _activeFullPath = DocumentManager.getCurrentDocument().file.fullPath;
        
        // go through all already opened sketchingAreas and check if opened file already has a sketchingArea
        var foundSketchingArea = -1;
        $.each(_documentSketchingAreas, function (key, sketchingArea) {
            sketchingArea.active = false;
            $('#overlay-' + sketchingArea.id).hide();
            if (sketchingArea.fullPath === _activeFullPath) {
                console.log(sketchingArea.fullPath + " and " + _activeFullPath);
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
            var key = _addSketchingArea(_activeFullPath);
            _activeSketchingArea = _documentSketchingAreas[key];
            // check which layer is on top to stay in sync with other already open sketching areas
            if (_activeLayer === "sketch") {
                moveSketchingAreaToTop();
            } else {
                moveImageLayerToTop();
            }
            //sketchingArea has been created and now the xml-file has to be checked if there are sketchingActions for that file
            console.log(_documentSketchingAreas);
            loadSketchingActionsFromXmlToSketchingArea();
        }
        // set the active stage by referencing the stage of the active sketchingArea
        _activeStage = _activeSketchingArea.stage;
        $('#overlay-' + _activeSketchingArea.id).show();
        
        
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

        var filename = DocumentManager.getCurrentDocument().file.name;
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
    }
    
    function saveSketchesAndImagesOfAllAreas() {
        $.each(_documentSketchingAreas, function (key, sketchingArea) {
            saveSketchesAndImages(sketchingArea);
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
        readXmlFileData(function () {
            saveSketchesAndImagesOfAllAreas();
            var fileEntry = new NativeFileSystem.FileEntry(ProjectManager.getProjectRoot().fullPath + xmlFilename);
            FileUtils.writeText(fileEntry, "<root>" + $xml.html() + "</root>").done(function () {
                console.log("Complete XML successfully updated");
            }).fail(function (err) {
                console.log("Error writing text: " + err.name);
            });
        });
    }

    function loadSketchesAndImages() {
        var canvas = $('#simple_sketch-' + _activeSketchingArea.id)[0];
        var ctx = canvas.getContext("2d");
        var fileEntry = new NativeFileSystem.FileEntry(ProjectManager.getProjectRoot().fullPath + "/bildchen.txt");
        FileUtils.readAsText(fileEntry).done(function (data, readTimestamp) {
            var image = new Image();
            image.src = data;
            image.onload = function () {
                ctx.drawImage(image, 0, 0);
            };
        }).fail(function (err) {
            console.log("Error reading text: " + err.name);
        });


    }
    
    function insertFileToImageArea(files) {
        $('.tools .layer').removeClass('selected');
        $('.tools .image-layer').addClass('selected');
        var i;
        for (i = 0; i < files.length; i++) {
            addImageToStage(files[i]);
        }

    }
    
    function hideMyPanel() {
        $('#editor-holder').css('margin-right', "0");
        myPanel.hide();
    }
    
    function showMyPanel() {
        $('#editor-holder').css('margin-right', myPanel.width());
        myPanel.show();
    }
    
    function setSizeOfMyPanel(space) {
        var windowsWidth = $('.content').width();
        console.log("width: " + $('.content').width());
        var widthOfMyPanel = (space > 0) ? (windowsWidth / space) : 0;
        $('#editor-holder').css('margin-right', widthOfMyPanel);
        myPanel.css("width", widthOfMyPanel);

    }
    
    function _addMyPanel() {
        setSizeOfMyPanel(3);
        myPanel.insertAfter($('.content'));
        hideMyPanel();
    }
    
    function _toggleStatus() {
        if (active) {
            _deactivate();
            saveAll();
            hideMyPanel();
        } else {
            if (firstActivation) {
                readXmlFileData(function () {
                    currentDocumentChanged();

                });
                firstActivation = false;
            }
            _activate();
            showMyPanel();

        }
        //Resizer.toggle(myPanel);
    }
    
    function MissionControl() {
        this.overlay = $('<div id="missionControl"><div class="controls"><a href="#" class="add"></a></div></div>');
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
    
    MissionControl.prototype.toggle = function () {
        if (this.active) {
            this.active = false;
            this.overlay.fadeOut("fast");
        } else {
            this.active = true;
            this.overlay.fadeIn("fast");
        }
    };
    
    MissionControl.prototype.addImage = function (imageToAdd) {
        var widthOfImage;
        var heightOfImage;
        var helpImage = new Image();
        var thisMissionControl = this;
        var imageElement = $('<img src="' + imageToAdd + '" id="pups" class="visibility: hidden"/>');
        
        imageElement.load(function () {
            console.log(this);
            imageElement.appendTo('#sidebar');
            helpImage.src = $('#pups').attr('src');
            console.log(helpImage.width);
            widthOfImage = helpImage.width;
            heightOfImage = helpImage.height;
            
            var widthResized = ($(window).width() * 0.7);
            var heightResized = (widthResized / widthOfImage) * heightOfImage;
            console.log(widthOfImage + " " + heightOfImage + " " + widthResized + " " + heightResized);
            if (widthResized > widthOfImage) {
                widthResized = widthOfImage;
                heightResized = heightOfImage;
            }
            var imageGroup = new Kinetic.Group({
                x: 40,
                y: 40,
                draggable: true
            });

            // new Image added to group
            var newImg = new Kinetic.Image({
                x: 0,
                y: 0,
                image: helpImage,
                width: widthResized,
                height: heightResized,
                name: 'image'
            });

            imageGroup.add(newImg);
            thisMissionControl.imageLayering.add(imageGroup);

            addAnchor(imageGroup, 0, 0, 'topLeft');
            addAnchor(imageGroup, widthResized, 0, 'topRight');
            addAnchor(imageGroup, widthResized, heightResized, 'bottomRight');
            addAnchor(imageGroup, 0, heightResized, 'bottomLeft');

            /*imageGroup.on('dragstart', function () {
                imageElement.moveToTop();
            });*/
            
            $('#pups').remove();
            thisMissionControl.stage.draw();
        });

    };
    
    function _toggleMissionControl() {
        missionControl.toggle();
    }
    
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
    
    

    function _addHandlers() {
        $(DocumentManager).on("currentDocumentChange", function () {
            if (!firstActivation) {
                if (!_projectClosed) {
                    console.log('document switch');
                    currentDocumentChanged();
                    _projectClosed = false;
                    console.log("callback funzt");
                }
                if (active) {
                    saveAll();
                }
                console.log("change made");
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
                setSizeOfMyPanel(3);
            } else {
                setSizeOfMyPanel(0);
            }
        });
        
        $(EditorManager).on("activeEditorChange", function () {
            if (active) {
                setSizeOfMyPanel(3);
            } else {
                setSizeOfMyPanel(0);
            }
        });
        
        $(DocumentManager).on("documentSaved", save);

        $('#toggle-sketching').click(function () {
            _toggleStatus();
        });

        $('.addImageToStage').click(function () {
            addImageToStage(testImage);
        });
        //$(DocumentManager).on("workingSetAdd", addOverlay);
        $(DocumentManager).on("workingSetRemove", removeOverlay);

        $('.overlay').on("panelResizeEnd", function () {
            moveImageLayerToTop();
            moveToolsToTop();
        });
        
        $('body').delegate('#missionControl .controls a.add', 'click', function () {
            console.log("add button pushed");
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {
                $.each(files, function (key, image) {
                    console.log(image);
                    missionControl.addImage(image);
                });
            }, function (err) {console.log(err); });
            //addImageToStage(testImage);
        });

        $('body').delegate('.saveSketch', 'click', function () {
            save();
        });

        $('body').delegate('.loadSketch', 'click', function () {
            loadSketchesAndImages();
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
    
    

    AppInit.appReady(function () {
        
        _addMenuItems();
        _addToolbarIcon();
        _addHandlers();
        _addMyPanel();
        missionControl = new MissionControl();
        missionControl.init();
        console.log(missionControl.overlay);
        
        var imageToAdd = {
            newImage: testImage
        };
        
        //Resizer.makeResizable(myPanel, "horz", "right", "200");
        
        //EditorManager.resizeEditor();
        

        /*$('.gallery').click(function () {
            //Dialogs.showModalDialog("add-image-dialog");
            //NativeFileSystem.requestNativeFileSystem(true, function (success) {}, function (err) {});
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {insertFileToImageArea(files); }, function (err) {});
            
            
            var len = files.length;
            var file;
            for (var i = 0; i<len ; i++) {
                file = files[i];
                $('.dropbox-file-rows').append(
                    '<tr data-path=' + file.path + (file.isFolder ? ' class="folder-row"' : '') + '><td class="file-icon">' +
                    '<img src="' + moduleDir + '/img/' +  (file.isFile ? "file" : "folder" ) + '.png"/> ' +
                    "</td><td>" +
                    file.name +
                    "</td><td>" +
                    file.humanSize +
                    "</td><td>" +
                    file.modifiedAt +
                    '</td></tr>');
            }
            //Resizer.toggle(myPanel);
            //$('.gallery').load('//www.spy-web.de/gallery.php');
            //$('.gallery-container').load('http://www.spy-web.de/sketch/gallery.php');
        });*/


        //loadImages(sources, initStage);
    });
});