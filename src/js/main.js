/// <reference path="vsdoc/utils-1.3-vsdoc.js" />
/// <reference path="vsdoc/chrome-vsdoc.js" />

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-249743-23']);
_gaq.push(['_trackPageview']);

(function () {
	var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
	ga.src = 'https://ssl.google-analytics.com/ga.js';
	var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

var port = chrome.extension.connect({ name: "main" }),
    model = new Model(),
    EWrap,
    ENav,
    ENavConnect,
    ENavSelect,
	ENavDownload,
	ENavDelete,
    ENavOptions,
    EAlbums,
    CurrentAlbum,
    ECurrentAlbum,
    EStatusBar,
	EStatusBarLink;


// Aviary

var featherEditor = new Aviary.Feather({
    apiKey: 'b073f6881',
    apiVersion: '2',
    openType: 'lightbox',
    tools: 'all',
    appendTo: '',
    onSave: function (imageID, newURL) {
        makeURLItem(newURL);
    }
});

function uploadFiles(e) {
    
    var noImages = ECurrentAlbum.querySelectorAll('.no-images')[0];
    if (noImages) {
        ECurrentAlbum.removeChild(noImages);
    }

    var filesObj = e.dataTransfer.files,
        files = [];

    for (var v = 0; v < filesObj.length; v++) {
        if (filesObj[v].type.match(/image.*/)) {
            files.push(filesObj[v]);
        }
    }
    if (files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            var file = files[i],
                reader = new FileReader();
            reader.onload = function (e) {
                makeItem(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    } else {
        
    }
}

function makeImage(fileData) {

    var img = UTILS.DOM.create('image');
    img.src = fileData;
    img.style.display = 'none';
    img.onload = function () {
        resizeImage(this);
        img.style.display = 'block';
    };

    return img;

}

function makeItem(fileData) {
    var ul = ECurrentAlbum.querySelectorAll('ul')[0],
        img = makeImage(fileData);
    var loadingItem = makeLoadingItem(img);
    var progress = loadingItem.querySelectorAll('progress')[0];
    ul.insertBefore(loadingItem, ul.firstChild);
    var evt;
    if (CurrentAlbum == "_thisComputer") {
        evt = model.unsorted.sendImage(encodeURIComponent(fileData.split(',')[1]));
        evt.addEventListener('EVENT_SUCCESS', function (e) {
        	convertLoadingToAlbum(loadingItem, e);
        });
    } else {
        evt = model.authenticated.sendImage(CurrentAlbum, fileData.split(',')[1]);
        evt.addEventListener('EVENT_SUCCESS', function (e) {
            convertLoadingToAlbum(loadingItem, e);
        });
    }
                
    evt.addEventListener(evt.EVENT_PROGRESS, function (e) {
        progress.value = Math.floor(((e.loaded/e.total) * 100));
    });

                
    evt.addEventListener('EVENT_ERROR', function(message) {
        var progress = loadingItem.querySelectorAll('progress')[0];
        loadingItem.removeChild(progress);
        loadingItem.classList.add('error');
        loadingItem.onclick = function() { alert(message); };
    });
}

function makeURLItem(URL) {
    var ul = ECurrentAlbum.querySelectorAll('ul')[0],
        img = makeImage(URL);
    var loadingItem = makeLoadingItem(img);
    var progress = loadingItem.querySelectorAll('progress')[0];
    ul.insertBefore(loadingItem, ul.firstChild);
    var evt;
    if (CurrentAlbum == "_thisComputer") {
        evt = model.unsorted.sendImageURL(URL);
        evt.addEventListener('EVENT_SUCCESS', function (e) {
            convertLoadingToAlbum(loadingItem, e);
        });
    } else {
        evt = model.authenticated.sendImageURL(CurrentAlbum, URL);
        evt.addEventListener('EVENT_SUCCESS', function (e) {
            convertLoadingToAlbum(loadingItem, e);
        });
    }

    evt.addEventListener(evt.EVENT_PROGRESS, function (e) {
        progress.value = Math.floor(((e.loaded / e.total) * 100));
    });


    evt.addEventListener('EVENT_ERROR', function (message) {
        var progress = loadingItem.querySelectorAll('progress')[0];
        loadingItem.removeChild(progress);
        loadingItem.classList.add('error');
        loadingItem.onclick = function () { alert(message); };
    });
}


function deleteImage(image) {


	var elem = document.getElementById(image.id);

    progress = UTILS.DOM.create('progress');

    elem.appendChild(progress);
    var links = elem.querySelectorAll('a');
    elem.removeChild(links[0]);
    elem.removeChild(links[1]);

    elem.classList.add('loading');
    if (CurrentAlbum == "_thisComputer") {
    	model.unsorted.deleteImage(image.deletehash).addEventListener('EVENT_SUCCESS', function (e) {
            if (elem) {
                elem.parentNode.removeChild(elem);
            }
        });
    } else {
        elem.style.cursor = 'progress';
        model.authenticated.deleteImage(image.id).addEventListener('EVENT_SUCCESS', function (e) {
            if (elem) {
                elem.style.cursor = 'default';
                elem.parentNode.removeChild(elem);
            }
        });
    }
}

function resizeImage(img, maxh, maxw) {

    var maxh = 180,
        maxw = 180;
    var ratio = maxh/maxw;
    if (img.height/img.width > ratio){
        if (img.height > maxh){
            img.width = Math.round(img.width*(maxh/img.height));
            img.height = maxh;
        }
    } else {
        if (img.width > maxh){
            img.height = Math.round(img.height*(maxw/img.width));
            img.width = maxw;

        }
    }

    img.style.top = (200 - img.height) / 2 + 'px';
    img.style.left = (200 - img.width) / 2 + 'px';
};

function makeAlbumItem(imageItem) {

    var li = UTILS.DOM.create('li'),
        img = UTILS.DOM.create('img'),
        del = UTILS.DOM.create('a'),
        copy = UTILS.DOM.create('a'),
        edit = UTILS.DOM.create('a'),
		reddit = UTILS.DOM.create('a'),
		download = UTILS.DOM.create('a'),
        copyInput = UTILS.DOM.create('input');

    del.href = copy.href = "#";
    del.innerHTML = "delete";
    del.classList.add('image-delete');
    del.onclick = function (e) {
        e.preventDefault();
        if (del.innerHTML == 'sure?') {
        	deleteImage(imageItem);
        } else {
            del.innerHTML = 'sure?';
        }

    };

    copy.innerHTML = "copy link";
    copy.classList.add('image-copy');
    copy.onclick = function (e) {
        e.preventDefault();
        copyInput.select();
        document.execCommand("Copy");
        var copyNotification = UTILS.DOM.create('span');

        copyNotification.innerHTML = 'copied';
        copyNotification.classList.add('copy-notification');
        li.appendChild(copyNotification);
        setTimeout(function () {
            li.removeChild(copyNotification);
        }, 1000);
    };

    copyInput.type = 'text';
    copyInput.value = imageItem.link;

    li.classList.add('loading');

    img.style.display = 'none';
    img.id = 'image-' + imageItem.id;

    img.onload = function () {
        resizeImage(this);
        
        if (imageItem.animated && model.preferences.get('freezegifs')) {
            var canvas = UTILS.DOM.create('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            canvas.style.top = this.style.top;
            canvas.style.left = this.style.left;
            canvas.id = this.id;
            canvas.getContext('2d').drawImage(this, 0, 0, this.width, this.height);
            canvas.onclick = img.onclick;
            li.appendChild(canvas);
            li.onmouseover = function () { canvas.style.display = "none"; img.style.display = "block"; };
            li.onmouseout = function () { img.style.display = "none"; canvas.style.display = "block"; };
        }
		else {
			// Show the img only for non animated image. Your CPU will not cry anymore.
			img.style.display = 'block';
		}
        
        li.classList.remove('loading');

    };

    img.onclick = function () {
        chrome.tabs.create({ "url": imageItem.link, "selected": true });
    };

    img.src = imageItem.link + 't';

    li.id = imageItem.id;

    edit.href = "#";
    edit.innerHTML = "edit copy";
    edit.classList.add('image-edit');
    edit.onclick = function (e) {
    	e.preventDefault();
    	featherEditor.launch({
    		image: 'image-' + imageItem.id,
    		url: imageItem.link
    	});
    }


    download.href = "#";
    download.innerHTML = "download";
    download.classList.add('image-download');
    download.onclick = function (e) {
    	e.preventDefault();
    	var existingIFrame = li.querySelectorAll('iframe')[0];
    	if (existingIFrame) {
    		li.removeChild(existingIFrame);
    	}

    	var iFrame = UTILS.DOM.create('iframe');
    	iFrame.src = "http://imgur.com/download/" + imageItem.id;
    	li.appendChild(iFrame);

    };

    reddit.href = "#";
    reddit.innerHTML = "reddit";
    reddit.classList.add('image-reddit');
    reddit.onclick = function (e) {
    	e.preventDefault();
    	chrome.tabs.create({ url: "http://www.reddit.com/submit?url=" + imageItem.link });
    };


    li.appendChild(copyInput);
    li.appendChild(img);
    li.appendChild(del);
    li.appendChild(copy);
    li.appendChild(edit);
    li.appendChild(download);
    li.appendChild(reddit);

    return li;

}

function makeLoadingItem(image) {
    var li = UTILS.DOM.create('li'),
        progress = UTILS.DOM.create('progress');

    progress.setAttribute('min', '0');
    progress.setAttribute('max', '100');
    
    li.appendChild(image);
    li.appendChild(progress);
    li.classList.add('loading');

    return li;
}

function convertLoadingToAlbum(loadingItem, fullItem) {
    loadingItem.parentNode.replaceChild(makeAlbumItem(fullItem), loadingItem);
}

function makeAlbum(album) {
    var div = UTILS.DOM.create('div'),
        ul = UTILS.DOM.create('ul');

    div.id = album.id;
    div.className = 'album';

    div.appendChild(ul);

    return div;

}

function changeAlbum(albumID) {
	hideStatusBar();
    if (albumID == '_newAlbum') {

        var albumTitle = prompt('Album title');

        if (albumTitle == "" || !albumTitle) {
            ENavSelect.value = CurrentAlbum;
        } else {
        	model.authenticated.makeAlbum(albumTitle).addEventListener('EVENT_COMPLETE', function (album) {
        		model.currentAlbum.set(album.id);
                window.location.reload();
            });
        }

        return;
    }

    model.currentAlbum.set(albumID);

    ENavSelect.value = albumID;

    if (ECurrentAlbum) {
        ECurrentAlbum.classList.remove('active');
    }

    CurrentAlbum = albumID;
    ECurrentAlbum = UTILS.DOM.id(CurrentAlbum);
    ECurrentAlbum.classList.add('active');

    var ul = ECurrentAlbum.querySelectorAll('ul')[0];

    if (CurrentAlbum == "_thisComputer") {
        var images = model.unsorted.get();
        ul.innerHTML = "";
        if (images.length > 0) {
        	for (var i = 0; i < images.length; i++) {
        		ul.insertBefore(makeAlbumItem(images[i]), ul.firstChild);
        	}
        } else {
			showStatusBar("You have no images in this album. You can drag and drop images onto this page or print screen and paste straight onto this page to upload your images.");
        }
    } else if (CurrentAlbum == "_userAlbum") {
        document.body.style.cursor = 'progress';
        model.authenticated.fetchUserImages().addEventListener('EVENT_SUCCESS', function (images) {
            document.body.style.cursor = 'default';
            ul.innerHTML = "";
            if (images) {
                for (var i = 0; i < images.length; i++) {
                    ul.insertBefore(makeAlbumItem(images[i]), ul.firstChild);
                }
            }
        });
    } else {
    	
        document.body.style.cursor = 'progress';
        var noImages = ECurrentAlbum.querySelectorAll('.no-images')[0];
        model.authenticated.fetchAlbumImages(CurrentAlbum).addEventListener('EVENT_COMPLETE', function () {
        	document.body.style.cursor = 'default';
        	ul.innerHTML = "";
        }).addEventListener('EVENT_SUCCESS', function (data) {
        	
        	if (data.images.length > 0) {
        		for (var i = 0; i < data.images.length; i++) {
        			ul.insertBefore(makeAlbumItem(data.images[i]), ul.firstChild);
        		}
        	} else {
        		showStatusBar("You have no images in this album. You can drag and drop images onto this page or print screen and paste straight onto this page to upload your images.");
        	}
        });
    }

}

function showStatusBar(text, showClose) {
	EStatusBar.querySelectorAll('.content')[0].innerHTML = text;
	if (showClose) {
		EStatusBarLink.style.display = "block";
	} else {
		EStatusBarLink.style.display = "none";
	}
	EStatusBar.classList.add('show');
}

function hideStatusBar() {
	EStatusBar.classList.remove('show');
}

function initAuthenticated() {
    ENavConnect.classList.add('hide');
    ENavSelect.classList.remove('hide');
    var albums = model.authenticated.getAlbums();

    var unsortedOpt = UTILS.DOM.create('option');
    unsortedOpt.value = '_thisComputer';
    unsortedOpt.text = '- this computer -';
    ENavSelect.appendChild(unsortedOpt);

    var defaultAlbumOpt = UTILS.DOM.create('option');
    defaultAlbumOpt.value = '_userAlbum';
    defaultAlbumOpt.text = model.authenticated.getAccount().url;
    ENavSelect.appendChild(defaultAlbumOpt);

    var EUserAlbum = makeAlbum(makeAlbum({ id: '_userAlbum' }));
    EAlbums.appendChild(EUserAlbum);

    if (albums) {
        for (var i = 0; i < albums.length; i++) {

            var EAlbum = makeAlbum(albums[i]);

            var opt = UTILS.DOM.create('option');
            opt.value = albums[i].id;
            opt.text = albums[i].title || "(Untitled Album)";

            ENavSelect.appendChild(opt);
            EAlbums.appendChild(EAlbum);
        }
    }
	/* Unexpected results
    var newAlbumOpt = UTILS.DOM.create('option');
    newAlbumOpt.value = '_newAlbum';
    newAlbumOpt.text = '<New Album>';
    ENavSelect.appendChild(newAlbumOpt);
	*/
}

port.onMessage.addListener(function (msg) {
    // Only gets one message
    window.location.reload();
});

window.onload = function () {

	EAlbums = UTILS.DOM.id('albums');
	EWrap = UTILS.DOM.id('wrap');
	ENav = document.getElementsByTagName('nav')[0];
	ENavConnect = UTILS.DOM.id('nav-connect');
	ENavDownload = UTILS.DOM.id('nav-download');
	ENavDelete = UTILS.DOM.id('nav-delete');
	ENavSelect = UTILS.DOM.id('nav-albums');
	ENavOptions = UTILS.DOM.id('nav-options');
	ENavAbout = UTILS.DOM.id('nav-about');
	EStatusBar = UTILS.DOM.id('status-bar');
	EStatusBarLink = EStatusBar.querySelectorAll('span')[0];

	document.documentElement.ondrop = function (e) {
        e.preventDefault();
		uploadFiles(e);
		hideStatusBar();
	};

	document.documentElement.ondragenter = function (e) {
		e.dataTransfer.dropEffect = 'copy';
		e.preventDefault();
		return false;
	};

	document.documentElement.ondragover = function (e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		showStatusBar("Drop images to upload");
		return false;
	};

	document.documentElement.ondragexit = document.documentElement.ondragleave = function (e) {
		hideStatusBar();
		return false;
	};


	document.documentElement.onpaste = function (e) {
		var items = e.clipboardData.items;
		for (var i = 0; i < items.length; ++i) {
			if (items[i].kind == 'file' && items[i].type == 'image/png') {
				var blob = items[i].getAsFile();

				var reader = new FileReader();
				reader.onload = function (e) {
					makeItem(e.target.result);
				}
				reader.readAsDataURL(blob);

			}
		}
	};

	ENavConnect.onclick = function () {
		ENavConnect.onclick = null;
		ENavConnect.innerHTML = '<progress />';
		ENavConnect.style.cursor = 'progress';
		port.postMessage({ CMD: "get_user" });
	};

	ENavSelect.onchange = function () {
		changeAlbum(this.value);
	};

	ENavOptions.onclick = function () {
		if (document.querySelectorAll('.loading').length > 0) {
			chrome.tabs.create({ "url": "options.html", "selected": true });
		} else {
			window.location = "options.html";
		}
	};

	ENavDownload.onclick = function (e) {
		e.preventDefault();
		var downloadLinks = ECurrentAlbum.querySelectorAll('.image-download');

		var evObj = document.createEvent('MouseEvents');
		evObj.initEvent('click', true, false);

		for (var i = 0; i < downloadLinks.length; i++) {
			downloadLinks[i].dispatchEvent(evObj);
		}

	}

	ENavDelete.onclick = function (e) {
		e.preventDefault();

		if(confirm("Are you sure you want to delete all images in this album?")) {

			var images = ECurrentAlbum.querySelectorAll('li');

			for (var i = 0; i < images.length; i++) {
				deleteImage(images[i])
			}

		}

		

	}

	ENavAbout.onclick = function () {
		if (document.querySelectorAll('.loading').length > 0) {
			chrome.tabs.create({ "url": "about.html", "selected": true });
		} else {
			window.location = "about.html";
		}
	};

	EStatusBarLink.addEventListener('click', function (e) {
		hideStatusBar();
	});

	EAlbums.appendChild(makeAlbum({ id: '_thisComputer' }));

	if (model.authenticated.oAuthManager.getAuthStatus()) {
		initAuthenticated();
	} else {
		ENavConnect.classList.remove('hide');
	}
	changeAlbum(model.currentAlbum.get());

};