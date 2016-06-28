/*global module: false */
/*eslint-env browser */

'use strict';

var version = 1.0;
module.exports = {
	version: 1.0,
	hasBookmark: () => location.search.match(/^\?bookmark=/),
	getBookmark: () => location.search.replace(/^\?bookmark=([0-9a-z]+)/, '$1'),
	resetBookmarkLocation: () => history.replaceState({}, 'UCSC Xena',
			location.search.replace(/\?bookmark=([0-9a-z]+)/, '')),
	createBookmark: appState => JSON.stringify({version, appState}),
	// Need to add version check & merge of state + bookmark.
	parseBookmark: bookmark => JSON.parse(bookmark).appState
};
