/*global require: false, module: false */
'use strict';
var ga4gh = require('ga4gh-rxjs');
var clinvarMeta = require('./metadataStub');
var Rx = require('rx');
require('rx.experimental');
var _ = require('./underscore_ext');

// {url, dataset, chrom, start, end, fields}
function variants({url, dataset, chrom, start, end}) {
	if (chrom.slice(0,3)==="chr"){
		chrom=chrom.slice(3);
	}
	return ga4gh.all.variants(url, {
		variantSetIds: [dataset],
		start: start,
		end: end,
		referenceName: chrom
	});
}

//
function variantSetsQuery (url) {
	return ga4gh.all.variantSets(url);
}

function metadata(host, dataset) {
	// stub, until the server is working
	var {variantSets} = clinvarMeta;
	//var md = _.find(variantSets, ds => ds.id === dataset).metadata;
	return Rx.Observable.return(variantSets);
}

module.exports = {
	variants: variants,
	variantSetsQuery: variantSetsQuery,
	metadata: metadata
};
