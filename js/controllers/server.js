/*global require: false, module: false */
'use strict';

var _ = require('../underscore_ext');
var Rx = require('rx');
var {reifyErrors, collectResults} = require('./errors');
var {closeEmptyColumns, reJoinFields, resetZoom, setCohort, fetchDatasets,
	fetchSamples, fetchColumnData, matchSamples} = require('./common');

var xenaQuery = require('../xenaQuery');
var datasetFeatures = xenaQuery.dsID_fn(xenaQuery.dataset_feature_detail);
var {updateFields, filterByDsID} = require('../models/fieldSpec');
var {remapFields} = require('../models/searchSamples');
var identity = x => x;
var {parseBookmark} = require('../bookmark');

function featuresQuery(datasets) {
	var clinicalMatrices = _.filter(datasets, ds => ds.type === 'clinicalMatrix'),
		dsIDs = _.pluck(clinicalMatrices, 'dsID');

	// XXX note that datasetFeatures takes optional args, so don't pass it directly
	// to map.
	return Rx.Observable.zipArray(
				_.map(dsIDs, dsID => reifyErrors(datasetFeatures(dsID), {dsID}))
			).flatMap(resps =>
				collectResults(resps, features => _.object(dsIDs, features)));
}

function fetchFeatures(serverBus, datasets) {
	serverBus.onNext(['features', featuresQuery(datasets)]);
}

var columnOpen = (state, id) => _.has(_.get(state, 'columns'), id);

var resetCohort = state => {
	let activeCohorts = _.filter(state.cohort, c => _.contains(state.cohorts, c.name));
	return _.isEqual(activeCohorts, state.cohort) ? state :
		setCohort(state, activeCohorts);
};

var filterColumnDs = _.curry(
	(datasets, column) => _.updateIn(column, ['fieldSpecs'], filterByDsID(datasets)));


// we must re-fetch widget data after this operation, since the column
// definitions are changing.
var dropUnknownFields = state =>
	_.assoc(state, 'columns', _.mapObject(state.columns, filterColumnDs(state.datasets)));

var resetColumnFields = state =>
	reJoinFields(
		state.datasets,
		closeEmptyColumns(
			dropUnknownFields(state)));

var resetLoadPending = state => _.dissoc(state, 'loadPending');

var controls = {
	// XXX reset loadPending flag
	bookmark: (state, bookmark) => resetLoadPending(parseBookmark(bookmark)),
	inlineState: (state, newState) => resetLoadPending(newState),
	cohorts: (state, cohorts) => resetCohort(_.assoc(state, "cohorts", cohorts)),
	'cohorts-post!': (serverBus, state, newState) => {
		let {servers: {user}, cohort} = newState;
		fetchSamples(serverBus, user, cohort);
		fetchDatasets(serverBus, user, cohort);
	},
	datasets: (state, datasets) => {
		var newState = resetColumnFields(_.assoc(state, "datasets", datasets)),
			{cohortSamples, columnOrder} = newState;
		if (cohortSamples) {
			return _.reduce(
					columnOrder,
					(acc, id) => _.assocIn(acc, ['data', id, 'status'], 'loading'),
					newState);
		}
		return newState;
	},
	'datasets-post!': (serverBus, state, newState, datasets) => {
		var {cohortSamples, columns} = newState;
		if (cohortSamples) {
			_.mapObject(columns, (settings, id) =>
					fetchColumnData(serverBus, cohortSamples, id, settings));
		}
		fetchFeatures(serverBus, datasets);
	},
	features: (state, features) => _.assoc(state, "features", features),
	samples: (state, samples) => {
		var newState = matchSamples(resetZoom(_.assoc(state,
						  'cohortSamples', samples,
						  'samples', _.range(_.sum(_.map(samples, c => c.length))))),
					state.sampleSearch),
			{columnOrder} = newState;
		return _.reduce(
				columnOrder,
				(acc, id) => _.assocIn(acc, ['data', id, 'status'], 'loading'),
				newState);
	},
	'samples-post!': (serverBus, state, newState, samples) =>
		_.mapObject(_.get(newState, 'columns', {}), (settings, id) =>
				fetchColumnData(serverBus, samples, id, settings)),
	'normalize-fields': (state, fields, id, settings, isFirst, xenaFields) => {
		var {columnOrder, sampleSearch} = state, // old settings
			newOrder = isFirst ? [id, ...columnOrder] : [...columnOrder, id],
			newState = _.assocIn(state,
				['columns', id], updateFields(settings, xenaFields, fields),
				['columnOrder'], newOrder,
				['sampleSearch'], remapFields(columnOrder, newOrder, sampleSearch));
		return _.assocIn(newState, ['data', id, 'status'], 'loading');
	},
	'normalize-fields-post!': (serverBus, state, newState, fields, id) =>
		fetchColumnData(serverBus, state.cohortSamples, id, _.getIn(newState, ['columns', id])),
	// XXX Here we drop the update if the column is no longer open.
	'widget-data': (state, id, data) =>
		columnOpen(state, id) ?
			matchSamples(
					_.assocIn(state, ["data", id], _.assoc(data, 'status', 'loaded')),
					state.sampleSearch) :
			state,
	'widget-data-error': (state, id) =>
		columnOpen(state, id) ?
			_.assocIn(state, ["data", id, 'status'], 'error') : state,
	'columnEdit-features': (state, list) => _.assocIn(state, ["columnEdit", 'features'], list),
	'columnEdit-examples': (state, list) => _.assocIn(state, ["columnEdit", 'examples'], list),
	'km-survival-data': (state, survival) => _.assoc(state, 'survival', survival),
	// XXX Here we should be updating application state. Instead we invoke a callback, because
	// chart.js can't handle passed-in state updates.
	'chart-average-data-post!': (serverBus, state, newState, offsets, thunk) => thunk(offsets)
};

module.exports = {
	action: (state, [tag, ...args]) => (controls[tag] || identity)(state, ...args),
	postAction: (serverBus, state, newState, [tag, ...args]) => (controls[tag + '-post!'] || identity)(serverBus, state, newState, ...args)
};
