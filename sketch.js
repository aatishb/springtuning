let intervals = ['unison', 'minor second', 'major second',
  'minor third', 'major third', 'perfect fourth',
  'dimished fifth', 'perfect fifth', 'minor sixth',
  'major sixth', 'minor seventh', 'major seventh'
];
let notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let tuning = [1, 25 / 24, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

// physics
var physics;
var stiffness = 0.001; // default spring strength
var particles = []; // particles
var springsByIntervals = {};
var springsByNotes = {};


// music
var cfreq = 261.63; // absolute frequency of C
var oscs = []; // oscillators

// display
var scaleFactor = 2.2; // scales down the x sizes
var offset = 50; // x position of first notes

// UI
var sel;

function setup() {
  var cnv = createCanvas(600, 200);
  cnv.style('display', 'block');
  colorMode(HSB, 120);


  // display settings
  strokeWeight(2);
  pixelDensity(1);

  // Initialize the physics
  physics = new VerletPhysics2D();
  //physics.setWorldBounds(new Rect(0,0,width,height));

  tuning = tuning.map(ratioToCents);

  // create particles
  for (let tune of tuning) {
    particles.push(new VerletParticle2D(centsToPos(tune), 100));
  }

  for (let interval of intervals) {
    springsByIntervals[interval] = [];
  }

  // create springs
  for (let i = 0; i < particles.length; i++) {
    springsByNotes[notes[i]] = [];
    for (let j = 0; j < i; j++) {
      let newSpring = new VerletSpring2D(
        particles[i],
        particles[j],
        tuning[i - j] / scaleFactor,
        stiffness);

      springsByIntervals[intervals[i - j]].push(newSpring);
      springsByNotes[notes[i]].push(newSpring);
      springsByNotes[notes[j]].push(newSpring);
    }
  }

  particles[0].lock(); // lock c note spatially

  // add oscillators
  for (let note of tuning) {
    let newOsc = new p5.Oscillator();
    newOsc.setType('sawtooth');
    newOsc.freq(centsToFreq(note));
    newOsc.amp(0);
    newOsc.start();
    oscs.push(newOsc);
  }

  addHTML(); // adds HTML elements (sliders and checkboxes)

}

function draw() {

  background(0, 0, 30);

  // draw springs
  stroke(200);
  for (let spring of physics.springs) {
    line(spring.a.x, spring.a.y, spring.b.x, spring.b.y);
  }

  // draw particles (notes)
  noStroke();
  for (let particle of physics.particles) {
    let myHue = map(particles.indexOf(particle), 0, particles.length, 0, 100);
    fill(myHue, 100, 100);
    ellipse(particle.x, particle.y, 20);
  }

  // update oscillator frequencies
  // don't update C since it stays fixed
  for (let i = 1; i < oscs.length; i++) {
    oscs[i].freq(
      centsToFreq(
        posToCents(particles[i].x) - posToCents(particles[0].x)
      ),
      0.01);
  }

  // update physics world
  physics.update();

  // interactivity: set position of particle close to mouse
  if (mouseIsPressed) {
    moveNearbyNodeToMouse();
  }

}

// helper functions

function centsToFreq(cents_from_c) {
  return cfreq * pow(2, cents_from_c / 1200);
}

function centsToPos(cents_from_c) {
  return cents_from_c / scaleFactor + offset;
}

function posToCents(position) {
  return (position - offset) * scaleFactor;
}

function ratioToCents(ratio) {
  return 1200 * log(ratio) / log(2);
}


// UI update function: enables and disables
// oscillators/particles/springs
// for a given note

function toggleNote() {
  if (this.checked()) {

    // play sound
    this.osc.amp(0.5, 0.01);

    // add particle
    if (!physics.particles.includes(this.particle)) {
      physics.addParticle(this.particle);
    }

    // add all springs that connect this particle
    // to other particles on screen
    for (let mySpring of this.springs) {
      if (!physics.springs.includes(mySpring)) {
        if (physics.particles.includes(mySpring.a) &&
          physics.particles.includes(mySpring.b)) {
          physics.addSpring(mySpring);
        }
      }
    }
  } else {

    // stop sound
    this.osc.amp(0, 0.01);

    // remove all springs connected to this particle
    for (let mySpring of this.springs) {
      if (physics.springs.includes(mySpring)) {
        physics.removeSpring(mySpring);
      }
    }

    // remove the particle
    if (physics.particles.includes(this.particle)) {
      physics.removeParticle(this.particle);
    }
  }

}

// UI update function: set spring stiffness

function adjustSpringStiffness() {
  for (let mySpring of this.springs) {
    mySpring.setStrength(this.value() / 1000);
  }
}

// UI update function: add a set of springs

function toggleSpring() {
  // go through springs
  for (let mySpring of this.springs) {
    // remove spring if present
    if (physics.springs.includes(mySpring)) {
      physics.removeSpring(mySpring);
    } else
    {
      // add spring if absent
      // but only if both its particles are on screen
      if (physics.particles.includes(mySpring.a) &&
        physics.particles.includes(mySpring.b)) {
        physics.addSpring(mySpring);
      }
    }
  }

}

// UI update function: changes oscillator type (sine, sawtooth, etc)

function changeOscType() {
  for (let osc of oscs) {
    osc.setType(sel.value());
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

// adds HTML elements

function addHTML() {

  sel = createSelect();
  sel.option('sawtooth');
  sel.option('triangle');
  sel.option('square');
  sel.option('sine');
  sel.changed(changeOscType);

  let spacer = createDiv(' ');
  spacer.style('display', 'block');

  for (let i = 0; i < notes.length; i++) {
    spacer = createDiv('');
    spacer.style('display', 'inline-block');

    // UI elements (checkboxes)
    let checkbox = createCheckbox(notes[i], false);
    checkbox.osc = oscs[i];
    checkbox.springs = springsByNotes[notes[i]];
    checkbox.particle = particles[i];
    checkbox.changed(toggleNote);
    checkbox.style('display', 'inline-block');

    let myCircle = createDiv('');
    myCircle.size(10, 10);
    let myHue = map(i, 0, notes.length, 0, 100);
    myCircle.style('background', color(myHue, 100, 100));
    myCircle.style('border-radius', '5px');
    myCircle.style('display', 'inline-block');
    myCircle.style('margin-left', '3px');
  }

  for (let i = 1; i < intervals.length; i++) {
    spacer = createDiv('');
    spacer.style('display', 'block');

    // UI elements (sliders)
    let springCheckbox = createCheckbox(intervals[i] + ' spring', true);
    springCheckbox.style('display', 'inline-block');
    springCheckbox.springs = springsByIntervals[intervals[i]];
    springCheckbox.changed(toggleSpring);

    let springSlider = createSlider(1, 1000, 1);
    springSlider.springs = springsByIntervals[intervals[i]];
    springSlider.changed(adjustSpringStiffness);
  }
}
