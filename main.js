/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage, addAnchor, showAnchors, hideAnchors */

define(function (require, exports, module) {
    "use strict";

    require('js/jquery-ui-1.10.0.custom.min');
    require('js/runmode');
    require('js/sketch');
    require('js/kinetic-v4.3.1');
    require('js/kinetic-functions');

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

    var loadCSSPromise = ExtensionUtils.loadStyleSheet(module, 'css/main.css');
    var active = false;
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

    function createStage(id, width, height) {
        var stage = new Kinetic.Stage({
            container: 'overlay-' + id,
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
                y: visualPos.y + 40,
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
        $(".overlay").hide();
        $(".tools").hide();
        /*      $(".overlay").hide("slide", {
            direction: "right",
            easing: 'easeOutCirc'
        }, 400);
        $(".tools").hide("slide", {
            direction: "right",
            easing: 'easeOutCirc'
        }, 400);
*/
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
        active = false;

    }

    function _activate() {
        $(".overlay").show();
        $(".tools").show();
        /*      $(".overlay").show("slide", {
            direction: "right",
            easing: 'easeOutCirc'
        }, 400);
        $(".tools").show("slide", {
            direction: "right",
            easing: 'easeOutCirc'
        }, 400);
*/
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconActive + '")');
        active = true;
    }

    function _addSketchingTools(id) {
        $(_activeEditor.getScrollerElement()).append('<div class="tools" id="tools-' + id + '" style="height: ' + $(_activeEditor.getScrollerElement()).height() + 'px"></div>');
        $('#tools-' + id).append('<div class="seperator"></div>');
        $('#tools-' + id).append("<a href='#' class='saveSketch button'>save</a> ");
        $('#tools-' + id).append("<a href='#' class='loadSketch button'>load</a> ");
        //$('#tools-' + id).append("<a href='#' style='background: transparent' class='addImageToStage button'>add</a> ");
        //$('#tools-' + id).append("<a href='#' style='background: transparent' class='uploadDialog button'>Upl</a> ");
        //$('#tools-' + id).append("<input type='file' style='visibility:hidden;display:none' class='uploadButton'/>");
        $('#tools-' + id).append("<a href='#' class='add-image button'>+</a> ");
        $('#tools-' + id).append("<a href='#' class='undo button' href='#simple_sketch-" + id + "' data-tool='undo'>undo</a> ");

        $('#tools-' + id).append('<div class="seperator">Layer</div>');
        if (_activeLayer === "sketch") {
            $('#tools-' + id).append("<a href='#' class='image-layer layer'>image</a> ");
            $('#tools-' + id).append("<a href='#' class='sketching-layer layer selected'>sketch</a> ");
        } else {
            $('#tools-' + id).append("<a href='#' class='image-layer layer selected'>image</a> ");
            $('#tools-' + id).append("<a href='#' class='sketching-layer layer'>sketch</a> ");
        }
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

    function _addSketchingArea(path) {
        var id = _sketchingAreaIdCounter++;
        var height = $(_activeEditor.getScrollerElement()).height();
        var width = $(_activeEditor.getScrollerElement()).width();
        var totalHeight = _activeEditor.totalHeight(true);

        $(_activeEditor.getScrollerElement()).append('<div class="overlay" id="overlay-' + id + '"><canvas class="simple_sketch" id="simple_sketch-' + id + '" width="' + width + '" height="' + totalHeight + '"></canvas></div>');

        //Resizer.makeResizable($("#overlay-" + id), "horz", "left", "10", 'true', 'false');

        $("#overlay-" + id).css('height', height + 'px');
        $("#overlay-" + id).css('width', width + 'px');
        $('#simple_sketch-' + id).sketch();

        _addSketchingTools(id);
        var stage = createStage(id, width, totalHeight);

        var sketchingArea = {
            'fullPath': path,
            'id': id,
            'active': true,
            'width': width,
            'height': totalHeight,
            'stage': stage
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
        $('#overlay-' + _activeSketchingArea.id).scrollTop(scrollPos.y);
    }

    function currentDocumentChanged() {
        _activeEditor = EditorManager.getCurrentFullEditor();
        $(_activeEditor).on("scroll", _scroll);
        _activeDocument = DocumentManager.getCurrentDocument();
        //console.log(_activeDocument);
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
            if (_activeLayer === "sketch") {
                moveSketchingAreaToTop();
            } else {
                moveImageLayerToTop();
            }

        }
        _activeStage = _activeSketchingArea.stage;

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
        var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        viewMenu.addMenuDivider();

        function registerCommandHandler(commandId, menuName, handler, shortcut) {
            CommandManager.register(menuName, commandId, handler);
            viewMenu.addMenuItem(commandId);
            KeyBindingManager.addBinding(commandId, shortcut);
        }

        registerCommandHandler("lukasspy.sketchmeister.toggleActivation", "Enable Sketchmeister", _toggleStatus, "Ctrl-1");
    }

    function saveSketchesAndImages() {
        var canvas = $('#simple_sketch-' + _activeSketchingArea.id)[0];
        var img = canvas.toDataURL("image/png");
        var fileEntry = new NativeFileSystem.FileEntry(FileUtils.getNativeModuleDirectoryPath(module) + "/bildchen.txt");
        FileUtils.writeText(fileEntry, img).done(function () {
            console.log("Text successfully updated");
        }).fail(function (err) {
            console.log("Error writing text: " + err.name);
        });

    }
    
    function loadSketchesAndImages() {
        var canvas = $('#simple_sketch-' + _activeSketchingArea.id)[0];
        var ctx = canvas.getContext("2d");
        var fileEntry = new NativeFileSystem.FileEntry(FileUtils.getNativeModuleDirectoryPath(module) + "/bildchen.txt");
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

    function _addHandlers() {
        $(DocumentManager).on("currentDocumentChange", currentDocumentChanged);

        $(DocumentManager).on("documentSaved", saveSketchesAndImages);

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

    }

    function initSketchingAreas() {
        currentDocumentChanged(); // Load up the currently open document, set all the variables such as editor which the Handlers need
        $(".overlay").hide();
        $(".tools").hide();
        $('#toggle-sketching').css('background-image', 'url("' + sketchIconDeactive + '")');
        active = false;
        //$('body').append($(Mustache.render(addImageDialog)));
    }

    var myPanel = $('<div id="foo" class="sidebar">' +
    //                     '<div >' +
    //                     '<div class="title">Gallery</div></div>' +
    //                     '<div class="table-container"><div class="gallery"></div></div>' +
                    '</div>');

    function insertFileToImageArea(files) {
        $('.tools .layer').removeClass('selected');
        $('.tools .image-layer').addClass('selected');
        var i;
        for (i = 0; i < files.length; i++) {
            addImageToStage(files[i]);
        }

    }

    AppInit.appReady(function () {
        _addMenuItems();
        _addToolbarIcon();
        _addHandlers();
        initSketchingAreas();
        var imageToAdd = {
            newImage: testImage
        };

        $('body').delegate('.saveSketch', 'click', function () {
            saveSketchesAndImages();
        });
        
        $('body').delegate('.loadSketch', 'click', function () {
            loadSketchesAndImages();
        });
        
        $('body').delegate('.kineticjs-content', 'mousemove mousedown mouseup mouseleave hover', function (e) {
            e.preventDefault();
            _activeEditor.setSelection(_activeEditor.getCursorPos(), _activeEditor.getCursorPos());
            return false;
        });


        //myPanel.insertAfter("#sidebar");
        //Resizer.makeResizable(myPanel, "horz", "right", 50, false, false);
        //Resizer.hide(myPanel);

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
            $('#tools-' + id + ' .eraser').removeClass('selected');
            $('#tools-' + id + ' .color').removeClass('selected');
            $(this).addClass('selected');
        });

        $('body').delegate('.tools .layer', 'click', function () {
            $('.tools .layer').removeClass('selected');
            $(this).removeClass('layer');
            var layer = $(this).attr('class');
            $(this).addClass('layer');
            $('.tools .' + layer).addClass('selected');
        });

        $('body').delegate('.tools .size', 'click', function () {
            var id = _activeSketchingArea.id;
            $('#tools-' + id + ' .size').removeClass('selected');
            $(this).addClass('selected');
        });

        $('body').delegate('.add-image', 'click', function () {
            var id = _activeSketchingArea.id;
            NativeFileSystem.showOpenDialog(true, false, "Choose a file...", null, ['png', 'jpg', 'gif', 'jpeg'], function (files) {
                insertFileToImageArea(files, id);
            }, function (err) {});
            //addImageToStage(testImage);
        });
        $('.saveSketch').click(function () {
            //sketchGetURL();
        });
        $('body').delegate('.image-layer', 'click', function () {
            moveImageLayerToTop();
        });
        $('body').delegate('.sketching-layer', 'click', function () {
            moveSketchingAreaToTop();
        });

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

        $('.uploadDialog').click(function () {
            Resizer.toggle(myPanel);
            //$('input[type=file].uploadButton').click();
        });
        //loadImages(sources, initStage);
    });
});