/*eslint-env browser */
/*global module: false, navigator: false */
'use strict';

module.exports = {
	getParameterByName: function (name) {
		// TODO duplicates galaxy.js, so extract into common file
		// see http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values/901144#901144
		var match = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
		return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
	},


	eventOffset: function (ev) {
		var {top, left} = ev.target.getBoundingClientRect();
		return {
			x: ev.pageX - (left + window.pageXOffset),
			y: ev.pageY - (top + window.pageYOffset)
		};
	},

	// utility fxn to add commas to a number str
	// found at: http://www.mredkj.com/javascript/numberFormat.html
	addCommas: function (nStr) {
		nStr += '';
		var x = nStr.split('.'),
			x1 = x[0],
			x2 = x.length > 1 ? '.' + x[1] : '',
			rgx = /(\d+)(\d{3})/;
		while (rgx.test(x1)) {
			x1 = x1.replace(rgx, '$1' + ',' + '$2');
		}
		return x1 + x2;
	},

	hasClass: function(el, c) {
		return el.className.split(/ +/).indexOf(c) !== -1;
	}

};
