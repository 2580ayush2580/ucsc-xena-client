/*global module: false, require: false */
'use strict';

var _ = require('underscore');

var {min, max, round} = Math;

function flopIf(reversed, start, end) {
	return reversed ? ([vstart, vend]) => [end - vend + start, end - vstart + start] :
			_.identity;
}

function pxTransformEach(layout, fn) {
	var {screen, chrom, reversed} = layout;
	var offset = _.get_in(layout, ['zoom', 'index']);

	_.each(chrom, (pos, i) => {
		var [start, end] = pos;
		var [sstart, send] = screen[i];
		var flop = flopIf(reversed, start, end);
		var toPx = x => round(sstart + (x - start + 1 - offset) * (send - sstart + 1) / (end - start + 1));
		var clip = ([s, e]) => [max(s, start), min(e, end)];
		var intvlToPx = i => _.map(clip(flop(i)), toPx);

		fn(intvlToPx, pos, screen[i]);
	});
}

module.exports = {
	pxTransformEach: pxTransformEach
};
