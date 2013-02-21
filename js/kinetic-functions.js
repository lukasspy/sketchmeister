/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50, browser: true*/
/*global define, $, brackets, window, CodeMirror, document, Kinetic, addImageToStage */

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
    if(allAnchors.length) {
        $.each(allAnchors, function(index, value) {
            value.show();
        });
        stage.draw();
    }
}

function hideAnchors(stage) {
    if(allAnchors.length) {
        $.each(allAnchors, function(index, value) {
            value.hide();
        });
        stage.draw();
    }
}

function addMagnet(group, x, y) {
    var stage = group.getStage();
    var layer = group.getLayer();
    
    var anchor = new Kinetic.Circle({
        x: x,
        y: y,
        stroke: 'rgba(0,0,0,0.6)',
        fill: 'rgba(0,0,0,0.4)',
        strokeWidth: 1,
        radius: 8,
        name: 'magnet',
        draggable: true,
        dragOnTop: true
    });
    anchor.on('mousedown', function (e) {
        group.setDraggable(false);
        console.log('magnet clicked');
    });
    
    anchor.on('mouseover', function () {
        document.body.style.cursor = "pointer";
        this.setStrokeWidth(3);
        layer.draw();
    });
    anchor.on('dragend', function () {
        group.setDraggable(true);
        layer.draw();
    });
    anchor.on('mouseout', function () {
        group.setDraggable(true);
        this.setStrokeWidth(1);
        layer.draw();
    });
    group.add(anchor);
    console.log(group);
    //allAnchors.push(anchor);
    
}

function addAnchor(group, x, y, name, delCursor) {
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
    anchor.on('dragmove', function () {
        update(this);
        layer.draw();
    });
    
    if (name === "topLeft") {
        anchor.on('mouseup touchend', function () {
            group.setDraggable(false);
            
            if (confirm("Remove the image!")) {
                group.removeChildren();
                group.remove();
                stage.draw();
            }
         });
    } else if (name === "topRight") {
        anchor.on('mouseup touchend', function () {
            addMagnet(group, 40, 40);
            layer.draw();
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
    anchor.on('mouseout', function () {
        document.body.style.cursor = 'default';
        group.get(".image")[0].setStroke("transparent");
        group.setDraggable(true);
        stage.draw();
    });
    group.add(anchor);
    allAnchors.push(anchor);
}

function loadImages(sources, callback) {
    var images = {};
    var loadedImages = 0;
    var numImages = 0;
    var src;
    for (src in sources) {
        numImages++;
    }
    for (src in sources) {
        images[src] = new Image();
        images[src].onload = function () {
            if (++loadedImages >= numImages) {
                callback(images);
            }
        };
        images[src].src = sources[src];
    }
}

function createAStage(id) {
    var height = $(_activeEditor.getScrollerElement()).height();
    var width = $(_activeEditor.getScrollerElement()).width();
    var totalHeight = _activeEditor.totalHeight(true);
    stage = new Kinetic.Stage({
        container: 'overlay-' + id,
        width: width,
        height: totalHeight
    });
    console.log('stage done');
    //stage.setAbsolutePosition(widthOfEditorFull, 0);
}

function createSketchingLayer(id) {
    var sketchingLayer = new Kinetic.Layer();
    sketchingLayer.setId('simple_sketch');
    sketchingLayer.setAbsolutePosition(0, 0);
    console.log(sketchingLayer.getId());
    stage.add(sketchingLayer);
}

function addImageToStage2(imageToAdd) {
    var helpImage = new Image();
    helpImage.src =  imageToAdd;
    //bild muss erst in den DOM geschrieben werden und dann kann die Größe ermittelt werden .. 
    var widthOfImage = helpImage.naturalWidth;
    var heightOfImage = helpImage.naturalHeight;
    
    var widthOfEditorFull = $('#overlay-' + _activeSketchingArea.id).width();
    var widthOfEditor = widthOfEditorFull / 2;
    var heightOfEditor = $('#overlay-' + _activeSketchingArea.id).height();
    console.log("Editor: " + widthOfEditor + " and " + heightOfEditor);
    
    var imageGroup = new Kinetic.Group({
        x: 0,
        y: 0,
        draggable: true
    });
    var layer = new Kinetic.Layer({
        id: 'images'
    });
    layer.add(imageGroup);
    stage.add(layer);
    var sketchingLayer = stage.get('#simple_sketch');
    console.log(sketchingLayer);
    sketchingLayer.moveToTop();
    
    // new Image added to group
    var newImg = new Kinetic.Image({
        x: 0,
        y: 0,
        image: helpImage,
        width: (widthOfEditor * 0.8),
        height: (widthOfEditor * 0.8) / widthOfImage * heightOfImage,
        name: 'image'
    });

    imageGroup.add(newImg);
    addAnchor(imageGroup, 0, 0, 'topLeft');
    addAnchor(imageGroup, widthOfImage, 0, 'topRight');
    addAnchor(imageGroup, widthOfImage, heightOfImage, 'bottomRight');
    addAnchor(imageGroup, 0, heightOfImage, 'bottomLeft');

    imageGroup.on('dragstart', function () {
        this.moveToTop();
    });
    stage.draw();
}

function initStage(images) {
    var stage = new Kinetic.Stage({
        container: 'overlay-' + _activeSketchingArea.id,
        width: 578,
        height: 400
    });
    var darthVaderGroup = new Kinetic.Group({
        x: 270,
        y: 100,
        draggable: true
    });
    var yodaGroup = new Kinetic.Group({
        x: 100,
        y: 110,
        draggable: true
    });
    var layer = new Kinetic.Layer();

    /*
     * go ahead and add the groups
     * to the layer and the layer to the
     * stage so that the groups have knowledge
     * of its layer and stage
     */
    layer.add(darthVaderGroup);
    layer.add(yodaGroup);
    stage.add(layer);

    // darth vader
    var darthVaderImg = new Kinetic.Image({
        x: 0,
        y: 0,
        image: images.darthVader,
        width: 200,
        height: 138,
        name: 'image'
    });

    darthVaderGroup.add(darthVaderImg);
    addAnchor(darthVaderGroup, 0, 0, 'topLeft');
    addAnchor(darthVaderGroup, 200, 0, 'topRight');
    addAnchor(darthVaderGroup, 200, 138, 'bottomRight');
    addAnchor(darthVaderGroup, 0, 138, 'bottomLeft');

    darthVaderGroup.on('dragstart', function () {
        this.moveToTop();
    });
    // yoda
    var yodaImg = new Kinetic.Image({
        x: 0,
        y: 0,
        image: images.yoda,
        width: 93,
        height: 104,
        name: 'image'
    });

    yodaGroup.add(yodaImg);
    addAnchor(yodaGroup, 0, 0, 'topLeft');
    addAnchor(yodaGroup, 93, 0, 'topRight');
    addAnchor(yodaGroup, 93, 104, 'bottomRight');
    addAnchor(yodaGroup, 0, 104, 'bottomLeft');

    yodaGroup.on('dragstart', function () {
        this.moveToTop();
    });

    stage.draw();
}

var sources = {
    darthVader: sketchIconActive,
    yoda: sketchIconDeactive
};