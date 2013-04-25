/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage, asyncScroll, _activeLayer, activeMarker, allAnchors, missionControl */
var DocumentManager = brackets.getModule("document/DocumentManager"),
    EditorManager = brackets.getModule("editor/EditorManager");
var sketchIconActive = require.toUrl('./sketch_button_on.png');
var sketchIconDeactive = require.toUrl('./sketch_button_off.png');

var allMissionControlAnchors = [];
var colors = ['#15863C', '#6AC7F3', '#639A4B', '#BE6FBE', '#FBEC44', '#F8B015', '#F0ADA9', '#AA4F17', '#FE6208', '#495CC9', '#F01F1C'];
var _activeColor = 0;
var allAnchors = [];
var activeHoverMarker = [];

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
    if (width && height) {
        image.setSize(width, height);
    }
}

function updateMagnets(activeAnchor, oldX, oldY) {
    //console.log("oldX: " + oldX + " oldY: " + oldY);
    var anchorX = activeAnchor.getX();
    var anchorY = activeAnchor.getY();
    var group = activeAnchor.getParent();
    var magnets = group.get('.magnet');
    var ratioX = anchorX / oldX;
    var ratioY = anchorY / oldY;
    //console.log("ratioX: " + ratioX + " ratioY: " + ratioY);
    $.each(magnets, function (key, magnet) {
        magnet.setX(magnet.getX() * ratioX);
        magnet.setY(magnet.getY() * ratioY);
    });
}

function showAnchors(stage) {
    if (allAnchors.length) {
        $.each(allAnchors, function (index, value) {
            value.show();
        });
        stage.draw();
    }
}

function hideAnchors(stage) {
    if (allAnchors.length) {
        $.each(allAnchors, function (index, value) {
            value.hide();
        });
        stage.draw();
    }
}

function showMagnets(group) {
    var magnets = group.get('.magnet');
    if (magnets.length) {
        $.each(magnets, function (index, magnet) {
            magnet.show();
        });
        group.getLayer().draw();
    }
}

function hideMagnets(group) {
    var magnets = group.get('.magnet');
    if (magnets.length) {
        $.each(magnets, function (index, magnet) {
            magnet.hide();
        });
        group.getLayer().draw();
    }
}

function addMissionControlMarker(connection, id) {
    //EditorManager.getCurrentFullEditor()._codeMirror.addLineClass(connection.start.line, 'text', 'linkedLine');
    EditorManager.getCurrentFullEditor()._codeMirror.options.gutters.push("magnet-" + id);
    if (connection.start.line > 0 && connection.end.line > 0) {
        var lines = connection.end.line - connection.start.line;
        var i;
        for (i = 0; i <= lines; i++) {
            var line = connection.start.line + i;
            var element = document.createElement('div');
            element.className = "CodeMirror-linkedMissionControlLines magnet-" + id;
            element.name = id;
            //element.id = "magnet-" + id;
            EditorManager.getCurrentFullEditor()._codeMirror.setGutterMarker(line, "magnet-" + id, element);
            //console.log(EditorManager.getCurrentFullEditor()._codeMirror.lineInfo(line));
        }
    }
}

function addMarker(connection, id) {
    //EditorManager.getCurrentFullEditor()._codeMirror.addLineClass(connection.start.line, 'text', 'linkedLine');
    EditorManager.getCurrentFullEditor()._codeMirror.options.gutters.push("magnet-" + id);
    var lines = connection.end.line - connection.start.line;
    var i;
    for (i = 0; i <= lines; i++) {
        var line = connection.start.line + i;
        var element = document.createElement('div');
        element.className = "CodeMirror-linkedLines magnet-" + id;
        element.name = id;
        //element.id = "magnet-" + id;
        EditorManager.getCurrentFullEditor()._codeMirror.setGutterMarker(line, "magnet-" + id, element);
        //console.log(EditorManager.getCurrentFullEditor()._codeMirror.lineInfo(line));
    }
}

function removeMarker(id) {
    EditorManager.getCurrentFullEditor()._codeMirror.clearGutter("magnet-" + id);
}


function unhighlightMissionControl(magnet) {
    
    var fillColor = 'rgba(145, 161, 112,0.5)';
    var strokeColor = 'rgba(145, 161, 112,1.0)';
    var JSONconnection = JSON.parse(magnet.attrs.connection);
    if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
        strokeColor = 'rgba(85, 50, 133, 1)';
        fillColor = 'rgba(85, 50, 133, 0.5)';
    } else {
        magnet.setStrokeWidth(1);
        magnet.setFill(fillColor);
        magnet.setStroke(strokeColor);
        magnet.transitionTo({
            scale: {x: 1.0,
                   y: 1.0},
            duration: 0.2
        });
    }
}

function unhighlightMissionControlFile(magnet) {
    var JSONconnection = JSON.parse(magnet.attrs.connection);
    if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
        var strokeColor = 'rgba(85, 50, 133, 1)';
        var fillColor = 'rgba(85, 50, 133, 0.5)';
        magnet.setStrokeWidth(1);
        magnet.setFill(fillColor);
        magnet.setStroke(strokeColor);
        magnet.transitionTo({
            scale: {x: 1.0,
                   y: 1.0},
            duration: 0.2
        });
    }
}

function highlightMissionControl(magnet, allMagnets) {
    $.each(allMagnets, function (key, eachmagnet) {
        unhighlightMissionControl(eachmagnet);
        if (eachmagnet._id !== magnet._id) {
            eachmagnet.clicked = false;
            $(".magnet-" + eachmagnet._id).removeClass('selectionLinkFromMissionControl');
            if (activeMarker[eachmagnet._id]) {
                activeMarker[eachmagnet._id].clear();
                delete (activeMarker[magnet._id]);
            }
        }
    });
    magnet.setStrokeWidth(2);
    //magnet.setFill('rgba(85, 50, 133, 0.9)');
    //magnet.setStroke('rgba(85, 50, 133, 1.0)');
    magnet.transitionTo({
        scale: {x: 1.8,
               y: 1.8},
        duration: 0.2
    });
}

function highlightMissionControlFile(magnet) {
    magnet.setStrokeWidth(2);
    magnet.setFill('rgba(85, 50, 133, 0.7)');
    magnet.setStroke('rgba(85, 50, 133, 1.0)');
    magnet.transitionTo({
        scale: {x: 1.8,
               y: 1.8},
        duration: 0.2
    });
}


function highlight(magnet) {
    magnet.setStrokeWidth(2);
    magnet.setFill('rgba(80, 103, 142, 0.8)');
    magnet.setStroke('rgba(80, 103, 142, 1.0)');
    magnet.transitionTo({
        scale: {x: 1.8,
               y: 1.8},
        duration: 0.2
    });
}

function unhighlight(magnet) {
    magnet.setStrokeWidth(1);
    //magnet.setFill('rgba(251,167,13,0.5)');
    //magnet.setStroke('rgba(251,167,13,1.0)');
    magnet.transitionTo({
        scale: {x: 1.0,
               y: 1.0},
        duration: 0.2
    });
}

function addListenersToMagnet(magnet, group) {
    var position = null;
    var selection = null;
    var marker = null;
    var offscreenLocation = null;
    var deleted = false;
    magnet.on('mousedown', function () {
        group.setDraggable(false);
        asyncScroll = true;
    });

    magnet.on('mouseup', function (e) {
        if (e.which === 3) {
         // right mousebutton: delete the magnet
            if ($('.tools .edit').hasClass('selected')) {
                if (confirm("Connection will be deleted")) {
                    deleted = true;
                    removeMarker(this._id);
                    $('#hightlightTop').remove();
                    $('#hightlightBottom').remove();
                    activeMarker[this._id].clear();
                    delete (activeMarker[this._id]);
                    this.destroy();
                    group.getLayer().draw();
                }
            }
        } else {
         // left mousebutton
            var connection = JSON.parse(this.attrs.connection);
            
            
            if (!this.clicked) {
                if (offscreenLocation) {
                    asyncScroll = true;
                    var lineHeight = EditorManager.getCurrentFullEditor()._codeMirror.defaultTextHeight();
                    var editorHeight = $(EditorManager.getCurrentFullEditor().getScrollerElement()).height();
                    var pos;
                    if (offscreenLocation === 'top') {
                        pos = connection.start.line * lineHeight;
                        $(EditorManager.getCurrentFullEditor().getScrollerElement()).animate({ scrollTop: pos }, 700);
                        
                        $('#hightlightTop').remove();
                    } else if (offscreenLocation === 'bottom') {
                        pos = connection.end.line * lineHeight;
                        $(EditorManager.getCurrentFullEditor().getScrollerElement()).animate({ scrollTop: pos - editorHeight + 3 * lineHeight }, 700);
                        $('#hightlightBottom').remove();
                    }
                    selection = connection;
                } else {
                    asyncScroll = false;
                }
                
                $(".magnet-" + this._id).addClass("selectionLink");
                activeHoverMarker[this._id].clear();
                activeMarker[this._id] = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                highlight(this);
                this.clicked = true;
            } else {
                $(".magnet-" + this._id).removeClass("selectionLink");
                activeMarker[this._id].clear();
                activeHoverMarker[this._id] = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink2'});
                unhighlight(this);
                this.clicked = false;
                asyncScroll = true;
                $(EditorManager.getCurrentFullEditor().getScrollerElement()).animate({ scrollTop: $("#myPanel").scrollTop() }, 700);
                setTimeout(function () {
                    asyncScroll = false;
                }, 750);
            }
            
            
        }
    });

    magnet.on('mouseover', function () {
        // get the y-scroll position of editor and divide by line-height to get firstVisibleLine
        var scrollPos = EditorManager.getCurrentFullEditor().getScrollPos();
        var lineHeight = EditorManager.getCurrentFullEditor()._codeMirror.defaultTextHeight();
        var firstVisibleLine = Math.ceil(scrollPos.y / lineHeight) - 1;
        var editorHeight = $(EditorManager.getCurrentFullEditor().getScrollerElement()).height();
        var lastVisibleLine = Math.floor((scrollPos.y + editorHeight) / lineHeight) - 1;

        document.body.style.cursor = "pointer";
        //highlight(this);
        // Save the current selection or position of cursor to restore after mouseleave
        var connection = JSON.parse(this.attrs.connection);
        if (!this.clicked) {
            activeHoverMarker[this._id] = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink2'});
        }
        
        //$(".magnet-" + this._id).addClass("selectionLink2");
        if (connection.start.line < firstVisibleLine) {
            $('#editor-holder').append('<div id="hightlightTop"></div>');
            offscreenLocation = 'top';
        } else if (connection.end.line > lastVisibleLine) {
            $('#editor-holder').append('<div id="hightlightBottom"></div>');
            offscreenLocation = 'bottom';
        }
    });
    magnet.on('dragend', function () {
        if (_activeLayer === "edit") {
            group.setDraggable(true);
            group.getLayer().draw();
        }
    });
    magnet.on('mouseleave', function () {
        if (!deleted) {
            if (!this.clicked) {
                if (_activeLayer === "edit") {
                    group.setDraggable(true);
                }
                document.body.style.cursor = "default";
                this.setStrokeWidth(1);
                this.setFill('rgba(251,167,13,0.5)');
                this.setStroke('rgba(251,167,13,1.0)');
                this.getLayer().draw();
    
                $('#hightlightTop').remove();
                $('#hightlightBottom').remove();
                offscreenLocation = null;
                if (activeHoverMarker[this._id]) {
                    activeHoverMarker[this._id].clear();
                    //delete (activeHoverMarker[this._id]);
                }
                
                $(".magnet-" + this._id).removeClass("selectionLink");
                selection = null;
                position = null;
            }
        }
    });
    
}

function addListenersToMissionControlMagnet(magnet, group) {
    var position = null;
    var selection = null;
    var marker = null;
    var offscreenLocation = null;
    var deleted = false;
    magnet.on('mousedown', function () {
        group.setDraggable(false);
    });

    magnet.on('mouseup', function (e) {
        if (e.which === 3) {
         // right mousebutton: delete the magnet
            if ($('#missionControl .controls a.edit').hasClass('active')) {
                if (confirm("Connection will be deleted")) {
                    deleted = true;
                    removeMarker(this._id);
                    $('#hightlightTop').remove();
                    $('#hightlightBottom').remove();
                    if (activeMarker[this._id]) {
                        activeMarker[this._id].clear();
                        delete (activeMarker[this._id]);
                    }
                    this.destroy();
                    group.getLayer().draw();
                }
            }
        } else {
         // left mousebutton
            
            if (!this.clicked) {
                var connection = JSON.parse(this.attrs.connection);
                var documentToOpen = DocumentManager.getDocumentForPath(this.attrs.fullPath);
                var thismagnet = this;
                if (connection.start.line > 0 && connection.end.line > 0) {
                    highlightMissionControl(thismagnet, missionControl.stage.get(".magnet"));
                } else {
                    highlightMissionControlFile(thismagnet);
                }
                thismagnet.clicked = true;
                missionControl.toggle();
                documentToOpen.then(
                    function (object) {
                        DocumentManager.setCurrentDocument(object);
                        DocumentManager.addToWorkingSet(object.file);
                        if (connection.start.line > 0 && connection.end.line > 0) {
                            var scrollPos = EditorManager.getCurrentFullEditor().getScrollPos();
                            var lineHeight = EditorManager.getCurrentFullEditor()._codeMirror.defaultTextHeight();
                            var firstVisibleLine = Math.ceil(scrollPos.y / lineHeight) - 1;
                            var editorHeight = $(EditorManager.getCurrentFullEditor().getScrollerElement()).height();
                            var lastVisibleLine = Math.floor((scrollPos.y + editorHeight) / lineHeight) - 1;
                            var timeout = 0;
                            var pos;
                            if (connection.start.line < firstVisibleLine) {
                                timeout = 700;
                                pos = connection.start.line * lineHeight;
                                $(EditorManager.getCurrentFullEditor().getScrollerElement()).animate({ scrollTop: pos }, timeout);
                                
                            } else if (connection.end.line > lastVisibleLine) {
                                timeout = 700;
                                pos = connection.end.line * lineHeight;
                                $(EditorManager.getCurrentFullEditor().getScrollerElement()).animate({ scrollTop: pos - editorHeight + 3 * lineHeight }, timeout);
                            }
                            setTimeout(function () {
                                $(".magnet-" + thismagnet._id).addClass("selectionLinkFromMissionControl");
                                activeMarker[thismagnet._id] = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLinkFromMissionControl'});
                            }, timeout);
                        } else {
                            thismagnet.clicked = false;
                            unhighlightMissionControl(thismagnet);
                        }
                    },
                    function (error) {
                    // saving the object failed.
                    }
                );
            } else {
                $(".magnet-" + this._id).removeClass("selectionLinkFromMissionControl");
                activeMarker[this._id].clear();
                unhighlightMissionControl(this);
                this.clicked = false;
            }
            
        }
    });

    magnet.on('mouseover', function () {
        document.body.style.cursor = "pointer";
    });
    magnet.on('dragend', function () {
        group.setDraggable(true);
        group.getLayer().draw();
    });
    magnet.on('mouseleave', function () {
        document.body.style.cursor = "default";
        group.setDraggable(true);
    });
    
}

function addMagnet(group, x, y, connection) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var magnet = new Kinetic.Circle({
        x: x,
        y: y,
        stroke: 'rgba(251,167,13,1)',
        fill: 'rgba(251,167,13,0.8)',
        strokeWidth: 1,
        radius: 12,
        name: 'magnet',
        draggable: true,
        dragOnTop: true,
        connection: connection,
        clicked: false
    });
    group.add(magnet);
    addListenersToMagnet(magnet, group);
    
    return magnet._id;
}

function addMissionControlMagnet(group, x, y, connection, fullPath) {
    var strokeColor = 'rgba(145, 161, 112, 1)';
    var fillColor = 'rgba(145, 161, 112, 0.9)';
    var JSONconnection = JSON.parse(connection);
    if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
        strokeColor = 'rgba(85, 50, 133, 1)';
        fillColor = 'rgba(85, 50, 133, 0.8)';
    }
    
    var stage = group.getStage();
    var layer = group.getLayer();
    var magnet = new Kinetic.Circle({
        x: x,
        y: y,
        stroke: strokeColor,
        fill: fillColor,
        strokeWidth: 1,
        radius: 12,
        name: 'magnet',
        draggable: true,
        dragOnTop: true,
        connection: connection,
        fullPath: fullPath,
        clicked: false
    });
    group.add(magnet);
    addListenersToMissionControlMagnet(magnet, group);
    
    return magnet._id;
}

function addListenersToAnchor(anchor, group) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var deleted = false;
    var marker = null;
    var oldX, oldY;
    
    anchor.on('dragmove', function () {
        update(this);
        this.getLayer().draw();
    });

    if (anchor.attrs.name === "topLeft") {
        anchor.on('mouseup touchend', function () {
            group.setDraggable(false);
            if (confirm("Remove the image!")) {
                deleted = true;
                $.each(group.get(".magnet"), function (pos, magnet) {
                    removeMarker(magnet._id);
                    if (activeMarker[this._id]) {
                        activeMarker[this._id].clear();
                    }
                });
                group.destroy();
                stage.draw();
            }
        });
    } else if (anchor.attrs.name === "topRight") {
        anchor.on('mouseup touchend', function () {
            if (EditorManager.getCurrentFullEditor().hasSelection()) {
                var connection = EditorManager.getCurrentFullEditor().getSelection();
                var id = addMagnet(group, 40, 40, JSON.stringify(connection));
                addMarker(connection, id);
                marker = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                EditorManager.getCurrentFullEditor().setCursorPos(connection.start);
                layer.draw();
            }
        });
    } else {
        anchor.on('mousedown touchstart', function () {
            oldX = this.getX();
            oldY = this.getY();
            group.setDraggable(false);
            this.moveToTop();
            hideMagnets(group);
        });
        
        anchor.on('mouseup touchend', function () {
            
        });
    }
    anchor.on('dragend', function () {
        updateMagnets(this, oldX, oldY);
        showMagnets(group);
        group.setDraggable(true);
        layer.draw();
    });
    // add hover styling
    if (anchor.attrs.name === "topLeft") {
        anchor.on('mouseover', function (e) {
            document.body.style.cursor = anchor.attrs.cursorStyle;
            group.get(".image")[0].setStroke("#EE8900");
            stage.draw();
        });
    } else {
        anchor.on('mouseover', function () {
            document.body.style.cursor = anchor.attrs.cursorStyle;
            group.get(".image")[0].setStroke("#EE8900");
            stage.draw();
        });
    }
    anchor.on('mouseleave', function () {
        if (anchor.attrs.name === "topRight") {
            if (marker) {
                marker.clear();
            }
        }
        document.body.style.cursor = 'default';
        if (!deleted) {
            this.parent.get(".image")[0].setStroke("transparent");
            this.parent.setDraggable(true);
        }
        stage.draw();
    });
    
    allAnchors.push(anchor);
}

function addAnchor(group, x, y, name, icon) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var radius = 8;
    var draggable = true;
    var fill = 'transparent';
    var stroke = 'transparent';
    var cursorStyle = "pointer";


    if (name === "topLeft") {
        radius = 8;
        draggable = false;
        fill = '#D93D2B';
        stroke = '#9E2900';
        cursorStyle = 'pointer';
    } else if (name === "bottomRight") {
        radius = 8;
        fill = 'transparent';
        stroke = 'transparent';
        cursorStyle = 'nwse-resize';
    } else if (name === "bottomLeft") {
        radius = 8;
        fill = 'transparent';
        stroke = 'transparent';
        cursorStyle = 'nesw-resize';
    } else if (name === "topRight") {
        radius = 8;
        draggable = false;
        fill = '#8DA56D';
        stroke = '#376568';
        cursorStyle = 'pointer';
    }
    var anchor;
    if (name === "topLeft" || name === "topRight") {
        
        var imageObj = new Image();
        imageObj.src = icon;
        anchor = new Kinetic.Image({
            x: x,
            y: y,
            offset: [15, 15],
            image: imageObj,
            width: 30,
            height: 30,
            name: name,
            cursorStyle: cursorStyle,
            draggable: draggable,
            dragOnTop: false
        });
    } else {
        anchor = new Kinetic.Circle({
            x: x,
            y: y,
            stroke: stroke,
            fill: fill,
            strokeWidth: 1,
            radius: radius,
            name: name,
            cursorStyle: cursorStyle,
            draggable: draggable,
            dragOnTop: false
        });
    }
    group.add(anchor);
    addListenersToAnchor(anchor, group);
    
}

function addListenersToMissionControlAnchor(anchor, group) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var deleted = false;
    var marker = null;
    var oldX, oldY;
    
    anchor.on('dragmove', function () {
        update(this);
        stage.draw();
    });

    if (anchor.attrs.name === "topLeft") {
        anchor.on('mouseup touchend', function () {
            group.setDraggable(false);
            if (confirm("Remove the image!")) {
                deleted = true;
                $.each(group.get(".magnet"), function (pos, magnet) {
                    removeMarker(magnet._id);
                    if (activeMarker[this._id]) {
                        activeMarker[this._id].clear();
                    }
                });
                group.destroy();
                stage.draw();
            }
        });
    } else if (anchor.attrs.name === "topRight") {
        anchor.on('mouseup touchend', function () {
            if (EditorManager.getCurrentFullEditor().hasSelection()) {
                var connection = EditorManager.getCurrentFullEditor().getSelection();
                var id = addMissionControlMagnet(group, 40, 40, JSON.stringify(connection), DocumentManager.getCurrentDocument().file.fullPath);
                addMissionControlMarker(connection, id);
                marker = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                EditorManager.getCurrentFullEditor().setCursorPos(connection.start);
                stage.draw();
            }
        });
    } else {
        anchor.on('mousedown touchstart', function () {
            oldX = this.getX();
            oldY = this.getY();
            group.setDraggable(false);
            this.moveToTop();
            hideMagnets(group);
        });
        
        anchor.on('mouseup touchend', function () {
            
        });
    }
    anchor.on('dragend', function () {
        updateMagnets(this, oldX, oldY);
        showMagnets(group);
        group.setDraggable(true);
        stage.draw();
    });
    // add hover styling
    if (anchor.attrs.name === "topLeft") {
        anchor.on('mouseover', function (e) {
            document.body.style.cursor = anchor.attrs.cursorStyle;
            group.get(".image")[0].setStroke("#EE8900");
            stage.draw();
        });
    } else {
        anchor.on('mouseover', function () {
            document.body.style.cursor = anchor.attrs.cursorStyle;
            group.get(".image")[0].setStroke("#EE8900");
            stage.draw();
        });
    }
    anchor.on('mouseleave', function () {
        if (anchor.attrs.name === "topRight") {
            if (marker) {
                marker.clear();
            }
        }
        document.body.style.cursor = 'default';
        if (!deleted) {
            this.parent.get(".image")[0].setStroke("transparent");
            this.parent.setDraggable(true);
        }
        stage.draw();
    });

    allMissionControlAnchors.push(anchor);
}

function addMissionControlAnchor(group, x, y, name, icon) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var radius = 8;
    var draggable = true;
    var fill = 'transparent';
    var stroke = 'transparent';
    var cursorStyle = "pointer";
    var deleted = false;
    var marker = null;
    var oldX, oldY;

    if (name === "topLeft") {
        radius = 8;
        draggable = false;
        fill = '#D93D2B';
        stroke = '#9E2900';
        cursorStyle = 'pointer';
    } else if (name === "bottomRight") {
        radius = 8;
        fill = 'transparent';
        stroke = 'transparent';
        cursorStyle = 'nwse-resize';
    } else if (name === "bottomLeft") {
        radius = 8;
        fill = 'transparent';
        stroke = 'transparent';
        cursorStyle = 'nesw-resize';
    } else if (name === "topRight") {
        radius = 8;
        draggable = false;
        fill = '#8DA56D';
        stroke = '#376568';
        cursorStyle = 'pointer';
    }
    var anchor;
    if (name === "topLeft" || name === "topRight") {
        
        var imageObj = new Image();
        imageObj.src = icon;
        anchor = new Kinetic.Image({
            x: x,
            y: y,
            offset: [15, 15],
            image: imageObj,
            width: 30,
            height: 30,
            name: name,
            cursorStyle: cursorStyle,
            draggable: draggable,
            dragOnTop: false
        });
    } else {
        anchor = new Kinetic.Circle({
            x: x,
            y: y,
            stroke: stroke,
            fill: fill,
            strokeWidth: 1,
            radius: radius,
            name: name,
            cursorStyle: cursorStyle,
            draggable: draggable,
            dragOnTop: false
        });
    }
    group.add(anchor);
    addListenersToMissionControlAnchor(anchor, group);
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

function recalculateStartAndEndOfConnection(magnet, cm, change, thisIsAMissionControlMagnet) {
    var connection = JSON.parse(magnet.attrs.connection);
    
    var indexFrom = cm.doc.indexFromPos(change.from);
    var indexTo = cm.doc.indexFromPos(change.to);
    var indexStart = cm.doc.indexFromPos(connection.start);
    var indexEnd = cm.doc.indexFromPos(connection.end);
    
    var endIs, startIs;
    if (change.origin === '+delete' || change.origin === 'paste') {
        endIs = whereIsThePointInRelationToTwoOtherPoints(indexEnd, indexFrom, indexTo);
        if (endIs >= 0) { // after or inside, but not before
            // we have to do something here since the change did not happen after the connection
            startIs = whereIsThePointInRelationToTwoOtherPoints(indexStart, indexFrom, indexTo);
            if (endIs === 0) { // inside
                if (startIs === -1) { // before
                    // just change the endpoint
                    connection.end = change.from;
                } else {
                    // start cannot be after when endIs inside, so start is also inside => delete the magnet and the mark
                    return null;
                }
            } else {
                // endIs 'after' since it is not before or inside
                // end.line needs to be changed in any case
                var lineDiff = change.to.line - change.from.line;
                connection.end.line = connection.end.line - lineDiff;
                if (change.to.line === connection.end.line) {
                    //need to correct the ch-value
                    connection.end.ch = change.from.ch + connection.end.ch - change.to.ch;
                }
                if (startIs >= 0) { // after or inside, not before
                    if (startIs === 0) { // inside
                        // just change the startpoint
                        connection.start = change.from;
                    } else {
                        // start is also after 
                        if (change.to.line === connection.start.line) {
                            //need to correct the ch-value
                            connection.start.ch = change.from.ch + connection.start.ch - change.to.ch;
                        }
                        connection.start.line = connection.start.line - lineDiff;
                    }
                }
            }
        }
    }
    if (change.origin === '+input' || change.origin === 'paste') {
        endIs = whereIsThePointInRelationToTwoOtherPoints(indexEnd, indexFrom, indexTo);
        if (endIs >= 0) { // after or inside, but not before
            var moreThanOneLineWasInserted = change.text.length - 1;
            if (moreThanOneLineWasInserted) {
                connection.end.line = connection.end.line + moreThanOneLineWasInserted;
            }
            startIs = whereIsThePointInRelationToTwoOtherPoints(indexStart, indexFrom, indexTo);
            if (startIs !== 0) { // after or before, but not inside ... if inside, do nothing else
                if (startIs === 1) { // after
                    if (change.to.line === connection.start.line) {
                        connection.start.ch = connection.start.ch + change.text[change.text.length - 1].length;
                    }
                    connection.start.line = connection.start.line + moreThanOneLineWasInserted;
                }
                if (change.from.line === connection.end.line) {
                    connection.end.ch = connection.end.ch + change.text[change.text.length - 1].length;
                }
            }
            removeMarker(magnet._id);
            if (thisIsAMissionControlMagnet) {
                if (DocumentManager.getCurrentDocument().file.fullPath === magnet.attrs.fullPath) {
                    addMissionControlMarker(connection, magnet._id);
                }
            } else {
                addMarker(connection, magnet._id);
            }
        }
    }
    return JSON.stringify(connection);
}