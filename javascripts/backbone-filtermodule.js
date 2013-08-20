//     Backbone FilterModule 0.1.0

//     (c) 2013 Benjamin Best
//     Backbone FilterModule may be freely distributed under the MIT license.
//     For details and documentation: https://github.com/azundo/backbone-filtermodule
//     

(function(){

var FilterModule;
if (typeof exports !== 'undefined') {
  FilterModule = exports;
} else if (typeof Backbone !== 'undefined') {
  FilterModule = Backbone.FilterModule = {};
}

// model for a filter control
FilterModule.FilterModel = Backbone.Model.extend({
  defaults: {
    /* required properties */
    name: "",
    // choices should be an array of objects with text and value properties
    // [{value: 'mystery', text: 'Mystery'}, {value: 'thriller', text: 'Thriller'}]
    choices: [],
    /* optional properties */
    defaultState: 'all',
    state: ""
  },
  initialize: function (attributes) {
    if (!attributes.state) {
      this.set('state', this.get('defaultState'));
    }
  },
  // override backbone sync function to a no op since
  // we are not saving state remotely
  sync: function() {
    return true;
  }
});

// collection of filter controls
FilterModule.FilterCollection = Backbone.Collection.extend({
  model: FilterModule.FilterModel,
  initialize: function (options) {
    // use a custom change function if supplied
    if (options && options.onChange ) {
      this.on('change', options.onChange, this)
    }
  },
  getFilterValues: function () {
    var vals = {};
    this.each(function(filter) {
      vals[filter.get('name')] = filter.get('state');
    });
    return vals;
  }
});

// filter control view
FilterModule.FilterView = Backbone.View.extend({
  // pass in a template or SubClass FilterView
  // template: require('./templates/filter'),

  // default events to handle li-based filters
  // and drop-downs. Override for other behaviour
  events: {
    'click li': 'onClick',
    'change select': 'onChange'
  },
  initialize: function(options) {
    if (options && options.template) {
      this.template = options.template;
    }
  },
  onClick: function(e) {
    e.preventDefault();
    var liTarget = $(e.currentTarget);
    var newState = liTarget.data('filter-value');
    if (newState !== this.model.get('state')) {
      this.$el.find('li').removeClass('active');
      liTarget.addClass('active');
      this.model.set('state', newState);
      this.model.save();
    }
    return false;
  },
  onChange: function(e) {
    e.preventDefault();
    var newState = e.currentTarget.value;
    if (newState !== this.model.get('state')) {
      this.model.set('state', newState);
      this.model.save();
    }
    return false;
  },
  // override for your template setup
  render: function () {
    this.$el.html(this.template({
      choices: this.model.get('choices'),
      state: this.model.get('state')
    }));
    return this;
  }
});

/*
 * A generic class for a FilteredList
 * Requirements:
 * Implement methods below
 */

FilterModule.BaseFilteredListView = Backbone.View.extend({
  // el: "#your-el-here",
  // ItemView: YourItemViewClassHere,
  // render: function () { add render function },
  // onExit: function (exitingItem) { function to deal with exiting items, should return promises. }
  // onUpdate: function (updatingItem) { function to deal with updating items, should return promises. }
  // onEnter: function (enteringItem) { function to deal with entering items, should return promises. }
  // itemIsShowing: function (itemView) { function to determine if itemView is showing or not. }
  // itemIsActive: function (item, filterVals) { function to determine if an item should be filtered out or not. }
  initialize: function (options) {
    this.itemViews = {};
    // pass in filter models explicitly as a collection
    this.filterCollection = options.filterCollection;

    // collection reset
    this.listenTo(options.collection, 'reset', this._load, this);

    // collection modification
    this.listenTo(options.filterCollection, 'change', this._filter);

    // manage adding and destroying itemView as well
    this.listenTo(options.collection, 'add', this._add, this);
    this.listenTo(options.collection, 'remove', this._remove, this);

    // hook for subclass initialization
    if (this.onInit) {
      this.onInit();
    }
  },

  /* _getItemStatuses returns an object of arrays holding itemView instances keyed by status.
   * Also attaches a filteredIdx to each itemView for animation algorithms to make use of.
   */
  _getItemStatuses: function (filterVals) {
    var statuses = {
        exiting: [],
        updating: [],
        entering: []
      },
      idx = 0;
    this.collection.each(function (listItem) {
      var itemView = this.itemViews[listItem.cid],
        isShowing = this.itemIsShowing(itemView),
        isActive = this.itemIsActive(listItem, filterVals);
      if (isShowing && !isActive) {
        itemView.filteredIdx = null;
        statuses.exiting.push(itemView);
      } else if (isActive) {
        itemView.filteredIdx = idx;
        idx++;
        if (isShowing) {
          // update active items if they are already showing
          statuses.updating.push(itemView);
        } else {
          // have them enter otherwise
          statuses.entering.push(itemView);
        }
      }
    }, this);
    return statuses;
  },

  _filter: function() {
    var that = this,
      filterVals = this.filterCollection.getFilterValues(),
      // get updated statuses
      statuses = this._getItemStatuses(filterVals),
      exitingPromises;
    // exit immediately
    exitingPromises = _.map(statuses.exiting, function (toExit) {
      return this.onExit(toExit);
    }, this);
    // start updating immediately
    _.each(statuses.updating, function (toUpdate) {
      this.onUpdate(toUpdate);
    }, this);
    // wait until everything has exited before entering others
    $.when.apply($, exitingPromises).done(function () {
      _.each(statuses.entering, function (toEnter) {
        this.onEnter(toEnter);
      }, that);
    });
  },

  _createItemView: function (item) {
    var itemView = new this.ItemView({
      model: item,
      parentView: this
    }).render();
    this.itemViews[item.cid] = itemView;
    itemView.$el.appendTo(this.$el);
    return itemView;
  },
  _add: function (newItem) {
    this._createItemView(newItem);
    this._filter();
  },
  _remove: function (item) {
    this.itemViews[item.cid].remove();
    delete this.itemViews[item.cid];
    this._filter();
  },
  _load: function () {
    var that = this;
    // if we are reloading the collection make sure to
    // kill off all existing itemViews
    for (var itemView in this.itemViews) {
      this.itemViews[itemView].remove();
    }
    this.itemViews = [];
    this.collection.each(function(listItem) {
      this._createItemView(listItem);
    }, this);
    if (this.onCollectionLoad) {
      this.onCollectionLoad();
    }
    this._filter();
  }
});

/* 
 * A concrete example of a BaseFilteredListView.
 * This implementation uses absolute positioning to simply put subview items
 * into rows.
 */
FilterModule.FilteredListView = FilterModule.BaseFilteredListView.extend({
  el: '#filtered-list',

  ItemView: FilterModule.FilteredListItemView,

  onCollectionLoad: function () {
    // set width properties
    var first = this.collection.at(0);
    if (first) {
      var itemView = this.itemViews[first.cid];
      this.itemWidth = itemView.$el.outerWidth(true);
      this.itemHeight = itemView.$el.outerHeight(true);
      this.rowLength = parseInt(this.rowWidth / this.itemWidth, 10);
    }
  },

  onInit: function () {
    // set row width for positioning
    this.rowWidth = this.$el.width();
  },

  _getPosition : function (itemView) {
    var row = parseInt(itemView.filteredIdx / this.rowLength, 10),
    top = row * this.itemHeight,
    left = (itemView.filteredIdx % this.rowLength) * this.itemWidth;
    return {top: top, left: left};
  },

  onExit: function (toExit) {
    // simple fade out
    return toExit.$el.fadeOut(500).promise();
  },

  onEnter: function (toEnter) {
    // position and fade in
    var position = this._getPosition(toEnter);
    return toEnter.$el.css('top', position.top + 'px')
      .css('left', position.left + 'px')
      .fadeIn(500)
      .promise();
  },

  onUpdate: function (toUpdate) {
    // animate to new position
    var position = this._getPosition(toUpdate);
    return toUpdate.$el
      .animate({top: position.top + 'px', left: position.left + 'px'}, 1000)
      .promise();
  },
  itemIsShowing: function (itemView) {
    return itemView.$el.is(":visible");
  },
  itemIsActive: function (item, filterVals) {
    for (var filterName in filterVals) {
      if (item.has(filterName) && filterVals[filterName] !== 'all' && item.get(filterName) !== filterVals[filterName]) {
        return false;
      }
    }
    return true;
  },
  render: function () {
    return this;
  }
});

}).call(this);
