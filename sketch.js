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

let tuningArray = [25 / 24, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8, 2];
//let tuningArray = [16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, Math.sqrt(2), 3 / 2, 8 / 5, 5 / 3, 16 / 9, 15 / 8, 2];

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

const roundTwo = num => round(num * 100) / 100;

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

  equalTemperedCirclePos = circlePositions(
    noteLabels.map((val, index) => index),
    indexToAngle
  );

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
  return myFreq;
}

function noteToCents(whichNote) {
  return freqToCents(noteToFreq(whichNote));
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
    sim.springArray
      .filter(spring => spring.interval === this.interval)
      .forEach(spring => (spring.allowed = true));
  } else {
    sim.removeSpringsByInterval(this.interval);
    sim.springArray
      .filter(spring => spring.interval === this.interval)
      .forEach(spring => (spring.allowed = false));
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

function logNotes() {
  const add = (x, y) => x + y;

  const getNoteIndex = note => noteLabels.indexOf(note);
  const myCentOffset = myNote =>
    (getNoteIndex('C4') - getNoteIndex(myNote)) * 100;

  let noteArray = physics.particles
    .map(particle => ({
      label: particle.noteLabel,
      freq: posToCents(particle.x) + 1200,// + myCentOffset(particle.noteLabel),
      index: getNoteIndex(particle.noteLabel)
    }))
    .sort((note1, note2) => note1.index - note2.index);

  //console.log('Current Notes (deviation in cents from ET)');
  //console.log(noteArray.map(x => x.freq));
  //noteArray.forEach(arr => console.log(arr.label + ' : ' + roundTwo(arr.freq)));

  //let mySum = noteArray.map(x => abs(x.freq)).reduce(add);
  //console.log('Total deviation from ET: ' + mySum);

  let indexArray = noteArray.map(e => e.index);

  const phi1 = k =>
    noteArray
      //.map((e, i) => tuningArray[indexArray[i - k - 1]])
      .map((e, i) => tuningArray[indexArray[i] - indexArray[k] - 1])
      .filter((e, i) => i > k)
      .reduce(add, 0);

  const phi2 = k =>
    noteArray
      //.map((e, i) => tuningArray[indexArray[k - i - 1]])
      .map((e, i) => tuningArray[indexArray[k] - indexArray[i] - 1])
      .filter((e, i) => i < k)
      .reduce(add, 0);

  const phi = k => phi1(k) - phi2(k);

  let a0 = noteArray[0].freq;
  let phi0 = phi(0);

  let predictedArray = noteArray.map(
    (e, i, self) => a0 + (phi0 - phi(i)) / self.length
  );

  console.log('Note\tCurrent\tPredicted')
  noteArray.forEach((arr, i) =>
    console.log(
      arr.label +
        '\t\t' +
        roundTwo(arr.freq) +
        '\t\t' +
        roundTwo(predictedArray[i])
    )
  );

  // this seems to work, but only for consecutive notes, or equally spaced notes

  /*
  const getIntervalIndex = interval => intervalLabels.indexOf(interval);
  let intervalArray = physics.springs
    .filter(spring => (spring.allowed = true))
    .map(spring => spring.interval)
    .sort((int1, int2) => getIntervalIndex(int1) - getIntervalIndex(int2))
    .filter((e, i, self) => i == self.indexOf(e)) // removes duplicates
    .map(int => tuningArray[intervalLabels.indexOf(int)]);

  console.log(noteArray[0].label + ' : ' + 0);
  let n = noteArray.length;
  for (let k = 1; k < n; k++) {
    let sum = 0;
    for (let i = 1; i <= k; i++) {
      sum += intervalArray[i - 1] + intervalArray[n - i - 1];
    }
    console.log(noteArray[k].label + ' : ' + roundTwo(sum / n));
  }
  */
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
      newOsc.freq(roundTwo(myParticle.freq));
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
    this.addSpringsByNote(whichParticle);
    updateSpringSliders();
  };

  this.removeNote = function(whichParticle) {
    this.removeParticle(whichParticle);
    this.mute(whichParticle);
    this.removeSpringsByNote(whichParticle);
    updateSpringSliders();
  };

  this.updateFreq = function(myParticle) {
    myParticle.osc.freq(roundTwo(centsToFreq(posToCents(myParticle.x))), 0.01);
  };

  this.initializeSprings = function(tuningArray, defaultStiffness = 0.001) {
    this.springArray = [];

    for (let i = 0; i < noteLabels.length; i++) {
      for (let j = 0; j < i; j++) {
        let centOffset = 0;

        if (i - j > 12) {
          centOffset = 1200 * floor((i - j - 1) / 12);
        }

        // centsToPos(x+1) - centsToPos(1) scales the springLength
        // by the correct factor
        let springLength =
          centsToPos(tuningArray[(i - j - 1) % 12] + centOffset + 1) -
          centsToPos(1);

        let newSpring = new VerletSpring2D(
          this.particleArray[i],
          this.particleArray[j],
          springLength,
          defaultStiffness
        );

        newSpring.interval = intervalLabels[(i - j - 1) % 12];
        newSpring.allowed = true;
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
      .filter(spring => spring.allowed == true)
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
    this.springsByInterval(
      spring => spring.setStrength(stiffness),
      whichInterval
    );
  };
}

function addHTML() {
  let button = createCheckbox('lock C', true);
  button.position(10, 10);
  button.mouseClicked(lockC);

  let button2 = createButton('log notes');
  button2.position(10, 50);
  button2.mouseClicked(logNotes);

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

    let springSlider = createSlider(1, 900, 1);
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
  // hide all sliders
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

  // only show sliders for those intervals
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
  return myArray.map(index => ({
    x: xCenter - circleRadius * cos(indexToAngleFunction(index)),
    y: yCenter - circleRadius * sin(indexToAngleFunction(index))
  }));
}
