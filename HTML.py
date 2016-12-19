#!/usr/bin/python

"""
Simple HTML module for generating pages
Author: Andy Deveaux
Last Updated: 19/12/2016
"""

class HTMLDocument:
	def __init__(self, title='', doc_type='html'):
		self.docType = doc_type
		self.__root = HTMLRootElement()
		self.__title = HTMLElement.title(title)
		self.__root.head.appendChild(self.__title)
	
	@property
	def title(self):
		return self.__title.innerText
	@title.setter
	def title(self, title):
		self.__title.innerText = title
	
	@property
	def docType(self):
		if self.__isXHTML:
			return 'xhtml'
		else:
			return 'html'
	@docType.setter
	def docType(self, doc_type):
		if type(doc_type) is not str:
			raise TypeError('Document type needs to a string')
		doc_type = doc_type.lower()
		if doc_type == 'html':
			self.__isXHTML = False
		elif doc_type == 'xhtml':
			self.__isXHTML = True				
		else:
			raise ValueError('Invalid value for document type. Must be a value of either "html" or "xhtml"')
	
	@property
	def head(self):
		return self.__root.head
		
	@property
	def body(self):
		return self.__root.body
		
	def createElement(tag, id=None, class_name=None):
		if type(tag) is not str:
			raise TypeError('Tag must be a string')
		
		tag = tag.lower()
		if tag == 'table':
			e = HTMLTableElement()
		else:
			e = HTMLElement(tag)
			
		if type(id) is str:
			e.id = id
		if type(class_name) is str:
			e.className = class_name
		return e
	
	def addMetaTag(self, attributes):
		attrib_type = type(attributes)
		if attrib_type is not list and attrib_type is not tuple:
			raise TypeError('Attributes must be a list of tuples or a single tuple')
		e = HTMLDocument.createElement('meta')
		if attrib_type is list:
			for key, value in attributes:
				e.setAttribute(key, value)
		else:
			e.setAttribute(attributes[0], attributes[1])
		self.head.appendChild(e)
		return e
	
	def addStylesheet(self, href):
		if type(href) is not str:
			raise TypeError('Stylesheet href must be a string')
		e = HTMLElement('link')
		e.setAttribute('type', 'text/css')
		e.setAttribute('rel', 'stylesheet')
		e.setAttribute('href', href)
		self.head.appendChild(e)
		return e
	
	def addScript(self, src):
		if type(src) is not str:
			raise TypeError('Script src must be a string')
		e = HTMLElement('script')
		e.setAttribute('type', 'text/javascript')
		e.setAttribute('src', src)
		self.head.appendChild(e)
		return e
	
	def getSource(self):
		source = '<!DOCTYPE html'
		if self.__isXHTML:
			source += ' PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n'
			source += '<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">\n'
		else:
			source += '>\n'
			source += '<html lang="en">\n'
		source += self.__getSource(self.__root.childNodes, 1)
		source += '</html>'
		return source
	
	def __getSource(self, nodeList, indent_level=0):
		source = ''
		for node in nodeList:
			if isinstance(node, TextNode):
				source += str.format('{0}{1}\n', '\t'*indent_level, node.text)
				continue
			
			source += str.format('{0}<{1}', '\t'*indent_level, node.tag)
			for key, value in node.attributes:
				source += str.format(' {0}="{1}"', key, value)
			
			self_closing_tag = False
			if node.getNumOfChildNodes() <= 0:
				for t in HTMLElement.SELF_CLOSING_TAGS:
					if node.tag == t:
						self_closing_tag = True
						if self.__isXHTML:
							source += '/>\n'
						else:
							source += '>\n'
						break
			
			if not self_closing_tag:
				source += '>\n'
				indent_level += 1
				source += self.__getSource(node.childNodes, indent_level)
				indent_level -= 1
				source += str.format("{0}</{1}>\n", '\t'*indent_level, node.tag)
		return source

class HTMLElement:
	SELF_CLOSING_TAGS = ['area', 'meta', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'param', 'source', 'track', 'wbr']
	def __init__(self, tag):
		if type(tag) is not str:
			raise TypeError('Tag has to be a string')
		self.__tag = tag.lower()
		self.__attributes = []		# List of tuples (key, value)
		self.__parent = None
		self.__children = []		# HTML nodes
		self.__childNodes = []		# HTML nodes and text nodes
		
	@property
	def tag(self):
		return self.__tag
	
	@property
	def id(self):
		return self.__attributes.get('id')		
	@id.setter
	def id(self, id):
		if type(id) is not str:
			raise TypeError('id must be a string')
		self.__attributes['id'] = id
		
	@property
	def className(self):
		return self.__attributes.get('className')			
	@className.setter
	def className(self, class_name):
		if type(id) is not str:
			raise TypeError('Class name must be a string')
		self.__attributes['class'] = class_name
	
	@property
	def attributes(self):
		return self.__attributes.copy()		# Don't give access to the original
		
	@property
	def innerText(self):
		text = ''
		for node in self.__childNodes:
			if isinstance(node, TextNode):
				text += node.text
		return text
	@innerText.setter
	def innerText(self, inner_text):
		for node in self.__childNodes:
			if isinstance(node, TextNode):
				self.removeChild(node)
		self.appendChild(TextNode(inner_text))
	
	@property
	def parent(self):
		return self.__parent
	@parent.setter
	def parent(self, parent):
		if parent.hasChild(self):
			self.__parent = parent
		else:
			raise HTMLChildParentError('Element is not a child of parent')
	
	@property
	def children(self):
		return self.__children.copy()		# Return a copy so that the original can't be messed with
	
	@property
	def childNodes(self):
		return self.__childNodes.copy()
	
	def getAttribute(self, name):
		if type(name) is not str:
			raise TypeError('Attribute name msut be a string')
		for key, value in self.__attributes:
			if key == name:
				return value
		return None
	
	def setAttribute(self, name, value):
		if type(name) is not str:
			raise TypeError('Attribute name must be a string')
		
		if value is not None:
			self.__attributes.append((name, str(value)))
		# Remove attribute
		else:
			for attrib in self.__attributes:
				if attrib[0] == name:
					self.__attributes.remove(attrib)
					break
		
	def getAttribute(self, name):
		if type(name) is not str:
			raise TypeError('Attribute name must be a string')
		return self.__attributes.get(name)
	
	def getNumOfChildNodes(self):
		return len(self.__childNodes)
	
	def appendChild(self, child):
		if isinstance(child, HTMLElement):
			if self.__children.count(child) <= 0:
				self.__children.append(child)
				self.__childNodes.append(child)
		elif isinstance(child, TextNode):
			if self.__childNodes.count(child) <= 0:
				self.__childNodes.append(child)
		else:
			raise TypeError('Child is not an instance of HTMLElement or TextNode')
		child.parent = self
	
	def insertBefore(self, child, existing_child=None):
		if self.hasChild(child):
			if isinstance(child, HTMLElement):
				self.__children.remove(child)
				self.__childNodes.remove(child)
			elif isinstance(child, TextNode):
				self.__childNodes.remove(child)
		
		child.parent = self
		if existing_child is None or not self.hasChild(existing_child):
			self.appendChild(child)
		else:
			if isinstance(child, HTMLElement):
				self.__children.insert(self.__children.index(existing_child), child)
				self.__childNodes.insert(self.__childNodes.index(existing_child), child)
			elif isinstance(child, TextNode):
				self.__childNodes.insert(self.__childNodes.index(existing_child), child)
	
	def insertAfter(self, child, existing_child=None):
		if self.hasChild(child):
			self.removeChild(child)
		
		child.parent = self
		if existing_child is None or not self.hasChild(existing_child):
			self.appendChild(child)
		else:
			c_index = self.__children.index(existing_child) + 1
			cn_index = self.__childNodes.index(existing_child) + 1
			if isinstance(child, HTMLElement):
				self.__children.insert(c_index, child)
				self.__childNodes.insert(cn_index, child)
			elif isinstance(child, TextNode):
				self.__childNodes.insert(cn_index, child)
	
	def removeChild(self, child):
		if self.__children.count(child) <= 0:
			raise ValueError('Child element not found')
		child.parent = None
		self.__children.remove(child)
		self.__childNodes.remove(child)
		return child			
	
	def hasChild(self, child):
		if self.__children.count(child) > 0 or self.__childNodes.count(child) > 0:
			return True
		return False

	# HTML helper methods
	def title(inner_text=''):
		e = HTMLDocument.createElement('title')
		e.innerText = inner_text
		return e
	
	def meta(attributes):
		if type(attributes) is not dict:
			raise TypeError('Attributes must be a dictionary')
		e = HTMLDocument.createElement('meta')
		for key,value in attributes.items():
			e.attributes[key] = value
		return e
	
	def h1(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('h1', id, class_name)
		e.innerText = inner_text
		return e
		
	def h2(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('h2', id, class_name)
		e.innerText = inner_text
		return e
		
	def h3(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('h3', id, class_name)
		e.innerText = inner_text
		return e
	
	def h4(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('h4', id, class_name)
		e.innerText = inner_text
		return e
	
	def h5(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('h5', id, class_name)
		e.innerText = inner_text			
		return e
	
	def p(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('p', id, class_name)
		e.innerText = inner_text
		return e
		
	def a(src, inner_text='', id=None, class_name=None):
		if type(src) is not str:
			raise TypeError('Source must be a string')
		e = HTMLDocument.createElement('a', id, class_name)
		e.setAttribute('src', src)
		e.innerText = inner_text
		return e
	
	def table(id=None, class_name=None):
		return HTMLDocument.createElement('table', id, class_name)
	
	def tr(id=None, class_name=None):
		return HTMLDocument.createElement('tr', id, class_name)
	
	def th(id=None, class_name=None):
		return HTMLDocument.createElement('th', id, class_name)
		
	def td(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('td', id, class_name)
		e.innerText = inner_text
		return e
	
	def ol(id=None, class_name=None):
		return HTMLDocument.createElement('ol', id, class_name)
	
	def ul(id=None, class_name=None):
		return HTMLDocument.createElement('ul', id, class_name)
	
	def li(inner_text='', id=None, class_name=None):
		e = HTMLDocument.createElement('id', id, class_name)
		e.innerText = inner_text
		return e

class HTMLRootElement(HTMLElement):
	def __init__(self):
		super().__init__('html')
		self.__head = HTMLElement('head')
		self.appendChild(self.__head)
		self.__body = HTMLElement('body')
		self.appendChild(self.__body)
		
	@property
	def head(self):
		return self.__head

	@property
	def body(self):
		return self.__body

class HTMLTableElement(HTMLElement):
	def __init__(self):
		super().__init__()
		self.__tHead = HTMLElement('thead')
		self.__tBody = HTMLElement('tbody')
		self.appendChild(self.__tHead)
		self.appendChild(self.__tBody)
	
	@property
	def tHead(self):
		return self.__tHead
	@tHead.setter
	def tHead(self, thead):
		if thead.tag != 'thead':
			raise TypeError("Table heads can only be 'thead' elements")
		self.removeChild(self.__tHead)
		self.__tHead = thead
		self.insertBefore(thead, self.__tBody)
	
	@property
	def tBody(self):
		return self.__tBody
	@tBody.setter
	def tBody(self, tbody):
		if tbody.tag != 'tbody':
			raise TypeError("Table bodies can only be 'tbody' elements")
		self.removeChild(self.__tBody)
		self.__tBody = tbody
		self.insertAfter(tbody, self.__tHead)
	
	# HTML helper methods
	def tr(self, id=None, class_name=None):
		row = HTMLDocument.createElement('tr', id, class_name)
		return row

class TextNode:
	def __init__(self, text=''):
		self.text = text
		self.__parent = None
	
	@property
	def text(self):
		return self.__text
	@text.setter
	def text(self, value):
		if type(value) is not str:
			raise TypeError('Text can only be a string')
		self.__text = value
	
	@property
	def parent(self):
		return self.__parent
	@parent.setter
	def parent(self, parent):
		if not isinstance(parent, HTMLElement):
			raise HTMLChildParentError('Text node can only have an HTML parent')
		
class HTMLChildParentError(Exception):
	pass
