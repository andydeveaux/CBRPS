/*
	Cape Breton Radio Playlist Statistics - Main
	Author: Andy Deveaux
*/

(function() {
	'use strict';
	var MAX_DATA_DOWNLOAD_ATTEMPTS = 2;
	var RADIO_DATA_FILE = 'playlists_data.json';
	
	var btnFetchData;
	var txtLimitStats;
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
		txtLimitStats = getElement('txt-limit-stats');
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
		
		var limit = 20;
		var parsed = parseInt(txtLimitStats.value);
		if (!isNaN(parsed)) {
			if (parsed <= 0) {
				limit = 0;
			}
			else {
				limit = parsed;
			}
			txtLimitStats.value = limit;
		}
		else {
			txtLimitStats.value = limit;
		}
		var stats = radioQuery.getStats(limit);
		
		generateStatisticsLinkList();
		
		var SONG_COLUMNS = ['Song Name', 'Artist Name', 'Play Count'];
		var ARTIST_COLUMNS = ['Artist Name', 'Play Count'];		
		var LOOP_DATA = [
			{title: 'The ' + limit + ' Most Played Songs', columns: SONG_COLUMNS, id: 'most-played-songs', stats: stats.mostPlayedSongs},
			{title: 'The ' + limit + ' Least Played Songs', columns: SONG_COLUMNS, id: 'least-played-songs', stats: stats.leastPlayedSongs},
			{title: 'The ' + limit + ' Most Played Artists', columns: ARTIST_COLUMNS, id: 'most-played-artists', stats: stats.mostPlayedArtists},
			{title: 'The ' + limit + ' Least Played Artists', columns: ARTIST_COLUMNS, id: 'least-played-artists', stats: stats.leastPlayedArtists}
		];
		var i;
		for (i=0; i<LOOP_DATA.length; i++) {
			songDataDisplay.appendChild(generateElementWithText('h2', LOOP_DATA[i].title, {id: LOOP_DATA[i].id}));
			songDataDisplay.appendChild(generateTable(LOOP_DATA[i].columns, LOOP_DATA[i].stats));
			songDataDisplay.appendChild(generateLink('#data-box', 'Go to Top', false));
		}
		songDataDisplay.appendChild(document.createElement('br'));
		songDataDisplay.appendChild(document.createElement('hr'));
		
		var stations = radioQuery.getAllStations();
		var station_loop_data, station_id;
		for (station_id in stats.stationsMostPlayedSongs) {
			if (stats.stationsMostPlayedSongs.hasOwnProperty(station_id)) {
				station_loop_data = [
					{title: 'The ' + limit + ' Most Played Songs', columns: SONG_COLUMNS, id: station_id + '-most-played-songs', stats: stats.stationsMostPlayedSongs[station_id]},
					{title: 'The ' + limit + ' Least Played Songs', columns: SONG_COLUMNS, id: station_id + '-least-played-songs', stats: stats.stationsLeastPlayedSongs[station_id]},
					{title: 'The ' + limit + ' Most Played Artists', columns: ARTIST_COLUMNS, id: station_id + '-most-played-artists', stats: stats.stationsMostPlayedArtists[station_id]},
					{title: 'The ' + limit + ' Least Played Artists', columns: ARTIST_COLUMNS, id: station_id + '-least-played-artists', stats: stats.stationsLeastPlayedArtists[station_id]},
					{title: 'The ' + limit + ' Most Played Christmas Songs', columns: SONG_COLUMNS, id: station_id + '-most-played-xmas-songs', stats: stats.stationsMostPlayedChristmasSongs[station_id]},
					{title: 'The ' + limit + ' Least Played Christmas Songs', columns: SONG_COLUMNS, id: station_id + '-least-played-xmas-songs', stats: stats.stationsLeastPlayedChristmasSongs[station_id]}
				];
				
				songDataDisplay.appendChild(generateElementWithText('h2', stations[station_id][0]));
				for (i=0; i<station_loop_data.length; i++) {
					songDataDisplay.appendChild(generateStationHeader(stations[station_id][0], stations[station_id][1], station_loop_data[i].title, station_loop_data[i].id));
					songDataDisplay.appendChild(generateTable(station_loop_data[i].columns, station_loop_data[i].stats));
					songDataDisplay.appendChild(generateLink('#data-box', 'Go to Top', false));
				}
				songDataDisplay.appendChild(document.createElement('br'));
				songDataDisplay.appendChild(document.createElement('hr'));
			}
		}
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
	
	function onTextLimitStatsChange(e) {
		if (btnShowStatistics.className === 'selected') {
			btnShowStatistics.className = '';
			addEventListener(btnShowStatistics, 'click', onButtonShowStatisticsClick);
		}
	}
	
	function showRadioDataDownloadSuccess() {
		addEventListener(txtLimitStats, 'change', onTextLimitStatsChange);
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
	
	function generateStationHeader(name, url, desc, id) {
		var header = document.createElement('h3');
		if (typeof id === 'string') {
			header.setAttribute('id', id);
		}
		header.appendChild(document.createTextNode(name + ' ('));
		header.appendChild(generateLink(url, url, true));
		header.appendChild(document.createTextNode(') - ' + desc));
		return header;
	}
	
	function generateLink(url, text, new_window) {
		var link = document.createElement('a');
		link.setAttribute('href', url);
		if (new_window) {
			link.setAttribute('target', '_window');
		}
		if (typeof link.innerText !== 'string') {
			link.innerText = text.replace(/\&/g, '&amp;');
		}
		else {
			link.textContent = text.replace(/\&/g, '&amp;');
		}
		return link;
	}
	
	function generateTable(columns, data, id) {
		var container = document.createElement('div');
		container.className = 'playlist-container';
		
		var table = document.createElement('table');
		if (typeof id === 'string') {
			table.setAttribute('id', id);
		}
		table.className = 'songlist';
		
		var thead = document.createElement('thead');
		thead.appendChild(generateTableRow(['#'].concat(columns), true));
		
		var tbody = document.createElement('tbody');
		var i, last_index = data[0].length - 1;
		for (i=0; i<data.length; i++) {
			data[i][last_index] = data[i][last_index] + ' times';
			tbody.appendChild(generateTableRow([i+1].concat(data[i])));
		}
		
		table.appendChild(thead);
		table.appendChild(tbody);
		container.appendChild(table);
		return container;
	}
	
	function generateTableRow(cells, header) {
		var cell_type;
		if (typeof header === 'undefined') {
			cell_type = 'td';
		}
		else {
			cell_type = 'th';
		}
		
		var row = document.createElement('tr');	
		var i;
		for (i=0; i<cells.length; i++) {
			row.appendChild(generateElementWithText(cell_type, cells[i]));
		}
		return row;
	}
	
	function generateListItem(element) {
		var item = document.createElement('li');
		item.appendChild(element);
		return item;
	}
	
	function generateElementWithText(type, text, attribs) {
		var element = document.createElement(type);
		if (typeof attribs === 'object') {
			var a;
			for (a in attribs) {
				if (attribs.hasOwnProperty(a)) {
					element.setAttribute(a, attribs[a]);
				}
			}
		}
		element.appendChild(document.createTextNode(text));
		return element;
	}
	
	function generateStatisticsLinkList() {
		var link_loop_data = [
			{href: '#most-played-songs', text: 'Most Played Songs'},
			{href: '#least-played-songs', text: 'Least Played Songs'},
			{href: '#most-played-artists', text: 'Most Played Artists'},
			{href: '#least-played-artists', text: 'Least Played Artists'},
			{href: '#most-played-xmas-songs', text: 'Most Played Christmas Songs'},
			{href: '#least-played-xmas-songs', text: 'Least Played Christmas Songs'}
		];
		
		var list = document.createElement('ul');
		list.className = 'linklist';
		var i;
		for (i=0; i<link_loop_data.length; i++) {
			list.appendChild(generateListItem(generateLink(link_loop_data[i].href, link_loop_data[i].text, false)));
		}
		
		var stations = radioQuery.getAllStations();
		link_loop_data = [
			{href: '-most-played-songs', text: 'Most Played Songs'},
			{href: '-least-played-songs', text: 'Least Played Songs'},
			{href: '-most-played-artists', text: 'Most Played Artists'},
			{href: '-least-played-artists', text: 'Least Played Artists'},
			{href: '-most-played-xmas-songs', text: 'Most Played Christmas Songs'},
			{href: '-least-played-xmas-songs', text: 'Least Played Christmas Songs'}
		];
		var station_id, sub_list;
		for (station_id in stations) {
			if (stations.hasOwnProperty(station_id)) {
				
				list.appendChild(generateListItem(generateElementWithText('span', stations[station_id][0], {style: 'font-weight: 700'})));
				sub_list = document.createElement('ul');
				for (i=0; i<link_loop_data.length; i++) {
					sub_list.appendChild(generateListItem(generateLink('#' + station_id + link_loop_data[i].href, link_loop_data[i].text, false)));
				}
				list.appendChild(sub_list);
			}
		}
		songDataDisplay.appendChild(list);
	}
	
	window.self.onload = init;
}());