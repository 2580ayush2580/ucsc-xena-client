/*jslint browser: true, nomen: true */
/*globals define: false, $: false, _: false */
define(['haml!haml/sheetWrap',
		'stub',
		'cohortSelect',
		'columnEdit',
		'columnUi',
		'datasetSelect',
		'defaultTextInput',
		'uuid',
		'underscore_ext',
		'jquery',
		'xenaQuery',
		'rx.jquery',
		'rx.binding'
		], function (template,
					stub,
					cohortSelect,
					columnEdit,
					columnUi,
					datasetSelect,
					defaultTextInput,
					uuid,
					_,
					$,
					xenaQuery,
					Rx) {

	"use strict";

		// constants for all columns:
	var horizontalMargin = 3,
		sparseRadius = horizontalMargin * 2,
		sparsePad = sparseRadius + 1,
		headerPlotHeight = 12,
		defaultServers = [
			{
				title: 'localhost',
				url: 'http://localhost:7222'
			},
			{
				title: 'tcga1:1236',
				url: 'http://tcga1:1236'
			},
			{
				title: 'genome-cancer.ucsc.edu',
				url: stub.getDEV_URL() // TODO only for dev
			}
		],
		map = _.map,
		widget,
		aWidget;

	// TODO copied from main.js
	function deleteColumn(uuid, upd, state) {
		var cols = _.dissoc(upd.get_in(state, ['column_rendering']), uuid),
			order = _.without(upd.get_in(state, ['column_order']), uuid);
		return upd.assoc_in(
			upd.assoc_in(state, ['column_order'], order),
			['column_rendering'],
			cols
		);
	}

	function setSamples(samples, upd, state) {
		return upd.assoc(state,
						 'samples', samples,
						 'zoomCount', samples.length,
						 'zoomIndex', 0);
	}

	aWidget = {

		deleteColumn: function (id) {
			return this.cursor.set(_.partial(deleteColumn, id));
		},

		duplicateColumn: function (id) {
			console.log('sheetWrap:duplicateColumn()');
		},

		addColumnClick: function (ev) {
			var id = uuid();
			columnEdit.show(id, {
				sheetWrap: this,
				columnUi: undefined,
				updateColumn: this.updateColumn // XXX ugh
			});
		},

		cohortChange: function () {
			columnEdit.destroyAll();
			this.$addColumn.show().click();
		},

		serversInput: function () {
			return _.map(this.servers, function (s) {
				return s.title;
			}).join(', ');
		},

		getDefServersInput: function () {
			return Rx.Observable.return(_.map(defaultServers, function (s) {
				return s.title;
			}).join(', '));
		},

		serversInputChanged: function () {
			var inputArray = map(this.$servers.val().split(','), function (s) {
				return s.trim();
			});
			this.servers = map(inputArray, function (s) {
				var url = 'http://' + s + ((s.indexOf(':') > -1) ? '' : ':7222');
				if (s === 'genome-cancer.ucsc.edu' || s === 'genome-cancer.ucsc.edu:7222') {
					url = stub.getDEV_URL(); // TODO only for dev !
				}
				return {
					title: s,
					url: url
				};
			});
		},

		initCohortsAndSources: function () {
			var self = this,
				cohortState = this.state.pluck('cohort').distinctUntilChanged().share();

			this.serversInput = defaultTextInput.create('serversInput', {
				$el: this.$servers,
				getDefault: this.getDefServersInput,
				focusOutChanged: this.serversInputChanged
			});

			this.cohortSelect = cohortSelect.create('cohortSelect', {
				$anchor: this.$cohortAnchor,
				state: cohortState,
				cursor: this.cursor,
				servers: this.servers
			});
			this.cohort = this.cohortSelect.val;

			this.sources = cohortState.map(function (cohort) { // state driven?
				return xenaQuery.dataset_list(self.servers, cohort);
			}).switch().map(function (dataset_lists) {
				return _.map(dataset_lists, function (l, i) {
					return _.assoc(self.servers[i], 'datasets', l);
				});
			}).replay(null, 1);
			this.sources.connect(); // XXX leaking subscription

			// retrieve all samples in this cohort
			this.cohort.map(function (cohort) {
				return Rx.Observable.zipArray(_.map(self.servers, function (s) {
					return xenaQuery.all_samples(s.url, cohort);
				})).map(_.apply(_.union));
			}).switch().subscribe(function (samples) {
				self.cursor.set(_.partial(setSamples, samples));
			});

			// when cohort DOM value changes, update other parts of the UI
			this.cohortSelect.val.subscribe(this.cohortChange);
		},

		initSamplesFrom: function () {
			var self = this,
				samplesFromState = this.state.pluck('samplesFrom').distinctUntilChanged().share();

			this.samplesFrom = datasetSelect.create('samplesFrom', {
				$anchor: this.$samplesFromAnchor,
				state: samplesFromState,
				cohort: this.cohort,
				servers: this.servers,
				cursor: this.cursor,
				sheetWrap: this,
				sources: this.sources,
				placeholder: 'All datasets'
			});

		},

		initialize: function (options) {
			var self = this,
				column_orderState;
			_.bindAll.apply(_, [this].concat(_.functions(this)));
			//_(this).bindAll();
			this.updateColumn = options.updateColumn; // XXX
			this.state = options.state;
			this.cursor = options.cursor;

			this.servers = defaultServers; // TODO make servers dynamic from state
			this.$el = $(template({
				servers: this.serversInput()
			}));
			options.$anchor.append(this.$el);

			// cache jquery objects for active DOM elements
			this.cache = ['cohortAnchor', 'samplesFromAnchor', 'servers', 'addColumn'];
			_(self).extend(_(self.cache).reduce(function (a, e) {
				a['$' + e] = self.$el.find('.' + e);
				return a;
			}, {}));

			this.initCohortsAndSources();
			this.initSamplesFrom();

			this.$el
				.on('click', '.addColumn', this.addColumnClick);

			// if there are no columns, prepare for the user to easily add a column
			// TODO this works fine on reload when a cohort is already selected
			//      make it work when no cohort is yet selected on load
			//      like, how do we simultaneously subscribe to cohort state?
			// multiple plucks and a zipArray?
			column_orderState = this.state.pluck('column_order').distinctUntilChanged().share(); // need distinctUntilChanged ?
			column_orderState.subscribe(function (c) {
				if (c.length === 0) {
					self.cohortChange();
				}
			});
		}
	};

	function create(options) {
		var w = Object.create(aWidget);
		w.initialize(options);
		return w;
	}

	return {

		get: function () {
			return widget;
		},

		columnDims: function () {
			return {
				horizontalMargin: horizontalMargin,
				sparseRadius: sparseRadius,
				sparsePad: sparsePad,
				headerPlotHeight: headerPlotHeight
			};
		},

		columnShow: function (id, ws) {
			return columnUi.show(id, {
				ws: ws,
				sheetWrap: widget,
				horizontalMargin: horizontalMargin,
				sparsePad: sparsePad,
				headerPlotHeight: headerPlotHeight
			});
		},

		create: function (options) {
			widget = create(options);
			return widget;
		}
	};
});
