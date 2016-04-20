// Helper methods needed by multiple controllers.

/*global require: false, module: false */

'use strict';
var Rx = require('rx');
var xenaQuery = require('../xenaQuery');
var _ = require('../underscore_ext');
var {reifyErrors, collectResults} = require('./errors');
var widgets = require('../columnWidgets');
var {makeSample} = require('../models/sample');

var datasetResults = resps => collectResults(resps, servers =>
		_.object(_.flatmap(servers, s => _.map(s.datasets, d => [d.dsID, d]))));

function datasetQuery(servers, cohort) {
	var cohorts = _.pluck(cohort, 'name');
	return Rx.Observable.zipArray(
		_.map(servers, server => reifyErrors(
				xenaQuery.dataset_list(server, cohorts).map(datasets => ({server, datasets})),
				{host: server}))
	).flatMap(datasetResults)
}

function fetchDatasets(serverBus, servers, cohort) {
	serverBus.onNext(['datasets', datasetQuery(servers, cohort)]);
}

var datasetSamples = xenaQuery.dsID_fn(xenaQuery.dataset_samples);
var allSamples = _.curry((cohort, server) => xenaQuery.all_samples(server, cohort));

// For the cohort, either fetch samplesFrom, or query all servers,
// Return a stream per-cohort, each of which returns an event
// [cohort, [sample, ...]].
// By not combining them here, we can uniformly handle errors, below.
var cohortSamplesQuery = _.curry(
	(servers, {name, samplesFrom}) =>
		(samplesFrom ?
			[datasetSamples(samplesFrom)] :
			_.map(servers, allSamples(name))).map(obs => obs.map(resp => [name, resp])));

function collateSamplesByCohort(resps) {
	return _.flatmap(_.groupBy(resps, _.first),
			(samplesList, cohort) => _.flatten(_.pluck(samplesList, 1)).map(makeSample(cohort)));
}

// reifyErrors should be pass the server name, but in this expression we don't have it.
function samplesQuery(servers, cohort) {
	return Rx.Observable.zipArray(_.flatmap(cohort, cohortSamplesQuery(servers)).map(reifyErrors))
		.flatMap(resps => collectResults(resps, collateSamplesByCohort));
}

function fetchSamples(serverBus, servers, cohort, samplesFrom) {
	serverBus.onNext(['samples', samplesQuery(servers, cohort, samplesFrom)]);
}

function fetchColumnData(serverBus, samples, id, settings) {

	// XXX  Note that the widget-data-xxx slots are leaked in the groupBy
	// in main.js. We need a better mechanism.
	serverBus.onNext([['widget-data', id], widgets.fetch(settings, samples)]);
}

function resetZoom(state) {
	let count = _.get(state, "samples").length;
	return _.updateIn(state, ["zoom"],
					 z => _.merge(z, {count: count, index: 0}));
}

// With multiple cohorts, we now want to
// o- Set cohort in slot.
// o- Drop datasets not in any cohort
// o- Drop samples not in any cohort
// o- Drop features not in any cohort (not in dataset list)
// o- Drop survival not in any cohort (not in feature list)
// o- Drop data not in any cohort (not in dataset list)
// For now, just drop & refetch everything.
var setCohort = (state, i, cohort) =>
	resetZoom(_.assoc(state,
				"cohort", _.assoc(state.cohort, i, {name: cohort}),
				"samplesFrom", null,
				"samples", [],
				"columns", {},
				"columnOrder", [],
				"data", {},
				"datasets", [],
				"survival", null,
				"km", null));

module.exports = {
	fetchDatasets,
	fetchSamples,
	fetchColumnData,
	setCohort,
	resetZoom
};
