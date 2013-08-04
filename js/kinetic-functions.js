/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, _asyncScroll, _activeLayer, _activeMarker, _allAnchors, missionControl */

// needed modules
var DocumentManager = brackets.getModule("document/DocumentManager"),
    ProjectManager = brackets.getModule("project/ProjectManager"),
    EditorManager = brackets.getModule("editor/EditorManager");
var sketchIconActive = require.toUrl('./sketch_button_on.png');
var sketchIconDeactive = require.toUrl('./sketch_button_off.png');

var allMissionControlAnchors = [];
var _activeColor = 0;
var _allAnchors = [];
var activeHoverMarker = [];

/**
* Update the active anchor
*
* @param {Object} active anchor
* @method _update
*/
function _update(activeAnchor) {
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

/**
* Update the magnets (connection dots)
*
* @param {Object} active anchor
* @param {Number} old x position before repositioning
* @param {Number} old y position before repositioning
* @method _updateMagnets
*/
function _updateMagnets(activeAnchor, oldX, oldY) {
    var anchorX = activeAnchor.getX();
    var anchorY = activeAnchor.getY();
    var group = activeAnchor.getParent();
    var magnets = group.get('.magnet');
    var ratioX = anchorX / oldX;
    var ratioY = anchorY / oldY;

    $.each(magnets, function (key, magnet) {
        magnet.setX(magnet.getX() * ratioX);
        magnet.setY(magnet.getY() * ratioY);
    });
}

/**
* Show all anchors on a stage after an image has been repositioned by the user (drag&drop)
*
* @param {Object} stage to redraw after anchors are visible
* @method _showAnchors
*/
function _showAnchors(stage) {
    if (_allAnchors.length) {
        $.each(_allAnchors, function (index, value) {
            value.show();
        });
        stage.draw();
    }
}

/**
* Hide all anchors on a stage while the user is repositioning an image (drag&drop)
*
* @param {Object} stage to redraw after anchors are hidden
* @method _hideAnchors
*/
function _hideAnchors(stage) {
    if (_allAnchors.length) {
        $.each(_allAnchors, function (index, value) {
            value.hide();
        });
        stage.draw();
    }
}

/**
* Show all magnet (conntection dots) of a group after an image has been repositioned by the user (drag&drop)
*
* @param {Object} group to redraw after magnets are visible
* @method _showMagnets
*/
function _showMagnets(group) {
    var magnets = group.get('.magnet');
    if (magnets.length) {
        $.each(magnets, function (index, magnet) {
            magnet.show();
        });
        group.getLayer().draw();
    }
}

/**
* Hide all magents (connection dots) of a group while the user is repositioning an image (drag&drop)
*
* @param {Object} group to redraw after magnets are hidden
* @method _hideMagnets
*/
function _hideMagnets(group) {
    var magnets = group.get('.magnet');
    if (magnets.length) {
        $.each(magnets, function (index, magnet) {
            magnet.hide();
        });
        group.getLayer().draw();
    }
}

/**
* Add markers to the corresponding line numbers when a new MissionControl magnet (connection dot) is created
*
* @param {Object} the connection point to the magnet, i.e., the selection provided by CodeMirror
* @param {Number} id of the magnet
* @method _hideAnchors
*/
function _addMissionControlMarker(connection, id) {
    EditorManager.getCurrentFullEditor()._codeMirror.options.gutters.push("magnet-" + id);
    if (connection.start.line > 0 && connection.end.line > 0) {
        var lines = connection.end.line - connection.start.line;
        var i;
        for (i = 0; i <= lines; i++) {
            var line = connection.start.line + i;
            var element = document.createElement('div');
            element.className = "CodeMirror-linkedMissionControlLines magnet-" + id;
            element.name = id;
            EditorManager.getCurrentFullEditor()._codeMirror.setGutterMarker(line, "magnet-" + id, element);
        }
    }
}

/**
* Add markers to the corresponding line numbers when a SketchMeister magnet (connection dot) is created
*
* @param {Object} the connection point to the magnet, i.e., the selection provided by CodeMirror
* @param {Number} id of the magnet
* @method _addMarker
*/
function _addMarker(connection, id) {
    //EditorManager.getCurrentFullEditor()._codeMirror.addLineClass(connection.start.line, 'text', 'linkedLine');
    EditorManager.getCurrentFullEditor()._codeMirror.options.gutters.push("magnet-" + id);
    var lines = connection.end.line - connection.start.line;
    var i;
    for (i = 0; i <= lines; i++) {
        var line = connection.start.line + i;
        var element = document.createElement('div');
        element.className = "CodeMirror-linkedLines magnet-" + id;
        element.name = id;
        EditorManager.getCurrentFullEditor()._codeMirror.setGutterMarker(line, "magnet-" + id, element);
    }
}

/**
* Remove the marker from the line numbers
*
* @param {Number} id of the magnet to identify the corresponding line numbers
* @method _removeMarker
*/
function _removeMarker(id) {
    EditorManager.getCurrentFullEditor()._codeMirror.clearGutter("magnet-" + id);
}

/**
* Unhighlight a magnet from MissionControl
*
* @param {Object} the magnet that gets unhighlighted
* @method _unhighlightMissionControl
*/
function _unhighlightMissionControl(magnet) {
    var fillColor = 'rgba(140, 184, 119, 0.5)';
    var strokeColor = 'rgba(66, 87, 56, 1.0)';
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
            duration: 0.1
        });
    }
}

/**
* Unhighlight a magnet from MissionControl connected to a whole file
*
* @param {Object} the magnet that gets unhighlighted
* @method _unhighlightMissionControlFile
*/
function _unhighlightMissionControlFile(magnet) {
    var JSONconnection = JSON.parse(magnet.attrs.connection);
    if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
        var strokeColor = 'rgba(47, 31, 74, 1)';
        var fillColor = 'rgba(85, 50, 133, 0.5)';
        magnet.setStrokeWidth(1);
        magnet.setFill(fillColor);
        magnet.setStroke(strokeColor);
        magnet.transitionTo({
            scale: {x: 1.0,
                   y: 1.0},
            duration: 0.1
        });
    }
}

/**
* Highlight a magnet from MissionControl and unhighlight all other magnets before
*
* @param {Object} the magnet that gets highlighted
* @param {Array} all magnets
* @method _highlightMissionControl
*/
function _highlightMissionControl(magnet, allMagnets) {
    $.each(allMagnets, function (key, eachmagnet) {
        _unhighlightMissionControl(eachmagnet);
        if (eachmagnet._id !== magnet._id) {
            eachmagnet.clicked = false;
            $(".magnet-" + eachmagnet._id).removeClass('selectionLinkFromMissionControl');
            if (_activeMarker[eachmagnet._id]) {
                _activeMarker[eachmagnet._id].clear();
                delete (_activeMarker[magnet._id]);
            }
        }
    });
    magnet.setStrokeWidth(2);
    //magnet.setFill('rgba(85, 50, 133, 0.9)');
    //magnet.setStroke('rgba(85, 50, 133, 1.0)');
    magnet.transitionTo({
        scale: {x: 1.8,
               y: 1.8},
        duration: 0.1
    });
}

/**
* Highlight a magnet from MissionControl connected to a whole file and unhighlight all other magnets before
*
* @param {Object} the magnet that gets highlighted
* @method _highlightMissionControlFile
*/
function _highlightMissionControlFile(magnet) {
    magnet.setStrokeWidth(2);
    magnet.setFill('rgba(85, 50, 133, 0.7)');
    magnet.setStroke('rgba(47, 31, 74, 1.0)');
    magnet.transitionTo({
        scale: {x: 1.8,
               y: 1.8},
        duration: 0.1
    });
}

/**
* Highlight a magnet from SketchMeister and unhighlight all other magnets before
*
* @param {Object} the magnet that gets highlighted
* @method _highlight
*/
function _highlight(magnet) {
    magnet.setStrokeWidth(2);
    magnet.setFill('rgba(80, 103, 142, 0.8)');
    magnet.setStroke('rgba(80, 103, 142, 1.0)');
    magnet.transitionTo({
        scale: {x: 1.8,
               y: 1.8},
        duration: 0.1
    });
}

/**
* Highlight a magnet from SketchMeister and unhighlight all other magnets before
*
* @param {Object} the magnet that gets unhighlighted
* @method _unhighlight
*/
function _unhighlight(magnet) {
    magnet.setStrokeWidth(1);
    magnet.setFill('rgba(251,167,13,0.8)');
    magnet.setStroke('rgba(251,167,13,1.0)');
    magnet.transitionTo({
        scale: {x: 1.0,
               y: 1.0},
        duration: 0.1
    });
}

/**
* Add listeners to a magnet
*
* @param {Object} magnet 
* @param {Object} group 
* @method _addListenersToMagnet
*/
function _addListenersToMagnet(magnet, group) {
    var position = null;
    var selection = null;
    var marker = null;
    var offscreenLocation = null;
    var deleted = false;
    magnet.on('mousedown', function () {
        group.setDraggable(false);
        _asyncScroll = true;
    });

    magnet.on('mouseup', function (e) {
        if (e.which === 3) {
         // right mousebutton: delete the magnet
            if ($('.tools .edit').hasClass('selected')) {
                if (confirm("Connection will be deleted")) {
                    deleted = true;
                    _removeMarker(this._id);
                    $('#hightlightTop').remove();
                    $('#hightlightBottom').remove();
                    _activeMarker[this._id].clear();
                    delete (_activeMarker[this._id]);
                    this.destroy();
                    group.getLayer().draw();
                }
            }
        } else {
         // left mousebutton
            var connection = JSON.parse(this.attrs.connection);
            
            
            if (!this.clicked) {
                if (offscreenLocation) {
                    _asyncScroll = true;
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
                    _asyncScroll = false;
                }
                
                $(".magnet-" + this._id).addClass("selectionLink");
                activeHoverMarker[this._id].clear();
                _activeMarker[this._id] = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                _highlight(this);
                this.clicked = true;
            } else {
                $(".magnet-" + this._id).removeClass("selectionLink");
                _activeMarker[this._id].clear();
                activeHoverMarker[this._id] = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink2'});
                _unhighlight(this);
                this.clicked = false;
                _asyncScroll = true;
                $(EditorManager.getCurrentFullEditor().getScrollerElement()).animate({ scrollTop: $("#myPanel").scrollTop() }, 700);
                setTimeout(function () {
                    _asyncScroll = false;
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

/**
* Add listeners to a magnet of MissionControl
*
* @param {Object} magnet 
* @param {Object} group 
* @method _addListenersToMissionControlMagnet
*/
function _addListenersToMissionControlMagnet(magnet, group) {
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
                    _removeMarker(this._id);
                    $('#hightlightTop').remove();
                    $('#hightlightBottom').remove();
                    if (_activeMarker[this._id]) {
                        _activeMarker[this._id].clear();
                        delete (_activeMarker[this._id]);
                    }
                    this.destroy();
                    group.getLayer().draw();
                }
            }
        } else {
         // left mousebutton

            var connection = JSON.parse(this.attrs.connection);
            var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
            var documentToOpen = DocumentManager.getDocumentForPath(fullProjectPath + this.attrs.relativePath);
            var thismagnet = this;
            
            if (connection.start.line > 0 && connection.end.line > 0) {
                _highlightMissionControl(thismagnet, missionControl.stage.get(".magnet"));
            } else {
                _highlightMissionControlFile(thismagnet);
            }
            setTimeout(function () {
                missionControl.toggle();
            }, 120);
            setTimeout(function () {
                thismagnet.clicked = true;
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
                                _activeMarker[thismagnet._id] = EditorManager.getCurrentFullEditor()._codeMirror.markText(connection.start, connection.end, {className : 'selectionLinkFromMissionControl'});
                            }, timeout);
                        } else {
                            thismagnet.clicked = false;
                            _unhighlightMissionControl(thismagnet);
                        }
                    },
                    function (error) {
                        console.log(documentToOpen);
                    }
                );
            }, 100);
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

/**
* Add a magnet to the group (image group) and store the connection
*
* @param {Object} group
* @param {Number} x position in the group
* @param {Number} y position in the group
* @param {Object} connection (the selection in CodeMirror) 
* @method _addMagnet
* @return {Number} id of the magnet
*/
function _addMagnet(group, x, y, connection) {
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
    _addListenersToMagnet(magnet, group);
    
    return magnet._id;
}

/**
* Add a magnet to the group (image group) and store the connection of MissionControl
*
* @param {Object} group
* @param {Number} x position in the group
* @param {Number} y position in the group
* @param {Object} connection (the selection in CodeMirror)
* @param {String} relative path of the project
* @method _addMissionControlMagnet
* @return {Number} id of the magnet
*/
function _addMissionControlMagnet(group, x, y, connection, relativePath) {
    var strokeColor = 'c, 1)';
    var fillColor = 'rgba(140, 184, 119, 0.9)';
    var JSONconnection = JSON.parse(connection);
    if (JSONconnection.start.line === 0 && JSONconnection.end.line === 0) {
        strokeColor = 'rgba(47, 31, 74, 1)';
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
        relativePath: relativePath,
        clicked: false
    });
    group.add(magnet);
    _addListenersToMissionControlMagnet(magnet, group);
    
    return magnet._id;
}

/**
* Add an anchor to the group (image group)
*
* @param {Object} anchor
* @param {Object} group
* @method _addListenersToAnchor
*/
function _addListenersToAnchor(anchor, group) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var deleted = false;
    var marker = null;
    var oldX, oldY;
    
    anchor.on('dragmove', function () {
        _update(this);
        this.getLayer().draw();
    });

    if (anchor.attrs.name === "topLeft") {
        anchor.on('mouseup touchend', function () {
            group.setDraggable(false);
            if (confirm("Remove the image!")) {
                deleted = true;
                $.each(group.get(".magnet"), function (pos, magnet) {
                    _removeMarker(magnet._id);
                    if (_activeMarker[this._id]) {
                        _activeMarker[this._id].clear();
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
                var id = _addMagnet(group, 40, 40, JSON.stringify(connection));
                _addMarker(connection, id);
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
            _hideMagnets(group);
        });
        
        anchor.on('mouseup touchend', function () {
            
        });
    }
    anchor.on('dragend', function () {
        _updateMagnets(this, oldX, oldY);
        _showMagnets(group);
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
    
    _allAnchors.push(anchor);
}

/**
* Add an anchor to the group (image group)
*
* @param {Object} group
* @param {Number} x position in the group
* @param {Number} y position in the group
* @param {Object} name of the anchor (topLeft, bottomRight, bottomLeft, topRight)
* @param {Object} icon to show in the anchor (close x, add +)
* @method _addAnchor
*/
function _addAnchor(group, x, y, name, icon) {
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
    _addListenersToAnchor(anchor, group);
    
}

/**
* Add an anchor to the group (image group) of MissionControl
*
* @param {Object} anchor
* @param {Object} group
* @method _addListenersToMissionControlAnchor
*/
function _addListenersToMissionControlAnchor(anchor, group) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var deleted = false;
    var marker = null;
    var oldX, oldY;
    
    anchor.on('dragmove', function () {
        _update(this);
        stage.draw();
    });

    if (anchor.attrs.name === "topLeft") {
        anchor.on('mouseup touchend', function () {
            group.setDraggable(false);
            if (confirm("Remove the image!")) {
                deleted = true;
                $.each(group.get(".magnet"), function (pos, magnet) {
                    _removeMarker(magnet._id);
                    if (_activeMarker[this._id]) {
                        _activeMarker[this._id].clear();
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
                var fullPath = DocumentManager.getCurrentDocument().file.fullPath;
                var fullProjectPath = ProjectManager.getProjectRoot().fullPath;
                var relativePath = fullPath.replace(fullProjectPath, "");
                var id = _addMissionControlMagnet(group, 40, 40, JSON.stringify(connection), relativePath);
                _addMissionControlMarker(connection, id);
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
            _hideMagnets(group);
        });
        
        anchor.on('mouseup touchend', function () {
            
        });
    }
    anchor.on('dragend', function () {
        _updateMagnets(this, oldX, oldY);
        _showMagnets(group);
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

/**
* Add an anchor to the group (image group) of MissionControl
*
* @param {Object} group
* @param {Number} x position in the group
* @param {Number} y position in the group
* @param {Object} name of the anchor (topLeft, bottomRight, bottomLeft, topRight)
* @param {Object} icon to show in the anchor (close x, add +)
* @method _addMissionControlAnchor
*/
function _addMissionControlAnchor(group, x, y, name, icon) {
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
    _addListenersToMissionControlAnchor(anchor, group);
}

/**
* Check if a number is before, after or within a range
* Used to check where the current cursor position is in relation to a connection
* => the index of a points is used to check
*
* @param {Number} point
* @param {Number} from
* @param {Number} to
* @method _whereIsThePointInRelationToTwoOtherPoints
* @return {Number} 1: point is after to; -1: point is before from; 0: point is between from and to
*/
function _whereIsThePointInRelationToTwoOtherPoints(point, from, to) {
    // -1 before < 0 inside < 1 after
    
    if (to < point) {
        return 1; //after
    } else if (point < from) {
        return -1; //before
    } else {
        return 0; //inside
    }
}

/**
* Recalculates a connection within the text corresponding to a magnet when the text in the editor is changed.
*   - the connection is recalculated if the change was before the connection (smaller line number / smaller character in line)
*   - the end point of connection needs to be recalculated if change is within the connection
*   - nothing changes if the change is after the connection
*
* @param {Object} magnet to check if its connection needs to be updated
* @param {Object} CodeMirror object of the current document
* @param {Object} the change information (delete or insert or delete&insert)
* @param {Boolean} 1: MissionControl magnet; 0: SketchMeister magnet
* @method _recalculateStartAndEndOfConnection
* @return {String} connection as a string
*/
function _recalculateStartAndEndOfConnection(magnet, cm, change, thisIsAMissionControlMagnet) {
    var connection = JSON.parse(magnet.attrs.connection);
    
    var indexFrom = cm.doc.indexFromPos(change.from);
    var indexTo = cm.doc.indexFromPos(change.to);
    var indexStart = cm.doc.indexFromPos(connection.start);
    var indexEnd = cm.doc.indexFromPos(connection.end);
    
    var endIs, startIs;
    if (change.origin === '+delete' || change.origin === 'paste') {
        endIs = _whereIsThePointInRelationToTwoOtherPoints(indexEnd, indexFrom, indexTo);
        if (endIs >= 0) { // after or inside, but not before
            // we have to do something here since the change did not happen after the connection
            startIs = _whereIsThePointInRelationToTwoOtherPoints(indexStart, indexFrom, indexTo);
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
        endIs = _whereIsThePointInRelationToTwoOtherPoints(indexEnd, indexFrom, indexTo);
        if (endIs >= 0) { // after or inside, but not before
            var moreThanOneLineWasInserted = change.text.length - 1;
            if (moreThanOneLineWasInserted) {
                connection.end.line = connection.end.line + moreThanOneLineWasInserted;
            }
            startIs = _whereIsThePointInRelationToTwoOtherPoints(indexStart, indexFrom, indexTo);
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
            _removeMarker(magnet._id);
            if (thisIsAMissionControlMagnet) {
                if (DocumentManager.getCurrentDocument().file.fullPath === magnet.attrs.fullPath) {
                    _addMissionControlMarker(connection, magnet._id);
                }
            } else {
                _addMarker(connection, magnet._id);
            }
        }
    }
    return JSON.stringify(connection);
}