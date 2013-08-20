backbone-filtermodule
=====================

A reusable module to for filtering collections within a view.

##Example

See it in action at
[http://azundo.github.io/backbone-filtermodule/examples/shapes.html](http://azundo.github.io/backbone-filtermodule/examples/shapes.html).

##Dependencies

Requires BackboneJS >= 0.9.9.

##Usage

Backbone filtermodule contains several components making up a filtered view.  Each filter control has a model for storing state and a view for interacting
with the filter. There is a container view which holds the collection to be
filtered, and each model in the collection also has a view. The container view
listens to changes on the filters and updates the subview of each item
accordingly.

###Step By Step

See the shapes example in the examples/ directory for a working example.

1. Create filters and add them to a collection.
    ```javascript
    var genreFilterModel = new Backbone.FilterModule.FilterModel({
            name: 'genre',
            choices: [
                {value: 'mystery', text: 'Mystery'},
                {value: 'romance', text: 'Romance'},
                {value: 'thriller', text: 'Thriller'},
                {value: 'biography', text: 'Biography'}
            ]
        });
    var authorFilterModel = new Backbone.FilterModule.FilterModel({
        ...
    });

    var filterCollection = new Backbone.FilterModule.FilterCollection([
            genreFilterModel, authorFilterModel]);
    ```

2. Create views for each filter control and render them, supplying a template.
    ```javascript
    var genreFilterView = new Backbone.FilterModule.FilterView({
            model: genreFilterModel,
            template: _.template($('#genre-filter-template').text()),
            el: '#genre-filter'}).render();
    var authorFilterView = new Backbone.FilterModule.FilterView({
            model: authorFilterModel,
            template: _.template($('#author-filter-template').text()),
            el: '#author-filter'}).render();
    ```
3. Create a collection of items to be filtered on
    ```javascript
    var bookCollection = new Backbone.Collection([
        {
            genre: 'thriller',
            author: 'King, Stephen'
        },
        {
            genre: 'mystery,
            author: ...
        }
    ]);
    ```

4. Create View classes for your list items and item list.
    ```javascript
    var MyItemView = Backbone.View.extend({
        template: _.template($('#item-view').text()),
        render: function () {
            this.$el.html(this.template(this.toJSON));
            return this;
        }
    });
    var MyFilteredListView = Backbone.FilterModule.FilteredListView.extend({
        ItemView: MyItemView
    });
    ```

5. Create and render the filteredListView with your filter collection and item collection
    ```javascript
    var filteredListView = new FilteredListView({
        el: '#filter-el',
        collection: bookCollection,
        filterCollection: filterCollection
    }).render();
    ```

6. Reset the item collection to get things going.
    ```javascript
    filterCollection.trigger('reset');
    ```
    Will respond to resetting the item collection, adding or removing items from the collection or modifying the filters.

###Customization

The default implementation of `FilterModule.FilterListView` provides animation
algorithms for entering, updating and leaving items, as well as functions for
evaluating whether or not an item passes the filter tests. You may want to
customize these by overriding any or all of the methods not declared in
`FilterModule.BaseFilterListView`. See the source for more specifics and to see
the reference implementation of `FilterModule.FilterListView`.
