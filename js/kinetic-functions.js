/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage, _activeEditor, asyncScroll, _activeLayer, activeMarker*/

var sketchIconActive = require.toUrl('./sketch_button_on.png');
var sketchIconDeactive = require.toUrl('./sketch_button_off.png');
var allAnchors = [];
var colors = ['#15863C', '#6AC7F3', '#639A4B', '#BE6FBE', '#FBEC44', '#F8B015', '#F0ADA9', '#AA4F17', '#FE6208', '#495CC9', '#F01F1C'];
var _activeColor = 0;

activeHoverMarker = [];

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

function addMarker(connection, id) {
    //_activeEditor._codeMirror.addLineClass(connection.start.line, 'text', 'linkedLine');
    _activeEditor._codeMirror.options.gutters.push("magnet-" + id);
    var lines = connection.end.line - connection.start.line;
    var i;
    for (i = 0; i <= lines; i++) {
        var line = connection.start.line + i;
        var element = document.createElement('div');
        element.className = "CodeMirror-linkedLines magnet-" + id;
        element.name = id;
        //element.id = "magnet-" + id;
        _activeEditor._codeMirror.setGutterMarker(line, "magnet-" + id, element);
        //console.log(_activeEditor._codeMirror.lineInfo(line));
    }
}

function removeMarker(connection, id) {
    _activeEditor._codeMirror.clearGutter("magnet-" + id);
}

function highlight(magnet) {
    magnet.setStrokeWidth(2);
    magnet.setFill('rgba(116, 138, 0, 0.8)');
    magnet.setStroke('rgba(116, 138, 0, 1.0)');
    magnet.transitionTo({
        scale: {x: 1.8,
               y: 1.8},
        duration: 0.2
    });
}

function unhighlight(magnet) {
    magnet.setStrokeWidth(1);
    magnet.setFill('rgba(251,167,13,0.5)');
    magnet.setStroke('rgba(251,167,13,1.0)');
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
        console.log(activeMarker);
        if (e.which === 3) {
         // right mousebutton: delete the magnet
            if ($('.tools .edit').hasClass('selected')) {
                if (confirm("Connection will be deleted")) {
                    deleted = true;
                    removeMarker(this.attrs.connection, this._id);
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
            if (offscreenLocation) {
                var scrollPos = _activeEditor.getScrollPos();
                var lineHeight = _activeEditor._codeMirror.defaultTextHeight();
                var editorHeight = $(_activeEditor.getScrollerElement()).height();
                var connection = JSON.parse(this.attrs.connection);
                var pos;
                if (offscreenLocation === 'top') {
                    pos = connection.start.line * lineHeight;
                    $(_activeEditor.getScrollerElement()).animate({ scrollTop: pos }, 700);
                    $('#hightlightTop').remove();
                } else if (offscreenLocation === 'bottom') {
                    pos = connection.end.line * lineHeight;
                    $(_activeEditor.getScrollerElement()).animate({ scrollTop: pos - editorHeight + 3 * lineHeight }, 700);
                    $('#hightlightBottom').remove();
                }
                selection = connection;
            } else {
                asyncScroll = false;
            }
            
            if(!this.clicked) {
                $(".magnet-" + this._id).addClass("selectionLink");
                var connection = JSON.parse(this.attrs.connection);
                activeHoverMarker[this._id].clear();
                activeMarker[this._id] = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                highlight(this);
                this.clicked = true;
            } else {
                $(".magnet-" + this._id).removeClass("selectionLink");
                var connection = JSON.parse(this.attrs.connection);
                if(activeMarker[this._id]) {
                    activeMarker[this._id].clear();
                }
                activeHoverMarker[this._id] = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink2'});
                unhighlight(this);
                this.clicked = false;
            }
            
            
        }
    });

    magnet.on('mouseover', function () {
        // get the y-scroll position of editor and divide by line-height to get firstVisibleLine
        var scrollPos = _activeEditor.getScrollPos();
        var lineHeight = _activeEditor._codeMirror.defaultTextHeight();
        var firstVisibleLine = Math.ceil(scrollPos.y / lineHeight) - 1;
        var editorHeight = $(_activeEditor.getScrollerElement()).height();
        var lastVisibleLine = Math.floor((scrollPos.y + editorHeight) / lineHeight) - 1;

        document.body.style.cursor = "pointer";
        //highlight(this);
        // Save the current selection or position of cursor to restore after mouseleave
        if (_activeEditor.hasSelection()) {
            selection = _activeEditor.getSelection();
        } else {
            position = _activeEditor.getCursorPos();
        }
        var connection = JSON.parse(this.attrs.connection);
        if(!this.clicked) {
            activeHoverMarker[this._id] = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink2'});    
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
            if(!this.clicked) {
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
                if(activeHoverMarker[this._id]) {
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

function addMagnet(group, x, y, connection) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var magnet = new Kinetic.Circle({
        x: x,
        y: y,
        stroke: 'rgba(251,167,13,1)',
        fill: 'rgba(251,167,13,0.5)',
        strokeWidth: 1,
        radius: 8,
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

function addAnchor(group, x, y, name, icon) {
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
            draggable: draggable,
            dragOnTop: false
        });
    }
    group.add(anchor);

    anchor.on('dragmove', function () {
        update(this);
        
        this.getLayer().draw();
    });

    if (name === "topLeft") {
        anchor.on('mouseup touchend', function () {
            group.setDraggable(false);
            if (confirm("Remove the image!")) {
                deleted = true;
                group.destroy();
                stage.draw();
            }
        });
    } else if (name === "topRight") {
        anchor.on('mouseup touchend', function () {
            if (_activeEditor.hasSelection()) {
                var connection = _activeEditor.getSelection();
                var id = addMagnet(group, 40, 40, JSON.stringify(connection));
                addMarker(connection, id);
                marker = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink'});
                _activeEditor.setCursorPos(connection.start);
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
    if (name === "topLeft") {
        anchor.on('mouseover', function (e) {
            document.body.style.cursor = cursorStyle;
            group.get(".image")[0].setStroke("#EE8900");
            stage.draw();
        });
    } else {
        anchor.on('mouseover', function () {
            document.body.style.cursor = cursorStyle;
            group.get(".image")[0].setStroke("#EE8900");
            stage.draw();
        });
    }
    anchor.on('mouseleave', function () {
        if (name === "topRight") {
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

function recalculateStartAndEndOfConnection(magnet, cm, change) {
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
                    connection.start.line = connection.start.line + moreThanOneLineWasInserted;
                    if (change.to.line === connection.start.line) {
                        connection.start.ch = connection.start.ch + change.text[change.text.length - 1].length;
                    }
                }
                if (change.from.line === connection.end.line) {
                    connection.end.ch = connection.end.ch + change.text[change.text.length - 1].length;
                }
            }
            removeMarker(null, magnet._id);
            addMarker(connection, magnet._id);
        }
    }
    return JSON.stringify(connection);
}