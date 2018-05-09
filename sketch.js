const intervalLabels = ['unison', 'minor second', 'major second',
  'minor third', 'major third', 'perfect fourth',
  'dimished fifth', 'perfect fifth', 'minor sixth',
  'major sixth', 'minor seventh', 'major seventh'];

const noteLabels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

let tuningArray = [1, 25 / 24, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

let allowedIntervals = intervalLabels;

// physics
let physics;
let notes;
let springs;

// display
let scaleFactor = 2.2; // scales down the x sizes
let offset = 50; // x position of first notes

// UI
let springSliderArray = [];
let sel;

function setup() {
  var cnv = createCanvas(600, 200);
  cnv.style('display', 'block');
  colorMode(HSB, 120);

  // display settings
  strokeWeight(2);
  pixelDensity(1);

  // create physics world
  physics = new VerletPhysics2D();

  tuningArray = tuningArray.map(ratioToCents);

  // initialize particles, and add to particle array
  notes = new notesObject();
  notes.initialize(tuningArray);

  notes.particleArray[0].lock(); // lock c note spatially

  // initialize springs
  springs = new springsObject();
  springs.initialize(tuningArray, 0.001);

  addHTML(); // adds HTML elements (sliders and checkboxes)

}

function draw() {

  background(0, 0, 30);

  // draw springs
  stroke(200);
  for (let spring of physics.springs) {
    line(spring.a.x, spring.a.y, spring.b.x, spring.b.y);
  }

  noStroke();
  notes.update(); // draw notes and update frequencues

  physics.update();   // update positions, etc.

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
  return cents_from_c / scaleFactor + offset;
}

function posToCents(position) {
  return (position - offset) * scaleFactor;
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

  if (this.checked()) {
    notes.addNote(this.index);
  } else {
    notes.removeNote(this.index);
  }

}

// UI update function: adds or removes all the springs for a musical interval

function toggleSpring() {

  if (this.checked()) {
    springs.addSpringsByInterval(this.interval);
    // add checked interval to list of allowed intervals
    if(!allowedIntervals.includes(this.interval)){
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

  this.reset = function(){
    this.particleArray = [];
  };

  this.initialize = function(tuningArray){

    this.reset();

    for(let myNote of tuningArray){
      let myParticle = new VerletParticle2D(centsToPos(myNote), 100);

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

  this.update = function(){
    for (let myParticle of this.particleArray) {
      if(physics.particles.includes(myParticle)){

        let noteIndex = noteLabels.indexOf(myParticle.noteLabel);
        let myHue = map(noteIndex, 0, noteLabels.length, 0, 100);

        fill(myHue, 100, 100);
        ellipse(myParticle.x, myParticle.y, 20); // draw notes

        this.updateFreq(noteIndex); // update frequency

      }
    }
  };


  this.addParticle = function(index){

    let myParticle = this.particleArray[index];

    if (!physics.particles.includes(myParticle)) {
      physics.addParticle(myParticle);
    }

  };

  this.removeParticle = function(index){

    let myParticle = this.particleArray[index];

    if (physics.particles.includes(myParticle)) {
      physics.removeParticle(myParticle);
    }

  };

  this.mute = function(index){

    let myParticle = this.particleArray[index];
    myParticle.osc.amp(0, 0.01);

  };

  this.play = function(index){

    let myParticle = this.particleArray[index];
    myParticle.osc.amp(0.5, 0.01);

  };

  this.addNote = function(index){

    this.addParticle(index);
    this.play(index);
    springs.addSpringsByNote(noteLabels[index]);
    updateSpringSliders();

  };

  this.removeNote = function(index){

    this.removeParticle(index);
    this.mute(index);
    springs.removeSpringsByNote(noteLabels[index]);
    updateSpringSliders();

  };

  this.updateFreq = function(index){

    let myParticle = this.particleArray[index];

    myParticle.osc.freq(
      centsToFreq(
        posToCents(myParticle.x)
      ),
      0.01);
  };

}


function springsObject() {

  this.springArray;

  this.reset = function(){
    this.springArray = [];
  };

  this.initialize = function(tuningArray, defaultStiffness = 0.001){

    this.reset();

    for (let i = 0; i < tuningArray.length; i++) {
      for (let j = 0; j < i; j++) {
        let newSpring = new VerletSpring2D(
          notes.particleArray[i],
          notes.particleArray[j],
          tuningArray[i - j] / scaleFactor,
          defaultStiffness);

        newSpring.interval = intervalLabels[i-j];
        newSpring.noteA = noteLabels[i];
        newSpring.noteB = noteLabels[j];

        this.springArray.push(newSpring);
      }
    }

  };


  this.addSpring = function(whichSpring){

    if (!physics.springs.includes(whichSpring)) {
      if (physics.particles.includes(whichSpring.a) &&
        physics.particles.includes(whichSpring.b))
      {
        physics.addSpring(whichSpring);
      }
    }

  };

  this.removeSpring = function(whichSpring){

    if (physics.springs.includes(whichSpring)) {
      physics.removeSpring(whichSpring);
    }

  };

  this.addSpringsByNote = function(whichNote){

    for (let mySpring of this.springArray) {
      if(mySpring.noteA == whichNote || mySpring.noteB == whichNote){
        if(allowedIntervals.includes(mySpring.interval)){
          this.addSpring(mySpring);
        }
      }
    }

  };

  this.removeSpringsByNote = function(whichNote){

    for (let mySpring of this.springArray) {
      if(mySpring.noteA == whichNote || mySpring.noteB == whichNote){
        this.removeSpring(mySpring);
      }
    }

  };

  this.addSpringsByInterval = function(whichInterval){

    for (let mySpring of this.springArray) {
      if(mySpring.interval == whichInterval){
        this.addSpring(mySpring);
      }
    }

  };

  this.removeSpringsByInterval = function(whichInterval){

    for (let mySpring of this.springArray) {
      if(mySpring.interval == whichInterval){
        this.removeSpring(mySpring);
      }
    }

  };

  this.adjustSpringsByInterval = function(whichInterval, stiffness){
    for (let mySpring of this.springArray) {
      if(mySpring.interval == whichInterval){
        mySpring.setStrength(stiffness);
      }
    }
  };

}

// adds HTML elements

function addHTML() {

  let spacer = createDiv(' ');
  spacer.style('display', 'block');

  for (let myNote of noteLabels) {
    let spacer = createDiv('');
    spacer.style('display', 'inline-block');

    let noteIndex = noteLabels.indexOf(myNote);

    // UI elements (checkboxes)
    let checkbox = createCheckbox(myNote, false);
    checkbox.index = noteIndex;
    checkbox.changed(toggleNote);
    checkbox.style('display', 'inline-block');

    let myCircle = createDiv('');
    myCircle.size(10, 10);
    let myHue = map(noteIndex, 0, noteLabels.length, 0, 100);
    myCircle.style('background', color(myHue, 100, 100));
    myCircle.style('border-radius', '5px');
    myCircle.style('display', 'inline-block');
    myCircle.style('margin-left', '3px');
  }

  for (let myInterval of intervalLabels) {
    let mySpacer = createDiv('');
    mySpacer.style('display', 'none');

    // UI elements (sliders)
    let springCheckbox = createCheckbox(myInterval + ' spring', true);
    springCheckbox.style('display', 'none');
    springCheckbox.interval = myInterval;
    springCheckbox.changed(toggleSpring);

    let springSlider = createSlider(1, 50, 1);
    springSlider.style('display', 'none');
    springSlider.interval = myInterval;
    springSlider.changed(adjustSpringStiffness);

    springSliderArray.push(
      {
        interval: myInterval,
        spacer: mySpacer,
        checkbox: springCheckbox,
        slider: springSlider
      });
  }

}

function updateSpringSliders(){

  // make a list of intervals currently possible

  let currentIntervals = [];

  for(let mySpring of springs.springArray){

    if(physics.particles.includes(mySpring.a) &&
      physics.particles.includes(mySpring.b))
    {
      currentIntervals.push(mySpring.interval);
    }
  }

  // and add sliders for all these intervals

  for(let mySpringSlider of springSliderArray){
    mySpringSlider.spacer.style('display', 'none');
    mySpringSlider.checkbox.style('display', 'none');
    mySpringSlider.slider.style('display', 'none');
  }

  for(let mySpringSlider of springSliderArray){
    if(currentIntervals.includes(mySpringSlider.interval)){
      mySpringSlider.spacer.style('display', 'block');
      mySpringSlider.checkbox.style('display', 'inline-block');
      mySpringSlider.slider.style('display', 'inline-block');
    }
  }

}

// chrome fix

function touchStarted() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
}
