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
	var lblFilterStatus;
	var filterBoxStation;
	var filterBoxSong;
	var filterBoxArtist;
	var filterBoxDate;
	var filterBoxSortBy;
	var filterBoxSortOrder;
	var filterBoxLimit;
	var selFilterStation;
	var txtFilterSong;
	var txtFilterArtist;
	var txtFilterDay;
	var txtFilterMonth;
	var txtFilterYear;
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
	var filterStatusTimeoutHandle;
	
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
		if (typeof element.innerText === 'string') {
			element.innerText = text;
		}
		// Firefox < 45
		else {
			element.textContent = text;
		}
	}
	
	function getInnerText(element) {
		if (typeof element.innerText === 'string') {
			return element.innerText;
		}
		// Firefox < 45
		else {
			return element.textContent;
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
		lblFilterStatus = getElement('lbl-filter-status');
		filterBoxStation = getElement('filter-box-station');
		filterBoxSong = getElement('filter-box-song');
		filterBoxArtist = getElement('filter-box-artist');
		filterBoxSortBy = getElement('filter-box-sort-by');
		filterBoxSortOrder = getElement('filter-box-sort-order');
		filterBoxLimit = getElement('filter-box-limit');
		filterBoxDate = getElement('filter-box-date');
		selFilterStation = getElement('sel-filter-station');
		txtFilterSong = getElement('txt-filter-song');
		txtFilterArtist = getElement('txt-filter-artist');
		txtFilterDay = getElement('txt-filter-day');
		txtFilterMonth = getElement('txt-filter-month');
		txtFilterYear = getElement('txt-filter-year');
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
			hideElements([filterBoxSong, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder, filterBoxDate]);
			unhideElements([filterBoxStation, filterBoxLimit]);
		}
		else if (optSongs.checked) {
			selectOption(optSongs, 'data_choice', onOptSongsClick);
			hideElements([filterBoxDate]);
			unhideElements([filterBoxStation, filterBoxSong, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder, filterBoxLimit]);
			
			clearChildren(selFilterSortBy);
			selFilterSortBy.appendChild(generateElementWithText('option', 'Play Count', {value: 'playcount'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Song', {value: 'song'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Artist', {value: 'artist'}));
		}
		else if (optArtists.checked) {
			selectOption(optArtists, 'data_choice', onOptArtistsClick);
			hideElements([filterBoxSong, filterBoxDate]);
			unhideElements([filterBoxStation, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder, filterBoxLimit]);
			
			clearChildren(selFilterSortBy);
			selFilterSortBy.appendChild(generateElementWithText('option', 'Play Count', {value: 'playcount'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Artist', {value: 'artist'}));
		}
		else if (optPlaylists.checked) {
			selectOption(optPlaylists, 'data_choice', onOptPlaylistsClick);
			unhideElements([filterBoxStation, filterBoxSong, filterBoxArtist, filterBoxSortBy, filterBoxSortOrder, filterBoxLimit, filterBoxDate]);
			
			clearChildren(selFilterSortBy);
			selFilterSortBy.appendChild(generateElementWithText('option', 'Date', {value: 'date'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Song', {value: 'song'}));
			selFilterSortBy.appendChild(generateElementWithText('option', 'Artist', {value: 'artist'}));
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
			// If testing locally on Chrome with the --allow-file-access-from-files flag, check for status code 0
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
				console.log('Data failed to download. Status: ', http_req.status);
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
		removeCurrentDisplayData();
	}
	
	function onOptSongsClick(e) {
		updateFilterUI();
		removeCurrentDisplayData();
	}
	
	function onOptArtistsClick(e) {
		updateFilterUI();
		removeCurrentDisplayData();
	}
	
	function onOptPlaylistsClick(e) {
		updateFilterUI();
		removeCurrentDisplayData();
	}
	
	function onSelFilterLimitChange(e) {
		txtFilterLimit.value = selFilterLimit.value;
	}
	
	function onBtnFilterSubmitClick(e) {		
		var song_name_search_terms;
		var artist_name_search_terms;
		var sort_by;
		var sort_order;
		var use_cache;
		
		clearTimeout(filterStatusTimeoutHandle);
		setInnerText(lblFilterStatus, 'Processing...');
		
		// Put in a small delay to let the UI update before locking the thread up
		setTimeout(function() {
			var station_id = parseInt(selFilterStation.value, 10);
			if (isNaN(station_id)) {
				station_id = 'any';
			}

			var limit = parseInt(txtFilterLimit.value, 10);
			if (isNaN(limit)) {
				limit = 25;
				updateFilterUI();
			}

			removeCurrentDisplayData();

			if (optStatistics.checked) {
				 use_cache = (currentCacheType === CacheType.STATISTICS);
				showStatistics(station_id, limit, use_cache);
			}
			else if (optSongs.checked) {
				use_cache = (currentCacheType === CacheType.SONGS);
				song_name_search_terms = splitSearchTerms(txtFilterSong.value.trim());
				artist_name_search_terms = splitSearchTerms(txtFilterArtist.value.trim());
				sort_by = selFilterSortBy.value;
				sort_order = selFilterSortOrder.value;

				showSongs(station_id, song_name_search_terms, artist_name_search_terms, sort_by, sort_order, limit, use_cache);
			}
			else if (optArtists.checked) {
				use_cache = (currentCacheType === CacheType.ARTISTS);
				artist_name_search_terms = splitSearchTerms(txtFilterArtist.value.trim());
				sort_by = selFilterSortBy.value;
				sort_order = selFilterSortOrder.value;

				showArtists(station_id, artist_name_search_terms, sort_by, sort_order, limit, use_cache);
			}
			else if (optPlaylists.checked) {
				use_cache = (currentCacheType === CacheType.PLAYLISTS);
				song_name_search_terms = splitSearchTerms(txtFilterSong.value.trim());
				artist_name_search_terms = splitSearchTerms(txtFilterArtist.value.trim());
				sort_by = selFilterSortBy.value;
				sort_order = selFilterSortOrder.value;

				var day = parseInt(txtFilterDay.value.substr(0, 2));
				var month = parseInt(txtFilterMonth.value.substr(0, 2));
				var year = parseInt(txtFilterYear.value.substr(0, 4), 10);
				if (!isNaN(day)) {
					day = (day < 10) ? '0' + day : day.toString();
				}
				if (!isNaN(month)) {
					month = (month < 10) ? '0' + month : month.toString();
				}

				showPlaylists(station_id, song_name_search_terms, artist_name_search_terms, {day: day, month: month, year: year}, sort_by, sort_order, limit, use_cache);
			}
				setInnerText(lblFilterStatus, 'Search complete.');
				filterStatusTimeoutHandle = setTimeout(function() {
					setInnerText(lblFilterStatus, '');
				}, 7000);
		}, 200);
	}
	
	function onBtnFilterResetClick(e) {
		selFilterStation.value = 'any';
		txtFilterSong.value = '';
		txtFilterArtist.value = '';
		txtFilterDay.value = '';
		txtFilterMonth.value = '';
		txtFilterYear.value = '';
		selFilterSortBy.selectedIndex = 0;
		selFilterSortOrder.value = 'desc';
		txtFilterLimit.value = '25';
		selFilterLimit.value = '25';
	}
	
	function showStatistics(station_id, limit, use_cache) {
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
	
	function showArtists(param_station_id, artist_search_terms, sort_by, sort_order, limit, use_cache) {
		songDataBox.appendChild(generateElementWithText('h2', 'All Artists'));
		var artists;
		if (use_cache) {
			artists = cachedData;
		}
		else {
			artists = radioQuery.getArtistData();
			// Convert the data to an array so we can sort it
			var artists_arr = [];
			var id;
			for (id in artists) {
				if (artists.hasOwnProperty(id)) {
					artists_arr.push([artists[id][0], artists[id][1]]);
				}
			}
			artists = artists_arr;
			artists_arr = null;
			setCache(artists, CacheType.ARTISTS);
		}
		
		if (sort_by === 'playcount') {
			if (sort_order === 'asc') {
				artists.sort(artistPlayCountSortAsc);
			}
			else {
				artists.sort(artistPlayCountSortDesc);
			}
		}
		else if (sort_by === 'artist') {
			if (sort_order === 'asc') {
				artists.sort(artistNameSortAsc);
			}
			else {
				artists.sort(artistNameSortDesc);
			}
		}
		
		var stations = radioQuery.getAllStations();
		var station_id, record;
		var artist_index = 1;
		var row;
		var pending_rows = [];					// Generated rows that need to be appended at the end of the inner loop
		var first_row;
		var i;
		var table = generateTable(['Artist Name', 'Station', 'Play Count'], []);		// Generate an empty table because we need to do row spanning with certain rows
		var table_ref = table.getElementsByTagName('table')[0];
		table_ref.className = 'spanned-list';
		for (i=0; i<artists.length; i++) {
			record = artists[i];
			
			// -- Filter stuff --				
			if ( (param_station_id !== 'any' && record[1][param_station_id] <= 0) ||		// Only show the song if it has ever been played on the filter station
				 !isInSearch(record[0], artist_search_terms) ) 		// Song and artist search terms
			{
				continue;
			}
			
			if (limit > 0 && artist_index > limit) {
				break;
			}
			
			first_row = true;
			for (station_id in record[1]) {
				if (record[1].hasOwnProperty(station_id) && station_id !== 'total') {
					if (record[1][station_id] <= 0) {
						continue;
					}
					// First row for this artist
					if (first_row) {
						row = generateTableRow([artist_index, record[0], stations[station_id][0], record[1][station_id]]);
						row.children[1].setAttribute('style', 'max-width: 150px');
						row.className = 'row-start';
						artist_index += 1;
						first_row = false;
					}
					else {
						row = document.createElement('tr');
						row.appendChild(generateElementWithText('td', null, {colspan: 2}));
						row.appendChild(generateElementWithText('td', stations[station_id][0], {className: 'border-me'}));
						row.appendChild(generateElementWithText('td', record[1][station_id], {className: 'border-me', style: 'text-align: center'}));
					}
					pending_rows.push(row);
				}
			}
			
			// Total play count row
			row = document.createElement('tr');
			row.appendChild(generateElementWithText('td', null, {colspan: 2}));
			row.appendChild(generateElementWithText('td', null, {className: 'border-me', style: 'border-right: 0'}));
			row.appendChild(generateElementWithText('td', 'Total: ' + record[1].total, {style: 'font-weight: 700'}));
			pending_rows.push(row);
		}
		
		// Dump all of the pending rows to the table
		for (i=0; i<pending_rows.length; i++) {
			table_ref.tBodies[0].appendChild(pending_rows[i]);
		}
		songDataBox.appendChild(generateElementWithText('h3', (artist_index - 1) + ' Results'));
		songDataBox.appendChild(table);
		songDataBox.appendChild(generateLink('#data-box', 'Go to Top', false));
	}
	
	function showSongs(param_station_id, song_search_terms, artist_search_terms, sort_by, sort_order, limit, use_cache) {
		var songs;
		if (use_cache) {
			songs = cachedData;
		}
		else {
			songs = radioQuery.getSongData();
			// Turn songs into an array for sorting
			var songs_arr = [];
			var id;
			for (id in songs) {
				if (songs.hasOwnProperty(id)) {
					songs_arr.push([songs[id][0], songs[id][1], songs[id][2]]);
				}
			}
			songs = songs_arr;
			songs_arr = null;
			setCache(songs, CacheType.SONGS);
		}
		
		if (sort_by === 'playcount') {
			if (sort_order === 'asc') {
				songs.sort(songPlayCountSortAsc);
			}
			else {
				songs.sort(songPlayCountSortDesc);
			}
		}
		else if (sort_by === 'song') {
			if (sort_order === 'asc') {
				songs.sort(songNameSortAsc);
			}
			else {
				songs.sort(songNameSortDesc);
			}
		}
		else if (sort_by === 'artist') {
			if (sort_order === 'asc') {
				songs.sort(songArtistNameSortAsc);
			}
			else {
				songs.sort(songArtistNameSortDesc);
			}
		}
				
		var stations = radioQuery.getAllStations();
		songDataBox.appendChild(generateElementWithText('h2', 'All Songs'));
		var table = generateTable(['Song Name', 'Artist Name', 'Station', 'Play Count'], []);
		var table_ref = table.getElementsByTagName('table')[0];
		table_ref.className = 'spanned-list';
		var song_id, station_id;
		var row, record, row_group;
		var pending_rows = [];
		var first_row;
		var song_index = 1;
		var i;
		for (i=0; i<songs.length; i++) {
			record = songs[i];
			
			// -- Filter stuff --	
			if ( (param_station_id !== 'any' && record[2][param_station_id] <= 0) ||		// Only show the song if it has ever been played on the filter station
				 (!isInSearch(record[0], song_search_terms) || !isInSearch(record[1], artist_search_terms)) ) 		// Song and artist search terms
			{
				continue;
			}
			
			if (limit > 0 && song_index > limit) {
				break;
			}
				
			first_row = true;
			for (station_id in record[2]) {
				if (record[2].hasOwnProperty(station_id) && station_id !== 'total') {
					if (record[2][station_id] <= 0) {
						continue;
					}

					if (first_row) {
						row = generateTableRow([song_index, record[0], record[1], stations[station_id][0], record[2][station_id]]);
						row.children[1].setAttribute('style', 'max-width: 200px');
						row.children[2].setAttribute('style', 'max-width: 200px');
						row.className = 'row-start';
						first_row = false;
						song_index += 1;
					}
					else {
						row = document.createElement('tr');
						row.appendChild(generateElementWithText('td', null, {colspan: 3}));
						row.appendChild(generateElementWithText('td', stations[station_id][0], {className: 'border-me'}));
						row.appendChild(generateElementWithText('td', record[2][station_id], {className: 'border-me'}));
					}
					pending_rows.push(row);
				}
			}
			// Total play count row
			row = document.createElement('tr');
			row.appendChild(generateElementWithText('td', null, {colspan: 3}));
			row.appendChild(generateElementWithText('td', null, {className: 'border-me', style: 'border-right: 0'}));
			row.appendChild(generateElementWithText('td', 'Total: ' + record[2].total, {style: 'font-weight: 700'}));
			pending_rows.push(row);
		}
		// Dump all of the pending rows to the table
		var i;
		for (i=0; i<pending_rows.length; i++) {
			table_ref.tBodies[0].appendChild(pending_rows[i]);
		}
		songDataBox.appendChild(generateElementWithText('h3', (song_index - 1) + ' Results'));
		songDataBox.appendChild(table);
		songDataBox.appendChild(generateLink('#data-box', 'Go to Top', false));
	}
	
	function showPlaylists(param_station_id, song_search_terms, artist_search_terms, date, sort_by, sort_order, limit, use_cache) {
		var playlists;
		if (use_cache) {
			playlists = cachedData;
		}
		else {
			playlists = radioQuery.getPlaylistsData();
			setCache(playlists, CacheType.PLAYLISTS);
		}
				
		var stations = radioQuery.getAllStations();
		var station_id;
		var data, playlist;
		var table;
		var i;
		songDataBox.appendChild(generateElementWithText('h2', 'Playlists'));
		for (station_id in playlists) {
			if (playlists.hasOwnProperty(station_id)) {
				playlist = playlists[station_id];
				// -- Filter stuff --				
				// Only show if the list if it isn't filtered
				if (param_station_id !== 'any' && param_station_id.toString() !== station_id) {
					continue;
				}
				
				// Filter by search terms
				data = [];
				if (song_search_terms.length === 0 && artist_search_terms.length === 0 && isNaN(date.day) && isNaN(date.month) && isNaN(date.year)) {
					data = playlist;
				}
				else {
					for (i=0; i<playlist.length; i++) {
						if (!isInSearch(playlist[i][0], song_search_terms) || !isInSearch(playlist[i][1], artist_search_terms) || !matchesDate(playlist[i][3], date)) {
							continue;
						}
						data.push(playlist[i]);
					}
				}
				
				if (sort_by === 'song') {
					if (sort_order === 'asc') {
						data.sort(songNameSortAsc);
					}
					else {
						data.sort(songNameSortDesc);
					}
				}
				else if (sort_by === 'artist') {
					if (sort_order === 'asc') {
						data.sort(songArtistNameSortAsc);
					}
					else {
						data.sort(songArtistNameSortDesc);
					}
				}
				else if (sort_by === 'date') {
					if (sort_order === 'asc') {
						data.sort(playlistDateSortAsc);
					}
					else {
						data.sort(playlistDateSortDesc);
					}
				}
				
				if (limit > 0) {
					data = data.slice(0, limit);
				}
				
				songDataBox.appendChild(generateStationHeader(stations[station_id][0], stations[station_id][1], 'Playlist'));
				table = generateTable(['Song Name', 'Artist Name', 'Original Time', 'Formatted Time'], data, station_id + '-playlist', true);
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
	
	// Really basic search function
	function isInSearch(str, terms) {
		if (terms.length === 0) {
			return true;
		}
		
		var i;
		var lc_str = str.toLowerCase();			// Easier comparison
		var term;
		for (i=0; i<terms.length; i++) {
			term = terms[i].toLowerCase().trim();
			if (lc_str.indexOf(term) > -1) {
				return true;
			}
		}
		return false;
	}
	
	// Splits search terms into an array
	// Terms surrounded with quotes are treated as one unit
	function splitSearchTerms(search_str) {
		var terms = [];
		var inside_quotes = false;
		// Traverse through each character
		var last_index = search_str.length - 1;
		var start_index = 0;			// Index of where the parser began a new term
		var i, c, term;
		for (i=0; i<search_str.length; i++) {
			c = search_str[i];
			if (c === '"') {
				if (inside_quotes) {
					term = search_str.substring(start_index, i);
				}
				else {
					term = search_str.substring(start_index, i).trim();
				}
				
				if (term !== '') {
					terms.push(term);
				}
				start_index = i + 1;
				inside_quotes = !inside_quotes;
			}
			else if (c === ' ' && !inside_quotes) {
				term = search_str.substring(start_index, i).trim();
				if (term !== '') {
					terms.push(term);
				}
				start_index = i + 1;
			}
			// At the end of the string
			else if (i == last_index) {
				// If we're inside quotes and the last character isn't a closing quote, then go back to parse the rest as unquoted
				if (inside_quotes) {
					inside_quotes = false;
					i = start_index - 1;
					continue;
				}
				
				term = search_str.substring(start_index, i+1).trim();
				if (term !== '') {
					terms.push(term);
				}
			}
		}
		return terms;
	}
	
	function setCache(data, type) {
		cachedData = data;
		currentCacheType = type;
	}
	
	// Parse the formatted date string and create a Javascript Date object out of it. Don't need to worry about timezones since we're dealing with each station separately
	function getUnixEpoch(date_str) {
		var parsed = date_str.trim().split('/');
		var day = parseInt(parsed[0], 10);
		var month = parseInt(parsed[1], 10) - 1;			// Month is zero-based for some stupid reason
		parsed = parsed[2].split(' ');
		var year = parseInt(parsed[0], 10);
		var meridiem = parsed[2];
		
		parsed = parsed[1].split(':');
		var hours = parseInt(parsed[0], 10);
		var minutes = parseInt(parsed[1], 10);
		var seconds = parseInt(parsed[2], 10);
		
		// Convert 12-hour to 24-hour
		if (hours === 12) {
			if (meridiem === 'AM') {
				hours = 0;
			}
		}
		else if (meridiem === 'PM') {
			hours += 12;
		}
		
		return (Date.UTC(year, month, day, hours, minutes, seconds) / 1000);
	}
	
	function matchesDate(date_str, date) {
		if (isNaN(date.day)) {
			date.day = '[0-9]{1,2}';
		}
		if (isNaN(date.month)) {
			date.month = '[0-9]{1,2}';
		}
		if (isNaN(date.year)) {
			date.year = '[0-9]{4}';
		}
		return date_str.search(new RegExp('^' + date.day + '/' + date.month + '/' + date.year + '')) === 0 ? true : false;
	}
	
	// -- Sort Functions --
	function artistPlayCountSortAsc(a, b) {
		var count1 = a[1].total;
		var count2 = b[1].total;
		if (count1 < count2) {
			return -1;
		}
		else if (count1 > count2) {
			return 1;
		}
		return artistNameSortAsc(a, b);
	}
	
	function artistPlayCountSortDesc(a, b) {
		var count1 = a[1].total;
		var count2 = b[1].total;
		if (count1 > count2) {
			return -1;
		}
		else if (count1 < count2) {
			return 1;
		}
		return artistNameSortDesc(a, b);
	}
	
	function artistNameSortAsc(a, b) {
		var name1 = a[0].toLowerCase();
		var name2 = b[0].toLowerCase();
		if (name1 < name2) {
			return -1;
		}
		else if (name1 > name2) {
			return 1;
		}
		return 0;	
	} 
	
	function artistNameSortDesc(a, b) {
		var name1 = a[0].toLowerCase();
		var name2 = b[0].toLowerCase();
		if (name1 > name2) {
			return -1;
		}
		else if (name1 < name2) {
			return 1;
		}
		return 0;	
	}
	
	function songPlayCountSortAsc(a, b) {
		var count1 = a[2].total;
		var count2 = b[2].total;
		if (count1 < count2) {
			return -1;
		}
		else if (count1 > count2) {
			return 1;
		}
		
		return songNameSortAsc(a, b);
	}
	
	function songPlayCountSortDesc(a, b) {
		var count1 = a[2].total;
		var count2 = b[2].total;
		if (count1 > count2) {
			return -1;
		}
		else if (count1 < count2) {
			return 1;
		}
		
		return songNameSortAsc(a, b);
	}
	
	function songNameSortAsc(a, b) {
		var name1 = a[0].toLowerCase();
		var name2 = b[0].toLowerCase();
		if (name1 < name2) {
			return -1;
		}
		else if (name1 > name2) {
			return 1;
		}
		
		return songArtistNameSortAsc(a, b);		// Equal
	}
	
	function songNameSortDesc(a, b) {
		var name1 = a[0].toLowerCase();
		var name2 = b[0].toLowerCase();
		if (name1 > name2) {
			return -1;
		}
		else if (name1 < name2) {
			return 1;
		}
		
		return songArtistNameSortDesc(a, b);		// Equal
	}
	
	function songArtistNameSortAsc(a, b) {
		var name1 = a[1].toLowerCase();
		var name2 = b[1].toLowerCase();
		if (name1 < name2) {
			return -1;
		}
		else if (name1 > name2) {
			return 1;
		}
		
		return 0;
	}
	
	function songArtistNameSortDesc(a, b) {
		var name1 = a[1].toLowerCase();
		var name2 = b[1].toLowerCase();
		if (name1 > name2) {
			return -1;
		}
		else if (name1 < name2) {
			return 1;
		}
		
		return 0;
	}
	
	function playlistDateSortAsc(a, b) {
		var time1 = getUnixEpoch(a[3]);
		var time2 = getUnixEpoch(b[3]);
		
		if (time1 < time2) {
			return -1;
		}
		else if (time1 > time2) {
			return 1;
		}
		return 0;
	}
	
	function playlistDateSortDesc(a, b) {
		var time1 = getUnixEpoch(a[3]);
		var time2 = getUnixEpoch(b[3]);
		
		if (time1 > time2) {
			return -1;
		}
		else if (time1 < time2) {
			return 1;
		}
		return 0;
	}
	
	window.self.onload = init;
}());
