/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage, _activeEditor, asyncScroll, _activeLayer */

var sketchIconActive = require.toUrl('./sketch_button_on.png');
var sketchIconDeactive = require.toUrl('./sketch_button_off.png');
var allAnchors = new Array();

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

function addListenersToMagnet(magnet, group) {
    var position = null;
    var selection = null;
    var clicked = false;
    var marker = null;
    var offscreenLocation = null;
    magnet.on('mousedown', function () {
        group.setDraggable(false);
        asyncScroll = true;
    });

    magnet.on('mouseup', function (e) {
        var connection = JSON.parse(this.attrs.connection);
        var lineHeight, pos;
        if (offscreenLocation === 'top') {
            lineHeight = _activeEditor._codeMirror.defaultTextHeight();
            pos = connection.start.line * lineHeight;
            $(_activeEditor.getScrollerElement()).animate({ scrollTop: pos }, 700);
            $('#hightlightTop').remove();
        } else if (offscreenLocation === 'bottom') {
            lineHeight = _activeEditor._codeMirror.defaultTextHeight();
            pos = connection.end.line * lineHeight;
            $(_activeEditor.getScrollerElement()).animate({ scrollTop: pos }, 700);
            $('#hightlightBottom').remove();
        }
    
        selection = connection;
        //clicked = true;
    });

    magnet.on('mouseover', function () {
        // get the y-scroll position of editor and divide by line-height to get firstVisibleLine
        var scrollPos = _activeEditor.getScrollPos();
        var lineHeight = _activeEditor._codeMirror.defaultTextHeight();
        var firstVisibleLine = Math.ceil(scrollPos.y / lineHeight) - 1;
        var editorHeight = $(_activeEditor.getScrollerElement()).height();
        var lastVisibleLine = Math.floor((scrollPos.y + editorHeight) / lineHeight) - 1;

        document.body.style.cursor = "pointer";
        this.setStrokeWidth(3);
        group.getLayer().draw();
        // Save the current selection or position of cursor to restore after mouseleave
        if (_activeEditor.hasSelection()) {
            selection = _activeEditor.getSelection();
        } else {
            position = _activeEditor.getCursorPos();
        }
        var connection = JSON.parse(this.attrs.connection);
        marker = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink2'});
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
    magnet.on('mouseout', function () {
        if (_activeLayer === "edit") {
            group.setDraggable(true);
        }
        document.body.style.cursor = "default";
        this.setStrokeWidth(1);
        this.getLayer().draw();
        // restore initial selection or position of cursor on mouseleave
        $('.CodeMirror-selected').removeClass('selectionLink');
        $('#hightlightTop').remove();
        $('#hightlightBottom').remove();
        offscreenLocation = null;
        marker.clear();

        selection = null;
        position = null;
    });
}

function addMagnet(group, x, y, connection) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var magnet = new Kinetic.Circle({
        x: x,
        y: y,
        stroke: 'rgba(251,167,13,1);',
        fill: 'rgba(251,167,13,0.5);',
        strokeWidth: 1,
        radius: 8,
        name: 'magnet',
        draggable: true,
        dragOnTop: true,
        connection: connection
    });
    group.add(magnet);
    addListenersToMagnet(magnet, group);

    //allAnchors.push(anchor);   
}

function addMarker(connection) {
    console.log(_activeEditor._codeMirror.options.gutters);
    //_activeEditor._codeMirror.addLineClass(connection.start.line, 'text', 'linkedLine');
    _activeEditor._codeMirror.options.gutters.push('linkedLines');
    var span = document.createElement('span');
    span.addClass = 'linkedLine';
    _activeEditor._codeMirror.setGutterMarker(connection.start.line, 'linkedLines', span);
}

function addAnchor(group, x, y, name) {
    var stage = group.getStage();
    var layer = group.getLayer();
    var radius = 8;
    var draggable = true;
    var fill = 'transparent';
    var stroke = 'transparent';
    var cursorStyle = "pointer";
    var deleted = false;
    var marker = null;

    if (name === "topLeft") {
        radius = 8;
        draggable = false;
        fill = '#D93D2B';
        stroke = '#9E2900';
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
        fill = '#447E82';
        stroke = '#376568';
        cursorStyle = 'crosshair';
    }
    var anchor = new Kinetic.Circle({
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
    group.add(anchor);

    anchor.on('dragmove', function () {
        update(this);
        this.getLayer.draw();
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
                addMagnet(group, 40, 40, JSON.stringify(connection));
                //addMarker(connection);
                marker = _activeEditor._codeMirror.markText(connection.start, connection.end, {className : 'selectionLink2'});
                _activeEditor.setCursorPos(connection.start);
                layer.draw();
            }
        });
    } else {
        anchor.on('mousedown touchstart', function () {
            group.setDraggable(false);
            this.moveToTop();
        });
    }
    anchor.on('dragend', function () {
        group.setDraggable(true);
        layer.draw();
    });
    // add hover styling
    anchor.on('mouseover', function () {
        document.body.style.cursor = cursorStyle;
        group.get(".image")[0].setStroke("#EE8900");
        stage.draw();
    });
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