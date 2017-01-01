#!/usr/bin/python

import sqlite3


DATABASE_FILE = 'CBRadioPlaylists.db'
OUTPUT_FILE = 'Duplicates.txt'

def getDuplicates(playlists):
	entries = {}
	for row in playlists:
		key = '{}_{}_{}_{}'.format(row['station_id'], row['song_id'], row['original_time'], row['formatted_time'])
		if entries.get(key) is None:
			entries[key] = [row]
		else:
			entries[key].append(row)
	
	duplicates = {}
	for index,entry in enumerate(entries):
		if len(entries[entry]) > 1:
			duplicates[entry] = entries[entry]
			
	return duplicates

print("Searching for duplicate entries in 'playlists' table")

conn = sqlite3.connect(DATABASE_FILE)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
results = cursor.execute("""SELECT songs.name AS song_name, artists.name AS artist_name, stations.name AS station_name, playlists.* FROM playlists
							INNER JOIN songs ON playlists.song_id = songs.id
							INNER JOIN artists ON songs.artist_id = artists.id
							INNER JOIN stations ON playlists.station_id = stations.id""")

duplicates = getDuplicates(results.fetchall())
with open(OUTPUT_FILE, 'w') as f:
	for index, entry in enumerate(duplicates):
		f.write("{}. {}:\n".format(index, entry))
		for row in duplicates[entry]:
			text = "	[{}] Station='{}'  Song='{}'  Artist='{}' Time='{}' Formatted='{}', Inserted='{}'".format(row['id'], row['station_name'], row['song_name'], row['artist_name'], row['original_time'], row['formatted_time'], row['created'])
			print(text)
			f.write(text + '\n')

print('Finished')
