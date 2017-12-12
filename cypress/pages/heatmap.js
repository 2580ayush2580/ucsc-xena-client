/*global cy: false*/
'use strict';

var exactMatch = (selector, str)  =>
	cy.get(`:contains('${str}')`)
		.filter(selector)
		.filter((i, x) => x.innerText === str);

var wizard = {
	// The cohort card input field
	cohortInput: () => cy.contains('label', 'Study').siblings('input'),
	// Select a cohort from the drop-down
	cohortSelect: cohort => exactMatch('li', cohort).click(),
	geneExpression: () => cy.contains('Gene Expression'),
	somaticMutation: () => cy.contains('Somatic Mutation'),
	copyNumber: () => cy.contains('Copy Number'),
	geneFieldInput: () => cy.contains('label', 'Add Gene').siblings('input'),
	cohortDone: () => cy.contains('Done'),
	columnDone: () => cy.contains('Done'),
	cards: () => cy.get('[class^=WizardCard-module]')
};

var spreadsheet = {
	chartView: () => cy.get('[title="View as chart"]'),
	colControls: i => cy.get('[class^=ColCard-module__controls]').eq(i),
	colCanvas: i => cy.get('.resize-enable').eq(i).find('.Tooltip-target canvas'),
	loadingSpinners: () => cy.get('[data-xena="loading"]'),
	// "View live example" link
	examples: () => cy.get('[class^=Welcome-module] a'),
	waitForViewport: () => cy.wait(200) // 200ms delay to fire viewportWidth
};

var nav = {
	bookmarkMenu: () => cy.get('button:contains("Bookmark")'),
	bookmark: () => cy.get('li:contains("Bookmark")'),
	heatmap: () => cy.get('nav').contains('Visualization'),
	transcript: () => cy.get('nav').contains('Transcripts'),
	datapages: () => cy.get('nav').contains('Data Sets'),
	hubs: () => cy.get('nav').contains('Data Hubs'),
	waitForTransition: () => cy.wait(350) // 350ms css transition on navigation buttons
};

module.exports = {
	url: '/heatmap/',
	wizard,
	nav,
	spreadsheet,
	chart: {},
	km: {}
};
