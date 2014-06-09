/*jslint nomen:true, browser: true */
/*global define: false */

define(['stub', 'haml!haml/columnUi', 'haml!haml/columnUiSelect', 'haml!haml/tupleDisplay', 'colorBar', 'columnEdit', 'columnMenu', 'defer', /*'mutation',*/ 'refGene', 'util', 'lib/d3', 'jquery', 'lib/select2', 'lib/underscore', 'xenaQuery', 'rx'
	// non-object dependenciies
	], function (stub, template, selectTemplate, tupleTemplate, colorBar, columnEdit, columnMenu, defer, /*mutation,*/ refGene, util, d3, $, select2, _, xenaQuery, Rx) {
	'use strict';

	var APPLY = true,
		//defaultFeature = '_INTEGRATION',
		each = _.each,
		filter = _.filter,
		find = _.find,
		map = _.map,
		reduce = _.reduce,
		toNumber = _.toNumber,
		uniqueId = _.uniqueId,
		genes = stub.getRefGeneNames2(),
		dsTitles = { // TODO for demo
			"http://cancerdb:7222/TARGET/TARGET_neuroblastoma/cnv.matrix": 'Copy number',
			"http://cancerdb:7222/TARGET/TARGET_neuroblastoma/rma.Target190.Probeset.Full": 'Gene expression, array',
			"http://cancerdb:7222/TARGET/TARGET_neuroblastoma/NBL_10_RNAseq_log2": 'Gene expression, RNAseq',
			"http://cancerdb:7222/TARGET/TARGET_neuroblastoma/mutationGene": 'Mutations, gene',
			"http://cancerdb:7222/TARGET/TARGET_neuroblastoma/TARGET_neuroblastoma_clinicalMatrix": ' '
		},
		/*
		defTitles = {
			cna: 'copy number',
			DNAMethylation: 'DNA methylation',
			geneExp: 'gene expression',
			RNAseqExp: 'RNA sequence expression',
			arrayExp: 'array expression',
			somaticMutation: 'somatic mutation',
			mutationVector: 'mutation vector',
			protein: 'protein',
			clinical: 'clinical feature'
		},
		*/
		widgets = {},
		aWidget;

	function datasetTitle(dsID, title) {
		return dsTitles[dsID] || title;
	}

	aWidget = {
		// XXX this needs to be invoked somewhere. (It is, from columnMenu.js)
		destroy: function () {
			this.$el.remove();
			// TODO clean up subWidgets
			delete widgets[this.id];
			$('.spreadsheet').resize();
		},

		featureLabel: function (ui) {
			return _.find(stub.getFeatures(), function (val, key) {
				return key === ui.feature;
			});
		},

		someMouseenterLeave: function (e) {
			var $hoverShow = $(e.target);
			if (e.type === 'mouseenter') {
				$hoverShow.removeClass('recede');
			} else {
				$hoverShow.addClass('recede');
				$hoverShow.blur();
			}
		},

		mouseenterLeave: function (e) {
			var $hoverShow = this.$el.find('.hoverShow');
			if (e.type === 'mouseenter') {
				$hoverShow.removeClass('recede');
			} else {
				$hoverShow.addClass('recede');
				$hoverShow.blur();
			}
		},

		getDefTitle: function (dsID) {
			return this.sheetWrap.sources.map(function (sources) {
				var dataset = xenaQuery.find_dataset(sources, dsID);
				if (dsID === 'http://cancerdb:7222/TARGET/TARGET_neuroblastoma/TARGET_neuroblastoma_mutationVector') {
					return 'Mutation';
				} else if (!dataset) {
					return "<unknown>";
				} else {
					return datasetTitle(dsID, dataset.title);
				}
			});
		},

		setTitleVal: function (val) {
			this.$columnTitle
				.val(val)
				.prop('title', val);
		},

		titleChange: function () {
			if (this.$columnTitle.val() === this.defTitle) {
				this.$columnTitle.addClass('defalt');
			} else {
				this.$columnTitle.removeClass('defalt');
			}
			this.setTitleVal(this.$columnTitle.val());
		},

		titleFocusout: function () {
			if (this.$columnTitle.val() === '') {
				this.setTitleVal(this.defTitle);
				//this.$columnTitle.val(this.defTitle);
			}
			this.titleChange();
		},

		getDefField: function () {
			var defalt = Rx.Observable.return(this.ws.column.fields.toString()),
				ui = this.ws.column.ui;
			if (ui.dataSubType === 'clinical') {
				defalt = xenaQuery.feature_list(this.ws.column.dsID)
					.pluck(ui.feature);
			}
			return defalt;
		},

		setFieldVal: function (val) {
			this.$field
				.val(val)
				.prop('title', val);
		},

		fieldChange: function () {
			if (this.$field.val() === this.defField) {
				this.$field.addClass('defalt');
			} else {
				this.$field.removeClass('defalt');
			}
			this.setFieldVal(this.$field.val());
		},

		fieldFocusout: function () {
			if (this.$field.val() === '') {
				this.$field.val(this.defField);
			}
			this.fieldChange();
		},

/*
		featureChange: function (e) {
			this.ws.column.ui.feature = this.$feature.select2('val');
			this.ws.column.fields = [this.ws.column.ui.feature];
			$('#columnStub').val(JSON.stringify(this.ws.column, undefined, 4));
			this.updateColumn(this.id);
		},
*/
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
			var self = this;
			self.getDefTitle(self.ws.column.dsID).subscribe(function (defTitle) {
				//var defTitle = defTitles[ui.dataSubType];
				if (!self.defTitle || (self.$columnTitle.val() === self.defTitle)) {
					self.defTitle = defTitle;
					self.setTitleVal(defTitle);
					//self.$columnTitle.val(defTitle);
					self.titleChange();
				} else {
					self.defTitle = defTitle;
				}
			});
		},

		renderField: function (ui) {
			var self = this;
			self.getDefField().subscribe(function (defField) {
				if (!self.defField || (self.$field.val() === self.defField)) {
					self.defField = defField;
					self.$field.val(defField);
					self.fieldChange();
				} else {
					self.defField = defField;
				}
			});
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
				minimumResultsForSearch: 12,
				dropdownAutoWidth: true
			});
			this.$feature = this.$el.find('.select2-container.feature');
			this.$feature.select2('val', this.ws.column.ui.feature);
		},
*/
		reRender: function (options) {
			var ui = options.ws.column.ui;
			this.ws = options.ws;
			this.renderTitle(ui);
			this.renderField(ui);
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

			// adjust to default column dimensions
			this.$el.parent().css('margin-left', this.horizontalMargin);
			this.$el.parent().css('margin-right', this.horizontalMargin);
			this.$el.find('.sparsePad').height(this.sparsePad);
			this.$el.find('.headerPlot').height(this.headerPlotHeight);

			// cache jquery objects for active DOM elements
			this.cache = ['more', 'titleRow', 'columnTitle', 'fieldRow', 'field', 'headerPlot', 'sparsePad', 'samplePlot'];
			_(self).extend(_(self.cache).reduce(function (a, e) { a['$' + e] = self.$el.find('.' + e); return a; }, {}));
			this.columnMenu = columnMenu.create(this.id, {
				anchor: this.$more,
				columnUi: this,
				ws: ws,
				deleteColumn: this.sheetWrap.deleteColumn,
				duplicateColumn: this.sheetWrap.duplicateColumn
			});
			this.$el // TODO use rx handlers?
				.on('mouseenter mouseleave', '.columnTitle, .field', this.someMouseenterLeave)
				.on('mouseenter mouseleave', this.mouseenterLeave)
				.on('resize', this.resize)
				.on('keyup change', '.columnTitle', this.titleChange)
				.on('focusout', '.columnTitle', this.titleFocusout)
				.on('keyup change', '.field', this.fieldChange)
				.on('focusout', '.field', this.fieldFocusout);
				//.on('change', '.feature', this.featureChange)

			this.reRender(options);

			// TODO in case we are restoring session store for demo
			$('.addColumn').show();
			if (!$('.cohort').select2('val')) {
				$('.cohort').select2('val', 'TARGET_Neuroblastoma');
			}
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
			this.sparsePad = options.sparsePad;
			this.headerPlotHeight = options.headerPlotHeight;
			this.horizontalMargin = options.horizontalMargin.toString() + 'px';
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
			//console.log(id + ', ' + options.ws.column.fields[0] + '  columnUi.show()');
			var widget = widgets[id];
			if (widget) {
				widget.render(options);
			} else {
				widget = widgets[id] = create(id, options);
			}
			return widget;
		}
	};
});
