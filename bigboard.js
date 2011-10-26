BigBoard = function (containerElement) {
  this.dom = {
    container: $(containerElement),
    title: $('#bigBoardTitle'),
    window: $(window)
  };

  /**
   * @type {Object}
   */
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
    }
  };

  this.grid = null;
  this.site = '';
  this.totalActives = 0;
  this.pages = {};
  this.fetchInterval = null;
};

BigBoard.prototype.initialize = function (apiKey) {
  var self_ = this;
  self_.setGrid();
  self_.site = this.getQueryParamValue('site');

  $.jChartbeat({
    apikey: apiKey,
    host: self_.site
  });

  self_.dom.window.bind('resize', function () {
    self_.setGrid();
    for (var i in this.pages) {
      self_.updateElementDisplay(page)
    }
  });
  self_.dom.container.isotope(this.isotopeConfig);
  self_.fetchDash();
   self_.fetchInterval = setInterval(function () {
     self_.fetchDash.call(self_);
   }, 3000);
};

BigBoard.prototype.getQueryParamValue = function (param) {
  var match = new RegExp('[?&]' + param + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
};

BigBoard.prototype.fetchDash = function () {
  var self_ = this;
  $.jChartbeat.dash(function(dashResponse) {
    $.jChartbeat.toppages(function(topPagesResponse) {
      self_.displayTopPages(dashResponse, topPagesResponse);
    }, {
      v: 2, 
      limit: 50 
    });   
  }, {
    types: 1, 
    magnitudes: 1, 
    skip: 0
  });
};

BigBoard.prototype.displayTopPages = function (dash, topPages) {
  var self_ = this;
  window.pages = self_.pages;
  self_.totalActives = 0;
  self_.dom.title.text(self_.site);

  var newPages = {};
  $.each(topPages.pages, function (i, page) {
    if (self_.isNotHomepage(page.path)) {
      self_.totalActives += page.stats.people;
    }
  });

  $.each(topPages.pages, function (i, page) {
    if (self_.isNotHomepage(page.path)) {
      newPages[page.path] = page;
      newPages[page.path]['mag'] = self_.getHighestMagnitude(self_.getMagnitude(dash, page.path));
      
      if (self_.pages[page.path]) {
        newPages[page.path]['pageElement'] = self_.pages[page.path]['pageElement'];
        newPages[page.path]['inserted'] = true;
        newPages[page.path]['pageElement'].find('.weight').text(page.stats.people);
        self_.updateElementDisplay(newPages[page.path]);
        delete self_.pages[page.path];
      } else {
        newPages[page.path].pageElement = self_.createPageElement(page);
        newPages[page.path]['inserted'] = false;
      }
    }
  });

  for (var i in this.pages) {
    var page = this.pages[i];
    self_.dom.container.isotope('remove', page.pageElement);
  }

  this.pages = newPages;

  self_.draw();
};

BigBoard.prototype.updateElementDisplay = function (page) {
  var pageEl = page.pageElement;
  var size = this.calculateSize(page.stats.people);
  pageEl.css({
    'width': size.w,
    'height': size.h
  });
  pageEl.find('h3.weight').css({'font-size' :  size.afs + 'em'});
  pageEl.find('p.number').css({'font-size' :  size.pfs + 'em'});
  pageEl.find('h3.symbol').css({'font-size' :  size.fs + 'em'});
  console.log(pageEl.attr('class', 'element ' + page.mag.src + ' isotope-item'));
};

BigBoard.prototype.createPageElement = function (page) {
  var size = this.calculateSize(page.stats.people);
  var section = this.getSection(page.sections);
  var newEl = [
    '<div class="element ', page.mag.src, '" style="width: ', size.w, 'px; height: ', size.h, 'px;">',
      '<p class="number" style="font-size: ', size.pfs, 'em;">', section, '</p>',
      '<h3 class="weight" style="font-size: ', size.afs, 'em;">',
        page.stats.people,
      '</h3>',
      '<a href="http://', page.path, '" target="_blank">',
        '<h3 class="symbol" style="font-size: ', size.fs, 'em;">', page.title, '</h3>',
      '</a>',
      '<h2 class="name">', page.mag.src, page.mag.cls, '</h2>',
    '</div>'
  ].join('');

  return $(newEl);
};

BigBoard.prototype.setGrid = function () {
  var vGrid = (this.dom.window.height() - 36) / 45;
  var hGrid = this.dom.window.width() / 80;
  this.grid = vGrid * hGrid * 0.9;
};

BigBoard.prototype.isNotHomepage = function (path) {
  // This could be done better
  return path !== '/' && 
         path !== this.site && 
         path !== this.site + '/' && 
         path !== "/home-page" && 
         path !== "global.nytimes.com/" && 
         path !== "time.com/time/" && 
         path !== "blog.gawker.com/";
};

BigBoard.prototype.getMagnitude = function (dash, path) {
  return dash && dash.magnitudes && dash.magnitudes[path] ? dash.magnitudes[path] : 'N/A';
};

BigBoard.prototype.getHighestMagnitude = function (magObj) {
  var newMagObj = {};
	newMagObj.cls = 0;
	newMagObj.src = 'na';
	$.each(magObj, function(src, cls) { 
		if (cls >= newMagObj.cls && src != 'people') {
			newMagObj.cls = cls;
			newMagObj.src = src;
		}
	});
	newMagObj.people = magObj.people;
	return newMagObj;
};

BigBoard.prototype.draw = function () {
  for (var i in this.pages) {
    if (!this.pages[i].inserted) {
      this.dom.container.isotope('insert', this.pages[i].pageElement);
    }
  }
  this.dom.container.isotope('updateSortData', $('.element'));
  $('#container').isotope({ sortBy : 'weight', sortAscending : false });
  this.dom.container.isotope('reLayout');
};

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
  return sections && sections[0] ? sections[0] : '';
};