#!/usr/bin/python
"""
Cape Breton Radio Playlist Scraper
v1.0 

Scrapes radio playlist data from some of the Cape Breton radio stations (as of December 2016)

Last Updated: 16/12/2016
"""

# This script is a bit of a mess that I hacked together while learning about Python and its various libraries, so forgive the suckiness

import os
import shutil
import argparse
import logging
import sqlite3
import urllib.request
import gzip
from socket import gaierror
from time import sleep
from html.parser import HTMLParser
from datetime import datetime, timezone, timedelta



def init():
	"""Script initialization"""
	global db
	global logger
	db = None
	args = getArgs()
	setup_main_logger(args.log_level, args.log_filename)
	if args.db_backup_path is not None:
		if not os.path.exists(args.db_filename):
			logger.warn(str.format("Database file '{}' cannot be backed up because it does not exist yet", args.db_filename))
		else:	
			try:
				if not os.path.exists(args.db_backup_path):
					os.makedirs(args.db_backup_path)
				shutil.copy2(args.db_filename, os.path.normpath(args.db_backup_path + os.sep + generateBackupFilename(args.db_filename)	))
			except IOError as ex:
				logger.error('An error occured during backup: ' + ex.strerror)
	try:
		db = DBO(args.db_filename, create_logger(MAIN_LOGGER_NAME + '.DB', args.log_level))
	except:
		logger.info('Cannot continue. Quitting.')
		cleanup()
		exit(1)
	
	logger.info('Initialization complete.')
	
def getArgs():
	"""Parses command line arguments and returns an object containing them as properties"""
	levels = {'DEBUG': logging.DEBUG, 'INFO': logging.INFO, 'WARN': logging.WARN, 'ERROR': logging.ERROR, 'CRITICAL': logging.CRITICAL}
	parser = argparse.ArgumentParser(description='Scrapes radio playlist data from some of the Cape Breton radio stations (as of December 2016)')
	parser.add_argument('--log-file', help='Name of the log file to use', default=DEFAULT_LOG_FILENAME, dest='log_filename')
	parser.add_argument('--log-level', help='Level at which to start printing log messages', choices=levels.keys(), type=str.upper, default=DEFAULT_LOG_LEVEL, dest='log_level')
	parser.add_argument('--db-file', help='SQLite database filename to use', default=DEFAULT_DATABASE_FILENAME, dest='db_filename')
	parser.add_argument('--backup-db', help='Backup database to a specified directory before writing to disk', nargs='?', const='backups', dest='db_backup_path')
	
	args = parser.parse_args()
	args.log_level = levels.get(args.log_level)
	return args
	
def generateBackupFilename(src_name):
	"""Returns a generated filename for a backup file"""
	basename = os.path.basename(src_name)
	ext_index = basename.rindex(os.extsep)
	ext = basename[ext_index:]
	name = basename[0 : ext_index]
	return  name + datetime.strftime(datetime.fromtimestamp(os.path.getmtime(src_name)), DB_BACKUP_FILENAME_DATE_FORMAT) + ext
	
	
def cleanup():
	"""Cleanup routine"""
	global db
	global logger
	if db is not None:
		db.close()
		db.closeLoggingStreams()
	logger.info('Closing main logger streams.')
	for handler in logger.handlers:
		handler.stream.write('-------------------------------------------------------------\n')
		handler.stream.write('\n\n')
		handler.close()


def create_logger(name, level=logging.WARN, handlers=None):
	"""
	Creates and returns a logger with the specified parameters
	
	Args:
		name: Name of the logger
		level: Logging level (optional, default is logging.WARN)
		handlers: Tuple/list of handlers (optional)
	"""
	logger = logging.getLogger(name)
	logger.setLevel(level)	
	if handlers is not None:
		for handler in handlers:
			logger.addHandler(handler)
	
	return logger

def setup_main_logger(log_level, log_filename):
	"""Sets up the global logger of the script"""
	global logger
	if type(log_level) is not int:
		raise TypeError('log_level expects an integer')
	elif type(log_filename) is not str:
		raise TypeError('log_filename expects a string')
		
	formatter = logging.Formatter('%(asctime)s [%(levelname)s]%(name)s - %(message)s', '%d-%m-%Y %I:%M:%S %p')
	sh = logging.StreamHandler()
	fh = logging.FileHandler(log_filename)
	sh.setFormatter(formatter)
	fh.setFormatter(formatter)
	logger = create_logger(MAIN_LOGGER_NAME, log_level, (sh, fh))
	logAllLevels('-------------------------------------------------------------')
	logAllLevels('Cape Breton Radio Scraper - ' + datetime.strftime(datetime.now(), '%d-%m-%Y %I:%M:%S %p') + '\n')
	logger.info('Main logger set.')
	
def logAllLevels(msg):
	for handler in logger.handlers:
		handler.stream.write(msg + '\n')

def scrape(site_info):
	logger.info('Scraping playlist: ' + site_info['url'])
	req = urllib.request.Request(site_info['url'])
	req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36') # :p
	req.add_header('Accept-Encoding', 'gzip, deflate, br')
	req.add_header('Accept-Language', 'en-US,en;q=0.5')
	
	playlist = []
	
	fetch = True
	fetch_count = 0
	while fetch:
		fetch_count += 1
		try:
			with urllib.request.urlopen(req) as res:
				if res.status != 200:
					raise HTTPError(res.url, res.code, res.msg, res.headers, res.fp)
				
				page_data = res.read()
				
				content_encoding = res.getheader('Content-Encoding')
				if content_encoding is not None:
					logger.debug('Content-Encoding: ' + content_encoding)
					if content_encoding == 'gzip':
						page_data = gzip.decompress(page_data)
				content_type = res.getheader('Content-Type')
				logger.debug('Content-Type: ' + str(content_type))
				if content_type is None or content_type.find('charset=') < 0:
					charset = 'ISO-8859-1'		# Default to this if none specified
				else:
					charset = content_type[content_type.find('charset=') + 8:].split(';')[0]
				logger.debug('Charset set to: ' + charset)
				
				parser = HTMLPlaylistParser(site_info.get('DOM_search'), create_logger(MAIN_LOGGER_NAME + '.PARSER', logger.level))
				parser.feed(page_data.decode(charset))
				playlist = parser.playlist
				fetch = False
		except (urllib.error.HTTPError, urllib.error.URLError, urllib.error.ContentTooShortError) as ex:
			if isinstance(ex.reason, gaierror):
				reason = ex.reason.strerror
			else:
				reason = ex.reason
			logger.error('There was an issue retrieving the page: ' + reason)
			
			if fetch_count-1 >= URL_MAX_RETRY_ATTEMPTS:
				logger.error('Max retry attempts reached. Moving on to next site.')
				return
			else:
				sleep(URL_RETRY_DELAY)
				logger.info('Retry #' + str(fetch_count))
		except Exception as ex:
			logger.error('An error occured: ' + ex.args[0])
			if isinstance(ex, SyntaxError):
				logger.error(ex.text)
			fetch = False
	
	logger.info('Number of rows: ' + str(len(playlist)))
	try:
		insertPlaylistIntoDatabase(site_info, playlist)
	except Exception as ex:
		logger.error(ex.args[0])

def insertPlaylistIntoDatabase(site_info, playlist):
	"""
	Processes the playlist data before inserting it into the database
	
	Args:
		site_info: Site information dictionary
		playlist: List containing playlist data
	"""
	global db
	global logger	
	result = db.execute("SELECT stations.id FROM stations WHERE playlist_url = ? LIMIT 1", (site_info['url'],)).fetchone()
	if result is None:
		raise Exception(str.format("Radio station '{}' with playlist URL '{}' not found" + site_info['name'], site_info['url']))
	station_id = result[0]
	
	# Get last scraped song
	last_song_scraped = db.execute("""SELECT songs.name AS song_name, artists.name AS artist_name, playlists.original_time FROM playlists
									  INNER JOIN songs ON playlists.song_id = songs.id
									  INNER JOIN artists ON songs.artist_id = artists.id
									  WHERE station_id = ? ORDER BY posix_timestamp DESC LIMIT 1
								   """, (station_id,)).fetchone()
	
	if last_song_scraped is None:
		logger.info('No songs scraped from previous session(s).')
	else:
		logger.info("Last song scraped: '" + last_song_scraped['song_name'] + "' by '" + last_song_scraped['artist_name'] + "' at " + last_song_scraped['original_time'])
	
	last_song_scraped_reached = False
	for index, record in enumerate(playlist):
		if last_song_scraped is not None and \
		   last_song_scraped['song_name'].lower() == record['song'].lower() and \
		   last_song_scraped['artist_name'].lower() == record['artist'].lower() and \
		   last_song_scraped['original_time'] == record['datetime']:
			logger.info('Reached last song scraped from last session. Moving on to next site')
			last_song_scraped_reached = True
			break
		
		artist_id = db.execute("SELECT artists.id FROM artists WHERE artists.name = ?", (record['artist'],)).fetchone()
		if artist_id is None:
			logger.info(str.format("Artist '{}' not found. Inserting", record['artist']))
			cursor = db.insertIntoArtists(record['artist'])
			artist_id = cursor.lastrowid
		else:
			artist_id = artist_id[0]
		logger.debug('Artist ID: ' + str(artist_id))
		
		song_id = db.execute("SELECT songs.id FROM songs WHERE songs.name = ? COLLATE NOCASE AND songs.artist_id = ? LIMIT 1", (record['song'], artist_id)).fetchone()
		if song_id is None:
			logger.info(str.format("Song: '{}' by '{}' not found. Inserting", record['song'], record['artist']))
			cursor = db.insertIntoSongs(record['song'], artist_id)
			song_id = cursor.lastrowid
		else:
			song_id = song_id[0]
		logger.debug("Song ID: " + str(song_id))
			
		# Format dates for display and figure out complete dates from missing data
		local_datetime_converted = datetime.now(timezone(site_info['utcoffset']))	# Convert system timezone to the same as the station's
		scraped_local_datetime = datetime.strptime(record['datetime'], site_info['time_format'])
		# If no year is in the time format, we must figure out what year it was (lest it be kept at 1900)
		if site_info['time_format'].find('%Y') == -1:
			# No date either? Goddamnit The Giant/The Eagle
			if site_info['time_format'].find('%d') == -1:
				# Since the stations claim the playlists only go back 24 hours, assume the first entry starts at today and goes backwards from that
				if index == 0:
					# Starting point
					first_song_local_datetime = local_datetime_converted.replace(hour=scraped_local_datetime.hour, minute=scraped_local_datetime.minute, second=scraped_local_datetime.second)
					# If the time is ahead of today's time, it's probably from yesterday
					if first_song_local_datetime.hour > local_datetime_converted.hour or \
					(first_song_local_datetime.hour == local_datetime_converted.hour and (first_song_local_datetime.minute > local_datetime_converted.minute or
					 (first_song_local_datetime.minute == local_datetime_converted.minute and first_song_local_datetime.second > local_datetime_converted.second))):
						first_song_local_datetime = first_song_local_datetime.replace(day=local_datetime_converted.day - 1)
					else:	
						play_local_datetime = first_song_local_datetime
				else:
					if scraped_local_datetime.hour > first_song_local_datetime.hour or \
					(scraped_local_datetime.hour == first_song_local_datetime.hour and (scraped_local_datetime.minute > first_song_local_datetime.minute or
					 (scraped_local_datetime.minute == first_song_local_datetime.minute and scraped_local_datetime.second > first_song_local_datetime.second))):
						play_local_datetime = first_song_local_datetime.replace(hour=scraped_local_datetime.hour, minute=scraped_local_datetime.minute, second=scraped_local_datetime.second) - timedelta(days=1)
					  
					else:
						play_local_datetime = first_song_local_datetime.replace(hour=scraped_local_datetime.hour, minute=scraped_local_datetime.minute, second=scraped_local_datetime.second)
			
			# If their date is ahead of our current time, then their date is from at least last year
			# ** This will introduce a bug if the system's time is ahead of the station's time, or vice versa **
			elif scraped_local_datetime.month > local_datetime_converted.month or \
			(scraped_local_datetime.month == local_datetime_converted.month and (scraped_local_datetime.day > local_datetime_converted.day or
			 (scraped_local_datetime.day == local_datetime_converted.day and (scraped_local_datetime.hour > local_datetime_converted.hour or
			  (scraped_local_datetime.hour == local_datetime_converted.hour and (scraped_local_datetime.minute > local_datetime_converted.minute or
			  	(scraped_local_datetime.minute == local_datetime_converted.minute and scraped_local_datetime.second > local_datetime_converted.second))))))):
				play_local_datetime = scraped_local_datetime.replace(year=local_datetime_converted.year-1)
			else:
				play_local_datetime = scraped_local_datetime.replace(year=local_datetime_converted.year)
				
		
		formatted_play_local_datetime = play_local_datetime.strftime(TIME_DISPLAY_FORMAT)
		logger.info(str.format("Inserting into playlists: '{}' by '{}' at '{}'", record['song'], record['artist'], record['datetime']))
		play_utc_datetime = datetime.utcfromtimestamp(play_local_datetime.timestamp()).replace(tzinfo=timezone.utc)
		db.insertIntoPlaylists(station_id, song_id, record['datetime'], formatted_play_local_datetime, int(play_utc_datetime.timestamp()))
	
	if last_song_scraped is not None and not last_song_scraped_reached:
		logger.warn('Last scraped song was expected but not found. Potentially missing data.')
	
	db.commit()
		

# Classes
class DBO:
	"""Database abstraction layer"""	
	def __init__(self, filename, logger=None):
		"""
		Args:
			filename: Filename of the SQLite 3 database to use
			logger: Logging object (optional)
		"""
		# Instance properties
		self.__logger = None
		self.__conn = None
		self.__file = None
		
		if type(filename) != str:
			raise TypeError('Filename argument must be a string')
		
		if logger is not None:
			self.setLogger(logger)
		
		file_exists = os.path.exists(filename)
		if file_exists:
			self.__log(logging.INFO, "Opening existing database file: '" + filename + "'")
		else:
			self.__log(logging.INFO, "Creating new database file: '" + filename + "'")

		try:
			self.__file = filename
			self.__conn = sqlite3.connect(filename)
			self.__conn.row_factory = sqlite3.Row
			
			if not file_exists:
				self.__createSchema()
				self.__insertInitialData()
		except Exception as ex:
			self.__log(logging.CRITICAL, 'There was an issue with the database: ' + ex.args[0])
			raise ex
	
	def __createSchema(self):
		"""Generates and writes the necessary SQLite 3 database schema"""
		self.__log(logging.INFO, 'Writing SQLite 3 database schema...')			
		conn = self.__conn
		conn.execute("""CREATE TABLE IF NOT EXISTS stations (
							id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
							name TEXT UNIQUE NOT NULL,
							playlist_url TEXT NOT NULL,
							utcoffset INTEGER NOT NULL, 	-- Seconds
							created DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
						)""")
		
		conn.execute("""CREATE TABLE IF NOT EXISTS artists (
							id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
							name TEXT UNIQUE NOT NULL,
							created DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
						)""")
		
		conn.execute("""CREATE TABLE IF NOT EXISTS songs (
							id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
							artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE ON UPDATE CASCADE,
							name TEXT NOT NULL,
							created DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
						)""")
		
		conn.execute("""CREATE TABLE IF NOT EXISTS playlists (
							id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
							station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE ON UPDATE CASCADE,
							song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE ON UPDATE CASCADE,
							original_time TEXT NOT NULL, -- Time scraped by the playlist
							formatted_time TEXT NOT NULL, -- Time converted by the script in order to regularize all of the times into a specific display format *Stored in Atlantic Standard Time (UTC -04:00)*
							posix_timestamp DATE NOT NULL, -- Easier to sort by *Stored in UTC-0000*
							created DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
						)""")
		
		conn.commit()		
		self.__log(logging.INFO, 'Schema created successfully')
	
	def __insertInitialData(self):
		"""Inserts initial data into the database that is necessary for operation"""
		self.__log(logging.INFO, 'Inserting initial data...')
		for station in SITES:
			self.__log(logging.INFO, 'Adding station: ' + station['name'])
			self.execute("INSERT INTO stations(name, playlist_url, utcoffset) VALUES(?, ?, ?)", (station['name'], station['url'], station['utcoffset'].total_seconds()))
			
		self.__log(logging.INFO, 'Initial data inserted successfully')
	
	def __log(self, level, message):
		if self.__logger is not None:
			if level == logging.DEBUG:
				self.__logger.debug(message)
			elif level == logging.INFO:
				self.__logger.info(message)
			elif level == logging.WARN:
				self.__logger.warn(message)
			elif level == logging.ERROR:
				self.__logger.error(message)
			elif level == logging.CRITICAL:
				self.__logger.critical(message)
			else:
				self.__logger.info(message)
		
	def setLogger(self, logger):
		"""
		Sets the logger for this instance
		
		Args:
			logger: Instance of logging.Logger
		"""
		if not isinstance(logger, logging.Logger):
			raise TypeError('Logging object is not an instance of logging.Logger')
		self.__logger = logger
		self.__logger.info('Logger has been set.')
		
	def execute(self, query, params=()):
		#self.__log(logging.DEBUG, 'Executing query: "' + query + '"')
		cursor = self.__conn.cursor()
		r = cursor.execute(query, params)
		return r
	
	def commit(self):
		self.__conn.commit()	
		
	def insertIntoArtists(self, name):
		return self.execute("INSERT INTO artists(name) VALUES(?)", (name,))
		
	def insertIntoSongs(self, name, artist_id):
		return self.execute("INSERT INTO songs(name, artist_id) VALUES(?,?)", (name, artist_id))
		
	def insertIntoPlaylists(self, station_id, song_id, original_time, formatted_time, posix_timestamp):
		return self.execute("INSERT INTO playlists(station_id, song_id, original_time, formatted_time, posix_timestamp) VALUES(?, ?, ?, ?, ?)", (station_id, song_id, original_time, formatted_time, posix_timestamp))
		
	def close(self):
		"""Closes the database file"""
		if self.__conn is not None:
			self.__logger.info('Closing SQLite database file: ' + self.__file)
			self.__conn.close()
		
	def closeLoggingStreams(self):
		"""Closes the  handler streams"""
		if self.__logger is not None:
			self.__logger.info('Closing logger streams.')
			for handler in self.__logger.handlers:
				handler.close()
		
	def implodeList(data_list, separator=', ', quote_items=False):
		"""
		Returns a string of values from a list separated by a separator
		
		Args:
			data_list: List of values
			separator: String used to separate each item (optional)
			quote_items: Surrounds each value with single quotes
		"""
		if type(data_list) is not list:
			raise TypeError('data_list expects a list')
		elif type(separator) is not str:
			raise TypeError('separator must be a string')
		elif type(quote_items) is not bool:
			raise TypeError('quote_items must be a boolean')
			
		last_index = len(data_list) - 1
		output = ''
		for index, item in enumerate(data_list):
			if quote_items:
				output += "'" + str(item) + "'"
			else:
				output += str(item)
			if index < last_index:
				output += separator
		
		return output

class PlaylistDOMSearch:
	"""Class representing where to find the data in an HTML playlist"""
	TAG = 0
	ID = 1
	CLASS = 2
		
	def __init__(self, row_node, cell_node, parent_node=None):
		"""
			Args:
				row_node: Tag, id, or class of parent node
				cell_node: Tag, id, or class of cell node
				parent_node: Tag, id, or class of parent node (optional)
		"""
		if type(parent_node) is not str and parent_node is not None:
			raise TypeError('Parent node must be a string')
		elif type(row_node) is not str:
			raise TypeError('Row node must be a string')
		elif type(cell_node) is not str:
			raise TypeError('Cell node must be a string')
		
		self.parentNode = PlaylistDOMSearch.createSingleSearch(parent_node)
		self.rowNode = PlaylistDOMSearch.createSingleSearch(row_node)
		self.cellNode = PlaylistDOMSearch.createSingleSearch(cell_node)
			
	def createSingleSearch(string):
		"""
		Returns an dictionary object used for searching for an HTML playlist node
		
		Args:
			string: Tag, id, or class of the node
		"""
		if type(string) is not str:
			raise TypeError('Expected a string')
		
		string = string.strip()
		if string[0] == '#':
			return {'type': PlaylistDOMSearch.ID, 'value': string[1:]}
		elif string[0] == '.':
			return {'type': PlaylistDOMSearch.CLASS, 'value': string[1:]}
		else:
			return {'type': PlaylistDOMSearch.TAG, 'value': string}
	

class HTMLPlaylistParser(HTMLParser):
	
	def __init__(self, dom_search=None, logger=None):
		super().__init__()
		
		if logger is not None:
			self.setLogger(logger)
		else:
			self.__logger = None
			
		if dom_search is None:
			self.__setDOMSearch(PlaylistDOMSearch(parent_node='table', row_node='tr', cell_node='td'))
		elif isinstance(dom_search, PlaylistDOMSearch):
			self.__setDOMSearch(dom_search)
		else:
			raise TypeError('Dom search object is not an instance of PlaylistDOMSearch')
		
		# Data stored while combing the HTML tags to know when search nodes have started or ended
		self.__parentNode = {'tag': None, 'level': 0}
		self.__rowNode = {'tag': None, 'level': 0, 'index': -1}
		self.__cellNode = {'tag': None, 'level': 0, 'index': -1}
		
		self.playlist = []
	
	def __setDOMSearch(self, dom_search):
		"""
		Sets the Playlist DOM search for parsing the HTML playlist
		
		Args:
			dom_search: A PlaylistDOMSearch object
		"""
		if not isinstance(dom_search, PlaylistDOMSearch):
			raise TypeError('Expected instance of PlaylistDOMSearch')
		
		self.__domSearch = dom_search
		ds = self.__domSearch
		self.__log(logging.DEBUG, str.format("DOM Search: parentNode=({},'{}') rowNode=({},'{}') cellNode=({},'{}')", str(ds.parentNode['type']), ds.parentNode['value'],
																									 str(ds.rowNode['type']), ds.rowNode['value'], 
																									 str(ds.cellNode['type']), ds.cellNode['value']))
		
	def __log(self, level, message):
		if self.__logger is not None:
			if level == logging.DEBUG:
				self.__logger.debug(message)
			elif level == logging.INFO:
				self.__logger.info(message)
			elif level == logging.WARN:
				self.__logger.warn(message)
			elif level == logging.ERROR:
				self.__logger.error(message)
			elif level == logging.CRITICAL:
				self.__logger.critical(message)
			else:
				self.__logger.info(message)
				
	def __hasClass(self, search, class_str):
		"""
		Searches a class attribute for a specific class and returns True/False
		
		Args:
			search: Search class name
			class_str: The class attribute string
		"""
		if type(class_str) is not str:
			return False
		
		search = search.lower()
		classes = class_str.lower().split(' ')
		for c in classes:
			if c == search:
				return True
			
		return False
		
	def setLogger(self, logger):
		"""
		Sets up a logger for the parser
		
		Args:
			logger: The logger to use
		"""
		if not isinstance(logger, logging.Logger):
			raise TypeError('Argument expecting instance of logging.Logger')	
		self.__logger = logger
		self.__log(logging.INFO, 'Logger set')
	
	def feed(self, data):
		self.__log(logging.INFO, 'Beginning to parse page')
		try:
			super().feed(data)
		except StopParsingException:
			self.__log(logging.INFO, 'Parsing finished')
		except Exception as ex:
			raise ex
		
	def handle_starttag(self, tag, attrs):
		tag = tag.lower()
		attr_id = None
		attr_class = None
		for attr in attrs:
			if attr[0] == 'id':
				attr_id = attr[1].lower()
			elif attr[0] == 'class':
				attr_class = attr[1]
		
		in_parent = (self.__parentNode['level'] > 0)
		in_row = (self.__rowNode['level'] > 0)
		in_cell = (self.__cellNode['level'] > 0)
		
		if in_cell:
			# Handle if there happens to be nested tags of the same type as the parent/row/cell node
			if tag == self.__cellNode['tag']:
				self.__log(logging.DEBUG, 'Entering nested cell tag: ' + tag)
				self.__cellNode['level'] += 1
			if in_row and tag == self.__rowNode['tag']:
				self.__log(logging.DEBUG, 'Entering nested row tag in cell: ' + tag)
				self.__rowNode['level'] += 1
			if in_parent and tag == self.__parentNode['tag']:
				self.__log(logging.DEBUG, 'Entering nested parent tag in cell: ' + tag)
				self.__parentNode['level'] += 1
		
		elif in_row:
			cn_type = self.__domSearch.cellNode['type']
			cn_value = self.__domSearch.cellNode['value']
			if (cn_type == PlaylistDOMSearch.TAG and tag == cn_value) or \
			   (cn_type == PlaylistDOMSearch.ID and attr_id == cn_value) or \
			   (cn_type == PlaylistDOMSearch.CLASS and self.__hasClass(cn_value, attr_class)):
				if self.__cellNode['tag'] is None:
					self.__cellNode['tag'] = tag
				
				self.__cellNode['level'] += 1
				self.__cellNode['index'] += 1
				if self.__cellNode['index'] == 0:
					self.playlist.append({'song': None, 'artist': None, 'datetime': None})
				self.__log(logging.DEBUG, str.format('Entered cell: level={} index={}', str(self.__cellNode['level']), str(self.__cellNode['index'])))
			
			# Handle if there happens to be nested tags of the same type as the parent/row node
			if tag == self.__rowNode['tag']:
				self.__log(logging.DEBUG, 'Entered nested row tag inside of row: ' + tag)
				self.__rowNode['level'] += 1
			if tag == self.__parentNode['tag']:
				self.__log(logging.DEBUG, 'Entered nested parent tag inside of row: ' + tag)
				self.__parentNode['level'] += 1			
		
		elif in_parent:
			rn_type = self.__domSearch.rowNode['type']
			rn_value = self.__domSearch.rowNode['value'].lower()
			if (rn_type == PlaylistDOMSearch.TAG and tag == rn_value) or \
				(rn_type == PlaylistDOMSearch.ID and attr_id == rn_value) or \
				(rn_type == PlaylistDOMSearch.CLASS and self.__hasClass(rn_value, attr_class)):
				if self.__rowNode['tag'] is None:
					self.__rowNode['tag'] = tag
				self.__log(logging.DEBUG, 'Entered row: ' + tag)
				self.__rowNode['level'] += 1
				self.__rowNode['index'] += 1
				self.__cellNode['index'] = -1	# Reset cell index
				
			# Handle if there happens to be nested tags of the same type as the parent node
			elif tag == self.__parentNode['tag']:
				self.__log(logging.DEBUG, 'Entered nested parent tag inside of parent: ' + tag)
				self.__parentNode['level'] += 1
		
		# Not in parent
		else:
			pn_type = self.__domSearch.parentNode['type']
			pn_value = self.__domSearch.parentNode['value'].lower()
			if (pn_type == PlaylistDOMSearch.TAG and tag == pn_value) or \
				(pn_type == PlaylistDOMSearch.ID and attr_id == pn_value) or \
				(pn_type == PlaylistDOMSearch.CLASS and self.__hasClass(pn_value, attr_class)):
				if self.__parentNode['tag'] is None:
					self.__parentNode['tag'] = tag
				self.__log(logging.DEBUG, str.format("Entered parent node: tag= '{}' id='{}' class='{}'", tag, attr_id, attr_class))
				self.__parentNode['level'] += 1
	
	def handle_endtag(self, tag):
		tag = tag.lower()
		in_parent = (self.__parentNode['level'] > 0)
		in_row = (self.__rowNode['level'] > 0)
		in_cell = (self.__cellNode['level'] > 0)
		if in_cell:
			if tag == self.__parentNode['tag'] and in_parent:
				self.__log(logging.DEBUG, 'Left parent tag while inside of cell: ' + tag)
				self.__parentNode['level'] -= 1
			if tag == self.__rowNode['tag'] and in_row:
				self.__log(logging.DEBUG, 'Left row tag while inside of cell: ' + tag)
				self.__rowNode['level'] -= 1
			if tag == self.__cellNode['tag']:
				self.__log(logging.DEBUG, 'Left cell: ' + tag)
				self.__cellNode['level'] -= 1
		
		elif in_row:
			if tag == self.__parentNode['tag'] and in_parent:
				self.__log(logging.DEBUG, 'Left parent tag while inside of row: ' + tag)
				self.__parentNode['level'] -= 1
			if tag == self.__rowNode['tag']:
				self.__log(logging.DEBUG, 'Left row: ' + tag)
				self.__rowNode['level'] -= 1
		
		elif in_parent:
			if tag == self.__parentNode['tag']:
				self.__log(logging.DEBUG, 'Left parent: ' + tag)
				self.__parentNode['level'] -= 1
		
		if in_parent and self.__parentNode['level'] == 0:
			raise StopParsingException
	
	def handle_data(self, data):
		in_cell = (self.__cellNode['level'] > 0)
		if in_cell:
			index = self.__cellNode['index']
			row = self.playlist[len(self.playlist)-1]
			if index == 0:
				row['song'] = data
			elif index == 1:
				row['artist'] = data
			elif index == 2:
				row['datetime'] = data
			else:
				self.__log(logging.DEBUG, 'Extra node, ignoring.')
	
class StopParsingException(Exception):
	pass	

# Globals
MAIN_LOGGER_NAME = 'CBRPS'
DEFAULT_LOG_FILENAME = 'CBRPS.log'
DEFAULT_LOG_LEVEL = 'WARN'
DEFAULT_DATABASE_FILENAME = 'CBRPS.db'
DB_BACKUP_FILENAME_DATE_FORMAT = '_%d-%m-%Y_%H-%M-%S%p'
URL_MAX_RETRY_ATTEMPTS = 3		# Doesn't count the first fetch, so it will actually fetch 4 times before quitting
URL_RETRY_DELAY = 2.0			# Time in seconds
TIME_DISPLAY_FORMAT = '%d/%m/%Y %I:%M:%S %p UTC%z'
SITES = [{'name': 'The Cape 94.9', 'url': 'http://thecape949.com/playlists/', 'time_format': '%a %b %d %H:%M:%S', 'utcoffset': timedelta(hours=-4)},
		 {'name': 'Max FM 98.3', 'url': 'http://983maxfm.com/playlists/', 'time_format': '%a %b %d %H:%M:%S', 'utcoffset': timedelta(hours=-4)},
		 {'name': '1270 CJCB AM', 'url': 'http://cjcbradio.com/playlists.php', 'time_format': '%a %b %d %H:%M:%S', 'DOM_search': PlaylistDOMSearch(parent_node='.playlist', row_node='tr', cell_node='td'), 'utcoffset': timedelta(hours=-4)},
		 {'name': 'The Giant 101.9 FM', 'url': 'http://radio.giant1019.com/songhistory.asp', 'time_format': '%I:%M:%S %p', 'DOM_search': PlaylistDOMSearch(parent_node='#songhistory', row_node='.itunesdetails', cell_node='.itunestext'), 'utcoffset': timedelta(hours=-3)},
		 {'name': 'The Eagle 103.5 FM', 'url': 'http://radio.eagle1035.com/songhistory.asp', 'time_format': '%I:%M:%S %p', 'DOM_search': PlaylistDOMSearch(parent_node='#songhistory', row_node='.itunesdetails', cell_node='.itunestext'), 'utcoffset': timedelta(hours=-3)}
		]

init()

for site in SITES:
	scrape(site)
	
cleanup()
