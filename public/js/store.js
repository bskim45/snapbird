var store = (function () {
  var localStorage = window.localStorage;

  return {
    get: function (key) {
      return localStorage.getItem(key);
    },
    set: function (key, value) {
      var result;
      try {
        result = localStorage.setItem(key, value);
      } catch (e) {
        // could be a QUOTA_EXCEEDED_ERR (for some reason Webkit is giving me this, just needs a restart and it goes away...)
      }
      return result;
    },
    clear: function () {
      localStorage.clear();
    }
  };
})();