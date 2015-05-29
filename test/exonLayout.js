/*global describe: false, it: false, require: false */
"use strict";
var el = require('../js/exonLayout');
var assert = require('assert');
var _ = require('underscore');

describe('exonLayout', function () {
	describe('#pad', function () {
		it('should pad between intervals', function() {
			assert(_.isEqual(el.pad(2, [[20, 30], [40, 50], [60, 70]]),
					[[20, 32], [38, 52], [58, 70]]));
		});
	});
	describe('#layout', function () {
		it('should layout intervals', function() {
			assert.deepEqual(el.layout({
				exonStarts: [100, 200, 300],
				exonEnds: [110, 210, 310],
				strand: null
			}, 10), {
				chrom: [[100, 125], [185, 225], [285, 310]],
				screen: [[0, 259], [260, 669], [670, 929]],
				reversed: false
			});
		});
		it('should layout reversed intervals', function() {
			assert.deepEqual(el.layout({
				exonStarts: [100, 200, 300],
				exonEnds: [110, 210, 310],
				strand: '-'
			}, 10), {
				chrom: [[285, 310], [185, 225], [100, 125]],
				screen: [[0, 259], [260, 669], [670, 929]],
				reversed: true
			});
		});
		// an asymmetric case
		it('should layout reversed intervals (2)', function() {
			assert.deepEqual(el.layout({
				exonStarts: [100, 200],
				exonEnds: [110, 220],
				strand: '-'
			}, 10), {
				chrom: [[185, 220], [100, 125]],
				screen: [[0, 359], [360, 619]],
				reversed: true
			});
		});
	});
});
