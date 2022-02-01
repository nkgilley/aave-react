import React, { Component } from 'react';

class NetworkSelect extends Component {
  constructor(props) {
    super(props);
    this.state = {value: this.props.network};
    this.stateChanger = this.props.stateChanger;

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event) {
    this.setState({value: event.target.value});
    this.stateChanger(event.target.value)
  }

  render() {
    return (
      <form>
        <label>
          Network:
          <select value={this.state.value} onChange={this.handleChange}>
            <option value="eth">Mainnet</option>
            <option value="avax">Avalanche</option>
            <option value="matic">Matic</option>
          </select>
        </label>
      </form>
    );
  }
}

export default NetworkSelect;
