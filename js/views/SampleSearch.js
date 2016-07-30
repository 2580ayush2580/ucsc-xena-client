/*global require: false, module: false */
'use strict';

var React = require('react');
var Input = require('react-bootstrap/lib/Input');
var Button = require('react-bootstrap/lib/Button');
var SplitButton = require('react-bootstrap/lib/SplitButton');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var {deepPureRenderMixin} = require('../react-utils');

var SampleSearch = React.createClass({
	mixins: [deepPureRenderMixin],
	componentWillReceiveProps: function (newProps) {
		if (this.state.value === this.props.value) {
			this.setState({value: newProps.value});
		}
		// otherwise we have buffered changes to state, and
		// updating from props would revert the user input
		// and move the carat to the end.
	},
	getInitialState: function () {
		return {value: this.props.value};
	},
	onChange: function (ev) {
		var {onChange} = this.props,
			value = ev.target.value;
		this.setState({value});
		onChange(value);
	},
	render: function () {
		var {matches, help, onFilter, onZoom, onCreateColumn, mode} = this.props,
			{value} = this.state,
			noshow = (mode !== "heatmap"),
			filterButton = onFilter ?
					(<span
						 title='Apply as filter'
						 className='glyphicon glyphicon-filter'
						 aria-hidden='true'/>) : null;
		return (
			<form className='form-inline'>
				<Input style={{width: '26em'}}
					type='text'
					value={value}
					title={value}
					placeholder='Samples to highlight. e.g. TCGA-DB-A4XH, missense'
					onChange={this.onChange}
					disabled={noshow}/>
				{` Matching samples: ${matches}`}
				{filterButton ?
					(<SplitButton onClick={onFilter} bsSize='sm' title={filterButton} disabled={noshow}>
						<MenuItem title='Apply to filter' onClick={onFilter}>Filter</MenuItem>
						<MenuItem title='Apply to zoom' onClick={onZoom}>Zoom</MenuItem>
						<MenuItem title='Create column from' onClick={onCreateColumn}>Sort</MenuItem>
					</SplitButton>) : null}
				{help ? <Button bsStyle='link' target='_blank' href={help}>Help with search</Button> : null}
			</form>
		);
	}
});

module.exports = SampleSearch;
