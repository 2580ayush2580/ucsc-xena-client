'use strict';

var React = require('react');
var Rx = require('../rx');
var Welcome = require('../views/Welcome');
var {rxEventsMixin, deepPureRenderMixin} = require('../react-utils');

var links = [
	['heatmap', '0345d7916e21265748ceddf95fe6941b',
		'FOXM1a, FOXM1b, FOXM1c transcript expression in tumor vs. normal samples'],
	['heatmap', 'e1649cf9068043e626d7edb5a2203479',
		'Mutation pile-ups in intron enhancers in ICGC lymphoma'],
	['heatmap', '20ac60405f8dbcfb61ce001bb12094a7',
		'KM plot (overall survival) of breast cancer PAM50 subtypes'],
	['heatmap', '1529e36190e1107c4716b9888bd3324a',
		'Copy number for EGFR, PTEN, chromosome 1, 7, 10, 19 in TCGA brain tumors'],
	['heatmap', 'e5080f15c2715bc027a9a7b63c18ccf9',
		'PDL1 and PD1 expression across 39 cancer types in TCGA and TARGET'],
	['heatmap', '4581843a2f792aa8f215964d0d756896',
		'ERG-TMPRSS2 fusion by chr21 deletion in prostate cancer'],
	['heatmap', 'e5cdbea6320c823004772c0eaced3924',
		'TERT, ATRX, TP53 in lower grade glioma. Two pathways to telomere lengthening'],
	['heatmap', 'bb15f97f0e0dc0fad854582d59f1d13b',
		'Co-deletion of chromosome 1p and 19q in TCGA lower grade gliomas'],
	['transcripts', '25a9782db8c1166ce7bae6686e98124c',
		'KRAS isoform expression in TCGA pancreatic cancer vs. GTEx pancreas normal']];


var refresh = 5000; // ms between link switch
var WelcomeContainer = React.createClass({
	mixins: [rxEventsMixin, deepPureRenderMixin],
	getInitialState() {
		return {link: links[Math.floor(Math.random() * links.length)]};
	},
	componentWillMount() {
		this.events('mouseover', 'mouseout');

		// Emit events on an interval, pausing if the user mouses-over
		// the target link. The timer restarts on mouse-out, so it won't
		// change immediately.
		this.sub = Rx.Observable.of(true).merge(this.ev.mouseout).flatMap(
			() => Rx.Observable.interval(refresh).takeUntil(this.ev.mouseover)
		).subscribe(() =>
			this.setState({link: links[Math.floor(Math.random() * links.length)]}));
	},
	componentWillUnmount() {
		this.sub.unsubscribe();
	},
	render() {
		var {link} = this.state;
		return (
			<Welcome
				linkProps={{onMouseOver: this.on.mouseover, onMouseOut: this.on.mouseout}}
				{...this.props}
				link={link} />);
	}
});

module.exports = WelcomeContainer;
