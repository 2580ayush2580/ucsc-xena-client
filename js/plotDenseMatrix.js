/*global define: false */
define(['underscore_ext',
		'jquery',
		'rx',
		'multi',
		'vgcanvas',
		'colorBar',
		'columnWidgets',
		'crosshairs',
		'heatmapColors',
		'partition',
		'tooltip',
		'util',
		'xenaQuery',
		'rx-jquery'
	], function (
		_,
		$,
		Rx,
		multi,
		vgcanvas,
		colorBar,
		widgets,
		crosshairs,
		heatmapColors,
		partition,
		tooltip,
		util,
		xenaQuery) {

	"use strict";

	var each = _.each,
		map = _.map,
		filter = _.filter,
		isUndefined = _.isUndefined,
		zip = _.zip,
		range = _.range,
		bind = _.bind,
		pluckPathsArray = _.pluckPathsArray,
		find = _.find,
		uniq = _.uniq,
		scratch = vgcanvas(1, 1), // scratch buffer
		cmp,
		fetch,
		fetch_gene,
		fetch_gene_probes,
		fetch_feature,
		render;

	function meannan(values) {
		var count = 0, sum = 0;
		if (!values) {
			return NaN;
		}
		sum = _.reduce(values, function (sum, v) {
			if (!isNaN(v)) {
				count += 1;
				return sum + v;
			}
			return sum;
		}, 0);
		if (count > 0) {
			return sum / count;
		}
		return NaN;
	}

	function secondNotUndefined(x) {
		return !isUndefined(x[1]);
	}

	function second(x, y) {
		return y;
	}

	function getProperty(obj, key) {
			return obj && obj[key];
	}

	// need a Maybe
	function saveUndefined(fn) {
		return function (v) {
			return isUndefined(v) ? v : fn(v);
		};
	}

	function subbykey(subtrahend, key, val) {
		return val - subtrahend[key];
	}

	function dataToHeatmap(sorted_samples, data, probes, transform) {
		if (!data) {
			return [];
		}
		return map(probes, function (p) {
			return map(sorted_samples, _.compose(saveUndefined(_.partial(transform, p)), _.partial(getProperty, data[p])));
		});
	}

	function drawColumn(data, color_scale, boxfn) {
		var colors;

		if (color_scale) { // then there exist some non-null values
			// zip colors and their indexes, then filter out the nulls
			colors = filter(zip(range(data.length), map(data, color_scale)), secondNotUndefined);
			each(colors, bind(boxfn.apply, boxfn, null));
		}
	}

	// The browsers want to smooth our images, which messes them up. We avoid
	// certain scaling operations to prevent this.
	// If there are more values than pixels, draw at one-pixel-per-value
	// to avoid sub-pixel aliasing, then scale down to the final size with
	// drawImage(). If there are more pixels than values, draw at an integer
	// scale per-value, giving us an image larger than the final size, then scale
	// down to avoid blurring.
	// We can ditch this complexity when all the browsers allow us to disable
	// smoothing.
	// index & count are floating point.
	function pickScale(index, count, height, data) {
		var first = Math.floor(index),
			last  = Math.ceil(index + count),
			d = data.slice(first, last), // XXX use a typed array view?
			scale = (height >= d.length) ? Math.ceil(height / d.length) : 1,
			scaled_height = d.length * scale || 1, // need min 1 px to draw gray when no data
			sy =  (index - first) * scale,
			sh = scale * count;

		return {
			data: d,                // subset of data to be drawn
			scale: scale,           // chosen scale that avoids blurring
			height: scaled_height,
			sy: sy,                 // pixels off-screen at top of buffer
			sh: sh                  // pixels on-screen in buffer
		};
	}

	function renderHeatmap(opts) {
		var vg       = opts.vg,
			height   = opts.height,
			width    = opts.width,
			zoomIndex = opts.zoomIndex,
			zoomCount = opts.zoomCount,
			layout   = opts.layout,
			data     = opts.data,
			colors   = opts.colors,
			buff = scratch;

		vg.smoothing(false); // For some reason this works better if we do it every time.

		// reset image
		if (data.length === 0) { // no features to draw
			vg.box(0, 0, width, height, "gray");
			return;
		}

		each(layout, function (el, i) {
			var s = pickScale(zoomIndex, zoomCount, height, data[i]),
				color_scale = colors[i];

			buff.height(s.height);
			buff.box(0, 0, 1, s.height, "gray");
			buff.scale(1, s.scale, function () {
				drawColumn(s.data, color_scale, function (i, color) {
					buff.box(0, i, 1, 1, color);
				});
			});
			vg.translate(el.start, 0, function () {
				vg.drawImage(buff.element(), 0, s.sy, 1, s.sh, 0, 0, el.size, height);
			});
		});
	}

	function cmpNumberOrNull(v1, v2) {
		if (isUndefined(v1) && isUndefined(v2)) {
			return 0;
		} else if (isUndefined(v1)) {
			return 1;
		} else if (isUndefined(v2)) {
			return -1;
		}
		return v2 - v1;
	}

	function ifChanged(paths, fn) {
		return function (state, previousState, lastResult) {
			var pluckedState = pluckPathsArray(paths, state),
				pluckedPreviousState;
			if (previousState) {
				pluckedPreviousState = pluckPathsArray(paths, previousState);
				if (_.isEqual(pluckedState, pluckedPreviousState)) {
					return lastResult;
				}
			}
			return fn.apply(this, pluckedState);
		};
	}

	// data might not match col! XXX if the response hasn't arrived yet.
	// where does req fit in?
	// If we request a new view & we deprecate the old data, then the
	// sort changes. Then we rerender w/no usable sort order.

	// need original sample list & field list. Should index when we
	// get the data.
	// XXX Should have this return a closure with the data lookup, so we
	// don't repeat it every time.
	function cmpSamples(probes, data, s1, s2) {
		var diff = data && find(probes, function (f) {
				return data[f] && cmpNumberOrNull(data[f][s1], data[f][s2]);
			});
		if (diff) {
			return cmpNumberOrNull(data[diff][s1], data[diff][s2]);
		} else {
			return 0;
		}
	}

	cmp = ifChanged(
		[
			['column', 'fields'],
			['data', 'req', 'values'],
			['data', 'req', 'probes']
		],
		function (col_fields, data, probes) {
			var fields = probes || col_fields;
			return _.partial(cmpSamples, fields, data);
		}
	);

	// index data by field, then sample
	// XXX maybe build indexes against arrays, instead of ditching the arrays,
	// so we can do on-the-fly stuff, like average, km, against an array.
	function indexResponse(probes, samples, data) {
		var values = _.object(probes, _.map(probes, function (v, i) {
				return _.object(samples, _.map(data[i], xenaQuery.nanstr));
			})),
			mean = function () {
				return _.object(probes, _.map(data, function (v, i) {
					return meannan(v);
				}));
			};

		return {values: values, mean: _.memoize(mean)};
	}

	// XXX A better approach might be to update the other index* functions
	// such that they always create the "probes" in the request.
	//
	// Currently for every other request there's a 1-1 correspondence between
	// requested "fields" and the fields returned by the server, so we just
	// use column.fields to drive the layout and sort. This query is different
	// in that we request one thing (gene) and get back a list of things (probes
	// in the gene). So we can't base layout and sort on column.fields. We instead
	// put the field list into data.req.probes, in this function, and add complexity
	// to render() and cmp() such that they prefer data.req.probes to column.fields.
	// The alternative is to always create data.req.probes.
	function indexProbeGeneResponse(samples, data) {
		var probes = data[0],
			vals = data[1];
		return _.extend({probes: probes}, indexResponse(probes, samples, vals));
	}

	function orderByQuery(genes, data) {
		var indx = _.invert(_.pluck(data, 'gene'));
		return _.map(genes, function (g) {
			var i = indx[g];
			return i && data[i].scores[0]; // XXX extra level of array in g.SCORES??
		});
	}

	function indexGeneResponse(genes, samples, data) {
		return indexResponse(genes, samples, orderByQuery(genes, data));
	}

//	function rowToObj(cols) {
//		return _.reduce(cols, function (acc, col) {
//			acc[col[0]] = col[1];
//			return acc;
//		}, {});
//	}

	function indexFeatures(xhr) {
		var features = JSON.parse(xhr.response);
		return _.reduce(features, function (acc, row) {
			acc[row.name] = row;
			return acc;
		}, {});
	}

	function indexCodes(xhr) {
		var codes = JSON.parse(xhr.response);
		return _.object(_.map(codes, function (row) {
			return [row.name, row.code && row.code.split('\t')];
		}));
	}

	function indexBounds(bounds) {
		return _.object(_.map(bounds, function (row) {
			return [row.field, row];
		}));
	}

	// Where do we get the URL? XXX
	//    URL is associated with the dataset, per-sample.
	//    Have to parse the URL to get the server??
	//    A polymorphic fn to know the server type (xena, tabix, etc...)
	// xena data is a 2d matrix, fields X samples, fields first.
	// two fields, three samples.
	// [[1.1, 2.1, 3.1], [4.2, 5.2, 6.2]]

	// Does the column need to decide which fields cause a
	// new fetch? Or can the caller? The column must decide.

	fetch = ifChanged(
		[
			['column', 'dsID'],
			['column', 'fields'],
			['samples']
		],
		xenaQuery.dsID_fn(function (host, ds, probes, samples) {
			return {
				req: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.dataset_probe_string(ds, samples, probes)), function (r) {
					return Rx.DOM.ajax(r).select(_.compose(_.partial(indexResponse, probes, samples), xenaQuery.json_resp));
				}),
				metadata: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.dataset_string(ds)), function (r) {
					return Rx.DOM.ajax(r).select(xenaQuery.json_resp);
				})
			};
		})
	);

	fetch_gene_probes = ifChanged(
		[
			['column', 'dsID'],
			['column', 'fields'],
			['column', 'dataType'],
			['samples']
		],
		xenaQuery.dsID_fn(function (host, ds, probes, dataType, samples) {
			return {
				req: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.dataset_gene_probes_string(ds, samples, probes)), function (r) {
					return Rx.DOM.ajax(r).select(_.compose(_.partial(indexProbeGeneResponse, samples), xenaQuery.json_resp));
				}),
				metadata: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.dataset_string(ds)), function (r) {
					return Rx.DOM.ajax(r).select(xenaQuery.json_resp);
				})
			};
		})
	);

	fetch_feature = ifChanged(
		[
			['column', 'dsID'],
			['column', 'fields'],
			['samples']
		],
		// XXX Note that we re-fetch metadata even if the probe set hasn't changed.
		// Need a better way than ifChanged of checking for changes.
		xenaQuery.dsID_fn(function (host, ds, probes, samples) {
			return {
				req: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.dataset_probe_string(ds, samples, probes)), function (r) {
					return Rx.DOM.ajax(r).select(_.compose(_.partial(indexResponse, probes, samples), xenaQuery.json_resp));
				}),
				features: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.features_string(ds, probes)), function (r) {
					return Rx.DOM.ajax(r).select(indexFeatures);
				}),
				codes: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.codes_string(ds, probes)), function (r) {
					return Rx.DOM.ajax(r).select(indexCodes);
				}),
				bounds: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.field_bounds_string(ds, probes)), function (r) {
					return Rx.DOM.ajax(r).select(_.compose(indexBounds, xenaQuery.json_resp));
				})
			};
		})
	);

	fetch_gene = ifChanged(
		[
			['column', 'dsID'],
			['column', 'fields'],
			['column', 'dataType'],
			['samples']
		],
		xenaQuery.dsID_fn(function (host, ds, fields, dataType, samples) {
			return {
				req: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.dataset_gene_string(ds, samples, fields)), function (r) {
					return Rx.DOM.ajax(r).select(_.compose(_.partial(indexGeneResponse, fields, samples), xenaQuery.json_resp));
				}),
				metadata: xenaQuery.reqObj(xenaQuery.xena_post(host, xenaQuery.dataset_string(ds)), function (r) {
					return Rx.DOM.ajax(r).select(xenaQuery.json_resp);
				})
			};
		})
	);

	function plotCoords(ev) {
		var offset,
			x = ev.offsetX,
			y = ev.offsetY;
		if (x === undefined) { // fix up for firefox
			offset = util.eventOffset(ev);
			x = offset.x;
			y = offset.y;
		}
		return { x: x, y: y };
	}

	function prec(val) {
		var precision = 6,
			factor = Math.pow(10, precision);
		return Math.round((val * factor)) / factor;
	}

	function mousing(ev) {
		var heatmapData = ev.data.plotData.heatmapData,
			fields = ev.data.plotData.fields,
			column = ev.data.column,
			codes = ev.data.plotData.codes[column.fields[0]],
			ws = ev.data.ws,
			mode = 'genesets',
			rows = [],
			coord,
			sampleIndex,
			fieldIndex,
			field,
			label,
			val,
			tip = {
				ev: ev,
				el: '#nav',
				my: 'top',
				at: 'top',
				mode: mode
			};

		if (tooltip.frozen()) {
			return;
		}
		if (ev.type === 'mouseleave') {
			tooltip.hide();
			return;
		}
		coord = plotCoords(ev);
		sampleIndex = Math.floor((coord.y * ws.zoomCount / ws.height) + ws.zoomIndex);
		fieldIndex = Math.floor(coord.x * fields.length / ws.column.width);
		tip.sampleID = ev.data.plotData.samples[sampleIndex];
		field = fields[fieldIndex];

		if (column.dataType === 'geneProbesMatrix') {
			label = column.fields[0] + ' (' + field + ')';
		} else if (column.dataType === 'clinicalMatrix') {
			label = column.fieldLabel.default;
		} else {
			label = field;
		}
		val = heatmapData[fieldIndex][sampleIndex];
		val = (column.dataType === 'clinicalMatrix' && codes)? codes[val]: prec(val);
		if (val === undefined || _.isNaN(val)) {
			val = 'NA';
		}
		rows.push({ label: label, val: val });
		if (column.dataType === 'clinicalMatrix') {
			tip.valWidth = '25em';
		} else {
			tip.labelWidth = '8em';
			tip.valWidth = '15em';
		}
		if (val !== 'NA' && column.dataType !== 'clinicalMatrix') {
			rows.push({ label: 'Column mean', val: prec(meannan(heatmapData[fieldIndex])) });
		}
		tip.rows = rows;
		tooltip.mousing(tip);
	}

	function categoryLegend(dataIn, color_scale, codes) {
		// only finds categories for the current data in the column
		var data = uniq(dataIn).sort(function (v1, v2) {
				return v1 - v2;
			}),
			colors,
			justColors,
			labels;

		if (color_scale) { // then there exist some non-null values
			// zip colors and their indexes, then filter out the nulls
			colors = filter(zip(range(data.length), map(data, color_scale)), secondNotUndefined);
			justColors =  map(colors, function (color) {
				return color[1];
			});
			if (data[data.length - 1] === undefined) {
				data.pop();
			}
			labels = map(data, function(d) {
				return(codes[d]);
			});
			return { colors: justColors, labels: labels };
		} else {
			return { colors: [], labels: [] };
		}
	}

	function reverse(arr) {
		return arr.slice(0).reverse();
	}

	// Color scale cases
	//  1 - clinical data: single probe, auto-scaled
	//    a - float
	//    b - categorical
	//  2 - genomic data: multiple probe, fixed scale or auto-scale each probe
	//    a - fixed scale
	//    b - auto-scale
	//      1 - single probe
	//      2 - multiple probe
	//
	// In all cases except 2.b.2 there is a single color scale. In that case
	// we get the legend colors by mapping the domain to the scale. For clinical
	// we take labels from the domain. For genomic, we show ranges with < >,
	// taken from the domain.
	//
	// When there are multiple scales, 2.b.2, there are no meaningful numbers
	// we can display as labels, so we use "higher", "lower". Rather than
	// taking the colors by some sort of union over the different color scales,
	// we ignore the scales and use the color setting of the column.
	//
	// This function should be refactored so there's no "fall through" case,
	// so all cases are explicit. Also, meaningful intermediate variables
	// should be created so intent is clear, e.g.
	//
	// color_scale.length > 1 && !_.get_in(settings, ['min'])
	//
	// means there are mutiple probes and the user has not set a fixed scale,
	// i.e. we have multiple color scales.
	function drawLegend(metadata, settings, columnUi, data, fields, codes, color_scale) {
		var c,
			ellipsis = '',
			align = 'center',
			labels = color_scale[0] ? color_scale[0].domain() : [],
			colors = color_scale[0] ? _.map(labels, color_scale[0]) : [],
			categoryLength = 19;

		if (data.length === 0) { // no features to draw
			return;
		}

		if (metadata.type === 'genomicMatrix') {
			if (color_scale.length > 1 && !_.get_in(settings, ['min'])) {
				colors = heatmapColors.defaultColors(metadata.type, metadata.dataSubType).slice(0);
				labels = ["lower", "", "higher"];
			}
			else if (color_scale[0]) {
				if (labels.length === 4) {
					labels[0] = "<" + labels[0];
					labels[labels.length - 1] = ">" + labels[labels.length - 1];
				} else if (labels.length === 3) {
					if (color_scale[0].domain()[0] >= 0) {
						labels[labels.length-1] = ">" + labels[labels.length - 1];
					} else {
						labels[0] = "<" + labels[0];
					}
				}
			}
		}

		if (metadata.dataType === 'clinicalMatrix') { // XXX can we use domain() for categorical?
			if (codes[fields[0]]) { // category
				c = categoryLegend(data[0], color_scale[0], codes[fields[0]]);
				if (c.colors.length > categoryLength) {
					ellipsis = '...';
					colors = c.colors.slice(c.colors.length - categoryLength, c.colors.length);
					labels = c.labels.slice(c.colors.length - categoryLength, c.colors.length);
				} else {
					colors = c.colors;
					labels = c.labels;
				}
				align = 'left';
			}
		}
		columnUi.drawLegend(colors, labels, align, ellipsis);
	}

	function definedOrDefault(v, def) {
		return _.isUndefined(v) ? def : v;
	}

	// memoize doesn't help us here, because we haven't allocated a render routine
	// for each widget. Maybe we should???
	render = ifChanged(
		[
			['disp'],
			['el'],
			['wrapper'],
			[],
			['sort'],
			['data']
		],
		// samples are in sorted order
		function (disp, el, wrapper, ws, sort, data) {
			var local = disp.getDisposable(),
				features = data.features || {},
				codes = data.codes || {},
				metadata = data.metadata || {},
				mean = _.get_in(data, ["req", "mean"]),
				norm = {'none': false, 'subset': true},

				colnormalization = definedOrDefault(norm[_.get_in(ws, ['vizSettings', 'colNormalization'])], metadata.colnormalization),
				settings = _.get_in(ws, ['vizSettings']) || {}, // XXX needs normalization, too?
				column = ws.column,
				newws =  _.assoc(ws, 'column', _.extend({}, ws.column, metadata)),
				fields = data.req.probes || column.fields, // prefer field list from server
				transform = (colnormalization && mean && _.partial(subbykey, mean())) || second,
				columnUi,
				vg,
				heatmapData,
				colors;

			if (!local || local.render !== render) { // Test if we own this state
				local = new Rx.Disposable(function () {
					$(vg.element).remove();
				});
				local.render = render;
				local.vg = vgcanvas(column.width, ws.height);
				local.columnUi = wrapper(el.id, newws);
				local.columnUi.$samplePlot.append(local.vg.element());
				disp.setDisposable(local);
			}
			// XXX The state flow for columnUi, and friends is completely wrong. Needs to be
			// rewritten.
			vg = local.vg;
			columnUi = local.columnUi;

			if (vg.width() !== column.width) {
				vg.width(column.width);
			}

			if (vg.height() !== ws.height) {
				vg.height(ws.height);
			}

			heatmapData = dataToHeatmap(sort, data.req.values, fields, transform);
			colors = map(fields, function (p, i) {
				return heatmapColors.range(metadata, settings, features[p], codes[p], heatmapData[i]); // XXX might need defaults if metadata is null?
			});
			if (columnUi && heatmapData.length) {
				columnUi.plotData = {
					// TODO we don't need all these parms
					serverData: data.req.values,
					heatmapData: heatmapData,
					column: column,
					samples: sort,
					fields: fields,
					codes: codes
				};
				columnUi.ws = _.assoc(newws, 'colors', colors); // XXX this is horrible
				columnUi.setPlotted();
				if (local.sub) {
					local.sub.dispose();
				}
				local.sub = columnUi.crosshairs.mousingStream.subscribe(function (ev) {
					ev.data = {
						plotData: columnUi.plotData,
						column: column,
						ws: newws   // XXX this is horrible
					};
					mousing(ev);
				}); // TODO free this somewhere, maybe by moving it to columnUi.js
			}
			// XXX Merging column & metadata so we get both dataType and type. The
			// type, dataSubType, dataType thing needs to be fixed.
			drawLegend(_.extend({}, column, metadata), settings, columnUi, heatmapData, fields, codes, colors);
			renderHeatmap({
				vg: vg,
				height: ws.height,
				width: column.width,
				zoomIndex: ws.zoomIndex,
				zoomCount: ws.zoomCount,
				data : heatmapData,
				layout: partition.offsets(column.width, 0, heatmapData.length),
				colors: colors
			});
		}
	);

	widgets.cmp.add("probeMatrix", cmp);
	widgets.fetch.add("probeMatrix", fetch);
	widgets.render.add("probeMatrix", render);

	widgets.cmp.add("geneProbesMatrix", cmp);
	widgets.fetch.add("geneProbesMatrix", fetch_gene_probes);
	widgets.render.add("geneProbesMatrix", render);

	widgets.cmp.add("geneMatrix", cmp);
	widgets.fetch.add("geneMatrix", fetch_gene);
	widgets.render.add("geneMatrix", render);

	widgets.cmp.add("clinicalMatrix", cmp);
	widgets.fetch.add("clinicalMatrix", fetch_feature);
	widgets.render.add("clinicalMatrix", render);
});
