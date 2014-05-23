/*jslint nomen:true, browser: true */
/*global define: false */

define(['stub', 'haml!haml/columnUi', 'haml!haml/columnUiSelect', 'haml!haml/tupleDisplay', 'colorBar', 'columnEdit', 'columnMenu', 'defer', /*'mutation',*/ 'refGene', 'util', 'lib/d3', 'jquery', 'lib/select2', 'lib/underscore'
	// non-object dependenciies
	], function (stub, template, selectTemplate, tupleTemplate, colorBar, columnEdit, columnMenu, defer, /*mutation,*/ refGene, util, d3, $, select2, _) {
	'use strict';

	var TEST = stub.TEST(),
		APPLY = true,
		//defaultFeature = '_INTEGRATION',
		each = _.each,
		filter = _.filter,
		find = _.find,
		map = _.map,
		reduce = _.reduce,
		toNumber = _.toNumber,
		uniqueId = _.uniqueId,
		genes = stub.getRefGeneNames2(),
		columnUntitles = {
			cna: 'copy number',
			DNAMethylation: 'DNA methylation',
			geneExp: 'gene expression',
			RNAseqExp: 'RNA sequence expression',
			arrayExp: 'array expression',
			somaticMutation: 'somatic mutation',
			sparseMutation: 'sparse mutation',
			protein: 'protein',
			clinical: 'clinical feature'
		},
		widgets = {},
		aWidget = {

			destroy: function () {
				this.$el.remove();
				// TODO clean up subWidgets
				delete widgets[this.id];
			},

			titleChange: function (e) {
				if (this.$columnTitle.val() === this.untitle) {
					this.$columnTitle.addClass('untitled');
				} else {
					this.$columnTitle.removeClass('untitled');
				}
			},

			titleFocusout: function (e) {
				if (this.$columnTitle.val() === '') {
					this.$columnTitle.val(this.untitle);
				}
				this.titleChange();
			},
/*
			featureChange: function (e) {
				this.ws.column.ui.feature = this.$feature.select2('val');
				this.ws.column.fields = [this.ws.column.ui.feature];
				$('#columnStub').val(JSON.stringify(this.ws.column, undefined, 4));
				this.updateColumn(this.id);
			},
*/
			renderPlots: function () {
				console.log('columnUi.renderPlots()');
			/*
				var datasetName = this.columnEdit.$datasetSelect2.select2('val'),
					dataType = columnEdit.getDataType(datasetName),
					mode,
					text,
					$plot = this.$el.find('.samplePlot'),
					$stub;
				switch (dataType) {
				case 'sparseMutation':
					this.columnMenu.showItem('mupit');
					this.renderPlotsMutation();
					break;
				default:
					this.columnMenu.hideItem('mupit');
					if (this.columnEdit.$modeSelect2) {
						mode = this.columnEdit.$modeSelect2.select2('val');
					}
					$stub = $(tupleTemplate({
						header: 'future plot of:',
						labels: ['dataset:', 'dataType:', 'displayMode:'],
						values: [datasetName, dataType, mode]
					}));
					$plot.append($stub);
					$plot.find('.tupleDisplay').css({
						'margin-top': '130px',
						'margin-left': '5px',
						'font-style': 'italic'
					});
					$plot.parents('tr').removeClass('new');
					break;
				}
				*/
			},

			resize: function () {
				var self = this;
				setTimeout(function () {
					var width = self.$el.width()
						- self.$columnTitle.css('padding-left').replace('px', '')
						- self.$columnTitle.css('padding-right').replace('px', '')
						- self.$columnTitle.css('border-left-width').replace('px', '')
						- self.$columnTitle.css('border-right-width').replace('px', '')
						- self.$more.width()
						- 4; // for don't know what
					self.$columnTitle.width(width);
				}, 200);
			},

			renderTitle: function (ui) {
				var untitle = columnUntitles[ui.dataSubType];
				if (!this.untitle || (this.$columnTitle.val() === this.untitle)) {
					this.untitle = untitle;
					this.$columnTitle.val(untitle);
					this.titleChange();
				} else {
					this.untitle = untitle;
				}
			},
/*
			renderFeature: function(ui) {
				var features = stub.getFeatures();
				this.$el.find('.featureRow').remove();
				this.$feature = undefined;
				if (ui.dataSubType === 'clinical') {
					this.$titleRow.after($(selectTemplate({
						klass: 'feature',
						list: features
					})));
				}
				this.$el.find('.feature').select2({
					minimumResultsForSearch: 20,
					dropdownAutoWidth: true
				});
				this.$feature = this.$el.find('.select2-container.feature');
				this.$feature.select2('val', this.ws.column.ui.feature);
			},
*/
			reRender: function (options) {
				console.log('columnUi.reRender');
				var ui = options.ws.column.ui;
				this.ws = options.ws;
				this.renderTitle(ui);
				//this.renderFeature(ui);
				//this.resize();
			},

			firstRender: function (options) {
				var self = this,
					ws = options.ws;
				this.$anchor = $(ws.el);
				this.width = ws.column.width;
				this.height = ws.height;
				this.sheetWrap = options.sheetWrap;
				this.$el = $(template({
					features: undefined,
					debugId: this.id
				}));
				this.$anchor.append(this.$el);

				// cache jquery objects for active DOM elements
				this.cache = ['titleRow', 'columnTitle', 'more', 'samplePlot'];
				_(self).extend(_(self.cache).reduce(function (a, e) { a['$' + e] = self.$el.find('.' + e); return a; }, {}));
				this.columnMenu = columnMenu.create(this.id, {
					anchor: this.$more,
					column: this,
					deleteColumn: this.sheetWrap.deleteColumn,
					duplicateColumn: this.sheetWrap.duplicateColumn
				});
				this.$el // TODO use rx handlers?
					.on('resize', this.resize)
					.on('keyup change', '.columnTitle', this.titleChange)
					.on('focusout', '.columnTitle', this.titleFocusout);
					//.on('change', '.feature', this.featureChange);

				this.reRender(options);
			},

			render: function (options) {
				if (this.$el) {
					// TODO this should be smarter about using the state tree
					//      and only reRender when needed
					this.reRender(options);
				} else {
					this.firstRender(options);
				}
			},

			initialize: function (options) {
				_.bindAll.apply(_, [this].concat(_.functions(this)));
				//_(this).bindAll();
				this.updateColumn = options.updateColumn;
				this.sheetWrap = options.sheetWrap;
				if (options.ws) {
					this.render(options);
				}

				/* TODO maybe later to allow edit of column
				else if (options.edit) {
					this.columnEdit = columnEdit.show(this.id, {
						sheetWrap: this.sheetwrap,
						columnUi: this,
						updateColumn: this.updateColumn
						//state: { feature: defaultFeature }
					});
				}
				*/
			}
		};

	function create(id, options) {
		var w = Object.create(aWidget);
		w.id = id;
		w.initialize(options);
		return w;
	}

	return {
		show: function (id, options) {
			var widget = widgets[id];
			if (widget) {
				widget.render(options);
			} else {
				widget = widgets[id] = create(id, options);
			}
			return widget;
		}

		/* TODO maybe later to allow edit of columns
		show: function (id, options) {
			var widget = widgets[id];
			widget.render(options);
			return widget;
		}
		*/
	};
});
