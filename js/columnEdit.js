/*jslint nomen:true, browser: true */
/*global define: false */

define(['haml!haml/columnEdit', 'haml!haml/columnEditBasic', 'haml!haml/select', 'haml!haml/columnEditAdvanced', 'defer', 'stub', 'lib/select2', 'jquery', 'underscore_ext',
	// non-object dependencies
	'lib/jquery-ui'
	], function (template, basicTemplate, selectTemplate, advancedTemplate, defer, stub, select2, $, _) {
	'use strict';

	var datasetsStub = stub.getDatasets(),

		// TODO: make these more global ?
		defaultGene = 'ALK',
		defaultGenes = 'ALK, PTEN',
		defaultProbes = '(no default probes)', // TODO
		defaultChrom = 'chr1-chrY',
		defaultField = '(fields for this option)', // TODO
		defaultWidth = 100,

		displaysByDataSubType = { // TODO combine with columnUi:columnUntitles
			cna: ['dGene', 'dGenes', /*'dGeneChrom', 'dChrom'*/],
			DNAMethylation: ['dGene', 'dGenes'/*, 'dGeneProbes', 'dProbes', 'dGeneChrom', 'dChrom'*/],
			geneExp: ['dGene', 'dGenes'/*, 'dGeneProbes', 'dProbes', 'dGeneChrom', 'dChrom'*/], // TODO replace with RNAseqExp & arrayExp
			RNAseqExp: ['dGene', 'dGenes', /*'dGeneChrom', 'dChrom'*/],
			arrayExp: ['dGene', 'dGenes'/*, 'dGeneProbes', 'dProbes', 'dGeneChrom', 'dChrom'*/],
			somaticMutation: ['dGene', 'dGenes'],
			mutationVector: ['dExonSparse', /*'dGeneChrom', 'dChrom'*/],
			protein: ['dGene', 'dGenes'/*, 'dGeneProbes', 'dProbes', 'dGeneChrom', 'dChrom'*/],
			clinical: ['dClinical']
		},
		displaysByInput = {
			iGene: ['dGene', 'dGeneProbes', 'dGeneChrom', 'dExonDense', 'dExonSparse'],
			iGenes: ['dGenes'],
			iProbes: ['dProbes'],
			iChrom: ['dChrom'],
			iClinical: ['dClinical']
		},
		inputModeLabels = { // TODO combine with displaysByInput
			iGene: 'single gene',
			iGenes: 'list of genes',
			iProbes: 'list of probes',
			iChrom: 'chromosome coordinates',
			iClinical: 'clinical'
		},
		displayModeLabels = { // TODO combine with dataTypeByDisplay
			dGene: 'gene',
			dGeneProbes: 'probes',
			dExonDense: 'exons',
			dExonSparse: 'exons',
			dGeneChrom: 'chromosomes'
		},
		dataTypeByDisplay = {
			dGene: 'gene', //'nonspatial',
			dGeneProbes: 'probe', //'nonspatial',
			dExonDense: 'exonDense', // spatial
			dExonSparse: 'exonSparse', //spatial
			dGeneChrom: 'geneChrom', // spatial
			dGenes: 'gene', //'nonspatial',
			dProbes: 'probe', //'nonspatial',
			dClinical: 'feature', //'nonspatial',
			dChrom: 'chrom' // spatial
		},
		widgets = {},
		aWidget;

	function getDataSubType(dsID) {
		var datasetInfo = _.find(datasetsStub, function (d) {
				return d.dsID === dsID; // TODO
			});
		return datasetInfo.dataSubType;
	}

	function getInputModesByDataSubType(dataSubType) {
		var inputs = [];
		_.each(displaysByInput, function (displays, input) {
			var intersect = _.intersection(displays, displaysByDataSubType[dataSubType]);
			if (intersect.length) {
				inputs.push(input);
			}
		});
		return inputs;
	}

	function getDisplayModes(dataSubType, inputMode) {
		return _.intersection(
			displaysByDataSubType[dataSubType],
			displaysByInput[inputMode]
		);
	}

	aWidget = {

		destroy: function () {
			this.$el.dialog('destroy').remove();
			delete widgets[this.id];
		},

		moveToTop: function () {
			if (this.$el) {
				this.$el.dialog('moveToTop');
			}
		},

		getFields: function () {
			var fields;
			switch (this.state.inputMode) {
			case 'iGene':
				fields = [this.state.gene]; // TODO use named text?
				break;
			case 'iGenes':
				fields = this.state.genes.split(', '); // TODO use named text?
				break;
			case 'iProbes':
				fields = this.state.probes.split(', '); // TODO use named text?
				break;
			case 'iClinical':
				fields = [this.state.feature];
				break;
			default:
				fields = [defaultField];
				break;
			}
			return fields;
		},

		renderDisplayModes: function (dataSubType) {
			var modes = getDisplayModes(dataSubType, this.state.inputMode);
			if (modes.length === 1) {
				this.state.displayMode = modes[0];
			} else {
				this.$displayModeAnchor.append(
					selectTemplate({
						klass: 'displayMode',
						options: modes,
						labels: displayModeLabels
					})
				);
				this.$displayModeRow.show();
				this.$el.find('.displayMode').select2({
					minimumResultsForSearch: -1,
					dropdownAutoWidth: true
				});
				this.$displayMode = this.$el.find('.select2-container.displayMode');
				if (modes.indexOf(this.state.displayMode) > -1) {
					this.$displayMode.select2('val', this.state.displayMode);
				} else {
					this.state.displayMode = modes[0];
				}
			}
		},

		renderInputModes: function (dataSubType) {
			var modes = getInputModesByDataSubType(dataSubType);
			this.state.dataSubType = dataSubType;
			if (modes.length === 1) {
				this.state.inputMode = modes[0];
			} else {
				this.$inputModeAnchor.append(
					selectTemplate({
						klass: 'inputMode',
						options: modes,
						labels: inputModeLabels
					})
				);
				this.$el.find('.inputMode').select2({
					minimumResultsForSearch: -1,
					dropdownAutoWidth: true
				});
				this.$inputModeRow.show();
				this.$inputMode = this.$el.find('.select2-container.inputMode');
				if (modes.indexOf(this.state.inputMode) > -1) {
					this.$inputMode.select2('val', this.state.inputMode);
				} else {
					this.state.inputMode = modes[0];
				}
			}
			// TODO should this be somewhere else?
			if (!this.state.gene) {
				this.state.gene = defaultGene;
			}
		},

		renderList: function () {
			if (this.state.inputMode === 'iGenes') {
				if (!this.state.genes || this.state.genes === '') {
					this.state.genes = defaultGenes;
				}
				this.$listLabel.text('Genes:');
				this.$listRow.show();
				this.$list.val(this.state.genes);
			} else if (this.state.inputMode === 'iProbes') {
				if (!this.state.probes || this.state.probes === '') {
					this.state.probes = defaultProbes;
				}
				this.$listLabel.text('Probes:');
				this.$listRow.show();
				this.$list.val(this.state.probes);
			}
		},

		renderSingle: function () {
			if (this.state.inputMode === 'iChrom') {
				if (!this.state.chrom || this.state.chrom === '') {
					this.state.chrom = defaultChrom;
				}
				this.$singleLabel.text('Chromosomal Position:');
				this.$singleRow.show();
				this.$single.val(this.state.chrom);
			} else if (this.state.inputMode === 'iGene') {
				if (!this.state.gene || this.state.gene === '') {
					this.state.gene = defaultGene;
				}
				this.$singleLabel.text('Gene:');
				this.$singleRow.show();
				this.$single.val(this.state.gene);
			}

		},

		renderSelect: function () {
			if (this.state.inputMode === 'iClinical') {
				this.$selectAnchor.append(
					selectTemplate({
						klass: 'feature',
						options: stub.getFeatures(),
						labels: undefined
					})
				);
				this.$selectLabel.text('Feature:');
				this.$selectRow.show();
				this.$el.find('.feature').select2({
					minimumResultsForSearch: 20,
					dropdownAutoWidth: true
				});
				this.$feature = this.$el.find('.select2-container.feature');
				if (!this.state.feature) {
					this.state.feature = 'age';
				}
				this.$feature.select2('val', this.state.feature);
			}
		},

		renderGo: function () {
			if (this.state.dsID) {
				this.$goRow.show();
			}
		},

		renderColumn: function () { // TODO shouldn't have to go through debug widgets
			var fields = this.getFields(),
				json = {
					"width": 200,
					"dsID": this.state.dsID, // TODO we don't need dsID in this.state too
					"dataType": dataTypeByDisplay[this.state.displayMode],
					"fields": fields,
					"ui": this.state
				};
			$('#columnStub').val(JSON.stringify(json, undefined, 4));
			this.updateColumn(this.id);
		},

		reRender: function () {
			var dataSubType = getDataSubType(this.state.dsID);

			// reset the dynamic portion of column, excluding the plot
			this.$el.find('tr:not(.static)').hide();
			this.$inputModeAnchor.empty();
			this.$inputMode = undefined;
			this.$displayModeAnchor.empty();
			this.$displayMode = undefined;
			this.$selectAnchor.empty();
			this.$feature = undefined;

			// render by row
			this.renderInputModes(dataSubType);
			this.renderList();
			this.renderSingle();
			this.renderDisplayModes(dataSubType);
			this.renderSelect();
			this.renderGo();
		},

		goClick: function () {
			this.renderColumn();
			this.destroy();
		},

		featureChange: function () {
			this.state.feature = this.$feature.select2('val');
			this.reRender();
		},

		displayModeChange: function () {
			this.state.displayMode = this.$displayMode.select2('val');
			this.reRender();
		},

		singleBlur: function () {
			if (this.state.inputMode === 'iChrom') {
				this.state.chrom = this.$single.val();
			} else {
				this.state.gene = this.$single.val();
			}
			this.reRender();
		},

		listBlur: function () {
			if (this.state.inputMode === 'iGenes') {
				this.state.genes = this.$list.val();
			} else {
				this.state.probes = this.$list.val();
			}
			this.reRender();
		},

		inputModeChange: function () {
			this.state.inputMode = this.$inputMode.select2('val');
			this.reRender();
		},

		datasetChange: function () {
			var dsID = this.$dataset.select2('val');
			if (dsID === 'mine') {
				this.state.dsID = undefined;
			} else {
				this.state.dsID = dsID;
				this.reRender();
			}
		},

		toggleAdvanced: function (e) {
			var label = (this.$advancedLabel.text() === 'Advanced:')
				? 'Advanced...'
				: 'Advanced:';
			this.$advanced.toggle();
			this.$advancedLabel.text(label);
		},

		position: function () {
			var self = this,
				offset,
				of;
			if (this.columnUi && this.columnUi.$el) {
				offset = 10;
				of = this.columnUi.$el;
			} else {
				offset = 10;
				//offset = defaultWidth - 12;
				of = $('.addColumn');
			}
			defer(function () {
				self.$el.dialog('option', 'position', {
					my: 'left+' + offset + ' top',
					//my: 'left+' + offset + ' top+105',
					//my: 'left+' + offset + ' top-10',
					at: 'right top',
					of: of
				});
			});
		},

		render: function () {
			var self = this,
				basic;
			basic = basicTemplate({
				sources: this.sources
			});
			this.$el = $(template({
				basic: basic,
				advanced: undefined
				//advanced: advanced
			}));

			this.$el.find('.dataset').select2({
				minimumResultsForSearch: -1,
				dropdownAutoWidth: true,
				placeholder: 'Select...',
				placeholderOption: 'first'
			});
			this.$dataset = this.$el.find('.select2-container.dataset');

			// cache jquery objects for active DOM elements
			this.cache = ['inputModeRow', 'inputModeAnchor',
				'listRow', 'listLabel', 'list', 'singleRow', 'singleLabel', 'single',
				'selectRow', 'selectLabel', 'selectAnchor',
				'displayModeRow', 'displayModeAnchor', 'columnTitleRow',
				'goRow', 'advanced', 'advancedLabel'];
			_(self).extend(_(self.cache).reduce(function (a, e) {
				a['$' + e] = self.$el.find('.' + e);
				return a;
			}, {}));

			this.$el.dialog({
				title: 'Define Column',
				width: '500', // TODO make dynamic
				position: {
					my: 'left top',
					at: 'left top',
					of: $('.addColumn')
				},
				close: this.destroy
			});
			//this.position();
		},

		initialize: function (options) {
			_.bindAll.apply(_, [this].concat(_.functions(this)));
			//_(this).bindAll();
			this.$anchor = options.$anchor;
			this.sheetWrap = options.sheetWrap;
			this.columnUi = options.columnUi;
			this.updateColumn = options.updateColumn;
			this.firstRenderDataset = true;
			this.state = {};
			//this.state = options.state;
			datasetsStub = stub.getDatasets();
			this.sources = [
				{
					title: 'localhost',
					datasets: [
						{
							title: 'my local dataset',
							dsID: 'mine'
						}
					]
				},
				{
					title: 'cancerdb.ucsc.edu',
					datasets: datasetsStub
				}
			];
			//this.datasets = datasetsStub; // TODO
			this.render();
			if (options.dataset) {
				this.$dataset.select2('val', options.dataset);
			}

			this.$el // TODO replace with rx event handlers
				.on('change', '.dataset', this.datasetChange)
				.on('change', '.inputMode', this.inputModeChange)
				.on('blur', '.list', this.listBlur)
				.on('blur', '.single', this.singleBlur)
				.on('change', '.displayMode', this.displayModeChange)
				.on('change', '.feature', this.featureChange)
				.on('click', '.go', this.goClick);
			if (this.columnUi) {
				this.$el.on('mouseenter mouseleave', this.columnUi.mouseenterLeave);
			}
		}
	};

	function create(id, options) {
		var w = Object.create(aWidget);
		w.id = id;
		w.initialize(options);
		return w;
	}

	return {
		getDataSubType: getDataSubType,

		destroyAll: function () {
			_.each(widgets, function (w) {
				w.destroy();
			});
		},

		show: function (id, options) {
			var widget = widgets[id];
			if (widget) {
				widget.moveToTop();
			} else {
				widgets[id] = create(id, options);
			}
			return widgets[id];
		},

		showDataset: function (id, options) {
			return create(id, options);
		}
	};
});
