/*
	Cape Breton Radio Playlist Statistics - Main
	Author: Andy Deveaux
*/

(function() {
	'use strict';
	var MAX_DATA_DOWNLOAD_ATTEMPTS = 2;
	var RADIO_DATA_FILE = 'playlists_data.json';
	
	var btnFetchData;
	var btnShowStatistics;
	var btnShowAllArtists;
	var btnShowAllSongs;
	var btnShowPlaylists;
	var btnShowSearch;
	
	var dataDownloadBox;
	var dataBox;
	
	// Search
	var searchBox;
	var searchStationSelect;
	var txtSearchSong;
	var txtSearchArtist;
	var searchSortBy;
	var searchSortOrder;
	var btnSearch;
	
	var songDataDisplay;
	
	// Playlist filter
	var playlistFilter;
	var playlistStationSelect;
	
	var radioQuery;			// Object for holding all of the radio data
	var downloadRadioDataAttempts;
	var prevSelectedButton;
	
	// Compatibility stuff
	function addEventListener(target, type, callback, options) {
		if (typeof target.addEventListener === 'function') {
			target.addEventListener(type, callback, options);
		}
		// IE 6-8
		else {
			target.attachEvent('on' + type, callback);
		}
	}
	
	function removeEventListener(target, type, callback, options) {
		if (typeof target.removeEventListener === 'function') {
			target.removeEventListener(type, callback, options);
		}
		// IE 6-8
		else {
			target.detachEvent('on' + type, callback);
		}
	}
	
	// Adds constants to object prototypes if they don't exist
	function addPrototypeConstants(obj, const_name, value) {
		var type = typeof value;
		if (typeof obj.prototype[const_name] !== type && obj.prototype[const_name] !== value) {
			obj.prototype[const_name] = value;
		}
	}
	
	function init() {
		var getElement = function(id) {
			return document.getElementById(id);
		};
		btnFetchData = getElement('btn-fetch-data');
		btnShowStatistics = getElement('btn-show-statistics');
		btnShowAllArtists = getElement('btn-show-all-artists');
		btnShowAllSongs = getElement('btn-show-all-songs');
		btnShowPlaylists = getElement('btn-show-playlists');
		btnShowSearch = getElement('btn-show-search');
		
		dataDownloadBox = getElement('data-download-box');
		dataBox = getElement('data-box');
		
		searchBox = getElement('search');
		searchStationSelect = getElement('search-station');
		txtSearchSong = getElement('txt-search-song');
		txtSearchArtist = getElement('txt-search-artist');
		searchSortBy = getElement('search-sort-by');
		searchSortOrder = getElement('search-sort-order');
		btnSearch = getElement('btn-search');
		
		songDataDisplay = getElement('song-data');
		
		playlistFilter = getElement('playlist-filter');
		playlistStationSelect = getElement('playlist-station');
		
		// Add XMLHttpRequest state constants for IE
		addPrototypeConstants(XMLHttpRequest, 'UNSENT', 0);
		addPrototypeConstants(XMLHttpRequest, 'OPENED', 1);
		addPrototypeConstants(XMLHttpRequest, 'HEADERS_RECIEVED', 2);
		addPrototypeConstants(XMLHttpRequest, 'LOADING', 3);
		addPrototypeConstants(XMLHttpRequest, 'DONE', 4);
		
		addEventListener(btnFetchData, 'click', onButtonFetchDataClick);
	}
	
	function removeCurrentDisplayData() {
		var children_to_remove = [];
		var i;
		for (i=0; i<songDataDisplay.children.length; i++) {
			if (songDataDisplay.children[i].id !== 'playlist-filter') {
				children_to_remove.push(songDataDisplay.children[i]);
			}
		}
		
		for (i=0; i<children_to_remove.length; i++) {
			songDataDisplay.removeChild(children_to_remove[i]);
		}
		
		searchBox.className = 'hidden';
		playlistFilter.className = 'hidden';
	}
	
	function selectButton(button, group, callback) {
		if (typeof prevSelectedButton === 'object' && prevSelectedButton.group === group) {
			addEventListener(prevSelectedButton.button, 'click', prevSelectedButton.callback);
			prevSelectedButton.button.className = '';
		}
		
		prevSelectedButton = { button: button, group: group, callback: callback };
		button.className = 'selected';
		removeEventListener(button, 'click', callback);
	}
	
	function onButtonFetchDataClick(e) {
		removeEventListener(e.target || e.srcElement, 'click', onButtonFetchDataClick);
		btnFetchData.className = 'hidden';
		
		downloadRadioDataAttempts = 0;
		downloadRadioData();
	}
	
	function onButtonShowStatisticsClick(e) {
		selectButton(e.target || e.srcElement, 'show', onButtonShowStatisticsClick);
		removeCurrentDisplayData();
		
		var top_20_songs_by_stations = radioQuery.getMostAndLeastPlayedSongsForStations(20);
	}
	
	function onButtonShowAllArtistsClick(e) {
		selectButton(e.target || e.srcElement, 'show', onButtonShowAllArtistsClick);
		removeCurrentDisplayData();
		
		var data = radioQuery.getArtistData();
	}
	
	function onButtonShowAllSongsClick(e) {
		selectButton(e.target || e.srcElement, 'show', onButtonShowAllSongsClick);
		removeCurrentDisplayData();
		
		var data = radioQuery.getSongData();
	}
	
	function onButtonShowPlaylistsClick(e) {
		selectButton(e.target || e.srcElement, 'show', onButtonShowPlaylistsClick);
		removeCurrentDisplayData();
		
		var data = radioQuery.getPlaylistsData();
	}
	
	function onButtonShowSearchClick(e) {
		selectButton(e.target || e.srcElement, 'show', onButtonShowSearchClick);
		removeCurrentDisplayData();
		
		searchBox.className = '';
	}
	
	function onButtonSearchClick(e) {
		var data = RadioQuery.getSearchData(radioData, searchStationSelect.value, txtSearchSong, txtSearchArtist, searchSortBy, searchSortOrder === 'asc' ? true : false);
	}
	
	function onRadioDataDownloaded(http_req) {
		if (http_req.readyState === http_req.DONE) {
			var retry = false;
			if (http_req.status === 200) {
				console.log('Data downloaded.');
				// If it failed to parse, the data probably didn't download correctly
				try {
					radioQuery = new RadioQuery(JSON.parse(http_req.responseText));
					showRadioDataDownloadSuccess();
				}
				catch (e) {
					console.log('Data failed to parse. Reason: ', e.message);
					retry = true;
				}	
			}
			else {
				console.log('Data failed to download.');
				retry = true;
			}
			
			if (retry) {
				if (downloadRadioDataAttempts < MAX_DATA_DOWNLOAD_ATTEMPTS) {
					console.log('Retrying.');
					downloadRadioData();
				}
				else {
					console.log('Max retry attempts reached.');
					showRadioDataDownloadFailure();
				}
			}
		}
	}
	
	function showRadioDataDownloadSuccess() {
		addEventListener(btnShowStatistics, 'click', onButtonShowStatisticsClick);
		addEventListener(btnShowAllArtists, 'click', onButtonShowAllArtistsClick);
		addEventListener(btnShowAllSongs, 'click', onButtonShowAllSongsClick);
		addEventListener(btnShowPlaylists, 'click', onButtonShowPlaylistsClick);
		addEventListener(btnShowSearch, 'click', onButtonShowSearchClick);
		
		dataBox.className = '';
	}
	
	function showRadioDataDownloadFailure() {
		btnFetchData.className = '';
		addEventListener(btnFetchData, 'click', onButtonFetchDataClick);
	}
	
	function downloadRadioData()
	{
		console.log('Downloading data...');
		downloadRadioDataAttempts += 1;
		var http_req = new XMLHttpRequest();
		http_req.open('GET', RADIO_DATA_FILE, true);
		http_req.overrideMimeType('application/json');
		http_req.onreadystatechange = function() {
			onRadioDataDownloaded(http_req);
		};
		http_req.send();
	}
	
	window.self.onload = init;
}());