#!/usr/bin/python

"""
Script to dump the database into a compact JSON formatted file
"""

import sqlite3
import json

DATABASE_FILE='CBRPS.db'
OUTPUT_FILE='playlist_data.json'

def structureData(stations, artists, songs, playlists):
	"""
	Puts selected pieces of data into an object structure that is to be converted to JSON
	
	Args:
		stations: sqlite3.Row object containing stations data
		artists: sqlite3.Row object containing artists data
		songs: sqlite3.Row object containing songs data
		playlists: sqlite3.Row object containing playlists data
	"""
	print('Structuring data...')
	structured_stations = {}
	for station in stations:
		structured_stations[station['id']] = (station['name'], station['playlist_url'])
	
	structured_artists = {}
	for artist in artists:
		structured_artists[artist['id']] = artist['name']
	
	structured_songs = {}
	for song in songs:
		structured_songs[song['id']] = (song['name'], song['artist_id'])
	
	structured_playlists = {}
	for station in stations:
		structured_playlists[station['id']] = []
	for playlist in playlists:
		entry = (playlist['song_id'], playlist['original_time'], playlist['formatted_time'])
		structured_playlists[playlist['station_id']].append(entry)
	
	structured_data =  {'stations': structured_stations,
						'artists': structured_artists,
						'songs': structured_songs,
						'playlists': structured_playlists
					   }
	print('Finished.\n')
	return structured_data

def getJsonDataDump(conn):
	cursor = conn.cursor()
	# I'm going to separate each table into it's own object because it should save shave off some of the file size,
	# since I have a lot of repetitive data. Drawback is that it will increase overhead with the Javascript script
	# because it will have to do everything the initial query would have."
	print('Retrieving data...')
	results = cursor.execute('SELECT * FROM stations')
	stations = results.fetchall()
	
	results = cursor.execute('SELECT * FROM artists')
	artists = results.fetchall()
	
	results = cursor.execute('SELECT * FROM songs')
	songs = results.fetchall()
	
	results = cursor.execute('SELECT * FROM playlists ORDER BY station_id, posix_timestamp DESC')
	playlists = results.fetchall()
	print('Finished.\n')
	
	structured_data = structureData(stations, artists, songs, playlists)
	print('Converting to JSON...')
	json_data = json.dumps(structured_data, separators=(',', ':'), indent=None)
	print('Finished.\n')
	return json_data

def writeToFile(filename, data):
	print('Writing data...')
	with open(filename, 'w', encoding='utf-8') as fp:
		fp.write(data)
	print('Finished.\n')

def outputJsonFile(db_filename, output_filename):
	try:
		conn = sqlite3.connect(db_filename)
		conn.row_factory = sqlite3.Row
		
		data = getJsonDataDump(conn)
		conn.close()
		writeToFile(output_filename, data)
	except sqlite3.Error as ex:
		print('A database error occured: ', ', '.join(ex.args))
	except IOError as ex:
		print('There was an error writing to the file: ', strerror)
	except Exception as ex:
		print('An error has occured: ', ', '.join(ex.args))	

outputJsonFile(DATABASE_FILE, OUTPUT_FILE)