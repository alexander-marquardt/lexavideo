window.Firechannel = (function() {
  /**
   * Firechannels are used to connect to Firebase.
   *
   * @param token The auth token from the server.
   */
  var Firechannel = function(token) {
    var segments = token.split(".");
    var params = JSON.parse(atob(segments[1]));

    this.channelId = params.uid;
    this.token = token;
  };

  /**
   * Open a socket.
   *
   * @param handler An optional object with handlers for Socket callbacks.
   * @return Socket
   */
  Firechannel.prototype.open = function(handler) {
    return new Socket(
      this.token,
      this.channelId,
      handler || {}
    );
  };

  /**
   * Sockets receive data in real time form Firebase.
   *
   * @param token An auth token.
   * @param channelId The channel to listen on.
   * @param handler An optional object with handlers for the callbacks.
  */
  var Socket = function(token, channelId, handler) {
    // Apps must be scoped so that multiple channel ids can be used
    // since channels are scoped by auth.
    var firebaseApp = firebase.app();

    firebase
      .auth(firebaseApp)
      .signInWithCustomToken(token)
      .then(function() {
        this.handler = handler;
        this.ref = firebaseApp.database().ref("firechannels/" + channelId);
        this.ref.on("value", function(ref) {
          try {
            var data = ref.val();
            if (data === null) return;

            var message = atob(data.message);
            handler.onmessage ? handler.onmessage(message) : this.onmessage(message);
          } catch (e) {
            handler.onerror ? handler.onerror(e) : this.onerror(e);
          }
        }.bind(this));

        handler.onopen ? handler.onopen() : this.onopen();
      }.bind(this))
      .catch(function(err) {
        console.log("Error: " + err.code);
        console.error(err.message);
      });
  };

  /**
   * Callend when the socket is ready to receive messages.
   */
  Socket.prototype.onopen = function() {};

  /**
   * Called when the socket receives a message.
   *
   * @param data The data sent from the server.
   */
  Socket.prototype.onmessage = function(data) {};

  /**
   * Called when an error occurs on the socket.
   *
   * @param err An object with a `code` field and a `message` field.
   */
  Socket.prototype.onerror = function(err) {
    console.error(err);
  };

  /**
   * Called when the socket is closed.
   */
  Socket.prototype.onclose = function() {};

  /**
   * Close the socket.
   */
  Socket.prototype.close = function() {
    if (this.ref) {
      this.ref.off();
      this.handler.onclose ? this.handler.onclose() : this.onclose();
    }
  };

  return Firechannel;
})();
