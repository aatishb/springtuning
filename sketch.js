const intervalLabels = [
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
  'major seventh',
  'octave'
];

let noteLabelsInAnOctave = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let octaves = [3, 4, 5];
let noteLabels = [];

const cFreq = 261.6255653;

let tuningArray = [25 / 24, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8, 2];

let allowedIntervals = intervalLabels;

// physics
let physics;
let sim;

// display
let offset = 50; // x position of first note
let circlePos = [];
let equalTemperedCirclePos = [];

// UI
let springSliderArray = [];
let grabbedParticle;

function setup() {
  var canvas = createCanvas(windowWidth, 400);
  canvas.parent('sketch-holder');
  canvas.style('display', 'block');
  colorMode(HSB, 100);

  // display settings
  strokeWeight(2);

  // create physics world
  physics = new VerletPhysics2D();

  tuningArray = tuningArray.map(ratioToCents);

  // initialize particles, and add to particle array
  sim = new particleSpringSystem();
  sim.initializeParticles();
  sim.particleArray[0].lock(); // lock C note spatially

  // initialize springs
  sim.initializeSprings(tuningArray, 0.001);

  addHTML(); // adds HTML elements (sliders and checkboxes)

  equalTemperedCirclePositions();
}

function draw() {
  background(0, 0, 30);

  updateCircles();

  // draw springs
  for (let spring of physics.springs) {
    let noteAIndex = noteLabels.indexOf(spring.noteA);
    let noteBIndex = noteLabels.indexOf(spring.noteB);

    //let myHue = map(abs(noteAIndex-noteBIndex), 0, noteLabels.length, 0, 100);
    let restLength = spring.getRestLength();
    let currentLength = spring.a.distanceTo(spring.b);
    let percentExtended = 100 * (currentLength / restLength) - 100;

    let mySat = 0;
    let myHue = 0;
    if (percentExtended > 0) {
      myHue = 100;
      mySat = map(percentExtended, 0, 10, 0, 100);
    }
    if (percentExtended < 0) {
      myHue = 64;
      mySat = map(percentExtended, -10, 0, 100, 0);
    }
    //console.log(percentExtended + ' : ' + myHue);

    stroke(myHue, mySat, 94);

    line(spring.a.x, spring.a.y, spring.b.x, spring.b.y);

    line(
      circlePos[noteAIndex].x,
      circlePos[noteAIndex].y,
      circlePos[noteBIndex].x,
      circlePos[noteBIndex].y
    );
  }

  noStroke();
  sim.updateNotes(); // draw notes and update frequencies
  physics.update(); // update positions, etc.
}

// helper functions

function noteToFreq(whichNote) {
  let whichNoteInAnOctave = whichNote.slice(0, -1);
  let whichOctave = int(whichNote.slice(-1));
  let noteIndex = noteLabelsInAnOctave.indexOf(whichNoteInAnOctave);
  let myFreq = cFreq * pow(2, noteIndex / 12) * pow(2, whichOctave - 4);
  return round(myFreq * 100) / 100;
}

function noteToCents(whichNote) {
  return round(freqToCents(noteToFreq(whichNote)));
}

function freqToCents(noteFreq) {
  return ratioToCents(noteFreq / cFreq);
}

function centsToFreq(cents_from_c4) {
  return cFreq * pow(2, cents_from_c4 / 1200);
}

function centsToPos(cents_from_c4) {
  return map(cents_from_c4, -1200, 2400, offset, width - offset);
}

function posToCents(position) {
  return map(position, offset, width - offset, -1200, 2400);
}

function ratioToCents(ratio) {
  return 1200 * log(ratio) / log(2);
}

// UI update function: enables and disables a given note

function toggleKey() {
  if (!this.pressed) {
    pressKey(this);
  } else {
    releaseKey(this);
  }
}

function pressKey(key) {
  sim.addNote(key.index);
  key.pressed = true;

  // TODO: there's probably a better way to do this
  if (key.originalColor == 'rgb(255, 255, 255)') {
    key.style('background-color', color(55, 20, 100));
  } else if (key.originalColor == 'rgb(34, 34, 34)') {
    key.style('background-color', color(55, 20, 65));
  }
}

function releaseKey(key) {
  sim.removeNote(key.index);
  key.pressed = false;
  key.style('background-color', key.originalColor);
}

// UI update function: adds or removes all the springs for a musical interval

function toggleSpring() {
  if (this.checked()) {
    sim.addSpringsByInterval(this.interval);
    // add checked interval to list of allowed intervals
    if (!allowedIntervals.includes(this.interval)) {
      allowedIntervals.push(this.interval);
    }
  } else {
    sim.removeSpringsByInterval(this.interval);
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
    sim.particleArray[0].x = centsToPos(-1200); // reset c positions
    sim.particleArray[0].lock(); // lock c note
  } else {
    sim.particleArray[0].unlock(); // unlock c note
  }
}

// mouse interaction

function touchStarted() {
  // chrome fix
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }

  var mousePos = createVector(mouseX, mouseY);
  for (var myParticle of physics.particles) {
    var myParticlePos = createVector(myParticle.x, myParticle.y);
    if (mousePos.dist(myParticlePos) < 20) {
      if (!myParticle.isLocked) {
        grabbedParticle = myParticle;
      }
    }
  }
}

function touchMoved() {
  if (grabbedParticle) {
    grabbedParticle.lock();
    grabbedParticle.x = mouseX;
  }
}

function touchEnded() {
  if (grabbedParticle) {
    grabbedParticle.unlock();
    grabbedParticle = false;
  }
}

function particleSpringSystem() {
  this.particleArray = [];
  this.springArray = [];

  this.initializeParticles = function() {
    this.particleArray = [];

    for (let myOctave of octaves) {
      for (let myNote of noteLabelsInAnOctave) {
        noteLabels.push(myNote + myOctave);
      }
    }

    for (let myNote of noteLabels) {
      /*
      console.log(
        myNote + ' ' +noteToFreq(myNote) + ' Hz '
        + noteToCents(myNote) + ' cents'
      );
      */

      let myParticle = new VerletParticle2D(
        centsToPos(noteToCents(myNote)),
        7.5 * height / 8
      );

      myParticle.freq = noteToFreq(myNote);

      let newOsc = new p5.Oscillator();
      newOsc.setType('sawtooth');
      newOsc.freq(myParticle.freq);
      newOsc.amp(0);
      newOsc.start();
      myParticle.osc = newOsc;

      myParticle.noteLabel = myNote;

      this.particleArray.push(myParticle);
    }
  };

  this.updateNotes = function() {
    for (let myParticle of this.particleArray) {
      if (physics.particles.includes(myParticle)) {
        let noteIndex = noteLabels.indexOf(myParticle.noteLabel);
        let myHue = map(noteIndex % 12, 0, 12, 0, 100);

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
    sim.addSpringsByNote(noteLabels[index]);
    updateSpringSliders();
  };

  this.removeNote = function(index) {
    this.removeParticle(index);
    this.mute(index);
    sim.removeSpringsByNote(noteLabels[index]);
    updateSpringSliders();
  };

  this.updateFreq = function(index) {
    let myParticle = this.particleArray[index];
    myParticle.osc.freq(centsToFreq(posToCents(myParticle.x)), 0.01);
  };

  this.initializeSprings = function(tuningArray, defaultStiffness = 0.001) {
    this.springArray = [];

    for (let i = 0; i < noteLabels.length; i++) {
      for (let j = 0; j < i; j++) {
        let centOffset = 0;

        if (i - j > 12) {
          centOffset = 1200 * floor((i - j - 1) / 12);
        }

        let springLength =
          centsToPos(tuningArray[(i - j - 1) % 12] + centOffset) -
          centsToPos(1);

        let newSpring = new VerletSpring2D(
          this.particleArray[i],
          this.particleArray[j],
          springLength,
          defaultStiffness
        );

        newSpring.interval = intervalLabels[(i - j - 1) % 12];
        newSpring.noteA = noteLabels[i];
        newSpring.noteB = noteLabels[j];

        /*
        console.log('i: '+i + ' j:' + j + ' i-j: '+ (i-j) + ' offset: ' + centOffset);
        console.log(round(springLength) + ' ' + newSpring.interval);
        */

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
  let button = createCheckbox('lock C', true);
  button.position(10, 10);
  button.mouseClicked(lockC);

  for (let myNote of noteLabels) {
    let noteIndex = noteLabels.indexOf(myNote);

    // UI elements (checkboxes)
    let key = select('#' + myNote);
    key.index = noteIndex;
    key.pressed = false;
    key.originalColor = key.style('background-color');
    key.mouseClicked(toggleKey);

    let myCircle = createDiv('');
    myCircle.size(10, 10);
    let myHue = map(noteIndex % 12, 0, 12, 0, 100);
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

// UI update function: set spring stiffness

function adjustSpringStiffness() {
  sim.adjustSpringsByInterval(this.interval, this.value() / 1000);
}

function updateSpringSliders() {
  // make a list of intervals currently possible

  let currentIntervals = [];

  for (let mySpring of sim.springArray) {
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

function updateCircles() {
  circlePos = [];

  let xCenter = width / 2;
  let yCenter = 7 / 8 * height / 2;
  let circleRadius = 0.75 * min(width / 2, height / 2);

  for (let myParticle of sim.particleArray) {
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
    let myAngle = map((i * 100) % 1200, 0, 1200, 0, 360) + 90;
    myAngle = radians(myAngle);

    equalTemperedCirclePos.push({
      x: xCenter - circleRadius * cos(myAngle),
      y: yCenter - circleRadius * sin(myAngle)
    });
  }
}
