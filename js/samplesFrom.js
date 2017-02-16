'use strict';
var xenaQuery = require('./xenaQuery');
var {datasetSamples} = xenaQuery;

var multi = require('./multi');

var samplesFrom = multi(x => x.fetchType);

samplesFrom.add('xena', ({dsID}) => datasetSamples(dsID).map(s => [s]));

module.exports = samplesFrom;
