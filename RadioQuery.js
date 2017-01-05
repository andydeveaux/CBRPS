/*
	Cape Breton Radio Playlist Statistics - Radio Query aka "Why aren't you doing that server-side?!" (GitHub Pages only serves static content)
	Author: Andy Deveaux
*/

(function() {
	'use strict';
	
	var DEBUG = false;
	function debug(messages) {
		if (DEBUG) {
			var i;
			for (i=0; i<messages.length; i++) {
				console.log(messages[i]);
			}
		}
	}
	
	// -- Constants --
	// Table array indices
	var STATIONS_COL_NAME = 0;
	var STATIONS_COL_PLAYLIST_URL = 1;
		
	var SONGS_COL_NAME = 0;
	var SONGS_COL_ARTIST_ID = 1;
	
	var PLAYLISTS_COL_SONG_ID = 0;
	var PLAYLISTS_COL_ORIGINAL_TIME = 1;
	var PLAYLISTS_COL_FORMATTED_TIME = 2;

	// -- Public Methods --
	var getStations = function() {
		return this.radioData.stations;
	};
	
	var getSongData = function() {
		var songs = fetchAllSongs(this);
		// Get how many times it was played by each station, plus the total
		var song_id;
		var playlists_table = this.radioData.playlists;
		var station_id, playlist, i;
		for (station_id in playlists_table) {
			if (playlists_table.hasOwnProperty(station_id)) {
				playlist = playlists_table[station_id];
				for (i=0; i<playlist.length; i++) {
					song_id = playlist[i][PLAYLISTS_COL_SONG_ID];
					songs[song_id][2][station_id] += 1;
					songs[song_id][2].total += 1;
				}
			}
		}
		
		debug(['Songs:', songs]);
		return songs;
	};
	
	var getArtistData = function() {
		var artists = fetchAllArtists(this);
		var playlists_table = this.radioData.playlists;
		var songs_table = this.radioData.songs;
		var station_id, artist_id, i;
		for (station_id in playlists_table) {
			if (playlists_table.hasOwnProperty(station_id)) {
				for (i=0; i<playlists_table[station_id].length; i++) {
					artist_id = songs_table[playlists_table[station_id][i][PLAYLISTS_COL_SONG_ID]][SONGS_COL_ARTIST_ID];
					artists[artist_id][1][station_id] += 1;
				}
			}
		}
		debug(['Artists:', artists]);
		return artists;
	};
	
	var getPlaylistsData = function() {
		var playlists = fetchAllPlaylists(this);
		debug(['Playlists:', playlists]);
		return playlists;
	};
	
	var getStatisticsData = function() {
		var CHRISTMAS_KEYWORDS = [
			'christmas', 'snow', 'bells', 'jingle', 'santa', 'claus', 'winter', 'reindeer', 'rudolph', 'angel sings', 'noel',
			'sleigh', 'present', 'mistletoe', 'tinsel', 'tree', 'stocking', 'xmas', 'silver', 'saint', 'silent night',
			'cold outside', 'frosty', 'drummer boy', 'mary', 'merry', 'lord', 'sugar plum', 'chestnuts', 'feliz navidad',
			'december', 'holiday', 'wish', 'fairy', 'hallelujah'
		];

		var stations_table = this.radioData.stations;
		var songs_table = this.radioData.songs;
		var stats = {
			stationsMostPlayedSongs: {}, stationsLeastPlayedSongs: {}, 
			stationsMostPlayedArtists: {}, stationsLeastPlayedArtists: {},
			mostPlayedSongs: {}, leastPlayedSongs: {},
			stationsMostPlayedChristmasSongs: {}, stationsLeastPlayedChristmasSongs: {},
			mostPlayedChristmasSongs: {}, leastPlayedChristmasSongs: {}
		};
		// Put songs under each station ID
		var songs_by_station = {};
		var christmas_songs_by_station = {};
		var artists_by_station = {};
		var all_songs = {};
		var all_artists = {};
		var all_christmas_songs = {};
		var station_id;
		for (station_id in stations_table) {
			if (stations_table.hasOwnProperty(station_id)) {
				songs_by_station[station_id] = [];
				christmas_songs_by_station[station_id] = [];
				artists_by_station[station_id] = {};				
				stats.stationsMostPlayedSongs[station_id] = [];
				stats.stationsLeastPlayedSongs[station_id] = [];
				stats.stationsMostPlayedArtists[station_id] = [];
				stats.stationsLeastPlayedArtists[station_id] = [];
				stats.stationsMostPlayedChristmasSongs[station_id] = [];
				stats.stationsLeastPlayedChristmasSongs[station_id] = [];
			}
		}

		var songs = this.getSongData();
		var song, song_id, song_name, artist_id, is_christmas_song;
		var i, play_count;
		for (song_id in songs) {
			if (songs.hasOwnProperty(song_id)) {
				song = songs[song_id];
				if (typeof all_songs[song_id] === 'undefined') {
					all_songs[song_id] = [song[0], song[1], 0];							// [Song Name, Artist Name, Play Count]	
				}
				
				artist_id = songs_table[song_id][SONGS_COL_ARTIST_ID];
				if (typeof all_artists[artist_id] === 'undefined') {
					all_artists[artist_id] = [song[1], 0];								// [Artist Name, Play Count]
				}
				
				is_christmas_song = false;
				for (i=0; i<CHRISTMAS_KEYWORDS.length; i++) {
					song_name = song[0].toLowerCase();
					if (song_name.indexOf(CHRISTMAS_KEYWORDS[i]) > -1) {
						is_christmas_song = true;
						if (typeof all_christmas_songs[song_id] === 'undefined') {
							all_christmas_songs[song_id] = [song[0], song[1], 0];		// [Song Name, Artist Name, Play Count]
						}
						break;
					}
				}
				
				for (station_id in song[2]) {
					if (song[2].hasOwnProperty(station_id)) {
						if (song[2][station_id] <= 0) {
							continue;
						}
						song = [song[SONGS_COL_NAME], song[1], song[2][station_id]];	// [Song Name, Artist Name, Station Play Count]
						songs_by_station[station_id].push(song);
						
						// Add to play counts
						play_count = song[2];
						if (typeof artists_by_station[station_id][artist_id] === 'undefined') {
							artists_by_station[station_id][artist_id] = [song[1], play_count];		// [Artist Name, Station Play Count]
						}
						else {
							artists_by_station[station_id][artist_id][1] += play_count;
						}
						all_songs[song_id][2] += play_count;
						all_artists[artist_id][1] += play_count;
						
												
						// Christmas songs per station
						if (is_christmas_song) {
							christmas_songs_by_station[station_id].push(song);
							all_christmas_songs[song_id][2] += play_count;
						}
					}
				}
			}
		}

		// Sort from most to least played
		// Can't sort objects, so make their array counterparts
		var artists_by_station_array = {};
		for (station_id in artists_by_station) {
			if (artists_by_station.hasOwnProperty(station_id)) {
				artists_by_station_array[station_id] = [];
				for (artist_id in artists_by_station[station_id]) {
					if (artists_by_station[station_id].hasOwnProperty(artist_id)) {
						artists_by_station_array[station_id].push([artists_by_station[station_id][artist_id][0], artists_by_station[station_id][artist_id][1]]);
					}
				}
			}
		}
		artists_by_station = null;
		
		var all_songs_array = [];
		for (song_id in all_songs) {
			if (all_songs.hasOwnProperty(song_id)) {
				song = all_songs[song_id];
				all_songs_array.push([song[0], song[1], song[2]]);
			}
		}
		all_songs = null;
		
		var all_christmas_songs_array = [];
		for (song_id in all_christmas_songs) {
			if (all_christmas_songs.hasOwnProperty(song_id)) {
				song = all_christmas_songs[song_id];
				all_christmas_songs_array.push([song[0], song[1], song[2]]);
			}
		}
		all_christmas_songs = null;
		
		var all_artists_array = [];
		var artist;
		for (artist_id in all_artists) {
			if (all_artists.hasOwnProperty(artist_id)) {
				artist = all_artists[artist_id];
				all_artists_array.push([artist[0], artist[1]]);
			}
		}
		all_artists = null;
		
		all_songs_array.sort(sortSongsByPlayCount);
		all_artists_array.sort(sortArtistsByPlayCount);
		all_christmas_songs_array.sort(sortSongsByPlayCount);

		stats.mostPlayedSongs = all_songs_array.slice();
		stats.leastPlayedSongs = all_songs_array;		// No need to slice, we already have two different instances thanks to the previous slice

		stats.mostPlayedArtists = all_artists_array.slice();
		stats.leastPlayedArtists = all_artists_array;

		stats.mostPlayedChristmasSongs = all_christmas_songs_array.slice();
		stats.leastPlayedChristmasSongs = all_christmas_songs_array;
		
		// "Most" stats are just in descending order
		stats.mostPlayedSongs.reverse();
		stats.mostPlayedArtists.reverse();
		stats.mostPlayedChristmasSongs.reverse();

		for (station_id in songs_by_station) {
			if (songs_by_station.hasOwnProperty(station_id)) {
				songs_by_station[station_id].sort(sortSongsByPlayCount);
				christmas_songs_by_station[station_id].sort(sortSongsByPlayCount);
				artists_by_station_array[station_id].sort(sortArtistsByPlayCount);
				
				stats.stationsMostPlayedSongs[station_id] = songs_by_station[station_id].slice();
				stats.stationsLeastPlayedSongs[station_id] = songs_by_station[station_id];
					
				stats.stationsMostPlayedArtists[station_id] = artists_by_station_array[station_id].slice();
				stats.stationsLeastPlayedArtists[station_id] = artists_by_station_array[station_id];
					
				stats.stationsMostPlayedChristmasSongs[station_id] = christmas_songs_by_station[station_id].slice();
				stats.stationsLeastPlayedChristmasSongs[station_id] = christmas_songs_by_station[station_id];

				stats.stationsMostPlayedSongs[station_id].reverse();
				stats.stationsMostPlayedArtists[station_id].reverse();
				stats.stationsMostPlayedChristmasSongs[station_id].reverse();
			}
		}
		debug(["Stations' most played songs:", stats.stationsMostPlayedSongs, "Stations' least played songs:", stats.stationsLeastPlayedSongs]);
		debug(["Most played songs:", stats.mostPlayedSongs, "Least played songs:", stats.leastPlayedSongs]);
		debug(["Stations' most played artists:", stats.stationsMostPlayedArtists, "Stations' least played artists:", stats.stationsLeastPlayedArtists]);
		debug(["Most played artists:", stats.mostPlayedArtists, "Least played artists:", stats.leastPlayedArtists]);
		debug(["Stations' most played Christmas songs:", stats.stationsMostPlayedChristmasSongs, "Stations' least played Christmas songs:", stats.stationsLeastPlayedChristmasSongs]);		
		debug(["Most played Christmas songs:", stats.mostPlayedChristmasSongs, "Least played Christmas songs:", stats.leastPlayedChristmasSongs]);
		
		return stats;
	};
	
	var getStation = function(station_id) {
		return this.radioData.stations[station_id];
	};
	
	var getAllStations = function() {
		return this.radioData.stations;
	};
	
	// -- Private --
	// Fetches all song data with artist names joined
	function fetchAllSongs(rq) {
		var rows = {};
		var songs = rq.radioData.songs;
		var artists = rq.radioData.artists;
		var stations = rq.radioData.stations;
		var id;
		var song_station_count = {total: 0};
		for (id in stations) {
			if (stations.hasOwnProperty(id)) {
				song_station_count[id] = 0;
			}
		}
		
		for (id in songs) {
			if (songs.hasOwnProperty(id)) {
				rows[id] = [songs[id][SONGS_COL_NAME], artists[songs[id][SONGS_COL_ARTIST_ID]], JSON.parse(JSON.stringify(song_station_count))];	
			}
		}
		return rows;
	}
	
	function fetchAllArtists(rq) {
		var rows = {};
		var artists = rq.radioData.artists;
		var stations = rq.radioData.stations;
		var id;
		var artist_station_count = {};
		for (id in stations) {
			if (stations.hasOwnProperty(id)) {
				artist_station_count[id] = 0;
			}
			
		}
		for (id in artists) {
			if (artists.hasOwnProperty(id)) {
				rows[id] = [artists[id], JSON.parse(JSON.stringify(artist_station_count))];
			}
		}		
		return rows;
	}
	
	function fetchSinglePlaylist(rq, station_id) {
		var rows = [];
		var playlist = rq.radioData.playlists[station_id];
		var songs_table = rq.radioData.songs;
		var artists_table = rq.radioData.artists;
		var i, song;
		for (i=0; i<playlist.length; i++) {
			song = songs_table[playlist[i][PLAYLISTS_COL_SONG_ID]];
			rows.push([
				song[SONGS_COL_NAME],
				artists_table[song[SONGS_COL_ARTIST_ID]],
				playlist[i][PLAYLISTS_COL_ORIGINAL_TIME],
				playlist[i][PLAYLISTS_COL_FORMATTED_TIME]
			]);
		}
		return rows;
	}
	
	function fetchAllPlaylists(rq) {
		var rows = {};
		var playlists_table = rq.radioData.playlists;
		var station_id;
		for (station_id in playlists_table) {
			if (playlists_table.hasOwnProperty(station_id)) {
				rows[station_id] = fetchSinglePlaylist(rq, station_id);
			}
		}
		return rows;
	}
	
	// Sorting functions
	function sortSongsByPlayCount(a, b) {
		var count1 = a[2];
		var count2 = b[2];
		if (count1 < count2) {
			return -1;
		}
		else if (count1 > count2) {
			return 1;
		}
		
		// Equal
		return sortSongsByName(a, b);
	}
	
	function sortSongsByName(a, b) {
		var name1 = a[0].toLowerCase();
		var name2 = b[0].toLowerCase();
		if (name1 < name2) {
			return -1;
		}
		else if (name1 > name2) {
			return 1;
		}
		
		return 0;		// Equal
	}
	
	function sortArtistsByPlayCount(a, b) {
		var count1 = a[1];
		var count2 = b[1];
		
		if (count1 < count2) {
			return -1;
		}
		else if (count1 > count2) {
			return 1;
		}
		
		// Equal
		return sortArtistsByName(a, b);
	}
	
	function sortArtistsByName(a, b) {
		var name1 = a[0].toLowerCase();
		var name2 = b[0].toLowerCase();
		
		if (name1 < name2) {
			return -1;
		}
		else if (name1 > name2) {
			return 1;
		}
		
		return 0;		// Equal
	}

	// -- Interface --
	// Constructor
	var rq = function(radio_data) {
		var instance = {};
		instance.radioData = radio_data;
		instance.songIds = [];
		instance.artistIds = [];
		instance.getStatisticsData = getStatisticsData;
		instance.getSongData = getSongData;
		instance.getArtistData = getArtistData;
		instance.getPlaylistsData = getPlaylistsData;
		instance.getStation = getStation;
		instance.getAllStations = getAllStations;
		return instance;
	};
	
	window.RadioQuery = rq;			// Add it to the global scope
}());
