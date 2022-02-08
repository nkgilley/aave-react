import React, { Component } from 'react';
import './NetworkSelect.css';

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
        <div className="row justify-content-end mt-2">
          <div className="col-3">
            <select id="selectNetwork" className="form-select" value={this.state.value} onChange={this.handleChange}>
              <option value="eth">Mainnet</option>
              <option value="avax">Avalanche</option>
              <option value="matic">Polygon</option>
            </select>
          </div>
        </div>
      </form>
    );
  }
}

export default NetworkSelect;
