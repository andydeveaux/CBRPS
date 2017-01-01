#!/usr/bin/python

"""
Created when a bug prevented the UTC offset from being appended to certain formatted dates
"""

import sqlite3
import shutil
import datetime
import math

DATABASE_FILENAME = 'CBRadioPlaylists.db'
NEW_DATABASE_FILENAME = 'CBRadioPlaylists_New.db'

def getUTCOffsetFromSeconds(seconds):
	hours = seconds / 3600
	minutes = math.floor(60 * (hours - math.floor(hours)))		# Convert percentage to hours in a minute
	if seconds < 0:
		output = '-' + str(math.floor(abs(hours))).zfill(2) + str(minutes).zfill(2)
	else:
		output = str(math.floor(hours)).zfill(2) + str(minutes).zfill(2)
	return output

# Sucky log function because I'm lazy
def log(msg, file_handle=None):
	print(msg)
	if file_handle is not None:
		file_handle.write(msg + '\n')
	

# Make sure my logic is right

assert getUTCOffsetFromSeconds(-14400) == '-0400'
assert getUTCOffsetFromSeconds(-12600) == '-0330'

shutil.copy2(DATABASE_FILENAME, NEW_DATABASE_FILENAME)
with sqlite3.connect(NEW_DATABASE_FILENAME) as conn:
	conn.row_factory = sqlite3.Row
	cursor = conn.cursor()
	results = cursor.execute("""SELECT playlists.id, playlists.formatted_time, stations.utcoffset FROM playlists
								INNER JOIN stations on playlists.station_id = stations.id""").fetchall()
	with open('log.txt', 'w') as f:
		for row in results:
			if row['formatted_time'].endswith('UTC'):
				offset_str = getUTCOffsetFromSeconds(row['utcoffset'])
				new_formatted_time = row['formatted_time'] + offset_str
				log(str.format("Updating row id '{0}'", row['id']), f)
				log(str.format("Old='{0}'  New='{1}'", row['formatted_time'], new_formatted_time), f)
				cursor.execute("UPDATE playlists SET formatted_time = ? WHERE id = ?", (new_formatted_time, row['id']))
		conn.commit()
		log('Finished.', f)
