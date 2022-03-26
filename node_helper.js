/* global require */

const Color      = require('color');
const NodeHelper = require('node_helper');
logLights= (...args) => { /* do nothing */ }
/**
 * ---------
 * @todo
 * -- catch error for rpi-ws2801 (see library)
 * -- make @bugsounet load library (for no black screen)
 * -- display when a library is not loaded // or error
 * -- delete any self / this (i don't like this !)
 * -- review spacing with 2 spaces inside of tab
 * in resume: review entire code ! :)))
 * --------
 **/ 

module.exports = NodeHelper.create({
  /**
   * node_helper start method
   */
  start: function() {
    this.log('Starting node_helper')
    this.config= {}
    this.animationRunning=  false
    this.stopAnimationRequest= false
    this.defaultSpeed= 100
    this.type= 'ws2801'
  },

  /**
   *
   * @param {String} notification
   * @param {*}      payload
   */
  socketNotificationReceived: function (noti, payload) {
    switch(noti) {
      case "INIT":
        console.log("INIT", payload)
        this.config = payload
        if (this.config.debug) logLights= (...args) => { console.log("[LIGHT]", ...args) }
        this.initialize()
        break
      case "SEQUENCE":
        let iterations = 2
        let sequence   = payload
        let delay      = 0

        if (typeof payload === 'object') {
            sequence   = payload.sequence;
            iterations = payload.iterations || iterations;
            delay      = payload.delay      || delay;
        }

        Promise.resolve(this.runSequence(sequence, iterations, delay)
          .catch(err => {
            this.log('Sequence error: ' + err.message)
          }))
        break
    }
  },

  initialize: function() {
    try {
        this.log('Trying to load leds', true)
        this.type = this.config.type
        if (this.type == 'ws2801') {
            // Internal reference to rpi-ws2801
            this.leds = require("rpi-ws2801")
            this.leds.connect(this.config.ledCount, this.config.bus, this.config.device)
            // Initialize off
            this.leds.clear()
        } else if (this.type == 'lpd8806') {
            // Internal reference to lpd8806-async
            var LPD8806 = require('lpd8806-async')
            this.leds = new LPD8806(this.config.ledCount, this.config.bus, this.config.device)
            
            // Initialize off
            this.leds.allOFF()
            this.leds.setMasterBrightness(this.config.brightness)
        }
        this.log('Leds connected ok', true)
    } catch (err) {
        this.log('Unable to open SPI (' + this.config.device + '), not supported? ' + err.message)
        this.leds = null
    }
  },


  /**
   * Runs a light sequence
   *
   * @param   {String}  sequence
   * @param   {Integer} [iterations]
   * @param   {Integer} [delay]
   * @returns {Promise}
   */
  runSequence: function (sequence, iterations, delay) {
    let self = this
    iterations = iterations || 2

    this.log('runSequence: ' + sequence + ', iterations: ' + iterations + ', delay: ' + delay)

    return new Promise((resolve, reject) => {
      let colors = [0, 0, 0]

      switch (sequence) {
        case 'blue_pulse':
          colors = [0, 0, 255]
          break
        case 'white_pulse':
          colors = [255, 255, 255]
          break
        case 'lightblue_pulse':
          colors = [0, 255, 255]
          break
        case 'red_pulse':
          colors = [255, 0, 0]
          break
        case 'green_pulse':
          colors = [0, 255, 0]
          break
        case 'orange_pulse':
          colors = [255, 170, 0]
          break
        case 'pink_pulse':
          colors = [255, 0, 255]
          break
        default:
          return reject(new Error('Unknown sequence: ' + sequence))
          break
        }

        resolve(this.pulse(colors[0], colors[1], colors[2], iterations, 20, delay))
    })
  },

  /**
   * @param {Function} cb
   * @returns {*}
   */
  switchAnimation: function (cb) {
    if (!this.animationRunning) return this.startAnimation(cb)
    this.stopAnimationRequest = true

    if (this.animationRunning) {
      setTimeout(() => {
        this.switchAnimation(cb)
      }, 100)
    } else {
      this.startAnimation(cb)
    }
  },

  /**
   *
   * @param {Function} cb
   * @returns {Function}
   */
  startAnimation: function (cb) {
    this.stopAnimationRequest = false
    this.animationRunning = true
    return cb()
  },

  /**
   *
   */
  stopAnimation: function () {
    this.stopAnimationRequest = true
    this.animationRunning = false
  },

  /**
   *
   */
  update: function() {
    if (this.leds) this.leds.update()
  },

  /**
   *
   * @param {Integer} red
   * @param {Integer} green
   * @param {Integer} blue
   * @param {Integer} [iterations]
   * @param {Integer} [speed]
   * @param {Integer} [delay]
   */
  pulse: function (red, green, blue, iterations, speed, delay) {
    delay = delay || 1

    if (this.leds) {
      setTimeout(() => {
        this.switchAnimation(() => {
          this.log('Pulse (' + red + ', ' + green + ', ' + blue + ') Iterations: ' + iterations + ', Speed: ' + speed + ', Delay: ' + delay, true)
          this.flashEffect(red, green, blue, iterations, speed)
        })
      }, delay)
    }
  },

  /**
   *
   * @param r
   * @param g
   * @param b
   */
  fillRGB: function(r, g, b) {
    if (this.leds) {
      this.switchAnimation(() => {
        if (this.type == 'ws2801') {
          this.leds.fill(r, g, b)
        } else if (this.type == 'lpd8806') {
          this.leds.fillRGB(r, g, b)
        }
        this.stopAnimation()
      })
    }
  },

  /**
   *
   */
  off: function() {
    if (this.leds) {
      if (this.type == 'ws2801') {
        this.leds.clear()
      } else if (this.type == 'lpd8806') {
        this.leds.allOFF()
      }
      this.stopAnimation()
    }
  },

  /**
   *
   * @param {Integer} r
   * @param {Integer} g
   * @param {Integer} b
   * @param {Integer} [iterations]
   * @param {Integer} [speed]
   */
  flashEffect: function (r, g, b, iterations, speed) {
    let self = this
    let step = 0.05
    let total_iterations = 0

    speed      = speed || 10 // ms
    iterations = iterations || 99999

    let level = 0.00
    let dir   = step

    function performStep() {
      if (level <= 0.0) {
        level = 0.0
        dir = step
        total_iterations++
      } else if (level >= 1.0) {
        level = 1.0
        dir = -step
      }

      level += dir

      if (level < 0.0) {
        level = 0.0
      } else if (level > 1.0) {
        level = 1.0
      }

      if (self.stopAnimationRequest || total_iterations > iterations) {
        self.stopAnimation()
        return
      }

      if (self.type == 'ws2801') {
        self.leds.fill(r * level,g * level,b * level)
      } else if (self.type == 'lpd8806') {
        self.leds.setMasterBrightness(level)
        self.leds.fill(new Color({
          r: r,
          g: g,
          b: b
        }))
      }

      setTimeout(performStep, speed)
    }

    if (this.leds) performStep()
  },

  /**
   * Outputs log messages
   *
   * @param {String}  message
   * @param {Boolean} [debug_only]
   */
  log: function (message) {
    logLights(message)
  }

});
