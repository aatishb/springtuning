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
  'major seventh',
  'octave'
];

let notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let octaves = [3, 4, 5];
let noteLabels = [];

const cFreq = 261.6255653;

// prettier-ignore
let tunings = {
  'common just': [1/1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8, 2/1],
  'symmetric': [1/1, 16/15, 9/8, 6/5, 5/4, 4/3, Math.sqrt(2), 3/2, 8/5, 5/3, 16/9,  15/8,  2/1],
  'overtone': [1/1, 17/16, 9/8, 19/16, 5/4, 21/16, 11/8, 3/2, 13/8, 27/16, 7/4, 15/8, 2/1],
  'well tuned piano': [1/1, 567/512, 9/8, 147/128, 21/16, 1323/1024, 189/128, 3/2, 49/32, 7/4, 441/256, 63/32, 2/1],
  'pythagorean': [1/1, 256/243, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128, 2/1]
};

// physics
let physics;
let sim;
let springStates = { Remove: 0, Flexible: 0.001, Rigid: 1 };

// display
let offset = 50; // x position of first note
let circlePos = [];
let equalTemperedCirclePos = [];

// UI
let grabbedParticle;
let stats, gui;

const roundTwo = num => round(num * 100) / 100;

const indexToAngle = index =>
  radians(map((index * 100) % 1200, 0, 1200, 0, 360) + 90);

const posToAngle = position =>
  radians(map(posToCents(position), 0, 1200, 0, 360) + 90);

function setup() {
  var t0 = performance.now();

  let keyboard = select('#keyboard');
  var canvas = createCanvas(windowWidth, 0.9 * windowHeight - keyboard.height);
  canvas.parent('sketch-holder');
  canvas.style('display', 'block');

  // display settings
  colorMode(HSB, 100);
  strokeWeight(2);

  // create physics world
  physics = new VerletPhysics2D();

  noteLabels = octaves
    .map(octave => notes.map(note => note + octave))
    .reduce(concat);

  // initialize particles, and add to particle array
  sim = new particleSpringSystem();
  sim.initializeParticles();

  sim.lockedNotes['C3'] = true;
  sim.lockNote('C3');

  sim.setTuning('common just');

  // initialize springs
  sim.initializeSprings();

  addHTML(); // adds HTML elements (sliders and checkboxes)
  stats = new Stats();
  let statsdiv = new p5.Element(stats.dom);
  select('#stats-holder').child(statsdiv);

  gui = new dat.GUI();
  addGUI();

  equalTemperedCirclePos = circlePositions(
    noteLabels.map((val, index) => index),
    indexToAngle
  );

  if (navigator.requestMIDIAccess) {
    console.log('This browser supports WebMIDI!');
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  } else {
    console.log('WebMIDI is not supported in this browser.');
  }

  var t1 = performance.now();
  console.log('Setup took ' + (t1 - t0) + ' milliseconds.');
}

// MIDI input following https://www.smashingmagazine.com/2018/03/web-midi-api/
function onMIDISuccess(midiAccess){
  for (let input of midiAccess.inputs.values()){
    input.onmidimessage = getMIDIMessage;
  }
}

function onMIDIFailure(){
  console.log('Could not access your MIDI devices.');
}

function getMIDIMessage(message) {
  let command = message.data[0];
  let note = message.data[1] - 48;
  if (note >= 0 && note <= 3 * 12) {
    let key = sim.particleArray[note];
    // a velocity value might not be included with a noteOff command
    let velocity = message.data.length > 2 ? message.data[2] : 0;

    if (command == 144) {
      if (velocity > 0) {
        sim.addNote(key);
      } else {
        sim.removeNote(key);
      }
    } else if (command == 128) {
      sim.removeNote(key);
    }
  }
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

function noteToPos(whichNote) {
  return centsToPos(noteToCents(whichNote));
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
  this.tuningArray = [];
  this.springTuning = '';

  this.setTuning = function(choice) {
    this.springTuning = choice;
    this.tuningArray = tunings[choice].map(ratioToCents);
  };

  this.initializeParticles = function() {
    this.particleArray = noteLabels.map(myNote => {
      let myParticle = new VerletParticle2D(
        noteToPos(myNote),
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
    updateGUI();
  };

  this.removeNote = function(whichParticle) {
    this.removeParticle(whichParticle);
    this.mute(whichParticle);
    this.removeSpringsByNote(whichParticle);
    updateGUI();
  };

  this.lockNote = function(note) {
    let noteIndex = noteLabels.indexOf(note);

    if (this.lockedNotes[note]) {
      sim.particleArray[noteIndex].x = noteToPos(note);
      sim.particleArray[noteIndex].lock();
    } else {
      sim.particleArray[noteIndex].unlock();
    }
  };

  this.updateFreq = function(myParticle) {
    myParticle.osc.freq(roundTwo(centsToFreq(posToCents(myParticle.x))), 0.01);
  };

  // dict to keep track of locked notes
  this.lockedNotes = noteLabels.reduce((dict, item) => {
    dict[item] = false;
    return dict;
  }, {});

  // dict to keep track of spring stiffness (by interval)
  this.springStiffness = intervalLabels
    .filter((e, i) => i > 0)
    .reduce((dict, item) => {
      dict[item] = 0.001;
      return dict;
    }, {});

  this.initializeSprings = function() {
    this.springArray = [];

    for (let i = 0; i < noteLabels.length; i++) {
      for (let j = 0; j < i; j++) {
        let centOffset = 0;
        let octaveSize = 1200;

        if (i - j >= 12) {
          centOffset = octaveSize * floor((i - j) / 12);
        }

        // centsToPos(x+1) - centsToPos(1) scales the springLength
        // by the correct factor
        let springLength =
          centsToPos(this.tuningArray[(i - j) % 12] + centOffset + 1) -
          centsToPos(1);

        let whichInterval = intervalLabels[(i - j) % 12];
        if (whichInterval == 'unison') {
          whichInterval = 'octave';
        }

        let newSpring = new VerletSpring2D(
          this.particleArray[i],
          this.particleArray[j],
          springLength,
          this.springStiffness[whichInterval]
        );

        newSpring.interval = whichInterval;
        newSpring.allowed = true;
        newSpring.noteA = noteLabels[i];
        newSpring.noteB = noteLabels[j];

        this.springArray.push(newSpring);
      }
    }
  };

  this.retuneSprings = function() {
    this.springArray.forEach(spring => {
      let i = noteLabels.indexOf(spring.noteA);
      let j = noteLabels.indexOf(spring.noteB);

      let centOffset = 0;
      let octaveSize = 1200;

      if (i - j >= 12) {
        centOffset = octaveSize * floor((i - j) / 12);
      }

      // centsToPos(x+1) - centsToPos(1) scales the springLength
      // by the correct factor
      let springLength =
        centsToPos(this.tuningArray[(i - j) % 12] + centOffset + 1) -
        centsToPos(1);

      spring.setRestLength(springLength);
    });
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

  this.allowSpring = function(whichSpring) {
    whichSpring.allowed = true;
  };

  this.disallowSpring = function(whichSpring) {
    whichSpring.allowed = false;
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
    this.springsByInterval(this.allowSpring, whichInterval);
  };

  this.removeSpringsByInterval = function(whichInterval) {
    this.springsByInterval(this.removeSpring, whichInterval);
    this.springsByInterval(this.disallowSpring, whichInterval);
  };

  this.adjustSpringsByInterval = function(whichInterval) {
    let stiffness = this.springStiffness[whichInterval];
    if (stiffness == 0) {
      this.removeSpringsByInterval(whichInterval);
    } else {
      this.addSpringsByInterval(whichInterval);
      this.springsByInterval(
        spring => spring.setStrength(stiffness),
        whichInterval
      );
    }
  };

  this.logNotes = function() {
    const add = (x, y) => x + y;

    let noteArray = physics.particles
      .map(particle => ({
        label: particle.noteLabel,
        freq: posToCents(particle.x) + 1200,
        index: noteLabels.indexOf(particle.noteLabel)
      }))
      .sort((note1, note2) => note1.index - note2.index);

    let indexArray = noteArray.map(e => e.index);

    const phi1 = k =>
      noteArray
        .map((e, i) => this.tuningArray[indexArray[i] - indexArray[k]])
        .filter((e, i) => i > k)
        .reduce(add, 0);

    const phi2 = k =>
      noteArray
        .map((e, i) => this.tuningArray[indexArray[k] - indexArray[i]])
        .filter((e, i) => i < k)
        .reduce(add, 0);

    const phi = k => phi1(k) - phi2(k);

    let a0 = noteArray[0].freq;
    let phi0 = phi(0);

    let predictedArray = noteArray.map(
      (e, i, self) => a0 + (phi0 - phi(i)) / self.length
    );

    prompt(
      'Predicted notes (assuming equal strength springs): ' +
        predictedArray.map(e => roundTwo(e)) +
        '\nCurrent notes (press Command+C or Ctrl+C to copy):',
      noteArray.map(arr => roundTwo(arr.freq))
    );
  };
}

function addHTML() {
  // TODO: disentangle the 'this' mess here
  // so I can refer to keys outside this structure
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
}

let springSliders;

function addGUI() {
  let dropdown = gui.add(sim, 'springTuning', Object.keys(tunings));
  dropdown.onChange(val => {
    sim.setTuning(val);
    sim.retuneSprings();
  });

  springSliders = gui.addFolder('adjust springs');
  springSliders.controllers = [];
  let noteCheckboxes = gui.addFolder('lock notes');

  octaves.forEach(octave => {
    let subfolder = noteCheckboxes.addFolder('octave '+octave);
    notes.forEach(note => {
      let controller = subfolder.add(sim.lockedNotes, note + octave);
      controller.onChange(val => sim.lockNote(note + octave));
    });
  });

  gui.add(sim, 'logNotes');
}

function updateGUI() {
  springSliders.controllers.forEach(e => springSliders.remove(e));

  const endpointsOnScreen = mySpring =>
    physics.particles.includes(mySpring.a) &&
    physics.particles.includes(mySpring.b);

  // make a list of intervals currently possible
  let currentIntervals = sim.springArray
    .filter(spring => endpointsOnScreen(spring))
    .map(spring => spring.interval);

  // only show controllers for these intervals
  springSliders.controllers = [];
  Object.keys(sim.springStiffness)
    .filter(interval => currentIntervals.includes(interval))
    .forEach(interval => {
      let controller = springSliders.add(
        sim.springStiffness,
        interval,
        springStates
      );
      controller.onChange(val => sim.adjustSpringsByInterval(interval));
      springSliders.controllers.push(controller);
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
