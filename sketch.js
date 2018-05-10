const intervalLabels = [
  'unison',
  'minor second',
  'major second',
  'minor third',
  'major third',
  'perfect fourth',
  'dimished fifth',
  'perfect fifth',
  'minor sixth',
  'major sixth',
  'minor seventh',
  'major seventh'
];

const noteLabels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let tuningArray = [1, 25 / 24, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

let allowedIntervals = intervalLabels;

// physics
let physics;
let notes;
let springs;

// display
let offset = 50; // x position of first note
let circlePos = [];
let equalTemperedCirclePos = [];

// UI
let springSliderArray = [];

function setup() {
  var canvas = createCanvas(windowWidth, 400);
  canvas.parent('sketch-holder');
  canvas.style('display', 'block');
  colorMode(HSB, 100);

  // display settings
  strokeWeight(2);
  pixelDensity(1);

  // create physics world
  physics = new VerletPhysics2D();

  tuningArray = tuningArray.map(ratioToCents);

  // initialize particles, and add to particle array
  notes = new notesObject();
  notes.initialize(tuningArray);
  notes.particleArray[0].lock(); // lock C note spatially

  // initialize springs
  springs = new springsObject();
  springs.initialize(tuningArray, 0.001);

  let button = createCheckbox('lock C', true);
  button.position(10, 10);
  button.mouseClicked(lockC);

  addHTML(); // adds HTML elements (sliders and checkboxes)

  updateCircles();
  equalTemperedCirclePositions();
}

function draw() {
  background(0, 0, 30);

  updateCircles();

  // draw springs
  stroke(200);
  for (let spring of physics.springs) {
    let noteAIndex = noteLabels.indexOf(spring.noteA);
    let noteBIndex = noteLabels.indexOf(spring.noteB);

    //let myHue = map(abs(noteAIndex-noteBIndex), 0, noteLabels.length, 0, 100);
    //stroke(myHue, 100, 100);

    line(spring.a.x, spring.a.y, spring.b.x, spring.b.y);

    line(
      circlePos[noteAIndex].x,
      circlePos[noteAIndex].y,
      circlePos[noteBIndex].x,
      circlePos[noteBIndex].y
    );
  }

  noStroke();
  notes.update(); // draw notes and update frequencues

  physics.update(); // update positions, etc.

  // interactivity: set position of particle close to mouse
  if (mouseIsPressed) {
    moveNearbyNodeToMouse();
  }
}

// helper functions

function centsToFreq(cents_from_c) {
  let cfreq = 261.63; // absolute frequency of C
  return cfreq * pow(2, cents_from_c / 1200);
}

function centsToPos(cents_from_c) {
  return map(cents_from_c, 0, 1200, offset, width - offset);
}

function posToCents(position) {
  return map(position, offset, width - offset, 0, 1200);
}

function ratioToCents(ratio) {
  return 1200 * log(ratio) / log(2);
}

// UI update function: set spring stiffness

function adjustSpringStiffness() {
  springs.adjustSpringsByInterval(this.interval, this.value() / 1000);
}

// UI update function: enables and disables
// oscillators/particles/springs
// for a given note

function toggleNote() {
  if (!this.pressed) {
    notes.addNote(this.index);
    this.pressed = true;
  } else {
    notes.removeNote(this.index);
    this.pressed = false;
  }
}

// UI update function: adds or removes all the springs for a musical interval

function toggleSpring() {
  if (this.checked()) {
    springs.addSpringsByInterval(this.interval);
    // add checked interval to list of allowed intervals
    if (!allowedIntervals.includes(this.interval)) {
      allowedIntervals.push(this.interval);
    }
  } else {
    springs.removeSpringsByInterval(this.interval);
    // remove checked interval from list of allowed intervals
    let myIndex = allowedIntervals.indexOf(this.interval);
    if (myIndex > -1) {
      allowedIntervals.splice(myIndex, 1);
    }
  }
}

// UI update function: locks C note

function lockC() {
  if (this.checked()) {
    notes.particleArray[0].x = centsToPos(0); // reset c positions
    notes.particleArray[0].lock(); // lock c note
  } else {
    notes.particleArray[0].unlock(); // unlock c note
  }
}

// mouse interaction

function moveNearbyNodeToMouse() {
  var mousePos = createVector(mouseX, mouseY);
  var whichParticleToChange = -1;
  var count = 0;
  for (var myParticle of physics.particles) {
    var myParticlePos = createVector(myParticle.x, myParticle.y);
    if (mousePos.dist(myParticlePos) < 50) {
      whichParticleToChange = count;
    }
    count++;
  }
  if (whichParticleToChange >= 0) {
    physics.particles[whichParticleToChange].x = mouseX;
  }
}

// each note is an object
function notesObject() {
  this.particleArray;
  this.activeNotes; // TODO: add this later

  this.reset = function() {
    this.particleArray = [];
  };

  this.initialize = function(tuningArray) {
    this.reset();

    for (let myNote of tuningArray) {
      let myParticle = new VerletParticle2D(
        centsToPos(myNote),
        7.5 * height / 8
      );

      myParticle.freq = centsToFreq(myNote);

      let newOsc = new p5.Oscillator();
      newOsc.setType('sawtooth');
      newOsc.freq(myParticle.freq);
      newOsc.amp(0);
      newOsc.start();

      myParticle.osc = newOsc;

      myParticle.noteLabel = noteLabels[tuningArray.indexOf(myNote)];

      this.particleArray.push(myParticle);
    }
  };

  this.update = function() {
    for (let myParticle of this.particleArray) {
      if (physics.particles.includes(myParticle)) {
        let noteIndex = noteLabels.indexOf(myParticle.noteLabel);
        let myHue = map(noteIndex, 0, noteLabels.length, 0, 100);

        fill(myHue, 100, 100, 20);
        ellipse(
          equalTemperedCirclePos[noteIndex].x,
          equalTemperedCirclePos[noteIndex].y,
          20
        );

        fill(myHue, 100, 100);
        ellipse(myParticle.x, myParticle.y, 20); // draw notes
        ellipse(circlePos[noteIndex].x, circlePos[noteIndex].y, 20);

        this.updateFreq(noteIndex); // update frequency
      }
    }
  };

  this.addParticle = function(index) {
    let myParticle = this.particleArray[index];

    if (!physics.particles.includes(myParticle)) {
      physics.addParticle(myParticle);
    }
  };

  this.removeParticle = function(index) {
    let myParticle = this.particleArray[index];

    if (physics.particles.includes(myParticle)) {
      physics.removeParticle(myParticle);
    }
  };

  this.mute = function(index) {
    let myParticle = this.particleArray[index];
    myParticle.osc.amp(0, 0.01);
  };

  this.play = function(index) {
    let myParticle = this.particleArray[index];
    myParticle.osc.amp(0.5, 0.01);
  };

  this.addNote = function(index) {
    this.addParticle(index);
    this.play(index);
    springs.addSpringsByNote(noteLabels[index]);
    updateSpringSliders();
  };

  this.removeNote = function(index) {
    this.removeParticle(index);
    this.mute(index);
    springs.removeSpringsByNote(noteLabels[index]);
    updateSpringSliders();
  };

  this.updateFreq = function(index) {
    let myParticle = this.particleArray[index];
    myParticle.osc.freq(centsToFreq(posToCents(myParticle.x)), 0.01);
  };
}

function springsObject() {
  this.springArray;

  this.reset = function() {
    this.springArray = [];
  };

  this.initialize = function(tuningArray, defaultStiffness = 0.001) {
    this.reset();

    for (let i = 0; i < tuningArray.length; i++) {
      for (let j = 0; j < i; j++) {
        let newSpring = new VerletSpring2D(
          notes.particleArray[i],
          notes.particleArray[j],
          centsToPos(tuningArray[i - j]) - centsToPos(1),
          defaultStiffness
        );

        newSpring.interval = intervalLabels[i - j];
        newSpring.noteA = noteLabels[i];
        newSpring.noteB = noteLabels[j];

        this.springArray.push(newSpring);
      }
    }
  };

  this.addSpring = function(whichSpring) {
    if (!physics.springs.includes(whichSpring)) {
      if (
        physics.particles.includes(whichSpring.a) &&
        physics.particles.includes(whichSpring.b)
      ) {
        physics.addSpring(whichSpring);
      }
    }
  };

  this.removeSpring = function(whichSpring) {
    if (physics.springs.includes(whichSpring)) {
      physics.removeSpring(whichSpring);
    }
  };

  this.addSpringsByNote = function(whichNote) {
    for (let mySpring of this.springArray) {
      if (mySpring.noteA == whichNote || mySpring.noteB == whichNote) {
        if (allowedIntervals.includes(mySpring.interval)) {
          this.addSpring(mySpring);
        }
      }
    }
  };

  this.removeSpringsByNote = function(whichNote) {
    for (let mySpring of this.springArray) {
      if (mySpring.noteA == whichNote || mySpring.noteB == whichNote) {
        this.removeSpring(mySpring);
      }
    }
  };

  this.addSpringsByInterval = function(whichInterval) {
    for (let mySpring of this.springArray) {
      if (mySpring.interval == whichInterval) {
        this.addSpring(mySpring);
      }
    }
  };

  this.removeSpringsByInterval = function(whichInterval) {
    for (let mySpring of this.springArray) {
      if (mySpring.interval == whichInterval) {
        this.removeSpring(mySpring);
      }
    }
  };

  this.adjustSpringsByInterval = function(whichInterval, stiffness) {
    for (let mySpring of this.springArray) {
      if (mySpring.interval == whichInterval) {
        mySpring.setStrength(stiffness);
      }
    }
  };
}

// adds HTML elements

function addHTML() {
  for (let myNote of noteLabels) {
    let noteIndex = noteLabels.indexOf(myNote);

    // UI elements (checkboxes)
    let key = select('#' + myNote);
    key.index = noteIndex;
    key.pressed = false;
    key.mouseClicked(toggleNote);

    let myCircle = createDiv('');
    myCircle.size(10, 10);
    let myHue = map(noteIndex, 0, noteLabels.length, 0, 100);
    myCircle.style('background', color(myHue, 100, 100));
    myCircle.style('border-radius', '5px');
    myCircle.style('width', '10px');
    myCircle.style('margin', 'auto auto 0');

    key.child(myCircle);
  }

  for (let myInterval of intervalLabels) {
    let springwrapper = createDiv('');
    springwrapper.parent('#springsliders');

    // UI elements (sliders)
    let springCheckbox = createCheckbox(myInterval + ' spring', true);
    springCheckbox.style('display', 'none');
    springCheckbox.interval = myInterval;
    springCheckbox.changed(toggleSpring);
    springCheckbox.parent(springwrapper);

    let springSlider = createSlider(1, 1000, 1);
    springSlider.style('display', 'none');
    springSlider.interval = myInterval;
    springSlider.changed(adjustSpringStiffness);
    springSlider.parent(springwrapper);

    springSliderArray.push({
      interval: myInterval,
      checkbox: springCheckbox,
      slider: springSlider
    });
  }
}

function updateSpringSliders() {
  // make a list of intervals currently possible

  let currentIntervals = [];

  for (let mySpring of springs.springArray) {
    if (
      physics.particles.includes(mySpring.a) &&
      physics.particles.includes(mySpring.b)
    ) {
      currentIntervals.push(mySpring.interval);
    }
  }

  // and add sliders for all these intervals
  for (let mySpringSlider of springSliderArray) {
    mySpringSlider.checkbox.style('display', 'none');
    mySpringSlider.slider.style('display', 'none');
  }

  for (let mySpringSlider of springSliderArray) {
    if (currentIntervals.includes(mySpringSlider.interval)) {
      mySpringSlider.checkbox.style('display', 'inline');
      mySpringSlider.slider.style('display', 'inline');
    }
  }
}

// chrome fix

function touchStarted() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
}

function updateCircles() {
  circlePos = [];

  let xCenter = width / 2;
  let yCenter = 7 / 8 * height / 2;
  let circleRadius = 0.75 * min(width / 2, height / 2);

  for (let myParticle of notes.particleArray) {
    let myAngle = map(posToCents(myParticle.x), 0, 1200, 0, 360) + 90;
    myAngle = radians(myAngle);

    circlePos.push({
      x: xCenter - circleRadius * cos(myAngle),
      y: yCenter - circleRadius * sin(myAngle)
    });
  }
}

function equalTemperedCirclePositions() {
  equalTemperedCirclePos = [];

  let xCenter = width / 2;
  let yCenter = 7 / 8 * height / 2;
  let circleRadius = 0.75 * min(width / 2, height / 2);

  for (let i = 0; i < noteLabels.length; i++) {
    let myAngle = map(i * 100, 0, 1200, 0, 360) + 90;
    myAngle = radians(myAngle);

    equalTemperedCirclePos.push({
      x: xCenter - circleRadius * cos(myAngle),
      y: yCenter - circleRadius * sin(myAngle)
    });
  }
}
