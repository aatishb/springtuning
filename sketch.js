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

let notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let octaves = [3, 4, 5];
let noteLabels = [];

const cFreq = 261.6255653;

//let tuningArray = [25 / 24, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8, 2];
let tuningArray = [16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, Math.sqrt(2), 3 / 2, 8 / 5, 5 / 3, 16 / 9, 15 / 8, 2];

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
let stats;

const indexToAngle = index =>
  radians(map((index * 100) % 1200, 0, 1200, 0, 360) + 90);

const posToAngle = position =>
  radians(map(posToCents(position), 0, 1200, 0, 360) + 90);

function setup() {
  var t0 = performance.now();
  var canvas = createCanvas(windowWidth, 400);
  canvas.parent('sketch-holder');
  canvas.style('display', 'block');
  colorMode(HSB, 100);

  // display settings
  strokeWeight(2);

  // create physics world
  physics = new VerletPhysics2D();

  tuningArray = tuningArray.map(ratioToCents);

  noteLabels = octaves
    .map(octave => notes.map(note => note + octave))
    .reduce(concat);

  // initialize particles, and add to particle array
  sim = new particleSpringSystem();
  sim.initializeParticles();
  sim.particleArray[0].lock(); // lock C note spatially

  // initialize springs
  sim.initializeSprings(tuningArray, 0.001);

  addHTML(); // adds HTML elements (sliders and checkboxes)
  stats = new Stats();
  let statsdiv = new p5.Element(stats.dom);
  select('#stats-holder').child(statsdiv);

  equalTemperedCirclePos = circlePositions(noteLabels, indexToAngle);

  var t1 = performance.now();
  console.log('Setup took ' + (t1 - t0) + ' milliseconds.');
}

function draw() {
  stats.begin();
  background(0, 0, 30);
  sim.drawSprings();
  sim.updateNotes(); // draw notes and update frequencies
  physics.update(); // update physics simulation
  stats.end();
}

// helper functions
function noteToFreq(whichNote) {
  let whichNoteInAnOctave = whichNote.slice(0, -1);
  let whichOctave = int(whichNote.slice(-1));
  let noteIndex = notes.indexOf(whichNoteInAnOctave);
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
  !this.pressed ? pressKey(this) : releaseKey(this);
}

function pressKey(key) {
  sim.addNote(key.particle);
  key.pressed = true;

  // TODO: there's probably a better way to do this
  if (key.originalColor == 'rgb(255, 255, 255)') {
    key.style('background-color', color(55, 20, 100));
  } else if (key.originalColor == 'rgb(34, 34, 34)') {
    key.style('background-color', color(55, 20, 65));
  }
}

function releaseKey(key) {
  sim.removeNote(key.particle);
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

  const distToParticle = (particle, position) =>
    position.dist(createVector(particle.x, particle.y));

  grabbedParticle = physics.particles.find(
    particle => distToParticle(particle, mousePos) < 20 && !particle.isLocked
  );
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
    this.particleArray = noteLabels.map(myNote => {
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

      return myParticle;
    });
  };

  this.drawNotes = function(myParticle) {
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
  };

  this.updateNotes = function() {
    noStroke();
    this.particleArray
      .filter(particle => physics.particles.includes(particle))
      .forEach(myParticle => {
        this.drawNotes(myParticle);
        this.updateFreq(myParticle);
      });
  };

  this.addParticle = function(myParticle) {
    if (!physics.particles.includes(myParticle)) {
      physics.addParticle(myParticle);
    }
  };

  this.removeParticle = function(myParticle) {
    if (physics.particles.includes(myParticle)) {
      physics.removeParticle(myParticle);
    }
  };

  this.mute = function(myParticle) {
    // TODO: check if osc exists
    myParticle.osc.amp(0, 0.01);
  };

  this.play = function(myParticle) {
    // TODO: check if osc exists
    myParticle.osc.amp(0.5, 0.01);
  };

  this.addNote = function(whichParticle) {
    this.addParticle(whichParticle);
    this.play(whichParticle);
    sim.addSpringsByNote(whichParticle);
    updateSpringSliders();
  };

  this.removeNote = function(whichParticle) {
    this.removeParticle(whichParticle);
    this.mute(whichParticle);
    sim.removeSpringsByNote(whichParticle);
    updateSpringSliders();
  };

  this.updateFreq = function(myParticle) {
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

        this.springArray.push(newSpring);
      }
    }
  };

  this.drawSprings = function() {
    // draw springs
    circlePos = circlePositions(
      sim.particleArray.map(particle => particle.x),
      posToAngle
    );

    physics.springs.forEach(spring => {
      let restLength = spring.getRestLength();
      let currentLength = spring.a.distanceTo(spring.b);
      let percentExtended = 100 * (currentLength / restLength) - 100;

      const isExtended = x =>
        x > 0
          ? stroke(100, map(x, 0, 10, 0, 100), 94)
          : x == 0
            ? stroke(0, 0, 94)
            : stroke(64, map(x, -10, 0, 100, 0), 94);

      isExtended(percentExtended);

      line(spring.a.x, spring.a.y, spring.b.x, spring.b.y);

      let noteAIndex = noteLabels.indexOf(spring.noteA);
      let noteBIndex = noteLabels.indexOf(spring.noteB);

      line(
        circlePos[noteAIndex].x,
        circlePos[noteAIndex].y,
        circlePos[noteBIndex].x,
        circlePos[noteBIndex].y
      );
    });
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

  this.springsByNote = function(whichFunction, myParticle) {
    const includesNote = (spring, myParticle) =>
      spring.a == myParticle || spring.b == myParticle;

    this.springArray
      .filter(spring => includesNote(spring, myParticle))
      .filter(spring => allowedIntervals.includes(spring.interval))
      .forEach(spring => whichFunction(spring));
  };

  this.addSpringsByNote = function(myParticle) {
    this.springsByNote(this.addSpring, myParticle);
  };

  this.removeSpringsByNote = function(myParticle) {
    this.springsByNote(this.removeSpring, myParticle);
  };

  this.springsByInterval = function(whichFunction, whichInterval) {
    const includesInterval = (spring, whichInterval) =>
      spring.interval === whichInterval;

    this.springArray
      .filter(spring => includesInterval(spring, whichInterval))
      .forEach(spring => whichFunction(spring));
  };

  this.addSpringsByInterval = function(whichInterval) {
    this.springsByInterval(this.addSpring, whichInterval);
  };

  this.removeSpringsByInterval = function(whichInterval) {
    this.springsByInterval(this.removeSpring, whichInterval);
  };

  this.adjustSpringsByInterval = function(whichInterval, stiffness) {
    const springAdjuster = spring => spring.setStrength(stiffness);
    this.springsByInterval(springAdjuster, whichInterval);
  };
}

function addHTML() {
  let button = createCheckbox('lock C', true);
  button.position(10, 10);
  button.mouseClicked(lockC);

  sim.particleArray.forEach((particle, index) => {
    let key = select('#' + noteLabels[index]);
    key.particle = particle;
    key.pressed = false;
    key.originalColor = key.style('background-color');
    key.mouseClicked(toggleKey);

    let myCircle = createDiv('');
    myCircle.size(10, 10);
    let myHue = map(index % 12, 0, 12, 0, 100);
    myCircle.style('background', color(myHue, 100, 100));
    myCircle.style('border-radius', '5px');
    myCircle.style('width', '10px');
    myCircle.style('margin', 'auto auto 0');

    key.child(myCircle);
  });

  springSliderArray = intervalLabels.map(myInterval => {
    let springwrapper = createDiv('');
    springwrapper.parent('#springsliders');

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

    return {
      interval: myInterval,
      checkbox: springCheckbox,
      slider: springSlider
    };
  });
}

// UI update function: set spring stiffness

function adjustSpringStiffness() {
  sim.adjustSpringsByInterval(this.interval, this.value() / 1000);
}

function updateSpringSliders() {
  // and add sliders for all these intervals
  springSliderArray.forEach(mySlider => {
    mySlider.checkbox.style('display', 'none');
    mySlider.slider.style('display', 'none');
  });

  const endpointsOnScreen = mySpring =>
    physics.particles.includes(mySpring.a) &&
    physics.particles.includes(mySpring.b);

  // make a list of intervals currently possible
  let currentIntervals = sim.springArray
    .filter(spring => endpointsOnScreen(spring))
    .map(spring => spring.interval);

  springSliderArray
    .filter(mySlider => currentIntervals.includes(mySlider.interval))
    .forEach(mySlider => {
      mySlider.checkbox.style('display', 'inline');
      mySlider.slider.style('display', 'inline');
    });
}

function circlePositions(
  myArray,
  indexToAngleFunction,
  xCenter = width / 2,
  yCenter = 7 / 8 * height / 2,
  circleRadius = 0.75 * min(width / 2, height / 2)
) {
  const indexToAngle = indexToAngleFunction;

  return myArray.map(index => ({
    x: xCenter - circleRadius * cos(indexToAngle(index)),
    y: yCenter - circleRadius * sin(indexToAngle(index))
  }));
}
