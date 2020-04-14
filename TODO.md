- Check why chrome / iphone seems to crash when video starts (should give a warning)
- Broke mute button by moving it out of scope - must fix this
- After more than 3 people have video, some start to not hear audio
- Must add monitoring for failed WebRTC sessions (should never fail once Turn running - if it does , should generate log)
- onaddstream is deprecated! Use peerConnection.ontrack instead. (?? error from Firefox)
- Ensure that video stream/camera is closed if the user hangs up and doesn't have video running any longer
- Fix / Investigate why with 4 or more people in a room, either video or audio between some of the participants seems to drop
- Add (optional) passwords to enter into rooms
- Add ability to turn of mic to certain users, as well as globally turning mic off (which could then be enabled for some)
- In private rooms , turn on video for all entrants (up to the firsx say 4 people) 
- Show all public chats (without passwords) in the popular chats category
- Record the last X number of chat messages in Firebase (?? )
- Add a grid view (optional) if more than 3 people in a chat


    TypeError: $http.post(...).then(...).error is not a function[Learn More]  lx-http-services.js:297:17
	self.manuallyDisconnectChannel http://localhost:8080/scripts/lx-services/lx-http-services.js:297:17
	self.initializeChannel/</$window.onbeforeunload http://localhost:8080/scripts/lx-services/lx-channel-services.js:422:29
	<anonymous> chrome://browser/content/tab-content.js:84:43
	this.E10SUtils.wrapHandlingUserInput resource:///modules/E10SUtils.jsm:122:7
	<anonymous>