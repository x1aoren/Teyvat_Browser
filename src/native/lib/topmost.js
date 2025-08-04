const path = require('path');

let native = null;

try {
  // Try to load the compiled C++ module
  native = require('../build/Release/high_priority_topmost.node');
} catch (err) {
  console.error('Failed to load high_priority_topmost module:', err);
  // Provide fallback implementation
  native = {
    startWindowMonitoring: () => { 
      console.warn('C++ topmost module not available, window monitoring disabled'); 
      return false;
    },
    stopWindowMonitoring: () => { 
      console.warn('C++ topmost module not available'); 
      return false;
    },
    setWindowTopmost: () => { 
      console.warn('C++ topmost module not available'); 
      return false;
    },
    getVisibleWindows: () => { 
      console.warn('C++ topmost module not available'); 
      return [];
    },
    bringWindowToForeground: () => { 
      console.warn('C++ topmost module not available'); 
      return false;
    }
  };
}

// Wrapper API to provide a more friendly interface
const api = {
  /**
   * Start monitoring a window to keep it always on top
   * @param {string} windowTitle - Part of the window title to search for
   * @returns {boolean} - Success status
   */
  startMonitoring: function(windowTitle) {
    if (!native || !native.startWindowMonitoring) {
      throw new Error('C++ topmost module not available');
    }
    
    try {
      return native.startWindowMonitoring(windowTitle);
    } catch (err) {
      console.error('Failed to start window monitoring:', err);
      return false;
    }
  },
  
  /**
   * Stop monitoring windows and optionally remove topmost status
   * @param {string} [windowTitle] - Optional window title to remove topmost from
   * @returns {boolean} - Success status
   */
  stopMonitoring: function(windowTitle) {
    if (!native || !native.stopWindowMonitoring) {
      console.warn('C++ topmost module not available');
      return false;
    }
    
    try {
      return native.stopWindowMonitoring(windowTitle);
    } catch (err) {
      console.error('Failed to stop window monitoring:', err);
      return false;
    }
  },
  
  /**
   * Set a specific window to topmost or not topmost
   * @param {string} windowTitle - Part of the window title to search for
   * @param {boolean} topmost - Whether to set window topmost
   * @returns {boolean} - Success status
   */
  setTopmost: function(windowTitle, topmost = true) {
    if (!native || !native.setWindowTopmost) {
      console.warn('C++ topmost module not available');
      return false;
    }
    
    try {
      return native.setWindowTopmost(windowTitle, topmost);
    } catch (err) {
      console.error('Failed to set window topmost:', err);
      return false;
    }
  },
  
  /**
   * Get list of all visible windows (for debugging)
   * @returns {Array} - Array of window objects with title and handle
   */
  getVisibleWindows: function() {
    if (!native || !native.getVisibleWindows) {
      console.warn('C++ topmost module not available');
      return [];
    }
    
    try {
      return native.getVisibleWindows();
    } catch (err) {
      console.error('Failed to get visible windows:', err);
      return [];
    }
  },
  
  /**
   * Bring a window to foreground
   * @param {string} windowTitle - Part of the window title to search for
   * @returns {boolean} - Success status
   */
  bringToForeground: function(windowTitle) {
    if (!native || !native.bringWindowToForeground) {
      console.warn('C++ topmost module not available');
      return false;
    }
    
    try {
      return native.bringWindowToForeground(windowTitle);
    } catch (err) {
      console.error('Failed to bring window to foreground:', err);
      return false;
    }
  },
  
  /**
   * Check if the native module is available
   * @returns {boolean} - Whether the native module is loaded
   */
  isAvailable: function() {
    return native && 
           native.startWindowMonitoring && 
           native.stopWindowMonitoring && 
           native.setWindowTopmost &&
           native.getVisibleWindows &&
           native.bringWindowToForeground;
  }
};

module.exports = api;