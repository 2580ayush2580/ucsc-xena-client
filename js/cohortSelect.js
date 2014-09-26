/*jslint browser: true, nomen: true */
/*global define: false */

define(['haml!haml/cohortSelect', 'xenaQuery', 'lib/underscore', 'jquery', 'rx.jquery'
	], function (template, xenaQuery, _, $, Rx) {
	'use strict';

	var widgets = [],
		aWidget;

	// set cohort and clear columns
	// TODO should this be in sheetWrap.js?
	function setState(cohort, state) {
		return _.assoc(state,
					   'cohort', cohort,
					   'samplesFrom', '', // TODO reset to null or undefined instead?
					   'column_rendering', {},
					   '_column', {},
					   'column_order', []);
	}

	function toLower(s) {
		if (s) {
			return s.toLowerCase();
		} else {
			return '';
		}
	}

	aWidget = {

		destroy: function () {
			// never called because sheetWrap nor this is ever destroyed,
			// but keeping it here as a pattern
			this.$el.select2('destroy');
			this.$el.remove();
			this.$el = undefined;
			this.subs.dispose();
			delete widgets[this.id];
		},

		render: function (server, cohort) {

			// On reload we take the stored state and render while waiting for
			// the servers to report available cohorts. If we don't add the
			// cohort in the state, we will drop the user setting on the floor
			// because the selected cohort will not yet be in the list of cohorts
			// from the servers. Basically, this ensures that the current state
			// is always selectable.
			var cohorts = cohort ? _.union([cohort], server) : server,
				$el = $(template({cohorts: _.sortBy(cohorts, toLower)}));
			if (this.$el) {
				this.$el.select2('destroy');
				this.$anchor.find('.cohort').remove();
			}
			this.$anchor.append($el);
			$el.select2({
				minimumResultsForSearch: 3,
				dropdownAutoWidth: true,
				placeholder: 'Select...',
				placeholderOption: 'first'
			});

			// TODO this dom element val is subscribed to elsewhere,
			// where state should be subscribed to instead
			this.$el = this.$anchor.find('.select2-container.cohort');

			if (cohort) {
				this.$el.select2('val', cohort);
			}
		},

		initialize: function (options) {
			var self = this,
				state = options.state.share(),
				cursor = options.cursor,
				cohortList,
				val;
			_.bindAll.apply(_, [this].concat(_.functions(this)));

			this.$anchor = options.$anchor;
			this.subs = new Rx.CompositeDisposable();

			// create an observable on a cohort list, which is the union of cohorts from all servers,
			// and mix in the current cohort in the UI.
			cohortList = state.refine('servers', 'cohort')
				.map(function (state) {
					return Rx.Observable.zipArray(_.map(state.servers, function (s) {
						return xenaQuery.all_cohorts(s.url);
					})).map(_.apply(_.union));
				}).switchLatest()
				.startWith([])
				.combineLatest(state.refine('cohort'), function (serverCohorts, state) {
					return [serverCohorts, state.cohort];
				});

			this.subs.add(cohortList.subscribe(_.apply(self.render)));

			// when state changes, update the DOM value
			this.subs.add(state.pluck('cohort')
				.distinctUntilChanged().subscribe(function (val) {
					if (self.$el.select2('val') !== val) {
						self.$el.select2('val', val);
					}
				}));

			// when DOM value changes, update state tree
			this.subs.add(this.$anchor.onAsObservable('change', '.cohort')
				.pluck('val').subscribe(function (val) {
					cursor.update(_.partial(setState, val));
				}));
		}
	};

	function create(id, options) {
		var w = Object.create(aWidget);
		w.id = id;
		w.initialize(options);
		return w;
	}

	return {
		create: function (id, options) {
			// this should only be called once per page load,
			// but keeping array and destroy here as a pattern
			if (widgets[id]) {
				widgets[id].destroy();
			}
			widgets[id] = create(id, options);
			return widgets[id];
		}
	};
});
