/*
	Cape Breton Radio Playlist Statistics - Main
	Author: Andy Deveaux
*/

(function() {
	'use strict';
	var MAX_DATA_DOWNLOAD_ATTEMPTS = 2;
	var RADIO_DATA_FILE = 'playlists_data.json';
	
	var CacheType = {
		NONE: 0,
		STATISTICS: 1,
		SONGS: 2,
		ARTISTS: 3,
		PLAYLISTS: 4
	};
	
	var btnFetchData;
	var lblFetchStatus;
	var dataDownloadBox;
	
	var optStatistics;
	var optSongs;
	var optArtists;
	var optPlaylists;
	
	// Filter
	var filterBoxStation;
	var filterBoxSong;
	var filterBoxArtist;
	var filterBoxSortBy;
	var filterBoxSortOrder;
	var filterBoxLimit;
	var selFilterStation;
	var txtFilterSong;
	var txtFilterArtist;
	var selFilterSortBy;
	var selFilterSortOrder;
	var txtFilterLimit;
	var selFilterLimit;
	var btnFilterSubmit;
	var btnFilterReset;
	
	var dataBox;
	var songDataBox;
	
	var radioQuery;					// Object for holding all of the radio data
	var cachedData;					// Full reults from one of the RadioQuery functions, cached for faster filtering
	var currentCacheType;			// Identify which data the cache is holding
	var downloadRadioDataAttempts;
	var currentSelectedOption;
	
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
		
	function setInnerText(element, text) {
		if (typeof element.innerText !== 'string') {
			element.innerText = text;
		}
		// Firefox < 45
		else {
			element.textContent = text;
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
		
		// Fetch data
		dataDownloadBox = getElement('data-download-box');
		btnFetchData = getElement('btn-fetch-data');
		lblFetchStatus = getElement('lbl-fetch-status');
		
		// Display boxes
		dataBox = getElement('data-box');
		songDataBox = getElement('song-data');
		
		// Data choices
		optStatistics = getElement('opt-statistics');
		optSongs = getElement('opt-songs');
		optArtists = getElement('opt-artists');
		optPlaylists = getElement('opt-playlists');
		
		// Filter
		filterBoxStation = getElement('filter-box-station');
		filterBoxSong = getElement('filter-box-song');
		filterBoxArtist = getElement('filter-box-artist');
		filterBoxSortBy = getElement('filter-box-sort-by');
		filterBoxSortOrder = getElement('filter-box-sort-order');
		filterBoxLimit = getElement('filter-box-limit');
		selFilterStation = getElement('sel-filter-station');
		txtFilterSong = getElement('txt-filter-song');
		txtFilterArtist = getElement('txt-filter-artist');
		selFilterSortBy = getElement('sel-filter-sort-by');
		selFilterSortOrder = getElement('sel-filter-sort-order');
		txtFilterLimit = getElement('txt-filter-limit');
		selFilterLimit = getElement('sel-filter-limit');
		btnFilterSubmit = getElement('btn-filter-submit');
		btnFilterReset = getElement('btn-filter-reset');
		
		// Add XMLHttpRequest state constants for IE
		addPrototypeConstants(XMLHttpRequest, 'UNSENT', 0);
		addPrototypeConstants(XMLHttpRequest, 'OPENED', 1);
		addPrototypeConstants(XMLHttpRequest, 'HEADERS_RECIEVED', 2);
		addPrototypeConstants(XMLHttpRequest, 'LOADING', 3);
		addPrototypeConstants(XMLHttpRequest, 'DONE', 4);
		
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
	
	function showRadioDataDownloadSuccess() {
		unhideElement(dataBox);
		setInnerText(lblFetchStatus, '');
		
		var stations = radioQuery.getAllStations();
		var station_id;
		for (station_id in stations) {
			if (stations.hasOwnProperty(station_id)) {
				selFilterStation.appendChild(generateElementWithText('option', stations[station_id][0], {value: station_id}));
			}
		}
		
		// Setup event handlers
		addEventListener(optStatistics, 'click', onOptStatisticsClick);
		addEventListener(optSongs, 'click', onOptSongsClick);
		addEventListener(optArtists, 'click', onOptArtistsClick);
		addEventListener(optPlaylists, 'click', onOptPlaylistsClick);
		addEventListener(selFilterLimit, 'change', onSelFilterLimitChange);
		addEventListener(btnFilterSubmit, 'click', onBtnFilterSubmitClick);
		addEventListener(btnFilterReset, 'click', onBtnFilterResetClick);
		
		currentCacheType = CacheType.NONE;
		updateFilterUI();
	}
	
	function showRadioDataDownloadFailure() {
		unhideElement(btnFetchData);
		setInnerText(lblFetchStatus, 'Download failed. Please try again.');
		addEventListener(btnFetchData, 'click', onButtonFetchDataClick);
	}
	
	function updateFilterUI() {
		if (optStatistics.checked) {
			selectOption(optStatistics, 'data_choice', onOptStatisticsClick);
			hideElements([filterBoxSong, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder]);
			unhideElements([filterBoxStation, filterBoxLimit]);
		}
		else if (optSongs.checked) {
			selectOption(optSongs, 'data_choice', onOptSongsClick);
			unhideElements([filterBoxStation, filterBoxSong, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder, filterBoxLimit]);
			
			clearChildren(selFilterSortBy);
			selFilterSortBy.appendChild(generateElementWithText('option', 'Play Count', {value: 'playcount'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Song', {value: 'song'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Artist', {value: 'artist'}));
		}
		else if (optArtists.checked) {
			selectOption(optArtists, 'data_choice', onOptArtistsClick);
			hideElements([filterBoxSong]);
			unhideElements([filterBoxStation, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder, filterBoxLimit]);
			
			clearChildren(selFilterSortBy);
			selFilterSortBy.appendChild(generateElementWithText('option', 'Play Count', {value: 'playcount'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Artist', {value: 'artist'}));
		}
		else if (optPlaylists.checked) {
			selectOption(optPlaylists, 'data_choice', onOptPlaylistsClick);
			unhideElements([filterBoxStation, filterBoxSong, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder, filterBoxLimit]);
			
			clearChildren(selFilterSortBy);
			selFilterSortBy.appendChild(generateElementWithText('option', 'Song', {value: 'song'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Artist', {value: 'artist'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Date', {value: 'date'}));
		}
		
		txtFilterLimit.value = selFilterLimit.value;
	}
	
	function removeCurrentDisplayData() {
		var children_to_remove = [];
		var i;
		for (i=0; i<songDataBox.children.length; i++) {
			if (songDataBox.children[i].id !== 'playlist-filter') {
				children_to_remove.push(songDataBox.children[i]);
			}
		}
		
		for (i=0; i<children_to_remove.length; i++) {
			songDataBox.removeChild(children_to_remove[i]);
		}
	}
	
	function selectOption(element, group, callback) {
		if (typeof currentSelectedOption === 'object' && currentSelectedOption.group === group) {
			addEventListener(currentSelectedOption.element, 'click', currentSelectedOption.callback);
		}
		
		currentSelectedOption = { element: element, group: group, callback: callback };
		addCSSClass(element, 'selected');
		removeEventListener(element, 'click', callback);
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
	
	function onButtonFetchDataClick(e) {
		removeEventListener(e.target || e.srcElement, 'click', onButtonFetchDataClick);
		hideElement(btnFetchData);
		
		downloadRadioDataAttempts = 0;
		downloadRadioData();
	}
	
	function onOptStatisticsClick(e) {
		updateFilterUI();
	}
	
	function onOptSongsClick(e) {
		updateFilterUI();
	}
	
	function onOptArtistsClick(e) {
		updateFilterUI();
	}
	
	function onOptPlaylistsClick(e) {
		updateFilterUI();
	}
	
	function onSelFilterLimitChange(e) {
		txtFilterLimit.value = selFilterLimit.value;
	}
	
	function onBtnFilterSubmitClick(e) {
		var use_cache;
		var station_id = parseInt(selFilterStation.value);
		if (isNaN(station_id)) {
			station_id = 'any';
		}
		
		var limit = parseInt(txtFilterLimit.value);
		if (isNaN(limit)) {
			limit = 25;
			updateFilterUI();
		}
		
		if (optStatistics.checked) {
			 use_cache = (currentCacheType === CacheType.STATISTICS);
			showStatistics(station_id, limit, use_cache);
		}
		else if (optSongs.checked) {
			use_cache = (currentCacheType === CacheType.SONGS);
		}
		else if (optArtists.checked) {
			use_cache = (currentCacheType === CacheType.ARTISTS);
		}
		else if (optPlaylists.checked) {
			use_cache = (currentCacheType === CacheType.PLAYLISTS);
		}
	}
	
	function onBtnFilterResetClick(e) {
		selFilterStation.value = 'any';
		txtFilterSong.value = '';
		txtFilterArtist.value = '';
		selFilterSortBy.selectedIndex = 0;
		selFilterSortOrder.value = 'desc';
		txtFilterLimit.value = '25';
		selFilterLimit.value = '25';
	}
	
	function showStatistics(station_id, limit, use_cache) {
		removeCurrentDisplayData();
		var limit_display;
		if (limit === 0) {
			limit_display = 'The';
		}
		else {
			limit_display = 'The ' + limit;
		}

		var stats;
		if (use_cache) {
			stats = cachedData;
		}
		else {
			console.log(radioQuery);
			stats = radioQuery.getStatisticsData();
			setCache(stats, CacheType.STATISTICS);
		}
		
		generateStatisticsLinkList(station_id);
		
		var SONG_COLUMNS = ['Song Name', 'Artist Name', 'Play Count'];
		var ARTIST_COLUMNS = ['Artist Name', 'Play Count'];
		var LOOP_DATA;
		var stations;
		if (station_id === 'any') {
			// Loop through all stations
			stations = radioQuery.getAllStations();
			LOOP_DATA = [
				{title: limit_display + ' Most Played Songs', columns: SONG_COLUMNS, id: 'most-played-songs', stats: limitArray(stats.mostPlayedSongs, limit) },
				{title: limit_display + ' Least Played Songs', columns: SONG_COLUMNS, id: 'least-played-songs', stats: limitArray(stats.leastPlayedSongs, limit) },
				{title: limit_display + ' Most Played Artists', columns: ARTIST_COLUMNS, id: 'most-played-artists', stats: limitArray(stats.mostPlayedArtists, limit) },
				{title: limit_display + ' Least Played Artists', columns: ARTIST_COLUMNS, id: 'least-played-artists', stats: limitArray(stats.leastPlayedArtists, limit) },
				{title: limit_display + ' Most Played Christmas Songs', columns: SONG_COLUMNS, id: 'most-played-xmas-songs', stats: limitArray(stats.mostPlayedChristmasSongs, limit) },
				{title: limit_display + ' Least Played Christmas Songs', columns: SONG_COLUMNS, id: 'least-played-xmas-songs', stats: limitArray(stats.leastPlayedChristmasSongs, limit) }
			];
			
			var i;
			for (i=0; i<LOOP_DATA.length; i++) {
				songDataBox.appendChild(generateElementWithText('h2', LOOP_DATA[i].title, {id: LOOP_DATA[i].id}));
				songDataBox.appendChild(generateTable(LOOP_DATA[i].columns, LOOP_DATA[i].stats));
				songDataBox.appendChild(generateLink('#data-box', 'Go to Top', false));
			}
			songDataBox.appendChild(document.createElement('br'));
			songDataBox.appendChild(document.createElement('hr'));
		}
		else {
			// Only loop through one station for the filter
			stations = {};
			stations[station_id] = radioQuery.getStation(station_id);
			console.log(stations);
		}
		var station_loop_data;
		for (station_id in stations) {
			if (stats.stationsMostPlayedSongs.hasOwnProperty(station_id)) {
				station_loop_data = [
					{title: limit_display + ' Most Played Songs', columns: SONG_COLUMNS, id: station_id + '-most-played-songs', stats: limitArray(stats.stationsMostPlayedSongs[station_id], limit) },
					{title: limit_display + ' Least Played Songs', columns: SONG_COLUMNS, id: station_id + '-least-played-songs', stats: limitArray(stats.stationsLeastPlayedSongs[station_id], limit) },
					{title: limit_display + ' Most Played Artists', columns: ARTIST_COLUMNS, id: station_id + '-most-played-artists', stats: limitArray(stats.stationsMostPlayedArtists[station_id], limit) },
					{title: limit_display + ' Least Played Artists', columns: ARTIST_COLUMNS, id: station_id + '-least-played-artists', stats: limitArray(stats.stationsLeastPlayedArtists[station_id], limit) },
					{title: limit_display + ' Most Played Christmas Songs', columns: SONG_COLUMNS, id: station_id + '-most-played-xmas-songs', stats: limitArray(stats.stationsMostPlayedChristmasSongs[station_id], limit) },
					{title: limit_display + ' Least Played Christmas Songs', columns: SONG_COLUMNS, id: station_id + '-least-played-xmas-songs', stats: limitArray(stats.stationsLeastPlayedChristmasSongs[station_id], limit) }
				];
				
				songDataBox.appendChild(generateElementWithText('h2', stations[station_id][0]));
				for (i=0; i<station_loop_data.length; i++) {
					songDataBox.appendChild(generateStationHeader(stations[station_id][0], stations[station_id][1], station_loop_data[i].title, station_loop_data[i].id));
					songDataBox.appendChild(generateTable(station_loop_data[i].columns, station_loop_data[i].stats));
					songDataBox.appendChild(generateLink('#data-box', 'Go to Top', false));
				}
				songDataBox.appendChild(document.createElement('br'));
				songDataBox.appendChild(document.createElement('hr'));
			}
		}
	}
	
	function showArtists() {
		removeCurrentDisplayData();
		
		songDataBox.appendChild(generateElementWithText('h2', 'All Artists'));
		var artists = radioQuery.getArtistData();
		var stations = radioQuery.getAllStations();
		var artist_id, station_id;
		var record, total_play_count;
		var row_index = 1, i;
		var row;
		var pending_rows;					// Generated rows that need to be appended at the end of the inner loop
		var table = generateTable(['Artist Name', 'Station', 'Play Count'], []);		// Generate an empty table because we need to do row spanning with certain rows
		var table_ref = table.getElementsByTagName('table')[0];
		table_ref.className = 'spanned-list';
		for (artist_id in artists) {
			if (artists.hasOwnProperty(artist_id)) {
				record = artists[artist_id];
				pending_rows = [];
				total_play_count = 0;
				for (station_id in artists[artist_id][1]) {
					if (record[1].hasOwnProperty(station_id)) {
						if (record[1][station_id] <= 0) {
							continue;
						}
						
						// First row for this artist
						if (total_play_count === 0) {
							row = generateTableRow([row_index, record[0], stations[station_id][0], record[1][station_id]]);
							row.children[1].setAttribute('style', 'max-width: 150px');
							row.className = 'row-start';
						}
						else {
							row = document.createElement('tr');
							row.appendChild(generateElementWithText('td', null, {colspan: 2}));
							row.appendChild(generateElementWithText('td', stations[station_id][0], {className: 'border-me'}));
							row.appendChild(generateElementWithText('td', record[1][station_id], {className: 'border-me', style: 'text-align: center'}));
						}
						total_play_count += record[1][station_id];
						pending_rows.push(row);
					}
				}
				
				row = document.createElement('tr');
				row.appendChild(generateElementWithText('td', null, {colspan: 2}));
				row.appendChild(generateElementWithText('td', null, {className: 'border-me', style: 'border-right: 0'}));
				row.appendChild(generateElementWithText('td', 'Total: ' + total_play_count, {style: 'font-weight: 700'}));
				pending_rows.push(row);
				
				for (i=0; i<pending_rows.length; i++) {
					table_ref.tBodies[0].appendChild(pending_rows[i]);
				}
				row_index += 1;
			}
		}
		songDataBox.appendChild(table);
		songDataBox.appendChild(generateLink('#data-box', 'Go to Top', false));
	}
	
	function showSongs() {
		removeCurrentDisplayData();
		
		var songs = radioQuery.getSongData();
		var stations = radioQuery.getAllStations();
		songDataBox.appendChild(generateElementWithText('h2', 'All Songs'));
		var table = generateTable(['Song Name', 'Artist Name', 'Station', 'Play Count'], []);
		var table_ref = table.getElementsByTagName('table')[0];
		table_ref.className = 'spanned-list';
		var song_id, station_id;
		var row, record, pending_rows;
		var song_index = 1;
		var i;
		var total_play_count;
		for (song_id in songs) {
			if (songs.hasOwnProperty(song_id)) {
				total_play_count = 0;
				pending_rows = [];
				record = songs[song_id];
				for (station_id in songs[song_id][2]) {
					if (record[2].hasOwnProperty(station_id)) {
						if (record[2][station_id] <= 0) {
							continue;
						}
						
						// First row for this song
						if (total_play_count <= 0) {
							row = generateTableRow([song_index, record[0], record[1], stations[station_id][0], record[2][station_id]]);
							row.children[1].setAttribute('style', 'max-width: 200px');
							row.children[2].setAttribute('style', 'max-width: 200px');
							row.className = 'row-start';
						}
						else {
							row = document.createElement('tr');
							row.appendChild(generateElementWithText('td', null, {colspan: 3}));
							row.appendChild(generateElementWithText('td', stations[station_id][0], {className: 'border-me'}));
							row.appendChild(generateElementWithText('td', record[2][station_id], {className: 'border-me'}));
						}
						total_play_count += record[2][station_id];
						pending_rows.push(row);
					}
				}
				// Total play count row
				row = document.createElement('tr');
				row.appendChild(generateElementWithText('td', null, {colspan: 3}));
				row.appendChild(generateElementWithText('td', null, {className: 'border-me', style: 'border-right: 0'}));
				row.appendChild(generateElementWithText('td', 'Total: ' + total_play_count, {style: 'font-weight: 700'}));
				pending_rows.push(row);
				
				song_index += 1;
				for (i=0; i<pending_rows.length; i++) {
					table_ref.tBodies[0].appendChild(pending_rows[i]);
				}
			}
		}
		songDataBox.appendChild(table);
		songDataBox.appendChild(generateLink('#data-box', 'Go to Top', false));
	}
	
	function showPlaylists() {
		removeCurrentDisplayData();
		
		var playlists = radioQuery.getPlaylistsData();
		var stations = radioQuery.getAllStations();
		var station_id;
		var table;
		var i;
		songDataBox.appendChild(generateElementWithText('h2', 'Playlists'));
		for (station_id in playlists) {
			if (playlists.hasOwnProperty(station_id)) {
				songDataBox.appendChild(generateStationHeader(stations[station_id][0], stations[station_id][1], 'Playlist'));
				table = generateTable(['Song Name', 'Artist Name', 'Original Time', 'Formatted Time'], playlists[station_id], station_id + '-playlist', true);
				songDataBox.appendChild(table);
				songDataBox.appendChild(generateLink('#data-box', 'Go to Top', false));
				songDataBox.appendChild(document.createElement('br'));
			}
		}
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
			link.setAttribute('target', '_blank');
		}
		setInnerText(link, text.replace(/\&/g, '&amp;'));
		return link;
	}
	
	function generateTable(columns, data, id, no_appending) {
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
		var new_data = data.slice();			// Make new copy so we can prepend the row index and other things
		var i, last_index = columns.length;
		for (i=0; i<new_data.length; i++) {
			new_data[i] = [i+1].concat(new_data[i]);
			if (!no_appending) {
				new_data[i][last_index] = new_data[i][last_index] + ' times';
			}
			
			tbody.appendChild(generateTableRow(new_data[i]));
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
					if (a === 'className') {
						element.className = attribs[a];
					}
					else {
						element.setAttribute(a, attribs[a]);
					}
				}
			}
		}
		if (text !== null) {
			element.appendChild(document.createTextNode(text));
		}
		return element;
	}
	
	function generateStatisticsLinkList(station_id) {
		var stations;
		var list = document.createElement('ul');
		if (station_id === 'any') {
			stations = radioQuery.getAllStations();
			
			var link_loop_data = [
				{href: '#most-played-songs', text: 'Most Played Songs'},
				{href: '#least-played-songs', text: 'Least Played Songs'},
				{href: '#most-played-artists', text: 'Most Played Artists'},
				{href: '#least-played-artists', text: 'Least Played Artists'},
				{href: '#most-played-xmas-songs', text: 'Most Played Christmas Songs'},
				{href: '#least-played-xmas-songs', text: 'Least Played Christmas Songs'}
			];

			list.className = 'linklist';
			var i;
			for (i=0; i<link_loop_data.length; i++) {
				list.appendChild(generateListItem(generateLink(link_loop_data[i].href, link_loop_data[i].text, false)));
			}
		}
		else {
			stations = {};
			stations[station_id] = radioQuery.getStation(station_id);
		}
		
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
		songDataBox.appendChild(list);
		songDataBox.appendChild(document.createElement('br'));
	}
	
	function clearChildren(element) {
		var i;
		var count = element.children.length;
		for (i=0; i<count; i++) {
			element.removeChild(element.children[0]);
		}
	}
	
	function addCSSClass(element, class_name) {
		if (element.className === '') {
			element.className = class_name;
		}
		else if (element.className.search(new RegExp('^(' + class_name + ')$|^(' + class_name + '\\s.*)$|^(.*\\s' + class_name + ')$|^(.*\\s' + class_name + '\\s.*)$')) === -1) {
			element.className = class_name + ' ' + element.className;
		}
	}
	
	function hasCSSClass(element, class_name) {
		if (element.className.search(new RegExp('^(' + class_name + ')$|^(' + class_name + '\\s.*)$|^(.*\\s' + class_name + ')$|^(.*\\s' + class_name + '\\s.*)$')) === -1) {
			return false;
		}
		else {
			return true;
		}
	}
	
	function removeCSSClass(element, class_name) {
		element.className = element.className.replace(new RegExp('^(' + class_name + ')$|^(' + class_name + '\\s.*)$|^(.*\\s' + class_name + ')$|^(.*\\s' + class_name + '\\s.*)$'), replaceHiddenClassName);
	}
	
	function hideElement(element) {
		addCSSClass(element, 'hidden');
	}
	
	function hideElements(element_array) {
		var i;
		for (i=0; i<element_array.length; i++) {
			hideElement(element_array[i]);
		}
	}
	
	function unhideElement(element) {
		removeCSSClass(element, 'hidden');
	}
	
	function unhideElements(element_array) {
		var i;
		for (i=0; i<element_array.length; i++) {
			unhideElement(element_array[i]);
		}
	}
	
	function replaceHiddenClassName(match, p1, p2, p3, p4, offset, string) {
		if (typeof p1 !== 'undefined') {
			return '';
		}
		else if (typeof p2 !== 'undefined') {
			return string.replace(/^hidden\s/, '');
		}
		else if (typeof p3 !== 'undefined') {
			return string.replace(/\shidden$/, '');
		}
		else if (typeof p4 !== 'undefined') {
			return string.replace(/\shidden\s/, ' ');
		}
		return string;
	}
	
	function limitArray(arr, limit) {
		if (limit === 0) {
			return arr;
		}
		else {
			return arr.slice(0, limit);
		}
	}
	
	function setCache(data, type) {
		cachedData = data;
		currentCacheType = type;
	}
	
	window.self.onload = init;
}());
