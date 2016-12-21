#!/usr/bin/python

import HTML
import sqlite3
import os

OUTPUT_DIRECTORY = 'pages'
DATABASE_FILENAME = 'CBRadioPlaylist.db'

def getOutputPath(filename):
	real_output_dir = os.path.realpath(OUTPUT_DIRECTORY)
	if not os.path.exists(real_output_dir):
		os.makedirs(real_output_dir)
	return real_output_dir + os.path.sep + filename

def writeToFile(filename, content):
	output_path = getOutputPath(filename)
	with open(output_path, 'w', encoding='utf-8') as f:
		f.write(content)
		print(str.format("Source output to '{0}'\n", output_path))

def createTable(columns, id=None, class_name=None):
	columns_type = type(columns)
	if columns_type is not list and columns_type is not tuple:
		raise TypeError('Columns must be a list or tuple')
	
	table = HTML.HTMLElement.table(id, class_name)
	header_row = HTML.HTMLElement.tr()
	for col in columns:
		header_row.appendChild(HTML.HTMLElement.th(col))
	table.tHead.appendChild(header_row)
	return table

def createStationListHeader(station_name, station_playlist_url):
	"""
	Returns a new HTML header element with the station name and playlist URL
	
	Args:
		station_name: Name of the station
		station_playlist_url: URL of the station's playlist
	"""
	header = HTML.HTMLElement.h2('Station: ' + station_name + '(')
	header.appendChild(HTML.HTMLElement.a(station_playlist_url, station_playlist_url))
	header.appendChild(HTML.TextNode(')'))
	return header

def partitionDataByStation(data):
	"""
	Separates rows of data into a dictionary where the keys are a station id
	
	Args:
		data: Query results that requires each row to have the 'station_id' key set
	"""
	partitioned_data = {}
	for station in STATIONS:
		partitioned_data[station['id']] = []
	for row in data:
		partitioned_data[row['station_id']].append(row)
	return partitioned_data

def generatePlaylistsPage(filename, conn):
	print('Generating playlists page...')
	doc = HTML.HTMLDocument('Cape Breton Radio Playlists', 'html')
	doc.addMetaTag(('charset', 'utf-8'))
	doc.addMetaTag([('name', 'viewport'), ('content', 'width=device-width, initial-scale=1')])
	doc.addMetaTag([('name', 'description'), ('content', 'Song list data scraped from a few Cape Breton radio stations.')])
	doc.addMetaTag([('name', 'keywords'), ('content', 'cape breton,radio,stations,scraped,playlist,data,database,sqlite,the cape,94.9,cjcb,fm,the giant,the eagle,max,98.3')])
	doc.addStylesheet('styles.css')
	
	body = doc.body
	body.appendChild(HTML.HTMLElement.h1('Cape Breton Radio Playlists'))
	body.appendChild(HTML.HTMLElement.p('This is a page of compiled song lists from a few Cape Breton radio stations. The song data was grabbed by a script that ran from December 16th, 2016 to January 1, 2017.'))
	body.appendChild(HTML.HTMLElement.p('Any name errors, misspellings or truncations are not my fault and are how they appeared on their sources. This may lead to some songs or artists having multiple entries in the database with different spelling alterations.', style='font-style: italic'))
	body.appendChild(HTML.HTMLElement('br'))
	
	cursor = conn.cursor()
	playlists = cursor.execute("""SELECT playlists.station_id, songs.name as song_name, artists.name as artist_name, playlists.original_time, playlists.formatted_time, playlists.posix_timestamp FROM playlists
								INNER JOIN songs ON playlists.song_id = songs.id
								INNER JOIN artists ON songs.artist_id = artists.id
								INNER JOIN stations ON playlists.station_id = stations.id
								ORDER BY station_id, posix_timestamp DESC""").fetchall()
	
	# Partition each station into its own list by using a dictionary
	partitioned_playlists = partitionDataByStation(playlists)
	del playlists
	
	header_columns = ('#', 'Song', 'Artist', 'Play Time (original)', 'Play Time (formatted)')
	# Using the station list defined above, I can keep the order of the stations as they appear in the query
	# results AND keep the rest of the station data without using a more complex data structure
	for station in STATIONS:
		body.appendChild(createStationListHeader(station['name'], station['playlist_url']))
		table = createTable(header_columns, class_name='playlist')
		for index, row in enumerate(partitioned_playlists[station['id']]):
			tr = HTML.HTMLElement.tr()
			tr.appendChild(HTML.HTMLElement.td(str(index + 1)))
			tr.appendChild(HTML.HTMLElement.td(row['song_name']))
			tr.appendChild(HTML.HTMLElement.td(row['artist_name']))
			tr.appendChild(HTML.HTMLElement.td(row['original_time']))
			tr.appendChild(HTML.HTMLElement.td(row['formatted_time']))
			table.tBody.appendChild(tr)
		container = HTML.HTMLElement.div(class_name='playlist-container')
		container.appendChild(table)
		body.appendChild(container)
	
	source = doc.getSource(True, True)
	print('Finished.')
	writeToFile(filename, source)

def getDistinctSongForEachStation(conn):
	"""
	Returns an array of distinct songs played by each station
	
	Args:
		conn: Database connection
	"""
	cursor = conn.cursor()
	results = cursor.execute("""SELECT DISTINCT playlists.song_id, songs.name AS song_name, artists.name AS artist_name, playlists.* FROM playlists
								INNER JOIN songs ON playlists.song_id = songs.id
								INNER JOIN artists ON songs.artist_id = artists.id
								ORDER BY station_id, artist_name""").fetchall()
	
	return partitionDataByStation(results)	

def getSongPlayCountForEachStation(conn):
	"""
	Returns the play count for each song by each station.
	Ordered by play count in descending order
	
	Args:
		conn: Database connection
	"""
	pass

def getDistinctArtistForEachStation(conn):
	"""
	Returns an array of distinct artists played by each station
	
	Args:
		conn: Database connection
	"""
	cursor = conn.cursor()
	results = cursor.execute("""SELECT DISTINCT artists.id, artists.name AS artist_name, playlists.station_id FROM playlists
								INNER JOIN songs ON playlists.song_id = songs.id
								INNER JOIN artists ON songs.artist_id = artists.id
								ORDER BY station_id, artists.name""").fetchall()
	
	return partitionDataByStation(results)
	
def getArtistPlayCountForEachStation(conn):
	"""
	Returns the play count for each artist by each station
	Ordered by play count in descending order
	
	Args:
		conn: Database connection
	"""
	pass

def getSongPlayCountByKeywordsForEachStation(conn):
	"""
	Returns the play count for each song that contains specific keywords by each station
	Ordered by play count in descending order
	
	Args:
		conn: Database connection
	"""
	keywords = ('christmas', 'snow', 'bells', 'jingle', 'santa', 'claus', 'winter', 'reindeer', 'rudolph', 'angel', 'noel',
				'sleigh', 'present', 'mistletoe', 'tinsel', 'tree', 'stocking', 'xmas', 'silver', 'saint', 'silent night',
				'cold outside', 'frosty', 'drummer boy', 'mary', 'merry', 'lord', 'sugar plum', 'chestnuts', 'feliz navidad',
				'december', 'holiday', 'wish', 'lights', 'fairy', 'hallelujah')

with sqlite3.connect(DATABASE_FILENAME) as conn:
	conn.row_factory = sqlite3.Row
	cursor = conn.cursor()
	STATIONS = cursor.execute("SELECT * FROM stations").fetchall()		# So the stations only need to be fetched once
	generatePlaylistsPage('playlists.html', conn)
