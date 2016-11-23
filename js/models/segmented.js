/*global require: false, module: false */
'use strict';

// Domain logic for segmented datasets.

var _ = require('../underscore_ext');
var widgets = require('../columnWidgets');
var xenaQuery = require('../xenaQuery');
var Rx = require('rx');
var exonLayout = require('../exonLayout');
var intervalTree = require('static-interval-tree');
var {pxTransformInterval} = require('../layoutPlot');
var heatmapColors = require('../heatmapColors');

function groupedLegend(colorMap, valsInData) { //eslint-disable-line no-unused-vars
	var inData = new Set(valsInData),
		groups = _.groupBy(
			_.filter(_.keys(colorMap), val => inData.has(val)), k => colorMap[k]),
		colors = _.keys(groups);
	return {
		colors,
		labels: _.map(colors, c => groups[c].join(', ')),
		align: 'left'
	};
}

var exonPadding = {
	padTxStart: 1000,
	padTxEnd: 1000
};

// sum(len * value)/sum(len)
//
function segmentAverage(row) {
	var lengths = row.map(seg => seg.end - seg.start),
		totalLen = _.sum(lengths),
		weightedSum = _.sum(row.map((seg, i) => seg.value * lengths[i]));
	return weightedSum / totalLen;
}

function rowOrder(row1, row2) {
	var avg1 = segmentAverage(row1),
		avg2 = segmentAverage(row2);

	return avg1 === avg2 ? 0 : (avg1 > avg2 ? -1 : 1);
}

function cmpRowOrNoSegments(r1, r2, xzoom) {
	var rf1 = r1.filter(v => v.start <= xzoom.end && v.end >= xzoom.start),
		rf2 = r2.filter(v => v.start <= xzoom.end && v.end >= xzoom.start);
	if (rf1.length === 0) {
		return (rf2.length === 0) ? 0 : 1;
	}
	return (rf2.length === 0) ? -1 : rowOrder(rf1, rf2);
}

function cmpRowOrNull(r1, r2, xzoom) {
	if (r1 == null) {
		return (r2 == null) ? 0 : 1;
	}
	return (r2 == null) ? -1 : cmpRowOrNoSegments(r1, r2, xzoom);
}

function cmpSamples(probes, xzoom, sample, s1, s2) {
	return cmpRowOrNull(sample[s1], sample[s2], xzoom);
}

// XXX Instead of checking strand here, it should be set as a column
// property as part of the user input: flip if user enters a gene on
// negative strand. Don't flip for genomic range view, or positive strand.
function cmp(column, data, index) {
	var {fields, xzoom, sortVisible} = column,
		appliedZoom = sortVisible && xzoom ? xzoom : {start: -Infinity, end: Infinity},
		samples = _.getIn(index, ['bySample']);

	return samples ?
		(s1, s2) => cmpSamples(fields, appliedZoom, samples, s1, s2) :
		() => 0;
}

var segmentedDataRangeValues = xenaQuery.dsID_fn(xenaQuery.segmented_data_range_values);

// XXX Might want to optimize this before committing. We could mutate in-place
// without affecting anyone. This may be slow for large mutation datasets.
//
// Map sampleIDs to index into 'samples' array.
function mapSamples(samples, data) {
	var sampleMap = _.object(samples, _.range(samples.length));

	return _.updateIn(data,
		   ['req', 'rows'], rows => _.map(rows,
			   row => _.assoc(row, 'sample', sampleMap[row.sample])),
		   ['req', 'samplesInResp'], sIR => _.map(sIR, s => sampleMap[s]));
}

function fetch({dsID, fields, assembly}, [samples]) {
	var {name, host} = xenaQuery.refGene[assembly] || {};
	return name ? xenaQuery.refGene_exon_case(host, name, fields)
		.flatMap(refGene => {
			var {txStart, txEnd, chrom} = _.values(refGene)[0],
				{padTxStart, padTxEnd} = exonPadding;
			return segmentedDataRangeValues(dsID, chrom, txStart - padTxStart, txEnd + padTxEnd, samples)
				.map(req => mapSamples(samples, {req, refGene}));
		}) : Rx.Observable.return(null);
}

function findNodes(byPosition, layout, samples) {
	var sindex = _.object(samples, _.range(samples.length)),
		minSize = ([s, e]) => [s, e - s < 1 ? s + 1 : e];

	// _.uniq is something like O(n^2). Using ES6 Set, which should be more like O(n).
	var matches = new Set(_.flatmap(layout.chrom,
				([start, end]) => intervalTree.matches(byPosition, {start, end})));

	return [...matches].map(v => {
		var [xStart, xEnd] = minSize(pxTransformInterval(layout, [v.start, v.end]));
		return {
			xStart,
			xEnd,
			y: sindex[v.segment.sample],
			value: v.segment.value,
			data: v.segment
		};
	});
}

var swapIf = (strand, [x, y]) => strand === '-' ? [y, x] : [x, y];

function defaultXZoom(refGene) {
	var {txStart, txEnd, strand} = refGene,
		{padTxStart, padTxEnd} = exonPadding,
		[startPad, endPad] = swapIf(strand, [padTxStart, padTxEnd]);

	return {
		start: txStart - startPad,
		end: txEnd + endPad
	};
}

function dataToDisplay(column, vizSettings, data, sortedSamples, datasets, index) {
	if (_.isEmpty(data) || _.isEmpty(data.req)) {
		return {};
	}
	var {refGene} = data,
		refGeneObj = _.values(refGene)[0],
		maxXZoom = defaultXZoom(refGeneObj),
		{width, showIntrons = false, xzoom = maxXZoom} = column,
		createLayout = showIntrons ? exonLayout.intronLayout : exonLayout.layout,
		layout = createLayout(refGeneObj, width, xzoom),
		nodes = findNodes(index.byPosition, layout, sortedSamples),
		color = heatmapColors.colorSpec(column, vizSettings, null, _.pluck(data.req.rows, 'value'));

	return {
		layout,
		nodes,
		maxXZoom,
		color
	};
}

function index(fieldType, data) {
	if (!_.get(data, 'req') || _.values(data.refGene).length === 0) {
		return null;
	}

	var {req: {rows, samplesInResp}} = data,
		bySample = _.groupBy(rows, 'sample'),
		empty = []; // use a single empty object.

	rows = rows.map(row => {
		var {start, end} = row;

		return {
			start: start,
			end: end,
			segment: row
		};
	});

	return {
		byPosition: intervalTree.index(rows),
		bySample: _.object(
				samplesInResp,
				samplesInResp.map(s => bySample[s] || empty))
	};
}

widgets.cmp.add('segmented', cmp);
widgets.index.add('segmented', index);
widgets.transform.add('segmented', dataToDisplay);

module.exports = {
	defaultXZoom,
	fetch
};
