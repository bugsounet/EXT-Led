/* global Module */

Module.register('EXT-Led',{
  defaults: {
      debug: true,
      ledCount: 64,
      type: 'ws2801', // 'ws2801' or 'lpd8806'
      bus: 0,
      device:0,
      brightness: 1.0 // between 0.0 and 1.0
  },
  
  start: function() {
    this.initialized = false
  }

  notificationReceived: function(noti, payload) {
    switch(noti) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification("INIT", this.config)
        break
      case "EXT_LED-SEQUENCE":
        if (!this.initialized) return
        this.sendSocketNotification('SEQUENCE', payload)
        break
    }
  },

  socketNotificationReceived: function (notification, payload) {
    switch(notification) {
      case "INITIALIZED":
        this.initialized = true
        this.sendNotification("EXT_HELLO", this.name)
        break
    }
  },

  getDom: function() {
    var dom = document.createElement("div")
    dom.style.display = 'none'
    return dom
  }
});
