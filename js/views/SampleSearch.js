'use strict';

var React = require('react');
var Input = require('react-bootstrap/lib/Input');
var Button = require('react-bootstrap/lib/Button');
var SplitButton = require('react-bootstrap/lib/SplitButton');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var Modal = require('react-bootstrap/lib/Modal');

var {deepPureRenderMixin} = require('../react-utils');

var SampleIDInput = React.createClass({
	getInitialState() {
		return {
			show: false,
			value: ''
		};
	},
	onChange (ev) {
		var value = ev.target.value;
		this.setState({value});
	},
	close () {
		this.setState({ show: false});
	},
	submit () {
		var samplesOR = this.state.value.split(/\s+/).join(' OR '),
			{onSamplesSubmit} = this.props;

		onSamplesSubmit(samplesOR);

		this.props = samplesOR;
		this.close();
		this.state.value = '';
	},
	render() {
		return (
			<span className = "modal-container" >
				<Button
					bsSize = "small"
					onClick = {() => this.setState({ show: true})}>
					Sample list
				</Button>
				<Modal
					show={this.state.show}
					onHide={this.close}
					container={this}
					aria-labelledby="contained-modal-title">
					<Modal.Header closeButton>
						<Modal.Title id="contained-modal-title">Enter a list of samaple IDs to highlight</Modal.Title>
					</Modal.Header>
					<Modal.Body>
						<Input style={{width: 550, height: 200}}
							value={this.state.value}
							type ="textarea"
							placeholder='e.g. TCGA-DB-A4XH TCGA-01-2345'
							onChange={this.onChange}/>
					</Modal.Body>
					<Modal.Footer>
						<Button onClick={this.submit}>Submit</Button>
						<Button onClick={this.close}>Cancel</Button>
					</Modal.Footer>
				</Modal>
			</span>
		);
	}
});

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
	onSamplesSubmit: function (value) {
		var {onChange} = this.props;
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
			<form className='form-inline' onSubmit={ev => ev.preventDefault()}>
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
						<MenuItem title='Create column from' onClick={onCreateColumn}>New Column</MenuItem>
					</SplitButton>) : null}
				{help ? <Button bsStyle='link' target='_blank' href={help}>Help with search</Button> : null}
				<SampleIDInput onSamplesSubmit={this.onSamplesSubmit}/>
			</form>
		);
	}
});

module.exports = SampleSearch;
