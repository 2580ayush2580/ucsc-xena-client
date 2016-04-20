/*global describe: false, it: false, require: false */
'use strict';
var _ = require('../js/underscore_ext');
var assert = require('assert');
var jsc = require('jsverify');

describe('underscore_ext', function () {
    describe('#maxWith', function () {
        it('should return max using cmp fn', function() {
            assert.equal(_.maxWith([5, 4, 3, 2, 1], (x, y) => x - y), 1);
            assert.equal(_.maxWith([5, 4, 3, 2, 1], (x, y) => y - x), 5);
        });
        jsc.property('sort matches builtin sort', 'array number', function (arr) {
            var cmp = (x, y) => y - x;
            return arr.slice(0).sort(cmp)[0] === _.maxWith(arr, cmp);
        });
    });
    describe('#fmapMemoize1', function () {
		jsc.property('returns from cache on same input', 'json', function (a) {
			var fn = _.fmapMemoize1(() => ({})),
				r1 = fn(a),
				r2 = fn(a);
			return r1 === r2;
		});
		jsc.property('returns new value on different input', jsc.tuple([jsc.json, jsc.json]), function (a, b) {
			var fn = _.fmapMemoize1(() => ({})),
				r1 = fn(a),
				r2 = fn(b);
			return r1 !== r2;
		});
		// XXX create two objects slightly different & test that cache is used?
		// create pairs of key/value, then select from set of pairs.
    });
    describe('#mmap', function () {
        it('should iterate multiple collections', function() {
            assert.deepEqual(_.mmap([5, 4, 3], ['a', 'b', 'c'], [-1, -2, -3], (p, c, n, i) => [p, c, n, i]),
						 [[5, 'a', -1, 0],
						 [4, 'b', -2, 1],
						 [3, 'c', -3, 2]]);
		});
    });
	describe('#scan', function () {
		it('should scan array with initial value', function() {
			assert.deepEqual([0, 1, 3, 6], _.scan([1, 2, 3], (acc, x) => acc + x, 0));
		});
		it('should scan singleton array with initial value', function() {
			assert.deepEqual([0, 1], _.scan([1], (acc, x) => acc + x, 0));
		});
		it('should scan emtpy array with initial value', function() {
			assert.deepEqual([0], _.scan([], (acc, x) => acc + x, 0));
		});
		it('should scan array without initial value', function() {
			assert.deepEqual([1, 3, 6], _.scan([1, 2, 3], (acc, x) => acc + x));
		});
		it('should scan singleton array without initial value', function() {
			assert.deepEqual([1], _.scan([1], (acc, x) => acc + x));
		});
		it('should throw on scan empty array without initial value', function() {
			assert.throws(() => _.scan([], (acc, x) => acc + x), 'did not throw on empty array');
		});
	});
});
