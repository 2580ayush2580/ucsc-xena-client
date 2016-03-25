// Screen layout of exons for a single gene.

/*global require: false, module: false */
'use strict';

var spLen = 3; // size of intronic region to draw between exons

var _ = require('underscore');

// reverse layout if on negative strand.
var reverseIf = (strand, arr) =>
	(strand === '-') ? arr.slice(0).reverse() : arr;

//pad each end of the transcript with N
var padBothEnds = (arr, padding) =>
	_.updateIn(_.updateIn(arr, [0, 0], x => x - padding),
				  [arr.length - 1, 1], x => x + padding);

function pad1(p, intervals, acc) {
	if (intervals.length === 1) {
		return acc.concat(intervals);
	}
	var [[ls, le], [rs, re], ...rest] = intervals;
	return pad1(p, [[rs - p, re]].concat(rest), acc.concat([[ls, le + p]]));
}

// Extend exon intervals, to show splice sites.
// can drop this wrapper with babel, using param default acc=[], above.
var	pad = (p, intervals) => pad1(p, intervals, []);

// XXX This generates exon boundaries on pixel fractions. Might want to
// change it to integer pixels. Note that we can't round + continue the
// calculation because the rounding errors can sum to over a pixel length by
// the end. Instead, project all the lengths from zero & round to avoid
// rounding error accumulating at the end.

// Tail call version. Will be optimized when we switch to babel.
// Also, use defaults offset=0, acc=[]
function toScreen(bpp, [next, ...rest], offset, acc) {
	if (!next) {
		return acc;
	}
	var [start, end] = next,
		len = (end - start + 1) / bpp;
	return toScreen(bpp, rest, len + offset, acc.concat([[offset, len + offset]]));
}

function baseLen(chrlo) {
	return _.reduce(chrlo, (acc, [s, e]) => acc + e - s + 1, 0);
}

function pxLen(chrlo) {
	return _.reduce(chrlo, (acc, [s, e]) => acc + e - s, 0);
}

// Layout exons on screen pixels.
// layout(genepred :: {exonStarts : [<int>, ...], exonEnds: [<int>, ...], strand: <string>)
//  :: {chrom: [[<int>, <int>], ...], screen: [[<int>, <int>], ...], reversed: <boolean>}
// XXX promoter region?
function layout({exonStarts, exonEnds, strand}, pxWidth, zoom) {
	var padding = 200, // extra bp on the ends of transcripts
		chrIntvls = reverseIf(strand, padBothEnds(pad(spLen, _.zip(exonStarts, exonEnds)), padding)),
		count = _.getIn(zoom, ['len'], baseLen(chrIntvls)),
		bpp = count / pxWidth,
		pixIntvls = toScreen(bpp, chrIntvls, 0, []);
	return {
		chrom: chrIntvls,
		screen: pixIntvls,
		reversed: strand === '-',
		baseLen: count,
		pxLen: pxWidth,
		zoom: zoom
	};
}

module.exports = {
	chromLayout: ({exonStarts, exonEnds, strand}) =>
		reverseIf(strand, pad(spLen, _.zip(exonStarts, exonEnds))),
	screenLayout: (bpp, chrlo) => toScreen(bpp, chrlo, 0, []),
	baseLen: baseLen,
	pxLen: pxLen,
	layout: layout,
	pad: pad
};
