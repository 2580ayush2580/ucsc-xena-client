/*globals require: false, module: false */
'use strict';

/*
 * Text input element with a default value which will
 * - Style the text if the user has entered a non-default value
 * - Restore the default if the user deletes the text
 */

const React = require('react');
var Input = require('react-bootstrap/lib/Input');
var rxEventsMixin = require('./react-utils').rxEventsMixin;

var styles = {
	input: {
		defaultValue: {
			fontStyle: 'italic',
			color: '#666666'
		},
		user: {
		}
	}
};

var DefaultTextInput = React.createClass({
	mixins: [rxEventsMixin],
	componentWillMount: function () {
		this.events('change');
		this.change = this.ev.change
		.do(() => this.setState({value: this.refs.input.getValue()}))
		.throttle(100)
		.subscribe(this.update);
	},
	componentWillUnmount: function () {
		this.change.dispose();
	},
	getInitialState: function () {
		return {value: this.props.value.user};
	},
	resetIfNull: function () {
		var {callback, columnID, eventName, value: {'default': defaultValue}} = this.props,
			val = this.refs.input.getValue();

		if (val === "") {
			this.setState({value: defaultValue});
			callback([eventName, columnID, defaultValue]);
		}
	},
	update: function () {
		var {callback, columnID, eventName} = this.props,
			{value} = this.state;

		callback([eventName, columnID, value]);
	},
	onKeyUp: function (ev) {
		if (ev.key === 'Enter' && this) {
			this.resetIfNull();
		}
	},
	render: function () {
		var {value: {'default': defaultValue}} = this.props,
			{value} = this.state,
			style = (value === defaultValue) ?
				styles.input.defaultValue : styles.input.user;

		return (
			<Input
				standalone={true}
				ref='input'
				onChange={this.ev.change}
				onKeyUp={this.onKeyUp}
				onBlur={this.resetIfNull}
				style={style}
				type='text'
				title={value}
				value={value} />
		);
	}
});

module.exports = DefaultTextInput;
