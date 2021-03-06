/// <reference path="/vsdoc/utils-1.3-vsdoc.js" />
/// <reference path="/vsdoc/chrome-vsdoc.js" />

function Model() {

	var root = this;

	// ------------------------------------------------------------------
	// Data Access Layer
	// ------------------------------------------------------------------

    var DAL = new UTILS.LocalStoreDAL('imgur');
    
	// ------------------------------------------------------------------
	// Upgrade -1 ~ 0.5 - 1.0.3
	// ------------------------------------------------------------------

    if (!DAL.get('preferences')) {

        var unsorted = DAL.get('storedImages') || [];

        var preferences = {
            connections: DAL.get('connections') || 1,
            currentAlbum: '_thisComputer'
        };
        // utils should add be able to set properties for oauth 1 level deep
        DAL.reset({ unsorted: unsorted, albums: [], preferences: preferences, account: {}, OAuthTokens: {access_token: null, access_token_secret: null} });
    }

	// ------------------------------------------------------------------
	// Upgrade 1.0.3 - 1.0.4
	// ------------------------------------------------------------------

    if (DAL.get('preferences.copyonrehost') == null) {

        DAL.set('preferences.copyonrehost', false);
        DAL.set('preferences.tabonrehost', true);
        DAL.set('preferences.copyoncapture', false);
        DAL.set('preferences.taboncapture', true);
		
    };

	// ------------------------------------------------------------------
	// Upgrade 1.0.4, 1.0.5 - 1.1
	// ------------------------------------------------------------------

    if (DAL.get('preferences.freezegifs') == null) {

    	DAL.set('preferences.freezegifs', true);
    	DAL.set('preferences.shownavairywarning', false);

    };

	// ------------------------------------------------------------------
	// Upgrade 1.1 - 1.2
	// ------------------------------------------------------------------

    if (DAL.get('OAuth2') == null) {

    	// Invalidate OAuth 1
    	// This should set the user back to "connect to imgur"
    	DAL.set('OAuthTokens', null);
    	DAL.set('preferences.currentAlbum', '_thisComputer');
		
    	// Upgrade old stored images
    	var unsorted = DAL.get('unsorted');

    	var upgradedUnsorted = [];

    	for (var i = 0; i < unsorted.length, imageItem = unsorted[i]; i++) {

    		upgradedUnsorted.push({

    			"id": imageItem.image.hash,
    			"title": imageItem.image.title,
    			"description": imageItem.image.caption,
    			"datetime": (new Date(imageItem.image.datetime)).getTime(), // New format is a number
    			"type": imageItem.image.type,
    			"animated": Boolean(imageItem.image.animated), // boolean is now... a boolean
    			"width": imageItem.image.width,
    			"height": imageItem.image.height,
    			"size": imageItem.image.size,
    			"views": imageItem.image.views,
    			"link": imageItem.links.original,
    			"bandwidth": imageItem.image.bandwidth,
    			"deletehash": imageItem.image.deletehash

    		});

    	}
    	DAL.set('unsorted', upgradedUnsorted);

    	DAL.set('OAuth2', { access_token: null, refresh_token: null, account_username: null });
    };

	function encode(str) {
    	return encodeURIComponent(str).replace(/\!/g, "%21").
            replace(/\*/g, "%2A").
            replace(/'/g, "%27").
            replace(/\(/g, "%28").
            replace(/\)/g, "%29");
    }

	// ------------------------------------------------------------------
	// Reset
	// ------------------------------------------------------------------

    this.reset = function () {
        DAL.set('preferences.currentAlbum', '_thisComputer');
        root.authenticated.oAuthManager.reset();
    };

	// Only use in testing
    this.fullReset = function () {
    	DAL.set('OAuth2', null);
    	var unsorted = DAL.get('unsorted');
    }

	// ------------------------------------------------------------------
	// Preferences
	// ------------------------------------------------------------------

    this.preferences = new function () {

        this.get = function (preference) {
            return DAL.get('preferences.' + preference);
        };

        this.set = function (preference, value) {
            DAL.set('preferences.' + preference, value);
        };

    }

	// ------------------------------------------------------------------
	// Current Album
	// ------------------------------------------------------------------

    this.currentAlbum = new function () {

        this.get = function () {
            
            var albums = DAL.get('albums'),
                currentAlbum = DAL.get('preferences.currentAlbum');


            if (!albums || !!!~UTILS.ARRAY.getIndexByObjectPropertyValue(currentAlbum, 'id')) {
                    if (currentAlbum !== '_userAlbum') {
                        currentAlbum = '_thisComputer';
                        DAL.set('preferences.currentAlbum', currentAlbum);
                    }
            }

            return DAL.get('preferences.currentAlbum');
        };

        this.set = function (value) {
            DAL.set('preferences.currentAlbum', value);
        };

    };

	// ------------------------------------------------------------------
	// Request Manager
	// ------------------------------------------------------------------

    this.requestManager = new function () {

    	var CurrentlyProcessing = 0;
    	var test = 0;
    	var pending = [];

    	this.queue = function (req) {
    		pending.push(req);
    		processQueue();
    	};

    	function requeue (req) {
    		pending.unshift(req);
    		test++;
    		processQueue();
    	};

    	function processQueue() {
    		
    		if (CurrentlyProcessing < root.preferences.get('connections')) {

    			CurrentlyProcessing++;

    			var item = pending.shift();

    			// Listen to the item's events
    			item.evtD.addEventListener('EVENT_REAUTH', function () {

    				CurrentlyProcessing--;

    				root.authenticated.oAuthManager.refreshToken();

					// Getting requeued so remove all manager listeners (they'll get added again)
    				item.evtD.removeEventListenersByHandler('EVENT_REAUTH', 'manager');

    				requeue(item);

    			}, 'manager');

    			item.evtD.addEventListener(['EVENT_COMPLETE', 'EVENT_ERROR', 'EVENT_PROGRESS'], function (e) {

    				CurrentlyProcessing--;
    				
    				if (pending.length !== 0) {

    					processQueue();
    				}

    			}, 'manager');

    			item.handler.call(item, item.argsObj, item.evtD);

    		}
    	}

    };

	// ------------------------------------------------------------------
	// Authenticated
	// ------------------------------------------------------------------

    this.authenticated = new function () {

    	var authenticated = this;

    	this.oAuthManager = new function () {

    		var refreshingToken = false;

    		this.reset = function () {
    			DAL.set('OAuth2.access_token', null);
    			DAL.set('OAuth2.refresh_token', null);
    			DAL.set('OAauth2.account_username', null);
    		}

    		this.set = function (access_token, refresh_token, account_username) {
    			DAL.set('OAuth2.access_token', access_token);
    			DAL.set('OAuth2.refresh_token', refresh_token);
    			DAL.set('OAuth2.account_username', account_username);
    		};

    		this.invalidateToken = function () {
    			DAL.set('OAuth2.access_token', 123);
    		};

    		this.getAuthStatus = function () {
    			return DAL.get('OAuth2.access_token') != null;
    		};

    		this.getToken = function (pin) {

    			var evtD = new UTILS.EventDispatcher(['EVENT_COMPLETE']),
					xhr = new XMLHttpRequest();

    			xhr.open("POST", "https://api.imgur.com/oauth2/token", true);
    			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    			xhr.onreadystatechange = function () {
    				if (xhr.readyState == 4) {
    					var resp = JSON.parse(xhr.responseText);
    					authenticated.oAuthManager.set(resp.access_token, resp.refresh_token, resp.account_username);
    					evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    				}
    			};
    			xhr.send("client_id=e5642c924b26904&client_secret=182e1f36ca3fa519df464bb0004d478cdab734d8&grant_type=pin&pin=" + pin);
    			return evtD;
    		};

    		this.refreshToken = function () {

    			// Some other request is taking care of it
    			// Return (expecting to requeue anyway)
    			
    			if (!refreshingToken) {
    				console.log('refreshingToken');
    				refreshingToken = true;

    				var xhr = new XMLHttpRequest();

    				// No async
    				xhr.open("POST", "https://api.imgur.com/oauth2/token", false);
    				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    				xhr.send("client_id=e5642c924b26904&client_secret=182e1f36ca3fa519df464bb0004d478cdab734d8&grant_type=refresh_token&refresh_token=" + DAL.get('OAuth2.refresh_token'));

    				if (xhr.status === 200) {
    					var resp = JSON.parse(xhr.responseText);
    					authenticated.oAuthManager.set(resp.access_token, resp.refresh_token, resp.account_username);
    					console.log('done', resp);
    					refreshingToken = false;

    				}
    			}

    			
    		};

    	}

		// Can only make instances of
    	var signedRequest = function (method, url, postStr) {
    		
    		var self = this;

    		this.evtD = new UTILS.EventDispatcher(['EVENT_COMPLETE', 'EVENT_SUCCESS', 'EVENT_ERROR', 'EVENT_PROGRESS', 'ERROR_RATE_LIMITED']);

    		this.handler = function () {

    			var xhr = new XMLHttpRequest();

    			xhr.open(method, url, true);
    			xhr.setRequestHeader('Authorization', 'Bearer ' + DAL.get('OAuth2.access_token'));

    			if (postStr) {
    				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    			}

    			var upload = xhr.upload;
    			upload.addEventListener("progress", function (ev) {
    				if (ev.lengthComputable) {
    					self.evtD.dispatchEvent('EVENT_PROGRESS', { loaded: ev.loaded, total: ev.total });
    				}
    			}, false);

    			xhr.onreadystatechange = function () {

    				if (xhr.readyState === 4) {

    					if (xhr.status === 200) {

    						var resp = JSON.parse(xhr.responseText);
							
    						self.evtD.dispatchEvent('EVENT_COMPLETE', resp.data);

    						if (resp.success) {

    							self.evtD.dispatchEvent('EVENT_SUCCESS', resp.data);

    						} else {

    							self.evtD.dispatchEvent('EVENT_ERROR', resp.error);

    						}

    					} else if (xhr.status === 403) {

    						console.warn('auth error');
							// Inherited EVENT_REAUTH
    						self.evtD.dispatchEvent("EVENT_REAUTH");

    					} else if (xhr.status === 429) {

    						console.warn('rate limited');
    						self.evtD.dispatchEvent("ERROR_RATE_LIMITED");

    					}

    				}
    			};

    			xhr.send(postStr);

    		};

    		return this;

    	};

    	this.getAccount = function () {
    		return DAL.get('account');
    	};

    	this.getAlbums = function () {
    		return DAL.get('albums');
    	};

    	this.fetchUser = function () {

    		var req = new signedRequest("GET", "https://api.imgur.com/3/account/me")
    		root.requestManager.queue(req);

    		req.evtD.addEventListener("EVENT_SUCCESS", function (account) {
    			DAL.set('account', account);
    		});

    		return req.evtD;
    	};

    	this.fetchUserImages = function () {
    		
    		var req = new signedRequest("GET", "https://api.imgur.com/3/account/me/images")
    		root.requestManager.queue(req);
    		return req.evtD;

    	};

    	this.fetchAlbums = function () {

    		var req = new signedRequest("GET", "https://api.imgur.com/3/account/me/albums");
    		root.requestManager.queue(req);

    		req.evtD.addEventListener("EVENT_SUCCESS", function (albums) {
    			DAL.set('albums', albums);
    		});

    		return req.evtD;

    	};

    	this.fetchAlbumImages = function (ID) {

    		var req = new signedRequest("GET", "https://api.imgur.com/3/account/me/album/" + ID);
    		root.requestManager.queue(req);
    		return req.evtD;

    	};

    	this.makeAlbum = function (title) {
    		
    		var req = new signedRequest("POST", "https://api.imgur.com/3/album/", "title=" + title);
    		root.requestManager.queue(req);

    		req.evtD.addEventListener("EVENT_SUCCESS", function (album) {
    			var albums = authenticated.getAlbums();
    			albums.push(album);
    			DAL.set('albums', albums);
    		});

    		return req.evtD;

    	};

    	this.sendImage = function (album, image) {

    		var postStr = "image=" + encode(image) + "&type=base64";

    		if (album !== '_userAlbum') {
    			postStr += "&album=" + album;
    		}

    		var req = new signedRequest("POST", "https://api.imgur.com/3/image", postStr);
    		root.requestManager.queue(req);

    		return req.evtD;

    	};

    	this.sendImageURL = function (album, url) {

    		var postStr = "image=" + encode(url) + "&type=url";

    		if (album !== '_userAlbum') {
    			postStr += "&album=" + album;
    		}

    		var req = new signedRequest("POST", "https://api.imgur.com/3/image", postStr);
    		root.requestManager.queue(req);

    		return req.evtD;

    	};


    	this.deleteImage = function (deletehash) {

    		var req = new signedRequest("DELETE", "https://api.imgur.com/3/image/" + deletehash);
    		root.requestManager.queue(req);

    		return req.evtD;

    	};

    }();


	// ------------------------------------------------------------------
	// Unsorted (not authenticated)
	// ------------------------------------------------------------------

    this.unsorted = new function (model) {

    	var unsorted = this;

    	// Can only make instances of
    	var signedRequest = function (method, url, postStr) {

    		var self = this;

    		this.evtD = new UTILS.EventDispatcher(['EVENT_COMPLETE', 'EVENT_SUCCESS', 'EVENT_ERROR', 'EVENT_PROGRESS', 'ERROR_RATE_LIMITED']);

    		this.handler = function () {

    			var xhr = new XMLHttpRequest();

    			xhr.open(method, url, true);
    			xhr.setRequestHeader('Authorization', 'Client-ID e5642c924b26904');

    			if (postStr) {
    				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    			}

    			var upload = xhr.upload;
    			upload.addEventListener("progress", function (ev) {
    				if (ev.lengthComputable) {
    					self.evtD.dispatchEvent('EVENT_PROGRESS', { loaded: ev.loaded, total: ev.total });
    				}
    			}, false);

    			xhr.onreadystatechange = function () {

    				if (xhr.readyState === 4) {

    					if (xhr.status === 200) {

    						var resp = JSON.parse(xhr.responseText);

    						self.evtD.dispatchEvent('EVENT_COMPLETE', resp.data);

    						if (resp.success) {

    							self.evtD.dispatchEvent('EVENT_SUCCESS', resp.data);

    						} else {

    							self.evtD.dispatchEvent('EVENT_ERROR', resp.error);

    						}

    					} else if (xhr.status === 429) {

    						console.warn('rate limited');
    						self.evtD.dispatchEvent("ERROR_RATE_LIMITED");

    					}

    				}
    			};

    			xhr.send(postStr);

    		};

    		return this;

    	};



    	this.get = function () {
    		return DAL.get('unsorted');
    	};

    	this.sendImage = function (image) {

			// Strange how we don't encode the image here to make it work
    		var req = new signedRequest("POST", "https://api.imgur.com/3/image", "image=" + image + "&type=base64");
    		root.requestManager.queue(req);

    		req.evtD.addEventListener("EVENT_SUCCESS", function (image) {

    			var unsorted = DAL.get('unsorted');
    			unsorted.push(image);
    			DAL.set('unsorted', unsorted);

    		});

    		return req.evtD;

    	};



    	this.sendImageURL = function (url) {

    		var req = new signedRequest("POST", "https://api.imgur.com/3/image", "image=" + encode(url) + "&type=url");
    		root.requestManager.queue(req);

    		req.evtD.addEventListener("EVENT_SUCCESS", function (image) {

    			var unsorted = DAL.get('unsorted');
    			unsorted.push(image);
    			DAL.set('unsorted', unsorted);

    		});

    		return req.evtD;

    	};

    	

    	this.deleteImage = function (deletehash) {

    		var req = new signedRequest("DELETE", "https://api.imgur.com/3/image/" + deletehash);
    		root.requestManager.queue(req);

    		req.evtD.addEventListener("EVENT_SUCCESS", function (image) {

    			var unsorted = DAL.get('unsorted'),
					storageItem = UTILS.ARRAY.getIndexByObjectPropertyValue(unsorted, 'deletehash', deletehash);
    			if (storageItem !== -1) {
    				unsorted.splice(storageItem, 1);
    			}

    			DAL.set('unsorted', unsorted);

    		});

    		return req.evtD;

    	};

    } ();

}