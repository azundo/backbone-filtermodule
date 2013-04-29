
var FilterModule = {}

// model for a filter control
FilterModule.FilterModel = Model.extend({
  defaults: {
    /* required properties when the model */
    name: "",
    choices: [],
    /* optional properties */
    defaultState: 'all',
    state: ""
  },
  initialize: function (attributes) {
    if (!attributes.state) {
      this.set('state', this.defaultState);
    }
  },
  // override backbone sync function to a no op since
  // we are not saving state remotely
  sync: function() {
    return true;
  }
});

// collection of filter controls
FilterModule.FilterCollection = Collection.extend({
  model: FilterModule.FilterModel,
  initialize: function (options) {
    // use a custom change function if supplied
    // otherwise broadcast a global Backbone event
    if (options && options.onChange ) {
      this.on('change', options.onChange, this)
    } else {
      this.on('change', function () {
        Backbone.trigger('change:filter', this);
      }, this);
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
FilterModule.FilterView = View.extend({
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
 * Collection should be full of Models that have an isActive function taking an
 * object with keys: filterName, values: filterValue
 * SubView needs a showing() method to determine whether or not it is currently visible
 */

FilterModule.BaseFilteredListView = View.extend({
  // el: "#your-el-here",
  // SubView: YourSubViewClassHere,
  // render: function () { add render function },
  // onExit: function (exitingItem) { function to deal with exiting items, should return promises. }
  // onUpdate: function (updatingItem) { function to deal with updating items, should return promises. }
  // onEnter: function (enteringItem) { function to deal with entering items, should return promises. }
  initialize: function (options) {
    this.subviews = {};
    // pass in filter models explicitly as a collection
    if (options && options.filterCollection) {
      this.listenTo(options.filterCollection, 'change', this._filter);
    // listen to the change:filter event on the global Backbone bus
    } else {
      this.listenTo(Backbone, 'change:filter', this._filter);
    }
    this.listenTo(options.collection, 'reset', this._load, this);

    // hook for subclass initialization
    if (this.onInit) {
      this.onInit();
    }
  },

  _getItemStatuses: function (filterVals) {
    var exiting = [],
      updating = [],
      entering = [],
      idx = 0;
    this.collection.each(function (listItem) {
      var subView = this.subviews[listItem.id];
      if (subView.showing() && !listItem.isActive(filterVals)) {
        subView.filteredIdx = null;
        exiting.push(subView);
      } else if (listItem.isActive(filterVals)) {
        subView.filteredIdx = idx;
        if (subView.showing()) {
          // update active items if they are already showing
          updating.push(subView);
        } else {
          // have them enter otherwise
          entering.push(subView);
        }
        idx++;
      }
    }, this);
    return [exiting, updating, entering];
  },

  _filter: function(filterCollection) {
    var that = this,
    filterVals = filterCollection.getFilterValues(),
    // get updated statuses
    statuses = this._getItemStatuses(filterVals),
    exiting = statuses[0],
    updating = statuses[1],
    entering = statuses[2],
    exitingPromises;
    // exit immediately
    exitingPromises = _.map(exiting, function (toExit) {
      return this.onExit(toExit);
    }, this);
    // start updating immediately
    _.each(updating, function (toUpdate) {
      this.onUpdate(toUpdate);
    }, this);
    // wait until everything has exited before entering others
    $.when.apply($, exitingPromises).done(function () {
      _.each(entering, function (toEnter) {
        this.onEnter(toEnter);
      }, that);
    });
  },

  _load: function () {
    var that = this;
    // if we are reloading the collection make sure to
    // kill off all existing subviews
    for (var subView in this.subviews) {
      this.subviews[subView].remove();
    }
    this.subviews = [];
    this.collection.each(function(listItem) {
      var subView = new this.SubView(
        { model: listItem, 
          parentView: this
        }).render();
      this.subviews[listItem.id] = subView;
      subView.$el.appendTo(this.$el);
    }, this);
    if (this.onCollectionLoad) {
      this.onCollectionLoad();
    }
  }
});

/* 
 * A concrete example of a BaseFilteredListView.
 * This implementation uses absolute positioning to simply put subview items
 * into rows.
 */
FilterModule.FilteredListView = BaseFilteredListView.extend({
  el: '#filtered-list',

  SubView: FilterModule.FilteredListItemView,

  onCollectionLoad: function () {
    // set width properties
    var first = this.collection.at(0);
    if (first) {
      var subView = this.subviews[first.id];
      this.itemWidth = subView.$el.outerWidth(true);
      this.itemHeight = subView.$el.outerHeight(true);
      this.rowLength = parseInt(this.rowWidth / this.itemWidth, 10);
    }
  },

  onInit: function () {
    // set row width for positioning
    this.rowWidth = this.$el.width();
  },

  _getPosition : function (subView) {
    var row = parseInt(subView.filteredIdx / this.rowLength, 10),
    top = row * this.itemHeight,
    left = (subView.filteredIdx % this.rowLength) * this.itemWidth;
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

  render: function () {
    return this;
  }
});

/*
 * Example of a FilteredListItemView. Render still a no-op.
 */
FilterModule.FilteredListItemView = View.extend({
  showing: function () {
    return this.$el.is(":visible");
  },

  render: function () {
    return this;
  }
});

if (module && module.exports) {
  module.exports = FilterModule;
}
