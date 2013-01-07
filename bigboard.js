BigBoard = function (containerElement) {
  this.dom = {
    container: $(containerElement),
    title: $('#bigBoardTitle'),
    header: $('#groupList'),
	groupElement: $('.groupElement'),
	pause: $('#pause'),
    window: $(window)
  };

  this.isotopeConfig = {
    masonry: {
      columnWidth: 10
    },
    itemSelector: '.element',
    itemPositionDataEnabled: true,
    getSortData: {
      weight: function (element) {
        return parseFloat(element.find('.weight').text());
      }
    },
    animationOptions: {
		duration: 5000,
		easing: 'linear',
		queue: 'false'
	}
  };
  
  this.numTopGroups = 10;
  this.counter = this.numTopGroups;
  this.pace = 3;
  this.paceCounter = 1;
  this.lastFetch = '';
  this.grid = null;
  this.host = '';
  this.totalActives = 0;
  this.els = {};
  this.groupArr = [];
  this.fetchInterval = null;
  this.tSourcesBench = {};
  this.paused = false;
};

BigBoard.prototype.initialize = function (a,h) {
  var self_ = this;
  self_.setGrid();
  self_.host = this.getQueryParamValue('host');
  if (!self_.host) self_.host = h;
  self_.apikey = this.getQueryParamValue('apikey');
  if (!self_.apikey) self_.apikey = a;
  s = this.getQueryParamValue('sections');
  if (s && s[0]) {
	self_.sections = s.split(",");
    self_.counter = self_.sections.length;
  }

  self_.dom.title.text(self_.host);

  //click function for hostname
  self_.dom.title.click(function() {
	self_.fetchDash();
	self_.counter = self_.numTopGroups;
  });
	
  //click function for pause button
  self_.dom.pause.click(function() {
	if (!self_.paused) {
		self_.paused = true;
		self_.dom.pause.html("<img src='play.png'>");
	}
	else {
		self_.paused = false;
		self_.dom.pause.html("<img src='pause.png'>");
		self_.paceCounter = 3;
	}	
  });

  $.jChartbeat({
    apikey: self_.apikey,
    host: self_.host
  });

  self_.dom.window.bind('resize', function () {
    self_.setGrid();
    for (var i in this.els) {
      self_.updateElementDisplay(els)
    }
  });

  self_.dom.container.isotope(self_.isotopeConfig);
  
  if (self_.sections) {  // cycle through custom list
	self_.groupArr = self_.sections;
	self_.drawHeader();
  }
  else {  // get list of top sections
	self_.createTopGroupsArr();
  }
  // kick it off with an initial API call then set interval
  self_.fetchQuickstats();
  self_.fetchDash();
  self_.setIntervalFunc();   

};

BigBoard.prototype.setIntervalFunc = function ()  {
	self_ = this;
    
	self_.fetchInterval = setInterval(function () {
		
		// if paused, then keeping the paceCouter at 0 will prevent it from going to the next screen 
		if (self_.paused) self_.paceCounter = 0;
		
		//update top pages for the current section or site
		if (self_.paceCounter < self_.pace) {
			self_[self_.lastFetch](self_.groupArr[self_.counter]);
			self_.paceCounter++;
		}
		//move to next screen
		else {
			// get overall traffic source breakdown for shitty benchmark in lieu of magnitudes
			self_.fetchQuickstats();
			// recreate the top Groups array if not custom list
			//if (!self_.sections) self_.createTopGroupsArr();
			//get top sections
			if (self_.counter == -1) {
				self_.fetchGroups();
				self_.counter++;		  
			}
			//get top pages for the site
			else if ((self_.counter >= self_.groupArr.length) && (self_.groupArr.length != 0)) {
				self_.fetchDash();
				self_.counter = -1;
			}
			//get top pages for a section
			else {
				self_.fetchDash(self_.groupArr[self_.counter]);
				self_.counter++;
			}
			self_.paceCounter = 0;
		}
		
	  }, 5000);
	
}

BigBoard.prototype.getQueryParamValue = function (param) {
  var match = new RegExp('[?&]' + param + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
};

BigBoard.prototype.fetchQuickstats = function () {
	var self_ = this;
	$.jChartbeat.quickstats(function(quickstatsResponse) {
		self_.benchmarkTrafficSources(quickstatsResponse);
	});
}

BigBoard.prototype.fetchDash = function (s) {	 
  var self_ = this;
  $.jChartbeat.toppages(function(topPagesResponse) {
      self_.displayElements(topPagesResponse);
      }, {
        v: 2, 
        limit: 50,
		section: s
      });   
  self_.lastFetch = 'fetchDash';
};

BigBoard.prototype.createTopGroupsArr = function () {
	var self_ = this;
	$.jChartbeat.topgroups(function(g) {
		$.each(g.groups, function (i, g) {
			if(self_.isNotHomesection(g.group))
				self_.groupArr[i] = g.group;
		});
		self_.groupArr = self_.groupArr.slice(0, self_.numTopGroups);
		self_.drawHeader();
	}, {type: "section"});  //hard coded to do just sections for now
}

BigBoard.prototype.fetchGroups = function () {
	var self_ = this;
	$.jChartbeat.topgroups(function(g) {
		self_.displayElements(g);
	}, {type: "section"});  
	self_.lastFetch = 'fetchGroups';
}

BigBoard.prototype.benchmarkTrafficSources = function (qs) {
	var self_ = this;
	self_.tSourcesBench.direct = qs.direct / qs.people;
	self_.tSourcesBench.internal = qs.internal / qs.people;
	self_.tSourcesBench.search = qs.search / qs.people;
	self_.tSourcesBench.social = qs.social / qs.people;
	self_.tSourcesBench.links = qs.links / qs.people;
}

BigBoard.prototype.displayElements = function (topElements) {
	var self_ = this;
	window.els = self_.els;
	self_.totalActives = 0;
	
	var newEls = {};
	if (topElements.pages) {
		$.each(topElements.pages, function (i, page) {
	    if (self_.isNotHomepage(page.path)) {
	      self_.totalActives += page.stats.people;
	    }
	  });
	  $.each(topElements.pages, function (i, page) {
	    if (self_.isNotHomepage(page.path)) {
	      newEls[page.path] = page;
	      newEls[page.path]['mag'] = self_.getHighestTrafficSource(self_.calculateTrafficSources(page));
	      if (self_.els[page.path]) {
	        newEls[page.path]['element'] = self_.els[page.path]['element'];
	        newEls[page.path]['inserted'] = true;
	        newEls[page.path]['element'].find('.weight').text(page.stats.people);
	        self_.updateElementDisplay(newEls[page.path]);
	        delete self_.els[page.path];
	      } else {
	        newEls[page.path].element = self_.createPageElement(page);
	        newEls[page.path]['inserted'] = false;
	      }
	    }
	  });
	}
	 
	if (topElements.groups) {
		$.each(topElements.groups, function (i, group) {
		    self_.totalActives += group.people;
		});	
		$.each(topElements.groups, function (i, group) {
			newEls[group.group] = group;		
			newEls[group.group]['mag'] = self_.getHighestTrafficSource(self_.calculateTrafficSources(group));
			if (self_.els[group.group]) {
				newEls[group.group]['element'] = self_.els[group.group]['element'];
				newEls[group.group]['inserted'] = true;
				newEls[group.group]['element'].find('.weight').text(group.people);
				newEls[group.group]['element'].find('.number').text(group.pages + ' pgs');
				self_.updateElementDisplay(newEls[group.group]);
				delete self_.els[group.group];		
			}
			else {
				newEls[group.group].element = self_.createGroupElement(group);
				newEls[group.group]['inserted'] = false;
			}
		});	
		
		self_.drawHeader();
	}
	
	for (var i in self_.els) {
	    var el = self_.els[i];
	    self_.dom.container.isotope('remove', el.element);
	}

	self_.els = newEls;
	self_.draw();
}

BigBoard.prototype.drawHeader = function () {
	self_ = this;
	var newHeader = "";
	// if there are sections create the list at the top, starting with top sections
	if (self_.groupArr && self_.groupArr.length > 0) {
		newHeader = "<li id='topSections'> top sections </li> ";
		for (var i in self_.groupArr) {
			newHeader += '<li class="groupElement">' + self_.groupArr[i] + '</li>';
		}
		self_.dom.header.html(newHeader);	
		// make these header elements clickable
		$(".groupElement").click(function() {
		  var g = $(this).text();
		  self_.fetchDash(g);
		  self_.counter = self_.groupArr.indexOf(g);
		});
		// make top sections link clickable
		$("#topSections").click(function() {
			self_.fetchGroups();
			self_.counter = 0;
		});
		// add play/pause button
		self_.dom.pause.html("<img src='pause.png'>");
	}
}

BigBoard.prototype.updateElementDisplay = function (el) {
  var pageEl = el.element;
  var size;
  if (el.stats)
	 size = this.calculateSize(el.stats.people);
  else if (el.people)
  	 size = this.calculateSize(el.people);
  
  pageEl.css({
    'width': size.w,
    'height': size.h
  });
  pageEl.find('h3.weight').css({'font-size' :  size.afs + 'em'});
  pageEl.find('p.number').css({'font-size' :  size.pfs + 'em'});
  pageEl.find('h3.symbol').css({'font-size' :  size.fs + 'em'});
  if (el.mag) 
	pageEl.attr('class', 'element ' + el.mag.src + ' isotope-item');
};


BigBoard.prototype.createPageElement = function (page) {
  var size = this.calculateSize(page.stats.people);
  var section = this.getSection(page.sections);
  var url = '';
  if (page.path.search(this.host) == -1) 
	url = this.host + page.path;
  else 
	url = page.path;

  var newEl = [
    '<div class="element ', page.mag.src, '" style="width: ', size.w, 'px; height: ', size.h, 'px;">',
      '<p class="number" style="font-size: ', size.pfs, 'em;">', section, '</p>',
      '<h3 class="weight" style="font-size: ', size.afs, 'em;">',
        page.stats.people,
      '</h3>',
      '<a href="http://', url, '" target="_blank">',
        '<h3 class="symbol" style="font-size: ', size.fs, 'em;">', page.title, '</h3>',
      '</a>',
      '<h2 class="name">', page.mag.src, page.mag.cls, '</h2>',
    '</div>'
  ].join('');

  return $(newEl);
};

BigBoard.prototype.createGroupElement = function (group) {
  var size = this.calculateSize(group.people);

  var newEl = [
    '<div class="element ', group.mag.src, '" style="width: ', size.w, 'px; height: ', size.h, 'px;">',
      '<p class="number" style="font-size: ', size.pfs, 'em;">', group.pages, ' pgs</p>',
      '<h3 class="weight" style="font-size: ', size.afs, 'em;">',
        group.people,
      '</h3>',
        '<h3 class="symbol" style="font-size: ', size.fs, 'em;">', group.group, '</h3>',
      '<h2 class="name">',group.pages,'</h2>',
    '</div>'
  ].join('');

  return $(newEl);
};

BigBoard.prototype.setGrid = function () {
  var vGrid = (this.dom.window.height() - 36) / 45;
  var hGrid = this.dom.window.width() / 80;
  this.grid = vGrid * hGrid * 0.85;
};

BigBoard.prototype.isNotHomepage = function (path) {
  // This could be done better
  return path !== '/' && 
         path !== this.host && 
         path !== this.host + '/' && 
         path !== "online.wsj.com/home-page" && 
         path !== "global.nytimes.com/" && 
         path !== "time.com/time/" && 
		 path !== "nbcnews.com/" && 
		 path !== "washingtonpost.com/regional" && 
         path !== "blog.gawker.com/";
};

BigBoard.prototype.isNotHomesection = function (group) {
	return group !== 'root' &&
			group !== 'espnfrontpage' &&
			group !== 'home' &&
			group !== 'homepage-t' &&
			group !== 'homepage';
}


BigBoard.prototype.calculateTrafficSources = function (obj) {
	var tSources = {};
 	if (obj.group) { //it's a section
		tSources.direct = obj.direct / obj.people;
		tSources.internal = obj.internal / obj.people;
		tSources.search = obj.search / obj.people;
		tSources.social = obj.social / obj.people;
		tSources.links = obj.links / obj.people;
	} 
	else { //it's a page
		tSources.direct = obj.stats.direct / obj.stats.people;
		tSources.internal = obj.stats.internal / obj.stats.people;
		tSources.search = obj.stats.search / obj.stats.people;
		tSources.social = obj.stats.social / obj.stats.people;
		tSources.links = obj.stats.links / obj.stats.people;
	}
  	return tSources;
};

BigBoard.prototype.getHighestTrafficSource = function (tSources) {
    var self_ = this;
	var newTsObj = {};
	newTsObj.cls = 0;
	newTsObj.src = 'na';
	for (var t in tSources) { 
		//where does it exhibit the greatest perentage difference from site avg
		newTsObj[t] = tSources[t] / self_.tSourcesBench[t];
		if (newTsObj[t] > newTsObj.cls) {
			newTsObj.cls = newTsObj[t];
			newTsObj.src = t; 
		}
	}
	return newTsObj;
};

BigBoard.prototype.draw = function () {
 var self_ = this;  
 for (var i in self_.els) {
    if (!self_.els[i].inserted) {
      self_.dom.container.isotope('insert', self_.els[i].element);
    }
  }
  self_.dom.container.isotope('updateSortData', $('.element'));
  $('#container').isotope({ sortBy : 'weight', sortAscending : false });
  self_.dom.container.isotope('reLayout', self_.updateHeader());

};

BigBoard.prototype.updateHeader = function () {	
  self_ = this;

  var findGroups = self_.dom.container.find('p:contains("pgs")');
  var findTopPagesSection = self_.dom.container.find('p:contains("'+ self_.groupArr[self_.counter] +'")')

	$.expr[":"].econtains = function(obj, index, meta, stack){
		return (obj.textContent || obj.innerText || $(obj).text() || "").toLowerCase() == meta[3].toLowerCase();
	}

  if (findTopPagesSection.length > 0) {
    self_.dom.title.css('color','#999');
    self_.dom.header.find('li').css('color','#999');
	self_.dom.header.find('li:contains("top sections")').css('color','#999');
    self_.dom.header.find('li:econtains("'+ self_.groupArr[self_.counter] +'")').css('color','#FFF');
  }
  else if (findGroups.length > (self_.numTopGroups-1)) {
	self_.dom.title.css('color','#999');
    self_.dom.header.find('li').css('color','#999');
	self_.dom.header.find('li:contains("top sections")').css('color','#FFF');
  }
  else if (self_.counter >= self_.groupArr.length) {
	   //make sure the screen isn't still on the last section this is really bad, basically just trying to make sure that the screen isn't full of pages from the last of the top sections
	    var lastSection = self_.dom.container.find('p:contains("'+ self_.groupArr[(self_.counter - 1)] +'")');
		if (lastSection.length < 10) {
      	  self_.dom.header.find('li').css('color','#999');
		  self_.dom.header.find('li:contains("top sections")').css('color','#999');
		  self_.dom.title.css('color','#FFF');	
		}
  }
}

BigBoard.prototype.calculateSize = function (actives) {
  var size = {}; 
  var proportion = actives / this.totalActives;
  var numSquares = proportion * this.grid;
  var w = Math.round(Math.sqrt(numSquares));

  if (w < 1) {
    w = 1;
  }

  size.pfs = (w / 10) * 6.0;
  if (size.pfs > 2) {
    size.pfs = 2;
  } else if (size.pfs < 0.8) {
    size.pfs = 0;
  }

  size.afs = (w / 10) * 4;
  if (size.afs < 2.3) {
    size.afs = 2.3;
  }
  
  size.fs = (w / 10) * 4.3;
  size.h = (w * 45) - 10; 
  size.w = (w * 80) - 10;
  
  return size;
};

BigBoard.prototype.getSection = function (sections) {
  //could return the first section in the list, but problem with that on some sites the top section tag is always 'editorial' or 'politics', not something that matches the section in the header (#groupList)

  //instead must look into the sections array for the one that matches the section in the header (#groupList)
  self_ = this;
  if (sections && sections[0]) {
    var a = sections.indexOf(self_.groupArr[(self_.counter)]);
    return sections[a] ? sections[a] : sections[0];
  }

};
