/*
	Cape Breton Radio Playlist Statistics - Radio Query aka "Why aren't you doing that server-side?!" (GitHub Pages only serves static content)
	Author: Andy Deveaux
*/

(function() {
	'use strict';
	
	var DEBUG = true;
	function debug(messages) {
		if (DEBUG) {
			var i;
			for (i=0; i<messages.length; i++) {
				console.log(messages[i]);
			}
		}
	}
	
	// -- Constants --
	var ANY_STATION = -1;
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
		// Get how many times it was played by each station
		var playlists_table = this.radioData.playlists;
		var station, playlist, i;
		for (station in playlists_table) {
			if (playlists_table.hasOwnProperty(station)) {
				playlist = playlists_table[station];
				for (i=0; i<playlist.length; i++) {
					songs[playlist[i][PLAYLISTS_COL_SONG_ID]][2][station] += 1;
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
	
	var getSearchData = function(station_id, song_name, artist_name, order_by, ascended, limit) {
		
	};
	
	var getMostAndLeastPlayedSongsForStations = function(limit) {

		var stations_table = this.radioData.stations;
		var song_stats = {most: {}, least: {}};
		var restructured_songs = {};
		var station_id, i;
		for (station_id in stations_table) {
			if (stations_table.hasOwnProperty(station_id)) {
				restructured_songs[station_id] = [];
				song_stats.most[station_id] = [];
				song_stats.least[station_id] = [];
			}
		}
		// Add each song plus their count to every station in top_songs
		var songs = this.getSongData();
		var song, song_id, j;
		for (song_id in songs) {
			if (songs.hasOwnProperty(song_id)) {
				song = songs[song_id];
				for (station_id in song[2]) {
					if (song[2].hasOwnProperty(station_id)) {
						if (song[2][station_id] <= 0) {
							continue;
						}
						restructured_songs[station_id].push([song[SONGS_COL_NAME], song[1], song[2][station_id]]);		// [Song Name, Artist Name, Station Count]
					}
				}
			}
		}
debug(['Before sort', restructured_songs]);
		// Loop through the stations yet again to sort them
		for (station_id in restructured_songs) {
			if (restructured_songs.hasOwnProperty(station_id)) {
				restructured_songs[station_id] = restructured_songs[station_id].slice().sort(sortSongsByPlayCount);
				if (limit > 0) {
					// Slice the top and bottom entries for us to be able to get descending order without performing a reverse on the all of the songs
					song_stats.most[station_id] = restructured_songs[station_id].slice(restructured_songs[station_id].length - limit, restructured_songs[station_id].length);
					song_stats.least[station_id] = restructured_songs[station_id].slice(0, limit);
					restructured_songs[station_id] = null;
				}
				song_stats.most[station_id].reverse();		// Descending order for top songs
			}
		}
		debug(['Top songs:', song_stats.most, 'Bottom songs:', song_stats.least]);
		return song_stats;
	};
	
	// -- Private --
	// Fetches all song data with artist names joined
	function fetchAllSongs(rq) {
		var rows = {};
		var songs = rq.radioData.songs;
		var artists = rq.radioData.artists;
		var stations = rq.radioData.stations;
		var id;
		var song_station_count = {};
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
	function sortPlaylistBySongName(a, b) {
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
	
	function sortPlaylistByArtistName(a, b) {
		var name1 = a[1].toLowerCase();
		var name2 = b[1].toLowerCase();
		if (name1 < name2) {
			return -1;
		}
		else if (name1 > name2) {
			return 1;
		}
		
		return 0;		// Equal
	}
	
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
		return sortSongsBySongName(a, b);
	}
	
	function sortSongsBySongName(a, b) {
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
		
		return 0;			// Equal
	}

	// -- Interface --
	// Constructor
	var rq = function(radio_data) {
		var instance = {};
		instance.radioData = radio_data;
		instance.songIds = [];
		instance.artistIds = [];
		instance.getSongData = getSongData;
		instance.getArtistData = getArtistData;
		instance.getPlaylistsData = getPlaylistsData;
		instance.getSearchData = getSearchData;
		instance.getMostAndLeastPlayedSongsForStations = getMostAndLeastPlayedSongsForStations;
		return instance;
	};
	// Constants
	rq.ANY_STATION = ANY_STATION;
	window.RadioQuery = rq;			// Add it to the global scope
}());
